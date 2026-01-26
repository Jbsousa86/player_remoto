import React, { useState } from 'react';
import { Lock, LayoutDashboard, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminLogin = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        // Use a senha da variável de ambiente ou o padrão admin123 para desenvolvimento
        const adminPass = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

        if (password === adminPass) {
            onLogin(true);
            sessionStorage.setItem('admin_auth', 'true');
        } else {
            setError(true);
            setTimeout(() => setError(false), 2000);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-600/10 blur-[120px] rounded-full" />
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-orange-600/5 blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full bg-zinc-900/40 border border-zinc-800/50 p-10 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl relative z-10"
            >
                <div className="flex justify-center mb-10">
                    <div className="w-16 h-16 
                     from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                </div>

                <div className="text-center mb-10">
                    <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Área Restrita</h1>
                    <p className="text-zinc-500 font-medium">Digite a senha para acessar o painel do totem.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative group">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Digite a senha"
                            className={`w-full bg-black/50 border-2 ${error ? 'border-red-500/50' : 'border-zinc-800 group-focus-within:border-orange-500/50'} rounded-2xl px-6 py-4 outline-none transition-all text-white placeholder:text-zinc-700 font-bold text-center tracking-widest`}
                            required
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-orange-600/20 flex items-center justify-center gap-2 group active:scale-95"
                    >
                        Acessar Painel <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </form>

                {error && (
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-center mt-6 font-bold text-sm"
                    >
                        Senha incorreta. Tente novamente.
                    </motion.p>
                )}
            </motion.div>
        </div>
    );
};

export default AdminLogin;
