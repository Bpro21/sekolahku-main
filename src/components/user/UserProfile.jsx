import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { User, Mail, Lock, Camera, Save, Phone } from 'lucide-react';
import { Card, Button, Input } from '../ui/Elements';
import { fileToBase64, sendWhatsappOTP } from '../../utils/helpers';
import { Modal } from '../ui/Overlays';

export default function UserProfile({ user, showToast }) {
    const [formData, setFormData] = useState({
        displayName: user?.displayName || '',
        email: user?.email || '',
        phone: '',
        photoURL: user?.photoURL || ''
    });
    const [passwords, setPasswords] = useState({
        newPassword: '',
        confirmPassword: ''
    });
    const [originalData, setOriginalData] = useState({}); // Track original values to detect changes
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // OTP State
    const [otpModal, setOtpModal] = useState(false);
    const [otpInput, setOtpInput] = useState('');
    const [serverOtp, setServerOtp] = useState('');
    const [securityAction, setSecurityAction] = useState(null); // { type: 'email' | 'password' | 'phone', payload: ... }

    useEffect(() => {
        const fetchProfile = async () => {
            if (user) {
                // Fetch additional profile data from Supabase
                const { data: profileData } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                const data = profileData || {};
                const initialData = {
                    displayName: user.user_metadata?.displayName || user.user_metadata?.full_name || data.name || '',
                    email: user.email || '',
                    photoURL: data.photo_url || user.user_metadata?.avatar_url || '',
                    phone: data.phone || user.user_metadata?.phone || ''
                };
                setFormData(initialData);
                setOriginalData(initialData);
            }
        };
        fetchProfile();
    }, [user]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();

        // Check if Phone Number changed (Requires OTP)
        if (formData.phone !== originalData.phone) {
            initiateSecurityAction('phone', formData.phone);
            return;
        }

        // If only Name/Photo changed, update directly
        saveProfileData();
    };

    const saveProfileData = async () => {
        setLoading(true);
        try {
            // 1. Update Supabase Auth User Metadata (DisplayName)
            if (user.user_metadata?.full_name !== formData.displayName) {
                const { error: authError } = await supabase.auth.updateUser({
                    data: { full_name: formData.displayName }
                });
                if (authError) throw authError;
            }

            // 2. Update/Upsert Supabase Profile
            const { error } = await supabase
                .from('user_profiles')
                .upsert({
                    user_id: user.id,
                    name: formData.displayName,
                    phone: formData.phone,
                    email: formData.email,
                    photo_url: formData.photoURL,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            if (error) throw error;

            // Update original data to match new state
            setOriginalData({ ...formData });
            showToast('Profil berhasil diperbarui!');
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- SECURITY ACTIONS WITH OTP ---

    const initiateSecurityAction = async (type, payload) => {
        // Target Phone: For 'phone' change, send to NEW phone (payload). For others, send to EXISTING phone (formData.phone or originalData.phone).
        // Actually formData.phone might be edited if user changed it in the input.
        // For 'email'/'password' change, we should send to the TRUSTED (original) phone.
        const targetPhone = type === 'phone' ? payload : originalData.phone;

        if (!targetPhone) {
            showToast('Nomor WhatsApp belum terdaftar. Harap lengkapi dulu.', 'error');
            return;
        }

        setLoading(true);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        try {
            await sendWhatsappOTP(targetPhone, code);
            setServerOtp(code);
            setSecurityAction({ type, payload });
            setOtpModal(true);
            showToast(`Kode OTP dikirim ke ${targetPhone}`);
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otpInput !== serverOtp) {
            showToast('Kode OTP salah!', 'error');
            return;
        }

        setOtpModal(false);
        setLoading(true);

        try {
            if (securityAction.type === 'email') {
                const { error: emailError } = await supabase.auth.updateUser({ email: securityAction.payload });
                if (emailError) throw emailError;
                // Sync to profile table too
                await supabase.from('user_profiles').update({ email: securityAction.payload }).eq('user_id', user.id);
                showToast('Email diperbarui! Silakan cek email untuk konfirmasi.');

            } else if (securityAction.type === 'password') {
                const { error: pwError } = await supabase.auth.updateUser({ password: securityAction.payload });
                if (pwError) throw pwError;
                setPasswords({ newPassword: '', confirmPassword: '' });
                showToast('Password berhasil diubah!');

            } else if (securityAction.type === 'phone') {
                // Phone change verification passed -> Save Profile
                await saveProfileData();
            }
        } catch (error) {
            if (error.message?.includes('reauthentication')) {
                showToast('Demi keamanan, silakan Logout & Login kembali sebelum melakukan perubahan ini.', 'error');
            } else {
                showToast(error.message, 'error');
            }
        } finally {
            setLoading(false);
            setSecurityAction(null);
            setOtpInput('');
            setServerOtp('');
        }
    };

    const handleUpdateEmail = () => {
        if (!formData.email || formData.email === user.email) return;
        initiateSecurityAction('email', formData.email);
    };

    const handleUpdatePassword = () => {
        if (!passwords.newPassword) return;
        if (passwords.newPassword !== passwords.confirmPassword) {
            showToast('Konfirmasi password tidak cocok.', 'error');
            return;
        }
        initiateSecurityAction('password', passwords.newPassword);
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const base64 = await fileToBase64(file);
            setFormData(prev => ({ ...prev, photoURL: base64 }));
        } catch (error) {
            showToast('Gagal upload foto', 'error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <User className="text-emerald-600" /> Profil Saya
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Photo & Basic Info */}
                <div className="md:col-span-1 space-y-6">
                    <Card className="p-6 flex flex-col items-center">
                        <div className="relative group mb-4">
                            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-100 shadow-lg bg-slate-200">
                                {formData.photoURL ? (
                                    <img src={formData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                        <User size={48} />
                                    </div>
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 p-2 bg-emerald-600 text-white rounded-full cursor-pointer hover:bg-emerald-700 shadow-md transition-all">
                                <Camera size={16} />
                                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                            </label>
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 text-center">{user.user_metadata?.displayName || user.user_metadata?.full_name || 'Pengguna'}</h3>
                        <p className="text-sm text-slate-500 text-center">{user.email}</p>
                        <div className="mt-4 w-full">
                            <div className="text-xs font-bold text-slate-400 uppercase text-center mb-1">Role</div>
                            <div className={`text-center text-sm font-bold px-3 py-1 rounded-full ${user.email?.includes('admin') ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {user.email?.includes('admin') ? 'Administrator' : 'Wali Murid'}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Right Column: Edit Forms */}
                <div className="md:col-span-2 space-y-6">
                    {/* Biodata Form */}
                    <Card className="p-6">
                        <h3 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><User size={18} /> Edit Data Diri</h3>
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <Input
                                label="Nama Lengkap"
                                value={formData.displayName}
                                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                placeholder="Nama Lengkap Anda"
                            />
                            <Input
                                label="Nomor Telepon / WhatsApp"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="Contoh: 08123456789"
                                icon={<Phone size={16} />}
                            />
                            <div className="flex justify-end">
                                <Button type="submit" disabled={loading}>
                                    <Save size={16} /> Simpan Profil
                                </Button>
                            </div>
                        </form>
                    </Card>

                    {/* Security Settings */}
                    <Card className="p-6 border-l-4 border-l-orange-400">
                        <h3 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><Lock size={18} /> Keamanan Akun</h3>

                        <div className="space-y-6">
                            {/* Email Change */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Ubah Email Login</label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <input
                                            type="email"
                                            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                    <Button variant="secondary" onClick={handleUpdateEmail} disabled={loading || formData.email === user.email} className="text-xs">
                                        Update Email
                                    </Button>
                                </div>
                                <p className="text-[10px] text-orange-600 mt-1">*Mengubah email akan meminta Anda login ulang.</p>
                            </div>

                            {/* Password Change */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Ubah Password</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                                    <input
                                        type="password"
                                        placeholder="Password Baru"
                                        className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={passwords.newPassword}
                                        onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })}
                                    />
                                    <input
                                        type="password"
                                        placeholder="Ulangi Password"
                                        className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={passwords.confirmPassword}
                                        onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button variant="danger" onClick={handleUpdatePassword} disabled={loading || !passwords.newPassword} className="text-xs">
                                        Ganti Password
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

            </div>

            {/* OTP Modal */}
            <Modal
                isOpen={otpModal}
                onClose={() => setOtpModal(false)}
                title="Verifikasi Keamanan"
                footer={<div className="flex justify-end gap-2 w-full"><Button variant="secondary" onClick={() => setOtpModal(false)}>Batal</Button><Button onClick={handleVerifyOtp} disabled={loading}>{loading ? 'Memproses...' : 'Verifikasi OTP'}</Button></div>}
            >
                <div className="space-y-4 text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                        <Lock size={32} />
                    </div>
                    <p className="text-slate-600 text-sm">
                        Demi keamanan akun, kami telah mengirimkan kode OTP ke WhatsApp Anda <strong>{formData.phone}</strong>.
                    </p>
                    <Input
                        label="Masukkan Kode OTP"
                        placeholder="6 digit kode"
                        value={otpInput}
                        onChange={e => setOtpInput(e.target.value)}
                        className="text-center text-lg tracking-widest font-bold"
                    />
                    <p className="text-xs text-slate-400">Silakan cek WhatsApp Anda (via Fonnte).</p>
                </div>
            </Modal>
        </div>
    );
}
