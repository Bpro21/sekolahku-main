import React, { useState, useEffect } from 'react';
import { School, ChevronLeft, User as UserIcon, CalendarClock, Users, GraduationCap, BookOpen, Trophy } from 'lucide-react';
import { supabase } from '../../config/supabase';
import { Button, Input } from '../ui/Elements';
import { logActivity } from '../../utils/activityLogger';

// Helper Component: Countdown Timer
const CountdownTimer = ({ targetDate }) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const distance = new Date(targetDate).getTime() - now;

            if (distance < 0) {
                clearInterval(timer);
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            } else {
                setTimeLeft({
                    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                    minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                    seconds: Math.floor((distance % (1000 * 60)) / 1000)
                });
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [targetDate]);

    return (
        <div className="flex gap-2 justify-center items-center">
            {[
                { v: timeLeft.days, l: 'Hari' },
                { v: timeLeft.hours, l: 'Jam' },
                { v: timeLeft.minutes, l: 'Mnt' },
                { v: timeLeft.seconds, l: 'Dtk' }
            ].map((t, i) => (
                <div key={i} className="flex flex-col items-center">
                    <div className="bg-white dark:bg-slate-800/80 dark:bg-slate-900/80 backdrop-blur-sm border border-purple-200 dark:border-purple-800/50 w-10 h-10 flex items-center justify-center rounded-lg shadow-sm transition-colors duration-300">
                        <span className="text-sm font-bold text-purple-700 dark:text-purple-400 leading-none">{t.v}</span>
                    </div>
                    <span className="text-[8px] uppercase font-bold text-purple-400 dark:text-purple-500 mt-1 tracking-tighter">{t.l}</span>
                </div>
            ))}
        </div>
    );
};

// Helper Component: Display Available Quota
const QuotaDisplay = ({ units, registrations, academicYears, indentSettings }) => {
    const [activeTab, setActiveTab] = useState(0); // 0: Regular, 1: Indent External, 2: Indent Internal

    if (!units || !academicYears) {
        return <div className="text-xs text-slate-400 italic mb-6">Memuat data kuota...</div>;
    }

    if (units.length === 0) {
        return <div className="text-xs text-slate-400 italic mb-6 text-center border p-4 rounded-xl bg-slate-50">Belum ada Unit/Jurusan yang dibuka untuk pendaftaran saat ini.</div>;
    }

    const defaultAY = academicYears.find(ay => ay.is_default);
    const indentAY = academicYears.find(ay => ay.indent_enabled && !ay.is_default);
    const isInternalActive = indentSettings?.active;

    // Determine which TA to show
    let currentAY = null;
    let themeColor = 'blue';

    if (activeTab === 0) {
        currentAY = defaultAY;
        themeColor = 'blue';
    } else if (activeTab === 1) {
        currentAY = indentAY;
        themeColor = 'purple';
    } else if (activeTab === 2) {
        // Internal indent might target specific years in settings, 
        // but for quota display we usually show the indent year configured in academic_years
        // or just use the same indentAY for display purposes.
        currentAY = indentAY || defaultAY;
        themeColor = 'emerald';
    }

    if (!currentAY) return null;

    const themes = {
        blue: {
            bg: 'bg-blue-50/50',
            border: 'border-blue-100',
            tabActive: 'bg-blue-600 text-white shadow-md shadow-blue-100',
            accent: 'text-blue-600',
            bar: 'bg-blue-600'
        },
        purple: {
            bg: 'bg-purple-50/50',
            border: 'border-purple-100',
            tabActive: 'bg-purple-600 text-white shadow-md shadow-purple-100',
            accent: 'text-purple-600',
            bar: 'bg-purple-600'
        },
        emerald: {
            bg: 'bg-emerald-50/50',
            border: 'border-emerald-100',
            tabActive: 'bg-emerald-600 text-white shadow-md shadow-emerald-100',
            accent: 'text-emerald-600',
            bar: 'bg-emerald-600'
        }
    };

    const theme = themes[themeColor];

    return (
        <div className="mb-8 animate-fade-in group/quota">
            {/* Tab Selector */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-900 dark:bg-slate-800/50 rounded-xl mb-4 gap-1 border border-slate-200 dark:border-slate-700 shadow-inner">
                {defaultAY && (
                    <button
                        onClick={() => setActiveTab(0)}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${activeTab === 0 ? themes.blue.tabActive : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-200 hover:bg-white dark:bg-slate-800/50 dark:hover:bg-slate-700/50'}`}
                    >
                        Pendaftaran Reguler
                    </button>
                )}
                {indentAY && (
                    <button
                        onClick={() => setActiveTab(1)}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${activeTab === 1 ? themes.purple.tabActive : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-200 hover:bg-white dark:bg-slate-800/50 dark:hover:bg-slate-700/50'}`}
                    >
                        Inden Eksternal
                    </button>
                )}
                {isInternalActive && (
                    <button
                        onClick={() => setActiveTab(2)}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${activeTab === 2 ? themes.emerald.tabActive : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-200 hover:bg-white dark:bg-slate-800/50 dark:hover:bg-slate-700/50'}`}
                    >
                        Inden Internal
                    </button>
                )}
            </div>

            {/* Countdown for Indent */}
            {activeTab === 1 && indentAY?.indent_end_date && (
                <div className="mb-6 text-center animate-slide-down bg-purple-50/30 py-3 rounded-2xl border border-purple-100/50">
                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                        <span className="w-8 h-px bg-purple-200"></span>
                        Sisa Masa Pendaftaran Inden
                        <span className="w-8 h-px bg-purple-200"></span>
                    </p>
                    <CountdownTimer targetDate={`${indentAY.indent_end_date}T23:59:59`} />
                </div>
            )}

            {/* Quota Card */}
            <div className={`${theme.bg} border ${theme.border} rounded-2xl p-5 shadow-sm overflow-hidden relative transition-all duration-500`}>
                <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTab === 0 ? 'bg-blue-100 text-blue-600' : activeTab === 1 ? 'bg-purple-100 text-purple-600' : 'bg-emerald-100 text-emerald-600'} shadow-sm border border-white/50`}>
                            <School size={20} />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white leading-none mb-1.5 uppercase tracking-wide">Kursi Tersedia</h4>
                            <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${activeTab === 0 ? 'bg-blue-600 text-white' : activeTab === 1 ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white'}`}>
                                    TA {currentAY.year}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                    {activeTab === 0 ? 'Reguler' : activeTab === 1 ? 'Inden Eksternal' : 'Inden Internal'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {units.map((unit, idx) => {
                        let limit = parseInt(unit.quota) || 0;
                        if (unit.academic_configs && unit.academic_configs[currentAY.id]) {
                            limit = parseInt(unit.academic_configs[currentAY.id].quota) || 0;
                        }

                        const hasMajors = unit.majors && unit.majors.length > 0;

                        return (
                            <div key={idx} className="bg-white dark:bg-slate-800/40 p-3 rounded-xl border border-white/60 hover:bg-white dark:bg-slate-800/80 transition-colors">
                                {hasMajors ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                            <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{unit.name}</p>
                                        </div>
                                        {unit.majors.map((major, mIdx) => {
                                            // Use major-specific quota if available, otherwise fallback to unit quota / number of majors
                                            const majorQuota = major.quota || Math.floor(limit / (unit.majors.length || 1));

                                            const filled = registrations.filter(r =>
                                                r.unit_id === unit.id &&
                                                r.major === major.name &&
                                                (r.academic_year === currentAY.year || r.wave_name?.includes(currentAY.year)) &&
                                                !['draft', 'rejected', 'mengundurkan_diri'].includes(r.status)
                                            ).length;
                                            const remaining = Math.max(0, majorQuota - filled);
                                            const percent = majorQuota > 0 ? Math.round((filled / majorQuota) * 100) : 0;

                                            return (
                                                <div key={mIdx} className="pl-3 border-l border-slate-200">
                                                    <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1.5">
                                                        <span>{major.name}</span>
                                                        <span className={remaining < 10 ? 'text-red-500' : theme.accent}>
                                                            {remaining} <span className="text-[8px] font-normal opacity-60">Kursi</span>
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-200/50 rounded-full h-1.5 overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all duration-1000 ${theme.bar}`} style={{ width: `${percent}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="group">
                                        <div className="flex justify-between text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-2">
                                            <span>{unit.name}</span>
                                            <span className={`font-bold ${registrations.filter(r => r.unit_id === unit.id && (r.academic_year === currentAY.year || r.wave_name?.includes(currentAY.year)) && !['draft', 'rejected', 'mengundurkan_diri'].includes(r.status)).length > limit - 10 ? 'text-red-500' : theme.accent}`}>
                                                {Math.max(0, limit - registrations.filter(r => r.unit_id === unit.id && (r.academic_year === currentAY.year || r.wave_name?.includes(currentAY.year)) && !['draft', 'rejected', 'mengundurkan_diri'].includes(r.status)).length)}
                                                <span className="text-[9px] font-normal text-slate-400 uppercase ml-1">Kursi</span>
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200/50 rounded-full h-2 overflow-hidden shadow-inner">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${theme.bar}`}
                                                style={{ width: `${Math.round(((registrations.filter(r => r.unit_id === unit.id && (r.academic_year === currentAY.year || r.wave_name?.includes(currentAY.year)) && !['draft', 'rejected', 'mengundurkan_diri'].includes(r.status)).length) / (limit || 1)) * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};



const SchoolStats = () => {
    const stats = [
        { icon: Users, count: '1200+', label: 'Siswa', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        { icon: GraduationCap, count: '85+', label: 'Guru & Staff', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        { icon: BookOpen, count: '15+', label: 'Ekstrakurikuler', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
        { icon: Trophy, count: '50+', label: 'Penghargaan', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 mb-8 animate-fade-in">
            {stats.map((stat, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center group cursor-default">
                    <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                        <stat.icon size={20} className={stat.color} />
                    </div>
                    <div className="space-y-0.5">
                        <h4 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">{stat.count}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default function AuthScreen({ showToast, onBack }) {
    const [isLogin, setIsLogin] = useState(true);
    const [loginError, setLoginError] = useState(null); // Alert state

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    // Registration Step State
    const [phoneVerified, setPhoneVerified] = useState(false);

    // OTP State
    const [otp, setOtp] = useState('');
    const [serverOtp, setServerOtp] = useState(null);
    const [otpCreatedAt, setOtpCreatedAt] = useState(null); // Untuk expiry 15 menit
    const [otpSent, setOtpSent] = useState(false);
    const [otpTimer, setOtpTimer] = useState(0);

    const [loading, setLoading] = useState(false);

    // Data State
    const [settings, setSettings] = useState({});
    const [academicYears, setAcademicYears] = useState(null);
    const [units, setUnits] = useState(null);
    const [registrations, setRegistrations] = useState([]);
    const [indentSettings, setIndentSettings] = useState(null);

    // Slider State
    const [currentSlide, setCurrentSlide] = useState(0);




    // Initial Data Fetch
    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // Settings
                const { data: settingsData } = await supabase.from('app_settings').select('*').eq('id', 'main').single();
                if (settingsData) setSettings(settingsData);

                // Academic Years
                const { data: ayData } = await supabase.from('academic_years').select('*');
                if (ayData) setAcademicYears(ayData);

                // Units
                const { data: unitsData } = await supabase.from('units').select('*');
                // Filter locally or in query. Assuming 'open' col exists.
                const fetchedUnits = (unitsData || []).filter(u => u.open !== false);
                setUnits(fetchedUnits);

                // Registrations (For Quota)
                const { data: regsData } = await supabase.from('registrations').select('*');
                setRegistrations(regsData || []);

                // Indent Settings (Internal)
                const { data: indentData } = await supabase.from('indent_settings').select('*').maybeSingle();
                if (indentData) setIndentSettings(indentData);

            } catch (e) {
                console.error("AuthScreen Data Load Error:", e);
            }
        };
        fetchAllData();
    }, []);

    // OTP Timer
    useEffect(() => {
        if (otpTimer > 0) {
            const timer = setInterval(() => setOtpTimer(prev => prev - 1), 1000);
            return () => clearInterval(timer);
        }
    }, [otpTimer]);

    // Slider Logic
    useEffect(() => {
        if (settings.auth_backgrounds?.length > 1) {
            const timer = setInterval(() => {
                setCurrentSlide(prev => (prev + 1) % settings.auth_backgrounds.length);
            }, 5000);
            return () => clearInterval(timer);
        }
    }, [settings.auth_backgrounds]);

    // 1. Send OTP (Supports Fonnte and Baileys)
    const sendOtp = async (e) => {
        if (e) e.preventDefault();

        if (!phone) {
            showToast('Nomor WhatsApp wajib diisi.', 'error');
            return;
        }

        const waProvider = settings.wa_provider || 'fonnte';

        // Validate provider configuration
        if (waProvider === 'fonnte' && !settings.fonnte_token) {
            showToast('Token Fonnte belum dikonfigurasi. Hubungi Admin.', 'error');
            return;
        }
        if (waProvider === 'baileys' && !settings.baileys_server_url) {
            showToast('URL Server Baileys belum dikonfigurasi. Hubungi Admin.', 'error');
            return;
        }

        setLoading(true);

        try {
            // Check if Phone already registered in user_lookup table
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            const { data: lookupData, error: lookupError } = await supabase
                .from('user_lookup')
                .select('*')
                .eq('phone', cleanPhone)
                .single();

            if (lookupData) {
                throw new Error("Nomor WhatsApp ini sudah terdaftar. Silakan Login.");
            }

            const code = Math.floor(100000 + Math.random() * 900000).toString();

            // Use Custom Template if available
            const message = settings.template_otp
                ? settings.template_otp.replace('{otp}', code)
                : `*${code}* adalah kode verifikasi OTP Anda. Jangan berikan kode ini kepada siapapun.`;

            let success = false;

            // ========== BAILEYS ==========
            if (waProvider === 'baileys') {
                const baileysUrl = settings.baileys_server_url || 'http://localhost:3001';

                // Format phone number for Baileys (should be 62xxx format)
                let targetPhone = cleanPhone;
                if (targetPhone.startsWith('0')) {
                    targetPhone = '62' + targetPhone.substring(1);
                }

                const response = await fetch(`${baileysUrl}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: targetPhone,
                        message: message
                    })
                });

                const result = await response.json();
                if (!response.ok || result.error) {
                    throw new Error(result.error || result.message || 'Gagal mengirim OTP via Baileys');
                }
                success = true;
            }
            // ========== FONNTE ==========
            else {
                const formData = new FormData();
                formData.append('target', phone);
                formData.append('message', message);
                formData.append('countryCode', '62');

                const response = await fetch('https://api.fonnte.com/send', {
                    method: 'POST',
                    headers: { 'Authorization': settings.fonnte_token },
                    body: formData
                });

                const result = await response.json();
                if (result.status === false) {
                    throw new Error(result.reason || 'Gagal mengirim OTP via Fonnte');
                }
                success = true;
            }

            if (success) {
                setServerOtp(code);
                setOtpCreatedAt(Date.now()); // Simpan waktu OTP dibuat
                setOtpSent(true);
                setOtpTimer(60);
                showToast('Kode OTP terkirim ke WhatsApp Anda. Berlaku 15 menit.');
            }

        } catch (error) {
            console.error(error);
            showToast(`${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    // 2. Verify OTP (Unlock Full Form)
    const verifyOtp = (e) => {
        e.preventDefault();
        setLoading(true);

        // Cek apakah OTP sudah expired (15 menit = 900000 ms)
        const OTP_EXPIRY_MS = 15 * 60 * 1000; // 15 menit
        if (otpCreatedAt && (Date.now() - otpCreatedAt) > OTP_EXPIRY_MS) {
            showToast('Kode OTP sudah kedaluwarsa. Silakan kirim ulang.', 'error');
            setServerOtp(null);
            setOtpCreatedAt(null);
            setOtp('');
            setLoading(false);
            return;
        }

        if (otp !== serverOtp) {
            showToast('Kode OTP salah!', 'error');
            setLoading(false);
            return;
        }

        showToast('Nomor WhatsApp Terverifikasi!');
        setPhoneVerified(true);
        setOtpSent(false); // Hide OTP form
        setLoading(false);
    };

    // 3. Final Registration (With Full Data)
    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (!name || !email || !password || !confirmPassword) {
            showToast('Mohon lengkapi data diri Anda.', 'error');
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            showToast('Konfirmasi password tidak cocok', 'error');
            setLoading(false);
            return;
        }
        try {
            const sanitizedPhone = phone.replace(/[^0-9]/g, '');

            // SUPABASE SIGNUP
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        displayName: name,
                        phone: sanitizedPhone
                    }
                }
            });

            if (authError) throw authError;

            // 1. Create Main Profile (non-blocking - RLS may fail but user is still created)
            try {
                await supabase.from('profiles').insert({
                    id: authData.user.id,
                    name,
                    email,
                    phone,
                    role: 'user',
                });
            } catch (profileError) {
                console.warn("Profile creation skipped (RLS issue):", profileError);
            }

            // 2. Create Public Lookup Entry
            try {
                // sanitizedPhone already declared above
                await supabase.from('user_lookup').insert({
                    phone: sanitizedPhone,
                    email: email,
                    uid: authData.user.id
                });
            } catch (lookupError) {
                console.warn("Lookup creation skipped:", lookupError);
            }

            // 3. Create CRM Lead & Conversation (Idempotent)
            try {
                // Check if lead already exists for this phone
                const { data: existingLead } = await supabase
                    .from('leads')
                    .select('id')
                    .eq('phone', sanitizedPhone)
                    .maybeSingle();

                let leadId = existingLead?.id;

                if (!leadId) {
                    const { data: leadData } = await supabase.from('leads').insert({
                        name: name,
                        phone: sanitizedPhone,
                        source: 'Website Register',
                        status: 'followup',
                        notes: 'User registered via website'
                    }).select().single();

                    if (leadData) leadId = leadData.id;
                } else {
                    // Update existing lead name/status if needed
                    await supabase.from('leads').update({
                        name: name,
                        status: 'followup',
                        updated_at: new Date().toISOString()
                    }).eq('id', leadId);
                }

                if (leadId) {
                    // Check if conversation exists
                    const { data: existingConv } = await supabase
                        .from('conversations')
                        .select('id')
                        .eq('lead_id', leadId)
                        .maybeSingle();

                    if (!existingConv) {
                        await supabase.from('conversations').insert({
                            lead_id: leadId,
                            phone: sanitizedPhone,
                            name: name,
                            status: 'active',
                            messages: []
                        });
                    }
                }
            } catch (leadError) {
                console.warn("Lead/Conversation sync skipped:", leadError);
            }

            showToast('Pendaftaran Berhasil! Silakan Login.');
            await logActivity(authData.user, 'CREATE', `User Registered: ${name}`);

            // Switch to Login
            setIsLogin(true);
            setPhoneVerified(false);
            setOtpSent(false);
            setPassword('');
            setConfirmPassword('');
        } catch (err) {
            console.error(err);
            showToast(`Gagal daftar: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let loginEmail = email;

            // Sanitize Input: keep only digits
            // e.g. "0812-3456" -> "08123456"
            const cleanInput = email.replace(/[^0-9]/g, '');
            const isPhone = cleanInput.length >= 10;

            if (isPhone) {
                console.log("Login attempt with phone:", cleanInput);
                let foundEmail = null;

                // Generate variants for BOTH strategies
                const variants = [cleanInput];
                if (cleanInput.startsWith('0')) variants.push('62' + cleanInput.substring(1));
                else if (cleanInput.startsWith('62')) variants.push('0' + cleanInput.substring(2));
                else if (cleanInput.startsWith('+62')) variants.push('0' + cleanInput.substring(3));

                // --- Strategy 1: Check Public Lookup (Fastest) ---
                for (const v of variants) {
                    try {
                        const { data: lookupData } = await supabase
                            .from('user_lookup')
                            .select('email')
                            .eq('phone', v)
                            .single();

                        if (lookupData) {
                            foundEmail = lookupData.email;
                            console.log("Found via Lookup:", v);
                            break;
                        }
                    } catch (e) {
                        // silently ignore
                    }
                }

                // --- Strategy 2: Deep Search (Profiles Table) ---
                if (!foundEmail) {
                    try {
                        for (const v of variants) {
                            // Supabase filtered query
                            const { data: profileData } = await supabase
                                .from('profiles')
                                .select('email')
                                .eq('phone', v)
                                .single();

                            if (profileData) {
                                foundEmail = profileData.email;
                                console.log("Found via Deep Search:", v);
                                break;
                            }
                        }
                    } catch (e) {
                        console.error("Strategy 2 failed:", e);
                    }
                }

                if (foundEmail) {
                    loginEmail = foundEmail;
                } else {
                    throw new Error("Nomor WhatsApp belum terdaftar. Pastikan Admin sudah melakukan Sync Login.");
                }
            }

            // Proceed to Auth
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: password
            });

            if (authError) throw authError;

            await logActivity(authData.user, 'LOGIN', 'User Logged In');
            showToast('Login berhasil!');

        } catch (err) {
            console.error("Login Error:", err);
            let msg = err.message;
            if (msg.includes('user-not-found') || msg.includes('invalid-credential')) msg = "Username atau Password salah."; // Custom Alert Message

            setLoginError(msg); // Set Box Alert
            showToast(`Gagal login: ${msg}`, 'error');
            setLoading(false);
        }
    };
    const resetState = () => {
        setIsLogin(!isLogin);
        // Reset all form fields
        setName(''); setEmail(''); setPassword(''); setConfirmPassword(''); setPhone('');
        // Reset Steps
        setPhoneVerified(false);
        setOtpSent(false); setOtp(''); setServerOtp(null); setOtpTimer(0);
    };

    return (
        <div className="h-screen w-full flex bg-white dark:bg-slate-800 dark:bg-slate-950 overflow-hidden relative font-sans transition-colors duration-300">
            {/* Left Side - Image/Slider (Hidden on Mobile) */}
            <div className="hidden md:flex md:w-[60%] lg:w-[65%] bg-slate-900 relative">
                <div className="absolute inset-0 bg-slate-900 select-none">
                    {/* Background Slideshow */}
                    {settings.auth_backgrounds?.length > 0 ? (
                        settings.auth_backgrounds.map((bg, idx) => (
                            <React.Fragment key={idx}>
                                {/* Layer 1: Blurred Backdrop (Fills screen with ambience) */}
                                <div
                                    className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 blur-3xl scale-125 ${currentSlide === idx ? 'opacity-50' : 'opacity-0'}`}
                                    style={{ backgroundImage: `url(${bg})` }}
                                />
                                {/* Layer 2: Main Image (Fits screen without cropping) */}
                                <div
                                    className={`absolute inset-0 bg-contain bg-center bg-no-repeat transition-opacity duration-1000 ${currentSlide === idx ? 'opacity-100' : 'opacity-0'}`}
                                    style={{ backgroundImage: `url(${bg})` }}
                                />
                            </React.Fragment>
                        ))
                    ) : (
                        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/60 to-transparent"></div>
                </div>

                <div className="relative z-10 p-16 flex flex-col justify-center h-full max-w-4xl mx-auto">
                    <div className="w-20 h-20 bg-white dark:bg-slate-800/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center mb-8 shadow-xl skew-y-0 transform hover:scale-105 transition duration-500">
                        {settings.app_logo ? (
                            <img src={settings.app_logo} alt="Logo" className="w-12 h-12 object-contain" />
                        ) : (
                            <School size={40} className="text-white" />
                        )}
                    </div>
                    <h2 className="text-5xl font-extrabold mb-4 text-white leading-tight tracking-tight drop-shadow-sm">{settings.app_name || 'PSB Online'}</h2>
                    <h3 className="text-2xl font-normal text-emerald-100 mb-8 border-b border-emerald-500/30 pb-4 inline-block">{settings.school_name || 'Portal Penerimaan Santri Baru'}</h3>
                    <p className="text-emerald-50/90 text-lg leading-relaxed max-w-xl">
                        {settings.welcome_message || 'Bergabunglah bersama kami mewujudkan generasi berakhlak mulia, cerdas, dan berprestasi.'}
                    </p>

                    {/* Slide Indicators */}
                    {settings.auth_backgrounds?.length > 1 && (
                        <div className="flex gap-2 mt-12">
                            {settings.auth_backgrounds.map((_, i) => (
                                <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${currentSlide === i ? 'w-12 bg-emerald-400' : 'w-2 bg-white dark:bg-slate-800/20'}`} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Side - Form (Full Width on Mobile) */}
            <div className="w-full md:w-[40%] lg:w-[35%] flex flex-col h-full bg-white dark:bg-slate-800 dark:bg-slate-900 relative z-10 transition-colors duration-300">
                {/* Decorative Gradient Line */}
                <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 absolute top-0 left-0 z-30"></div>

                {/* Navbar / Back Button */}
                <div className="absolute top-6 left-6 z-20">
                    <button onClick={onBack} className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors font-medium px-3 py-2 rounded-lg hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-sm">
                        <ChevronLeft size={18} />
                        <span>Kembali</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto w-full">
                    <div className="min-h-full flex flex-col justify-center px-6 py-12 md:px-12 w-full max-w-[480px] mx-auto">
                        {/* Mobile Only Branding */}
                        <div className="md:hidden text-center mb-8 mt-4">
                            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mx-auto mb-3 border border-emerald-100 dark:border-emerald-800">
                                {settings.app_logo ? (
                                    <img src={settings.app_logo} alt="Logo" className="w-8 h-8 object-contain" />
                                ) : (
                                    <School size={28} className="text-emerald-600 dark:text-emerald-400" />
                                )}{' '}
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white">{settings.app_name || 'PSB Online'}</h2>
                        </div>

                        <div className="mb-6">
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white dark:text-white mb-2 tracking-tight">
                                {isLogin ? 'Selamat Datang' : (phoneVerified ? 'Lengkapi Data' : 'Verifikasi WhatsApp')}
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                {isLogin && 'Masuk untuk melanjutkan proses pendaftaran.'}
                                {!isLogin && !otpSent && !phoneVerified && 'Masukkan nomor WhatsApp aktif Anda untuk memulai.'}
                                {!isLogin && otpSent && !phoneVerified && `Masukkan 6 digit kode yang dikirim ke +62...${phone.slice(-4)}`}
                                {!isLogin && phoneVerified && 'WhatsApp terverifikasi! Silahkan lengkapi data akun Anda.'}
                            </p>
                        </div>

                        {/* ==================== REGISTER STEP 1: INPUT PHONE ==================== */}
                        {!isLogin && !otpSent && !phoneVerified && (
                            <form onSubmit={sendOtp} className="space-y-4 animate-fade-in mb-8">
                                <Input
                                    label="Nomor WhatsApp"
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    required
                                    placeholder="0812345xxxxx"
                                    helperText="Kami akan mengirimkan kode verifikasi ke nomor ini."
                                />
                                <Button type="submit" disabled={loading} className="w-full py-3.5 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200/50 rounded-xl font-bold">
                                    {loading ? 'Mengirim...' : 'Kirim Kode Verifikasi'}
                                </Button>
                            </form>
                        )}

                        {/* ==================== LOGIN FORM ==================== */}
                        {isLogin && (
                            <form onSubmit={(e) => { setLoginError(null); handleLogin(e); }} className="space-y-4 animate-fade-in">
                                {loginError && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 animate-pulse">
                                        <div className="shrink-0">⚠️</div>
                                        <div>{loginError}</div>
                                    </div>
                                )}
                                <Input label="Email / No. WhatsApp" type="text" value={email} onChange={e => { setEmail(e.target.value); setLoginError(null); }} required placeholder="Email atau Nomor WhatsApp (Contoh: 0812...)" />
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Kata Sandi</label>
                                        {isLogin && <a href="#" className="text-xs text-emerald-600 hover:underline">Lupa password?</a>}
                                    </div>
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400 text-sm" />
                                </div>
                                <Button type="submit" disabled={loading} className="w-full py-3.5 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200/50 rounded-xl font-bold">
                                    {loading ? 'Memproses...' : 'Masuk Sekarang'}
                                </Button>
                            </form>
                        )}

                        {!isLogin && !otpSent && (
                            <>
                                <QuotaDisplay
                                    units={units}
                                    registrations={registrations}
                                    academicYears={academicYears}
                                    indentSettings={indentSettings}
                                />
                            </>
                        )}

                        {/* ==================== REGISTER STEP 2: VERIFY OTP ==================== */}
                        {!isLogin && otpSent && !phoneVerified && (
                            <form onSubmit={verifyOtp} className="space-y-5 animate-fade-in">
                                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                                    <p className="text-sm text-slate-600 mb-2">Kode OTP (6 Digit)</p>
                                    <input
                                        type="number"
                                        value={otp}
                                        onChange={e => { if (e.target.value.length <= 6) setOtp(e.target.value) }}
                                        className="text-center text-2xl font-bold bg-white dark:bg-slate-800 w-full py-4 tracking-[0.5em] rounded-lg border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="------"
                                        autoFocus
                                    />
                                </div>
                                <Button type="submit" disabled={loading} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold">
                                    {loading ? 'Memverifikasi...' : 'Verifikasi WhatsApp'}
                                </Button>
                                <div className="text-center mt-4">
                                    {otpTimer > 0 ? (
                                        <p className="text-xs text-slate-400">Kirim ulang dalam {otpTimer}s</p>
                                    ) : (
                                        <button type="button" onClick={sendOtp} disabled={loading} className="text-sm text-emerald-600 hover:underline font-medium">
                                            Kirim Ulang Kode
                                        </button>
                                    )}
                                    <button type="button" onClick={() => { setOtpSent(false); }} className="block w-full mt-4 text-sm text-slate-400 hover:text-slate-600">
                                        Ganti Nomor HP
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* ==================== REGISTER STEP 3: FULL FORM ==================== */}
                        {!isLogin && phoneVerified && (
                            <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
                                <Input label="Nomor WhatsApp" value={phone} disabled className="bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200" />
                                <Input label="Nama Lengkap Wali" value={name} onChange={e => setName(e.target.value)} required placeholder="Contoh: Budi Santoso" />
                                <Input label="Alamat Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="nama@email.com" />
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Kata Sandi</label>
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Konfirmasi Kata Sandi</label>
                                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400 text-sm" />
                                </div>

                                <Button type="submit" disabled={loading} className="w-full py-3.5 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200/50 rounded-xl font-bold">
                                    {loading ? 'Memproses...' : 'Buat Akun Sekarang'}
                                </Button>
                            </form>
                        )}

                        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                            <p className="text-sm text-slate-600">
                                {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
                                <button onClick={resetState} className="text-emerald-700 font-bold hover:underline transition-colors">
                                    {isLogin ? 'Daftar Sekarang' : 'Login di sini'}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="py-4 text-center text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-800 dark:bg-slate-900 absolute bottom-0 w-full transition-colors duration-300">
                    &copy; 2025 {settings.app_name || 'Apps'}. Powered by Muhamad Bilal Pangestu.
                </div>
            </div>
        </div>
    );
}
