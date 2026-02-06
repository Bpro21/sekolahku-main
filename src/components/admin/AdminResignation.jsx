import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    UserMinus, Search, AlertTriangle, FileText, CheckCircle, XCircle, RotateCcw
} from 'lucide-react';
import { Card, Button, Input, Badge } from '../ui/Elements';
import { Modal } from '../ui/Overlays';

export default function AdminResignation({ showToast }) {
    const [students, setStudents] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [confirmModal, setConfirmModal] = useState(false);
    const [restoreModal, setRestoreModal] = useState(false);

    // Form State
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');

    const fetchStudents = async () => {
        const { data, error } = await supabase.from('registrations').select('*');
        if (error) console.error(error);
        else setStudents(data || []);
    };

    useEffect(() => {
        fetchStudents();

        const channel = supabase.channel('admin_resignation')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, fetchStudents)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Filter for search
    const searchResults = search.length > 2 ? students.filter(s =>
        (s.student_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.id || '').toLowerCase().includes(search.toLowerCase())
    ) : [];

    // Filter for History list (Resigned students)
    const resignedStudents = students.filter(s => s.status === 'resigned').sort((a, b) => {
        const dateA = new Date(a.resignation_data?.date || 0);
        const dateB = new Date(b.resignation_data?.date || 0);
        return dateB - dateA;
    });

    const handleResign = async () => {
        if (!reason) return showToast('Alasan pengunduran diri wajib diisi', 'error');

        try {
            const payload = {
                status: 'resigned',
                previous_status: selectedStudent.status, // Save prev status to restore if needed
                resignation_data: {
                    reason,
                    notes,
                    date: new Date().toISOString(),
                    processed_at: new Date().toISOString(),
                    processed_by: 'Admin' // In real app, get current admin name
                },
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from('registrations').update(payload).eq('id', selectedStudent.id);
            if (error) throw error;

            showToast(`Siswa ${selectedStudent.student_name} telah diproses Mengundurkan Diri.`);
            setConfirmModal(false);
            setSelectedStudent(null);
            setReason('');
            setNotes('');
            setSearch('');
        } catch (e) {
            console.error(e);
            showToast('Gagal memproses data: ' + e.message, 'error');
        }
    };

    const handleRestore = async () => {
        try {
            const prevStatus = selectedStudent.previous_status || 'submitted'; // Fallback
            const payload = {
                status: prevStatus,
                resignation_data: null,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from('registrations').update(payload).eq('id', selectedStudent.id);
            if (error) throw error;

            showToast(`Status siswa ${selectedStudent.student_name} dipulihkan ke '${prevStatus}'.`);
            setRestoreModal(false);
            setSelectedStudent(null);
        } catch (e) {
            showToast('Gagal memulihkan data: ' + e.message, 'error');
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><UserMinus className="text-red-600" /> Pengunduran Diri Siswa</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT: Process New Resignation */}
                <Card className="p-6 h-fit bg-slate-50 border-slate-200">
                    <h3 className="font-bold text-lg text-slate-700 mb-4 flex items-center gap-2"><Search size={18} /> Cari Siswa Aktif</h3>
                    <div className="relative mb-4">
                        <input
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition shadow-sm"
                            placeholder="Ketik Nama atau ID Pendaftaran..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    </div>

                    {search.length > 2 && (
                        <div className="bg-white rounded-xl shadow-sm border overflow-hidden max-h-[300px] overflow-y-auto">
                            {searchResults.filter(s => s.status !== 'resigned').length > 0 ? (
                                searchResults.filter(s => s.status !== 'resigned').map(s => (
                                    <div key={s.id} onClick={() => { setSelectedStudent(s); setConfirmModal(true); }} className="p-3 border-b last:border-0 hover:bg-slate-50 cursor-pointer transition flex justify-between items-center group">
                                        <div>
                                            <div className="font-bold text-slate-800 group-hover:text-red-700 transition">{s.student_name}</div>
                                            <div className="text-xs text-slate-500">{s.unit_name} • {s.id}</div>
                                        </div>
                                        <Badge status={s.status} />
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-slate-400 text-sm">Tidak ditemukan siswa aktif dengan kata kunci tersebut.</div>
                            )}
                        </div>
                    )}

                    <div className="mt-6 p-4 bg-blue-50 text-blue-800 text-sm rounded-lg flex gap-3">
                        <AlertTriangle className="shrink-0" size={20} />
                        <div>
                            <p className="font-bold">Informasi Penting</p>
                            <p className="opacity-90 mt-1">Siswa yang diproses <strong>Mengundurkan Diri</strong> statusnya akan berubah menjadi <span className="font-mono bg-white px-1 rounded text-red-600">resigned</span>.</p>
                            <p className="opacity-90 mt-1">Kuota cabang yang sebelumnya terisi oleh siswa ini (jika status Lulus/Diterima) akan otomatis kosong setelah sinkronisasi data.</p>
                        </div>
                    </div>
                </Card>

                {/* RIGHT: Resignation History */}
                <Card className="p-0 border-slate-200 overflow-hidden flex flex-col h-[500px]">
                    <div className="p-4 bg-white border-b flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><FileText size={18} /> Riwayat Pengunduran Diri</h3>
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{resignedStudents.length} Siswa</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0">
                        {resignedStudents.length > 0 ? (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0 border-b">
                                    <tr>
                                        <th className="p-4">Siswa</th>
                                        <th className="p-4">Alasan & Tanggal</th>
                                        <th className="p-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {resignedStudents.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">{s.student_name}</div>
                                                <div className="text-xs text-slate-500 font-mono">#{s.id.slice(0, 6)}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-red-600">{s.resignation_data?.reason}</div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {s.resignation_data?.date ? new Date(s.resignation_data.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                                                </div>
                                                {s.resignation_data?.notes && <div className="text-xs text-slate-400 italic mt-0.5">"{s.resignation_data.notes}"</div>}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => { setSelectedStudent(s); setRestoreModal(true); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition" title="Batalkan Pengunduran Diri (Restore)">
                                                    <RotateCcw size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 p-8">
                                <UserMinus size={40} className="opacity-20" />
                                <p>Belum ada data pengunduran diri.</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* CONFIRM RESIGNATION MODAL */}
            <Modal isOpen={confirmModal} onClose={() => setConfirmModal(false)} title="Konfirmasi Pengunduran Diri" footer={<div className="flex justify-end gap-2 w-full"><Button variant="secondary" onClick={() => setConfirmModal(false)}>Batal</Button><Button variant="danger" onClick={handleResign}>Proses Pengunduran Diri</Button></div>}>
                <div className="space-y-4">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex gap-3">
                        <AlertTriangle className="text-red-600 shrink-0" />
                        <div>
                            <h4 className="font-bold text-red-800">Anda akan memproses pengunduran diri siswa:</h4>
                            <div className="text-lg font-bold text-slate-800 mt-1">{selectedStudent?.student_name}</div>
                            <div className="text-sm text-slate-600">{selectedStudent?.unit_name} • {selectedStudent?.status}</div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Alasan Pengunduran Diri <span className="text-red-500">*</span></label>
                        <select className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none bg-white" value={reason} onChange={e => setReason(e.target.value)}>
                            <option value="">-- Pilih Alasan --</option>
                            <option value="Pindah Sekolah">Pindah Sekolah / Domisili</option>
                            <option value="Biaya">Kendala Biaya</option>
                            <option value="Diterima Sekolah Lain">Diterima di Sekolah Lain</option>
                            <option value="Kesehatan">Masalah Kesehatan</option>
                            <option value="Lainnya">Lainnya</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                        <textarea
                            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none"
                            rows={3}
                            placeholder="Detail lebih lanjut..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>
                </div>
            </Modal>

            {/* RESTORE MODAL */}
            <Modal isOpen={restoreModal} onClose={() => setRestoreModal(false)} title="Batalkan Pengunduran Diri" footer={<div className="flex justify-end gap-2 w-full"><Button variant="secondary" onClick={() => setRestoreModal(false)}>Batal</Button><Button onClick={handleRestore} className="bg-emerald-600 hover:bg-emerald-700">Pulihkan Status Siswa</Button></div>}>
                <div className="space-y-4">
                    <p className="text-slate-600">Apakah Anda yakin ingin membatalkan pengunduran diri siswa ini?</p>
                    <div className="bg-slate-100 p-3 rounded-lg">
                        <div className="font-bold text-slate-800">{selectedStudent?.student_name}</div>
                        <div className="text-sm text-slate-500">Akan dikembalikan ke status: <strong className="text-emerald-600 uppercase">{selectedStudent?.previous_status || 'Submitted'}</strong></div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
