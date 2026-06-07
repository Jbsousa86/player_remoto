import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { 
    Users, 
    Volume2, 
    ArrowRight, 
    RotateCcw, 
    PlusCircle, 
    Trash2, 
    Sparkles, 
    ChevronRight,
    Monitor,
    ShieldAlert
} from 'lucide-react';

export default function OperatorPanel() {
    const { screenId } = useParams();
    const [screenData, setScreenData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stationName, setStationName] = useState(() => {
        return localStorage.getItem(`operator_station_${screenId}`) || 'Guichê 1';
    });
    const [customTicket, setCustomTicket] = useState('');
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [newTicketDispensed, setNewTicketDispensed] = useState(null);
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [showWhatsappInput, setShowWhatsappInput] = useState(false);
    const dispenseTimeoutRef = useRef(null);

    // Save station name to localStorage on change
    const handleStationChange = (e) => {
        const val = e.target.value;
        setStationName(val);
        localStorage.setItem(`operator_station_${screenId}`, val);
    };

    // Listen to screen document changes in Firestore
    useEffect(() => {
        if (!screenId) return;

        const docRef = doc(db, 'screens', screenId);
        const unsubscribe = onSnapshot(docRef, (snapshot) => {
            if (snapshot.exists()) {
                setScreenData(snapshot.data());
            } else {
                setScreenData(null);
            }
            setLoading(false);
        }, (err) => {
            console.error('Error listening to screen:', err);
            setLoading(false);
        });

        return () => {
            unsubscribe();
            if (dispenseTimeoutRef.current) {
                clearTimeout(dispenseTimeoutRef.current);
            }
        };
    }, [screenId]);

    // Initial state for queue if not present
    const getQueueState = () => {
        return screenData?.queueState || {
            current: null,
            pending: [],
            counters: { Normal: 0, Preferencial: 0 },
            history: []
        };
    };

    const updateQueueStateInDb = async (newState) => {
        const docRef = doc(db, 'screens', screenId);
        await updateDoc(docRef, {
            queueState: newState
        });
    };

    // Dispense new ticket (Kiosk action)
    const handleDispenseTicket = async (type) => {
        try {
            const state = getQueueState();
            const counters = { ...state.counters };
            counters[type] = (counters[type] || 0) + 1;
            
            const prefix = type === 'Preferencial' ? 'P' : 'N';
            const num = String(counters[type]).padStart(3, '0');
            const ticketCode = `${prefix}-${num}`;

            const newTicket = {
                id: `${type}-${Date.now()}`,
                ticket: ticketCode,
                type,
                createdAt: Date.now()
            };

            const pending = [...(state.pending || []), newTicket];
            const newState = {
                ...state,
                counters,
                pending
            };

            if (dispenseTimeoutRef.current) {
                clearTimeout(dispenseTimeoutRef.current);
            }
            setShowWhatsappInput(false);
            setWhatsappPhone('');

            await updateQueueStateInDb(newState);
            setNewTicketDispensed(newTicket);
            dispenseTimeoutRef.current = setTimeout(() => {
                setNewTicketDispensed(null);
            }, 12000);
        } catch (e) {
            console.error('Erro ao dispensar senha:', e);
            alert('Falha ao gerar senha no servidor.');
        }
    };

    // Call Next Ticket (supports type filtering or auto prioritization)
    const handleCallNext = async (type = 'Auto') => {
        try {
            const state = getQueueState();
            const pending = [...(state.pending || [])];
            
            if (pending.length === 0) {
                alert('Não há senhas aguardando atendimento.');
                return;
            }

            let nextTicketIndex = -1;

            if (type === 'Auto') {
                // Prioritize Preferencial tickets
                const sortedIndices = pending.map((t, idx) => ({ t, idx })).sort((a, b) => {
                    if (a.t.type === 'Preferencial' && b.t.type !== 'Preferencial') return -1;
                    if (a.t.type !== 'Preferencial' && b.t.type === 'Preferencial') return 1;
                    return a.t.createdAt - b.t.createdAt;
                });
                nextTicketIndex = sortedIndices[0].idx;
            } else {
                // Find first ticket of the selected type (Normal or Preferencial)
                nextTicketIndex = pending.findIndex(t => t.type === type);
                if (nextTicketIndex === -1) {
                    alert(`Não há senhas do tipo "${type}" aguardando.`);
                    return;
                }
            }

            const [nextTicket] = pending.splice(nextTicketIndex, 1);

            // Add current ticket to history if exists
            const history = [...(state.history || [])];
            if (state.current) {
                history.unshift(state.current);
                if (history.length > 5) history.pop();
            }

            const newState = {
                ...state,
                current: {
                    ticket: nextTicket.ticket,
                    guiche: stationName,
                    type: nextTicket.type,
                    timestamp: Date.now()
                },
                pending,
                history
            };

            await updateQueueStateInDb(newState);
        } catch (e) {
            console.error('Erro ao chamar próxima senha:', e);
        }
    };

    // Call Specific Ticket from the waitlist
    const handleCallSpecific = async (ticket) => {
        try {
            const state = getQueueState();
            const pending = (state.pending || []).filter(t => t.id !== ticket.id);
            
            // Add current ticket to history if exists
            const history = [...(state.history || [])];
            if (state.current) {
                history.unshift(state.current);
                if (history.length > 5) history.pop();
            }

            const newState = {
                ...state,
                current: {
                    ticket: ticket.ticket,
                    guiche: stationName,
                    type: ticket.type,
                    timestamp: Date.now()
                },
                pending,
                history
            };

            await updateQueueStateInDb(newState);
        } catch (e) {
            console.error('Erro ao chamar senha específica:', e);
        }
    };

    // Recall Current Ticket
    const handleRecallCurrent = async () => {
        try {
            const state = getQueueState();
            if (!state.current) {
                alert('Nenhuma senha foi chamada ainda.');
                return;
            }

            const newState = {
                ...state,
                current: {
                    ...state.current,
                    timestamp: Date.now() // Trigger screen chime/voice
                }
            };

            await updateQueueStateInDb(newState);
        } catch (e) {
            console.error('Erro ao rechamar senha:', e);
        }
    };

    // Call Custom Ticket
    const handleCallCustom = async (e) => {
        e.preventDefault();
        if (!customTicket.trim()) return;

        try {
            const state = getQueueState();
            
            const history = [...(state.history || [])];
            if (state.current) {
                history.unshift(state.current);
                if (history.length > 5) history.pop();
            }

            const ticketUpper = customTicket.trim().toUpperCase();
            const inferredType = ticketUpper.startsWith('P') ? 'Preferencial' : 'Normal';
            const newState = {
                ...state,
                current: {
                    ticket: ticketUpper,
                    guiche: stationName,
                    type: inferredType,
                    timestamp: Date.now()
                },
                history
            };

            await updateQueueStateInDb(newState);
            setCustomTicket('');
            setShowCustomModal(false);
        } catch (e) {
            console.error('Erro ao chamar senha customizada:', e);
        }
    };

    // Clear queue data (reset)
    const handleResetQueue = async () => {
        if (!window.confirm('Deseja realmente reiniciar todas as filas e contadores de senha? Esta ação não pode ser desfeita.')) return;
        try {
            const newState = {
                current: null,
                pending: [],
                counters: { Normal: 0, Preferencial: 0 },
                history: []
            };
            await updateQueueStateInDb(newState);
        } catch (e) {
            console.error('Erro ao resetar fila:', e);
        }
    };

    // Remove single pending ticket
    const handleRemovePending = async (ticketId) => {
        try {
            const state = getQueueState();
            const pending = (state.pending || []).filter(t => t.id !== ticketId);
            const newState = {
                ...state,
                pending
            };
            await updateQueueStateInDb(newState);
        } catch (e) {
            console.error('Erro ao remover senha pendente:', e);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-zinc-400 font-bold uppercase tracking-wider text-sm">Carregando Painel...</p>
                </div>
            </div>
        );
    }

    if (!screenData) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white p-6">
                <div className="bg-zinc-900 border border-red-500/30 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
                    <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-black text-white mb-2">Tela não encontrada</h1>
                    <p className="text-zinc-400 text-sm mb-6">
                        O identificador da tela <code className="text-red-400 font-bold">{screenId}</code> não corresponde a nenhuma tela cadastrada.
                    </p>
                    <Link to="/" className="inline-block bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-6 rounded-xl transition-all w-full text-sm">
                        Voltar para a Página Inicial
                    </Link>
                </div>
            </div>
        );
    }

    // Verify if queue is enabled by Super-Admin
    if (!screenData.queueEnabled) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white p-6">
                <div className="bg-zinc-900 border border-amber-500/20 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
                    <Monitor className="w-16 h-16 text-amber-500 mx-auto mb-4 animate-pulse" />
                    <h1 className="text-2xl font-black text-white mb-2">Módulo Desativado</h1>
                    <p className="text-zinc-400 text-sm mb-6">
                        O módulo de Fila de Atendimento está desativado para a tela <span className="text-emerald-400 font-black">{screenData.name || screenId}</span>. Entre em contato com o administrador de mídia indoor para habilitá-lo.
                    </p>
                    <div className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">
                        indoor media player
                    </div>
                </div>
            </div>
        );
    }

    const queueState = getQueueState();
    const pendingTickets = queueState.pending || [];
    const calledHistory = queueState.history || [];
    const currentCall = queueState.current;

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500 selection:text-black print:hidden">
            
            {/* Header */}
            <header className="bg-zinc-900/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-white leading-none tracking-tight">Painel de Atendimento</h1>
                        <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest mt-1 block">
                            Tela: {screenData.name} ({screenId})
                        </span>
                    </div>
                </div>

                {/* Station setup */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 shrink-0">Sua Estação:</label>
                    <input 
                        type="text" 
                        value={stationName}
                        onChange={handleStationChange}
                        placeholder="Ex: Guichê 1"
                        className="bg-zinc-800 border border-white/10 rounded-xl px-4 py-2 text-sm font-black text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 w-full sm:w-40 transition-all"
                    />
                </div>
            </header>

            {/* Main Area */}
            <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Side: Calling controller (Col: 7) */}
                <section className="lg:col-span-7 flex flex-col gap-6">
                    
                    {/* Current Ticket State */}
                    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px]" />
                        
                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Senha Chamada Agora</h2>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                                <Volume2 className="w-3 h-3" /> Player Sincronizado
                            </span>
                        </div>

                        {currentCall ? (
                            <div className="flex flex-col items-center justify-center py-6 relative z-10 text-center">
                                <h3 className="text-7xl md:text-8xl font-black text-white tracking-tighter drop-shadow-2xl mb-2">
                                    {currentCall.ticket}
                                </h3>
                                <div className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-zinc-400">
                                    Encaminhada para: <span className="text-emerald-400">{currentCall.guiche}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 relative z-10 text-center">
                                <span className="text-5xl mb-4">📭</span>
                                <p className="text-sm font-bold uppercase tracking-wider">Nenhuma senha ativa</p>
                                <p className="text-xs text-zinc-600 mt-1">Clique em "Chamar Próxima" para iniciar.</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 mt-6 border-t border-white/5 pt-6 relative z-10">
                            <button
                                onClick={() => handleCallNext('Auto')}
                                disabled={pendingTickets.length === 0}
                                className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-black py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/10 cursor-pointer text-center"
                            >
                                <ArrowRight className="w-5 h-5 shrink-0" />
                                <span className="text-xs sm:text-sm font-black uppercase tracking-wider">Próxima Geral (Auto)</span>
                            </button>
                            <button
                                onClick={handleRecallCurrent}
                                disabled={!currentCall}
                                className="bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-700 disabled:cursor-not-allowed text-white font-black py-4 px-6 rounded-xl flex items-center justify-center gap-3 border border-white/5 transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <RotateCcw className="w-5 h-5 shrink-0" />
                                <span className="text-xs sm:text-sm font-black uppercase tracking-wider">Rechamar Atual</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4 relative z-10">
                            <button
                                onClick={() => handleCallNext('Normal')}
                                disabled={!pendingTickets.some(t => t.type === 'Normal')}
                                className="bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-700 disabled:cursor-not-allowed text-zinc-300 hover:text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 border border-white/5 transition-all active:scale-[0.98] cursor-pointer text-xs uppercase tracking-wider"
                            >
                                Chamar Normal
                            </button>
                            <button
                                onClick={() => handleCallNext('Preferencial')}
                                disabled={!pendingTickets.some(t => t.type === 'Preferencial')}
                                className="bg-amber-600/10 hover:bg-amber-600/20 disabled:bg-zinc-900 disabled:text-zinc-700 disabled:cursor-not-allowed text-amber-400 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 border border-amber-500/20 transition-all active:scale-[0.98] cursor-pointer text-xs uppercase tracking-wider"
                            >
                                ♿ Preferencial
                            </button>
                        </div>
                    </div>

                    {/* Dispense Ticket & Custom Ticket Buttons */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Dispensador (Kiosk) */}
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-xl">
                            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Gerador de Senhas</h2>
                            
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => handleDispenseTicket('Normal')}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-between border border-white/5 transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    <span className="flex items-center gap-3.5">
                                        <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-black flex items-center justify-center text-sm border border-emerald-500/20">N</span>
                                        <span className="text-sm font-bold text-left block">Senha Normal</span>
                                    </span>
                                    <PlusCircle className="w-5 h-5 text-zinc-500" />
                                </button>
                                <button
                                    onClick={() => handleDispenseTicket('Preferencial')}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-between border border-white/5 transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    <span className="flex items-center gap-3.5">
                                        <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 font-black flex items-center justify-center text-sm border border-amber-500/20">P</span>
                                        <span className="text-sm font-bold text-left block">Senha Preferencial</span>
                                    </span>
                                    <PlusCircle className="w-5 h-5 text-zinc-500" />
                                </button>
                            </div>

                            {/* Ticket Alert overlay */}
                            {newTicketDispensed && (
                                <div className="mt-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center animate-pulse">
                                    <p className="text-[10px] text-emerald-400 uppercase font-black tracking-widest leading-none">Senha Gerada!</p>
                                    <p className="text-2xl font-black text-white mt-1 leading-none">{newTicketDispensed.ticket}</p>
                                </div>
                            )}
                        </div>

                        {/* Custom calling / reset */}
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                            <div>
                                <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Outras Ações</h2>
                                <button
                                    onClick={() => setShowCustomModal(true)}
                                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 border border-white/5 transition-all active:scale-[0.98] cursor-pointer text-sm"
                                >
                                    <Sparkles className="w-4 h-4 text-yellow-400" /> Chamar Senha Avulsa
                                </button>
                            </div>
                            
                            <button
                                onClick={handleResetQueue}
                                className="w-full mt-4 text-xs font-bold text-red-400 hover:text-red-300 py-2 rounded-lg hover:bg-red-500/5 border border-transparent hover:border-red-500/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Zerar Fila e Contadores
                            </button>
                        </div>

                    </div>
                </section>

                {/* Right Side: Waitlist & History (Col: 5) */}
                <section className="lg:col-span-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6">

                    {/* Waitlist */}
                    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col h-[400px]">
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                                Senhas Aguardando ({pendingTickets.length})
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2 min-h-0">
                            {pendingTickets.length > 0 ? (
                                pendingTickets.map((t, idx) => {
                                    const isPref = t.type === 'Preferencial';
                                    return (
                                        <div 
                                            key={t.id || idx}
                                            className="bg-zinc-950 border border-white/5 p-3 rounded-xl flex items-center justify-between group/item"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`w-8 h-8 rounded-lg font-black flex items-center justify-center text-xs ${
                                                    isPref 
                                                        ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' 
                                                        : 'bg-zinc-800 border border-white/10 text-white'
                                                }`}>
                                                    {t.ticket}
                                                </span>
                                                <div>
                                                    <p className="text-xs font-bold text-white leading-none">{t.type} {isPref && '♿'}</p>
                                                    <span className="text-[10px] text-zinc-500">
                                                        Criada: {new Date(t.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleCallSpecific(t)}
                                                    className="p-2 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                                    title="Chamar esta senha agora"
                                                >
                                                    <Volume2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleRemovePending(t.id)}
                                                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                                    title="Remover senha"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                                    <span className="text-3xl mb-2">🎈</span>
                                    <p className="text-xs font-bold uppercase tracking-wider">Sem senhas na fila</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* History */}
                    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col h-[300px]">
                        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 shrink-0">Últimas Chamadas</h2>
                        
                        <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2 min-h-0">
                            {calledHistory.length > 0 ? (
                                calledHistory.map((h, idx) => (
                                    <div 
                                        key={idx}
                                        className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950/40 border border-white/5"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-black text-zinc-300">{h.ticket}</span>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">({h.guiche})</span>
                                        </div>
                                        <span className="text-[10px] text-zinc-500 font-medium">
                                            {new Date(h.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-700">
                                    <p className="text-xs font-bold uppercase tracking-wider">Histórico Vazio</p>
                                </div>
                            )}
                        </div>
                    </div>

                </section>
            </main>

            {/* Custom Ticket Modal */}
            {showCustomModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form 
                        onSubmit={handleCallCustom}
                        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
                    >
                        <h3 className="text-base font-black text-white mb-1">Chamar Senha Avulsa</h3>
                        <p className="text-xs text-zinc-500 mb-4">Insira qualquer código de senha ou nome que deseja chamar na TV.</p>
                        
                        <input 
                            type="text"
                            autoFocus
                            value={customTicket}
                            onChange={(e) => setCustomTicket(e.target.value)}
                            placeholder="Ex: A-500, CLINICA-1"
                            className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-lg font-black text-white focus:outline-none focus:border-emerald-500 uppercase mb-4"
                        />

                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => { setShowCustomModal(false); setCustomTicket(''); }}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={!customTicket.trim()}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-xs font-bold text-white transition-all cursor-pointer"
                            >
                                Chamar Senha
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal de Senha Gerada */}
            {newTicketDispensed && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[150] p-4 print:hidden">
                    <div className="bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />
                        
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                            <PlusCircle className="w-6 h-6 animate-bounce" />
                        </div>
                        
                        {!showWhatsappInput ? (
                            <>
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">Sua Senha foi Gerada</h3>
                                
                                <div className="text-6xl font-black text-white tracking-tighter my-6 select-all font-mono">
                                    {newTicketDispensed.ticket}
                                </div>
                                
                                <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-6 ${
                                    newTicketDispensed.type === 'Preferencial' 
                                        ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' 
                                        : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                }`}>
                                    {newTicketDispensed.type === 'Preferencial' ? 'Atendimento Preferencial ♿' : 'Atendimento Normal'}
                                </span>
                                
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => window.print()}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-emerald-600/20 text-sm uppercase tracking-wider"
                                    >
                                        Imprimir Senha 🖨️
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (dispenseTimeoutRef.current) {
                                                clearTimeout(dispenseTimeoutRef.current);
                                                dispenseTimeoutRef.current = null;
                                            }
                                            setShowWhatsappInput(true);
                                        }}
                                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer text-sm uppercase tracking-wider"
                                    >
                                        Enviar por WhatsApp 💬
                                    </button>
                                    <button
                                        onClick={() => setNewTicketDispensed(null)}
                                        className="w-full bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-zinc-300 font-bold py-3 px-6 rounded-xl transition-all active:scale-[0.98] cursor-pointer text-sm uppercase tracking-wider"
                                    >
                                        Fechar
                                    </button>
                                </div>

                                <div className="mt-6 text-[10px] text-zinc-500">
                                    Este aviso fechará automaticamente em breve.
                                </div>
                            </>
                        ) : (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const formattedPhone = whatsappPhone.replace(/\D/g, '');
                                    if (!formattedPhone) return;
                                    const emoji = newTicketDispensed.type === 'Preferencial' ? '♿ Preferencial' : 'Normal';
                                    const dateStr = new Date(newTicketDispensed.createdAt).toLocaleString('pt-BR');
                                    const localName = screenData?.name || 'Recepção';

                                    const message = `━━━━━━━━━━━━━━━━━━━━━━━━\n🎫  *COMPROVANTE DE SENHA*  🎫\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n*Senha:*  *${newTicketDispensed.ticket}*\n*Atendimento:*  ${emoji}\n\n*Emissão:*  ${dateStr}\n*Local:*  ${localName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n_Acompanhe no painel de TV quando sua senha for chamada!_`;
                                    const whatsappUrl = `https://api.whatsapp.com/send?phone=55${formattedPhone}&text=${encodeURIComponent(message)}`;
                                    window.open(whatsappUrl, '_blank');
                                    setNewTicketDispensed(null);
                                    setShowWhatsappInput(false);
                                    setWhatsappPhone('');
                                }}
                                className="flex flex-col items-center"
                            >
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Enviar por WhatsApp</h3>
                                <p className="text-[11px] text-zinc-500 mb-6 text-center leading-normal">
                                    Insira o número do celular do cliente para enviar a senha <strong className="text-white font-black">{newTicketDispensed.ticket}</strong>.
                                </p>
                                
                                <input
                                    type="tel"
                                    autoFocus
                                    value={whatsappPhone}
                                    onChange={(e) => setWhatsappPhone(e.target.value)}
                                    placeholder="Ex: 11999999999"
                                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3.5 text-lg font-black text-center text-white focus:outline-none focus:border-emerald-500 mb-6"
                                />
                                
                                <div className="flex flex-col gap-3 w-full">
                                    <button
                                        type="submit"
                                        disabled={!whatsappPhone.replace(/\D/g, '')}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-black py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer text-sm uppercase tracking-wider"
                                    >
                                        Enviar Mensagem 🚀
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowWhatsappInput(false)}
                                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 px-6 rounded-xl transition-all active:scale-[0.98] cursor-pointer text-sm uppercase tracking-wider"
                                    >
                                        Voltar
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Elemento Oculto para Impressão */}
            {newTicketDispensed && (
                <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:text-black print:p-6 print:text-center print:font-mono">
                    <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>FILA DE ATENDIMENTO</div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px' }}>{screenData?.name}</div>
                    <hr style={{ borderTop: '1px dashed #000', margin: '15px 0' }} />
                    <div style={{ fontSize: '48px', fontWeight: '900', margin: '20px 0', letterSpacing: '-2px' }}>
                        {newTicketDispensed.ticket}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '20px' }}>
                        {newTicketDispensed.type === 'Preferencial' ? 'ATENDIMENTO PREFERENCIAL' : 'ATENDIMENTO NORMAL'}
                    </div>
                    <hr style={{ borderTop: '1px dashed #000', margin: '15px 0' }} />
                    <div style={{ fontSize: '11px', marginTop: '15px' }}>
                        Emissão: {new Date(newTicketDispensed.createdAt).toLocaleString('pt-BR')}
                    </div>
                    <div style={{ fontSize: '10px', marginTop: '10px', color: '#333' }}>
                        Acompanhe no painel de TV quando sua senha for chamada.
                    </div>
                </div>
            )}

        </div>
    );
}
