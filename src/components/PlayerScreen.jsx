import React, { useState, useEffect, useRef, useCallback } from 'react';

const PlayerScreen = ({ playlist, orientation = 'landscape', isMuted = true, volume = 100, isPlaying = true, ticker = null }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const advancedRef = useRef(false);

    // Guardar a playlist em uma ref previne que a função 'next' seja recriada a cada 
    // vez que o Firebase receber um Heartbeat (lastSeen)
    const playlistRef = useRef(playlist);
    useEffect(() => {
        playlistRef.current = playlist;
    }, [playlist]);

    // Previne que o index fique fora dos limites caso a playlist seja reduzida
    useEffect(() => {
        if (playlist?.length && currentIndex >= playlist.length) {
            setCurrentIndex(0);
        }
    }, [playlist, currentIndex]);

    const next = useCallback(() => {
        if (advancedRef.current || !playlistRef.current?.length) return;
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

    const currentItem = playlist?.length ? playlist[currentIndex] : null;
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
        if (!playlist || !window.caches) return;

        const preloadImages = async () => {
            try {
                const cache = await caches.open('images-cache');
                for (const item of playlist) {
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
        const regExp = /^.*(youtu.be\/|v\/|embed\/|watch\?v=)([^#&?]*).*/;
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
        if (currentType !== 'youtube' || !isPlaying) return;

        // Forçar YouTube a tocar até o final, com limite de segurança longo (10 min)
        const limit = 600000;

        const timer = setTimeout(() => {
            console.warn('YouTube safety skip');
            next();
        }, limit);

        return () => clearTimeout(timer);
    }, [currentType, currentUrl, currentItem?.id, isPlaying, next]);

    /* =========================
       VIDEO SAFETY TIMER
    ========================== */
    useEffect(() => {
        if (currentType !== 'video' || !isPlaying) return;

        // Ignorar a duração vinda do banco para vídeos, deixando-os terminar naturalmente
        // Mantemos apenas um timer de 10 minutos para caso o vídeo congele/trave.
        const limit = 600000;

        const timer = setTimeout(() => {
            console.warn('Video duration limit or safety timeout reached, skipping');
            next();
        }, limit);

        return () => clearTimeout(timer);
    }, [currentType, currentUrl, currentItem?.id, isPlaying, next]);

    /* =========================
       YOUTUBE PLAYER EVENTS
    ========================== */
    useEffect(() => {
        if (currentType !== 'youtube') return;

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
                    onError: next
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
    }, [currentType, currentUrl, currentItem?.id, next]);

    /* =========================
       PLAY/PAUSE & MUTE EFFECTS (DYNAMIC)
    ========================== */
    useEffect(() => {
        if (currentType === 'video' && videoRef.current) {
            if (isPlaying) videoRef.current.play().catch(e => console.warn(e));
            else videoRef.current.pause();
        } else if (currentType === 'youtube' && ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
            if (isPlaying) ytPlayerRef.current.playVideo();
            else ytPlayerRef.current.pauseVideo();
        }
        }, [isPlaying, currentType, currentUrl, currentItem?.id]);

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
        if (currentType !== 'image' || !isPlaying) return;

        const img = new Image();

        const fallback = 5000;
        const limit =
            currentDuration && currentDuration > 0
                ? currentDuration * 1000
                : fallback;

        let timer;
        img.onload = () => {
            timer = setTimeout(next, limit);
        };

        img.onerror = () => {
            console.warn('Erro ao carregar imagem, pulando');
            next();
        };

        img.src = currentUrl;

        return () => clearTimeout(timer);
    }, [currentType, currentUrl, currentDuration, currentItem?.id, isPlaying, next]);

    /* =========================
       WEB PAGE TIMER
    ========================== */
    useEffect(() => {
        if (currentType !== 'web' || !isPlaying) return;

        const limit =
            currentDuration && currentDuration > 0
                ? currentDuration * 1000
                : 10000;

        const timer = setTimeout(next, limit);

        return () => clearTimeout(timer);
    }, [currentType, currentDuration, currentItem?.id, isPlaying, next]);

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
       LOADING
    ========================== */
    if (!playlist?.length) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-black text-white">
                Sincronizando Totem…
            </div>
        );
    }

    /* =========================
       RENDER
    ========================== */
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
                                    next();
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

                {ticker?.isActive && ticker?.text && (
                    <div className="absolute bottom-0 left-0 w-full h-10 md:h-14 bg-black/40 backdrop-blur-md flex items-center overflow-hidden border-t border-white/10 z-50">
                        <style>{`
                            @keyframes marquee-scroll {
                                0% { transform: translateX(0%); }
                                100% { transform: translateX(-100%); }
                            }
                        `}</style>
                        <div className="whitespace-nowrap font-semibold text-lg md:text-2xl text-white/90 uppercase tracking-widest pl-[100vw]" style={{ animation: 'marquee-scroll 25s linear infinite' }}>
                            {ticker.text}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerScreen;
