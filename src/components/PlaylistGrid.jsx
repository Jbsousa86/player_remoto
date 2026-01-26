import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';

const PlaylistGrid = ({ playlist, deleteItem, getYoutubeId }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            <AnimatePresence mode="popLayout">
                {playlist.map((item, index) => (
                    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} key={item.id}
                        className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] overflow-hidden group shadow-xl"
                    >
                        <div className="aspect-video bg-black relative">
                            {item.type === 'video' ? (
                                <video src={item.url} className="w-full h-full object-cover" muted />
                            ) : item.type === 'youtube' ? (
                                <img src={`https://img.youtube.com/vi/${getYoutubeId(item.url)}/hqdefault.jpg`} className="w-full h-full object-cover" alt="" />
                            ) : (
                                <img src={item.url} className="w-full h-full object-cover" alt="" />
                            )}
                            <div className="absolute top-4 left-4 flex gap-2">
                                <div className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black border border-white/10 uppercase tracking-widest">
                                    {item.type}
                                </div>
                                <div className="bg-orange-500 px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest">
                                    #{index + 1}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 flex items-center justify-between gap-4">
                            <div className="truncate">
                                <p className="text-[10px] text-zinc-500 font-black uppercase mb-1 tracking-widest">Link da Mídia</p>
                                <p className="text-xs text-zinc-300 truncate font-medium">{item.url}</p>
                            </div>
                            <button onClick={() => deleteItem(item.id)} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all shrink-0">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default PlaylistGrid;
