import React, { useState, useEffect, useRef } from 'react';

const PlayerScreen = ({ playlist, orientation = 'landscape' }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const videoRef = useRef(null);

    // Keep track of the item to display. 
    // On TV, keeping the DOM simple is better. 
    // We will render the current item.
    const currentItem = playlist && playlist.length > 0 ? playlist[currentIndex] : null;

    const isPortrait = orientation === 'portrait';

    // Preload Logic for Offline Support (With Safety for Smart TVs)
    useEffect(() => {
        if (!playlist || playlist.length === 0 || !window.caches) return;

        const preloadMedia = async () => {
            try {
                const cache = await caches.open('media-cache');
                playlist.forEach(async (item) => {
                    const response = await cache.match(item.url);
                    if (!response) {
                        try {
                            const fetchResponse = await fetch(item.url);
                            if (fetchResponse.ok) {
                                cache.put(item.url, fetchResponse.clone());
                            }
                        } catch (e) { }
                    }
                });
            } catch (e) {
                console.warn("Cache API not supported on this device.");
            }
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

        // Anti-pulo duplo
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

    // Loading State
    if (!playlist || playlist.length === 0) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-black gap-4 text-white">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Sincronizando Totem...</p>
            </div>
        );
    }

    // SIMPLIFIED DEBUG LAYOUT
    return (
        <div className="w-screen h-screen bg-blue-900 flex flex-col items-center justify-center text-white overflow-hidden">
            <h1 className="text-4xl font-bold mb-4 bg-red-600 p-2">TV DEBUG MODE</h1>

            <div className="mb-4 text-center bg-black/50 p-4 rounded text-xl">
                <p>Status: OK</p>
                <p>Playlist Items: {playlist?.length || 0}</p>
                <p>Current Index: {currentIndex}</p>
                <p>Type: {currentItem?.type}</p>
            </div>

            <div className="w-[80%] h-[60%] border-4 border-yellow-400 bg-black relative flex items-center justify-center">
                {!currentItem ? (
                    <p>NO ITEM</p>
                ) : currentItem.type === 'video' ? (
                    <video
                        src={currentItem.url}
                        className="max-w-full max-h-full"
                        autoPlay
                        muted
                        playsInline
                        controls
                        onEnded={next}
                        onError={(e) => {
                            console.error("Video Error", e);
                            next();
                        }}
                    />
                ) : currentItem.type === 'youtube' ? (
                    <iframe
                        src={getYoutubeEmbedUrl(currentItem.url)}
                        className="w-full h-full"
                        allow="autoplay"
                    />
                ) : (
                    <img
                        src={currentItem.url}
                        alt="Item"
                        className="max-w-full max-h-full object-contain"
                        onError={() => next()}
                    />
                )}
            </div>

            <p className="mt-4 text-xs opacity-50 break-all max-w-[80%]">{currentItem?.url}</p>
        </div>
    );
};

export default PlayerScreen;
