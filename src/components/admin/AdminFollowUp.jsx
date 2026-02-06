import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { MessageCircle, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, Button, Badge } from '../ui/Elements';
import { Modal } from '../ui/Overlays';
import { sendWhatsappMessage } from '../../utils/helpers';

export default function AdminFollowUp({ showToast }) {
    const [activeTab, setActiveTab] = useState('payment_reg'); // payment_reg, payment_rereg, docs
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(null); // ID of student being sent to

    // Fetch all registrations
    const fetchRegistrations = async () => {
        const { data } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });
        if (data) {
            setData(data);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegistrations();

        const channel = supabase.channel('admin_followup')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, fetchRegistrations)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Filter data based on active tab
    useEffect(() => {
        let filtered = [];
        if (activeTab === 'payment_reg') {
            // Belum bayar pendaftaran usually means status 'submitted'
            // We might also want to exclude those who have paid (if we had a paid status for reg fee specially, but usually 'verified' implies paid?)
            // Assuming 'submitted' = waiting for verification/payment
            filtered = data.filter(s => s.status === 'submitted');
        } else if (activeTab === 'payment_rereg') {
            // Belum daftar ulang usually means status 'lulus' but not yet 'paid' (or whatever final status is)
            filtered = data.filter(s => s.status === 'lulus');
        } else if (activeTab === 'docs') {
            // Belum lengkap berkas usually means 'draft'
            filtered = data.filter(s => s.status === 'draft');
        }
        setFilteredData(filtered);
    }, [activeTab, data]);

    const [sendModal, setSendModal] = useState({ isOpen: false, student: null, phones: [] });

    const handleSendWhatsApp = async (student) => {
        setSending(student.id);
        try {
            // Fetch detailed student data AND user profile data
            const { data: sData, error: sError } = await supabase.from('students').select('*').eq('id', student.student_id).single();
            const { data: pData, error: pError } = await supabase.from('profiles').select('*').eq('id', student.user_id).single();

            if (sError || !sData) throw new Error("Detail siswa tidak ditemukan.");
            const profile = pData || {};

            const availablePhones = [];

            // 1. From User Profile (Account)
            if (profile.phone) {
                availablePhones.push({
                    label: `Akun Profil (${profile.name || 'User'})`,
                    number: profile.phone
                });
            }

            // 2. From Student Data (Parents)
            if (sData.parents?.father?.phone) availablePhones.push({ label: `Ayah (${sData.parents.father.name})`, number: sData.parents.father.phone });
            if (sData.parents?.mother?.phone) availablePhones.push({ label: `Ibu (${sData.parents.mother.name})`, number: sData.parents.mother.phone });
            if (sData.parents?.guardian?.phone) availablePhones.push({ label: `Wali (${sData.parents.guardian.name})`, number: sData.parents.guardian.phone });

            if (availablePhones.length === 0) throw new Error("Tidak ada nomor kontak (Akun/Orang Tua) yang terdaftar.");

            // Remove duplicates based on number
            const uniquePhones = availablePhones.filter((v, i, a) => a.findIndex(t => (t.number === v.number)) === i);

            setSendModal({
                isOpen: true,
                student: student,
                phones: uniquePhones
            });
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setSending(null);
        }
    };

    const executeSend = async (phoneObj) => {
        const { student } = sendModal;
        const phone = phoneObj.number;
        setSendModal(prev => ({ ...prev, isOpen: false })); // Close modal immediately or keep loading?

        try {
            // 1. Fetch Settings for Template
            const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 'main').single();
            if (!settings) throw new Error("Pengaturan tidak ditemukan.");

            let template = '';
            let reminderField = '';

            if (activeTab === 'payment_reg') {
                template = settings.template_payment_reminder;
                reminderField = 'last_reminder_payment_reg';
            } else if (activeTab === 'payment_rereg') {
                template = settings.template_reminder; // 'Daftar Ulang' template
                reminderField = 'last_reminder_payment_rereg';
            } else if (activeTab === 'docs') {
                template = settings.template_document_reminder;
                reminderField = 'last_reminder_docs';
            }

            if (!template) throw new Error("Template pesan belum diatur di Pengaturan Aplikasi.");

            const message = template.replace(/{name}/g, student.student_name);

            // Send
            await sendWhatsappMessage(phone, message);

            // Update Log
            await supabase.from('registrations').update({
                [reminderField]: new Date().toISOString()
            }).eq('id', student.id);

            showToast(`Pesan berhasil dikirim ke ${phoneObj.label}!`, 'success');
            fetchRegistrations();
        } catch (error) {
            console.error(error);
            showToast(error.message || "Gagal mengirim pesan", "error");
        }
    };

    const formatDate = (dateInput) => {
        if (!dateInput) return '-';
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const getReminderStatus = (student) => {
        let field = '';
        if (activeTab === 'payment_reg') field = 'last_reminder_payment_reg';
        else if (activeTab === 'payment_rereg') field = 'last_reminder_payment_rereg';
        else if (activeTab === 'docs') field = 'last_reminder_docs';

        const ts = student[field];
        if (!ts) return <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold">Belum</span>;

        return (
            <div className="flex flex-col items-center">
                <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                    <CheckCircle size={10} /> Sudah
                </span>
                <span className="text-[10px] text-slate-400 mt-1">{formatDate(ts)}</span>
            </div>
        );
    };

    const TabButton = ({ id, label, icon: Icon, colorClass }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 px-4 text-sm font-bold border-b-2 transition-all duration-300 ${activeTab === id
                ? `${colorClass} border-current bg-white`
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
        >
            <Icon size={18} className={activeTab === id ? '' : 'opacity-70'} />
            {label}
        </button>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <MessageCircle className="text-emerald-600" /> Follow Up & Reminder
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Kelola notifikasi dan reminder tagihan siswa secara manual.</p>
                </div>
            </div>

            <Card className="p-0 overflow-hidden border border-slate-200 rounded-2xl shadow-sm">
                <div className="flex border-b border-slate-200 bg-slate-50/50">
                    <TabButton
                        id="payment_reg"
                        label="Tagihan Pendaftaran"
                        icon={AlertCircle}
                        colorClass="text-amber-600"
                    />
                    <TabButton
                        id="payment_rereg"
                        label="Tagihan Daftar Ulang"
                        icon={Clock}
                        colorClass="text-blue-600"
                    />
                    <TabButton
                        id="docs"
                        label="Kelengkapan Berkas"
                        icon={RefreshCw}
                        colorClass="text-slate-600"
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white text-slate-600 text-[11px] font-black uppercase tracking-widest border-b border-slate-100">
                                <th className="p-5 pl-6">ID / Kontak</th>
                                <th className="p-5">Nama Lengkap</th>
                                <th className="p-5">Jurusan & Cabang</th>
                                <th className="p-5 text-center">Tanggal Daftar</th>
                                <th className="p-5 text-center">Status Notifikasi</th>
                                <th className="p-5 pr-6 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm bg-white">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-400">Loading data...</td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-16 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                                <CheckCircle size={32} className="text-slate-300" />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="font-bold text-slate-600 text-base">Semua Beres!</div>
                                                <div className="text-slate-400">Tidak ada siswa yang perlu di-follow up untuk kategori ini.</div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((student) => (
                                    <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-5 pl-6 align-middle">
                                            <div className="font-mono text-slate-500 font-bold text-xs bg-slate-100 px-2 py-1 rounded w-fit">#{student.id.substring(0, 6)}</div>
                                            <div className="mt-2 scale-90 origin-left">
                                                <Badge status={student.status} />
                                            </div>
                                        </td>
                                        <td className="p-5 align-middle">
                                            <div className="font-bold text-slate-800 text-base">{student.student_name}</div>
                                        </td>
                                        <td className="p-5 align-middle">
                                            <div className="text-slate-800 font-bold text-sm">{student.unit_name}</div>
                                            <div className="text-slate-500 text-xs mt-1 font-medium">{student.major || 'Program Reguler'}</div>
                                        </td>
                                        <td className="p-5 text-center align-middle text-slate-600 font-medium text-xs">
                                            {formatDate(student.created_at)}
                                        </td>
                                        <td className="p-5 text-center align-middle">
                                            {getReminderStatus(student)}
                                        </td>
                                        <td className="p-5 pr-6 text-center align-middle">
                                            <Button
                                                onClick={() => handleSendWhatsApp(student)}
                                                disabled={sending === student.id}
                                                className={`shadow-sm rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider hover:shadow-md transition-all active:scale-95 ${sending === student.id ? 'opacity-70 cursor-not-allowed' : ''
                                                    } ${activeTab === 'payment_reg' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200' :
                                                        activeTab === 'payment_rereg' ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200' :
                                                            'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                                                    }`}
                                            >
                                                {sending === student.id ? (
                                                    <RefreshCw className="animate-spin" size={16} />
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <MessageCircle size={16} />
                                                        <span>WhatsApp</span>
                                                    </div>
                                                )}
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-200 text-center text-xs font-medium text-slate-500">
                    Menampilkan <span className="font-bold text-slate-800">{filteredData.length}</span> siswa yang perlu ditindaklanjuti.
                </div>
            </Card>

            <Modal isOpen={sendModal.isOpen} onClose={() => setSendModal(prev => ({ ...prev, isOpen: false }))} title="Kirim WhatsApp Reminder" footer={<Button variant="secondary" onClick={() => setSendModal(prev => ({ ...prev, isOpen: false }))}>Batal</Button>}>
                <div className="space-y-4">
                    <p className="text-slate-600">Pilih nomor tujuan untuk mengirim pesan reminder kepada <strong>{sendModal.student?.student_name}</strong>:</p>
                    <div className="grid gap-2">
                        {sendModal.phones.map((p, idx) => (
                            <button
                                key={idx}
                                onClick={() => executeSend(p)}
                                className="w-full text-left bg-white border hover:bg-emerald-50 hover:border-emerald-200 p-4 rounded-xl transition flex items-center justify-between group"
                            >
                                <div>
                                    <div className="font-bold text-slate-800">{p.label}</div>
                                    <div className="text-sm text-slate-500 font-mono">{p.number}</div>
                                </div>
                                <div className="p-2 bg-slate-100 group-hover:bg-emerald-500 group-hover:text-white rounded-full transition">
                                    <MessageCircle size={18} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
