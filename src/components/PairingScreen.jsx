import React, { useState, useEffect } from 'react';
import { Tv, Cpu, Wifi, Key, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { syncService } from '../lib/syncService';

const PairingScreen = ({ onPair }) => {
    const [pin, setPin] = useState('');
    const [pairingCode] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());
    const [status, setStatus] = useState('Aguardando...');

    // QR Code URL for the admin (passes the code to the admin panel)
    const pairUrl = `${window.location.origin}/admin/pair?code=${pairingCode}`;

    // 1. Auto-Pairing Check (Listen to the generated pairingCode)
    useEffect(() => {
        // If an admin adds this pairingCode as a screen, we can detect it
        const unsubscribe = syncService.subscribeToScreen(pairingCode, (data) => {
            if (data) {
                // If the screen exists in Firebase, it means it's been registered by an admin
                onPair(pairingCode);
            }
        });
        return () => unsubscribe();
    }, [pairingCode, onPair]);

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (pin.length < 3) return;
        setStatus('Verificando PIN...');
        // In this system, the PIN is simply the Screen ID
        // We'll trust the user and store the ID they typed
        onPair(pin);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl w-full grid grid-cols-1 md:grid-cols-2 bg-zinc-900 shadow-2xl rounded-[3rem] overflow-hidden border border-zinc-800"
            >
                {/* Visual / QR Section */}
                <div className="bg-orange-500 p-12 flex flex-col items-center justify-center text-center">
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl mb-8 transform hover:scale-105 transition-transform duration-500">
                        <QRCodeSVG value={pairUrl} size={160} level="H" />
                    </div>
                    <h3 className="text-black font-black text-2xl uppercase tracking-tighter mb-2">Pareamento Rápido</h3>
                    <p className="text-orange-950 font-bold text-sm leading-tight opacity-80">Aponte a câmera para configurar este dispositivo instantaneamente.</p>
                </div>

                {/* PIN / Code Section */}
                <div className="p-12 flex flex-col justify-center bg-zinc-900">
                    <div className="mb-10">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 mb-4 block">ID deste Totem</span>
                        <div className="text-5xl font-mono font-black tracking-widest text-white mb-2">
                            {pairingCode}
                        </div>
                        <p className="text-zinc-500 text-xs font-medium italic">Compartilhe este código com o administrador.</p>
                    </div>

                    <div className="h-px bg-zinc-800 w-full mb-10" />

                    <form onSubmit={handleManualSubmit} className="space-y-6">
                        <div>
                            <label className="text-[10px] font-bold uppercase text-zinc-400 mb-3 block ml-1">Já tem um ID de Tela?</label>
                            <div className="relative">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="text"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    placeholder="Digite o ID da Tela"
                                    className="w-full bg-black border-2 border-zinc-800 rounded-2xl py-4 pl-12 pr-4 font-black uppercase tracking-widest focus:border-orange-500 outline-none transition-all placeholder:text-zinc-700 placeholder:tracking-normal placeholder:font-bold"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-white text-black font-black py-5 rounded-2xl flex items-center justify-center gap-2 hover:bg-orange-500 hover:text-white transition-all active:scale-[0.98]"
                        >
                            CONECTAR TOTEM <ChevronRight className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            </motion.div>

            <div className="mt-12 flex items-center gap-6 text-zinc-600">
                <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">WIFI ONLINE</span>
                </div>
                <div className="w-1 h-1 bg-zinc-800 rounded-full" />
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{status}</span>
                </div>
            </div>
        </div>
    );
};

export default PairingScreen;
