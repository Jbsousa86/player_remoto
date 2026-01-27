import React, { useState, useEffect, useRef, useCallback } from 'react';

const PlayerScreen = ({ playlist, orientation = 'landscape' }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const advancedRef = useRef(false);

    useEffect(() => {
        advancedRef.current = false;
    }, [currentIndex]);

    const next = useCallback(() => {
        if (advancedRef.current || !playlist?.length) return;
        advancedRef.current = true;
        setCurrentIndex((prev) => (prev + 1) % playlist.length);
    }, [playlist]);

    const currentItem = playlist?.length ? playlist[currentIndex] : null;
    const isPortrait = orientation === 'portrait';

    /* =========================
       PRELOAD (IMAGENS APENAS)
    ========================== */
    useEffect(() => {
        if (!playlist || !window.caches) return;

        const preloadImages = async () => {
            try {
                const cache = await caches.open('media-cache');
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

    const getYoutubeEmbedUrl = (url) => {
        const id = getYoutubeId(url);
        if (!id) return '';
        return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&rel=0&enablejsapi=1`;
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
        if (!currentItem || currentItem.type !== 'youtube') return;

        const limit =
            currentItem.duration && currentItem.duration > 0
                ? currentItem.duration * 1000
                : 300000; // 5 min fallback

        const timer = setTimeout(() => {
            console.warn('YouTube safety skip');
            next();
        }, limit);

        return () => clearTimeout(timer);
    }, [currentItem, next]);

    /* =========================
       YOUTUBE PLAYER EVENTS
    ========================== */
    useEffect(() => {
        if (currentItem?.type !== 'youtube') return;

        let player;
        const iframeId = `yt-player`;

        const init = () => {
            if (!window.YT || !window.YT.Player) return;

            player = new window.YT.Player(iframeId, {
                events: {
                    onReady: (e) => e.target.playVideo(),
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
            if (player?.destroy) player.destroy();
        };
    }, [currentItem, next]);

    /* =========================
       IMAGE TIMER
    ========================== */
    useEffect(() => {
        if (currentItem?.type !== 'image') return;

        const img = new Image();
        img.src = currentItem.url;

        const fallback = 5000;
        const limit =
            currentItem.duration && currentItem.duration > 0
                ? currentItem.duration * 1000
                : fallback;

        let timer;
        img.onload = () => {
            timer = setTimeout(next, limit);
        };

        img.onerror = () => {
            console.warn('Erro ao carregar imagem, pulando');
            next();
        };

        return () => clearTimeout(timer);
    }, [currentItem, next]);

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
                <div className="absolute inset-0 w-full h-full overflow-hidden">
                    <div className="relative w-full h-full flex items-center justify-center">
                        {currentItem.type === 'video' && (
                            <video
                                src={currentItem.url}
                                autoPlay
                                muted
                                playsInline
                                onEnded={next}
                                
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

                        {currentItem.type === 'youtube' && (
                            <iframe
                                id="yt-player"
                                src={getYoutubeEmbedUrl(currentItem.url)}
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

                        {currentItem.type === 'image' && (
                            <img
                                src={currentItem.url}
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
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerScreen;
