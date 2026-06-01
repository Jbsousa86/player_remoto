import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';

const DynamicTicker = ({ ticker }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        if (!ticker?.isActive) return;
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, [ticker?.isActive]);

    if (!ticker?.isActive || !ticker?.text) return null;

    const timeStr = currentTime.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    const dateStr = currentTime.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
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

const NewsDisplay = ({ url, onError }) => {
    const [news, setNews] = useState(null);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`)
            .then(res => res.json())
            .then(data => {
                if (!isMounted) return;
                if (data?.status === 'ok' && data.items?.length > 0) {
                    // Sorteia aleatoriamente uma das 5 últimas notícias recentes
                    const item = data.items[Math.floor(Math.random() * Math.min(5, data.items.length))];
                    setNews(item);
                } else {
                    console.warn('RSS Feed sem itens', data);
                    setHasError(true);
                    setTimeout(() => isMounted && onError?.(), 4000);
                }
            })
            .catch(err => {
                if (!isMounted) return;
                console.error('Erro ao buscar RSS:', err);
                setHasError(true);
                setTimeout(() => isMounted && onError?.(), 4000);
            });
            
        return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);

    if (hasError) return (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-zinc-900 text-white">
            <div className="flex flex-col items-center opacity-70 animate-fade">
                <span className="text-5xl mb-4">⚠️</span>
                <span className="text-sm font-bold tracking-widest uppercase text-red-400">Feed RSS Inválido</span>
                <span className="text-[10px] mt-2 text-zinc-500 max-w-xs text-center">O link inserido não é um feed de notícias reconhecido.<br/>Verifique se é um link válido (ex: .xml ou /rss).</span>
            </div>
        </div>
    );

    if (!news) return (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-zinc-900 text-white">
            <div className="animate-pulse flex flex-col items-center">
                <span className="text-4xl mb-4">📰</span>
                <span className="text-sm font-bold tracking-widest uppercase text-zinc-500">Buscando Notícias...</span>
            </div>
        </div>
    );

    const image = news.enclosure?.link || news.thumbnail;
    const newsUrl = news.link || news.guid;

    return (
        <div className="absolute inset-0 w-full h-full flex flex-col justify-end bg-black animate-fade">
            {image && <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />}
            <div className="absolute inset-0 bg-linear-to-t from-black via-black/90 to-transparent" />
            <div className="relative z-10 p-8 md:p-16 w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-end justify-between gap-8">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="bg-pink-600 text-white font-black px-4 py-2 rounded-xl uppercase tracking-widest text-xs md:text-sm shadow-lg shadow-pink-500/50">📰 Notícias</span>
                        <span className="text-white/50 font-bold text-xs uppercase tracking-widest">{news.author || 'Última Hora'}</span>
                    </div>
                    <h1 className="text-white font-black text-3xl md:text-6xl leading-tight drop-shadow-2xl mb-4">{news.title}</h1>
                    {news.description && <p className="text-zinc-300 font-medium text-lg md:text-2xl line-clamp-3 leading-relaxed max-w-4xl" dangerouslySetInnerHTML={{ __html: news.description.replace(/<[^>]+>/g, '') }} />}
                </div>

                {newsUrl && (
                    <div className="flex flex-col items-center bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/20 shadow-2xl shrink-0 animate-fade">
                        <div className="bg-white p-3 rounded-2xl mb-3 shadow-inner">
                            <QRCodeSVG value={newsUrl} size={120} level="Q" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white text-center leading-tight">
                            Leia a matéria<br/>no celular
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

const StandbyWeather = () => {
    const [weather, setWeather] = useState(null);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                // 1. Obter localização aproximada por IP
                const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
                const { latitude, longitude, city } = await geoRes.json();

                // 2. Obter clima (Open-Meteo é gratuito e sem API Key)
                const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
                const weatherData = await weatherRes.json();

                setWeather({
                    temp: Math.round(weatherData.current_weather.temperature),
                    city: city || 'Local',
                    code: weatherData.current_weather.weathercode
                });
            } catch (error) {
                console.error("Erro ao buscar clima:", error);
            }
        };

        fetchWeather();
        const interval = setInterval(fetchWeather, 30 * 60 * 1000); // Atualiza a cada 30 minutos
        return () => clearInterval(interval);
    }, []);

    const getWeatherEmoji = (code) => {
        if (code === 0) return '☀️'; // Limpo
        if (code === 1 || code === 2 || code === 3) return '⛅'; // Parcialmente nublado
        if (code >= 45 && code <= 48) return '🌫️'; // Névoa
        if (code >= 51 && code <= 67) return '🌧️'; // Chuva leve/Garoa
        if (code >= 71 && code <= 77) return '❄️'; // Neve
        if (code >= 80 && code <= 82) return '🌧️'; // Pancadas de chuva
        if (code >= 95 && code <= 99) return '⛈️'; // Tempestade
        return '☁️';
    };

    if (!weather) return (
        <div className="flex flex-col items-center justify-center pl-8 md:pl-12 ml-8 md:ml-12 border-l border-white/10 opacity-30 animate-pulse min-w-25">
            <span className="text-4xl md:text-5xl drop-shadow-lg">☁️</span>
            <span className="text-2xl md:text-3xl font-black mt-2">--°C</span>
        </div>
    );

    return (
        <div className="flex flex-col items-center justify-center pl-8 md:pl-12 ml-8 md:ml-12 border-l border-white/10 min-w-25">
            <span className="text-4xl md:text-5xl drop-shadow-lg">{getWeatherEmoji(weather.code)}</span>
            <span className="text-2xl md:text-3xl font-black mt-2">{weather.temp}°C</span>
            <span className="text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1 max-w-25 truncate text-center" title={weather.city}>
                {weather.city}
            </span>
        </div>
    );
};

const StandbyClock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="mt-12 flex flex-row items-center justify-center bg-white/5 px-10 md:px-16 py-8 rounded-[3rem] backdrop-blur-xl border border-white/10 shadow-2xl">
            <div className="flex flex-col items-center">
                <span className="text-6xl md:text-8xl font-black tracking-tighter tabular-nums text-white drop-shadow-lg">
                    {time.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[10px] md:text-sm font-bold text-orange-500 uppercase tracking-[0.3em] mt-4 text-center">
                    {time.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
            </div>
            
            <StandbyWeather />
        </div>
    );
};

const PlayerScreen = ({ playlist, standbyOptions = {}, blockSchedules = {}, orientation = 'landscape', isMuted = true, volume = 100, isPlaying = true, isStopped = false, ticker = null }) => {
    // 1. FILTRO DE ATIVOS: Evita que o player tente ler mídias inativadas no painel
    const [activePlaylist, setActivePlaylist] = useState([]);

    useEffect(() => {
        const updatePlayableItems = () => {
            const now = new Date();
            
            // Abordagem matemática 100% à prova de falhas via UTC puro.
            // Ignora completamente os bugs de "Invalid Date" em TVs antigas.
            // O fuso de São Paulo é fixamente UTC-3.
            let spHour = now.getUTCHours() - 3;
            if (spHour < 0) spHour += 24;
            const spMinute = now.getUTCMinutes();
            
            const currentHour = spHour < 10 ? '0' + spHour : spHour.toString();
            const currentMinute = spMinute < 10 ? '0' + spMinute : spMinute.toString();
            const currentTimeStr = `${currentHour}:${currentMinute}`;

            const playable = playlist?.filter(item => {
                if (item.isActive === false) return false;
                if (item.block && blockSchedules[item.block]) {
                    const { startTime, endTime } = blockSchedules[item.block];
                    if (startTime && endTime) {
                        if (startTime <= endTime) {
                            if (currentTimeStr < startTime || currentTimeStr >= endTime) return false;
                        } else {
                            // Lógica de agendamento atravessando a madrugada (ex: 22:00 até 06:00)
                            if (currentTimeStr < startTime && currentTimeStr >= endTime) return false;
                        }
                    }
                }
                return true;
            }) || [];
            setActivePlaylist(playable);
        };

        updatePlayableItems();
        const interval = setInterval(updatePlayableItems, 10000); // Reavaliar e atualizar a cada 10 segundos
        return () => clearInterval(interval);
    }, [playlist, blockSchedules]);

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
       WEB PAGE & NEWS TIMER
    ========================== */
    useEffect(() => {
        if ((currentType !== 'web' && currentType !== 'news') || !isPlaying || isStopped) return;

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
    const standbyImage = standbyOptions?.background || "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop";

    // O link agora é puxado direto das configurações do painel Admin!
    const companyLogo = standbyOptions?.logo || "";

    return (
        <div className="absolute inset-0 bg-black overflow-hidden">
            <style>{`
                @keyframes fade-in {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                .animate-fade {
                    animation: fade-in 0.8s ease-in-out;
                }
            `}</style>
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
                <AnimatePresence mode="wait">
                    {(isStopped || !activePlaylist?.length) ? (
                        <motion.div 
                            key="standby"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1 }}
                            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-white bg-zinc-950"
                        >
                            <img src={standbyImage} alt="Standby" className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale" />
                            <div className="absolute inset-0 bg-linear-to-b from-black/30 via-black/80 to-black z-0" />
                            <div className="z-10 flex flex-col items-center text-center px-4 w-full max-w-4xl">
                                {companyLogo ? (
                                    <img src={companyLogo} alt="Logo da Empresa" className="h-28 md:h-40 mb-8 object-contain drop-shadow-2xl" />
                                ) : (
                                    <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-8 backdrop-blur-md border border-white/10 shadow-2xl">
                                        <span className="text-5xl drop-shadow-lg">📺</span>
                                    </div>
                                )}
                                
                                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest mb-4 drop-shadow-xl">Totem em Espera</h1>
                                <p className="text-zinc-400 text-sm md:text-base font-bold uppercase tracking-[0.2em] max-w-lg mb-4">
                                    {!activePlaylist?.length ? 'Aguardando novas mídias na playlist...' : 'Exibição interrompida pelo administrador.'}
                                </p>

                                <StandbyClock />
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="player"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1 }}
                            className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none bg-black"
                        >
                            <div className="relative w-full h-full flex items-center justify-center">
                                <AnimatePresence>
                                    {currentItem && (
                                        <motion.div
                                            key={currentItem.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 1, ease: "easeInOut" }}
                                            className="absolute inset-0 w-full h-full flex items-center justify-center bg-black"
                                        >
                                            {currentItem.type === 'video' && (
                                                <video
                                                    ref={videoRef}
                                                    src={currentItem.url}
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
                                                        objectFit: currentItem.fitMode === 'cover' ? 'cover' : 'contain'
                                                    }}
                                                />
                                            )}

                                            {currentItem.type === 'youtube' && (
                                                <iframe
                                                    id={`yt-player-${currentItem.id}`}
                                                    src={getYoutubeEmbedUrl(currentItem.url, isMuted)}
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
                                                    onError={() => {
                                                        console.warn('Erro ao exibir imagem, pulando');
                                                        next(true);
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: currentItem.fitMode === 'cover' ? 'cover' : 'contain'
                                                    }}
                                                />
                                            )}

                                            {currentItem.type === 'web' && (
                                                <iframe
                                                    src={currentItem.url}
                                                    style={{
                                                        position: 'absolute',
                                                        inset: 0,
                                                        width: '100%',
                                                        height: '100%',
                                                        border: 'none'
                                                    }}
                                                />
                                            )}

                                            {currentItem.type === 'news' && (
                                                <NewsDisplay url={currentItem.url} onError={() => next(true)} />
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <DynamicTicker ticker={ticker} />
            </div>
        </div>
    );
};

export default PlayerScreen;
