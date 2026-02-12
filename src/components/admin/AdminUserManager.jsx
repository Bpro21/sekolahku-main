import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { Card, Button, Input } from '../ui/Elements';
import { Modal, Toast } from '../ui/Overlays';
import {
    Users, Search, Edit, Trash2, Key, Shield, UserPlus,
    Mail, Phone, User, CheckCircle, XCircle, MoreVertical,
    RefreshCcw, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { logActivity } from '../../utils/activityLogger';

export default function AdminUserManager({ showToast }) {
    const [users, setUsers] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('users'); // users, admins
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [entriesPerPage] = useState(10);

    // Modal states
    const [editModal, setEditModal] = useState(false);
    const [deleteModal, setDeleteModal] = useState(false);
    const [resetModal, setResetModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

    // Admin handling states
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminRole, setNewAdminRole] = useState('Admin');

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Profiles
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (profileError) throw profileError;
            setUsers(profileData || []);

            // 2. Fetch App Settings (for Admin Whitelist)
            const { data: sData, error: sError } = await supabase
                .from('app_settings')
                .select('*')
                .eq('id', 'main')
                .single();

            if (sError) throw sError;
            setSettings(sData);
            setAdmins(sData.admins || []);

        } catch (error) {
            console.error("Error fetching user data:", error);
            showToast("Gagal memuat data: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filters
    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.phone?.includes(searchTerm)
    );

    const filteredAdmins = admins.filter(a =>
        a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination (for Users)
    const totalPages = Math.ceil(filteredUsers.length / entriesPerPage);
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

    // Handlers
    const handleEditClick = (user) => {
        setSelectedUser(user);
        setFormData({ name: user.name || '', email: user.email || '', phone: user.phone || '' });
        setEditModal(true);
    };

    const handleUpdateUser = async () => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    updated_at: new Date()
                })
                .eq('id', selectedUser.id);

            if (error) throw error;

            showToast("Data user berhasil diperbarui");
            setEditModal(false);
            fetchData();

            logActivity(
                (await supabase.auth.getUser()).data.user,
                'USER_MGMT',
                `Update profile user: ${formData.email}`
            );
        } catch (error) {
            showToast(error.message, "error");
        }
    };

    const handleDeleteUser = async () => {
        try {
            // Cascade delete: Remove all user-related data from all tables
            // 1. Delete registrations (biodata siswa)
            const { error: regError } = await supabase.from('registrations').delete().eq('user_id', selectedUser.id);
            if (regError) console.warn("Error deleting registrations:", regError.message);

            // 2. Delete invoices (data pembayaran)
            const { error: invError } = await supabase.from('invoices').delete().eq('user_id', selectedUser.id);
            if (invError) console.warn("Error deleting invoices:", invError.message);

            // 3. Delete notifications
            const { error: notifError } = await supabase.from('notifications').delete().eq('user_id', selectedUser.id);
            if (notifError) console.warn("Error deleting notifications:", notifError.message);

            // 4. Delete edit_requests
            const { error: editError } = await supabase.from('edit_requests').delete().eq('user_id', selectedUser.id);
            if (editError) console.warn("Error deleting edit_requests:", editError.message);

            // 5. Delete indent_submissions (pendaftaran indent internal)
            const { error: indentSubError } = await supabase.from('indent_submissions').delete().eq('user_id', selectedUser.id);
            if (indentSubError) console.warn("Error deleting indent_submissions:", indentSubError.message);

            // 6. Delete indents (booking external/internal)
            const { error: indentError } = await supabase.from('indents').delete().eq('user_id', selectedUser.id);
            if (indentError) console.warn("Error deleting indents:", indentError.message);

            // 7. Delete from user_lookup
            await supabase.from('user_lookup').delete().eq('uid', selectedUser.id);

            // 8. Finally delete from profiles
            const { error: pError } = await supabase.from('profiles').delete().eq('id', selectedUser.id);
            if (pError) throw pError;

            showToast("User dan semua data terkait berhasil dihapus");
            setDeleteModal(false);
            fetchData();

            logActivity(
                (await supabase.auth.getUser()).data.user,
                'USER_MGMT',
                `Hapus user dan data terkait: ${selectedUser.email}`
            );
        } catch (error) {
            showToast(error.message, "error");
        }
    };

    const handleResetPassword = async () => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email, {
                redirectTo: `${window.location.origin}/login`,
            });
            if (error) throw error;

            showToast("Email instruksi reset password telah dikirim ke " + selectedUser.email);
            setResetModal(false);
        } catch (error) {
            showToast(error.message, "error");
        }
    };

    // Admin whitelist handlers
    const handleAddAdmin = async () => {
        if (!newAdminEmail.includes('@')) return showToast("Email tidak valid", "error");

        const newAdmin = {
            email: newAdminEmail,
            name: 'Admin Baru',
            role: newAdminRole,
            permissions: [] // Start with no permissions
        };

        const updatedAdmins = [...admins, newAdmin];

        try {
            const { error } = await supabase
                .from('app_settings')
                .update({ admins: updatedAdmins })
                .eq('id', 'main');

            if (error) throw error;

            showToast("Admin berhasil ditambahkan ke whitelist");
            setNewAdminEmail('');
            fetchData();
        } catch (error) {
            showToast(error.message, "error");
        }
    };

    const handleRemoveAdmin = async (email) => {
        if (!confirm("Hapus " + email + " dari daftar admin?")) return;

        const updatedAdmins = admins.filter(a => a.email !== email);

        try {
            const { error } = await supabase
                .from('app_settings')
                .update({ admins: updatedAdmins })
                .eq('id', 'main');

            if (error) throw error;

            showToast("Admin dihapus dari whitelist");
            fetchData();
        } catch (error) {
            showToast(error.message, "error");
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Users className="text-emerald-600" /> Manajemen Akun
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Kelola akses User dan Administrator sistem</p>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <User size={16} /> User (Siswa/Ortu)
                    </button>
                    <button
                        onClick={() => setActiveTab('admins')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'admins' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <ShieldCheck size={16} /> Administrator
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <Card className="p-0 overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900">
                {/* Search & Utility Bar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder={`Cari nama atau email ${activeTab === 'users' ? 'user' : 'admin'}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        />
                    </div>
                    {activeTab === 'admins' && (
                        <div className="flex gap-2">
                            <input
                                type="email"
                                placeholder="Email Admin Baru"
                                value={newAdminEmail}
                                onChange={(e) => setNewAdminEmail(e.target.value)}
                                className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <Button onClick={handleAddAdmin} className="bg-emerald-600 text-white rounded-xl flex items-center gap-2">
                                <UserPlus size={18} /> Tambah Admin
                            </Button>
                        </div>
                    )}
                </div>

                {/* Table Section */}
                <div className="overflow-x-auto min-h-[400px]">
                    {activeTab === 'users' ? (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Informasi User</th>
                                    <th className="px-6 py-4">Kontak</th>
                                    <th className="px-6 py-4">Terdaftar</th>
                                    <th className="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {loading ? (
                                    <tr><td colSpan="4" className="text-center py-20 text-slate-400 italic">Memuat data user...</td></tr>
                                ) : paginatedUsers.length === 0 ? (
                                    <tr><td colSpan="4" className="text-center py-20 text-slate-400 italic">Tidak ada user ditemukan.</td></tr>
                                ) : paginatedUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center font-bold">
                                                    {user.name?.charAt(0) || 'U'}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-slate-200">{user.name || 'No Name'}</div>
                                                    <div className="text-xs text-slate-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 space-y-1">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                                <Phone size={14} className="text-emerald-500" />
                                                <span className="text-xs">{user.phone || '-'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                                <Mail size={14} className="text-blue-500" />
                                                <span className="text-xs">{user.email || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-slate-500">
                                                {user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center items-center gap-2">
                                                <button onClick={() => handleEditClick(user)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Profil">
                                                    <Edit size={18} />
                                                </button>
                                                <button onClick={() => { setSelectedUser(user); setResetModal(true); }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Reset Password">
                                                    <Key size={18} />
                                                </button>
                                                <button onClick={() => { setSelectedUser(user); setDeleteModal(true); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Hapus User">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Email Administrator</th>
                                    <th className="px-6 py-4">Peran / Label</th>
                                    <th className="px-6 py-4">Hak Akses</th>
                                    <th className="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {filteredAdmins.map((admin, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 shadow-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg flex items-center justify-center">
                                                    <Shield size={16} />
                                                </div>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{admin.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded text-[10px] font-black uppercase tracking-wider border border-indigo-100 dark:border-indigo-800">
                                                {admin.role || 'Admin'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[10px] text-slate-400 max-w-xs truncate">
                                                {admin.permissions?.length > 0 ? `${admin.permissions.length} Modul Aktif` : 'Semua (Superadmin/Default)'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleRemoveAdmin(admin.email)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Hapus Hak Akses"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer / Pagination for Users */}
                {activeTab === 'users' && !loading && totalPages > 1 && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <span className="text-xs text-slate-500">Hal {currentPage} dari {totalPages}</span>
                        <div className="flex gap-2">
                            <Button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} variant="secondary" className="h-8 px-3 text-[10px] font-bold">Prev</Button>
                            <Button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} variant="secondary" className="h-8 px-3 text-[10px] font-bold">Next</Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* MODALS */}
            {/* Edit Modal */}
            <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Profil User">
                <div className="space-y-4">
                    <Input
                        label="Nama Lengkap"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                    <Input
                        label="Email (Hati-hati: harus sinkron dengan sistem Auth)"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                    <Input
                        label="No WhatsApp"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                    <div className="pt-4 flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setEditModal(false)}>Batal</Button>
                        <Button onClick={handleUpdateUser} className="bg-emerald-600 text-white">Simpan Perubahan</Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Konfirmasi Hapus Permanen">
                <div className="space-y-4 text-center p-4">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                        <AlertTriangle size={32} />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white">Hapus Semua Data User?</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Menghapus user <strong className="text-red-600">{selectedUser?.email}</strong> akan menghapus <strong>SEMUA</strong> data terkait secara permanen:
                    </p>
                    <ul className="text-left text-xs text-slate-600 dark:text-slate-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg space-y-1">
                        <li>• Data Profil User</li>
                        <li>• Data Pendaftaran & Biodata Siswa</li>
                        <li>• Riwayat Pembayaran & Invoice</li>
                        <li>• Data Booking/Indent (Internal & Eksternal)</li>
                        <li>• Notifikasi</li>
                        <li>• Permintaan Edit Data</li>
                        <li>• Submission Indent</li>
                    </ul>
                    <p className="text-xs italic text-red-500 font-medium">
                        ⚠️ Tindakan ini tidak dapat dibatalkan!<br />
                        Untuk menonaktifkan login secara permanen, hapus juga akun di Supabase Auth Dashboard.
                    </p>
                    <div className="pt-4 flex justify-center gap-2">
                        <Button variant="secondary" onClick={() => setDeleteModal(false)}>Batal</Button>
                        <Button onClick={handleDeleteUser} className="bg-red-600 text-white">Ya, Hapus Permanen</Button>
                    </div>
                </div>
            </Modal>

            {/* Reset Modal */}
            <Modal isOpen={resetModal} onClose={() => setResetModal(false)} title="Reset Password">
                <div className="space-y-4 text-center p-4">
                    <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2">
                        <RefreshCcw size={32} />
                    </div>
                    <h4 className="font-bold text-slate-800">Kirim Link Reset Password?</h4>
                    <p className="text-sm text-slate-500">
                        Sistem akan mengirimkan email instruksi ganti password ke:
                        <br />
                        <strong className="text-amber-600">{selectedUser?.email}</strong>
                    </p>
                    <div className="pt-4 flex justify-center gap-2">
                        <Button variant="secondary" onClick={() => setResetModal(false)}>Batal</Button>
                        <Button onClick={handleResetPassword} className="bg-amber-600 text-white">Kirim Instruksi</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
