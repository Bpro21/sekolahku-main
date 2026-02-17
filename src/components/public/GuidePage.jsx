import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ClipboardList, UserCheck, FileText, Users, Megaphone, ArrowRight, Phone, Mail } from 'lucide-react';
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

    const contactWA = settings?.landing_page?.contact_wa || '0812-3456-7890';
    const contactOffice = settings?.landing_page?.contact_office || '(021) 7788-9900';
    const contactEmail = settings?.landing_page?.contact_email || 'ppdb@cendekia.sch.id';
    const schoolAddress = settings?.landing_page?.address || 'Jl. Pendidikan No. 123, Komplek Pelajar, Kota Harapan, Indonesia 12345';
    const mapsLink = settings?.landing_page?.maps_link || '#';
    const schoolName = settings?.school_name || 'Sekolah Islam Terpadu Cendekia';
    const appName = settings?.app_name || 'PPDB Online';
    const footerDesc = settings?.landing_page?.footer_desc || `Panitia Penerimaan Peserta Didik Baru ${schoolName} Tahun Ajaran 2025/2026. Melayani dengan sepenuh hati untuk masa depan pendidikan Indonesia.`;
    const footerCopyright = settings?.landing_page?.footer_copyright || `© ${new Date().getFullYear()} Panitia PPDB ${schoolName}. All rights reserved.`;

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
            <header className="relative pt-40 pb-32 px-6 overflow-hidden min-h-[500px] flex items-center">
                <div className="absolute inset-0 z-0">
                    <img
                        src={settings?.landing_page?.hero_bg || "https://images.unsplash.com/photo-1523580494863-6f3031224c94?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80"}
                        alt="School Building"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-900/95 via-blue-900/80 to-blue-900/40"></div>
                </div>

                <div className="container mx-auto max-w-4xl text-center relative z-10 animate-fade-in-up">
                    <span className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-400/50 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
                        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
                        <span className="text-yellow-300 text-xs font-bold tracking-wide uppercase">
                            Tahun Ajaran 2025/2026
                        </span>
                    </span>

                    <h1 className="text-4xl md:text-7xl font-bold mb-6 leading-tight text-white">
                        Alur Pendaftaran <br />
                        <span style={{ color: '#fbbf24' }}>Mudah & Cepat</span>
                    </h1>
                    <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
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

                {/* CTA Section - Redesigned for High Contrast & Premium Feel */}
                <div className="relative group overflow-hidden rounded-[3rem] p-12 md:p-20 text-center shadow-2xl shadow-blue-500/20">
                    {/* Background Layer */}
                    <div className="absolute inset-0 bg-blue-600 transition-colors duration-500 group-hover:bg-blue-500"></div>
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 opacity-90"></div>

                    {/* Decorative Elements */}
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
                    <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-400 rounded-full blur-[100px] opacity-30 animate-pulse"></div>
                    <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-400 rounded-full blur-[100px] opacity-30 animate-pulse" style={{ animationDelay: '1s' }}></div>

                    <div className="relative z-10 max-w-3xl mx-auto">
                        <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-blue-200 text-sm font-bold uppercase tracking-widest mb-6">
                            Gabung Sekarang
                        </span>

                        <h2 className="text-4xl md:text-6xl font-extrabold mb-6 text-white leading-tight drop-shadow-sm">
                            Siap Bergabung <br /> Bersama <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-400">Kami?</span>
                        </h2>

                        <p className="text-blue-100 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                            Jangan lewatkan kesempatan emas ini. Kuota Gelombang 1 sangat terbatas, amankan kursi masa depan Anda sekarang juga!
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <button
                                onClick={() => navigate('/')}
                                className="w-full sm:w-auto px-10 py-5 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-blue-900 rounded-2xl font-black text-lg shadow-xl shadow-yellow-500/40 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                            >
                                Daftar Online Sekarang <ArrowRight size={24} />
                            </button>

                            <a
                                href={`https://wa.me/${contactWA.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full sm:w-auto px-10 py-5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold text-lg backdrop-blur-md border border-white/20 transition-all flex items-center justify-center gap-3"
                            >
                                <Megaphone size={22} /> Tanya Admin
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
                <div className="container mx-auto px-6">
                    <div className="grid md:grid-cols-4 gap-8">
                        <div className="col-span-2">
                            <div className="flex items-center gap-3 mb-6 text-white">
                                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold">
                                    {appName[0]}
                                </div>
                                <span className="font-bold text-xl uppercase">{appName} {schoolName}</span>
                            </div>
                            <p className="text-sm mb-6 max-w-md">
                                {footerDesc}
                            </p>
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-4">Kontak Panitia</h4>
                            <ul className="space-y-3 text-sm">
                                <li className="flex items-center gap-3"><Phone size={16} /> {contactWA} (WA Only)</li>
                                <li className="flex items-center gap-3"><Phone size={16} /> {contactOffice} (Kantor)</li>
                                <li className="flex items-center gap-3"><Mail size={16} /> {contactEmail}</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-4">Lokasi Sekolah</h4>
                            <p className="text-sm mb-4">{schoolAddress}</p>
                            <a href={mapsLink} target="_blank" rel="noreferrer" className="text-blue-500 text-sm font-bold hover:underline">Lihat di Google Maps</a>
                        </div>
                    </div>
                    <div className="border-t border-slate-800 mt-12 pt-8 text-center text-sm">
                        {footerCopyright}
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default GuidePage;
