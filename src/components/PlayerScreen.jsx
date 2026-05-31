import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const DynamicTicker = ({ ticker }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        if (!ticker?.isActive) return;
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, [ticker?.isActive]);

    if (!ticker?.isActive || !ticker?.text) return null;

    const timeStr = currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = currentTime.toLocaleDateString('pt-BR');
    const displayText = ticker.text.replace(/{{hora}}/gi, timeStr).replace(/{{data}}/gi, dateStr);

    return (
        <div className="absolute bottom-0 left-0 w-full h-10 md:h-14 bg-black/40 backdrop-blur-md flex items-center overflow-hidden border-t border-white/10 z-50">
            <style>{`
                @keyframes marquee-scroll {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-100%); }
                }
            `}</style>
            <div className="whitespace-nowrap font-semibold text-lg md:text-2xl text-white/90 uppercase tracking-widest pl-[100vw]" style={{ animation: 'marquee-scroll 25s linear infinite' }}>
                {displayText}
            </div>
        </div>
    );
};

const PlayerScreen = ({ playlist, orientation = 'landscape', isMuted = true, volume = 100, isPlaying = true, isStopped = false, ticker = null }) => {
    // 1. FILTRO DE ATIVOS: Evita que o player tente ler mídias inativadas no painel
    const activePlaylist = useMemo(() => {
        return playlist?.filter(item => item.isActive !== false) || [];
    }, [playlist]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const advancedRef = useRef(false);

    // Guardar a playlist em uma ref previne que a função 'next' seja recriada a cada 
    // vez que o Firebase receber um Heartbeat (lastSeen)
    const playlistRef = useRef(activePlaylist);
    useEffect(() => {
        playlistRef.current = activePlaylist;
    }, [activePlaylist]);

    // Previne que o index fique fora dos limites caso a playlist seja reduzida
    useEffect(() => {
        if (activePlaylist?.length && currentIndex >= activePlaylist.length) {
            setCurrentIndex(0);
        }
    }, [activePlaylist, currentIndex]);

    const next = useCallback((force = false) => {
        // 2. CORREÇÃO DE RACE CONDITION: force permite pular o debounce de 150ms em erros críticos de mídia
        if ((advancedRef.current && force !== true) || !playlistRef.current?.length) return;
        advancedRef.current = true;
        
        if (playlistRef.current.length === 1) {
            const item = playlistRef.current[0];
            if (item.type === 'video' && videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(e => console.warn(e));
            } else if (item.type === 'youtube' && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
                ytPlayerRef.current.seekTo(0);
                ytPlayerRef.current.playVideo();
            }
        } else {
            setCurrentIndex((prev) => (prev + 1) % playlistRef.current.length);
        }

        setTimeout(() => {
            advancedRef.current = false;
        }, 150);
    }, []);

    const currentItem = activePlaylist?.length ? activePlaylist[currentIndex] : null;
    const currentType = currentItem?.type;
    const currentUrl = currentItem?.url;
    const currentDuration = currentItem?.duration;
    const isPortrait = orientation === 'portrait';
    const videoRef = useRef(null);
    const ytPlayerRef = useRef(null);

    /* =========================
       PRELOAD (IMAGENS APENAS)
    ========================== */
    useEffect(() => {
        if (!activePlaylist || !window.caches) return;

        const preloadImages = async () => {
            try {
                const cache = await caches.open('images-cache');
                for (const item of activePlaylist) {
                    if (item.type !== 'image') continue;

                    const cached = await cache.match(item.url);
                    if (!cached) {
                        try {
                            const res = await fetch(item.url, { mode: 'no-cors' });
                            if (res) await cache.put(item.url, res.clone());
                        } catch {}
                    }
                }
            } catch {
                console.warn('Cache API não suportado');
            }
        };

        preloadImages();
    }, [playlist]);

    /* =========================
       YOUTUBE HELPERS
    ========================== */
    const getYoutubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|embed\/|watch\?v=|live\/)([^#&?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? match[2] : null;
    };

    const getYoutubeEmbedUrl = (url, muted) => {
        const id = getYoutubeId(url);
        if (!id) return '';
        return `https://www.youtube.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&rel=0&enablejsapi=1`;
    };

    /* =========================
       LOAD YOUTUBE API ONCE
    ========================== */
    useEffect(() => {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.body.appendChild(tag);
        }
    }, []);

    /* =========================
       SAFETY TIMER (YOUTUBE ONLY)
    ========================== */
    useEffect(() => {
        if (currentType !== 'youtube' || !isPlaying || isStopped) return;

        // Se for live ou vídeo com duração definida, respeita. Senão, limite longo (10 min).
        const limit = currentDuration && currentDuration > 0 ? currentDuration * 1000 : 600000;

        const timer = setTimeout(() => {
            console.warn('YouTube timeout skip');
            next(true);
        }, limit);

        return () => clearTimeout(timer);
    }, [currentType, currentUrl, currentDuration, currentItem?.id, isPlaying, isStopped, next]);

    /* =========================
       VIDEO SAFETY TIMER
    ========================== */
    useEffect(() => {
        if (currentType !== 'video' || !isPlaying || isStopped) return;

        // Se o usuário estipular tempo, ele corta o vídeo na hora definida. Senão, 10 minutos de segurança.
        const limit = currentDuration && currentDuration > 0 ? currentDuration * 1000 : 600000;

        const timer = setTimeout(() => {
            console.warn('Video timeout skip');
            next(true);
        }, limit);

        return () => clearTimeout(timer);
    }, [currentType, currentUrl, currentDuration, currentItem?.id, isPlaying, isStopped, next]);

    /* =========================
       YOUTUBE PLAYER EVENTS
    ========================== */
    useEffect(() => {
        if (currentType !== 'youtube' || isStopped) return;

        const iframeId = `yt-player-${currentItem?.id}`;

        const init = () => {
            if (!window.YT || !window.YT.Player) return;

            ytPlayerRef.current = new window.YT.Player(iframeId, {
                events: {
                    onReady: (e) => {
                        if (isMuted) e.target.mute();
                        else e.target.unMute();
                        e.target.setVolume(volume);
                        if (isPlaying) e.target.playVideo();
                    },
                    onStateChange: (e) => {
                        if (e.data === window.YT.PlayerState.ENDED) next();
                    },
                    onError: () => next(true)
                }
            });
        };

        const interval = setInterval(() => {
            if (window.YT?.Player) {
                clearInterval(interval);
                init();
            }
        }, 300);

        return () => {
            clearInterval(interval);
            if (ytPlayerRef.current?.destroy) ytPlayerRef.current.destroy();
            ytPlayerRef.current = null;
        };
    }, [currentType, currentUrl, currentItem?.id, isStopped, next]);

    /* =========================
       PLAY/PAUSE & MUTE EFFECTS (DYNAMIC)
    ========================== */
    useEffect(() => {
        if (currentType === 'video' && videoRef.current) {
            // 3. CAPTURA DE BLOQUEIO DE AUTOPLAY: Pula logo ao invés de congelar caso a TV bloqueie o vídeo
            if (isPlaying && !isStopped) {
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.warn('Erro ao tocar vídeo ou bloqueio de autoplay:', e);
                        next(true);
                    });
                }
            } else {
                videoRef.current.pause();
            }
        } else if (currentType === 'youtube' && ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
            if (isPlaying && !isStopped) ytPlayerRef.current.playVideo();
            else ytPlayerRef.current.pauseVideo();
        }
        }, [isPlaying, isStopped, currentType, currentUrl, currentItem?.id, next]);

    useEffect(() => {
        if (currentType === 'youtube' && ytPlayerRef.current && typeof ytPlayerRef.current.mute === 'function') {
            if (isMuted) ytPlayerRef.current.mute();
            else ytPlayerRef.current.unMute();
        }
    }, [isMuted, currentType, currentUrl, currentItem?.id]);

    useEffect(() => {
        if (currentType === 'video' && videoRef.current) {
            // HTML5 Video aceita volume de 0.0 a 1.0
            videoRef.current.volume = volume / 100;
        } else if (currentType === 'youtube' && ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
            // YouTube API aceita volume de 0 a 100
            ytPlayerRef.current.setVolume(volume);
        }
    }, [volume, currentType, currentUrl, currentItem?.id]);

    /* =========================
       IMAGE TIMER
    ========================== */
    useEffect(() => {
        if (currentType !== 'image' || !isPlaying || isStopped) return;

        // 4. DURAÇÃO ILIMITADA (0): Respeita o zero como sendo pausa completa da passagem
        if (currentDuration === 0) return;

        const limit =
            currentDuration && currentDuration > 0
                ? currentDuration * 1000
                : 10000;

        const timer = setTimeout(next, limit);

        return () => clearTimeout(timer);
    }, [currentType, currentDuration, currentItem?.id, isPlaying, isStopped, next]);

    /* =========================
       WEB PAGE TIMER
    ========================== */
    useEffect(() => {
        if (currentType !== 'web' || !isPlaying || isStopped) return;

        if (currentDuration === 0) return;

        const limit =
            currentDuration && currentDuration > 0
                ? currentDuration * 1000
                : 10000;

        const timer = setTimeout(next, limit);

        return () => clearTimeout(timer);
    }, [currentType, currentDuration, currentItem?.id, isPlaying, isStopped, next]);

    /* =========================
       ROTATION LOGIC
    ========================== */
    const [screenSize, setScreenSize] = useState({
        w: window.innerWidth,
        h: window.innerHeight
    });

    useEffect(() => {
        const resize = () =>
            setScreenSize({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    const needsRotation = isPortrait && screenSize.w > screenSize.h;

    /* =========================
       RENDER
    ========================== */
    const standbyImage = "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop";

    return (
        <div className="absolute inset-0 bg-black overflow-hidden">
            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: needsRotation ? `${screenSize.h}px` : '100%',
                    height: needsRotation ? `${screenSize.w}px` : '100%',
                    transform: `translate(-50%, -50%) ${
                        needsRotation ? 'rotate(90deg)' : ''
                    }`,
                    backgroundColor: '#000'
                }}
            >
                {(isStopped || !activePlaylist?.length) ? (
                    <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-white bg-black">
                        <img src={standbyImage} alt="Standby" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                        <div className="z-10 flex flex-col items-center text-center px-4">
                            <span className="text-6xl mb-4">📺</span>
                            <h1 className="text-3xl font-black uppercase tracking-widest">Totem em Espera</h1>
                            <p className="text-zinc-400 mt-2 text-sm uppercase tracking-widest">
                                {!activePlaylist?.length ? 'Aguardando novas mídias na playlist...' : 'Exibição interrompida pelo administrador.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none">
                        <div className="relative w-full h-full flex items-center justify-center">
                            {currentType === 'video' && (
                            <video
                                key={currentItem.id}
                                ref={videoRef}
                                src={currentUrl}
                                autoPlay
                                muted={isMuted}
                                playsInline
                                disablePictureInPicture
                                className="pointer-events-none"
                                preload="auto"
                                onEnded={next}
                                onError={(e) => {
                                    console.error('Video playback error, skipping:', e);
                                next(true);
                                }}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit:
                                        currentItem.fitMode === 'cover'
                                            ? 'cover'
                                            : 'contain'
                                }}
                            />
                        )}

                            {currentType === 'youtube' && (
                            <iframe
                                key={currentItem.id}
                                id={`yt-player-${currentItem.id}`}
                                src={getYoutubeEmbedUrl(currentUrl, isMuted)}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    border: 'none'
                                }}
                                allow="autoplay; encrypted-media"
                                title="YouTube Player"
                            />
                        )}

                            {currentType === 'image' && (
                            <img
                                key={currentItem.id}
                                src={currentUrl}
                                alt=""
                                onError={() => {
                                    console.warn('Erro ao exibir imagem, pulando');
                                next(true);
                                }}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit:
                                        currentItem.fitMode === 'cover'
                                            ? 'cover'
                                            : 'contain'
                                }}
                            />
                        )}

                            {currentType === 'web' && (
                            <iframe
                                key={currentItem.id}
                                src={currentUrl}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    border: 'none'
                                }}
                            />
                        )}
                        </div>
                    </div>
                )}

                <DynamicTicker ticker={ticker} />
            </div>
        </div>
    );
};

export default PlayerScreen;
