import React, { useState } from 'react';
import { Taxpayer, User } from '../types';
import { User as UserIcon, ShieldCheck, ArrowRight } from 'lucide-react';

interface PortalLoginProps {
    onLogin: (user: User) => void;
    taxpayers: Taxpayer[];
}

export const PortalLogin: React.FC<PortalLoginProps> = ({ onLogin, taxpayers }) => {
    const [docId, setDocId] = useState('');
    const [taxpayerNum, setTaxpayerNum] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const foundTp = taxpayers.find(t => t.docId === docId && t.taxpayerNumber === taxpayerNum);

        if (foundTp) {
            console.log("Login Success:", foundTp);
            // Create a session user for the taxpayer
            const sessionUser: User = {
                username: foundTp.docId,
                name: foundTp.name,
                role: 'CONTRIBUYENTE',
            };
            onLogin(sessionUser);
        } else {
            setError('Datos no encontrados. Verifique su Cédula y N° de Contribuyente.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden" style={{
            backgroundImage: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)'
        }}>
            {/* Decoration */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500 blur-[120px]"></div>
            </div>

            <div className="w-full max-w-lg z-10 animate-fade-in flex flex-col items-center">
                {/* Logo Area - Responsive Scaling */}
                <div className="text-center mb-2 md:mb-4 px-4">
                    <div className="inline-block relative mb-1 md:mb-2">
                        <div className="absolute -inset-4 bg-white/5 rounded-full blur-2xl"></div>
                        <img 
                            src={`${import.meta.env.BASE_URL}logo-municipio.png`} 
                            className="h-48 sm:h-64 md:h-80 w-auto object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative transition-transform duration-500" 
                            alt="Escudo Municipio de Almirante" 
                        />
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight uppercase mb-0">
                        Sistema de <span className="text-emerald-400">Cobro Digital</span>
                    </h1>
                    <p className="text-slate-300 text-sm sm:text-base font-medium tracking-wide">Municipio de Almirante</p>
                </div>

                {/* Form - Glassmorphism style - Responsive Padding */}
                <div className="w-full bg-white/10 backdrop-blur-md rounded-2xl md:rounded-3xl p-5 sm:p-6 md:p-8 border border-white/10 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
                        <div className="text-center mb-3">
                            <p className="text-emerald-50 text-[10px] sm:text-xs md:text-sm font-medium opacity-80">
                                Acceda para gestionar sus tributos.
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-500/20 text-red-200 p-2.5 rounded-xl text-[10px] sm:text-xs text-center border border-red-500/30 animate-shake">
                                {error}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[9px] sm:text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1 ml-1">Identificación (Cédula o RUC)</label>
                                <div className="relative group">
                                    <UserIcon className="absolute left-4 top-3 text-slate-400 group-focus-within:text-emerald-400 transition-colors" size={16} />
                                    <input
                                        type="text"
                                        value={docId}
                                        onChange={(e) => setDocId(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl md:rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-white text-xs sm:text-sm font-medium"
                                        placeholder="Cédula o RUC"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[9px] sm:text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1 ml-1">N° de Contribuyente</label>
                                <div className="relative group">
                                    <ShieldCheck className="absolute left-4 top-3 text-slate-400 group-focus-within:text-emerald-400 transition-colors" size={16} />
                                    <input
                                        type="text"
                                        value={taxpayerNum}
                                        onChange={(e) => setTaxpayerNum(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl md:rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-white text-xs sm:text-sm font-medium"
                                        placeholder="Número de Contribuyente"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 sm:py-4 rounded-xl md:rounded-2xl shadow-lg shadow-emerald-900/40 transition-all flex justify-center items-center group text-sm sm:text-base tracking-wider active:scale-95 mt-2"
                        >
                            INGRESAR AL PORTAL <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform" size={18} />
                        </button>
                    </form>
                </div>

                <div className="text-center mt-4 md:mt-6">
                    <p className="text-slate-500 text-[9px] sm:text-[10px] font-bold tracking-widest uppercase opacity-60">
                        © {new Date().getFullYear()} Plataforma Digital • Municipio de Almirante
                    </p>
                </div>
            </div>
        </div>
    );
};
