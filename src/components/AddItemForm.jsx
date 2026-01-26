import React from 'react';

const AddItemForm = ({ newItem, setNewItem, addItem, isSyncing }) => {
    return (
        <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl mb-12">
            <form onSubmit={addItem} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                    <div className="lg:col-span-12">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Link da Mídia</label>
                        <input type="text" value={newItem.url} onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                            placeholder="Cole aqui a URL da Imagem, Vídeo ou YouTube"
                            className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none text-white font-medium" required />
                    </div>

                    <div className="lg:col-span-4">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Tipo</label>
                        <select value={newItem.type} onChange={(e) => {
                            const val = e.target.value;
                            setNewItem({ ...newItem, type: val, duration: (val === 'video' || val === 'youtube') ? 0 : 10 });
                        }} className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-bold text-white appearance-none cursor-pointer">
                            <option value="image">🖼️ Imagem</option>
                            <option value="video">🎥 Vídeo Direto</option>
                            <option value="youtube">📺 YouTube</option>
                        </select>
                    </div>

                    <div className="lg:col-span-3">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Exibição (Seg)</label>
                        <input type="number" value={newItem.duration} onChange={(e) => setNewItem({ ...newItem, duration: parseInt(e.target.value) || 0 })}
                            className={`w-full bg-black border ${newItem.duration === 0 ? 'border-emerald-500/50 text-emerald-500' : 'border-zinc-800 text-white'} rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-black`} min="0" />
                    </div>

                    <div className="lg:col-span-3">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Encaixe</label>
                        <select value={newItem.fitMode} onChange={(e) => setNewItem({ ...newItem, fitMode: e.target.value })}
                            className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-bold text-white cursor-pointer appearance-none"
                        >
                            <option value="cover">✂️ Preencher (Cortar)</option>
                            <option value="contain">🖼️ Ajustar (Inteira)</option>
                            <option value="smart">🚀 Preenchimento Inteligente</option>
                        </select>
                    </div>

                    <div className="lg:col-span-3">
                        <button type="submit" disabled={isSyncing || !newItem.url} className="w-full h-[66px] bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-orange-500/20 active:scale-95 uppercase tracking-widest disabled:opacity-50 text-xs">
                            Adicionar
                        </button>
                    </div>
                </div>
                {newItem.duration === 0 && (
                    <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider ml-1">✨ Mídia configurada para durar até o final automaticamente.</p>
                )}
            </form>
        </div>
    );
};

export default AddItemForm;
