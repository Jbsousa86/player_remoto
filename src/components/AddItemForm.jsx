import React, { useState, useEffect } from 'react';

const AddItemForm = ({ newItem, setNewItem, handleUrlChange, addItem, broadcastItem, isSyncing, handleFileUpload, isUploading, uploadProgress }) => {
    const [flash, setFlash] = useState(false);
    // Trigger flash when URL changes (auto-detection)
    useEffect(() => {
        if (newItem.url) {
            setFlash(true);
            const timer = setTimeout(() => setFlash(false), 600);
            return () => clearTimeout(timer);
        }
    }, [newItem.url]);
    // Determine border color: flash overrides type-specific colors
    const borderColor = flash ? 'border-yellow-400' : (
        newItem.type === 'image' ? 'border-blue-500/50' :
        newItem.type === 'video' ? 'border-red-500/50' :
        newItem.type === 'youtube' ? 'border-purple-500/50' :
        newItem.type === 'web' ? 'border-teal-500/50' :
        'border-white/10'
    );
    return (
        <div className="bg-white/5 border border-white/5 p-6 lg:p-8 rounded-3xl shadow-2xl mb-12">
            <form onSubmit={addItem} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                    <div className="lg:col-span-12">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Link da Mídia ou Upload</label>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <input type="text" value={newItem.url} onChange={(e) => handleUrlChange(e.target.value)}
                                placeholder="Cole aqui a URL da Imagem, Vídeo ou YouTube"
                                className={`flex-1 w-full bg-black/40 ${borderColor} border rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none text-white font-medium disabled:opacity-50`} 
                                required={!isUploading} 
                                disabled={isUploading} 
                            />
                            <div className="shrink-0 flex">
                                <input type="file" id="media-upload" accept="video/*,image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} multiple />
                                <label htmlFor="media-upload" className={`w-full sm:w-auto cursor-pointer flex items-center justify-center px-8 py-5 rounded-2xl font-black uppercase tracking-widest transition-all text-xs border ${isUploading ? 'bg-white/5 border-white/10 text-zinc-400' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white shadow-xl hover:scale-105 active:scale-95'}`}>
                                    {isUploading ? `Enviando ${uploadProgress}%` : '📁 Fazer Upload'}
                                </label>
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                                newItem.type === 'image' ? 'bg-blue-600 text-white' :
                                newItem.type === 'video' ? 'bg-red-600 text-white' :
                                newItem.type === 'youtube' ? 'bg-purple-600 text-white' :
                                newItem.type === 'web' ? 'bg-teal-600 text-white' :
                                'bg-gray-600 text-white'
                            }`}>Tipo: {newItem.type}</span>
                            {newItem.duration === 0 && (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-emerald-600 text-white">Duração ilimitada</span>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-3">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Tipo</label>
                        <select value={newItem.type} onChange={(e) => {
                            const val = e.target.value;
                            setNewItem({ ...newItem, type: val, duration: (val === 'video' || val === 'youtube') ? 0 : 10 });
                        }} className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-bold text-white appearance-none cursor-pointer">
                            <option value="image">🖼️ Imagem</option>
                            <option value="video">🎥 Vídeo Direto</option>
                            <option value="youtube">📺 YouTube</option>
                            <option value="web">🌐 Página da Web</option>
                        </select>
                    </div>

                    <div className="lg:col-span-3">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Exibição (Seg)</label>
                        <input type="number" value={newItem.duration} onChange={(e) => setNewItem({ ...newItem, duration: parseInt(e.target.value) || 0 })}
                            className={`w-full bg-black/40 border ${newItem.duration === 0 ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/5' : 'border-white/10 text-white'} rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-black`} min="0" />
                    </div>

                    <div className="lg:col-span-3">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Encaixe</label>
                        <select value={newItem.fitMode} onChange={(e) => setNewItem({ ...newItem, fitMode: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-bold text-white cursor-pointer appearance-none"
                        >
                            <option value="cover">✂️ Preencher (Cortar)</option>
                            <option value="contain">🖼️ Ajustar (Inteira)</option>
                            <option value="smart">🚀 Preenchimento Inteligente</option>
                        </select>
                    </div>

                    <div className="lg:col-span-3">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Grupo / Bloco (Opcional)</label>
                        <input type="text" value={newItem.block || ''} onChange={(e) => setNewItem({ ...newItem, block: e.target.value })}
                            placeholder="Ex: Promoções..."
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-bold text-white" />
                    </div>

                    <div className="lg:col-span-12 flex flex-col sm:flex-row gap-4 mt-2">
                        <button type="button" onClick={broadcastItem} disabled={isSyncing || !newItem.url} title="Adicionar esta mídia em TODOS os totens" className="flex-1 h-16 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-red-500/20 active:scale-95 uppercase tracking-widest disabled:opacity-50 text-xs px-4">
                            📡 Adicionar em Todos
                        </button>
                        <button type="submit" disabled={isSyncing || !newItem.url} title="Adicionar apenas no totem selecionado" className="flex-1 h-16 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-orange-500/20 active:scale-95 uppercase tracking-widest disabled:opacity-50 text-xs px-4">
                            Adicionar Neste Totem
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
