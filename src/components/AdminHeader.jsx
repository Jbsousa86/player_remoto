import React from 'react';
import { RefreshCw, Monitor, Smartphone } from 'lucide-react';

const AdminHeader = ({ selectedScreen, isScreenOnline, handleForceReload, handleToggleOrientation, isSyncing }) => {
    return (
        <header className="mb-12 flex flex-col md:flex-row justify-between items-start gap-8 mr-8">
            <div>
                <div className={`inline-flex items-center gap-2 ${isScreenOnline(selectedScreen.lastSeen) ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'} text-[10px] font-black px-3 py-1 rounded-full border mb-4 uppercase tracking-widest`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isScreenOnline(selectedScreen.lastSeen) ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                    {selectedScreen.name} • {isScreenOnline(selectedScreen.lastSeen) ? 'ONLINE' : 'OFFLINE'}
                </div>
                <button
                    onClick={handleForceReload}
                    title="Forçar recarregamento da página no Totem"
                    className="ml-3 inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[9px] font-black px-3 py-1 rounded-full border border-zinc-700 transition-all uppercase tracking-widest active:scale-95"
                >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    Reiniciar Player
                </button>
                <button
                    onClick={handleToggleOrientation}
                    title="Alternar entre Horizontal e Vertical"
                    className="ml-2 inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[9px] font-black px-3 py-1 rounded-full border border-zinc-700 transition-all uppercase tracking-widest active:scale-95"
                >
                    {selectedScreen.orientation === 'portrait' ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                    {selectedScreen.orientation === 'portrait' ? 'MODO VERTICAL' : 'MODO HORIZONTAL'}
                </button>
                <h2 className="text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter leading-none">
                    Gerenciar <span className="text-orange-500">Mídias</span>
                </h2>
            </div>
        </header>
    );
};

export default AdminHeader;
