import React, { useState, useEffect, useRef } from 'react';
import { syncService } from '../lib/syncService';
import { Plus, Trash2, LayoutDashboard, LogOut, RefreshCw, Monitor, Loader2, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminPanel = ({ isPairing = false }) => {
    const [screens, setScreens] = useState([]);
    const [selectedScreen, setSelectedScreen] = useState(null);
    const [playlist, setPlaylist] = useState([]);
    const [newItem, setNewItem] = useState({ url: '', type: 'image', duration: 10, fitMode: 'cover' });
    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [isAddingScreen, setIsAddingScreen] = useState(isPairing);
    const [newScreenData, setNewScreenData] = useState({ id: '', name: '' });

    // Handle Quick Pairing from URL
    useEffect(() => {
        if (isPairing) {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            if (code) {
                setNewScreenData(prev => ({ ...prev, id: code }));
                setIsAddingScreen(true);
            }
        }
    }, [isPairing]);

    // 1. Real-time Screens List
    useEffect(() => {
        const unsubScreens = syncService.subscribeToScreens((data) => {
            setScreens(data);
            const lastId = localStorage.getItem('last_screen_id');
            if (data.length > 0) {
                const savedScreen = data.find(s => s.id === lastId);
                if (savedScreen) {
                    setSelectedScreen(savedScreen);
                } else if (!selectedScreen) {
                    setSelectedScreen(data[0]);
                }
            }
            setLoading(false);
        });
        return () => unsubScreens();
    }, []);

    // 2. Real-time Playlist for Selected Screen
    useEffect(() => {
        if (!selectedScreen) return;
        localStorage.setItem('last_screen_id', selectedScreen.id);
        setIsSyncing(true);
        const unsubscribe = syncService.subscribeToScreen(selectedScreen.id, (data) => {
            if (data?.playlist) {
                setPlaylist(data.playlist);
            }
            setIsSyncing(false);
        });
        return () => unsubscribe();
    }, [selectedScreen?.id]);

    const handleAddScreen = async (e) => {
        e.preventDefault();
        if (!newScreenData.id || !newScreenData.name) return;
        try {
            await syncService.registerScreen(newScreenData.id, newScreenData.name);
            setNewScreenData({ id: '', name: '' });
            setIsAddingScreen(false);
        } catch (err) {
            alert("Erro ao adicionar.");
        }
    };

    const handleDeleteScreen = async (e, screenId) => {
        e.stopPropagation();
        if (!window.confirm('Excluir este totem?')) return;
        try {
            await syncService.deleteScreen(screenId);
            if (selectedScreen?.id === screenId) setSelectedScreen(null);
        } catch (err) {
            alert("Erro ao deletar.");
        }
    };

    const handleSelectScreen = (screen) => {
        setSelectedScreen(screen);
        setIsMobileMenuOpen(false);
    };

    const getYoutubeId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const isScreenOnline = (lastSeen) => {
        if (!lastSeen) return false;
        const now = Date.now();
        const diff = now - lastSeen;
        return diff < 40000; // Online if updated in last 40s
    };

    const getGoogleDriveId = (url) => {
        const patterns = [
            /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
            /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
            /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        return null;
    };

    const convertToDirectLink = (url) => {
        // Google Drive conversion
        if (url.includes('drive.google.com')) {
            const fileId = getGoogleDriveId(url);
            if (fileId) {
                return `https://docs.google.com/uc?export=download&id=${fileId}`;
            }
        }
        // Dropbox conversion
        if (url.includes('dropbox.com')) {
            return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
        }
        return url;
    };

    const handleToggleOrientation = async () => {
        if (!selectedScreen) return;
        setIsSyncing(true);
        const newOrientation = selectedScreen.orientation === 'portrait' ? 'landscape' : 'portrait';
        try {
            await syncService.updateScreen(selectedScreen.id, { orientation: newOrientation });
        } catch (err) {
            alert("Erro ao alterar orientação.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleForceReload = async () => {
        if (!selectedScreen) return;
        if (!window.confirm(`Deseja forçar a atualização da tela "${selectedScreen.name}"? Isso fará a página recarregar lá no totem.`)) return;

        setIsSyncing(true);
        try {
            await syncService.sendReloadCommand(selectedScreen.id);
            alert("Comando enviado! O totem deve recarregar em instantes.");
        } catch (err) {
            alert("Erro ao enviar comando.");
        } finally {
            setIsSyncing(false);
        }
    };

    const addItem = async (e) => {
        e.preventDefault();
        if (!newItem.url || !selectedScreen) return;
        setIsSyncing(true);

        const youtubeId = getYoutubeId(newItem.url);
        const finalUrl = convertToDirectLink(newItem.url);
        let finalType = newItem.type;
        if (youtubeId) finalType = 'youtube';

        const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
        const updatedPlaylist = [...playlist, { ...newItem, url: finalUrl, type: finalType, id, order: playlist.length + 1 }];

        try {
            await syncService.updatePlaylist(selectedScreen.id, updatedPlaylist);
            setNewItem({ url: '', type: 'image', duration: 10, fitMode: 'cover' });
        } catch (err) {
            console.error("Erro ao adicionar item:", err);
            alert("Erro ao salvar no Firebase.");
        } finally {
            setIsSyncing(false);
        }
    };

    const deleteItem = async (id) => {
        if (!selectedScreen) return;
        setIsSyncing(true);
        const updatedPlaylist = playlist.filter(item => item.id !== id);
        await syncService.updatePlaylist(selectedScreen.id, updatedPlaylist);
    };

    const handleClearPlaylist = async () => {
        if (!selectedScreen) return;
        if (!window.confirm('Tem certeza?')) return;
        setIsSyncing(true);
        await syncService.updatePlaylist(selectedScreen.id, []);
        setIsSyncing(false);
    };

    const handleLogout = () => {
        sessionStorage.removeItem('admin_auth');
        window.location.reload();
    };

    if (loading) return (
        <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
    );

    return (
        <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row font-sans selection:bg-orange-500 selection:text-white overflow-hidden">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 bg-black/80 border-b border-zinc-800 backdrop-blur-xl shrink-0 z-[60]">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                        <LayoutDashboard className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-black text-lg">Totem Cloud</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-3 bg-zinc-900 rounded-xl text-orange-500 active:scale-95 border border-zinc-800"
                >
                    <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Sidebar Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-[70]"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <aside className={`
                fixed md:relative top-0 left-0 z-[80]
                w-[85%] md:w-80 h-full border-r border-zinc-800 p-8 flex flex-col gap-8 bg-black/95 md:bg-black/50 backdrop-blur-3xl 
                transition-transform duration-500 ease-out md:translate-x-0
                ${isMobileMenuOpen ? 'translate-x-0 shadow-[20px_0_60px_rgba(0,0,0,0.8)]' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="hidden md:flex items-center gap-3 px-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <LayoutDashboard className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-black text-xl tracking-tight leading-none text-white">Totem Cloud</h1>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Sinalização Digital</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <p className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Suas Telas</p>
                        <button onClick={() => setIsAddingScreen(true)} className="p-1.5 bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white rounded-lg transition-all">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <AnimatePresence>
                        {isAddingScreen && (
                            <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                onSubmit={handleAddScreen} className="bg-zinc-900 p-4 rounded-2xl border border-orange-500/20 overflow-hidden"
                            >
                                <div className="space-y-3">
                                    <input type="text" placeholder="ID do Totem" value={newScreenData.id} onChange={(e) => setNewScreenData({ ...newScreenData, id: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500 transition-all font-bold" required />
                                    <input type="text" placeholder="Nome da Tela" value={newScreenData.name} onChange={(e) => setNewScreenData({ ...newScreenData, name: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500 transition-all font-bold" required />
                                    <div className="flex gap-2">
                                        <button type="submit" className="flex-1 bg-orange-500 text-white py-2 rounded-xl text-[10px] font-black uppercase">Salvar</button>
                                        <button type="button" onClick={() => setIsAddingScreen(false)} className="px-3 py-2 bg-zinc-800 text-zinc-400 rounded-xl text-[10px] font-black uppercase">X</button>
                                    </div>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    <div className="flex flex-col gap-3">
                        {screens.map(screen => (
                            <button key={screen.id} onClick={() => handleSelectScreen(screen)}
                                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl transition-all group ${selectedScreen?.id === screen.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-zinc-500 hover:bg-zinc-900/50'}`}
                            >
                                <div className="flex items-center gap-3 truncate">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${isScreenOnline(screen.lastSeen) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                                    {screen.orientation === 'portrait' ? <Smartphone className="w-3 h-3 text-zinc-600" /> : <Monitor className="w-3 h-3 text-zinc-600" />}
                                    <span className="text-xs font-bold truncate">{screen.name}</span>
                                </div>
                                <Trash2 onClick={(e) => handleDeleteScreen(e, screen.id)} className={`w-3.5 h-3.5 ${selectedScreen?.id === screen.id ? 'text-white/40 hover:text-white' : 'text-zinc-800 hover:text-red-500'} transition-colors`} />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pt-6 border-t border-zinc-900 space-y-2">
                    <button onClick={handleLogout} className="flex items-center gap-3 px-5 py-3 text-zinc-500 hover:text-red-400 transition-all text-sm w-full font-bold">
                        <LogOut className="w-4 h-4" /> Sair
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative">
                {selectedScreen ? (
                    <div className="p-6 md:p-12 max-w-6xl mx-auto pb-32">
                        <header className="mb-12 flex flex-col md:flex-row justify-between items-start gap-8">
                            <div>
                                <div className={`inline-flex items-center gap-2 ${isScreenOnline(selectedScreen.lastSeen) ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'} text-[10px] font-black px-3 py-1 rounded-full border mb-4 uppercase tracking-widest`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${isScreenOnline(selectedScreen.lastSeen) ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                                    {selectedScreen.name} • {isScreenOnline(selectedScreen.lastSeen) ? 'ONLINE' : 'OFFLINE'}
                                </div>
                                <button
                                    onClick={handleForceReload}
                                    title="Forçar recarregamento da página no Totem"
                                    className="ml-3 inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[9px] font-black px-3 py-1 rounded-full border border-zinc-700 transition-all uppercase tracking-widest active:scale-95"
                                >
                                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                                    Reiniciar Player
                                </button>
                                <button
                                    onClick={handleToggleOrientation}
                                    title="Alternar entre Horizontal e Vertical"
                                    className="ml-2 inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[9px] font-black px-3 py-1 rounded-full border border-zinc-700 transition-all uppercase tracking-widest active:scale-95"
                                >
                                    {selectedScreen.orientation === 'portrait' ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                                    {selectedScreen.orientation === 'portrait' ? 'MODO VERTICAL' : 'MODO HORIZONTAL'}
                                </button>
                                <h2 className="text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter leading-none">
                                    Gerenciar <span className="text-orange-500">Mídias</span>
                                </h2>
                            </div>
                        </header>

                        {/* Add Item Form */}
                        <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl mb-12">
                            <form onSubmit={addItem} className="space-y-8">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                                    <div className="lg:col-span-12">
                                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Link da Mídia</label>
                                        <input type="text" value={newItem.url} onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                                            placeholder="Cole aqui a URL da Imagem, Vídeo ou YouTube"
                                            className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none text-white font-medium" required />
                                    </div>

                                    <div className="lg:col-span-4">
                                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Tipo</label>
                                        <select value={newItem.type} onChange={(e) => {
                                            const val = e.target.value;
                                            setNewItem({ ...newItem, type: val, duration: (val === 'video' || val === 'youtube') ? 0 : 10 });
                                        }} className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-bold text-white appearance-none cursor-pointer">
                                            <option value="image">🖼️ Imagem</option>
                                            <option value="video">🎥 Vídeo Direto</option>
                                            <option value="youtube">📺 YouTube</option>
                                        </select>
                                    </div>

                                    <div className="lg:col-span-3">
                                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Exibição (Seg)</label>
                                        <input type="number" value={newItem.duration} onChange={(e) => setNewItem({ ...newItem, duration: parseInt(e.target.value) || 0 })}
                                            className={`w-full bg-black border ${newItem.duration === 0 ? 'border-emerald-500/50 text-emerald-500' : 'border-zinc-800 text-white'} rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-black`} min="0" />
                                    </div>

                                    <div className="lg:col-span-3">
                                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Encaixe</label>
                                        <select value={newItem.fitMode} onChange={(e) => setNewItem({ ...newItem, fitMode: e.target.value })}
                                            className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-bold text-white cursor-pointer appearance-none"
                                        >
                                            <option value="cover">✂️ Preencher (Cortar)</option>
                                            <option value="contain">🖼️ Ajustar (Inteira)</option>
                                            <option value="smart">🚀 Preenchimento Inteligente</option>
                                        </select>
                                    </div>

                                    <div className="lg:col-span-3">
                                        <button type="submit" disabled={isSyncing || !newItem.url} className="w-full h-[66px] bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-orange-500/20 active:scale-95 uppercase tracking-widest disabled:opacity-50 text-xs">
                                            Adicionar
                                        </button>
                                    </div>
                                </div>
                                {newItem.duration === 0 && (
                                    <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider ml-1">✨ Mídia configurada para durar até o final automaticamente.</p>
                                )}
                            </form>
                        </div>

                        {/* Playlist Header */}
                        <div className="flex items-center justify-between mb-8 px-2">
                            <h3 className="font-black text-2xl uppercase tracking-tighter text-zinc-300">Playlist Ativa ({playlist.length})</h3>
                            {playlist.length > 0 && (
                                <button onClick={handleClearPlaylist} className="text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest bg-red-500/5 px-4 py-2 rounded-xl border border-red-500/10">
                                    Limpar Tudo
                                </button>
                            )}
                        </div>

                        {/* Playlist Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            <AnimatePresence mode="popLayout">
                                {playlist.map((item, index) => (
                                    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} key={item.id}
                                        className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] overflow-hidden group shadow-xl"
                                    >
                                        <div className="aspect-video bg-black relative">
                                            {item.type === 'video' ? (
                                                <video src={item.url} className="w-full h-full object-cover" muted />
                                            ) : item.type === 'youtube' ? (
                                                <img src={`https://img.youtube.com/vi/${getYoutubeId(item.url)}/hqdefault.jpg`} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <img src={item.url} className="w-full h-full object-cover" alt="" />
                                            )}
                                            <div className="absolute top-4 left-4 flex gap-2">
                                                <div className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black border border-white/10 uppercase tracking-widest">
                                                    {item.type}
                                                </div>
                                                <div className="bg-orange-500 px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest">
                                                    #{index + 1}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-6 flex items-center justify-between gap-4">
                                            <div className="truncate">
                                                <p className="text-[10px] text-zinc-500 font-black uppercase mb-1 tracking-widest">Link da Mídia</p>
                                                <p className="text-xs text-zinc-300 truncate font-medium">{item.url}</p>
                                            </div>
                                            <button onClick={() => deleteItem(item.id)} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all shrink-0">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12">
                        <div className="w-24 h-24 bg-zinc-900 border border-zinc-800 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl">
                            <Monitor className="w-10 h-10 text-zinc-700" />
                        </div>
                        <h2 className="text-3xl font-black mb-3 uppercase tracking-tighter leading-none italic">Selecione <span className="text-zinc-700">um Totem</span></h2>
                        <p className="text-zinc-600 max-w-xs mx-auto text-sm font-bold uppercase tracking-widest leading-relaxed opacity-50">Sua central de sinalização digital está pronta.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminPanel;
