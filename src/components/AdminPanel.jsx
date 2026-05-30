import React, { useState, useEffect } from 'react';
import { syncService } from '../lib/syncService';
import { supabase } from '../lib/supabase'; // Certifique-se de que o caminho para o seu cliente Supabase está correto
import { LayoutDashboard, LogOut, RefreshCw, Monitor, Loader2, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminHeader from './AdminHeader';
import AddItemForm from './AddItemForm';
import PlaylistGrid from './PlaylistGrid';
import ScreenList from './ScreenList';

const AdminPanel = ({ isPairing = false }) => {
    const [screens, setScreens] = useState([]);
    const [selectedScreen, setSelectedScreen] = useState(null);
    const [playlist, setPlaylist] = useState([]);
    const [newItem, setNewItem] = useState({ url: '', type: 'image', duration: 10, fitMode: 'cover' });
    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [tickerText, setTickerText] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);

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
                setSelectedScreen(prev => {
                    const currentId = prev?.id || lastId;
                    const found = data.find(s => s.id === currentId);
                    return found || data[0];
                });
            } else {
                setSelectedScreen(null);
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

    useEffect(() => {
        setTickerText(selectedScreen?.ticker?.text || '');
    }, [selectedScreen?.ticker?.text]);

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
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|live\/)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const isVideoUrl = (url) => {
        if (!url) return false;
        const cleanUrl = url.split('?')[0].split('#')[0];
        return /\.(mp4|webm|ogg|ogv|mov|m4v|mkv|avi)$/i.test(cleanUrl);
    };

    const handleUrlChange = (url) => {
        const youtubeId = getYoutubeId(url);
        const isVideo = isVideoUrl(url);

        let detectedType = 'image';
        let detectedDuration = 10;

        if (youtubeId) {
            detectedType = 'youtube';
            detectedDuration = 0;
        } else if (isVideo) {
            detectedType = 'video';
            detectedDuration = 0;
        }

        setNewItem(prev => ({
            ...prev,
            url: url,
            type: detectedType,
            duration: detectedDuration
        }));
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

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(10); // Inicia o progresso

        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;

        try {
            // Envia o arquivo para o bucket 'medias' no Supabase
            const { data, error } = await supabase.storage
                .from('medias')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            setUploadProgress(100);

            // Recupera a URL pública do arquivo recém-enviado
            const { data: publicUrlData } = supabase.storage.from('medias').getPublicUrl(fileName);
            
            handleUrlChange(publicUrlData.publicUrl);
        } catch (error) {
            console.error("Erro no upload:", error);
            alert("Erro ao enviar arquivo para o Supabase. Verifique se o bucket 'medias' é público e as políticas RLS.");
        } finally {
            setIsUploading(false);
            setTimeout(() => setUploadProgress(0), 1000);
        }
    };

    const handleToggleSound = async () => {
        if (!selectedScreen) return;
        setIsSyncing(true);
        const newIsMuted = selectedScreen.isMuted === false ? true : false;
        try {
            await syncService.updateScreen(selectedScreen.id, { isMuted: newIsMuted });
        } catch (err) {
            alert("Erro ao alterar o som.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleVolumeChange = async (newVolume) => {
        if (!selectedScreen) return;
        try {
            await syncService.updateScreen(selectedScreen.id, { volume: newVolume });
        } catch (err) {
            console.error("Erro ao alterar o volume:", err);
        }
    };

    const handleTogglePlayPause = async () => {
        if (!selectedScreen) return;
        setIsSyncing(true);
        const newIsPlaying = selectedScreen.isPlaying === false ? true : false;
        try {
            await syncService.updateScreen(selectedScreen.id, { isPlaying: newIsPlaying });
        } catch (err) {
            alert("Erro ao alterar reprodução.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleTickerToggle = async () => {
        if (!selectedScreen) return;
        setIsSyncing(true);
        const newIsActive = !(selectedScreen.ticker?.isActive);
        try {
            await syncService.updateScreen(selectedScreen.id, { 
                ticker: { text: tickerText, isActive: newIsActive } 
            });
        } catch (err) {
            alert("Erro ao alterar letreiro.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleTickerTextSave = async (text) => {
        if (!selectedScreen) return;
        setIsSyncing(true);
        try {
            await syncService.updateScreen(selectedScreen.id, { 
                ticker: { ...selectedScreen.ticker, text } 
            });
        } catch (err) {
            alert("Erro ao alterar texto do letreiro.");
        } finally {
            setIsSyncing(false);
        }
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
        let finalDuration = newItem.duration;

        if (youtubeId) {
            finalType = 'youtube';
            // Auto-detect: if type was image (default), reset duration to 0 so it plays fully
            if (newItem.type === 'image') {
                finalDuration = 0;
            }
        } else if (isVideoUrl(finalUrl)) {
            finalType = 'video';
            // Auto-detect: if type was image (default), reset duration to 0 so it plays fully
            if (newItem.type === 'image') {
                finalDuration = 0;
            }
        }

        const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
        const updatedPlaylist = [
            ...playlist, 
            { 
                ...newItem, 
                url: finalUrl, 
                type: finalType, 
                duration: finalDuration, 
                isActive: true,
                id, 
                order: playlist.length + 1 
            }
        ];

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
        setIsSyncing(false); // Make sure to turn off syncing indicator
    };

    const moveItem = async (index, direction) => {
        if (!selectedScreen) return;
        setIsSyncing(true);

        const newPlaylist = [...playlist];
        const newIndex = index + direction;

        if (newIndex < 0 || newIndex >= newPlaylist.length) {
            setIsSyncing(false);
            return;
        }

        // Troca os itens de posição
        const temp = newPlaylist[newIndex];
        newPlaylist[newIndex] = newPlaylist[index];
        newPlaylist[index] = temp;

        // Opcional: Atualiza a propriedade "order" de cada um
        const updatedPlaylist = newPlaylist.map((item, idx) => ({ ...item, order: idx + 1 }));
        setPlaylist(updatedPlaylist); // Atualização visual imediata

        try {
            await syncService.updatePlaylist(selectedScreen.id, updatedPlaylist);
        } catch (err) {
            alert("Erro ao reordenar a playlist.");
        } finally {
            setIsSyncing(false);
        }
    };

    const toggleItemActive = async (id, currentIsActive) => {
        const newStatus = currentIsActive === false ? true : false;
        await updateItem(id, { isActive: newStatus });
    };

    const updateItem = async (id, updatedProps) => {
        if (!selectedScreen) return;
        
        const updatedPlaylist = playlist.map(item => 
            item.id === id ? { ...item, ...updatedProps } : item
        );
        
        // This is a quick background update, so no need for global isSyncing spinner
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
            <div className="md:hidden flex items-center justify-between p-4 bg-zinc-950/80 border-b border-white/5 backdrop-blur-xl shrink-0 z-40">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                        <LayoutDashboard className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-black text-lg">Totem Cloud</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-3 bg-white/5 rounded-xl text-orange-500 active:scale-95 border border-white/10"
                >
                    <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Sidebar Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
                    />
                )}
            </AnimatePresence>

            <ScreenList
                screens={screens}
                selectedScreen={selectedScreen}
                handleSelectScreen={handleSelectScreen}
                isScreenOnline={isScreenOnline}
                handleDeleteScreen={handleDeleteScreen}
                isAddingScreen={isAddingScreen}
                setIsAddingScreen={setIsAddingScreen}
                newScreenData={newScreenData}
                setNewScreenData={setNewScreenData}
                handleAddScreen={handleAddScreen}
                handleLogout={handleLogout}
                isMobileMenuOpen={isMobileMenuOpen}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative">
                {selectedScreen ? (
                    <div className="p-6 md:p-12 max-w-6xl 2xl:max-w-7xl mx-auto pb-32">
                        <AdminHeader
                            selectedScreen={selectedScreen}
                            isScreenOnline={isScreenOnline}
                            handleForceReload={handleForceReload}
                            handleToggleOrientation={handleToggleOrientation}
                            handleToggleSound={handleToggleSound}
                            handleVolumeChange={handleVolumeChange}
                            handleTogglePlayPause={handleTogglePlayPause}
                            isSyncing={isSyncing}
                        />

                        <AddItemForm
                            newItem={newItem}
                            setNewItem={setNewItem}
                            handleUrlChange={handleUrlChange}
                            handleFileUpload={handleFileUpload}
                            isUploading={isUploading}
                            uploadProgress={uploadProgress}
                            addItem={addItem}
                            isSyncing={isSyncing}
                        />

                        {/* Ticker Control */}
                        <div className="bg-white/5 border border-white/5 p-6 lg:p-8 rounded-3xl shadow-2xl mb-12 flex flex-col lg:flex-row gap-6 items-center">
                            <div className="flex-1 w-full">
                                <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Letreiro / Ticker (Rodapé)</label>
                                <input 
                                    type="text" 
                                    value={tickerText}
                                    onChange={(e) => setTickerText(e.target.value)}
                                    onBlur={() => handleTickerTextSave(tickerText)}
                                    placeholder="Digite recados. Use {{hora}} ou {{data}} para exibir tempo real..."
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 focus:border-orange-500 transition-all outline-none text-white font-medium text-sm"
                                />
                                <p className="text-[10px] text-zinc-500 mt-2 ml-1">Dica: Digite <strong className="text-orange-500">{"{{hora}}"}</strong> para mostrar a hora e <strong className="text-orange-500">{"{{data}}"}</strong> para a data atual.</p>
                            </div>
                            <div className="shrink-0 w-full lg:w-auto flex items-end">
                                <button
                                    onClick={handleTickerToggle}
                                    className={`w-full lg:w-auto mt-2 lg:mt-0 px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all text-xs border ${
                                        selectedScreen.ticker?.isActive 
                                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' 
                                            : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    {selectedScreen.ticker?.isActive ? '✅ Letreiro Ativo' : '❌ Letreiro Inativo'}
                                </button>
                            </div>
                        </div>

                        {/* Playlist Header */}
                        <div className="flex items-center justify-between mb-8 px-2">
                            <div className="flex items-center gap-4">
                                <h3 className="font-black text-2xl uppercase tracking-tighter text-zinc-300">Playlist Ativa ({playlist.length})</h3>
                            </div>
                            {playlist.length > 0 && (
                                <button onClick={handleClearPlaylist} className="text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest bg-red-500/5 px-4 py-2 rounded-xl border border-red-500/10">
                                    Limpar Tudo
                                </button>
                            )}
                        </div>

                        <PlaylistGrid
                            playlist={playlist}
                            deleteItem={deleteItem}
                            moveItem={moveItem}
                            toggleItemActive={toggleItemActive}
                            getYoutubeId={getYoutubeId}
                        />
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12">
                        <div className="w-24 h-24 bg-white/5 border border-white/5 rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
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
