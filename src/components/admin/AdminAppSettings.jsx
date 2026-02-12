import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { Settings, Save, Upload, Trash2, Image as ImageIcon, Plus, LayoutDashboard, MessageCircle, Bell, CreditCard, CheckCircle, FileText, Bot, Key, Server, Wifi, WifiOff, QrCode } from 'lucide-react';
import { Card, Button, Input } from '../ui/Elements';
import QRCode from 'react-qr-code';
import { fileToBase64 } from '../../utils/helpers';
import { Modal } from '../ui/Overlays';
import { logActivity } from '../../utils/activityLogger';

const ADMIN_MODULES = [
    { id: 'admin_dashboard', label: 'Dashboard' },
    { id: 'admin_report', label: 'Laporan Siswa' },
    { id: 'admin_verify', label: 'Verifikasi' },
    { id: 'admin_payment_approval', label: 'Approval Bayar' },
    { id: 'admin_finance_dashboard', label: 'Dashboard Keuangan' },
    { id: 'admin_requests', label: 'Permintaan Edit' },
    { id: 'admin_followup', label: 'Follow Up (WA)' },
    { id: 'admin_transfers', label: 'Transfer Cabang/Jurusan' },
    { id: 'admin_interviews', label: 'Jadwal Test' },
    { id: 'admin_scoring', label: 'Nilai & Lulus' },
    { id: 'admin_ranking', label: 'Perangkingan' },
    { id: 'admin_school_settings', label: 'Pengaturan Sekolah' },
    { id: 'admin_test_settings', label: 'Pengaturan Ujian' },
    { id: 'admin_payment_settings', label: 'Pengaturan Bayar' },
    { id: 'admin_app_settings', label: 'Pengaturan Aplikasi' },
    { id: 'admin_website_settings', label: 'Pengaturan Website' },
    { id: 'admin_resignation', label: 'Pengunduran Diri' },
    { id: 'admin_vouchers', label: 'Voucher & Diskon' },
    { id: 'admin_users', label: 'Manajemen Akun' }
];

export default function AdminAppSettings({ showToast }) {
    const [settings, setSettings] = useState({
        school_name: 'Sekolah Islam Terpadu Cendekia',
        school_address: '',
        school_phone: '',
        school_email: '',
        invoice_footer_note: '',
        invoice_prefix: '',
        invoice_title: '',
        app_name: 'PSB Online',
        app_version: 'v1.0 Beta',
        psb_period_id: 'psb-2025', // Default ID
        app_logo: '', // Base64 or URL
        welcome_message: 'Bergabunglah bersama kami mewujudkan generasi berakhlak mulia, cerdas, dan berprestasi.',
        auth_backgrounds: [], // Array of base64 strings or URLs
        announcement: {
            text: '',
            active: false
        },
        fonnte_token: '',
        committee_head: 'H. Ahmad Dahlan, M.Pd',
        committee_position: 'Ketua Panitia PSB',
        template_graduation: 'Selamat! Ananda {name} dinyatakan LULUS seleksi masuk Sekolah Islam Terpadu Cendekia. Silakan lakukan daftar ulang melalui aplikasi.',
        template_reminder: 'Assalamu\'alaikum. Mengingatkan kembali untuk segera melakukan pembayaran daftar ulang bagi calon siswa atas nama {name}. Terima kasih.',
        template_payment_reminder: 'Assalamu\'alaikum. Mohon segera selesaikan pembayaran biaya pendaftaran untuk calon siswa {name} agar dapat melanjutkan verifikasi data. Terima kasih.',
        template_document_reminder: 'Assalamu\'alaikum. Mohon lengkapi dokumen persyaratan pendaftaran untuk {name} agar dapat diproses lebih lanjut. Cek aplikasi untuk detailnya.',
        admins: [], // Array of { email: string, name: string }
        app_template: 'berry', // berry, tailadmin, windmill
        landing_page: {
            contact_wa: '',
            contact_office: '',
            contact_email: '',
            address: '',
            maps_link: '',
            footer_desc: '',
            footer_copyright: '© 2025 Bilal21. All rights reserved.'
        },
        signature_image: '', // Base64
        finance_head: '',
        finance_position: 'Bendahara Sekolah',
        finance_signature: '',
        template_installment_t1: 'Assalamu\'alaikum. Mengingatkan tagihan cicilan Termin 1 a.n {name} sebesar {amount} jatuh tempo pada {date}. Mohon segera melunasi. Terima kasih.',
        template_installment_t2: 'Assalamu\'alaikum. Mengingatkan tagihan cicilan Termin 2 a.n {name} sebesar {amount} jatuh tempo pada {date}. Mohon segera melunasi. Terima kasih.',
        template_installment_t3: 'Assalamu\'alaikum. Mengingatkan tagihan cicilan Termin 3 a.n {name} sebesar {amount} jatuh tempo pada {date}. Mohon segera melunasi. Terima kasih.',
        template_installment_t4: 'Assalamu\'alaikum. Mengingatkan tagihan cicilan Termin 4 a.n {name} sebesar {amount} jatuh tempo pada {date}. Mohon segera melunasi. Terima kasih.',
        template_otp: '',
        gemini_api_key: '',
        gemini_model: 'gemini-1.5-flash',
        wa_provider: 'fonnte', // 'fonnte' | 'baileys'
        baileys_server_url: 'http://localhost:3001'
    });

    const [activeSection, setActiveSection] = useState('identity'); // identity, notification, access, appearance
    const [whatsappTab, setWhatsappTab] = useState('general'); // general, payment, installment

    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminRole, setNewAdminRole] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Permission Modal State
    const [permissionModal, setPermissionModal] = useState(false);
    const [selectedAdminIndex, setSelectedAdminIndex] = useState(null);
    const [tempPermissions, setTempPermissions] = useState([]);

    useEffect(() => {
        const fetchSettings = async () => {
            const { data, error } = await supabase.from('app_settings').select('*').eq('id', 'main').single();
            if (data) {
                setSettings(prev => ({
                    ...prev,
                    ...data,
                    announcement: data.announcement || prev.announcement,
                    landing_page: data.landing_page || prev.landing_page
                }));
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleAnnouncementChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            announcement: { ...prev.announcement, [field]: value }
        }));
    };

    const handleUploadLogo = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const base64 = await fileToBase64(file);
            setSettings(prev => ({ ...prev, app_logo: base64 }));
            showToast('Logo berhasil diupload. Klik Simpan untuk menerapkan.');
        } catch (error) { showToast(error.message, 'error'); } finally { setUploading(false); }
    };

    const handleUploadSignature = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const base64 = await fileToBase64(file);
            setSettings(prev => ({ ...prev, signature_image: base64 }));
            showToast('Tanda tangan berhasil diupload. Klik Simpan untuk menerapkan.');
        } catch (error) { showToast(error.message, 'error'); } finally { setUploading(false); }
    };

    const handleUploadFinanceSignature = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const base64 = await fileToBase64(file);
            setSettings(prev => ({ ...prev, finance_signature: base64 }));
            showToast('Tanda tangan Bendahara berhasil diupload. Klik Simpan untuk menerapkan.');
        } catch (error) { showToast(error.message, 'error'); } finally { setUploading(false); }
    };

    const handleAddAdmin = () => {
        if (!newAdminEmail || !newAdminEmail.includes('@')) {
            showToast('Email tidak valid', 'error');
            return;
        }
        if (settings.admins?.some(a => a.email === newAdminEmail)) {
            showToast('Email sudah terdaftar sebagai admin', 'error');
            return;
        }

        // Add with all permissions by default, but user can edit later
        const newAdmin = {
            email: newAdminEmail,
            name: 'Admin Baru',
            role: newAdminRole || 'Admin', // Use custom role name or default
            permissions: ADMIN_MODULES.map(m => m.id) // Default all access
        };

        setSettings(prev => ({
            ...prev,
            admins: [...(prev.admins || []), newAdmin]
        }));
        setNewAdminEmail('');
        setNewAdminRole('');
        showToast('Admin ditambahkan. Silakan atur hak akses jika perlu.');
    };

    const openPermissionModal = (index) => {
        setSelectedAdminIndex(index);
        setTempPermissions(settings.admins[index].permissions || []);
        setPermissionModal(true);
    };

    const togglePermission = (moduleId) => {
        setTempPermissions(prev => {
            if (prev.includes(moduleId)) return prev.filter(p => p !== moduleId);
            return [...prev, moduleId];
        });
    };

    const savePermissions = () => {
        if (selectedAdminIndex === null) return;
        setSettings(prev => {
            const newAdmins = [...prev.admins];
            newAdmins[selectedAdminIndex] = {
                ...newAdmins[selectedAdminIndex],
                permissions: tempPermissions
            };
            return { ...prev, admins: newAdmins };
        });
        setPermissionModal(false);
        showToast('Hak akses diperbarui. Jangan lupa klik Simpan Pengaturan.');
    };

    const handleRemoveAdmin = (email) => {
        setSettings(prev => ({
            ...prev,
            admins: prev.admins.filter(a => a.email !== email)
        }));
    };

    const saveSettings = async () => {
        setLoading(true);
        try {
            // Upsert to Supabase
            const { error } = await supabase.from('app_settings').upsert({
                id: 'main',
                ...settings,
                updated_at: new Date()
            });

            if (error) throw error;

            await logActivity(
                (await supabase.auth.getUser()).data.user,
                'SETTINGS',
                'Memperbarui Pengaturan Aplikasi',
                { section: activeSection }
            );

            // Update Session Storage Cache
            const currentCache = JSON.parse(sessionStorage.getItem('app_settings_cache') || '{}');
            const newAppSettings = {
                app_name: settings.app_name,
                app_version: settings.app_version,
                app_logo: settings.app_logo,
                app_template: settings.app_template
            };

            sessionStorage.setItem('app_settings_cache', JSON.stringify({
                ...currentCache,
                settings: newAppSettings
            }));

            // Dispatch Event for Real-time Update
            window.dispatchEvent(new CustomEvent('app-settings-updated', { detail: newAppSettings }));

            showToast('Pengaturan aplikasi berhasil disimpan!');
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const syncExistingUsers = async () => {
        if (!confirm("Fitur ini akan memindai semua data user dan mendaftarkan nomor WhatsApp mereka agar bisa digunakan untuk Login. Lanjutkan?")) return;

        setLoading(true);
        try {
            // 1. Get All Profiles
            const { data: profiles, error } = await supabase.from('profiles').select('*');
            if (error) throw error;

            if (!profiles || profiles.length === 0) {
                showToast("Tidak ada data user ditemukan.");
                setLoading(false);
                return;
            }

            let count = 0;
            const promises = [];

            // 2. Loop and Create Lookup Entries
            for (const profile of profiles) {
                if (profile.phone && profile.email && profile.id) {
                    const sanitizedPhone = profile.phone.replace(/[^0-9]/g, '');
                    if (sanitizedPhone.length > 8) {
                        const p = supabase.from('user_lookup').upsert({
                            phone: sanitizedPhone,
                            email: profile.email,
                            uid: profile.id
                        });
                        promises.push(p);
                        count++;
                    }
                }
            }

            await Promise.all(promises);
            showToast(`Berhasil sinkronisasi ${count} Nomor WhatsApp untuk Login.`);
        } catch (e) {
            console.error(e);
            showToast("Gagal sinkronisasi: " + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <Settings className="text-emerald-600" /> Pengaturan Aplikasi
            </h2>

            {/* Section Tabs */}
            <div className="flex gap-2 border-b border-slate-200 mb-6 overflow-x-auto pb-1">
                <button
                    onClick={() => setActiveSection('identity')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeSection === 'identity' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-emerald-600'}`}
                >
                    Identitas & Kontak
                </button>
                <button
                    onClick={() => setActiveSection('invoice')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeSection === 'invoice' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-emerald-600'}`}
                >
                    Kop Surat & Invoice
                </button>
                <button
                    onClick={() => setActiveSection('notification')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeSection === 'notification' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-emerald-600'}`}
                >
                    Pengumuman & Notifikasi
                </button>
                <button
                    onClick={() => setActiveSection('setup_api')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeSection === 'setup_api' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-emerald-600'}`}
                >
                    Setup API
                </button>
                <button
                    onClick={() => setActiveSection('access')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeSection === 'access' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-emerald-600'}`}
                >
                    Manajemen Admin
                </button>
            </div>

            <div className="space-y-6">
                {/* Identity Settings */}
                {activeSection === 'identity' && (
                    <div className="grid grid-cols-1 gap-6 animate-fade-in">
                        <Card className="p-6">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4 border-b pb-2">Informasi Sekolah</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <Input
                                            label="Nama Sekolah (Formal)"
                                            value={settings.school_name}
                                            onChange={e => handleChange('school_name', e.target.value)}
                                            placeholder="Contoh: Sekolah Islam Terpadu Cendekia"
                                        />
                                        <Input
                                            label="Alamat Lengkap"
                                            value={settings.school_address}
                                            onChange={e => handleChange('school_address', e.target.value)}
                                            placeholder="Jl. Pendidikan No. 123..."
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="No. Telepon"
                                                value={settings.school_phone}
                                                onChange={e => handleChange('school_phone', e.target.value)}
                                                placeholder="021-xxxxxxx"
                                            />
                                            <Input
                                                label="Email Sekolah"
                                                value={settings.school_email}
                                                onChange={e => handleChange('school_email', e.target.value)}
                                                placeholder="info@sekolah.sch.id"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* PEJABAT SURAT KELULUSAN */}
                        <Card className="p-6 border-t-4 border-t-emerald-500">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4 border-b pb-2 flex items-center gap-2">
                                <FileText className="text-emerald-600" /> Pejabat Surat Kelulusan
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Nama Pejabat (Kepala Sekolah/Ketua Panitia)"
                                    value={settings.committee_head}
                                    onChange={e => handleChange('committee_head', e.target.value)}
                                    placeholder="Contoh: H. Ahmad Dahlan, M.Pd"
                                />
                                <Input
                                    label="Jabatan Tertulis"
                                    value={settings.committee_position}
                                    onChange={e => handleChange('committee_position', e.target.value)}
                                    placeholder="Contoh: Ketua Panitia PSB"
                                />
                            </div>
                            <div className="mt-4 pt-4 border-t border-dashed">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Upload Tanda Tangan (Surat Kelulusan)</label>
                                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors relative">
                                    <input type="file" accept="image/*" onChange={handleUploadSignature} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                    {settings.signature_image ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <img src={settings.signature_image} className="h-20 object-contain" alt="Signature" />
                                            <span className="text-xs text-slate-400">Klik untuk ganti TTD Kelulusan</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <Upload size={24} />
                                            <span className="text-xs">Upload Gambar Tanda Tangan</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* INVOICE & KOP SURAT SETTINGS */}
                {activeSection === 'invoice' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        {/* KOP SURAT & LOGO */}
                        <Card className="p-6">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4 border-b pb-2 flex items-center gap-2">
                                <ImageIcon className="text-emerald-600" /> Logo & Kop Surat
                            </h3>

                            <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Preview Kop (Sederhana)</p>
                                <div className="flex items-center gap-4 justify-center text-left max-w-sm mx-auto">
                                    {settings.app_logo ?
                                        <img src={settings.app_logo} className="h-12 w-12 object-contain" alt="Logo" /> :
                                        <div className="h-12 w-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 text-[10px]">No Logo</div>
                                    }
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">{settings.school_name || 'Nama Sekolah'}</h4>
                                        <p className="text-[10px] text-slate-500 leading-tight">{settings.school_address || 'Alamat Sekolah'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Upload Logo Sekolah</label>
                                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors relative cursor-pointer">
                                        <input type="file" accept="image/*" onChange={handleUploadLogo} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        {settings.app_logo ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <img src={settings.app_logo} className="h-20 object-contain" alt="Logo" />
                                                <span className="text-xs text-emerald-600 font-bold">Klik untuk ganti logo</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                                <Upload size={24} />
                                                <span className="text-xs">Upload Logo (PNG Transparan)</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* DETAIL INVOICE */}
                        <Card className="p-6">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4 border-b pb-2 flex items-center gap-2">
                                <FileText className="text-emerald-600" /> Konfigurasi Invoice
                            </h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Prefix Nomor Invoice"
                                        value={settings.invoice_prefix || ''}
                                        onChange={e => handleChange('invoice_prefix', e.target.value)}
                                        placeholder="INV/2026/... (Opsional)"
                                    />
                                    <Input
                                        label="Judul Dokumen"
                                        value={settings.invoice_title || ''}
                                        onChange={e => handleChange('invoice_title', e.target.value)}
                                        placeholder="INVOICE / KUITANSI"
                                    />
                                </div>

                                <Input
                                    label="Catatan Kaki (Footer)"
                                    value={settings.invoice_footer_note}
                                    onChange={e => handleChange('invoice_footer_note', e.target.value)}
                                    placeholder="Contoh: Bukti pembayaran sah..."
                                    className="text-sm"
                                />

                                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-xs text-emerald-800">
                                    <p><strong>Tips:</strong> Gunakan judul "INVOICE" atau "TAGIHAN RESMI" untuk kesan formal. Pastikan logo sekolah sudah diupload agar muncul di kop surat.</p>
                                </div>
                            </div>
                        </Card>

                        {/* TANDA TANGAN */}
                        {/* TANDA TANGAN BENDAHARA */}
                        <Card className="p-6 md:col-span-2">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                                    <CheckCircle className="text-emerald-600" /> Tanda Tangan Invoice (Bendahara)
                                </h3>
                                <div className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-500">Muncul di Dokumen Invoice/Kuitansi</div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="md:col-span-2 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Nama Bendahara / Pejabat Keuangan"
                                            value={settings.finance_head || ''}
                                            onChange={e => handleChange('finance_head', e.target.value)}
                                            placeholder="Nama Bendahara..."
                                        />
                                        <Input
                                            label="Jabatan Tertulis"
                                            value={settings.finance_position || ''}
                                            onChange={e => handleChange('finance_position', e.target.value)}
                                            placeholder="Contoh: Bendahara Sekolah"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400">Nama dan jabatan ini khusus untuk Invoice. Jika kosong, akan menggunakan default.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Scan Tanda Tangan Bendahara</label>
                                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors relative cursor-pointer h-40 flex items-center justify-center">
                                        <input type="file" accept="image/*" onChange={handleUploadFinanceSignature} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        {settings.finance_signature ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <img src={settings.finance_signature} className="max-h-28 max-w-full object-contain" alt="Signature" />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                                <Upload size={24} />
                                                <span className="text-xs">Upload TTD Bendahara</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-center text-slate-400 mt-2">Format PNG Transparan disarankan.</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Notification Settings */}
                {activeSection === 'notification' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Modern WhatsApp Settings Card */}
                        <Card className="p-0 overflow-hidden border-0 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800">
                            {/* Header & Tabs */}
                            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-gray-100 flex items-center gap-2">
                                        <div className="p-2 bg-emerald-100/50 dark:bg-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                                            <MessageCircle size={20} />
                                        </div>
                                        WhatsApp Auto-Sender
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 ml-11">Kelola template pesan otomatis yang dikirimkan sistem.</p>
                                </div>
                                <div className="flex p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                                    <button
                                        onClick={() => setWhatsappTab('general')}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${whatsappTab === 'general' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-800' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                    >
                                        <CheckCircle size={14} /> Umum
                                    </button>
                                    <button
                                        onClick={() => setWhatsappTab('payment')}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${whatsappTab === 'payment' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-800' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                    >
                                        <Bell size={14} /> Reminder
                                    </button>
                                    <button
                                        onClick={() => setWhatsappTab('installment')}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${whatsappTab === 'installment' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-800' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                    >
                                        <CreditCard size={14} /> Cicilan
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 bg-white dark:bg-slate-800 min-h-[300px]">
                                {/* Tab: Umum */}
                                {whatsappTab === 'general' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Kode OTP / Verifikasi</label>
                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full">Login</span>
                                            </div>
                                            <div className="relative group">
                                                <textarea
                                                    rows={4}
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all resize-none shadow-sm group-hover:border-slate-300 dark:group-hover:border-slate-600 text-slate-800 dark:text-slate-200"
                                                    value={settings.template_otp || ''}
                                                    onChange={e => handleChange('template_otp', e.target.value)}
                                                />
                                                <div className="absolute right-3 bottom-3 text-emerald-500 opacity-0 group-focus-within:opacity-100 transition-opacity">
                                                    <MessageCircle size={16} />
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded text-slate-600 dark:text-slate-300">{'{otp}'}</span> akan diganti dengan kode angka.
                                            </p>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Pengumuman Kelulusan</label>
                                                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">Hasil Seleksi</span>
                                            </div>
                                            <textarea
                                                rows={4}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all resize-none shadow-sm text-slate-800 dark:text-slate-200"
                                                value={settings.template_graduation || ''}
                                                onChange={e => handleChange('template_graduation', e.target.value)}
                                            />
                                            <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded text-slate-600 dark:text-slate-300">{'{name}'}</span> untuk nama siswa.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Tab: Payment/Reminder */}
                                {whatsappTab === 'payment' && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                                        {[
                                            { label: 'Tagihan Daftar Ulang', key: 'template_reminder', color: 'blue' },
                                            { label: 'Tagihan Pendaftaran', key: 'template_payment_reminder', color: 'amber' },
                                            { label: 'Dokumen Kurang', key: 'template_document_reminder', color: 'red' }
                                        ].map(item => (
                                            <div key={item.key} className="space-y-3">
                                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block border-l-4 border-transparent pl-2" style={{ borderLeftColor: `var(--${item.color}-500)` }}>
                                                    {item.label}
                                                </label>
                                                <textarea
                                                    rows={6}
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all resize-none shadow-sm text-slate-800 dark:text-slate-200"
                                                    value={settings[item.key] || ''}
                                                    onChange={e => handleChange(item.key, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Tab: Installment */}
                                {whatsappTab === 'installment' && (
                                    <div className="animate-fade-in">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {[1, 2, 3, 4].map(t => (
                                                <div key={t} className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 relative group hover:shadow-md transition-all">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold text-xs ring-2 ring-white dark:ring-slate-700">T{t}</div>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Termin {t}</span>
                                                        </div>
                                                        <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-emerald-500 transition-colors"></div>
                                                    </div>
                                                    <textarea
                                                        rows={3}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-xs transition-all resize-none text-slate-800 dark:text-slate-200"
                                                        value={settings[`template_installment_t${t}`] || ''}
                                                        onChange={e => handleChange(`template_installment_t${t}`, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 py-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                                            <span>Variabel Tersedia:</span>
                                            <span className="font-mono bg-white dark:bg-slate-800 border dark:border-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold">{'{name}'}</span>
                                            <span className="font-mono bg-white dark:bg-slate-800 border dark:border-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold">{'{amount}'}</span>
                                            <span className="font-mono bg-white dark:bg-slate-800 border dark:border-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold">{'{date}'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                )}

                {/* Setup API Settings */}
                {activeSection === 'setup_api' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        {/* WhatsApp Gateway Card */}
                        <Card className="p-6 border-l-4 border-l-emerald-500">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4 border-b pb-2 flex items-center gap-2">
                                <MessageCircle className="text-emerald-600" /> WhatsApp Gateway
                            </h3>
                            <div className="space-y-4">
                                {/* Provider Selector */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-2">
                                        <Server size={14} /> Penyedia WhatsApp
                                    </label>
                                    <select
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold"
                                        value={settings.wa_provider || 'fonnte'}
                                        onChange={e => handleChange('wa_provider', e.target.value)}
                                    >
                                        <option value="fonnte">🌐 Fonnte (Cloud / Hosting)</option>
                                        <option value="baileys">🤖 Baileys (Self-Hosted / Local)</option>
                                    </select>
                                </div>

                                {/* Conditional: Fonnte Settings */}
                                {(settings.wa_provider === 'fonnte' || !settings.wa_provider) && (
                                    <div className="space-y-4 animate-fade-in">
                                        <Input
                                            label="Fonnte API Token"
                                            value={settings.fonnte_token || ''}
                                            onChange={e => handleChange('fonnte_token', e.target.value)}
                                            placeholder="Paste token dari fonnte.com"
                                            type="password"
                                        />
                                        <div className="text-xs text-slate-500 bg-emerald-50 p-3 rounded-lg border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
                                            <p className="mb-1 font-semibold text-emerald-700 dark:text-emerald-400">✅ Kelebihan Fonnte:</p>
                                            <ul className="list-disc ml-4 space-y-0.5">
                                                <li>Tidak perlu server sendiri</li>
                                                <li>Stabil 24/7</li>
                                                <li>Mudah digunakan</li>
                                            </ul>
                                            <p className="mt-2">Dapatkan token di <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="text-emerald-600 underline font-bold">fonnte.com</a></p>
                                        </div>
                                    </div>
                                )}

                                {/* Conditional: Baileys Settings */}
                                {settings.wa_provider === 'baileys' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <Input
                                            label="Baileys Server URL"
                                            value={settings.baileys_server_url || 'http://localhost:3001'}
                                            onChange={e => handleChange('baileys_server_url', e.target.value)}
                                            placeholder="http://localhost:3001"
                                        />

                                        {/* QR Code Scanner Area */}
                                        <BaileysQRScanner serverUrl={settings.baileys_server_url || 'http://localhost:3001'} />

                                        <div className="bg-slate-900 text-slate-200 p-4 rounded-lg text-xs font-mono space-y-2 border border-slate-700">
                                            <p className="font-bold text-emerald-400 flex items-center gap-2">
                                                <Wifi size={14} /> Cara Menjalankan Baileys:
                                            </p>
                                            <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                                                <li>Pastikan `npm run dev` berjalan (otomatis jalankan wa-server)</li>
                                                <li>Scan QR Code di atas (jika belum login)</li>
                                                <li>Biarkan terminal/browser terbuka agar WA Online</li>
                                            </ol>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Gemini AI Card */}
                        <Card className="p-6 border-l-4 border-l-indigo-500">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4 border-b pb-2 flex items-center gap-2">
                                <Bot className="text-indigo-600" /> Konfigurasi Gemini AI
                            </h3>
                            <div className="space-y-4">
                                <Input
                                    label="Google Gemini API Key"
                                    value={settings.gemini_api_key || ''}
                                    onChange={e => handleChange('gemini_api_key', e.target.value)}
                                    placeholder="AIzaSy..."
                                    type="password"
                                />
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Model AI</label>
                                    <select
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        value={settings.gemini_model || 'gemini-1.5-flash'}
                                        onChange={e => handleChange('gemini_model', e.target.value)}
                                    >
                                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Terbaru & Tercepat)</option>
                                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (Cepat & Hemat)</option>
                                        <option value="gemini-1.5-pro">Gemini 1.5 Pro (Lebih Cerdas)</option>
                                        <option value="gemini-pro">Gemini 1.0 Pro (Legacy)</option>
                                    </select>
                                </div>
                                <div className="text-xs text-slate-500 bg-indigo-50 p-3 rounded-lg border border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400">
                                    <p className="mb-1 font-semibold text-indigo-700 dark:text-indigo-400">Kegunaan AI:</p>
                                    <ul className="list-disc ml-4 space-y-0.5">
                                        <li>Asisten Virtual (Chatbot Pendaftaran)</li>
                                        <li>Analisa Data Calon Siswa</li>
                                        <li>Generate Template Pesan Otomatis</li>
                                    </ul>
                                    <p className="mt-2 text-[10px] text-slate-400">API Key bisa didapatkan di <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Google AI Studio</a></p>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Admin Access Settings */}
                {activeSection === 'access' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Left Column: Form & Fix */}
                            <div className="space-y-6 md:col-span-1">
                                <Card className="p-5 border-l-4 border-l-emerald-500">
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Tambah Admin Baru</h3>
                                    <div className="space-y-4">
                                        <Input
                                            label="Email Pengguna"
                                            placeholder="contoh@email.com"
                                            value={newAdminEmail}
                                            onChange={e => setNewAdminEmail(e.target.value)}
                                        />
                                        <Input
                                            label="Nama Role / Jabatan"
                                            placeholder="Contoh: Kepala Sekolah"
                                            value={newAdminRole}
                                            onChange={e => setNewAdminRole(e.target.value)}
                                        />
                                        <Button onClick={handleAddAdmin} className="w-full">
                                            <Plus size={16} /> Tambah Admin
                                        </Button>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                                        Pastikan email sudah terdaftar sebagai pengguna jika ingin menghubungkan dengan data profil.
                                    </p>
                                </Card>

                                <Card className="p-5 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100">
                                    <div className="flex items-start gap-3">
                                        <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                                            <LayoutDashboard size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 dark:text-white mb-1">Perbaikan Login WA</h3>
                                            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                                                Sinkronisasi ulang database jika ada pengguna lama yang tidak bisa login via WhatsApp.
                                            </p>
                                            <Button size="sm" onClick={syncExistingUsers} className="bg-orange-600 hover:bg-orange-700 text-white w-full border-none shadow-none">
                                                Sync Database
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* Right Column: Admin List */}
                            <div className="md:col-span-2">
                                <Card className="p-0 overflow-hidden">
                                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-700 dark:text-slate-200">Daftar Admin Aktif</h3>
                                        <span className="text-xs font-bold px-2 py-1 bg-white border rounded text-slate-500">{settings.admins?.length || 0} Admin</span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {settings.admins?.length === 0 && (
                                            <div className="p-8 text-center text-slate-400 italic bg-white">
                                                Belum ada admin terdaftar. <br />
                                                <span className="text-xs">Secara default, email yang mengandung kata "admin" memiliki akses penuh sementara.</span>
                                            </div>
                                        )}
                                        {settings.admins?.map((admin, idx) => (
                                            <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shadow-sm border-2 border-white">
                                                        {admin.email[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-slate-800 dark:text-white">{admin.email}</p>
                                                            {admin.role && <span className="text-[10px] px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 font-bold uppercase tracking-wider">{admin.role}</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <button
                                                                onClick={() => openPermissionModal(idx)}
                                                                className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium hover:underline bg-white px-2 py-0.5 rounded border border-transparent hover:border-emerald-100 transition-all"
                                                            >
                                                                {admin.permissions?.length === ADMIN_MODULES.length ? 'Akses Penuh (Super Admin)' : `${admin.permissions?.length || 0} Menu Diakses`}
                                                                <Settings size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveAdmin(admin.email)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                                    title="Hapus Admin"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}




            </div>

            {/* Permission Modal */}
            <Modal
                isOpen={permissionModal}
                onClose={() => setPermissionModal(false)}
                title="Atur Hak Akses Menu"
                footer={<div className="flex justify-end gap-2 w-full"><Button variant="secondary" onClick={() => setPermissionModal(false)}>Batal</Button><Button onClick={savePermissions}>Simpan Akses</Button></div>}
            >
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    <p className="text-sm text-slate-500 mb-2">Pilih menu yang dapat diakses oleh admin ini.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {ADMIN_MODULES.map(module => (
                            <div key={module.id} className="flex items-center gap-2 p-2 border rounded hover:bg-slate-50 cursor-pointer" onClick={() => togglePermission(module.id)}>
                                <input
                                    type="checkbox"
                                    checked={tempPermissions.includes(module.id)}
                                    onChange={() => { }}
                                    className="w-4 h-4 text-emerald-600 rounded"
                                />
                                <span className="text-sm font-medium text-slate-700 select-none">{module.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="pt-2 border-t mt-2">
                        <button onClick={() => setTempPermissions(ADMIN_MODULES.map(m => m.id))} className="text-xs text-emerald-600 font-bold mr-4 hover:underline">Pilih Semua</button>
                        <button onClick={() => setTempPermissions([])} className="text-xs text-red-500 font-bold hover:underline">Hapus Semua</button>
                    </div>
                </div>
            </Modal>

            <div className="flex justify-end pt-4 border-t">
                <Button onClick={saveSettings} disabled={loading} className="px-8 shadow-lg shadow-emerald-200">
                    <Save size={18} /> {loading ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}
                </Button>
            </div>
        </div >
    );
}

// Helper Component for QR Scanning
function BaileysQRScanner({ serverUrl }) {
    const [qr, setQr] = useState(null);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let interval;
        const fetchQR = async () => {
            try {
                // remove trailing slash
                const url = serverUrl.replace(/\/$/, '');
                const res = await fetch(`${url}/qr`);
                const data = await res.json();

                setConnected(data.connected);
                setQr(data.qr);
                setLoading(false);
            } catch (error) {
                // console.log("Waiting for Baileys server...");
            }
        };

        fetchQR();
        interval = setInterval(fetchQR, 3000); // Poll every 3s

        return () => clearInterval(interval);
    }, [serverUrl]);

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center min-h-[250px] animate-fade-in relative overflow-hidden">
            {connected ? (
                <div className="text-center animate-scale-in">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20">
                        <Wifi size={40} />
                    </div>
                    <h4 className="font-bold text-lg text-emerald-600 dark:text-emerald-400 mb-1">WhatsApp Terhubung!</h4>
                    <p className="text-xs text-slate-500">Server Baileys sedang berjalan normal.</p>
                </div>
            ) : (
                <div className="text-center w-full">
                    {qr ? (
                        <div className="animate-scale-in flex flex-col items-center">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <QrCode size={18} /> Scan QR Code ini di WhatsApp
                            </p>
                            <div className="p-4 bg-white rounded-xl shadow-lg border border-slate-100 inline-block">
                                <QRCode value={qr} size={200} />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-4 animate-pulse">Update otomatis...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[200px]">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400 mb-4"></div>
                            <p className="text-xs text-slate-500 font-mono">Menunggu QR Code dari Server...</p>
                        </div>
                    )}
                </div>
            )}

            {/* Status Badge */}
            <div className={`absolute top-3 right-3 px-2 py-1 rounded text-[10px] font-bold border ${connected ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                {connected ? 'ONLINE' : 'CONNECTING...'}
            </div>
        </div>
    );
}
