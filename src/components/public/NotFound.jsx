import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search, School, BookX } from 'lucide-react';

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-6">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-emerald-300/10 rounded-full blur-2xl"></div>
            </div>

            <div className="relative z-10 text-center max-w-lg">
                {/* School Icon */}
                <div className="mb-6 flex justify-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-200 dark:shadow-emerald-900/30">
                        <BookX size={40} className="text-white" />
                    </div>
                </div>

                {/* 404 Number */}
                <div className="relative mb-6">
                    <h1 className="text-[120px] md:text-[160px] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 leading-none select-none">
                        404
                    </h1>
                </div>

                {/* Message */}
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tight">
                    Halaman Tidak Ditemukan
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm md:text-base">
                    Maaf, halaman yang Anda cari tidak tersedia.
                    <br />
                    <span className="text-slate-400 dark:text-slate-500">Silakan kembali ke halaman utama.</span>
                </p>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="group flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-bold text-sm uppercase tracking-wide transition-all border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        Kembali
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="group flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-sm uppercase tracking-wide transition-all shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30"
                    >
                        <Home size={18} className="group-hover:scale-110 transition-transform" />
                        Beranda
                    </button>
                </div>

                {/* Info box */}
                <div className="mt-12 p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-emerald-100 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                        <School size={14} />
                        <span>Kembali ke halaman utama untuk informasi pendaftaran</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
