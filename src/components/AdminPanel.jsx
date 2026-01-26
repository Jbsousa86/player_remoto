import React, { useState, useEffect } from 'react';
import { syncService } from '../lib/syncService';
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
        } catch (err) => {
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
            <div className="md:hidden flex items-center justify-between p-4 bg-black/80 border-b border-zinc-800 backdrop-blur-xl shrink-0 z-60">
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
                        className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-70"
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
                            isSyncing={isSyncing}
                        />

                        <AddItemForm
                            newItem={newItem}
                            setNewItem={setNewItem}
                            addItem={addItem}
                            isSyncing={isSyncing}
                        />

                        {/* Playlist Header */}
                        <div className="flex items-center justify-between mb-8 px-2">
                            <h3 className="font-black text-2xl uppercase tracking-tighter text-zinc-300">Playlist Ativa ({playlist.length})</h3>
                            {playlist.length > 0 && (
                                <button onClick={handleClearPlaylist} className="text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest bg-red-500/5 px-4 py-2 rounded-xl border border-red-500/10">
                                    Limpar Tudo
                                </button>
                            )}
                        </div>

                        <PlaylistGrid
                            playlist={playlist}
                            deleteItem={deleteItem}
                            getYoutubeId={getYoutubeId}
                        />
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
