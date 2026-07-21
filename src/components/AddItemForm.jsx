import React, { useState, useEffect } from 'react';

const AddItemForm = ({ newItem, setNewItem, handleUrlChange, addItem, broadcastItem, isSyncing, handleFileUpload, isUploading, uploadProgress, uploadStatusText }) => {
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
        newItem.type === 'news' ? 'border-pink-500/50' :
        newItem.type === 'loterias' ? 'border-emerald-500/50' :
        'border-slate-300'
    );
    return (
        <div className="bg-white shadow-sm border border-slate-200 p-6 lg:p-8 rounded-3xl shadow-2xl mb-12">
            <form onSubmit={addItem} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                    <div className="lg:col-span-12">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">
                            {newItem.type === 'loterias' ? 'Jogo da Caixa' : 'Link da Mídia ou Upload'}
                        </label>
                        <div className="flex flex-col sm:flex-row gap-4">
                            {newItem.type === 'loterias' ? (
                                <select 
                                    value={newItem.url} 
                                    onChange={(e) => {
                                        const selectedUrl = e.target.value;
                                        const dur = selectedUrl === 'todas' ? 32 : 10;
                                        setNewItem({ ...newItem, url: selectedUrl, duration: dur });
                                    }}
                                    className={`flex-1 w-full bg-white shadow-sm ${borderColor} border rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none text-zinc-900 font-bold appearance-none cursor-pointer`}
                                    required
                                >
                                    <option value="todas">🔄 Todas (Mega-Sena, Lotofácil, Quina, Lotomania)</option>
                                    <option value="megasena">🟢 Mega-Sena</option>
                                    <option value="lotofacil">🟣 Lotofácil</option>
                                    <option value="quina">🔵 Quina</option>
                                    <option value="lotomania">🟠 Lotomania</option>
                                </select>
                            ) : (
                                <input type="text" value={newItem.url} onChange={(e) => handleUrlChange(e.target.value)}
                                    placeholder="Cole a URL da Imagem, Vídeo, YouTube, Live ou RSS de Notícias"
                                    className={`flex-1 w-full bg-white shadow-sm ${borderColor} border rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none text-zinc-900 font-medium disabled:opacity-50`} 
                                    required={!isUploading} 
                                    disabled={isUploading} 
                                />
                            )}
                            {newItem.type !== 'loterias' && (
                                <div className="shrink-0 flex">
                                    <input type="file" id="media-upload" accept="video/*,image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} multiple />
                                    <label htmlFor="media-upload" className={`w-full sm:w-auto cursor-pointer flex flex-col items-center justify-center px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all text-xs border ${isUploading ? 'bg-white shadow-sm border-slate-300 text-zinc-500' : 'bg-white shadow-sm hover:bg-slate-100 border-slate-300 text-zinc-900 shadow-xl hover:scale-105 active:scale-95'}`}>
                                        {isUploading ? (
                                            <>
                                                <span>{uploadStatusText || 'Processando...'}</span>
                                                <span className="text-[10px] mt-1 text-orange-500">{uploadProgress}%</span>
                                            </>
                                        ) : '📁 Fazer Upload'}
                                    </label>
                                </div>
                            )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                                newItem.type === 'image' ? 'bg-blue-600 text-white' :
                                newItem.type === 'video' ? 'bg-red-600 text-white' :
                                newItem.type === 'youtube' ? 'bg-purple-600 text-white' :
                                newItem.type === 'web' ? 'bg-teal-600 text-white' :
                                newItem.type === 'news' ? 'bg-pink-600 text-white' :
                                newItem.type === 'loterias' ? 'bg-emerald-600 text-white' :
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
                            const defaultUrl = val === 'loterias' ? 'todas' : (val === 'news' ? 'https://g1.globo.com/rss/g1/to/tocantins/' : '');
                            const defaultDuration = val === 'loterias' ? 32 : ((val === 'video' || val === 'youtube') ? 0 : 10);
                            setNewItem({ ...newItem, type: val, url: defaultUrl, duration: defaultDuration });
                        }} className="w-full bg-white shadow-sm border border-slate-300 rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-bold text-zinc-900 appearance-none cursor-pointer">
                            <option value="image">🖼️ Imagem</option>
                            <option value="video">🎥 Vídeo Direto</option>
                            <option value="youtube">📺 YouTube</option>
                            <option value="web">🌐 Página da Web</option>
                            <option value="news">📰 Notícias (RSS)</option>
                            <option value="loterias">🎰 Loterias Caixa</option>
                        </select>
                    </div>

                    <div className="lg:col-span-3">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Exibição (Seg)</label>
                        <input type="number" value={newItem.duration} onChange={(e) => setNewItem({ ...newItem, duration: parseInt(e.target.value) || 0 })}
                             className={`w-full bg-white shadow-sm border ${newItem.duration === 0 ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/5' : 'border-slate-300 text-zinc-900'} rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-black`} min="0" />
                    </div>

                    <div className="lg:col-span-3">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Encaixe</label>
                        <select value={newItem.fitMode} onChange={(e) => setNewItem({ ...newItem, fitMode: e.target.value })}
                            className="w-full bg-white shadow-sm border border-slate-300 rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-bold text-zinc-900 cursor-pointer appearance-none"
                        >
                            <option value="cover">✂️ Preencher (Cortar)</option>
                            <option value="contain">🖼️ Ajustar (Inteira)</option>
                            <option value="smart">🚀 Preenchimento Inteligente</option>
                            <option value="fill">↔️ Esticar (Sem Cortes/Distorcer)</option>
                        </select>
                    </div>

                    <div className="lg:col-span-3">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase mb-3 ml-1 tracking-[0.2em]">Grupo / Bloco (Opcional)</label>
                        <input type="text" value={newItem.block || ''} onChange={(e) => setNewItem({ ...newItem, block: e.target.value })}
                            placeholder="Ex: Promoções..."
                            className="w-full bg-white shadow-sm border border-slate-300 rounded-2xl px-6 py-5 focus:border-orange-500 transition-all outline-none font-bold text-zinc-900" />
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
