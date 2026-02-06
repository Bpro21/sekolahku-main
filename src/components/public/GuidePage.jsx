import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ClipboardList, UserCheck, FileText, Users, Megaphone, ArrowRight } from 'lucide-react';
import PublicHeader from './PublicHeader';
import { supabase } from '../../config/supabase';

const GuidePage = ({ user: propUser, isAdmin }) => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [settings, setSettings] = useState(null);
    const [user, setUser] = useState(propUser || null);

    useEffect(() => {
        const fetchData = async () => {
            const { data } = await supabase.from('app_settings').select('*').eq('id', 'main').single();
            if (data) setSettings(data);

            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user || null);
        };
        fetchData();

        window.scrollTo(0, 0);
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const steps = [
        {
            icon: ClipboardList,
            title: "Isi Biodata Online",
            desc: "Langkah pertama adalah mengisi formulir pendaftaran secara online. Pastikan data diri Anda akurat.",
            details: [
                "Buka menu pendaftaran di halaman utama",
                "Siapkan NISN, NIK, dan Email aktif",
                "Upload dokumen pendukung (KK, Akta)"
            ]
        },
        {
            icon: UserCheck,
            title: "Verifikasi Berkas",
            desc: "Panitia PPDB akan memverifikasi kelengkapan data administratif Anda dalam 1x24 jam.",
            details: [
                "Proses otomatis oleh sistem & manual",
                "Notifikasi status via WhatsApp",
                "Perbaikan data jika ada kekurangan"
            ]
        },
        {
            icon: FileText,
            title: "Ujian Potensi Akademik",
            desc: "Ikuti tes seleksi untuk mengukur kemampuan dasar dan penempatan kelas.",
            details: [
                "Jadwal ujian dikirim ke Dashboard",
                "Materi: Matematika, Bahasa, Umum",
                "Opsi ujian Daring atau Luring"
            ]
        },
        {
            icon: Users,
            title: "Wawancara Siswa & Ortu",
            desc: "Sesi diskusi santai untuk mengenal minat, bakat, dan komitmen belajar calon siswa.",
            details: [
                "Wawancara personal 1-on-1",
                "Diskusi tentang program unggulan",
                "Bisa via Video Call (kondisional)"
            ]
        },
        {
            icon: Megaphone,
            title: "Pengumuman Kelulusan",
            desc: "Hasil akhir seleksi akan diumumkan serentak sesuai jadwal gelombang pendaftaran.",
            details: [
                "Cek status LULUS di Dashboard",
                "Unduh Surat Keputusan (SK) Digital",
                "Lanjut ke proses Daftar Ulang"
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            {/* Standard Public Header */}
            <PublicHeader settings={settings} user={user} isAdmin={isAdmin} />

            {/* Hero Section */}
            <header className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-500 text-white pt-40 pb-32 px-6 overflow-hidden">
                <div className="absolute inset-0 bg-pattern opacity-10"></div>
                <div className="absolute top-20 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                <div className="container mx-auto max-w-4xl text-center relative z-10 animate-fade-in-up">
                    <span className="inline-block py-1 px-4 rounded-full bg-blue-500/30 backdrop-blur-md border border-blue-400/30 text-blue-50 font-medium text-sm mb-6">
                        Tahun Ajaran 2025/2026
                    </span>
                    <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
                        Alur Pendaftaran <br className="hidden md:block" /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-300">Mudah & Cepat</span>
                    </h1>
                    <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                        Kami merancang proses pendaftaran yang simpel agar Anda bisa fokus pada persiapan masa depan buah hati Anda.
                    </p>
                </div>
            </header>

            {/* Timeline Steps */}
            <main className="container mx-auto max-w-5xl px-6 py-20 -mt-20 relative z-20">
                <div className="relative">
                    {/* Vertical Line */}
                    <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-1 bg-slate-200 transform md:-translate-x-1/2 rounded-full hidden md:block"></div>

                    <div className="space-y-12 md:space-y-24">
                        {steps.map((step, index) => {
                            const isEven = index % 2 === 0;
                            return (
                                <div key={index} className={`flex flex-col md:flex-row items-center gap-8 md:gap-0 ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                                    {/* Content Card */}
                                    <div className="w-full md:w-1/2 md:px-12 group">
                                        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none transition group-hover:scale-110 group-hover:opacity-10 duration-500">
                                                <step.icon size={140} className="text-blue-600" />
                                            </div>

                                            <div className="flex items-center gap-4 mb-6">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl shadow-inner border border-blue-200">
                                                    {index + 1}
                                                </div>
                                                <h3 className="text-2xl font-bold text-slate-900">{step.title}</h3>
                                            </div>

                                            <p className="text-slate-600 mb-6 leading-relaxed">
                                                {step.desc}
                                            </p>

                                            <ul className="space-y-3">
                                                {step.details.map((detail, idx) => (
                                                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-500 group-hover:text-slate-700 transition-colors">
                                                        <div className="mt-1 w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                                            <CheckCircle size={12} className="text-emerald-500" />
                                                        </div>
                                                        <span>{detail}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Dot (Desktop Center) */}
                                    <div className="relative hidden md:flex items-center justify-center w-12 z-10">
                                        <div className="w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-md"></div>
                                        <div className="absolute w-12 h-1 bg-blue-600 top-1/2 -translate-y-1/2 -z-10 hidden"></div>
                                    </div>

                                    {/* Empty Space for Zigzag */}
                                    <div className="w-full md:w-1/2 hidden md:block"></div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Secure Badge */}
                <div className="text-center mt-20 mb-12 animate-pulse">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-500 text-sm font-medium">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div> System Aman & Terenkripsi 256-bit
                    </span>
                </div>

                {/* CTA Section */}
                <div className="bg-gradient-to-r from-slate-900 to-blue-900 rounded-[2.5rem] p-8 md:p-16 text-center text-white shadow-2xl shadow-blue-900/40 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-pattern opacity-5"></div>
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20"></div>
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500 rounded-full blur-3xl opacity-20"></div>

                    <div className="relative z-10 max-w-2xl mx-auto">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Siap Bergabung Bersama Kami?</h2>
                        <p className="text-blue-100 text-lg mb-10">
                            Kuota terbatas untuk Gelombang 1. Amankan kursi Anda sekarang juga sebelum pendaftaran ditutup.
                        </p>
                        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                            <button
                                onClick={() => navigate('/')}
                                className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                            >
                                Daftar Online Sekarang <ArrowRight size={20} />
                            </button>
                            <a
                                href="https://wa.me/6281234567890"
                                target="_blank"
                                rel="noreferrer"
                                className="w-full md:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold backdrop-blur-sm transition flex items-center justify-center gap-2"
                            >
                                <Megaphone size={20} /> Tanya Admin
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="bg-slate-50 text-slate-400 py-12 text-center text-sm">
                <p>&copy; {new Date().getFullYear()} Panitia PPDB Online. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default GuidePage;
