import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PlayerScreen = ({ playlist, orientation = 'landscape' }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const videoRef = useRef(null);

    const currentItem = playlist[currentIndex];

    const isPortrait = orientation === 'portrait';

    // Preload Logic for Offline Support
    useEffect(() => {
        if (!playlist || playlist.length === 0) return;

        const preloadMedia = async () => {
            const cache = await caches.open('media-cache');
            playlist.forEach(async (item) => {
                const response = await cache.match(item.url);
                if (!response) {
                    try {
                        const fetchResponse = await fetch(item.url);
                        if (fetchResponse.ok) {
                            cache.put(item.url, fetchResponse.clone());
                            console.log(`Preloaded: ${item.url}`);
                        }
                    } catch (e) {
                        console.warn(`Failed to preload: ${item.url}`, e);
                    }
                }
            });
        };

        preloadMedia();
    }, [playlist]);
    // Unified YouTube ID Extractor
    const getYoutubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const getYoutubeEmbedUrl = (url) => {
        const videoId = getYoutubeId(url);
        if (!videoId) return '';
        // Link balanceado: autoplay, mudo, sem controles, mas com API ativada
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&rel=0&showinfo=0&iv_load_policy=3&enablejsapi=1&origin=${window.location.origin}`;
    };

    // 0. Load YouTube API once
    useEffect(() => {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
    }, []);

    // 1. Unified Advance Timer (Images & Safe Fallback for Videos)
    useEffect(() => {
        if (!currentItem) return;

        // IMAGES: 100% controlled by timer
        if (currentItem.type === 'image') {
            const timer = setTimeout(() => next(), (currentItem.duration || 10) * 1000);
            return () => clearTimeout(timer);
        }

        // VIDEOS/YOUTUBE: Safety timer
        // If duration is 0 (auto), use a safe maximum (e.g. 5 mins for safety) 
        // to prevent infinite stall if events fail.
        const limit = (currentItem.duration && currentItem.duration > 0)
            ? currentItem.duration * 1000
            : 300000; // 5 minutes safety for auto videos

        const safetyTimer = setTimeout(() => {
            console.log("Safety skip triggered");
            next();
        }, limit);

        return () => clearTimeout(safetyTimer);
    }, [currentIndex, currentItem]);

    // 2. YouTube API - Listening to the Iframe
    useEffect(() => {
        if (currentItem?.type === 'youtube') {
            let player;

            const initPlayer = () => {
                const iframe = document.getElementById(`yt-player-${currentIndex}`);
                if (iframe && window.YT && window.YT.Player) {
                    player = new window.YT.Player(iframe, {
                        events: {
                            'onStateChange': (event) => {
                                if (event.data === window.YT.PlayerState.ENDED) {
                                    next();
                                }
                            },
                            'onError': () => next()
                        }
                    });
                }
            };

            // Retry initialization if API is not ready yet
            const checkAPI = setInterval(() => {
                if (window.YT && window.YT.Player) {
                    clearInterval(checkAPI);
                    initPlayer();
                }
            }, 500);

            return () => {
                clearInterval(checkAPI);
                if (player && player.destroy) player.destroy();
            };
        }
    }, [currentIndex, currentItem]);

    const lastAdvancedIndex = useRef(-1);

    const next = () => {
        if (!playlist || playlist.length === 0) return;

        // Anti-pulo duplo: evita que onEnded e onTimeUpdate chamem o próximo 
        // para o MESMO item da playlist ao mesmo tempo.
        if (lastAdvancedIndex.current === currentIndex) return;
        lastAdvancedIndex.current = currentIndex;

        setCurrentIndex((prev) => (prev + 1) % playlist.length);
    };

    const [screenSize, setScreenSize] = useState({ w: window.innerWidth, h: window.innerHeight });

    useEffect(() => {
        const handleResize = () => setScreenSize({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Logic: If user wants Portrait but screen is Landscape, we need CSS Rotation
    const needsRotation = isPortrait && screenSize.w > screenSize.h;

    if (!playlist || playlist.length === 0) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-black gap-4 text-white">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Sincronizando Totem...</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
            <div
                style={{
                    width: needsRotation ? screenSize.h : '100vw',
                    height: needsRotation ? screenSize.w : '100vh',
                    transform: needsRotation ? 'rotate(90deg)' : 'none',
                    transformOrigin: 'center'
                }}
                className="relative bg-black overflow-hidden"
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${currentItem.id}-${currentIndex}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.2, ease: "easeInOut" }}
                        className="absolute inset-0 flex items-center justify-center bg-black"
                    >
                        {currentItem.type === 'video' ? (
                            <video
                                key={currentItem.id}
                                src={currentItem.url}
                                className={`w-full h-full ${currentItem.fitMode === 'contain' ? 'object-contain' : 'object-cover'}`}
                                autoPlay
                                muted
                                playsInline
                                onEnded={next}
                                onTimeUpdate={(e) => {
                                    // Fallback: se o vídeo chegar no final e o onEnded falhar
                                    const video = e.target;
                                    if (video.duration > 0 && video.duration - video.currentTime < 0.3) {
                                        next();
                                    }
                                }}
                                onError={(e) => {
                                    console.error("Video error", e);
                                    next();
                                }}
                                onLoadedData={(e) => {
                                    e.target.play().catch(() => { });
                                }}
                            />
                        ) : currentItem.type === 'youtube' ? (
                            <div className={`w-full h-full relative pointer-events-none origin-center ${currentItem.fitMode === 'contain' ? 'scale-100' : (isPortrait ? 'scale-[3.5]' : 'scale-[1.3]')}`}>
                                <iframe
                                    id={`yt-player-${currentIndex}`}
                                    src={getYoutubeEmbedUrl(currentItem.url)}
                                    className="absolute inset-0 w-full h-full border-none"
                                    allow="autoplay; encrypted-media"
                                    title="YouTube player"
                                />
                            </div>
                        ) : (
                            <img
                                key={currentItem.id}
                                src={currentItem.url}
                                alt=""
                                className={`w-full h-full ${currentItem.fitMode === 'contain' ? 'object-contain' : 'object-cover'}`}
                                onError={() => next()}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Dark gradient overlay for a premium look */}
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-10" />

                {/* Subtle sync indicator */}
                <div className="absolute top-6 right-6 z-20 flex items-center gap-2 opacity-20 hover:opacity-100 transition-opacity">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Live Sync</span>
                </div>
            </div>
        </div>
    );
};

export default PlayerScreen;
