import React, { useState, useEffect } from 'react';
import { RefreshCw, Monitor, Smartphone, Play, Pause, Volume2, VolumeX } from 'lucide-react';

const AdminHeader = ({ selectedScreen, isScreenOnline, handleForceReload, handleToggleOrientation, handleToggleSound, handleVolumeChange, handleTogglePlayPause, isSyncing }) => {
    const [localVolume, setLocalVolume] = useState(selectedScreen?.volume ?? 100);

    useEffect(() => {
        if (selectedScreen?.volume !== undefined) {
            setLocalVolume(selectedScreen.volume);
        }
    }, [selectedScreen?.volume, selectedScreen?.id]);

    const onVolumeSliderChange = (e) => {
        setLocalVolume(parseInt(e.target.value));
    };

    const onVolumeSliderRelease = (e) => {
        if (handleVolumeChange) {
            handleVolumeChange(parseInt(e.target.value));
        }
    };

    return (
        <header className="mb-12 flex flex-col md:flex-row justify-between items-start gap-8 mr-8">
            <div>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className={`inline-flex items-center gap-2 ${isScreenOnline(selectedScreen.lastSeen) ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'} text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isScreenOnline(selectedScreen.lastSeen) ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                        {selectedScreen.name} • {isScreenOnline(selectedScreen.lastSeen) ? 'ONLINE' : 'OFFLINE'}
                    </div>
                    <div className="inline-flex items-center gap-2 bg-orange-500/10 text-orange-500 border-orange-500/20 text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest" title="Digite este ID em outro totem para espelhá-los">
                        ID DO TOTEM: <span className="text-white select-all">{selectedScreen.id}</span>
                    </div>
                </div>
                <button
                    onClick={handleForceReload}
                    title="Forçar recarregamento da página no Totem"
                    className="ml-3 inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[9px] font-black px-3 py-1 rounded-full border border-white/10 transition-all uppercase tracking-widest active:scale-95"
                >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    Reiniciar Player
                </button>
                <button
                    onClick={handleToggleOrientation}
                    title="Alternar entre Horizontal e Vertical"
                    className="ml-2 inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[9px] font-black px-3 py-1 rounded-full border border-white/10 transition-all uppercase tracking-widest active:scale-95"
                >
                    {selectedScreen.orientation === 'portrait' ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                    {selectedScreen.orientation === 'portrait' ? 'MODO VERTICAL' : 'MODO HORIZONTAL'}
                </button>
                <div className={`ml-2 mt-2 md:mt-0 inline-flex items-center gap-2 bg-white/5 text-zinc-400 text-[9px] font-black px-3 py-1 rounded-full border transition-all uppercase tracking-widest ${
                    selectedScreen.isMuted === false ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/5' : 'border-white/10'
                }`}>
                    <button
                        onClick={handleToggleSound}
                        title="Alternar entre Com Som e Sem Som"
                        className="hover:text-white active:scale-95 flex items-center gap-2"
                    >
                        {selectedScreen.isMuted === false ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                        <span className="hidden sm:inline">{selectedScreen.isMuted === false ? 'SOM' : 'MUDO'}</span>
                    </button>
                    <div className="w-px h-3 bg-white/20 mx-1"></div>
                    <input 
                        type="range" 
                        min="0" max="100" 
                        value={localVolume} 
                        onChange={onVolumeSliderChange} 
                        onMouseUp={onVolumeSliderRelease} 
                        onTouchEnd={onVolumeSliderRelease}
                        className={`w-16 md:w-20 h-1 bg-black/40 rounded-lg appearance-none cursor-pointer ${selectedScreen.isMuted === false ? 'accent-emerald-500' : 'accent-zinc-500'}`}
                        title={`Volume: ${localVolume}%`}
                    />
                </div>
                <button
                    onClick={handleTogglePlayPause}
                    title="Pausar ou Reproduzir Totem"
                    className={`ml-2 mt-2 md:mt-0 inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[9px] font-black px-3 py-1 rounded-full border transition-all uppercase tracking-widest active:scale-95 ${
                        selectedScreen.isPlaying === false ? 'border-amber-500/50 text-amber-400 bg-amber-500/5' : 'border-white/10'
                    }`}
                >
                    {selectedScreen.isPlaying === false ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    {selectedScreen.isPlaying === false ? 'RETOMAR' : 'PAUSAR'}
                </button>
                <h2 className="text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter leading-none">
                    Gerenciar <span className="text-orange-500">Mídias</span>
                </h2>
            </div>
        </header>
    );
};

export default AdminHeader;
