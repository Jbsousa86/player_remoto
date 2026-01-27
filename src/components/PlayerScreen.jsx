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
                                            'onReady': (event) => {
                                                // Ensure playback starts
                                                event.target.playVideo();
                                            },
                                            'onStateChange': (event) => {
                                                if (event.data === window.YT.PlayerState.ENDED) {
                                                    next();
                                                }
                                            },
                                            'onError': () => next()
                                        }
                                    });                }
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

    // PRODUCTION RENDER (Restored for Firestick)
    return (
        <div className="absolute inset-0 bg-black overflow-hidden m-0 p-0 select-none">
            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: needsRotation ? `${screenSize.h}px` : '100%',
                    height: needsRotation ? `${screenSize.w}px` : '100%',
                    transform: `translate(-50%, -50%) ${needsRotation ? 'rotate(90deg)' : ''}`,
                    backgroundColor: '#000'
                }}
            >
                <div key={`${currentItem.id}-${currentIndex}`} className="absolute inset-0 w-full h-full overflow-hidden animate-fade-in">

                    {/* Smart Fill Background (Professional Blur) */}
                    {currentItem?.fitMode === 'smart' && (
                        <div
                            className="absolute inset-0 scale-110"
                            style={{
                                backgroundImage: `url(${currentItem.url})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                opacity: 0.3,
                                filter: 'blur(20px)'
                            }}
                        />
                    )}

                    <div className="relative w-full h-full flex items-center justify-center z-10">
                        {currentItem.type === 'video' ? (
                            <video
                                src={currentItem.url}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: (currentItem?.fitMode === 'cover' ? 'cover' : 'contain')
                                }}
                                className="block"
                                autoPlay
                                muted
                                playsInline
                                onEnded={next}
                                onTimeUpdate={(e) => {
                                    const video = e.target;
                                    if (video.duration > 0 && video.duration - video.currentTime < 0.5) {
                                        // Optional pre-fetch logic could go here
                                    }
                                }}
                                onError={(e) => {
                                    console.error("Video Error", e);
                                    next();
                                }}
                            />
                        ) : currentItem.type === 'youtube' ? (
                            <div className={`w-full h-full pointer-events-none origin-center ${currentItem?.fitMode === 'contain' || currentItem?.fitMode === 'smart' ? 'scale-100' : (isPortrait ? 'scale-[3.5]' : 'scale-[1.3]')}`}>
                                <iframe
                                    id={`yt-player-${currentIndex}`}
                                    src={getYoutubeEmbedUrl(currentItem.url)}
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                    allow="autoplay; encrypted-media"
                                    title="YouTube player"
                                />
                            </div>
                        ) : (
                            <img
                                src={currentItem.url}
                                alt=""
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: (currentItem?.fitMode === 'cover' ? 'cover' : 'contain')
                                }}
                                className="block"
                                onError={() => next()}
                            />
                        )}
                    </div>
                </div>

                {/* Professional HUD Overlay (Status) */}
                <div className="absolute top-8 right-8 z-50 flex items-center gap-3 px-4 py-2 bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] leading-none mb-1">Status</span>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                            <span className="text-[9px] font-bold text-white uppercase tracking-widest">Online</span>
                        </div>
                    </div>
                </div>

                {/* DEBUG */}
                <div className="absolute bottom-4 left-4 z-50 p-3 bg-red-600 text-white font-mono text-xs rounded-lg">
                    DEBUG: fitMode is "{currentItem?.fitMode || 'undefined'}"
                </div>
            </div>
        </div>
    );
};

export default PlayerScreen;
