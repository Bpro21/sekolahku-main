import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { Settings, Save, Upload, Trash2, Image as ImageIcon, LayoutDashboard, Globe, Monitor, Briefcase, Bot, Phone, BookOpen, Plus, HelpCircle, Bell, Search, Activity, MapPin, Info } from 'lucide-react';
import { Card, Button, Input } from '../ui/Elements';
import { fileToBase64 } from '../../utils/helpers';

export default function AdminWebsiteSettings({ showToast }) {
    const [settings, setSettings] = useState({
        school_name: '',
        app_name: 'PSB Online',
        app_version: '',
        app_logo: '',
        welcome_message: '',
        auth_backgrounds: [],
        app_template: 'default',
        seo: {
            title: '',
            description: '',
            keywords: '',
            gtm_id: '',
            pixel_id: ''
        },
        landing_page: {
            announcement_bar: '',
            hero_badge: '',
            hero_title: '',
            hero_title_color_1: '#ffffff',
            hero_title_color_2: '#fbbf24',
            hero_subtitle: '',
            hero_btn_text: 'Daftar Sekarang',
            brochure_link: '',
            hero_bg: '',
            contact_wa: '',
            contact_office: '',
            contact_email: '',
            address: '',
            maps_link: '',
            footer_desc: '',
            footer_copyright: '© 2025 Bilal21. All rights reserved.',
            cta_bg_color: '#1e3a8a',
            cta_title: 'Jangan Lewatkan Kesempatan Emas Ini!',
            cta_title_color: '#ffffff',
            cta_desc: 'Kuota terbatas untuk gelombang pertama. Daftarkan putra-putri Anda sekarang dan dapatkan prioritas seleksi serta potongan biaya masuk.',
            cta_desc_color: '#bfdbfe',
            cta_btn1_text: 'Ambil Kuota Sekarang',
            cta_btn2_text: 'Konsultasi via WA',
            cta_wa_number: '',
            faq_title: 'Pertanyaan Sering Diajukan',
            faqs: [
                { q: 'Kapan batas akhir pendaftaran Gelombang 1?', a: 'Pendaftaran Gelombang 1 ditutup pada tanggal 30 November 2025.' },
                { q: 'Apakah ada beasiswa prestasi?', a: 'Ya, kami menyediakan beasiswa potongan DSP 50% untuk juara 1-3 tingkat kota/provinsi.' },
                { q: 'Bagaimana sistem pembayarannya?', a: 'Pembayaran dapat dicicil hingga 3x selama satu semester pertama.' }
            ],
            popup_enabled: false,
            popup_image: '',
            popup_link: '',
            popup_show_once: true
        },
        ai_assistant: {
            active: false,
            bot_name: 'Asisten Sekolah',
            welcome_msg: 'Halo! Ada yang bisa saya bantu?',
            persona: 'Anda adalah Customer Service sekolah yang ramah.',
            knowledge_base: ''
        }
    });

    const [activeSection, setActiveSection] = useState('branding'); // branding, landing, contact, ai, seo
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('*')
                    .eq('id', 'main')
                    .single();

                if (error) {
                    if (error.code !== 'PGRST116') { // Ignore "Row not found" error, just use defaults
                        console.error("Fetch Settings Error:", error);
                    }
                }

                if (data) {
                    setSettings(prev => ({ ...prev, ...data }));
                }
            } catch (e) {
                console.error("Failed to fetch settings", e);
                showToast("Gagal memuat pengaturan", "error");
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSeoChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            seo: { ...prev.seo, [field]: value }
        }));
    };

    const handleLandingPageChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            landing_page: { ...prev.landing_page, [field]: value }
        }));
    };

    const handleAiChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            ai_assistant: { ...prev.ai_assistant, [field]: value }
        }));
    };

    const handleAnnouncementChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            announcement: {
                ...(prev.announcement || {}),
                [field]: value
            }
        }));
    };

    const handleUploadLogo = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const base64 = await fileToBase64(file);
            setSettings(prev => ({ ...prev, app_logo: base64 }));
            showToast('Logo berhasil diperbarui.');
        } catch (error) { showToast(error.message, 'error'); } finally { setUploading(false); }
    };

    const handleUploadBg = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const base64 = await fileToBase64(file);
            setSettings(prev => ({
                ...prev,
                auth_backgrounds: [...(prev.auth_backgrounds || []), base64]
            }));
            showToast('Gambar carousel ditambahkan.');
        } catch (error) { showToast(error.message, 'error'); } finally { setUploading(false); }
    };

    const saveSettings = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({ id: 'main', ...settings });

            if (error) throw error;
            showToast('Semua perubahan berhasil disimpan!');
        } catch (error) {
            console.error("Save Error:", error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800 dark:text-white transition-colors">
                <Globe className="text-emerald-600" /> Pengaturan Website
            </h2>

            {/* Reverting to 4 logical tabs as requested */}
            <div className="flex gap-2 border-b border-slate-200 mb-6 overflow-x-auto pb-1 scrollbar-hide">
                {[
                    { id: 'branding', label: 'Branding & Tema', icon: Globe },
                    { id: 'seo', label: 'SEO & Analytics', icon: Search },
                    { id: 'landing', label: 'Halaman Depan (Hero)', icon: LayoutDashboard },
                    { id: 'programs', label: 'Program Unggulan', icon: BookOpen },
                    { id: 'cta', label: 'Call To Action (CTA)', icon: Briefcase },
                    { id: 'faq', label: 'FAQ', icon: HelpCircle },
                    { id: 'popup', label: 'Popup Banner', icon: ImageIcon },
                    { id: 'contact', label: 'Kontak & Informasi', icon: Phone },
                    { id: 'ai', label: 'AI Advisor', icon: Bot },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id)}
                        className={`px-6 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeSection === tab.id ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/20 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    >
                        <tab.icon size={18} /> {tab.label}
                    </button>
                ))}
            </div>

            <div className="space-y-6 animate-fade-in">
                {/* 1. Branding & Identity & Themes */}
                {activeSection === 'branding' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="p-6">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2 italic"><Briefcase size={16} /> Identitas Dasar</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Nama Sekolah (Baris 2)"
                                        value={settings.school_name}
                                        onChange={e => handleChange('school_name', e.target.value)}
                                        placeholder="Sekolah Islam Terpadu Cendekia"
                                    />
                                    <Input
                                        label="Nama Aplikasi (Baris 1)"
                                        value={settings.app_name}
                                        onChange={e => handleChange('app_name', e.target.value)}
                                        placeholder="PSB ONLINE"
                                    />
                                    <Input
                                        label="Versi Aplikasi"
                                        value={settings.app_version || ''}
                                        onChange={e => handleChange('app_version', e.target.value)}
                                        placeholder="v1.0"
                                    />
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700">Logo Header</label>
                                        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border">
                                            {settings.app_logo ? (
                                                <div className="relative w-16 h-16 bg-white rounded-lg border p-1 shadow-sm shrink-0">
                                                    <img src={settings.app_logo} alt="Logo" className="w-full h-full object-contain" />
                                                    <button onClick={() => handleChange('app_logo', '')} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600"><Trash2 size={10} /></button>
                                                </div>
                                            ) : (
                                                <div className="w-16 h-16 rounded-lg bg-slate-100 border-2 border-dashed flex items-center justify-center text-slate-400 shrink-0"><ImageIcon size={20} /></div>
                                            )}
                                            <div className="flex-1">
                                                <div className="relative">
                                                    <Button variant="secondary" className="text-xs py-1.5 w-full">{uploading ? '...' : 'Ganti Logo'}</Button>
                                                    <input type="file" accept="image/*" onChange={handleUploadLogo} className="absolute inset-0 opacity-0 cursor-pointer" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-6">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2 italic"><Settings size={16} /> Tema & Template Sidebar</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { id: 'default', label: 'Emerald', color: 'bg-emerald-600' },
                                        { id: 'ocean', label: 'Ocean', color: 'bg-cyan-600' },
                                        { id: 'midnight', label: 'Midnight', color: 'bg-slate-900' },
                                        { id: 'sunset', label: 'Sunset', color: 'bg-orange-500' }
                                    ].map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => handleChange('app_template', t.id)}
                                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${settings.app_template === t.id ? 'border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-300'}`}
                                        >
                                            <div className={`w-8 h-8 rounded-full ${t.color} shadow-sm border border-white/20`} />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            <Card className="p-6">
                                <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 border-b pb-2 italic"><Monitor size={16} /> Login Experience</h3>
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Warna Header Mobile</label>
                                        <div className="flex gap-3 mt-1">
                                            {['emerald', 'blue', 'slate', 'indigo', 'rose'].map(c => (
                                                <button key={c} className={`w-8 h-8 rounded-full border-4 ${settings.app_template === c ? 'border-emerald-500 scale-110 shadow-lg' : 'border-white dark:border-slate-800'}`} style={{ backgroundColor: c === 'emerald' ? '#059669' : c === 'blue' ? '#2563eb' : c === 'slate' ? '#475569' : c === 'indigo' ? '#4f46e5' : '#e11d48' }} onClick={() => handleChange('app_template', c)} />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Carousel Background</label>
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            {settings.auth_backgrounds?.slice(0, 4).map((bg, i) => (
                                                <div key={i} className="relative aspect-video rounded-lg overflow-hidden border bg-slate-100 group">
                                                    <img src={bg} className="w-full h-full object-cover" />
                                                    <button onClick={() => setSettings(prev => ({ ...prev, auth_backgrounds: prev.auth_backgrounds.filter((_, idx) => idx !== i) }))} className="absolute inset-0 bg-red-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"><Trash2 size={14} /></button>
                                                </div>
                                            ))}
                                            <div className="relative aspect-video rounded-lg border-2 border-dashed bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                                                <Upload size={16} />
                                                <span className="text-[8px] font-bold mt-1">TAMBAH</span>
                                                <input type="file" multiple accept="image/*" onChange={handleUploadBg} className="absolute inset-0 opacity-0 cursor-pointer" />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Teks Selamat Datang (Login)</label>
                                        <textarea
                                            rows={3}
                                            className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={settings.welcome_message || ''}
                                            onChange={e => handleChange('welcome_message', e.target.value)}
                                            placeholder="Masukkan pesan sambutan di halaman login..."
                                        />
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}

                {/* SEO Section */}
                {activeSection === 'seo' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-6">
                            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2 border-b pb-3">
                                <Search className="text-emerald-600" size={20} /> Konfigurasi SEO Dasar
                            </h3>
                            <div className="space-y-4">
                                <Input
                                    label="Judul Halaman (Meta Title)"
                                    value={settings.seo?.title || ''}
                                    onChange={e => handleSeoChange('title', e.target.value)}
                                    placeholder="Contoh: PPDB Online SD IT Cendekia - Penerimaan Siswa Baru"
                                    helperText="Judul yang muncul di tab browser dan hasil pencarian Google"
                                />
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Deskripsi Singkat (Meta Description)</label>
                                    <textarea
                                        rows={4}
                                        className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={settings.seo?.description || ''}
                                        onChange={e => handleSeoChange('description', e.target.value)}
                                        placeholder="Jelaskan tentang sekolah Anda dalam 150-160 karakter..."
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Deskripsi ini akan muncul di bawah judul pada hasil pencarian.</p>
                                </div>
                                <Input
                                    label="Kata Kunci (Meta Keywords)"
                                    value={settings.seo?.keywords || ''}
                                    onChange={e => handleSeoChange('keywords', e.target.value)}
                                    placeholder="sekolah islam, ppdb online, sd it, pendaftaran siswa"
                                    helperText="Pisahkan dengan koma (,)"
                                />
                            </div>
                        </Card>

                        <div className="space-y-6">
                            <Card className="p-6 bg-blue-50/50 border-blue-100">
                                <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2 border-b pb-3">
                                    <Activity className="text-blue-600" size={20} /> Analytics & Tracking
                                </h3>
                                <div className="space-y-4">
                                    <Input
                                        label="Google Tag Manager ID"
                                        value={settings.seo?.gtm_id || ''}
                                        onChange={e => handleSeoChange('gtm_id', e.target.value)}
                                        placeholder="GTM-XXXXXXX"
                                        helperText="Masukkan Container ID dari Google Tag Manager"
                                    />
                                    <Input
                                        label="Facebook Meta Pixel ID"
                                        value={settings.seo?.pixel_id || ''}
                                        onChange={e => handleSeoChange('pixel_id', e.target.value)}
                                        placeholder="123456789012345"
                                        helperText="Masukkan Pixel ID untuk tracking iklan Facebook/Instagram"
                                    />
                                </div>
                            </Card>

                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                                    <HelpCircle size={16} /> Tips SEO
                                </h4>
                                <ul className="list-disc ml-4 text-xs text-amber-700 space-y-1">
                                    <li>Gunakan kata kunci yang relevan dengan lokasi sekolah (misal: "SD Terbaik di Jakarta Selatan").</li>
                                    <li>Pastikan deskripsi menarik agar orang mau mengklik link sekolah Anda.</li>
                                    <li>Gunakan Google Tag Manager untuk manajemen script yang lebih rapi.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Landing Page (Hero) */}
                {activeSection === 'landing' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="p-6 border-l-4 border-l-emerald-500">
                                <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2 border-b pb-3">
                                    <LayoutDashboard className="text-emerald-600" size={20} /> Konfigurasi Hero Banner Utama
                                </h3>
                                <div className="space-y-5">
                                    <Input
                                        label="Badge Promo (Teks Kecil di Atas)"
                                        value={settings.landing_page?.hero_badge || ''}
                                        onChange={e => handleLandingPageChange('hero_badge', e.target.value)}
                                        placeholder="Misal: Pendaftaran TA 2025/2026 Dibuka"
                                        helperText="Muncul sebagai label berkedip di atas judul utama"
                                    />
                                    <Input
                                        label="Judul Headline Utama (H1)"
                                        value={settings.landing_page?.hero_title || ''}
                                        onChange={e => handleLandingPageChange('hero_title', e.target.value)}
                                        placeholder="Gunakan | untuk baris kedua (Gradasi)"
                                        helperText="Contoh: Belajar dengan Hati | Menuju Masa Depan"
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Warna Baris Pertama</label>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="color"
                                                    value={settings.landing_page?.hero_title_color_1 || '#ffffff'}
                                                    onChange={e => handleLandingPageChange('hero_title_color_1', e.target.value)}
                                                    className="w-16 h-10 rounded-lg border border-slate-300 cursor-pointer"
                                                />
                                                <input
                                                    type="text"
                                                    value={settings.landing_page?.hero_title_color_1 || '#ffffff'}
                                                    onChange={e => handleLandingPageChange('hero_title_color_1', e.target.value)}
                                                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                                                    placeholder="#ffffff"
                                                />
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">Warna "Siapkan Masa Depan"</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Warna Baris Kedua</label>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="color"
                                                    value={settings.landing_page?.hero_title_color_2 || '#fbbf24'}
                                                    onChange={e => handleLandingPageChange('hero_title_color_2', e.target.value)}
                                                    className="w-16 h-10 rounded-lg border border-slate-300 cursor-pointer"
                                                />
                                                <input
                                                    type="text"
                                                    value={settings.landing_page?.hero_title_color_2 || '#fbbf24'}
                                                    onChange={e => handleLandingPageChange('hero_title_color_2', e.target.value)}
                                                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                                                    placeholder="#fbbf24"
                                                />
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">Warna "Gemilang Buah Hati"</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sub-Headline (Deskripsi Hero)</label>
                                        <textarea
                                            rows={4}
                                            className="w-full p-4 rounded-2xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm leading-relaxed"
                                            value={settings.landing_page?.hero_subtitle || ''}
                                            onChange={e => handleLandingPageChange('hero_subtitle', e.target.value)}
                                            placeholder="Deskripsikan keunggulan sekolah Anda dalam 2-3 kalimat..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="Label Tombol Utama"
                                            value={settings.landing_page?.hero_btn_text || 'Daftar Sekarang'}
                                            onChange={e => handleLandingPageChange('hero_btn_text', e.target.value)}
                                        />
                                        <Input
                                            label="Tautan Unduh Brosur (PDF/Link)"
                                            value={settings.landing_page?.brochure_link || ''}
                                            onChange={e => handleLandingPageChange('brochure_link', e.target.value)}
                                            placeholder="https://gdrive.com/link-brosur"
                                        />
                                    </div>
                                </div>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            <Card className="p-6">
                                <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 italic flex items-center gap-2"><ImageIcon size={16} /> Background & Alert</h3>
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gambar Besar Hero</label>
                                        {settings.landing_page?.hero_bg ? (
                                            <div className="relative aspect-video rounded-xl border bg-white overflow-hidden shadow-inner group">
                                                <img src={settings.landing_page.hero_bg} className="w-full h-full object-cover" />
                                                <button onClick={() => handleLandingPageChange('hero_bg', '')} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 shadow-lg hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                            </div>
                                        ) : (
                                            <div className="aspect-video rounded-xl border-4 border-dashed bg-slate-50 flex items-center justify-center text-slate-300"><ImageIcon size={40} /></div>
                                        )}
                                        <div className="relative">
                                            <Button variant="secondary" className="w-full text-xs">{uploading ? 'Mengupload...' : 'Ganti Gambar Hero'}</Button>
                                            <input type="file" accept="image/*" onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                setUploading(true);
                                                try {
                                                    const b64 = await fileToBase64(file);
                                                    handleLandingPageChange('hero_bg', b64);
                                                } catch (err) { showToast(err.message, 'error'); } finally { setUploading(false); }
                                            }} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 italic">Info Baris Di Atas Header</label>
                                        <textarea
                                            rows={3}
                                            className="w-full p-3 rounded-xl border border-slate-300 text-xs bg-yellow-50 focus:ring-2 focus:ring-yellow-400 outline-none"
                                            value={settings.landing_page?.announcement_bar || ''}
                                            onChange={e => handleLandingPageChange('announcement_bar', e.target.value)}
                                            placeholder="Contoh: 🚀 Gelombang 1 Dibuka sampai 30 November!"
                                        />
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}

                {/* 3. CTA Section Settings */}
                {activeSection === 'cta' && (
                    <Card className="p-6">
                        <div className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Briefcase size={24} className="text-emerald-600" />
                                Pengaturan Call To Action (CTA)
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Atur bagian CTA yang muncul sebelum footer untuk mendorong pengunjung mendaftar
                            </p>
                        </div>

                        <div className="space-y-6">
                            {/* Background Color */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Warna Background</label>
                                <div className="flex gap-3 items-center">
                                    <input
                                        type="color"
                                        value={settings.landing_page?.cta_bg_color || '#1e3a8a'}
                                        onChange={e => handleLandingPageChange('cta_bg_color', e.target.value)}
                                        className="w-20 h-12 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={settings.landing_page?.cta_bg_color || '#1e3a8a'}
                                        onChange={e => handleLandingPageChange('cta_bg_color', e.target.value)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-sm"
                                        placeholder="#1e3a8a"
                                    />
                                </div>
                            </div>

                            {/* Title & Color */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <Input
                                        label="Judul CTA"
                                        value={settings.landing_page?.cta_title || ''}
                                        onChange={e => handleLandingPageChange('cta_title', e.target.value)}
                                        placeholder="Jangan Lewatkan Kesempatan Emas Ini!"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Warna Judul</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="color"
                                            value={settings.landing_page?.cta_title_color || '#ffffff'}
                                            onChange={e => handleLandingPageChange('cta_title_color', e.target.value)}
                                            className="w-16 h-10 rounded-lg border border-slate-300 cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={settings.landing_page?.cta_title_color || '#ffffff'}
                                            onChange={e => handleLandingPageChange('cta_title_color', e.target.value)}
                                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Description & Color */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Deskripsi CTA</label>
                                    <textarea
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                        value={settings.landing_page?.cta_desc || ''}
                                        onChange={e => handleLandingPageChange('cta_desc', e.target.value)}
                                        placeholder="Kuota terbatas untuk gelombang pertama..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Warna Deskripsi</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="color"
                                            value={settings.landing_page?.cta_desc_color || '#bfdbfe'}
                                            onChange={e => handleLandingPageChange('cta_desc_color', e.target.value)}
                                            className="w-16 h-10 rounded-lg border border-slate-300 cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={settings.landing_page?.cta_desc_color || '#bfdbfe'}
                                            onChange={e => handleLandingPageChange('cta_desc_color', e.target.value)}
                                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Tombol CTA</h4>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <Input
                                        label="Text Tombol 1 (Utama)"
                                        value={settings.landing_page?.cta_btn1_text || ''}
                                        onChange={e => handleLandingPageChange('cta_btn1_text', e.target.value)}
                                        placeholder="Ambil Kuota Sekarang"
                                    />
                                    <Input
                                        label="Text Tombol 2 (WhatsApp)"
                                        value={settings.landing_page?.cta_btn2_text || ''}
                                        onChange={e => handleLandingPageChange('cta_btn2_text', e.target.value)}
                                        placeholder="Konsultasi via WA"
                                    />
                                </div>
                                <div className="mt-4">
                                    <Input
                                        label="Nomor WhatsApp (untuk tombol 2)"
                                        value={settings.landing_page?.cta_wa_number || ''}
                                        onChange={e => handleLandingPageChange('cta_wa_number', e.target.value)}
                                        placeholder="628123456789 (format: 62xxx tanpa +)"
                                        helperText="Nomor WA yang akan dibuka saat tombol 2 diklik"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* 4. FAQ Section Settings */}
                {activeSection === 'faq' && (
                    <Card className="p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <HelpCircle size={24} className="text-emerald-600" />
                                    Pengaturan FAQ
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Kelola pertanyaan yang sering diajukan untuk ditampilkan di website
                                </p>
                            </div>
                            <Button
                                onClick={() => {
                                    const newFaq = { q: '', a: '' };
                                    const currentFaqs = settings.landing_page?.faqs || [];
                                    handleLandingPageChange('faqs', [...currentFaqs, newFaq]);
                                    showToast('FAQ baru ditambahkan');
                                }}
                                className="shrink-0"
                            >
                                <Plus size={18} className="mr-2" /> Tambah FAQ
                            </Button>
                        </div>

                        {/* FAQ Title */}
                        <div className="mb-6">
                            <Input
                                label="Judul Section FAQ"
                                value={settings.landing_page?.faq_title || ''}
                                onChange={e => handleLandingPageChange('faq_title', e.target.value)}
                                placeholder="Pertanyaan Sering Diajukan"
                            />
                        </div>

                        {/* FAQ List */}
                        {(settings.landing_page?.faqs || []).length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600">
                                <HelpCircle size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                                <h4 className="text-lg font-bold text-slate-600 dark:text-slate-400 mb-2">Belum Ada FAQ</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">
                                    Tambahkan pertanyaan yang sering diajukan oleh calon siswa dan orang tua
                                </p>
                                <Button
                                    onClick={() => {
                                        const newFaq = { q: '', a: '' };
                                        handleLandingPageChange('faqs', [newFaq]);
                                        showToast('FAQ baru ditambahkan');
                                    }}
                                    variant="outline"
                                >
                                    <Plus size={18} className="mr-2" /> Buat FAQ Pertama
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {(settings.landing_page?.faqs || []).map((faq, idx) => (
                                    <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700 relative group hover:shadow-md transition-all">
                                        <button
                                            onClick={() => {
                                                const newFaqs = settings.landing_page.faqs.filter((_, i) => i !== idx);
                                                handleLandingPageChange('faqs', newFaqs);
                                                showToast('FAQ dihapus', 'success');
                                            }}
                                            className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                            title="Hapus FAQ"
                                        >
                                            <Trash2 size={14} />
                                        </button>

                                        <div className="space-y-4 pr-12">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                                                    <span className="text-blue-600 font-bold">Q:</span> Pertanyaan
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="Contoh: Kapan batas akhir pendaftaran?"
                                                    value={faq.q}
                                                    onChange={(e) => {
                                                        const newFaqs = [...(settings.landing_page.faqs || [])];
                                                        newFaqs[idx] = { ...newFaqs[idx], q: e.target.value };
                                                        handleLandingPageChange('faqs', newFaqs);
                                                    }}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                                                    <span className="text-emerald-600 font-bold">A:</span> Jawaban
                                                </label>
                                                <textarea
                                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none transition-all"
                                                    rows={3}
                                                    placeholder="Jawaban untuk pertanyaan di atas..."
                                                    value={faq.a}
                                                    onChange={(e) => {
                                                        const newFaqs = [...(settings.landing_page.faqs || [])];
                                                        newFaqs[idx] = { ...newFaqs[idx], a: e.target.value };
                                                        handleLandingPageChange('faqs', newFaqs);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                )}

                {/* Popup Banner Settings */}
                {activeSection === 'popup' && (
                    <Card className="p-6">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-3 italic"><ImageIcon size={18} /> Pengaturan Popup & Banner</h3>

                        <div className="space-y-8">
                            {/* Global Announcement (Dashboard User) */}
                            <div className="bg-indigo-50/50 rounded-xl p-5 border border-indigo-100">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                                            <Bell size={16} className="text-indigo-600" />
                                            Pengumuman Global (Dashboard User)
                                        </h4>
                                        <p className="text-xs text-indigo-600/70 mt-1">
                                            Banner teks yang muncul di bagian atas Dashboard Siswa setelah login.
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={settings.announcement?.active || false}
                                            onChange={e => handleAnnouncementChange('active', e.target.checked)}
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                <textarea
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                                    value={settings.announcement?.text || ''}
                                    onChange={e => handleAnnouncementChange('text', e.target.value)}
                                    placeholder="Contoh: Pendaftaran akan ditutup tanggal 30 Maret 2025. Segera lengkapi berkas Anda."
                                />
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-700"></div>

                            {/* Website Popup */}
                            <div>
                                <h4 className="font-bold text-slate-800 mb-4">Popup Website (Halaman Depan)</h4>
                                <p className="text-sm text-slate-500 mb-6">Popup banner akan muncul saat pengunjung pertama kali membuka halaman website.</p>

                                <div className="space-y-6">
                                    {/* Toggle Enable */}
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <div>
                                            <h4 className="font-bold text-slate-700">Aktifkan Popup Banner</h4>
                                            <p className="text-xs text-slate-500">Popup akan tampil di halaman depan website</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.landing_page?.popup_enabled || false}
                                                onChange={e => handleLandingPageChange('popup_enabled', e.target.checked)}
                                            />
                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                                        </label>
                                    </div>

                                    {/* Show Once Toggle */}
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <div>
                                            <h4 className="font-bold text-slate-700">Tampilkan Sekali Saja</h4>
                                            <p className="text-xs text-slate-500">Jika aktif, popup hanya muncul sekali per sesi browser pengunjung (disarankan)</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.landing_page?.popup_show_once !== false}
                                                onChange={e => handleLandingPageChange('popup_show_once', e.target.checked)}
                                            />
                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                                        </label>
                                    </div>

                                    {/* Image Upload */}
                                    <div>
                                        <label className="text-sm font-bold text-slate-700 mb-2 block">Gambar Popup</label>
                                        <div className="flex items-start gap-4">
                                            {settings.landing_page?.popup_image ? (
                                                <div className="w-1/3 aspect-[4/5] rounded-xl border bg-slate-100 overflow-hidden relative group">
                                                    <img src={settings.landing_page.popup_image} className="w-full h-full object-cover" />
                                                    <button onClick={() => handleLandingPageChange('popup_image', '')} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-all">
                                                        <Trash2 />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-1/3 aspect-[4/5] rounded-xl border-2 border-dashed bg-slate-50 flex items-center justify-center text-slate-400">
                                                    <div className="text-center">
                                                        <ImageIcon className="mx-auto mb-2" />
                                                        <span className="text-xs">Upload Gambar</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex-1 space-y-4">
                                                <div className="relative">
                                                    <Button variant="secondary" className="w-full">{uploading ? 'Mengupload...' : 'Pilih Gambar'}</Button>
                                                    <input type="file" onChange={async (e) => {
                                                        const file = e.target.files[0];
                                                        if (!file) return;
                                                        setUploading(true);
                                                        try {
                                                            const b64 = await fileToBase64(file);
                                                            handleLandingPageChange('popup_image', b64);
                                                        } catch (err) { showToast(err.message, 'error'); } finally { setUploading(false); }
                                                    }} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                                </div>
                                                <p className="text-xs text-slate-500">
                                                    Disarankan menggunakan gambar portrait (aspek rasio 4:5) atau persegi. Maksimal 2MB.
                                                </p>

                                                <Input
                                                    label="Link saat diklik (Opsional)"
                                                    value={settings.landing_page?.popup_link || ''}
                                                    onChange={e => handleLandingPageChange('popup_link', e.target.value)}
                                                    placeholder="https://wa.me/..."
                                                    helperText="Kosongkan jika hanya ingin menampilkan gambar info saja."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* AI Assistant, Contact, etc. would follow similar patterns */}
                {/* 5. Contact & Information Settings */}
                {activeSection === 'contact' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-6">
                            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2 border-b pb-3">
                                <Phone className="text-emerald-600" size={20} /> Kontak & Media Sosial
                            </h3>
                            <div className="space-y-4">
                                <Input
                                    label="Nomor WhatsApp Admin (Utama)"
                                    value={settings.landing_page?.contact_wa || ''}
                                    onChange={e => handleLandingPageChange('contact_wa', e.target.value)}
                                    placeholder="628123456789"
                                    helperText="Gunakan format internasional (62) tanpa +"
                                />
                                <Input
                                    label="Nomor Telepon Kantor"
                                    value={settings.landing_page?.contact_office || ''}
                                    onChange={e => handleLandingPageChange('contact_office', e.target.value)}
                                    placeholder="(021) 1234567"
                                />
                                <Input
                                    label="Email Resmi"
                                    value={settings.landing_page?.contact_email || ''}
                                    onChange={e => handleLandingPageChange('contact_email', e.target.value)}
                                    placeholder="info@sekolah.sch.id"
                                />
                            </div>
                        </Card>

                        <Card className="p-6">
                            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2 border-b pb-3">
                                <MapPin className="text-emerald-600" size={20} /> Alamat & Footer
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Alamat Lengkap</label>
                                    <textarea
                                        rows={3}
                                        className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={settings.landing_page?.address || ''}
                                        onChange={e => handleLandingPageChange('address', e.target.value)}
                                        placeholder="Jl. Pendidikan No. 1, Kota..."
                                    />
                                </div>
                                <Input
                                    label="Link Google Maps Embed"
                                    value={settings.landing_page?.maps_link || ''}
                                    onChange={e => handleLandingPageChange('maps_link', e.target.value)}
                                    placeholder="https://goo.gl/maps/..."
                                />
                                <div className="pt-4 border-t mt-4">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Deskripsi Singkat di Footer</label>
                                    <textarea
                                        rows={3}
                                        className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={settings.landing_page?.footer_desc || ''}
                                        onChange={e => handleLandingPageChange('footer_desc', e.target.value)}
                                        placeholder="Sekolah Islam Terpadu yang berfokus pada..."
                                    />
                                </div>
                                <Input
                                    label="Copyright Footer"
                                    value={settings.landing_page?.footer_copyright || ''}
                                    onChange={e => handleLandingPageChange('footer_copyright', e.target.value)}
                                    placeholder="© 2025 Sekolahku. All rights reserved."
                                />
                            </div>
                        </Card>
                    </div>
                )}

                {/* 6. AI Assistant Settings */}
                {activeSection === 'ai' && (
                    <Card className="p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-200">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Bot size={24} className="text-emerald-600" />
                                    Pengaturan AI Advisor
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Konfigurasi asisten virtual cerdas untuk menjawab pertanyaan pengunjung 24/7.
                                </p>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <span className={`text-sm font-bold ${settings.ai_assistant?.active ? 'text-emerald-600' : 'text-slate-500'}`}>
                                    {settings.ai_assistant?.active ? 'AI AKTIF' : 'AI NONAKTIF'}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={settings.ai_assistant?.active || false}
                                        onChange={e => handleAiChange('active', e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="md:col-span-1 space-y-6">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <h4 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">Preview Widget</h4>
                                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden max-w-[280px] mx-auto">
                                        <div className="bg-emerald-600 p-4 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                                                <Bot size={18} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-white text-sm">{settings.ai_assistant?.bot_name || 'Asisten Sekolah'}</div>
                                                <div className="text-[10px] text-emerald-100 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-300"></span> Online
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-slate-50 min-h-[200px] text-xs space-y-3">
                                            <div className="flex gap-2">
                                                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"><Bot size={12} /></div>
                                                <div className="bg-white p-2 rounded-lg rounded-tl-none border border-slate-100 shadow-sm text-slate-600">
                                                    {settings.ai_assistant?.welcome_msg || 'Halo! Ada yang bisa saya bantu?'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-white border-t border-slate-100">
                                            <div className="h-8 rounded-full bg-slate-100 w-full"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-2 space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Nama Bot"
                                        value={settings.ai_assistant?.bot_name || ''}
                                        onChange={e => handleAiChange('bot_name', e.target.value)}
                                        placeholder="Asisten Sekolah"
                                    />
                                    <Input
                                        label="Pesan Sambutan Awal"
                                        value={settings.ai_assistant?.welcome_msg || ''}
                                        onChange={e => handleAiChange('welcome_msg', e.target.value)}
                                        placeholder="Halo! Selamat datang di website kami..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Persona / Gaya Bahasa</label>
                                    <textarea
                                        rows={2}
                                        className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={settings.ai_assistant?.persona || ''}
                                        onChange={e => handleAiChange('persona', e.target.value)}
                                        placeholder="Contoh: Kamu adalah staf admin yang ramah, sopan, dan informatif. Gunakan bahasa Indonesia baku namun santai."
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Instruksi ini akan mendikte cara AI menjawab pertanyaan.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex justify-between">
                                        <span>Basis Pengetahuan (Knowledge Base)</span>
                                        <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">PENTING</span>
                                    </label>
                                    <textarea
                                        rows={8}
                                        className="w-full p-4 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-slate-600"
                                        value={settings.ai_assistant?.knowledge_base || ''}
                                        onChange={e => handleAiChange('knowledge_base', e.target.value)}
                                        placeholder="Tuliskan fakta-fakta penting tentang sekolah disini. Contoh:
- Biaya pendaftaran Rp 200.000
- Batas akhir gelombang 1 adalah 30 November
- Kami memiliki ekskul Robotik dan Tahfidz
- Alamat sekolah di Jl. Pendidikan No 1
- Untuk info lebih lanjut hubungi WA Admin..."
                                    />
                                    <p className="text-xs text-slate-500 mt-2 bg-blue-50 p-2 rounded border border-blue-100 text-blue-700">
                                        <Info size={12} className="inline mr-1" />
                                        Tips: Masukkan informasi detail seperti biaya, jadwal, kurikulum, dan kontak. Semakin lengkap data ini, semakin akurat jawaban AI.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Save Button */}
                <div className="sticky bottom-6 flex justify-end pt-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pb-4 z-40">
                    <Button
                        onClick={saveSettings}
                        disabled={loading}
                        className="shadow-xl shadow-emerald-200 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold text-lg flex items-center gap-2 transform active:scale-95 transition-all"
                    >
                        {loading ? 'Menyimpan...' : <><Save size={20} /> Simpan Perubahan</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}
