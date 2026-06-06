import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ChevronLeft, ChevronRight, Eye, EyeOff, Play } from 'lucide-react';

const PlaylistGrid = ({ playlist, deleteItem, moveItem, toggleItemActive, getYoutubeId, currentPlayingId }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 xl:gap-8">
            <AnimatePresence mode="popLayout">
                {playlist.map((item, index) => {
                    if (!item) return null;
                    const isPlayingNow = item.id && item.id === currentPlayingId;
                    return (
                    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} key={item.id ? `id-${item.id}-${index}` : `idx-${index}`}
                        className={`bg-white/5 border ${item.isActive === false ? 'border-white/5 opacity-40 grayscale' : (isPlayingNow ? 'border-orange-500 shadow-2xl shadow-orange-500/20 ring-1 ring-orange-500' : 'border-white/10')} rounded-2xl overflow-hidden group ${!isPlayingNow ? 'shadow-xl' : ''} transition-all`}
                    >
                        <div className="aspect-video bg-black relative">
                            {item.type === 'video' ? (
                                <video src={item.url} className={`w-full h-full ${item.fitMode === 'cover' ? 'object-cover' : 'object-contain'}`} muted />
                            ) : item.type === 'youtube' ? (
                                <img src={`https://img.youtube.com/vi/${getYoutubeId(item.url)}/hqdefault.jpg`} className="w-full h-full object-cover" alt="" />
                            ) : item.type === 'web' ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-zinc-500">
                                    <span className="text-4xl mb-2">🌐</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Website</span>
                                </div>
                            ) : item.type === 'news' ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-pink-500">
                                    <span className="text-4xl mb-2">📰</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Notícias</span>
                                </div>
                            ) : item.type === 'loterias' ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-emerald-500">
                                    <span className="text-4xl mb-2">🎰</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loterias Caixa</span>
                                </div>
                            ) : (
                                <img src={item.url} className={`w-full h-full ${item.fitMode === 'cover' ? 'object-cover' : 'object-contain'}`} alt="" />
                            )}
                            <div className="absolute top-4 left-4 flex gap-2">
                                <div className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black border border-white/10 uppercase tracking-widest">
                                    {item.type}
                                </div>
                                <div className="bg-orange-500 px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest">
                                    #{index + 1}
                                </div>
                            </div>
                            {item.block && (
                                <div className="absolute top-4 right-4 bg-purple-600/90 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black border border-white/10 text-white uppercase tracking-widest shadow-lg shadow-purple-900/50">
                                    📁 {item.block}
                                </div>
                            )}
                            {isPlayingNow && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-500/90 backdrop-blur-sm text-white text-[10px] font-black px-4 py-2 rounded-full shadow-2xl z-30 uppercase tracking-widest flex items-center gap-2 animate-pulse border border-orange-400">
                                    <Play className="w-3 h-3" fill="currentColor" /> Reproduzindo
                                </div>
                            )}
                        </div>
                        <div className="p-5 flex flex-col gap-4">
                            <div className="truncate">
                                <p className="text-[10px] text-zinc-500 font-black uppercase mb-1 tracking-widest">
                                    {item.type === 'loterias' ? 'Jogo da Caixa' : 'Link da Mídia'}
                                </p>
                                <p className="text-xs text-zinc-300 truncate font-medium" title={item.url}>
                                    {item.type === 'loterias' ? (
                                        item.url === 'todas' ? '🔄 Todas as Loterias' :
                                        item.url === 'megasena' ? '🟢 Mega-Sena' :
                                        item.url === 'lotofacil' ? '🟣 Lotofácil' :
                                        item.url === 'quina' ? '🔵 Quina' :
                                        item.url === 'lotomania' ? '🟠 Lotomania' : item.url
                                    ) : item.url}
                                </p>
                            </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
                                <button onClick={() => moveItem(index, -1)} disabled={index === 0} className={`p-1.5 rounded-lg transition-all ${index === 0 ? 'opacity-30 cursor-not-allowed text-zinc-600' : 'hover:bg-white/10 text-zinc-300 hover:text-white'}`}>
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <div className="text-[10px] font-black text-zinc-500 px-1 uppercase tracking-widest">Mover</div>
                                <button onClick={() => moveItem(index, 1)} disabled={index === playlist.length - 1} className={`p-1.5 rounded-lg transition-all ${index === playlist.length - 1 ? 'opacity-30 cursor-not-allowed text-zinc-600' : 'hover:bg-white/10 text-zinc-300 hover:text-white'}`}>
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                <button onClick={() => toggleItemActive(item.id, item.isActive)} title={item.isActive === false ? "Ativar Mídia" : "Desativar Mídia"} className={`p-2.5 rounded-xl transition-all shrink-0 ${item.isActive === false ? 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}>
                                        {item.isActive === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                    <button 
                                        onClick={() => { if (window.confirm('Tem certeza que deseja excluir esta mídia definitivamente da playlist?')) deleteItem(item.id); }} 
                                        title="Excluir Mídia" 
                                        className="p-2.5 bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white rounded-xl transition-all shrink-0 shadow-lg hover:shadow-red-500/50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

export default PlaylistGrid;
