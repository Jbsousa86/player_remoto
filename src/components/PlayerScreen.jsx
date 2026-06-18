import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
const fetchWeatherAndLocation = async (manualLocation = null) => {
    let latitude, longitude, city;
    
    const getExactPosition = () => new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: true });
    });

    // Se a localização foi definida manualmente no painel, use-a!
    if (manualLocation && manualLocation.lat && manualLocation.lon) {
        latitude = manualLocation.lat;
        longitude = manualLocation.lon;
        city = manualLocation.city || 'Local';
    } else {
        try {
            // 1. Tenta pegar a localização exata via hardware (Navegador/TV)
            const pos = await getExactPosition();
            latitude = pos.coords.latitude;
            longitude = pos.coords.longitude;
            
            // 2. Transforma as coordenadas exatas no nome da cidade (Geocodificação Reversa)
            const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
            const revData = await revRes.json();
            city = revData.address?.city || revData.address?.town || revData.address?.municipality || revData.address?.village || 'Local';
        } catch (e) {
            // 3. Fallback: Se falhar ou não der permissão, volta para a busca por IP
            const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
            const geoData = await geoRes.json();
            latitude = geoData.latitude;
            longitude = geoData.longitude;
            city = geoData.city || 'Local';
        }
    }

    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`);
    const weatherData = await weatherRes.json();

    const tz = weatherData.timezone || 'America/Sao_Paulo';
    window.playerTimeZone = tz; // Salva globalmente para os agendamentos de mídia respeitarem o fuso local

    return {
        temp: Math.round(weatherData.current_weather.temperature),
        city: city,
        code: weatherData.current_weather.weathercode,
        timezone: tz
    };
};

const DynamicTicker = ({ ticker, weatherLocation, queueEnabled = false, queueState = null }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [weather, setWeather] = useState(null);
    const [dolar, setDolar] = useState(null);
    const [localNewsArray, setLocalNewsArray] = useState([]);
    const [sportsNewsArray, setSportsNewsArray] = useState([]);
    const [cycleCount, setCycleCount] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, [ticker?.isActive, queueEnabled]);

    const weatherLocStr = JSON.stringify(weatherLocation);

    useEffect(() => {

        const fetchData = async () => {
            try {
                const weatherData = await fetchWeatherAndLocation(weatherLocation);
                setWeather(weatherData);
            } catch (error) {
                console.error("Erro ao buscar clima pro letreiro:", error);
            }

            try {
                const dolarRes = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
                const dolarData = await dolarRes.json();
                setDolar(parseFloat(dolarData.USDBRL.bid).toFixed(2).replace('.', ','));
            } catch (error) {
                console.error("Erro ao buscar dólar pro letreiro:", error);
            }

            // Busca notícias locais de Ananás para o letreiro
            try {
                const targetUrl = 'https://www.ananas.to.gov.br/';
                // Tentando usar um proxy CORS alternativo (corsproxy.io ou similar)
                const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`);
                const html = await res.text();
                const newsTitles = [];
                const cardRegex = /<a href="([^"]*\/blog\/artigo\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
                let match;
                while ((match = cardRegex.exec(html)) !== null) {
                    const cardHtml = match[2];
                    const titleMatch = cardHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
                    if (titleMatch) {
                        const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
                        if (title && !newsTitles.includes(title)) {
                            newsTitles.push(title);
                        }
                    }
                }
                if (newsTitles.length > 0) {
                    setLocalNewsArray(newsTitles.slice(0, 4));
                }
            } catch (error) {
                console.error("Erro ao buscar notícias locais para o letreiro:", error);
            }

            // Busca notícias de Esportes (ESPN Brasil)
            try {
                const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://www.espn.com.br/espn/rss/news')}`);
                const data = await res.json();
                if (data?.status === 'ok' && data.items?.length > 0) {
                    const sportsTitles = data.items.map(item => item.title || '');
                    setSportsNewsArray(sportsTitles.filter(t => t.length > 0).slice(0, 4));
                }
            } catch (error) {
                console.error("Erro ao buscar esportes pro letreiro:", error);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30 * 60 * 1000); // Atualiza a cada 30 minutos
        return () => clearInterval(interval);
    }, [ticker?.isActive, queueEnabled, weatherLocStr]);

    // Continue rendering even if ticker is inactive

    const tz = weather?.timezone || window.playerTimeZone || 'America/Sao_Paulo';
    const timeStr = currentTime.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    const dateStr = currentTime.toLocaleDateString('pt-BR', { timeZone: tz });
    
    // Construct last tickets string
    let queueStr = '';
    if (queueEnabled && queueState) {
        const currentTicket = queueState.current?.ticket;
        const pastTickets = (queueState.history || []).map(h => h.ticket);
        const ticketsList = [];
        if (currentTicket) {
            ticketsList.push(`🔔 ${currentTicket}`);
        }
        pastTickets.forEach(t => {
            ticketsList.push(t);
        });
        if (ticketsList.length > 0) {
            queueStr = `📢 ÚLTIMAS SENHAS: ${ticketsList.join('  •  ')}   |   `;
        }
    }

    let displayText = '';
    if (queueStr) {
        displayText += queueStr;
    }
    
    if (ticker) {
        let displayBlocks = [];

        let infoStr = `🕒 ${timeStr}`;
        if (weather) {
            infoStr += `  •  🌡️ ${weather.temp}°C (${weather.city})`;
        }
        if (dolar) {
            infoStr += `  •  💵 R$ ${dolar}`;
        }
        displayBlocks.push({ type: 'info', text: infoStr });

        if (ticker.text && typeof ticker.text === 'string') {
            displayBlocks.push({ type: 'text', text: ticker.text.replace(/{{hora}}/gi, timeStr).replace(/{{data}}/gi, dateStr) });
        }
        if (ticker.showLocalNews !== false && localNewsArray.length > 0) {
            displayBlocks.push({ type: 'local', items: localNewsArray });
        }
        if (ticker.showSports !== false) {
            if (sportsNewsArray.length > 0) {
                displayBlocks.push({ type: 'sports', items: sportsNewsArray });
            } else {
                displayBlocks.push({ type: 'sports', items: ['Atualizando últimas notícias esportivas...'] });
            }
        }

        const newsMode = ticker.newsMode || 'all';

        if (newsMode === 'all') {
            displayBlocks.forEach(b => {
                if (b.type === 'info') displayText += b.text + '  •  ';
                if (b.type === 'text') displayText += b.text + '  •  ';
                if (b.type === 'local') displayText += `📰 ANANÁS NOTÍCIAS: ${b.items.join('  •  ')}  •  `;
                if (b.type === 'sports') displayText += `⚽ GE ESPORTES: ${b.items.join('  •  ')}  •  `;
            });
        } else if (newsMode === 'categories') {
            if (displayBlocks.length > 0) {
                const b = displayBlocks[cycleCount % displayBlocks.length];
                if (b.type === 'info') displayText += b.text + '  •  ';
                if (b.type === 'text') displayText += b.text + '  •  ';
                if (b.type === 'local') displayText += `📰 ANANÁS NOTÍCIAS: ${b.items.join('  •  ')}  •  `;
                if (b.type === 'sports') displayText += `⚽ GE ESPORTES: ${b.items.join('  •  ')}  •  `;
            }
        } else if (newsMode === 'single') {
            let singles = [];
            displayBlocks.forEach(b => {
                if (b.type === 'info') singles.push({ label: '', text: b.text });
                if (b.type === 'text') singles.push({ label: '', text: b.text });
                if (b.type === 'local') b.items.forEach(i => singles.push({ label: '📰 ANANÁS NOTÍCIAS:', text: i }));
                if (b.type === 'sports') b.items.forEach(i => singles.push({ label: '⚽ GE ESPORTES:', text: i }));
            });
            if (singles.length > 0) {
                const s = singles[cycleCount % singles.length];
                displayText += s.label ? `${s.label} ${s.text}  •  ` : `${s.text}  •  `;
            }
        }
    }


    const bgColor = ticker?.bgColor || 'rgba(0, 0, 0, 0.8)';
    const rawTextColor = ticker?.textColor || '#ffffff';
    
    // Converter classes Tailwind antigas para HEX (Compatibilidade com TVs antigas / Fully Kiosk)
    let colorHex = rawTextColor;
    if (rawTextColor === 'text-white') colorHex = '#ffffff';
    else if (rawTextColor === 'text-yellow-400') colorHex = '#facc15';
    else if (rawTextColor === 'text-zinc-900') colorHex = '#18181b';
    else if (rawTextColor === 'text-emerald-400') colorHex = '#34d399';
    else if (rawTextColor === 'text-red-400') colorHex = '#f87171';
    else if (rawTextColor.startsWith('text-')) colorHex = '#ffffff';

    return (
        <div 
            style={{ backgroundColor: bgColor }}
            className="absolute bottom-0 left-0 w-full h-[10%] min-h-16 backdrop-blur-md flex items-center overflow-hidden z-50 shadow-2xl isolation-isolate"
        >
            <style>{`
                @keyframes marquee-scroll {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-100%); }
                }
            `}</style>
            
            {/* Texto Deslizante */}
            <div 
                key={displayText}
                className="whitespace-nowrap font-semibold text-[4.5vh] uppercase tracking-widest pl-[100%] relative z-[0]"
                style={{ 
                    color: colorHex,
                    animation: `marquee-scroll ${Math.max(5, Math.round((displayText.length / 150) * (ticker?.speed || 25)))}s linear infinite` 
                }}
                onAnimationIteration={() => setCycleCount(c => c + 1)}
            >
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

        if (url && (url.includes('ananas.to.gov.br') || url === 'ananas')) {
            const targetUrl = 'https://www.ananas.to.gov.br/';
            fetch(`https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`)
                .then(res => {
                    if (!res.ok) throw new Error('Erro HTTP na requisição de Ananás');
                    return res.text();
                })
                .then(html => {
                    if (!isMounted) return;
                    const newsItems = [];
                    const cardRegex = /<a href="([^"]*\/blog\/artigo\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
                    
                    let match;
                    while ((match = cardRegex.exec(html)) !== null) {
                        const link = match[1].trim();
                        const cardHtml = match[2];
                        
                        const titleMatch = cardHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
                        if (!titleMatch) continue;
                        const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
                        
                        const descMatch = cardHtml.match(/<p class="text-gray-600 dark:text-slate-400 text-sm mb-4[^>]*>([\s\S]*?)<\/p>/);
                        const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                        
                        const imgMatch = cardHtml.match(/<img[^>]+src="([^"]+)"/);
                        const img = imgMatch ? imgMatch[1].trim() : '';
                        
                        newsItems.push({
                            title,
                            description: desc,
                            thumbnail: img ? (img.startsWith('http') ? img : `https://www.ananas.to.gov.br/${img}`) : '',
                            link: link.startsWith('http') ? link : `https://www.ananas.to.gov.br/${link}`,
                            author: 'Prefeitura de Ananás'
                        });
                    }
                    
                    if (newsItems.length > 0) {
                        // Sorteia aleatoriamente uma das 5 últimas notícias recentes
                        const item = newsItems[Math.floor(Math.random() * Math.min(5, newsItems.length))];
                        setNews(item);
                    } else {
                        console.warn('HTML scrape de Ananás sem itens');
                        setHasError(true);
                        setTimeout(() => isMounted && onError?.(), 4000);
                    }
                })
                .catch(err => {
                    if (!isMounted) return;
                    console.error('Erro ao buscar notícias do site de Ananás:', err);
                    setHasError(true);
                    setTimeout(() => isMounted && onError?.(), 4000);
                });
        } else {
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
        }
            
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
            <div className="relative z-10 p-[4vw] md:p-[6vw] w-full mx-auto flex flex-col sm:flex-row items-start sm:items-end justify-between gap-[3vw]">
                <div className="flex-1 max-w-[75vw]">
                    <div className="flex items-center gap-[1vw] mb-[2vh]">
                        <span className="bg-pink-600 text-white font-black px-[1.5vw] py-[0.5vh] rounded-[1vw] uppercase tracking-widest text-[1.8vh] md:text-[2vh] shadow-lg shadow-pink-500/50">📰 Notícias</span>
                        <span className="text-white/50 font-bold text-[1.8vh] md:text-[2vh] uppercase tracking-widest">{news.author || 'Última Hora'}</span>
                    </div>
                    <h1 className="text-white font-black text-[4vh] md:text-[6vh] leading-tight drop-shadow-2xl mb-[2vh]">{news.title}</h1>
                    {typeof news.description === 'string' && <p className="text-zinc-300 font-medium text-[2.5vh] md:text-[3vh] line-clamp-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: news.description.replace(/<[^>]+>/g, '') }} />}
                </div>

                {newsUrl && (
                    <div className="flex flex-col items-center bg-white/10 backdrop-blur-md p-[1.5vw] rounded-[2vw] border border-white/20 shadow-2xl shrink-0 animate-fade">
                        <div className="bg-white p-[1vw] rounded-[1vw] mb-[1.5vh] shadow-inner flex items-center justify-center">
                            <QRCodeSVG value={newsUrl} size={150} level="Q" className="w-[12vw] h-[12vw] max-w-37.5 max-h-37.5" />
                        </div>
                        <span className="text-[1.5vh] md:text-[1.8vh] font-black uppercase tracking-widest text-white text-center leading-tight">
                            Leia a matéria<br/>no celular
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

const loteriasCache = {
    megasena: null,
    lotofacil: null,
    quina: null,
    lotomania: null,
    lastFetched: {}
};

const LoteriasDisplay = ({ url, onError }) => {
    const isRotating = url === 'todas';
    const gamesList = useMemo(() => isRotating ? ['megasena', 'lotofacil', 'quina', 'lotomania'] : [url], [isRotating, url]);
    const [gameIndex, setGameIndex] = useState(0);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const activeGameKey = gamesList[gameIndex];

    // Sub-rotation effect inside the slide
    useEffect(() => {
        if (!isRotating) return;
        const interval = setInterval(() => {
            setGameIndex((prev) => (prev + 1) % gamesList.length);
        }, 8000); // Change game every 8 seconds
        return () => clearInterval(interval);
    }, [isRotating, gamesList.length]);

    // Fetch lottery data
    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setHasError(false);

        const fetchData = async () => {
            try {
                const now = Date.now();
                const oneHour = 60 * 60 * 1000;
                
                const validGames = ['megasena', 'lotofacil', 'quina', 'lotomania'];
                const key = validGames.includes(activeGameKey) ? activeGameKey : 'megasena';

                let gameData;
                if (loteriasCache[key] && loteriasCache.lastFetched[key] && (now - loteriasCache.lastFetched[key] < oneHour)) {
                    gameData = loteriasCache[key];
                } else {
                    const res = await fetch(`https://loteriascaixa-api.herokuapp.com/api/${key}/latest`);
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    const rawData = await res.json();
                    gameData = {
                        listaDezenas: rawData.dezenas || [],
                        numero: rawData.concurso,
                        dataApuracao: rawData.data,
                        numeroConcursoProximo: rawData.proximoConcurso,
                        dataProximoConcurso: rawData.dataProximoConcurso,
                        acumulado: rawData.acumulou,
                        valorEstimadoProximoConcurso: rawData.valorEstimadoProximoConcurso,
                        nomeMunicipioUFSorteio: rawData.local
                    };
                    loteriasCache[key] = gameData;
                    loteriasCache.lastFetched[key] = now;
                }

                if (isMounted) {
                    setData(gameData);
                    setLoading(false);
                }
            } catch (err) {
                console.error('Erro ao buscar dados da loteria:', err);
                if (isMounted) {
                    setHasError(true);
                    setLoading(false);
                    if (!isRotating) {
                        setTimeout(() => isMounted && onError?.(), 4000);
                    }
                }
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [activeGameKey, isRotating, onError]);

    const getGameConfig = (key) => {
        switch (key) {
            case 'megasena':
                return {
                    name: 'Mega-Sena',
                    bg: 'from-emerald-950 via-zinc-950 to-black border-emerald-500/20',
                    badge: 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30',
                    glow: 'shadow-emerald-500/20'
                };
            case 'lotofacil':
                return {
                    name: 'Lotofácil',
                    bg: 'from-purple-950 via-zinc-950 to-black border-purple-500/20',
                    badge: 'bg-purple-600 text-white shadow-lg shadow-purple-500/30',
                    glow: 'shadow-purple-500/20'
                };
            case 'quina':
                return {
                    name: 'Quina',
                    bg: 'from-blue-950 via-zinc-950 to-black border-blue-500/20',
                    badge: 'bg-blue-600 text-white shadow-lg shadow-blue-500/30',
                    glow: 'shadow-blue-500/20'
                };
            case 'lotomania':
                return {
                    name: 'Lotomania',
                    bg: 'from-orange-950 via-zinc-950 to-black border-orange-500/20',
                    badge: 'bg-orange-600 text-white shadow-lg shadow-orange-500/30',
                    glow: 'shadow-orange-500/20'
                };
            default:
                return {
                    name: 'Loterias',
                    bg: 'from-zinc-900 via-zinc-950 to-black border-white/10',
                    badge: 'bg-zinc-600 text-white',
                    glow: 'shadow-white/5'
                };
        }
    };

    const getBallStyle = (key) => {
        switch (key) {
            case 'megasena':
                return {
                    background: 'radial-gradient(circle at 30% 30%, #34d399 0%, #065f46 80%)',
                    color: '#ffffff'
                };
            case 'lotofacil':
                return {
                    background: 'radial-gradient(circle at 30% 30%, #c084fc 0%, #581c87 80%)',
                    color: '#ffffff'
                };
            case 'quina':
                return {
                    background: 'radial-gradient(circle at 30% 30%, #60a5fa 0%, #1e3a8a 80%)',
                    color: '#ffffff'
                };
            case 'lotomania':
                return {
                    background: 'radial-gradient(circle at 30% 30%, #fb923c 0%, #7c2d12 80%)',
                    color: '#1e293b' // slate-900 for high contrast
                };
            default:
                return {
                    background: 'radial-gradient(circle at 30% 30%, #a1a1aa 0%, #3f3f46 80%)',
                    color: '#ffffff'
                };
        }
    };

    const config = getGameConfig(activeGameKey);

    const formatCurrency = (val) => {
        if (val === undefined || val === null) return 'R$ --,--';
        return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    if (loading) {
        return (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-zinc-950 text-white">
                <div className="animate-pulse flex flex-col items-center">
                    <span className="text-5xl mb-4 animate-bounce">🎰</span>
                    <span className="text-sm font-bold tracking-widest uppercase text-zinc-500">Buscando Resultados Caixa...</span>
                </div>
            </div>
        );
    }

    if (hasError || !data) {
        return (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-zinc-950 text-white">
                <div className="flex flex-col items-center opacity-70 animate-fade">
                    <span className="text-5xl mb-4">⚠️</span>
                    <span className="text-sm font-bold tracking-widest uppercase text-red-400">Falha ao buscar dados</span>
                    <span className="text-xs mt-2 text-zinc-500 text-center">Não foi possível carregar os resultados da Caixa.</span>
                </div>
            </div>
        );
    }

    const dezenas = data.listaDezenas || [];
    const loteriasUrl = 'https://loterias.caixa.gov.br';

    return (
        <div className={`absolute inset-0 w-full h-full flex flex-col justify-between bg-linear-to-b ${config.bg} animate-fade p-[4vw] md:p-[5vw]`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-[2vh] z-10 shrink-0">
                <div className="flex items-center gap-[2vw]">
                    <span className="bg-linear-to-r from-orange-500 to-yellow-500 text-white font-black px-[1.5vw] py-[0.5vh] rounded-[1vw] uppercase tracking-widest text-[1.6vh] md:text-[2vh] shadow-lg shadow-orange-500/20">
                        🎰 Loterias Caixa
                    </span>
                    <span className={`${config.badge} font-black px-[1.5vw] py-[0.5vh] rounded-[1vw] uppercase tracking-widest text-[1.6vh] md:text-[2vh]`}>
                        {config.name}
                    </span>
                </div>
                <span className="text-white/60 font-bold text-[1.8vh] md:text-[2.2vh] uppercase tracking-widest">
                    Concurso {data.numero} • {data.dataApuracao}
                </span>
            </div>

            {/* Ball area */}
            <div className="flex-1 flex flex-col justify-center items-center gap-[2vh] z-10 min-h-0">
                <p className="text-zinc-400 font-bold text-[1.5vh] md:text-[1.8vh] uppercase tracking-[0.2em] mb-[1vh] shrink-0">
                    Números Sorteados
                </p>
                <div className="w-full flex flex-wrap justify-center items-center gap-[1.5vw] max-w-[90%] overflow-y-auto py-2">
                    {dezenas.map((dez, idx) => {
                        // Sizing depending on amount of numbers
                        const sizeClass = dezenas.length > 15 
                            ? 'w-[7vw] h-[7vw] md:w-[4.8vw] md:h-[4.8vw] text-[2.5vh] md:text-[3vh]' 
                            : dezenas.length > 6 
                                ? 'w-[8.5vw] h-[8.5vw] md:w-[6.2vw] md:h-[6.2vw] text-[3.2vh] md:text-[3.8vh]' 
                                : 'w-[12vw] h-[12vw] md:w-[8.5vw] md:h-[8.5vw] text-[5vh] md:text-[6vh]';
                        return (
                            <div
                                key={idx}
                                className={`${sizeClass} rounded-full flex items-center justify-center font-black shadow-lg relative border border-white/20 shrink-0`}
                                style={getBallStyle(activeGameKey)}
                            >
                                <div className="absolute top-[10%] left-[15%] w-[30%] h-[30%] bg-white/30 rounded-full blur-[1px]" />
                                <span className="relative drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)] z-10">
                                    {dez}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Panel */}
            <div className="flex flex-row items-center justify-between gap-[3vw] bg-white/5 backdrop-blur-md p-[2vw] rounded-[2.5vw] border border-white/10 shadow-2xl z-10 shrink-0">
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-[2vw]">
                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-[1vw] mb-[0.5vh]">
                            <span className="text-zinc-400 font-bold text-[1.4vh] md:text-[1.8vh] uppercase tracking-wider">
                                Próximo Concurso {data.numeroConcursoProximo} ({data.dataProximoConcurso})
                            </span>
                            {data.acumulado && (
                                <span className="bg-amber-500 text-zinc-950 font-black px-[1vw] py-[0.2vh] rounded-[0.5vw] uppercase text-[1.2vh] md:text-[1.5vh] animate-bounce">
                                    Acumulou!
                                </span>
                            )}
                        </div>
                        <h2 className="text-yellow-400 font-black text-[3.5vh] md:text-[5vh] leading-none tracking-tight drop-shadow-[0_2px_5px_rgba(234,179,8,0.2)]">
                            {formatCurrency(data.valorEstimadoProximoConcurso)}
                        </h2>
                    </div>
                    
                    <div className="hidden sm:block text-right shrink-0">
                        <span className="text-zinc-500 font-semibold text-[1.4vh] md:text-[1.8vh] block uppercase tracking-widest">
                            Espaço da Sorte
                        </span>
                        <span className="text-zinc-400 font-bold text-[1.6vh] md:text-[2vh] block uppercase">
                            {data.nomeMunicipioUFSorteio}
                        </span>
                    </div>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center bg-white p-[1vw] rounded-[1.5vw] shadow-lg shrink-0">
                    <QRCodeSVG value={loteriasUrl} size={100} level="Q" className="w-[8vw] h-[8vw] max-w-20 max-h-20" />
                </div>
            </div>
        </div>
    );
};

const StandbyWeather = ({ weather }) => {

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

const StandbyClock = ({ weatherLocation }) => {
    const [time, setTime] = useState(new Date());
    const [weather, setWeather] = useState(null);

    const weatherLocStr = JSON.stringify(weatherLocation);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const weatherData = await fetchWeatherAndLocation(weatherLocation);
                setWeather(weatherData);
            } catch (error) {
                console.error("Erro ao buscar clima:", error);
            }
        };

        fetchWeather();
        const interval = setInterval(fetchWeather, 30 * 60 * 1000); // Atualiza a cada 30 minutos
        return () => clearInterval(interval);
    }, [weatherLocStr]);

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const tz = weather?.timezone || window.playerTimeZone || 'America/Sao_Paulo';

    return (
        <div className="mt-12 flex flex-row items-center justify-center bg-white/5 px-10 md:px-16 py-8 rounded-[3rem] backdrop-blur-xl border border-white/10 shadow-2xl">
            <div className="flex flex-col items-center">
                <span className="text-6xl md:text-8xl font-black tracking-tighter tabular-nums text-white drop-shadow-lg">
                    {time.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[10px] md:text-sm font-bold text-orange-500 uppercase tracking-[0.3em] mt-4 text-center">
                    {time.toLocaleDateString('pt-BR', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
            </div>
            
            <StandbyWeather weather={weather} />
        </div>
    );
};

const transitionVariants = {
    'fade-zoom': {
        initial: { opacity: 0, scale: 1.02 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.98 }
    },
    'fade': {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 }
    },
    'slide-left': {
        initial: { opacity: 0, x: 60 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -60 }
    },
    'slide-right': {
        initial: { opacity: 0, x: -60 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 60 }
    },
    'slide-up': {
        initial: { opacity: 0, y: 60 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -60 }
    },
    'slide-down': {
        initial: { opacity: 0, y: -60 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 60 }
    },
    'none': {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 }
    }
};

const VideoPlayer = ({ url, fitMode, isMuted, volume, onEnded, onError, videoRef }) => {
    const bgVideoRef = useRef(null);

    // Efeito para sincronizar volume e mudo dinamicamente
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
            videoRef.current.volume = volume / 100;
        }
    }, [isMuted, volume, videoRef]);

    // Cleanup completo do decodificador ao desmontar ou trocar de URL
    useEffect(() => {
        return () => {
            console.log("🧹 Liberando decodificadores de hardware...");
            [videoRef.current, bgVideoRef.current].forEach(el => {
                if (el) {
                    try {
                        el.pause();
                        el.removeAttribute('src');
                        el.load();
                    } catch (e) {
                        console.warn("Erro ao limpar vídeo:", e);
                    }
                }
            });
        };
    }, [url, videoRef]);

    return (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
            {fitMode === 'smart' && (
                <video
                    ref={bgVideoRef}
                    src={url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40 select-none pointer-events-none"
                />
            )}
            <video
                ref={videoRef}
                src={url}
                autoPlay
                defaultMuted={true}
                playsInline
                disablePictureInPicture
                className="pointer-events-none relative z-10"
                preload="auto"
                onEnded={onEnded}
                onError={onError}
                onPlay={(e) => {
                    e.target.muted = isMuted;
                    e.target.volume = volume / 100;
                }}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: fitMode === 'cover' ? 'cover' : (fitMode === 'fill' ? 'fill' : 'contain')
                }}
            />
        </div>
    );
};

const PlayerScreen = ({ playlist, standbyOptions = {}, blockSchedules = {}, orientation = 'landscape', isMuted = true, volume = 100, isPlaying = true, isStopped = false, ticker = null, weatherLocation = null, onMediaChange, queueEnabled = false, queueState = null, screenTransition = 'fade-zoom' }) => {
    // 1. FILTRO DE ATIVOS: Evita que o player tente ler mídias inativadas no painel
    const [activePlaylist, setActivePlaylist] = useState([]);

    const [calledTicket, setCalledTicket] = useState(null);
    const [showQueueOverlay, setShowQueueOverlay] = useState(false);
    const [audioUnlocked, setAudioUnlocked] = useState(false);

    // Auto-detect and unlock audio on interaction
    useEffect(() => {
        if (!queueEnabled) return;

        const checkAudio = () => {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                const ctx = new AudioContextClass();
                if (ctx.state === 'running') {
                    setAudioUnlocked(true);
                }
                ctx.close();
            }
        };
        checkAudio();

        // Inicializa o TTS nativo do Fully Kiosk se disponível (Versão 1.55+)
        if (typeof fully !== 'undefined' && typeof fully.initTts === 'function') {
            try {
                fully.initTts();
                console.log('🔊 Fully Kiosk TTS inicializado');
            } catch (e) {
                console.warn('Erro ao inicializar TTS no Fully Kiosk:', e);
            }
        }
    }, [queueEnabled]);

    useEffect(() => {
        if (!queueEnabled || audioUnlocked) return;

        const unlock = () => {
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    const ctx = new AudioContextClass();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    gain.gain.setValueAtTime(0, ctx.currentTime);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(0);
                    osc.stop(0.1);
                    if (ctx.state === 'suspended') {
                        ctx.resume();
                    }
                }
                if (window.speechSynthesis) {
                    const u = new SpeechSynthesisUtterance('');
                    window.speechSynthesis.speak(u);
                }
                setAudioUnlocked(true);
                console.log('🔊 Audio unlocked by interaction');
            } catch (e) {
                console.warn('Erro ao desbloquear áudio:', e);
            }
        };

        const handleInteraction = () => {
            unlock();
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };

        window.addEventListener('click', handleInteraction);
        window.addEventListener('touchstart', handleInteraction);

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
    }, [queueEnabled, audioUnlocked]);

    // Audio chime generator using Web Audio API
    const playChime = (volPercent) => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const gainNode = ctx.createGain();
            gainNode.gain.setValueAtTime((volPercent / 100) * 0.5, ctx.currentTime);
            gainNode.connect(ctx.destination);

            const playNote = (freq, startTime, duration) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);
                
                const gainNodeLocal = ctx.createGain();
                gainNodeLocal.gain.setValueAtTime(0.001, startTime);
                gainNodeLocal.gain.exponentialRampToValueAtTime(1.0, startTime + 0.05);
                gainNodeLocal.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.05);
                
                osc.connect(gainNodeLocal);
                gainNodeLocal.connect(gainNode);
                
                osc.start(startTime);
                osc.stop(startTime + duration);
            };

            playNote(523.25, ctx.currentTime, 0.2);
            playNote(659.25, ctx.currentTime + 0.2, 0.2);
            playNote(783.99, ctx.currentTime + 0.4, 0.4);
        } catch (err) {
            console.warn('Erro ao reproduzir chime:', err);
        }
    };

    // Text to speech generator using Web Speech API
    const speakTicket = (ticket, type, volPercent) => {
        try {
            const isPref = type === 'Preferencial' || ticket.toUpperCase().startsWith('P');
            const typeText = isPref ? 'Atendimento Preferencial' : 'Atendimento Normal';
            const text = `Senha ${ticket.split('').join(' ')}, ${typeText}`;
            const volume = volPercent / 100;

            // 0. SUPORTE PARA FULLY KIOSK BROWSER (DIRETO NO ANDROID)
            if (typeof fully !== 'undefined' && typeof fully.textToSpeech === 'function') {
                console.log("🔊 Usando TTS nativo do Fully Kiosk Browser:", text);
                fully.textToSpeech(text, 'pt_BR');
                return;
            }

            // Identifica Fire TV e Android TV Boxes (como R3, MXQ, MiBox) que não possuem motor nativo
            const isTvBox = /AFT|Amazon|AFTMM|R3|TV|Box|STB|MiTV|Chromecast/i.test(navigator.userAgent);

            // 1. SUPORTE NATIVO ABSOLUTO PARA CAPACITOR (ANDROID / IOS)
            // Se for TV Box/Fire TV, pula essa etapa porque eles falham silenciosamente!
            if (Capacitor.isNativePlatform() && !isTvBox) {
                console.log("🔊 Usando TTS nativo do Capacitor:", text);
                TextToSpeech.speak({
                    text: text,
                    lang: 'pt-BR',
                    rate: 0.85,
                    pitch: 1.0,
                    volume: volume,
                }).catch(err => {
                    console.error("Erro no TTS do Capacitor:", err);
                    // Se o plugin falhar (ex: aparelho sem motor), toca a nuvem
                    const googleTtsUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=pt-BR&client=gtx&q=${encodeURIComponent(text)}`;
                    const audioFallback = new Audio(googleTtsUrl);
                    audioFallback.volume = volume;
                    audioFallback.play().catch(e => console.warn(e));
                });
                return;
            }

            // 2. USA A VOZ NATIVA DO SISTEMA WEB (PC/MAC/NAVEGADOR)
            if ('speechSynthesis' in window) {
                const voices = window.speechSynthesis.getVoices();
                const ptVoice = voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR') || v.lang.includes('pt'));
                
                // SÓ usa o nativo se o aparelho realmente tiver um motor de voz respondendo
                if (ptVoice || voices.length > 0) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = 'pt-BR';
                    utterance.rate = 0.85;
                    utterance.pitch = 1.0;
                    utterance.volume = volume;
                    if (ptVoice) {
                        utterance.voice = ptVoice;
                    }
                    window.speechSynthesis.speak(utterance);
                    return; // Sai da função, não usa a nuvem
                }
                
                console.warn("TV não tem vozes instaladas ou carregadas. Pulando para a nuvem...");
            }

            // 2. PLANO B (FALLBACK): Nuvem do Google (Essencial para Fire TV e Android TV sem TTS nativo)
            const googleTtsUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=pt-BR&client=gtx&q=${encodeURIComponent(text)}`;
            const audioFallback = new Audio(googleTtsUrl);
            audioFallback.volume = volume;
            audioFallback.play().catch(err => {
                console.warn("Erro ao reproduzir TTS em nuvem no Fire TV:", err);
            });
        } catch (err) {
            console.warn('Erro na síntese de voz:', err);
        }
    };

    // Listen to queue state changes
    useEffect(() => {
        if (!queueEnabled || !queueState?.current) return;

        const currentCall = queueState.current;
        setShowQueueOverlay(true);
        setCalledTicket(currentCall);

        if (volume > 0) {
            playChime(volume);
            const speechTimeout = setTimeout(() => {
                speakTicket(currentCall.ticket, currentCall.type, volume);
            }, 900);
            
            return () => {
                clearTimeout(speechTimeout);
            };
        }
    }, [queueState?.current?.timestamp, queueEnabled, volume]);

    // Timeout to hide queue overlay
    useEffect(() => {
        if (showQueueOverlay) {
            const timer = setTimeout(() => {
                setShowQueueOverlay(false);
            }, 10000); // Hide after 10 seconds
            return () => clearTimeout(timer);
        }
    }, [showQueueOverlay, queueState?.current?.timestamp]);

    useEffect(() => {
        const updatePlayableItems = () => {
            const now = new Date();
            
            // Abordagem matemática 100% à prova de falhas via UTC puro.
            // Ignora completamente os bugs de "Invalid Date" em TVs antigas.
            // O fuso de São Paulo é fixamente UTC-3.
            let spHour = now.getUTCHours() - 3;
            if (spHour < 0) spHour += 24;
            const spMinute = now.getUTCMinutes();
            
            let currentTimeStr;
            try {
                const tz = window.playerTimeZone || 'America/Sao_Paulo';
                currentTimeStr = new Intl.DateTimeFormat('pt-BR', {
                    timeZone: tz,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }).format(now);
            } catch (e) {
                // Fallback de segurança matemático via UTC puro caso a TV antiga não suporte a API de Intl.
                let spHour = now.getUTCHours() - 3;
                if (spHour < 0) spHour += 24;
                const spMinute = now.getUTCMinutes();
                const currentHour = spHour < 10 ? '0' + spHour : spHour.toString();
                const currentMinute = spMinute < 10 ? '0' + spMinute : spMinute.toString();
                currentTimeStr = `${currentHour}:${currentMinute}`;
            }

            const playable = playlist?.filter(item => {
                if (item.isActive === false) return false;
                if (item.block && blockSchedules?.[item.block]) {
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
            setActivePlaylist(prev => JSON.stringify(prev) === JSON.stringify(playable) ? prev : playable);
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

    useEffect(() => {
        if (onMediaChange) {
            if (isStopped || !activePlaylist?.length) {
                onMediaChange('standby');
            } else if (currentItem?.id) {
                onMediaChange(currentItem.id);
            }
        }
    }, [currentItem?.id, isStopped, activePlaylist?.length, onMediaChange]);

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
    }, [activePlaylist]);

    /* =========================
       YOUTUBE HELPERS
    ========================== */
    const getYoutubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/;
        const match = String(url).match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    // Detecta se a URL é um stream ao vivo do YouTube
    const isYoutubeLive = (url) => {
        if (!url) return false;
        return /youtube\.com\/live\/|[?&]live=1/.test(url);
    };

    const getYoutubeEmbedUrl = (url, muted) => {
        const id = getYoutubeId(url);
        if (!id) return '';

        // Detecta se a URL contém uma playlist do YouTube e repassa o parâmetro
        const listMatch = url.match(/[?&]list=([^&#]+)/);
        const listParam = listMatch ? `&list=${listMatch[1]}&listType=playlist` : '';

        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return `https://www.youtube.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&rel=0&enablejsapi=1&origin=${encodeURIComponent(origin)}${listParam}`;
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

        // Não vamos forçar o pulo por tempo para YouTube.
        // O evento onStateChange(ENDED) natural do YouTube cuidará de avançar o vídeo ou playlist.
        // Se houver erro, a API aciona onError e pula.
        
        return () => {};
    }, [currentType, currentUrl, currentDuration, currentItem?.id, isPlaying, isStopped, next]);

    /* =========================
       VIDEO SAFETY TIMER
    ========================== */
    useEffect(() => {
        if (currentType !== 'video' || !isPlaying || isStopped) return;

        // Se a duração for explicitamente 0 (Ilimitado), não ativamos o timer forçado.
        // O evento onEnded natural da tag <video> cuidará de avançar o item.
        if (currentDuration === 0) return;

        // Se houver duração definida pelo usuário, respeitamos. 
        // Caso a duração seja nula/indefinida, usamos 10 min de segurança.
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
                        // Só avança para o próximo item da playlist LOCAL quando o vídeo/playlist do YouTube terminar.
                        // Se houver uma playlist do YT carregada (listParam), o próprio YouTube avança entre vídeos.
                        // O estado ENDED só é atingido ao fim de TODA a playlist do YT.
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
       PLAY/PAUSE & MUTE/VOLUME EFFECTS (DYNAMIC)
    ========================== */
    useEffect(() => {
        if (currentType === 'video' && videoRef.current) {
            // 3. CAPTURA DE BLOQUEIO DE AUTOPLAY: Pula logo ao invés de congelar caso a TV bloqueie o vídeo
            if (isPlaying && !isStopped) {
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.warn('Erro ao tocar vídeo ou bloqueio de autoplay:', e);
                        // Aguarda 5 segundos antes de pular para não sobrecarregar
                        setTimeout(() => {
                            next(true);
                        }, 5000);
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
        if (currentType === 'video' && videoRef.current) {
            videoRef.current.muted = isMuted;
            videoRef.current.volume = volume / 100;
        } else if (currentType === 'youtube' && ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
            ytPlayerRef.current.setVolume(volume);
            
            // Garantir que obedece ao volume do admin desmutando explicitamente
            if (!isMuted && volume > 0) {
                ytPlayerRef.current.unMute();
            } else {
                ytPlayerRef.current.mute();
            }
        }
    }, [isMuted, volume, currentType, currentUrl, currentItem?.id]);

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
        if ((currentType !== 'web' && currentType !== 'news' && currentType !== 'loterias') || !isPlaying || isStopped) return;

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

    const isTickerShown = !!(ticker?.isActive || queueEnabled);

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
                    top: needsRotation ? '50%' : '0',
                    left: needsRotation ? '50%' : '0',
                    width: needsRotation ? `${screenSize.h}px` : '100%',
                    height: needsRotation ? `${screenSize.w}px` : '100%',
                    transform: needsRotation ? `translate(-50%, -50%) rotate(90deg)` : 'none',
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
                            className={`absolute top-0 left-0 w-full flex flex-col items-center justify-center text-white bg-zinc-950 ${isTickerShown ? 'h-[90%]' : 'h-full'}`}
                        >
                            <img src={standbyImage} alt="Standby" className="absolute inset-0 w-full h-full object-cover opacity-70 saturate-150 animate-standby-pan" />
                            <div className="absolute inset-0 bg-linear-to-b from-black/10 via-black/40 to-black/70 z-0" />
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
                                <StandbyClock weatherLocation={weatherLocation} />
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="player"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1 }}
                            className={`absolute top-0 left-0 w-full overflow-hidden pointer-events-none select-none bg-black ${isTickerShown ? 'h-[90%]' : 'h-full'}`}
                        >
                            <div className="relative w-full h-full flex items-center justify-center">
                                <AnimatePresence>
                                    {currentItem && (() => {
                                        const transitionType = (currentItem.transition && currentItem.transition !== 'default') 
                                            ? currentItem.transition 
                                            : (screenTransition || 'fade-zoom');
                                        const variant = transitionVariants[transitionType] || transitionVariants['fade-zoom'];
                                        const isNone = transitionType === 'none';
                                        return (
                                            <motion.div
                                                key={currentItem.id ? `media-${currentItem.id}-${currentIndex}` : `media-idx-${currentIndex}`}
                                                initial={variant.initial}
                                                animate={variant.animate}
                                                exit={variant.exit}
                                                transition={{ 
                                                    duration: isNone ? 0 : 0.8, 
                                                    ease: isNone ? "linear" : [0.25, 0.1, 0.25, 1] 
                                                }}
                                                className="absolute inset-0 w-full h-full flex items-center justify-center bg-black"
                                            >
                                                {currentItem.type === 'video' && (
                                                    <VideoPlayer
                                                        url={currentItem.url}
                                                        fitMode={currentItem.fitMode}
                                                        isMuted={isMuted}
                                                        volume={volume}
                                                        onEnded={next}
                                                        onError={(e) => {
                                                            console.error('Video playback error, waiting before retry/skip:', e);
                                                            // Em vez de avançar instantaneamente, aguarda 5 segundos para evitar loops síncronos
                                                            setTimeout(() => {
                                                                next(true);
                                                            }, 5000);
                                                        }}
                                                        videoRef={videoRef}
                                                    />
                                                )}

                                                {currentItem.type === 'youtube' && (
                                                    <iframe
                                                        id={`yt-player-${currentItem.id}`}
                                                        src={getYoutubeEmbedUrl(currentItem.url, true)}
                                                        style={{
                                                            position: 'absolute',
                                                            inset: 0,
                                                            width: '100%',
                                                            height: '100%',
                                                            border: 'none'
                                                        }}
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                        title="YouTube Player"
                                                    />
                                                )}

                                                {currentItem.type === 'image' && (
                                                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
                                                        {currentItem.fitMode === 'smart' && (
                                                            <img
                                                                src={currentItem.url}
                                                                alt=""
                                                                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40 select-none pointer-events-none"
                                                            />
                                                        )}
                                                        <motion.img
                                                            src={currentItem.url}
                                                            alt=""
                                                            onError={() => {
                                                                console.warn('Erro ao exibir imagem, pulando');
                                                                next(true);
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                height: '100%',
                                                                objectFit: currentItem.fitMode === 'cover' ? 'cover' : (currentItem.fitMode === 'fill' ? 'fill' : 'contain'),
                                                                position: 'relative',
                                                                zIndex: 10
                                                            }}
                                                        />
                                                    </div>
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

                                                {currentItem.type === 'loterias' && (
                                                    <LoteriasDisplay url={currentItem.url} onError={() => next(true)} />
                                                )}
                                            </motion.div>
                                        );
                                    })()}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>


                {isTickerShown && (
                    <DynamicTicker ticker={ticker} weatherLocation={weatherLocation} queueEnabled={queueEnabled} queueState={queueState} />
                )}
            </div>

            {/* Chamada de Senha Overlay */}
            <AnimatePresence>
                {showQueueOverlay && calledTicket && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-100 p-8"
                    >
                        <div className="absolute inset-0 bg-linear-to-tr from-emerald-950/20 via-zinc-950/50 to-teal-950/20" />
                        
                        {/* Pulsing Decorative Glow */}
                        <div className="absolute w-[80vw] h-[80vw] max-w-200 max-h-200 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />

                        <div className="relative flex flex-col items-center text-center max-w-4xl w-full">
                            
                            {/* Header Badge */}
                            <motion.div 
                                initial={{ y: -50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
                                className="inline-flex items-center gap-4 bg-white/5 text-white px-10 py-4 rounded-full shadow-2xl border-2 border-white/20 mb-8"
                            >
                                <span className="text-[2.5vh] md:text-[3.5vh] font-black uppercase tracking-[0.3em] leading-none">
                                    Atendimento
                                </span>
                            </motion.div>

                            {/* Ticket Code */}
                            <motion.h1 
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 80 }}
                                className="text-[14vh] md:text-[20vh] font-black text-white leading-none tracking-tighter drop-shadow-[0_10px_25px_rgba(255,255,255,0.15)] mb-6 uppercase"
                            >
                                {calledTicket.ticket}
                            </motion.h1>

                            {/* Ticket Type Display */}
                            {(() => {
                                const isPref = calledTicket.type === 'Preferencial' || calledTicket.ticket.toUpperCase().startsWith('P');
                                const displayType = isPref ? 'PREFERENCIAL ♿' : 'NORMAL';
                                const themeColorClass = isPref ? 'text-amber-400 border-amber-500/20' : 'text-emerald-400 border-emerald-500/20';
                                return (
                                    <motion.div 
                                        initial={{ y: 50, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
                                        className={`px-14 py-6 rounded-[2.5rem] bg-white/5 border shadow-2xl backdrop-blur-md ${themeColorClass}`}
                                    >
                                        <span className="text-[4vh] md:text-[6vh] font-black uppercase tracking-wider block leading-none">
                                            {displayType}
                                        </span>
                                    </motion.div>
                                );
                            })()}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Audio Unlock Request Banner */}
            {queueEnabled && !audioUnlocked && (
                <div 
                    onClick={() => setAudioUnlocked(true)}
                    className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 hover:bg-amber-400 text-black font-black px-6 py-2.5 rounded-full shadow-2xl z-120 text-xs uppercase tracking-widest cursor-pointer flex items-center gap-2 animate-bounce border-2 border-white/20"
                >
                    <span>⚠️ Toque na tela para ativar o som das senhas</span>
                </div>
            )}
        </div>
    );
};

export default PlayerScreen;
