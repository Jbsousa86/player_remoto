import React, { useState, useEffect, useMemo, useRef } from 'react';
import { syncService, DEFAULT_RSS_URL, DEFAULT_TICKER } from '../lib/syncService';
import { supabase } from '../lib/supabase'; // Certifique-se de que o caminho para o seu cliente Supabase está correto
import { LayoutDashboard, LogOut, RefreshCw, Monitor, Loader2, Smartphone, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminHeader from './AdminHeader';
import AddItemForm from './AddItemForm';
import PlaylistGrid from './PlaylistGrid';
import ScreenList from './ScreenList';

const AdminPanel = ({ isPairing = false }) => {
    const [screens, setScreens] = useState([]);
    const [selectedScreen, setSelectedScreen] = useState(null);
    const [playlist, setPlaylist] = useState([]);
    const [currentPlayingId, setCurrentPlayingId] = useState(null);
    const [newItem, setNewItem] = useState({ url: '', type: 'image', duration: 10, fitMode: 'cover', block: '' });
    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [tickerText, setTickerText] = useState('');
    const [globalRssUrl, setGlobalRssUrl] = useState(DEFAULT_RSS_URL);
    const [standbyLogo, setStandbyLogo] = useState('');
    const [standbyBg, setStandbyBg] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploadingStandby, setIsUploadingStandby] = useState({ logo: false, background: false });

    const [isAddingScreen, setIsAddingScreen] = useState(isPairing);
    const [newScreenData, setNewScreenData] = useState({ id: '', name: '' });
    const [localSchedules, setLocalSchedules] = useState({});
    const [scheduleSaveStatus, setScheduleSaveStatus] = useState({});
    const [hasAppliedGlobalDefaults, setHasAppliedGlobalDefaults] = useState(false);
    const scheduleTimeouts = useRef({});

    const uniqueBlocks = useMemo(() => {
        if (!playlist) return [];
        const blocks = playlist.map(item => item.block).filter(Boolean);
        return [...new Set(blocks)];
    }, [playlist]);

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
                setPlaylist(prev => JSON.stringify(prev) === JSON.stringify(data.playlist) ? prev : data.playlist);
            }
            if (data?.currentPlayingId !== undefined) {
                setCurrentPlayingId(data.currentPlayingId);
            } else {
                setCurrentPlayingId(null);
            }
            setIsSyncing(false);
        });
        return () => unsubscribe();
    }, [selectedScreen?.id]);

    // Mantém o estado local de agendamentos sincronizado e previne race conditions
    useEffect(() => {
        if (selectedScreen) {
            setLocalSchedules(selectedScreen.blockSchedules || {});
        }
    }, [selectedScreen?.blockSchedules, selectedScreen?.id]);

    useEffect(() => {
        if (!selectedScreen) {
            setTickerText('');
            setStandbyLogo('');
            setStandbyBg('');
            setGlobalRssUrl(DEFAULT_RSS_URL);
            return;
        }

        setTickerText(selectedScreen?.ticker?.text || DEFAULT_TICKER.text);
        setStandbyLogo(selectedScreen?.standbyOptions?.logo || '');
        setStandbyBg(selectedScreen?.standbyOptions?.background || '');
        const newsItem = selectedScreen?.playlist?.find(item => item.type === 'news');
        setGlobalRssUrl(newsItem?.url || DEFAULT_RSS_URL);
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
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|live\/)([^#\&\?]*).*/;
        const match = String(url).match(regExp);
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
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setIsUploading(true);
        setUploadProgress(10);

        try {
            const newUploadedUrls = [];
            let currentProgress = 10;
            const progressStep = 90 / files.length;

            for (const file of files) {
                const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
                const { data, error } = await supabase.storage
                    .from('medias')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (error) throw error;

                const { data: publicUrlData } = supabase.storage.from('medias').getPublicUrl(fileName);
                newUploadedUrls.push(publicUrlData.publicUrl);
                
                currentProgress += progressStep;
                setUploadProgress(Math.round(currentProgress));
            }

            setUploadProgress(100);

            if (newUploadedUrls.length === 1) {
                handleUrlChange(newUploadedUrls[0]);
            } else {
                if (!selectedScreen) {
                    alert("Mídias enviadas! Mas selecione um Totem para aplicá-las em lote.");
                    return;
                }
                setIsSyncing(true);
                const updatedPlaylist = [...playlist];
                
                newUploadedUrls.forEach((url, idx) => {
                    const isVideo = isVideoUrl(url);
                    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9) + idx;
                    updatedPlaylist.push({
                        url,
                        type: isVideo ? 'video' : 'image',
                        duration: isVideo ? 0 : (newItem.duration || 10),
                        fitMode: newItem.fitMode || 'cover',
                        block: newItem.block || 'Lote de Upload',
                        isActive: true,
                        id,
                        order: updatedPlaylist.length + 1
                    });
                });

                await syncService.updatePlaylist(selectedScreen.id, updatedPlaylist);
                alert(`${newUploadedUrls.length} mídias adicionadas em bloco com sucesso!`);
            }
        } catch (error) {
            console.error("Erro no upload:", error);
            alert("Erro ao enviar arquivo para o Supabase. Verifique se o bucket 'medias' é público e as políticas RLS.");
        } finally {
            setIsUploading(false);
            setTimeout(() => setUploadProgress(0), 1000);
            e.target.value = ''; // Limpa o input
        }
    };

    const handleStandbySave = async (field, value) => {
        if (!selectedScreen) return;
        setIsSyncing(true);
        const currentOptions = selectedScreen.standbyOptions || { logo: '', background: '' };
        try {
            await syncService.updateScreen(selectedScreen.id, { 
                standbyOptions: { ...currentOptions, [field]: value } 
            });
        } catch (err) {
            alert("Erro ao alterar as configurações de espera.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleStandbyImageUpload = async (e, field) => {
        const file = e.target.files?.[0];
        if (!file || !selectedScreen) return;

        setIsUploadingStandby(prev => ({ ...prev, [field]: true }));
        try {
            // Cria um nome de arquivo único para não sobrescrever
            const fileName = `standby_${field}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
            const { error } = await supabase.storage
                .from('medias')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: publicUrlData } = supabase.storage.from('medias').getPublicUrl(fileName);
            const newUrl = publicUrlData.publicUrl;
            
            if (field === 'logo') setStandbyLogo(newUrl);
            if (field === 'background') setStandbyBg(newUrl);
            
            await handleStandbySave(field, newUrl);
        } catch (error) {
            console.error(`Erro no upload de ${field}:`, error);
            alert(`Erro ao enviar a imagem de ${field}.`);
        } finally {
            setIsUploadingStandby(prev => ({ ...prev, [field]: false }));
            e.target.value = ''; // Limpa o input
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

    const handleToggleStop = async () => {
        if (!selectedScreen) return;
        setIsSyncing(true);
        const newIsStopped = !selectedScreen.isStopped;
        try {
            await syncService.updateScreen(selectedScreen.id, { isStopped: newIsStopped });
        } catch (err) {
            alert("Erro ao alterar estado de parada.");
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



    const applyRssToAllScreens = async () => {
        if (!globalRssUrl) {
            alert('Digite a URL do RSS padrão antes de aplicar.');
            return;
        }

        setIsSyncing(true);
        try {
            for (const screen of screens) {
                const playlistToUpdate = Array.isArray(screen.playlist) ? [...screen.playlist] : [];
                const newsIndex = playlistToUpdate.findIndex(item => item.type === 'news');

                if (newsIndex > -1) {
                    playlistToUpdate[newsIndex] = {
                        ...playlistToUpdate[newsIndex],
                        url: globalRssUrl,
                        isActive: true
                    };
                } else {
                    const id = `rss-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
                    playlistToUpdate.push({
                        id,
                        type: 'news',
                        url: globalRssUrl,
                        duration: 20,
                        fitMode: 'cover',
                        isActive: true,
                        order: playlistToUpdate.length + 1
                    });
                }

                await syncService.updatePlaylist(screen.id, playlistToUpdate);
            }
            alert('RSS padrão aplicado a todas as telas.');
        } catch (err) {
            console.error('Erro ao aplicar RSS global:', err);
            alert('Erro ao aplicar o RSS padrão para todas as telas.');
        } finally {
            setIsSyncing(false);
        }
    };

    const updateScreenWithDefaults = async (screen) => {
        const playlist = Array.isArray(screen.playlist) ? [...screen.playlist] : [];
        const hasNews = playlist.some(item => item?.type === 'news');
        const hasTickerText = screen.ticker && typeof screen.ticker.text === 'string' && screen.ticker.text.trim() !== '';

        const updatedScreen = {};

        if (!hasNews) {
            updatedScreen.playlist = [
                ...playlist,
                {
                    id: `rss-default-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
                    type: 'news',
                    url: DEFAULT_RSS_URL,
                    duration: 20,
                    fitMode: 'cover',
                    isActive: true,
                    order: playlist.length + 1
                }
            ];
        }

        if (!hasTickerText) {
            updatedScreen.ticker = DEFAULT_TICKER;
        }

        if (Object.keys(updatedScreen).length > 0) {
            await syncService.updateScreen(screen.id, updatedScreen);
        }
    };

    const applyDefaultsToExistingScreens = async () => {
        if (hasAppliedGlobalDefaults || screens.length === 0) return;

        setIsSyncing(true);
        try {
            for (const screen of screens) {
                await updateScreenWithDefaults(screen);
            }
            setHasAppliedGlobalDefaults(true);
        } catch (err) {
            console.error('Erro ao aplicar defaults globais:', err);
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (!loading && screens.length > 0 && !hasAppliedGlobalDefaults) {
            applyDefaultsToExistingScreens();
        }
    }, [loading, screens, hasAppliedGlobalDefaults]);

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

    const handleScheduleChange = (blockName, field, value) => {
        if (!selectedScreen) return;
        
        setLocalSchedules(prev => {
            const currentBlock = prev[blockName] || { startTime: '', endTime: '' };
            const newSchedules = {
                ...prev,
                [blockName]: { ...currentBlock, [field]: value }
            };
            
            syncService.updateScreen(selectedScreen.id, { blockSchedules: newSchedules }).then(() => {
                setScheduleSaveStatus(s => ({ ...s, [blockName]: 'Salvo!' }));
                if (scheduleTimeouts.current[blockName]) {
                    clearTimeout(scheduleTimeouts.current[blockName]);
                }
                scheduleTimeouts.current[blockName] = setTimeout(() => {
                    setScheduleSaveStatus(s => ({ ...s, [blockName]: null }));
                }, 3000);
            }).catch(() => alert("Erro ao salvar agendamento."));
            
            return newSchedules;
        });
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

    const handleClearCache = async () => {
        if (!selectedScreen) return;
        if (!window.confirm(`Deseja limpar o cache de mídias da tela "${selectedScreen.name}"? Isso apagará os vídeos e imagens baixados e forçará o Totem a recarregar tudo.`)) return;

        setIsSyncing(true);
        try {
            await syncService.updateScreen(selectedScreen.id, { 
                command: { type: 'CLEAR_CACHE', timestamp: Date.now() } 
            });
        } catch (err) {
            alert("Erro ao enviar comando de limpeza.");
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
                block: newItem.block || '',
                isActive: true,
                id, 
                order: playlist.length + 1 
            }
        ];

        try {
            await syncService.updatePlaylist(selectedScreen.id, updatedPlaylist);
            setNewItem(prev => ({ url: '', type: 'image', duration: 10, fitMode: 'cover', block: prev.block || '' }));
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

    const broadcastItem = async (e) => {
        e.preventDefault();
        if (!newItem.url || screens.length === 0) return;
        
        if (!window.confirm(`Deseja adicionar esta mídia na playlist de TODOS os ${screens.length} totens simultaneamente?`)) return;

        setIsSyncing(true);

        const youtubeId = getYoutubeId(newItem.url);
        const finalUrl = convertToDirectLink(newItem.url);
        let finalType = newItem.type;
        let finalDuration = newItem.duration;

        if (youtubeId) {
            finalType = 'youtube';
            if (newItem.type === 'image') finalDuration = 0;
        } else if (isVideoUrl(finalUrl)) {
            finalType = 'video';
            if (newItem.type === 'image') finalDuration = 0;
        }

        try {
            // Processa um totem por vez para garantir a leitura correta de cada playlist
            for (const screen of screens) {
                const currentPlaylist = await new Promise((resolve) => {
                    if (screen.id === selectedScreen?.id) {
                        resolve(playlist);
                    } else {
                        // Puxa rapidamente a playlist daquela tela específica e desinscreve
                        let unsubscribe;
                        unsubscribe = syncService.subscribeToScreen(screen.id, (data) => {
                            if (typeof unsubscribe === 'function') unsubscribe();
                            else setTimeout(() => unsubscribe && unsubscribe(), 50);
                            resolve(data?.playlist || []);
                        });
                    }
                });

                const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
                const updatedPlaylist = [...currentPlaylist, { ...newItem, url: finalUrl, type: finalType, duration: finalDuration, block: newItem.block || '', isActive: true, id, order: currentPlaylist.length + 1 }];

                await syncService.updatePlaylist(screen.id, updatedPlaylist);
            }

            setNewItem(prev => ({ url: '', type: 'image', duration: 10, fitMode: 'cover', block: prev.block || '' }));
            alert("Sucesso! A Live/Mídia foi adicionada em todos os totens.");
        } catch (err) {
            console.error("Erro ao transmitir para todos:", err);
            alert("Ocorreu um erro ao tentar enviar para todos os totens.");
        } finally {
            setIsSyncing(false);
        }
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
                            handleClearCache={handleClearCache}
                            handleToggleOrientation={handleToggleOrientation}
                            handleToggleSound={handleToggleSound}
                            handleVolumeChange={handleVolumeChange}
                            handleTogglePlayPause={handleTogglePlayPause}
                            handleToggleStop={handleToggleStop}
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
                            broadcastItem={broadcastItem}
                            isSyncing={isSyncing}
                        />

                        {/* Standby Customization Control */}
                        <div className="bg-white/5 border border-white/5 p-6 lg:p-8 rounded-3xl shadow-2xl mb-12 flex flex-col lg:flex-row gap-6 items-center">
                            <div className="flex-1 w-full space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-[0.2em]">URL da Logo (Tela de Espera)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={standbyLogo}
                                            onChange={(e) => setStandbyLogo(e.target.value)}
                                            onBlur={() => handleStandbySave('logo', standbyLogo)}
                                            placeholder="Cole a URL ou faça upload..."
                                            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 focus:border-orange-500 transition-all outline-none text-white font-medium text-sm"
                                        />
                                        <div className="shrink-0 flex">
                                            <input type="file" id="logo-upload" accept="image/*" className="hidden" onChange={(e) => handleStandbyImageUpload(e, 'logo')} disabled={isUploadingStandby.logo} />
                                            <label htmlFor="logo-upload" className={`cursor-pointer flex items-center justify-center px-4 py-4 rounded-2xl font-black uppercase tracking-widest transition-all text-[10px] border ${isUploadingStandby.logo ? 'bg-white/5 border-white/10 text-zinc-500' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white shadow-xl hover:scale-105 active:scale-95'}`}>
                                                {isUploadingStandby.logo ? <Loader2 className="w-4 h-4 animate-spin" /> : '📁 Upload'}
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-[0.2em]">URL do Background (Tela de Espera)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={standbyBg}
                                            onChange={(e) => setStandbyBg(e.target.value)}
                                            onBlur={() => handleStandbySave('background', standbyBg)}
                                            placeholder="Cole a URL ou faça upload..."
                                            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 focus:border-orange-500 transition-all outline-none text-white font-medium text-sm"
                                        />
                                        <div className="shrink-0 flex">
                                            <input type="file" id="bg-upload" accept="image/*" className="hidden" onChange={(e) => handleStandbyImageUpload(e, 'background')} disabled={isUploadingStandby.background} />
                                            <label htmlFor="bg-upload" className={`cursor-pointer flex items-center justify-center px-4 py-4 rounded-2xl font-black uppercase tracking-widest transition-all text-[10px] border ${isUploadingStandby.background ? 'bg-white/5 border-white/10 text-zinc-500' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white shadow-xl hover:scale-105 active:scale-95'}`}>
                                                {isUploadingStandby.background ? <Loader2 className="w-4 h-4 animate-spin" /> : '📁 Upload'}
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="shrink-0 w-full lg:w-48 flex items-center justify-center p-4 bg-black/40 rounded-2xl border border-white/10 h-full min-h-30">
                                {standbyLogo ? <img src={standbyLogo} alt="Logo" className="max-h-20 object-contain drop-shadow-lg" /> : <span className="text-4xl opacity-50 drop-shadow-lg">📺</span>}
                            </div>
                        </div>

                        {/* Ticker Control */}
                        <div className="bg-white/5 border border-white/5 p-6 lg:p-8 rounded-3xl shadow-2xl mb-12 flex flex-col lg:flex-row gap-6 items-center">
                            <div className="flex-1 w-full">
                                <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Letreiro / Ticker (Rodapé)</label>
                                <input 
                                    type="text" 
                                    value={tickerText}
                                    onChange={(e) => setTickerText(e.target.value)}
                                    onBlur={() => handleTickerTextSave(tickerText)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleTickerTextSave(tickerText); }}
                                    placeholder="Digite recados. Use {{hora}} ou {{data}} para exibir tempo real..."
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 focus:border-orange-500 transition-all outline-none text-white font-medium text-sm"
                                />
                                <p className="text-[10px] text-zinc-500 mt-2 ml-1">Dica: A Hora, Clima e Cotação do Dólar são adicionados automaticamente ao final do letreiro.</p>
                            </div>
                            <div className="shrink-0 w-full lg:w-auto flex flex-col gap-2 items-end">
                                <button
                                    onClick={() => handleTickerTextSave(tickerText)}
                                    disabled={isSyncing}
                                    className="w-full lg:w-auto mt-2 lg:mt-0 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-blue-600 text-white border border-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Salvar Letreiro
                                </button>
                                <button
                                    onClick={handleTickerToggle}
                                    className={`w-full lg:w-auto px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all text-xs border ${
                                        selectedScreen.ticker?.isActive 
                                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' 
                                            : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    {selectedScreen.ticker?.isActive ? '✅ Letreiro Ativo' : '❌ Letreiro Inativo'}
                                </button>
                            </div>
                        </div>

                        {/* Global RSS and Ticker Defaults */}
                        <div className="bg-white/5 border border-white/5 p-6 lg:p-8 rounded-3xl shadow-2xl mb-12">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">RSS Padrão para Todas as Telas</label>
                                        <input
                                            type="text"
                                            value={globalRssUrl}
                                            onChange={(e) => setGlobalRssUrl(e.target.value)}
                                            placeholder="Cole a URL do feed RSS padrão..."
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 focus:border-orange-500 transition-all outline-none text-white font-medium text-sm"
                                        />
                                        <p className="text-[10px] text-zinc-500 mt-2 ml-1">Esse RSS será aplicado como item de notícias em todas as telas.</p>
                                    </div>
                                    <button
                                        onClick={applyRssToAllScreens}
                                        disabled={isSyncing}
                                        className="w-full bg-pink-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Aplicar RSS para todas as telas
                                    </button>
                                </div>

                            </div>
                        </div>

                        {/* Block Scheduling Control */}
                        {uniqueBlocks.length > 0 && (
                            <div className="bg-white/5 border border-white/5 p-6 lg:p-8 rounded-3xl shadow-2xl mb-12">
                                <h3 className="text-[10px] font-black text-zinc-500 uppercase mb-6 tracking-[0.2em] flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Agendamento de Blocos
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {uniqueBlocks.map(block => {
                                        const schedule = localSchedules[block] || { startTime: '', endTime: '' };
                                        return (
                                            <div key={block} className="bg-black/40 border border-white/10 p-4 rounded-2xl relative">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="font-bold text-white text-sm truncate pr-2" title={block}>📁 {block}</h4>
                                                    <AnimatePresence>
                                                        {scheduleSaveStatus[block] && (
                                                            <motion.span 
                                                                key={`status-${block}`}
                                                                initial={{ opacity: 0, scale: 0.8 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                exit={{ opacity: 0, scale: 0.8 }}
                                                                className="text-[10px] font-black uppercase tracking-widest text-white bg-emerald-500 px-3 py-1 rounded-lg shadow-lg shadow-emerald-500/20 z-10 relative"
                                                            >
                                                                ✅ {scheduleSaveStatus[block]}
                                                            </motion.span>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1">
                                                        <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1">Início</label>
                                                        <input 
                                                            type="time" 
                                                            value={schedule.startTime}
                                                            onChange={(e) => handleScheduleChange(block, 'startTime', e.target.value)}
                                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:border-orange-500 transition-all outline-none text-white text-xs"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-[9px] font-black text-zinc-500 uppercase mb-1">Fim</label>
                                                        <input 
                                                            type="time" 
                                                            value={schedule.endTime}
                                                            onChange={(e) => handleScheduleChange(block, 'endTime', e.target.value)}
                                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:border-orange-500 transition-all outline-none text-white text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

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
                            currentPlayingId={isScreenOnline(selectedScreen?.lastSeen) ? currentPlayingId : null}
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
