import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Plus, Trash2, LogOut, Smartphone, Monitor, Play } from 'lucide-react';

const ScreenList = ({
    screens,
    selectedScreen,
    handleSelectScreen,
    isScreenOnline,
    handleDeleteScreen,
    isAddingScreen,
    setIsAddingScreen,
    newScreenData,
    setNewScreenData,
    handleAddScreen,
    handleLogout,
    isMobileMenuOpen
}) => {
    return (
        <aside className={`
            fixed md:relative top-0 left-0 z-50
            w-[85%] md:w-96 h-full border-r border-white/5 p-8 flex flex-col gap-8 bg-zinc-950/95 md:bg-zinc-950/50 backdrop-blur-3xl 
            transition-transform duration-500 ease-out md:translate-x-0
            ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl shadow-black/80' : '-translate-x-full md:translate-x-0'}
        `}>
            <div className="hidden md:flex items-center gap-3 px-2">
                <div className="w-10 h-10 bg-linear-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <LayoutDashboard className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="font-black text-xl tracking-tight leading-none text-white">Totem Cloud</h1>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Sinalização Digital</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Suas Telas</p>
                    <button onClick={() => setIsAddingScreen(true)} className="p-1.5 bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white rounded-lg transition-all">
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                <AnimatePresence>
                    {isAddingScreen && (
                        <motion.form key="add-screen-form" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        onSubmit={handleAddScreen} className="bg-white/5 p-4 rounded-2xl border border-orange-500/20 overflow-hidden"
                        >
                            <div className="space-y-3">
                                <input type="text" placeholder="ID do Totem" value={newScreenData.id} onChange={(e) => setNewScreenData({ ...newScreenData, id: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500 transition-all font-bold" required />
                                <input type="text" placeholder="Nome da Tela" value={newScreenData.name} onChange={(e) => setNewScreenData({ ...newScreenData, name: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500 transition-all font-bold" required />
                                <div className="flex gap-2">
                                    <button type="submit" className="flex-1 bg-orange-500 text-white py-2 rounded-xl text-[10px] font-black uppercase">Salvar</button>
                                <button type="button" onClick={() => setIsAddingScreen(false)} className="px-3 py-2 bg-white/10 hover:bg-white/20 text-zinc-400 rounded-xl text-[10px] font-black uppercase transition-all">X</button>
                                </div>
                            </div>
                        </motion.form>
                    )}
                </AnimatePresence>

                <div className="flex flex-col gap-3">
                    {screens.map(screen => {
                        const nowPlayingItem = screen.currentPlayingId && screen.currentPlayingId !== 'standby'
                            ? screen.playlist?.find(item => item.id === screen.currentPlayingId)
                            : null;
                        const nowPlayingLabel = screen.currentPlayingId === 'standby'
                            ? 'Standby'
                            : nowPlayingItem
                                ? `${nowPlayingItem.type === 'youtube' ? 'YouTube' : nowPlayingItem.type === 'video' ? 'Vídeo' : nowPlayingItem.type === 'image' ? 'Imagem' : nowPlayingItem.type} agora`
                                : 'Sem mídia ativa';

                        return (
                            <button key={screen.id} onClick={() => handleSelectScreen(screen)}
                                className={`w-full flex flex-col gap-2 items-start justify-between px-4 py-3 rounded-2xl transition-all group ${selectedScreen?.id === screen.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-zinc-500 hover:bg-white/5'}`}
                            >
                                <div className="w-full flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 truncate">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${isScreenOnline(screen.lastSeen) ? 'bg-emerald-500 shadow-md shadow-emerald-500/50' : 'bg-red-500'}`} />
                                        {screen.orientation === 'portrait' ? <Smartphone className="w-3 h-3 text-zinc-600" /> : <Monitor className="w-3 h-3 text-zinc-600" />}
                                        <span className="text-xs font-bold truncate">{screen.name}</span>
                                    </div>
                                    <Trash2 onClick={(e) => handleDeleteScreen(e, screen.id)} className={`w-3.5 h-3.5 ${selectedScreen?.id === screen.id ? 'text-white/40 hover:text-white' : 'text-zinc-800 hover:text-red-500'} transition-colors`} />
                                </div>
                                <div className="w-full flex items-center gap-2 px-1">
                                    <Play className="w-3 h-3 text-orange-400" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Agora</p>
                                        <p className="text-[11px] font-bold truncate text-white/90" title={nowPlayingItem?.url || nowPlayingLabel}>{nowPlayingItem ? nowPlayingItem.url : nowPlayingLabel}</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="pt-6 border-t border-white/5 space-y-2">
                <button onClick={handleLogout} className="flex items-center gap-3 px-5 py-3 text-zinc-500 hover:text-red-400 transition-all text-sm w-full font-bold">
                    <LogOut className="w-4 h-4" /> Sair
                </button>
            </div>
        </aside>
    );
};

export default ScreenList;
