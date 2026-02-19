import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    GraduationCap, Users, Calendar, Award, ArrowRight,
    MapPin, Phone, Mail, Facebook, Instagram, Youtube, Twitter,
    Menu, X, ChevronRight, Star, CheckCircle, Clock, Home, FileText, BookOpen, DollarSign, HelpCircle, LogIn, LayoutDashboard, Grid, Send, Loader2, Smartphone, User, School, ChevronLeft, Trophy
} from 'lucide-react';

// Lazy load light components
const FloatingAssistant = React.lazy(() => import('./FloatingAssistant'));
import { supabase } from '../../config/supabase';
import PublicHeader from './PublicHeader';

const SchoolWebsite = ({ user: propUser, isAdmin, onLogin }) => {
    // Skeleton Components for Loading States
    const HeroSkeleton = () => (
        <div className="hero-placeholder relative h-screen min-h-[600px] flex items-center overflow-hidden">
            <div className="container mx-auto px-4 relative z-10 pt-20">
                <div className="max-w-3xl md:pl-4">
                    <div className="skeleton-box w-64 h-10 mb-6" />
                    <div className="skeleton-box w-full h-20 mb-6" />
                    <div className="skeleton-box w-3/4 h-20 mb-6" />
                    <div className="skeleton-box w-full h-12 mb-8" />
                    <div className="flex gap-4">
                        <div className="skeleton-box w-48 h-14" />
                    </div>
                </div>
            </div>
        </div>
    );

    const StatsSkeleton = () => (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 container mx-auto px-4 -mt-16 relative z-20">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-xl h-32 animate-pulse flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg" />
                    <div className="w-16 h-4 bg-slate-100 rounded" />
                </div>
            ))}
        </div>
    );

    const ProgramsSkeleton = () => (
        <div className="container mx-auto px-4 py-20">
            <div className="text-center mb-16">
                <div className="w-32 h-6 bg-slate-100 mx-auto rounded mb-4 animate-pulse" />
                <div className="w-64 h-10 bg-slate-100 mx-auto rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[1, 2, 3].map(i => (
                    <div key={i} className="aspect-[4/5] rounded-3xl bg-slate-100 animate-pulse" />
                ))}
            </div>
        </div>
    );

    const navigate = useNavigate();
    const [user, setUser] = useState(propUser || null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [mountAssistant, setMountAssistant] = useState(false);
    const [activeTab, setActiveTab] = useState('home');
    const [settings, setSettings] = useState(null);
    const [apiKey, setApiKey] = useState('');
    const [isPPDBOpen, setIsPPDBOpen] = useState(false);
    const [ppdbData, setPpdbData] = useState({ name: '', phone: '', originSchool: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [realtimeData, setRealtimeData] = useState('');
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [selectedBranchId, setSelectedBranchId] = useState(null);

    const [branches, setBranches] = useState([]);
    const [waves, setWaves] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [activeAcademicYear, setActiveAcademicYear] = useState(null);
    const [showPopup, setShowPopup] = useState(false);
    const [loading, setLoading] = useState(false); // No blocking spinner - render immediately

    // Fetch Settings & APIs & Realtime Data (SUPABASE)
    // Fetch Settings & APIs & Realtime Data (SUPABASE)
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Check cache first for instant load
                const cachedData = sessionStorage.getItem('public_website_cache');
                if (cachedData) {
                    const parsed = JSON.parse(cachedData);
                    setSettings(parsed.settings);
                    setAcademicYears(parsed.academicYears);
                    setActiveAcademicYear(parsed.activeYear);
                    setWaves(parsed.waves);
                    setBranches(parsed.branches);
                    setRegistrations(parsed.registrations);
                    setRealtimeData(parsed.realtimeData);
                    if (parsed.settings?.gemini_api_key) setApiKey(parsed.settings.gemini_api_key);
                }

                // Parallelized Fetching
                const [
                    { data: settingsData },
                    { data: ayData },
                    { data: unitsData },
                    { data: regsData }
                ] = await Promise.all([
                    supabase.from('app_settings').select('*').eq('id', 'main').single(),
                    supabase.from('academic_years').select('*'),
                    supabase.from('units').select('*'),
                    supabase.from('registrations').select('*')
                ]);

                if (!settingsData || !ayData) return;

                // Process Academic Year
                const activeYear = ayData.find(y => y.is_active) || ayData.find(y => y.is_default) || ayData[0];

                // Fetch waves for active year (Waterfall but smaller)
                const { data: wavesData } = await supabase
                    .from('waves')
                    .select('*')
                    .eq('year', activeYear?.year)
                    .order('start_date', { ascending: true });

                const fetchedBranches = unitsData || [];
                const fetchedRegs = regsData || [];

                // Process Stats
                const TAKEN_STATUS = ['verified', 'verifying_payment', 'paid', 'paid_registration', 'accepted', 'lulus', 're_registration', 'student', 'psychotest_done', 'interview_accepted'];
                const stats = { branches: {}, majors: {} };

                fetchedRegs.forEach(r => {
                    const yearMatch = r.academic_year === activeYear?.year || r.academic_year_id === activeYear?.id;
                    if (!yearMatch || !TAKEN_STATUS.includes(r.status)) return;
                    const uid = r.unit_id || r.unit_selection;
                    if (uid) {
                        stats.branches[uid] = (stats.branches[uid] || 0) + 1;
                        const m = (r.major || r.major_1 || '').toLowerCase();
                        if (m) stats.majors[`${uid}-${m}`] = (stats.majors[`${uid}-${m}`] || 0) + 1;
                    }
                });

                const branchesWithStats = fetchedBranches.map(b => {
                    const config = b.academic_configs?.[activeYear?.id];
                    return {
                        ...b,
                        quota: config?.quota !== undefined ? config.quota : b.quota,
                        filled: stats.branches[b.id] || 0,
                        majors: (config?.majors || b.majors || []).map(m => ({
                            ...m,
                            filled: stats.majors[`${b.id}-${(m.name || '').toLowerCase()}`] || 0
                        }))
                    };
                });

                const summary = `Total Pendaftar: ${fetchedRegs.length}\n${branchesWithStats.map(b => `- ${b.name}: ${b.filled}/${b.quota}`).join('\n')}`;

                // Update States
                setSettings(settingsData);
                setAcademicYears(ayData);
                setActiveAcademicYear(activeYear);
                if (wavesData) setWaves(wavesData);
                setRegistrations(fetchedRegs);
                setBranches(branchesWithStats);
                setRealtimeData(summary);
                if (settingsData.gemini_api_key) setApiKey(settingsData.gemini_api_key);

                // Update Cache
                sessionStorage.setItem('public_website_cache', JSON.stringify({
                    settings: settingsData,
                    academicYears: ayData,
                    activeYear: activeYear,
                    waves: wavesData || [],
                    branches: branchesWithStats,
                    registrations: fetchedRegs,
                    realtimeData: summary
                }));

            } catch (e) {
                console.error("Failed to load public data", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Monitor Auth State (SUPABASE)
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user || null);
        });
        return () => subscription.unsubscribe();
    }, []);

    // Handle scroll effect for navbar and real-time settings updates
    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 20) {
                setScrolled(true);
            } else {
                setScrolled(false);
            }
        };
        window.addEventListener('scroll', handleScroll);

        // Real-time Update Listener from Admin
        const handleSettingsUpdate = (e) => {
            if (e.detail) {
                setSettings(prev => ({
                    ...prev,
                    ...e.detail
                }));
            }
        };

        window.addEventListener('app-settings-updated', handleSettingsUpdate);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('app-settings-updated', handleSettingsUpdate);
        };
    }, []);

    // Delay mount heavy components (AI Assistant)
    useEffect(() => {
        const timer = setTimeout(() => {
            setMountAssistant(true);
        }, 2500);
        return () => clearTimeout(timer);
    }, []);

    // Handle popup display
    useEffect(() => {
        if (settings?.landing_page?.popup_enabled && settings?.landing_page?.popup_image) {
            const popupShown = sessionStorage.getItem('popup_shown');
            if (settings.landing_page.popup_show_once && popupShown) {
                return; // Already shown this session
            }
            // Delay popup by 1 second for better UX
            const timer = setTimeout(() => {
                setShowPopup(true);
                if (settings.landing_page.popup_show_once) {
                    sessionStorage.setItem('popup_shown', 'true');
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [settings]);

    // Auto-select first available level for fee section
    // Auto-select first available branch for fee section
    // Auto-select first available branch for fee section
    useEffect(() => {
        // Filter branches based on Active Academic Year's unit_ids
        let availableBranches = branches.filter(b => b.open !== false);
        if (activeAcademicYear && activeAcademicYear.unit_ids && activeAcademicYear.unit_ids.length > 0) {
            availableBranches = availableBranches.filter(b => activeAcademicYear.unit_ids.includes(b.id));
        }

        if (availableBranches.length > 0) {
            // Only change if currently selected is invalid or null
            if (!selectedBranchId || !availableBranches.find(b => b.id === selectedBranchId)) {
                setSelectedBranchId(availableBranches[0].id);
            }
        }
    }, [branches, activeAcademicYear, selectedBranchId]);

    // Navigasi difokuskan untuk PPDB
    const navLinks = [
        { name: 'Beranda', href: '#home', icon: Home },
        { name: 'Alur Daftar', href: '#flow', icon: FileText },
        { name: 'Program', href: '#programs', icon: BookOpen },
        { name: 'Biaya', href: '#fees', icon: DollarSign },
        { name: 'FAQ', href: '#faq', icon: HelpCircle },
        { name: 'Kontak', href: '#contact', icon: Phone },
    ];

    // Using settings or defaults
    const contactWA = settings?.landing_page?.contact_wa || '';
    const contactOffice = settings?.landing_page?.contact_office || '';
    const contactEmail = settings?.landing_page?.contact_email || '';
    const schoolAddress = settings?.landing_page?.address || '';
    const mapsLink = settings?.landing_page?.maps_link || '#';

    // School Name variables
    const schoolName = settings?.school_name || '';
    const appName = settings?.app_name || '';

    const footerDesc = settings?.landing_page?.footer_desc || '';
    const footerCopyright = settings?.landing_page?.footer_copyright || '';



    // Statistik difokuskan pada urgensi & kualitas
    const statistics = [
        { icon: Users, count: '...', label: 'Siswa' },
        { icon: GraduationCap, count: '...', label: 'Guru & Staff' },
        { icon: BookOpen, count: '...', label: 'Ekstrakurikuler' },
        { icon: Trophy, count: '...', label: 'Penghargaan' },
    ];

    const steps = [
        { title: "Isi Biodata", desc: "Isi formulir biodata diri secara online melalui website ini." },
        { title: "Verifikasi", desc: "Admin memverifikasi berkas pendaftaran dalam 1x24 jam." },
        { title: "Ujian / Tes", desc: "Ikuti tes potensi akademik (TPA) secara luring/daring." },
        { title: "Wawancara", desc: "Sesi wawancara calon siswa dan orang tua." },
        { title: "Pengumuman", desc: "Hasil seleksi diumumkan via WhatsApp & Email." },
    ];

    const defaultPrograms = [];

    const programsList = (settings?.landing_page?.programs && settings.landing_page.programs.length > 0)
        ? settings.landing_page.programs
        : defaultPrograms;

    const sliderRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        const slider = sliderRef.current;
        if (!slider || programsList.length <= 3) return;

        let direction = 0.5; // slow speed

        const animate = () => {
            if (!slider) return;

            // Check boundaries
            if (slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 1) {
                direction = -0.5;
            } else if (slider.scrollLeft <= 0) {
                direction = 0.5;
            }

            slider.scrollLeft += direction;
            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [programsList.length]);

    const faqs = settings?.landing_page?.faqs || [
        { q: "Kapan batas akhir pendaftaran Gelombang 1?", a: "Pendaftaran Gelombang 1 ditutup pada tanggal 30 November 2025." },
        { q: "Apakah ada beasiswa prestasi?", a: "Ya, kami menyediakan beasiswa potongan DSP 50% untuk juara 1-3 tingkat kota/provinsi." },
        { q: "Bagaimana sistem pembayarannya?", a: "Pembayaran dapat dicicil hingga 3x selama satu semester pertama." },
    ];

    const faqTitle = settings?.landing_page?.faq_title || 'Pertanyaan Sering Diajukan';

    const scrollToSection = (id) => {
        const element = document.querySelector(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setActiveTab(id.replace('#', ''));
            setIsMenuOpen(false);
        }
    };

    // Fungsi Handle Submit PPDB ke Fonnte
    const handlePPDBSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('target', ppdbData.phone);
        formData.append('message', `Halo Calon Siswa ${ppdbData.name},\n\nSelamat! Data pendaftaran awal Anda di ${schoolName} telah kami terima.\n\nDetail:\nNama: ${ppdbData.name}\nAsal Sekolah: ${ppdbData.originSchool}\n\nLangkah selanjutnya: Silakan lengkapi berkas di link berikut (link-dummy.com) atau kunjungi sekolah kami.`);
        formData.append('countryCode', '62');

        try {
            const response = await fetch('https://api.fonnte.com/send', {
                method: 'POST',
                headers: { 'Authorization': settings?.fonnte_token },
                body: formData
            });

            const result = await response.json();

            if (result.status) {
                alert("Pendaftaran Berhasil! Silakan cek WhatsApp Anda untuk instruksi selanjutnya.");
                setIsPPDBOpen(false);
                setPpdbData({ name: '', phone: '', originSchool: '' });
            } else {
                alert("Pendaftaran terkirim, namun gagal mengirim notifikasi WA (Cek token/koneksi).");
            }
        } catch (error) {
            console.error("Error sending WA:", error);
            alert("Terima kasih! Data pendaftaran tersimpan. Silakan tunggu info dari panitia.");
            setIsPPDBOpen(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-slate-900 gap-4">
                <Loader2 className="animate-spin text-emerald-600" size={48} />
                <p className="text-slate-500 font-medium animate-pulse">Memuat Data Sekolah...</p>
            </div>
        );
    }

    return (
        <div className="font-sans text-gray-800 bg-gray-50 pb-24 md:pb-0 min-h-screen w-full">

            {/* Announcement Marquee Bar */}
            {(() => {
                const announcementText = settings?.landing_page?.announcement_bar
                    || (() => {
                        const activeWave = waves.find(w => w.year === activeAcademicYear?.year && w.active);
                        if (activeWave) return `🚀 Pendaftaran ${activeWave.name} T.A ${activeWave.year} DIBUKA! Segera Ambil Kuota Anda.`;
                        return '🚀 Pendaftaran Siswa Baru Telah DIBUKA! Dapatkan potongan DSP bagi pendaftar awal.';
                    })();

                const bgColor = settings?.landing_page?.marquee_bg_color || '#2563eb';
                const textColor = settings?.landing_page?.marquee_text_color || '#ffffff';
                const speed = settings?.landing_page?.marquee_speed || 30;

                return (
                    <div
                        className="py-2.5 overflow-hidden whitespace-nowrap relative"
                        style={{ backgroundColor: bgColor }}
                    >
                        <div
                            className="inline-flex animate-marquee"
                            style={{
                                animation: `marquee ${speed}s linear infinite`,
                                color: textColor
                            }}
                        >
                            {[...Array(4)].map((_, i) => (
                                <span key={i} className="mx-16 text-xs md:text-sm font-bold tracking-wide">
                                    {announcementText}
                                </span>
                            ))}
                        </div>
                        <style>{`
                            @keyframes marquee {
                                0% { transform: translateX(0%); }
                                100% { transform: translateX(-50%); }
                            }
                        `}</style>
                    </div>
                );
            })()}



            {/* Standard Public Header (Shared) */}
            <PublicHeader
                settings={settings}
                user={user}
                isAdmin={isAdmin}
                onLogin={onLogin}
                activeTab={activeTab}
                onNavigate={(href) => scrollToSection(href)}
            />

            {/* Premium Mobile Navigation (Floating Island) */}
            <div className="md:hidden fixed bottom-6 left-4 right-4 z-40 animate-slide-up">
                <div className="bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/50 dark:border-slate-700/50 flex justify-between items-center px-6 py-4 relative">

                    <button
                        onClick={() => scrollToSection('#home')}
                        className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'home' ? 'text-emerald-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                        aria-label="Navigasi ke Beranda"
                    >
                        <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">Home</span>
                    </button>

                    <button
                        onClick={() => scrollToSection('#flow')}
                        className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'flow' ? 'text-emerald-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                        aria-label="Navigasi ke Alur Pendaftaran"
                    >
                        <FileText size={24} strokeWidth={activeTab === 'flow' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">Alur</span>
                    </button>

                    {/* Center Floating Button (PPDB) */}
                    <div className="absolute left-1/2 -top-8 -translate-x-1/2">
                        <button
                            onClick={() => user ? window.location.href = '/login' : onLogin()}
                            className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 text-white rounded-full shadow-lg shadow-emerald-500/30 flex items-center justify-center border-4 border-slate-50 dark:border-slate-800 transform transition-transform hover:scale-110 active:scale-95 group"
                        >
                            {user ? (
                                <LayoutDashboard size={28} className="ml-0.5 group-hover:animate-pulse" />
                            ) : (
                                <LogIn size={28} className="ml-1 group-hover:animate-pulse" />
                            )}
                        </button>
                    </div>

                    <button
                        onClick={() => scrollToSection('#programs')}
                        className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'programs' ? 'text-emerald-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                        aria-label="Navigasi ke Program Studi"
                    >
                        <BookOpen size={24} strokeWidth={activeTab === 'programs' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">Jurusan</span>
                    </button>

                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className={`flex flex-col items-center gap-1 transition-all duration-300 ${isMenuOpen ? 'text-emerald-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                        aria-label="Buka Menu"
                    >
                        <Grid size={24} strokeWidth={isMenuOpen ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">Menu</span>
                    </button>
                </div>
            </div>

            {/* MODAL FORMULIR PPDB */}
            {isPPDBOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative transform transition-all scale-100">
                        <div className="bg-blue-600 p-6 text-white text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-pattern opacity-10"></div>
                            <h2 className="text-2xl font-bold mb-1 relative z-10">Formulir Pendaftaran</h2>
                            <p className="text-blue-100 text-sm relative z-10">Tahun Ajaran 2025/2026</p>
                            <button
                                onClick={() => setIsPPDBOpen(false)}
                                className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-1 rounded-full text-white transition z-20"
                                aria-label="Tutup Formulir"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handlePPDBSubmit} className="p-6 space-y-4">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-start gap-2">
                                <Clock size={16} className="shrink-0 mt-0.5" />
                                <span>Segera daftar! Kuota Gelombang 1 tersisa <strong>15 kursi</strong> lagi.</span>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nama Lengkap Calon Siswa</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        required
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-gray-50 focus:bg-white"
                                        placeholder="Sesuai Ijazah SMP"
                                        value={ppdbData.name}
                                        onChange={(e) => setPpdbData({ ...ppdbData, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nomor WhatsApp Aktif</label>
                                <div className="relative">
                                    <Smartphone className="absolute left-3 top-3 text-gray-400" size={18} />
                                    <input
                                        type="tel"
                                        required
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-gray-50 focus:bg-white"
                                        placeholder="0812xxxx (Untuk notifikasi)"
                                        value={ppdbData.phone}
                                        onChange={(e) => setPpdbData({ ...ppdbData, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Asal Sekolah SMP/MTs</label>
                                <div className="relative">
                                    <School className="absolute left-3 top-3 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        required
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-gray-50 focus:bg-white"
                                        placeholder="Nama Sekolah Asal"
                                        value={ppdbData.originSchool}
                                        onChange={(e) => setPpdbData({ ...ppdbData, originSchool: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 transition transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" /> Memproses...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={20} /> Kirim Pendaftaran
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-xs text-gray-400 mt-3">Data Anda aman dan terenkripsi.</p>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Full Screen Mobile Menu Overlay */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-[60] bg-white md:hidden animate-fade-in">
                    <div className="flex flex-col h-full">
                        <div className="flex justify-between items-center p-6 border-b">
                            <span className="font-bold text-xl text-gray-900">Menu PPDB</span>
                            <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200" aria-label="Tutup Menu">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-2 gap-4">
                                {navLinks.map((link) => (
                                    <button
                                        key={link.name}
                                        onClick={() => scrollToSection(link.href)}
                                        className="flex flex-col items-center justify-center bg-gray-50 hover:bg-blue-50 border border-gray-100 p-4 rounded-xl transition group"
                                    >
                                        <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-blue-600 mb-2 group-hover:scale-110 transition">
                                            <link.icon size={20} />
                                        </div>
                                        <span className="font-medium text-sm text-gray-700">{link.name}</span>
                                    </button>
                                ))}
                                <button
                                    onClick={onLogin}
                                    className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 border border-blue-100 p-4 rounded-xl transition group col-span-2"
                                >
                                    <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-blue-600 mb-2 group-hover:scale-110 transition">
                                        <LogIn size={20} />
                                    </div>
                                    <span className="font-medium text-sm text-gray-700">Login / Daftar</span>
                                </button>
                            </div>

                            <div className="mt-8 p-6 bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl text-white relative overflow-hidden shadow-xl">
                                <div className="relative z-10">
                                    <h3 className="font-bold text-lg mb-1">Butuh Bantuan?</h3>
                                    <p className="text-blue-100 text-sm mb-4">Tim admin kami siap membantu Anda 24/7 via WhatsApp.</p>
                                    <button className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg text-sm w-full flex items-center justify-center gap-2 transition">
                                        <Phone size={16} /> Chat Admin
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hero Section */}
            {!settings ? <HeroSkeleton /> : (
                <header id="home" className="relative h-screen min-h-[600px] flex items-center -mt-20 md:-mt-24">
                    <div className="absolute inset-0 z-0">
                        <img
                            src={settings?.landing_page?.hero_bg || "https://images.unsplash.com/photo-1523580494863-6f3031224c94?ixlib=rb-4.0.3&auto=format&fit=crop&w=1280&q=75"}
                            alt="Gedung Sekolah"
                            className="w-full h-full object-cover"
                            fetchPriority="high"
                            decoding="sync"
                            width="1280"
                            height="720"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/95 via-blue-900/80 to-blue-900/40"></div>
                    </div>

                    <div className="container mx-auto px-4 relative z-10 text-white pt-20">
                        <div className="max-w-3xl animate-fade-in-up md:pl-4">
                            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/50 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span className="text-emerald-300 text-sm font-bold tracking-wide uppercase">
                                    {settings?.landing_page?.hero_badge || ''}
                                </span>
                            </div>

                            <h1 className="text-4xl md:text-7xl font-bold mb-6 leading-tight">
                                {settings?.landing_page?.hero_title?.includes('|') ? (
                                    <>
                                        <span style={{ color: settings?.landing_page?.hero_title_color_1 || '#ffffff' }}>
                                            {settings.landing_page.hero_title.split('|')[0]}
                                        </span> <br />
                                        <span style={{ color: settings?.landing_page?.hero_title_color_2 || '#10b981' }}>
                                            {settings.landing_page.hero_title.split('|')[1]}
                                        </span>
                                    </>
                                ) : (
                                    <span style={{ color: settings?.landing_page?.hero_title_color_1 || '#ffffff' }}>
                                        {settings?.landing_page?.hero_title || ''}
                                    </span>
                                )}
                            </h1>

                            <p className="text-lg md:text-xl mb-8 text-blue-100 leading-relaxed max-w-2xl">
                                {settings?.landing_page?.hero_subtitle || ''}
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={onLogin}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-full font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 group text-lg"
                                >
                                    {settings?.landing_page?.hero_btn_text || 'Daftar Sekarang'} <ArrowRight size={20} className="group-hover:translate-x-1 transition" />
                                </button>
                                {settings?.landing_page?.brochure_link && (
                                    <a
                                        href={settings.landing_page.brochure_link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="border-2 border-white/30 bg-white/10 backdrop-blur-sm hover:bg-white hover:text-blue-900 text-white px-8 py-4 rounded-full font-bold transition flex items-center justify-center gap-2"
                                    >
                                        <FileText size={20} /> Unduh Brosur
                                    </a>
                                )}
                            </div>

                            <div className="mt-12 flex items-center gap-4 text-sm font-medium text-blue-200">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="w-8 h-8 rounded-full bg-gray-300 border-2 border-blue-900 overflow-hidden">
                                            <img
                                                src={`https://i.pravatar.cc/100?img=${i + 10}`}
                                                alt={`Avatar Pendaftar ${i}`}
                                                loading="lazy"
                                                decoding="async"
                                                width="32"
                                                height="32"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <p>Bergabung dengan <strong>500+ pendaftar</strong> lainnya hari ini.</p>
                            </div>
                        </div>
                    </div>
                </header>
            )}

            {/* Statistics / Quota Section */}
            {!settings ? <StatsSkeleton /> : (
                <section className="relative z-20 -mt-16 pb-16">
                    <div className="container mx-auto px-4">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {statistics.map((stat, index) => (
                                <div key={index} className="bg-white p-6 rounded-2xl shadow-xl border-b-4 border-emerald-500 text-center transform hover:-translate-y-1 transition duration-300">
                                    <div className="flex items-center justify-center mb-3 text-blue-600">
                                        <stat.icon size={32} />
                                    </div>
                                    <h3 className="text-3xl font-bold text-gray-900 mb-1">{stat.count}</h3>
                                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Alur Pendaftaran */}
            <section id="flow" className="py-16 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <span className="text-blue-600 font-bold uppercase tracking-wider text-sm mb-2 block">Mudah & Cepat</span>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Alur Pendaftaran Online</h2>
                        <p className="text-gray-600">Proses pendaftaran dirancang sesimpel mungkin agar Anda bisa mendaftar dari mana saja dan kapan saja.</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-8 relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden md:block absolute top-12 left-0 w-full h-1 bg-gray-100 -z-0"></div>

                        {steps.map((step, index) => (
                            <div key={index} className="relative z-10 text-center group">
                                <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-white border-4 border-blue-100 rounded-full flex items-center justify-center text-xl md:text-2xl font-bold text-blue-600 mb-6 group-hover:border-blue-600 group-hover:scale-110 transition duration-300 shadow-sm">
                                    {index + 1}
                                </div>
                                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                                <p className="text-gray-500 text-xs md:text-sm leading-relaxed px-2">{step.desc}</p>
                            </div>
                        ))}
                    </div>

                    <div className="text-center mt-12">
                        <button onClick={() => navigate('/panduan')} className="inline-flex items-center gap-2 text-blue-600 font-bold hover:text-blue-800 transition border-b-2 border-blue-600 pb-1">
                            Baca Panduan Lengkap <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </section>

            {/* Program Unggulan */}
            {
                !settings ? <ProgramsSkeleton /> : (
                    <section id="programs" className="py-16 bg-gray-50">
                        <div className="container mx-auto px-4">
                            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
                                <div className="max-w-xl">
                                    <span className="text-emerald-600 font-bold uppercase tracking-wider text-sm mb-2 block">Pilihan Jurusan</span>
                                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Program Unggulan Kami</h2>
                                </div>
                                <button className="hidden md:block bg-white text-blue-900 px-6 py-2 rounded-full font-bold border border-gray-200 hover:shadow-md transition">Lihat Kurikulum</button>
                            </div>

                            <div
                                ref={sliderRef}
                                className={programsList.length > 3
                                    ? "flex overflow-x-auto gap-6 pb-8 pt-2 scrollbar-hide snap-x"
                                    : "grid md:grid-cols-3 gap-8"
                                }
                            >
                                {programsList.map((prog, index) => (
                                    <div
                                        key={index}
                                        className={`bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition duration-300 group ${programsList.length > 3 ? 'min-w-[320px] md:min-w-[380px] snap-center' : ''}`}
                                    >
                                        <div className="h-48 overflow-hidden relative">
                                            <div className="absolute inset-0 bg-blue-900/20 group-hover:bg-transparent transition z-10"></div>
                                            <img
                                                src={prog.img}
                                                alt={prog.title}
                                                className="w-full h-full object-cover transform group-hover:scale-110 transition duration-700"
                                                loading="lazy"
                                                decoding="async"
                                                width="400"
                                                height="300"
                                            />
                                        </div>
                                        <div className="p-8">
                                            <h3 className="text-xl font-bold text-gray-900 mb-3">{prog.title}</h3>
                                            <p className="text-gray-600 mb-6 leading-relaxed text-sm line-clamp-3">{prog.desc}</p>
                                            <button
                                                onClick={() => setSelectedProgram(prog)}
                                                className="inline-flex items-center text-blue-600 font-bold text-sm hover:gap-2 transition-all"
                                            >
                                                Detail Program <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )
            }

            {/* Program Detail Modal */}
            {
                selectedProgram && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedProgram(null)}>
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden relative transform transition-all scale-100" onClick={(e) => e.stopPropagation()}>
                            {/* Header with Image */}
                            <div className="relative h-64 overflow-hidden">
                                {selectedProgram.img ? (
                                    <img src={selectedProgram.img} alt={selectedProgram.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700"></div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

                                {/* Category Badge */}
                                {selectedProgram.category && (
                                    <div className="absolute top-6 left-6">
                                        <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-lg ${selectedProgram.category === 'TK' ? 'bg-pink-500 text-white' :
                                            selectedProgram.category === 'SD' ? 'bg-blue-500 text-white' :
                                                selectedProgram.category === 'SMP' ? 'bg-purple-500 text-white' :
                                                    selectedProgram.category === 'SMK' ? 'bg-orange-500 text-white' :
                                                        'bg-gray-500 text-white'
                                            }`}>
                                            {selectedProgram.category}
                                        </span>
                                    </div>
                                )}

                                {/* Close Button */}
                                <button
                                    onClick={() => setSelectedProgram(null)}
                                    className="absolute top-6 right-6 bg-white/20 hover:bg-white/30 p-2 rounded-full text-white transition backdrop-blur-sm z-20"
                                    aria-label="Tutup Detail"
                                >
                                    <X size={24} />
                                </button>

                                {/* Title */}
                                <div className="absolute bottom-6 left-6 right-6">
                                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{selectedProgram.title}</h2>
                                    <p className="text-blue-100 text-sm">{selectedProgram.desc}</p>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-8 overflow-y-auto max-h-[calc(90vh-16rem)]">
                                {selectedProgram.details ? (
                                    <div className="prose prose-blue max-w-none">
                                        <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                                            {selectedProgram.details}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-400">
                                        <BookOpen size={48} className="mx-auto mb-3 opacity-20" />
                                        <p>Detail program belum tersedia</p>
                                    </div>
                                )}

                                {/* CTA Button */}
                                <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={onLogin}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition"
                                    >
                                        Daftar Sekarang
                                    </button>
                                    <button
                                        onClick={() => setSelectedProgram(null)}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl transition"
                                    >
                                        Tutup
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Biaya Pendidikan (New Section) */}
            <section id="fees" className="py-16 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-2xl mx-auto mb-8">
                        <span className="text-blue-600 font-bold uppercase tracking-wider text-sm mb-2 block">Transparan & Terjangkau</span>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Estimasi Biaya Pendidikan</h2>
                        <p className="text-gray-600">Investasi terbaik untuk masa depan buah hati Anda dengan fasilitas lengkap dan kurikulum unggulan.</p>
                    </div>

                    {/* Academic Year Selector (If multiple active) */}
                    {academicYears.filter(y => y.is_active).length > 1 && (
                        <div className="flex justify-center gap-3 mb-6">
                            <div className="bg-gray-100 p-1 rounded-xl inline-flex">
                                {academicYears.filter(y => y.is_active).map(year => (
                                    <button
                                        key={year.id}
                                        onClick={() => setActiveAcademicYear(year)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeAcademicYear?.id === year.id
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        Tahun {year.year}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Level Tabs (Now Branch Tabs) */}
                    <div className="flex justify-center gap-2 mb-8 flex-wrap">
                        {branches
                            .filter(branch => branch.open !== false)
                            .filter(branch => !activeAcademicYear?.unit_ids || activeAcademicYear.unit_ids.length === 0 || activeAcademicYear.unit_ids.includes(branch.id))
                            .map(branch => (
                                <button
                                    key={branch.id}
                                    onClick={() => setSelectedBranchId(branch.id)}
                                    className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all ${selectedBranchId === branch.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {branch.name}
                                </button>
                            ))}
                    </div>

                    {/* Selected Branch Info */}
                    {(() => {
                        const selectedBranch = branches.find(b => b.id === selectedBranchId);
                        if (!selectedBranch) {
                            return (
                                <div className="text-center py-12 text-gray-400">
                                    <School size={48} className="mx-auto mb-3 opacity-50" />
                                    <p>Silakan pilih unit sekolah untuk melihat biaya.</p>
                                </div>
                            );
                        }

                        // Determine display values based on active academic year
                        const activeYearId = activeAcademicYear?.id;
                        const config = selectedBranch.academic_configs?.[activeYearId];

                        // Priority: 1. Academic Year Config, 2. Root Level (Legacy)
                        const displayFeeBreakdown = config?.fee_breakdown || selectedBranch.fee_breakdown || selectedBranch.cost_breakdown || [];
                        const displayReg = config?.cost_reg ?? selectedBranch.cost_reg ?? 0;
                        const displayRereg = config?.cost_rereg ?? selectedBranch.cost_rereg ?? 0;
                        const displaySpp = config?.cost_spp ?? selectedBranch.cost_spp ?? 850000;
                        const displaySppIncludes = config?.spp_includes || selectedBranch.spp_includes || [];

                        return (
                            <div className="max-w-4xl mx-auto">
                                {/* Branch Name Badge */}
                                <div className="text-center mb-6 flex flex-col items-center gap-2">
                                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold">
                                        <School size={16} />
                                        {selectedBranch.name}
                                        {activeAcademicYear && <span className="text-blue-500 font-normal">({activeAcademicYear.year})</span>}
                                    </span>
                                    {(() => {
                                        const activeWave = waves.find(w => w.year === activeAcademicYear?.year && w.active);
                                        const quota = config?.quota ?? selectedBranch.quota ?? 0;
                                        const filled = selectedBranch.filled || 0;
                                        const remaining = Math.max(0, quota - filled);

                                        return (
                                            <div className="flex gap-2">
                                                {activeWave && (
                                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                                        {activeWave.name}
                                                    </span>
                                                )}
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${remaining <= 5 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-blue-100 text-blue-700'}`}>
                                                    Sisa Kuota: {remaining} Kursi
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {selectedBranch.level === 'SMK' && (
                                    <div className="mb-8 p-6 bg-white border border-blue-100 rounded-2xl shadow-sm">
                                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                                            Pilihan Jurusan & Kuota
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {(config?.majors || selectedBranch.majors || []).map((m, idx) => (
                                                <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-100 group hover:border-blue-300 transition-colors">
                                                    <div className="font-bold text-gray-800 mb-1 group-hover:text-blue-700 transition-colors">{m.name}</div>
                                                    <div className="text-[10px] text-gray-500 font-bold uppercase">Sisa: {Math.max(0, (m.quota || 0) - (m.filled || 0))} Kursi</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid md:grid-cols-2 gap-8">
                                    {/* Card Biaya Masuk */}
                                    <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-xl transition relative overflow-hidden">
                                        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">Sekali Bayar</div>
                                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Dana Sumbangan Pendidikan (DSP)</h3>
                                        <p className="text-gray-500 text-sm mb-6">Dibayarkan saat daftar ulang (bisa dicicil 3x).</p>

                                        <div className="space-y-4">
                                            {(displayFeeBreakdown && displayFeeBreakdown.length > 0) ? (
                                                <>
                                                    {displayFeeBreakdown.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between items-center border-b border-gray-100 pb-2">
                                                            <span className="text-gray-600 text-sm">{item.label || item.name}</span>
                                                            <span className="font-bold text-gray-900">Rp {(item.amount || 0).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                    <div className="flex justify-between items-center pt-2 text-lg">
                                                        <span className="font-bold text-blue-600">Total</span>
                                                        <span className="font-bold text-blue-600">
                                                            Rp {displayFeeBreakdown.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center py-8 text-gray-400 text-sm">
                                                    <p>Rincian biaya belum diatur</p>
                                                    <p className="font-bold text-gray-700 mt-2">Biaya Daftar Ulang: Rp {(displayRereg || 0).toLocaleString()}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-6 bg-blue-50 p-4 rounded-lg text-sm text-blue-800 flex items-start gap-2">
                                            <CheckCircle size={18} className="shrink-0 mt-0.5" />
                                            <span><strong>Biaya Pendaftaran:</strong> Rp {(displayReg || 0).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Card SPP */}
                                    <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-xl transition relative bg-gray-50">
                                        <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">Bulanan</div>
                                        <h3 className="text-2xl font-bold text-gray-900 mb-2">SPP Bulanan</h3>
                                        <p className="text-gray-500 text-sm mb-6">Biaya operasional pendidikan rutin.</p>

                                        <div className="flex items-baseline mb-6">
                                            <span className="text-4xl font-bold text-gray-900">Rp {(displaySpp).toLocaleString()}</span>
                                            <span className="text-gray-500 ml-2">/ bulan</span>
                                        </div>

                                        <h4 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wide">Termasuk:</h4>
                                        <ul className="space-y-3">
                                            {(displaySppIncludes && displaySppIncludes.length > 0) ? (
                                                displaySppIncludes.map((item, i) => (
                                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                                                        <CheckCircle size={16} className="text-green-500 shrink-0" />
                                                        {item}
                                                    </li>
                                                ))
                                            ) : (
                                                [
                                                    "Akses Full Fasilitas (Lab, Perpus, Gym)",
                                                    "Ekstrakurikuler Wajib",
                                                    "Layanan Kesehatan (UKS)",
                                                    "Konseling BP/BK",
                                                    "Akses E-Learning Premium"
                                                ].map((item, i) => (
                                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                                                        <CheckCircle size={16} className="text-green-500 shrink-0" />
                                                        {item}
                                                    </li>
                                                ))
                                            )}
                                        </ul>

                                        <div className="mt-8 pt-6 border-t border-gray-200">
                                            <p className="text-xs text-gray-500 mb-2">* Tidak ada biaya ujian semester/tahunan.</p>
                                            <p className="text-xs text-gray-500">* Kenaikan SPP maksimal 10% per tahun jika diperlukan.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 relative overflow-hidden" style={{ backgroundColor: settings?.landing_page?.cta_bg_color || '#1e3a8a' }}>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="container mx-auto px-4 text-center relative z-10">
                    <h2
                        className="text-3xl md:text-5xl font-bold mb-6 !text-[var(--cta-title-color)]"
                        style={{ '--cta-title-color': settings?.landing_page?.cta_title_color || '#ffffff' }}
                    >
                        {settings?.landing_page?.cta_title || 'Jangan Lewatkan Kesempatan Emas Ini!'}
                    </h2>
                    <p
                        className="text-lg mb-10 max-w-2xl mx-auto !text-[var(--cta-desc-color)]"
                        style={{ '--cta-desc-color': settings?.landing_page?.cta_desc_color || '#bfdbfe' }}
                    >
                        {settings?.landing_page?.cta_desc || 'Kuota terbatas untuk gelombang pertama. Daftarkan putra-putri Anda sekarang dan dapatkan prioritas seleksi serta potongan biaya masuk.'}
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <button
                            onClick={onLogin}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white text-lg px-10 py-4 rounded-full font-bold shadow-xl transition transform hover:-translate-y-1"
                        >
                            {settings?.landing_page?.cta_btn1_text || 'Ambil Kuota Sekarang'}
                        </button>
                        {settings?.landing_page?.cta_wa_number ? (
                            <a
                                href={`https://wa.me/${settings.landing_page.cta_wa_number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-transparent border-2 border-white/30 hover:bg-white text-white hover:text-blue-900 px-10 py-4 rounded-full font-bold transition inline-block"
                            >
                                {settings?.landing_page?.cta_btn2_text || 'Konsultasi via WA'}
                            </a>
                        ) : (
                            <button
                                className="bg-transparent border-2 border-white/30 hover:bg-white text-white hover:text-blue-900 px-10 py-4 rounded-full font-bold transition"
                                onClick={() => alert('Nomor WhatsApp belum diatur oleh admin')}
                            >
                                {settings?.landing_page?.cta_btn2_text || 'Konsultasi via WA'}
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* Admission Wave Section */}
            {
                waves.length > 0 && (
                    <section id="waves" className="py-20 bg-slate-50 overflow-hidden">
                        <div className="container mx-auto px-4">
                            <div className="text-center max-w-2xl mx-auto mb-12">
                                <span className="text-blue-600 font-bold uppercase tracking-widest text-xs mb-3 block">Jadwal & Periode</span>
                                <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Gelombang Pendaftaran</h2>
                                <p className="text-slate-600">Pantau periode pendaftaran aktif dan bersiaplah untuk gelombang selanjutnya agar tidak ketinggalan kuota.</p>
                            </div>

                            <div className="grid lg:grid-cols-12 gap-8 items-start">
                                {/* Active Wave Card */}
                                {(() => {
                                    const now = new Date();
                                    const activeWave = waves.find(w => {
                                        const start = new Date(w.start_date);
                                        const end = new Date(w.end_date);
                                        end.setHours(23, 59, 59);
                                        return now >= start && now <= end && w.active;
                                    }) || waves.find(w => w.active);

                                    const nextWave = waves.find(w => new Date(w.start_date) > now);

                                    return (
                                        <>
                                            <div className={`${nextWave ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}>
                                                {activeWave ? (
                                                    <div className="bg-white rounded-3xl p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-blue-50 relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>

                                                        <div className="relative z-10">
                                                            <div className="flex flex-wrap items-center gap-3 mb-6">
                                                                <div className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                                                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                                                                    Pendaftaran Sedang Berlangsung
                                                                </div>
                                                                <div className="bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                                                                    TA {activeWave.year}
                                                                </div>
                                                            </div>

                                                            <h3 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">{activeWave.name}</h3>
                                                            <p className="text-slate-500 font-medium mb-8">Periode: {new Date(activeWave.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} — {new Date(activeWave.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

                                                            <div className="grid sm:grid-cols-2 gap-8">
                                                                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 transition-all hover:shadow-md">
                                                                    <div className="flex items-center gap-3 mb-4 text-blue-600">
                                                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                                                            <Clock size={20} />
                                                                        </div>
                                                                        <span className="font-bold text-sm uppercase tracking-wide">Sisa Waktu</span>
                                                                    </div>
                                                                    {(() => {
                                                                        const end = new Date(activeWave.end_date);
                                                                        end.setHours(23, 59, 59);
                                                                        const diff = end - now;
                                                                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

                                                                        return (
                                                                            <div className="flex items-baseline gap-2">
                                                                                <span className="text-4xl font-black text-slate-900">{days > 0 ? days : 0}</span>
                                                                                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Hari Lagi</span>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>

                                                                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 transition-all hover:shadow-md">
                                                                    <div className="flex items-center gap-3 mb-4 text-emerald-600">
                                                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                                                            <Award size={20} />
                                                                        </div>
                                                                        <span className="font-bold text-sm uppercase tracking-wide">Status Kuota</span>
                                                                    </div>
                                                                    <div className="space-y-4">
                                                                        {branches.length > 0 ? (
                                                                            branches.map((b, i) => {
                                                                                const percent = b.quota > 0 ? Math.round((b.filled / b.quota) * 100) : 0;
                                                                                let statusColor = "text-slate-500";
                                                                                let statusText = "Tersedia";

                                                                                if (percent >= 90) {
                                                                                    statusColor = "text-rose-600";
                                                                                    statusText = "Sangat Terbatas";
                                                                                } else if (percent >= 70) {
                                                                                    statusColor = "text-amber-600";
                                                                                    statusText = "Hampir Penuh";
                                                                                } else if (percent > 0) {
                                                                                    statusColor = "text-emerald-600";
                                                                                    statusText = "Sedang Berjalan";
                                                                                }

                                                                                return (
                                                                                    <div key={b.id || i} className={i !== 0 ? "pt-4 border-t border-slate-200/60" : ""}>
                                                                                        <div className="flex justify-between items-end mb-1">
                                                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{b.name}</span>
                                                                                            <span className={`text-sm font-black ${statusColor}`}>{percent}%</span>
                                                                                        </div>
                                                                                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                                                            <div
                                                                                                className={`h-full transition-all duration-1000 ${percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                                                                style={{ width: `${Math.min(100, percent)}%` }}
                                                                                            ></div>
                                                                                        </div>
                                                                                        <div className="flex justify-between items-center mt-1">
                                                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Terisi: {b.filled} / {b.quota}</span>
                                                                                            <span className={`text-[9px] font-black uppercase tracking-widest ${statusColor}`}>{statusText}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })
                                                                        ) : (
                                                                            <div className="text-4xl font-black text-slate-900">0%</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-8">
                                                                <button
                                                                    onClick={onLogin}
                                                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2 group"
                                                                >
                                                                    Daftar di {activeWave.name}
                                                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-white rounded-3xl p-10 text-center border border-slate-100 shadow-sm">
                                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                                            <Calendar size={32} />
                                                        </div>
                                                        <h3 className="text-xl font-bold text-slate-800 mb-2">Pendaftaran Belum Dibuka</h3>
                                                        <p className="text-slate-500">Saat ini pendaftaran belum tersedia. Pantau informasi gelombang selanjutnya di bawah.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Next Wave Info */}
                                            {nextWave && (
                                                <div className="lg:col-span-5">
                                                    <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden h-full">
                                                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl"></div>
                                                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full -ml-10 -mb-10 blur-2xl"></div>

                                                        <div className="relative z-10 flex flex-col h-full">
                                                            <div className="mb-8">
                                                                <div className="bg-white/10 backdrop-blur-md rounded-full px-4 py-1.5 inline-flex items-center gap-2 mb-4">
                                                                    <Calendar size={14} className="text-blue-400" />
                                                                    <span className="text-[10px] font-black uppercase tracking-widest">Coming Soon</span>
                                                                </div>
                                                                <h3 className="text-2xl font-black mb-2">Gelombang Berikutnya</h3>
                                                                <p className="text-slate-400 text-sm">Persiapkan berkas Anda lebih awal untuk proses pendaftaran yang lebih lancar.</p>
                                                            </div>

                                                            <div className="mt-auto space-y-6">
                                                                <div className="p-6 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                                                                    <div className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">{nextWave.name}</div>
                                                                    <div className="text-xl font-black mb-3">Mulai {new Date(nextWave.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                                                        <Clock size={14} />
                                                                        <span>Sesuai kalender akademik {nextWave.year}</span>
                                                                    </div>
                                                                </div>

                                                                <button
                                                                    onClick={() => {
                                                                        const el = document.querySelector('#contact');
                                                                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                                                                    }}
                                                                    className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl hover:bg-blue-50 transition-colors text-sm"
                                                                >
                                                                    Hubungi Kami Untuk Info Detail
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </section>
                )
            }

            {/* FAQ Section */}
            <section id="faq" className="py-16 bg-white">
                <div className="container mx-auto px-4 max-w-3xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-gray-900">{faqTitle}</h2>
                    </div>
                    <div className="space-y-4">
                        {faqs.map((item, index) => (
                            <div key={index} className="border border-gray-200 rounded-xl p-6 hover:border-blue-300 transition bg-gray-50 hover:bg-white">
                                <h3 className="font-bold text-lg text-gray-900 mb-2 flex items-start gap-3">
                                    <span className="text-blue-600 shrink-0">Q:</span> {item.q}
                                </h3>
                                <p className="text-gray-600 pl-8 text-sm leading-relaxed">{item.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer id="contact" className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
                <div className="container mx-auto px-4">
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
                    <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm">
                        {footerCopyright}
                    </div>
                </div>
            </footer>

            {/* Popup Banner Modal */}
            {
                showPopup && settings?.landing_page?.popup_image && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
                        onClick={() => setShowPopup(false)}
                    >
                        <div
                            className="relative max-w-lg w-full animate-scale-in"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Close Button */}
                            <button
                                onClick={() => setShowPopup(false)}
                                className="absolute -top-3 -right-3 w-10 h-10 bg-white rounded-full shadow-xl flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-red-50 transition-all z-10 border border-gray-200"
                                aria-label="Tutup Promo"
                            >
                                <X size={24} />
                            </button>

                            {/* Popup Image */}
                            {settings.landing_page.popup_link ? (
                                <a
                                    href={settings.landing_page.popup_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                >
                                    <img
                                        src={settings.landing_page.popup_image}
                                        alt="Promo Banner"
                                        className="w-full rounded-2xl shadow-2xl cursor-pointer hover:scale-[1.02] transition-transform"
                                    />
                                </a>
                            ) : (
                                <img
                                    src={settings.landing_page.popup_image}
                                    alt="Promo Banner"
                                    className="w-full rounded-2xl shadow-2xl"
                                    loading="lazy"
                                    decoding="async"
                                />
                            )}
                        </div>
                    </div>
                )
            }

            <Suspense fallback={null}>
                {mountAssistant && (
                    <FloatingAssistant aiSettings={settings?.ai_assistant} apiKey={apiKey} realtimeData={realtimeData} />
                )}
            </Suspense>
        </div >
    );
};

export default SchoolWebsite;
