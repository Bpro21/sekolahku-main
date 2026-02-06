import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    FileText, CheckCircle, XCircle, Search, Filter, Stethoscope, AlertTriangle, Eye
} from 'lucide-react';
import { Card, Button, Input, Select, Badge } from '../ui/Elements';
import { Modal } from '../ui/Overlays';

export default function AdminAgreements({ showToast }) {
    const [registrations, setRegistrations] = useState([]);
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, verified, pending
    const [selectedReg, setSelectedReg] = useState(null);
    const [verifyModal, setVerifyModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const fetchRegistrations = async () => {
        const { data, error } = await supabase.from('registrations')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) {
            const relevant = data.filter(r =>
                ['lulus', 'accepted', 'verified_re_reg'].includes(r.status) ||
                (r.uploaded_docs && (r.uploaded_docs.agreement_rokok || r.uploaded_docs.mcu_letter))
            );
            setRegistrations(relevant);
        }
    };

    useEffect(() => {
        fetchRegistrations();

        const channel = supabase.channel('admin_agreements')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, fetchRegistrations)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const filteredRegs = registrations.filter(r => {
        const matchesSearch = r.student_name.toLowerCase().includes(filter.toLowerCase()) || r.id.toLowerCase().includes(filter.toLowerCase());
        const d = r.uploaded_docs || {};
        const hasDocs = d.agreement_rokok && d.agreement_lgbt && d.agreement_kriminal && d.mcu_letter;

        let matchesStatus = true;
        if (statusFilter === 'pending') matchesStatus = hasDocs && !r.agreements_verified; // Has docs but not verified
        if (statusFilter === 'verified') matchesStatus = r.agreements_verified === true;
        if (statusFilter === 'missing') matchesStatus = !hasDocs;

        return matchesSearch && matchesStatus;
    });

    const handleVerify = async (isValid) => {
        if (!selectedReg) return;
        try {
            // Robust check for Scholarship / Prestasi / Yatim / Internal Indent logic
            const pName = (selectedReg.path_name || '').toLowerCase();
            const isScholarship = !!(
                selectedReg.is_scholarship ||
                pName.includes('prestasi') ||
                pName.includes('yatim') ||
                pName.includes('beasiswa') ||
                pName.includes('tahfidz') // Common variations
            );

            const updateData = {
                agreements_verified: isValid,
                agreements_notes: isValid ? 'Dokumen Valid' : rejectReason,
                agreements_checked_at: new Date().toISOString()
            };

            // If verified and is scholarship, directly set status to 'lulus' (RESMI LULUS/TERDAFTAR)
            // This applies to Internal Indent Prestasi/Yatim as well
            if (isValid && isScholarship) {
                updateData.status = 'lulus';
                updateData.enrolled_at = new Date().toISOString();
            }

            // Update user's specific registration doc
            const { error } = await supabase.from('registrations').update(updateData).eq('id', selectedReg.id);
            if (error) throw error;

            if (isValid && isScholarship) {
                showToast('Verifikasi Berhasil! Status siswa kini resmi menjadi LULUS (Accepted Student).');
            } else {
                showToast(isValid ? 'Dokumen Surat Perjanjian berhasil diverifikasi.' : 'Dokumen ditolak.');
            }

            setVerifyModal(false);
            setRejectReason('');
            setSelectedReg(null);
            fetchRegistrations();
        } catch (e) {
            console.error("Verification Error:", e);
            showToast(e.message, 'error');
        }
    };

    const DocStatus = ({ exists, label }) => (
        <span className={`text-[10px] px-2 py-0.5 rounded border ${exists ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            {label}
        </span>
    );

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                <FileText className="text-emerald-600" /> Surat Perjanjian & MCU
            </h2>

            <Card className="p-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <Input placeholder="Cari Nama / ID..." className="pl-10" value={filter} onChange={e => setFilter(e.target.value)} />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            options={[
                                { value: 'all', label: 'Semua Data' },
                                { value: 'pending', label: 'Menunggu Verifikasi' }, // Has docs not verified
                                { value: 'verified', label: 'Sudah Diverifikasi' },
                                { value: 'missing', label: 'Belum Upload' }
                            ]}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b">
                            <tr>
                                <th className="px-4 py-3">Nama Siswa</th>
                                <th className="px-4 py-3">Cabang / Gelombang</th>
                                <th className="px-4 py-3">Kelengkapan Dokumen</th>
                                <th className="px-4 py-3">Status Verifikasi</th>
                                <th className="px-4 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredRegs.map(r => (
                                <tr key={r.id} className="hover:bg-slate-50 text-slate-700">
                                    <td className="px-4 py-3">
                                        <div className="font-bold">{r.student_name}</div>
                                        <div className="text-xs text-slate-400">ID: {r.id.slice(0, 8)}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div>{r.unit_name}</div>
                                        <div className="text-xs text-emerald-600">{r.wave_name}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1 flex-wrap max-w-[250px]">
                                            <DocStatus exists={r.uploaded_docs?.agreement_rokok} label="Rokok" />
                                            <DocStatus exists={r.uploaded_docs?.agreement_lgbt} label="LGBT" />
                                            <DocStatus exists={r.uploaded_docs?.agreement_kriminal} label="Kriminal" />
                                            <DocStatus exists={r.uploaded_docs?.mcu_letter} label="MCU" />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {r.agreements_verified === true ? (
                                            <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-xs font-bold border border-emerald-100"><CheckCircle size={14} /> Valid</span>
                                        ) : r.agreements_verified === false ? (
                                            <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs font-bold border border-red-100"><XCircle size={14} /> Ditolak</span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-full text-xs font-bold border border-amber-100"><AlertTriangle size={14} /> Menunggu</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Button variant="secondary" className="scale-90" onClick={() => { setSelectedReg(r); setVerifyModal(true); }}>
                                            Verify
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {filteredRegs.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="text-center py-10 text-slate-400 italic">Tidak ada data ditemukan.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* VERIFY MODAL */}
            <Modal isOpen={verifyModal} onClose={() => setVerifyModal(false)} title="Verifikasi Surat Perjanjian" footer={null}>
                {selectedReg && (
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h4 className="font-bold text-slate-800 mb-2">{selectedReg.student_name}</h4>
                            <p className="text-sm text-slate-600 mb-4">Mohon verifikasi 4 dokumen wajib ini.</p>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                {['agreement_rokok', 'agreement_lgbt', 'agreement_kriminal', 'mcu_letter'].map(key => (
                                    <div key={key} className="border p-3 rounded bg-white text-center">
                                        <div className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">{key.replace('agreement_', '').replace('_letter', '')}</div>
                                        {selectedReg.uploaded_docs?.[key] ? (
                                            <button
                                                onClick={() => {
                                                    const win = window.open();
                                                    win.document.write('<iframe src="' + selectedReg.uploaded_docs[key] + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
                                                }}
                                                className="text-emerald-600 font-bold text-sm hover:underline block truncate mx-auto"
                                            >
                                                Buka File
                                            </button>
                                        ) : <span className="text-red-500 font-bold text-xs">Tidak Ada</span>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Catatan (Jika Ditolak)</label>
                            <textarea
                                className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                placeholder="Alasan penolakan..."
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                            ></textarea>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="danger" className="w-full" onClick={() => handleVerify(false)} disabled={!rejectReason}>Tolak</Button>
                            <Button className="w-full" onClick={() => handleVerify(true)}>Verifikasi Valid</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
