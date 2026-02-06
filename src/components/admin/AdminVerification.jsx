import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    FileCheck, CheckCircle, XCircle, FileText, User, AlertTriangle, Check
} from 'lucide-react';
import { Card, Button } from '../ui/Elements';

import { Modal } from '../ui/Overlays';
import { createNotification } from '../../utils/helpers';

export default function AdminVerification({ showToast }) {
    const [list, setList] = useState([]);
    const [selected, setSelected] = useState(null);

    // Document Verification State
    const [docValidation, setDocValidation] = useState({});
    const [globalNote, setGlobalNote] = useState('');

    const [filterBeasiswa, setFilterBeasiswa] = useState(false);

    useEffect(() => {
        // Fetch submitted, verifying_payment, AND document_revision (so admin can re-verify)
        const fetchData = async () => {
            const { data, error } = await supabase
                .from('registrations')
                .select('*')
                .in('status', ['submitted', 'verifying_payment', 'document_revision']);
            if (data) setList(data);
        };
        fetchData();

        const channel = supabase.channel('admin_verification_list')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: "status=in.('submitted','verifying_payment','document_revision')" }, fetchData)
            .subscribe(); // Note: filter string syntax for IN is tricky in realtime, might default to fetch-all if not supported. But simple status update should trigger.

        // Fallback: listen to all registration changes and filter client side if needed, or just refresh
        const broadChannel = supabase.channel('admin_verif_broad')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, async (payload) => {
                if (['submitted', 'verifying_payment', 'document_revision'].includes(payload.new?.status) ||
                    ['submitted', 'verifying_payment', 'document_revision'].includes(payload.old?.status)) {
                    fetchData();
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); supabase.removeChannel(broadChannel); };
    }, []);

    useEffect(() => {
        if (selected?.uploaded_docs) {
            const initial = {};
            // Pre-fill with existing verification if available, else default to 'valid' (optimistic) or 'pending'
            const existing = selected.doc_verification || {};

            Object.keys(selected.uploaded_docs).forEach(k => {
                if (existing[k]) {
                    initial[k] = existing[k];
                } else {
                    initial[k] = { status: 'valid', note: '' }; // Default to valid for easier UX, admin changes to invalid if needed
                }
            });
            setDocValidation(initial);
            setGlobalNote(selected.verification_note || '');
        }
    }, [selected]);

    const updateDocStatus = (key, status) => {
        setDocValidation(prev => ({
            ...prev,
            [key]: { ...prev[key], status }
        }));
    };

    const updateDocNote = (key, note) => {
        setDocValidation(prev => ({
            ...prev,
            [key]: { ...prev[key], note }
        }));
    };


    const handleOpenDocument = async (dataUrl) => {
        if (!dataUrl) return;

        // If simple URL
        if (dataUrl.startsWith('http')) {
            window.open(dataUrl, '_blank');
            return;
        }

        // If Base64
        try {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
        } catch (e) {
            console.error(e);
            showToast('Gagal membuka dokumen ini.', 'error');
        }
    };

    const submitVerification = async () => {
        try {
            // Determine global status
            const docs = Object.values(docValidation);
            const anyInvalid = docs.some(d => d.status === 'invalid');

            // If any document is invalid, status becomes 'document_revision'
            let newStatus = anyInvalid ? 'document_revision' : 'verified';

            // SPECIAL RULE: Internal/Indent INTERNAL skip to 'lulus' and create re-registration invoice
            // Scholarship (Prestasi/Yatim) goes through normal flow (test & interview) but without payment
            const isInternalIndent = selected.is_internal || (selected.path_name && selected.path_name.toLowerCase().includes('internal'));
            const isScholarship = selected.is_scholarship || (selected.path_name && (selected.path_name.toLowerCase().includes('prestasi') || selected.path_name.toLowerCase().includes('yatim')));

            if (newStatus === 'verified' && isInternalIndent && !isScholarship) {
                // INTERNAL INDENT (non-scholarship): Skip to lulus and create re-registration invoice
                newStatus = 'lulus';

                // GENERATE INVOICE for Re-registration (Inden Internal)
                const costRereg = selected.cost_rereg || 0;

                if (costRereg > 0) {
                    const invAmount = costRereg;
                    const invStatus = 'pending';
                    const invDesc = `Biaya Daftar Ulang (Inden Internal) - ${selected.unit_name}`;
                    const deterministicId = `rereg_${selected.id}`;

                    const invData = {
                        id: deterministicId,
                        registration_id: selected.id,
                        amount: invAmount,
                        description: invDesc,
                        status: invStatus,
                        type: 're_registration',
                        created_at: new Date().toISOString(),
                        student_name: selected.student_name,
                        user_id: selected.user_id,
                        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days due
                    };

                    await supabase.from('invoices').upsert(invData);
                }
            }
            // Scholarship: stays at 'verified', proceeds to test & interview, graduation determined later by admin

            const updates = {
                status: newStatus,
                doc_verification: docValidation,
                verification_note: globalNote,
                verified_at: new Date().toISOString(),
                rejection_reason: null
            };

            const { error } = await supabase.from('registrations').update(updates).eq('id', selected.id);
            if (error) throw error;

            // Send Notification
            if (newStatus === 'verified') {
                // For scholarship, add note that they skip payment
                const msg = isScholarship
                    ? `Selamat! Pendaftaran siswa ${selected.student_name} telah diverifikasi. Silakan lanjutkan ke tahap Tes Psikotes.`
                    : `Selamat! Pendaftaran siswa ${selected.student_name} telah diverifikasi. Silakan lanjutkan ke tahap berikutnya.`;
                await createNotification(
                    selected.user_id,
                    'Dokumen Diverifikasi',
                    msg,
                    'success'
                );
            } else if (newStatus === 'lulus') {
                // Only Internal Indent (non-scholarship) comes here
                await createNotification(
                    selected.user_id,
                    'Selamat! Anda Lolos Seleksi',
                    `Selamat! Pendaftaran siswa ${selected.student_name} telah diverifikasi dan dinyatakan LULUS (Jalur Internal). Silakan lanjutkan pembayaran daftar ulang.`,
                    'success'
                );
            } else if (newStatus === 'document_revision') {
                await createNotification(
                    selected.user_id,
                    'Perbaikan Dokumen Diperlukan',
                    `Mohon maaf, ada dokumen pendaftaran ${selected.student_name} yang perlu diperbaiki. Silakan cek dashboard untuk detail alasan penolakan per dokumen.`,
                    'warning'
                );
            }

            showToast(newStatus === 'lulus' ? 'Pendaftar Dinyatakan LULUS' : (newStatus === 'verified' ? 'Berkas Terverifikasi' : 'Berkas Dikembalikan untuk Revisi'));
            setSelected(null);
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleRejectTotal = async () => {
        // This is for total rejection (e.g. quota full, not eligible at all)
        if (!globalNote) return showToast("Alasan tolak harus diisi di Catatan Verifikasi!", 'error');
        try {
            const updates = { status: 'rejected', rejection_reason: globalNote, verified_at: new Date().toISOString() };
            const { error } = await supabase.from('registrations').update(updates).eq('id', selected.id);
            if (error) throw error;

            await createNotification(
                selected.user_id,
                'Pendaftaran Ditolak',
                `Mohon maaf, pendaftaran siswa ${selected.student_name} tidak dapat dilanjutkan. Alasan: ${globalNote}`,
                'error'
            );

            showToast('Pendaftaran Ditolak Permanen');
            setSelected(null);
        } catch (e) { showToast(e.message, 'error'); }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><FileCheck className="text-emerald-600" /> Verifikasi Berkas</h2>

            {/* Filter Tabs */}
            <div className="flex gap-2">
                <button onClick={() => setFilterBeasiswa(false)} className={`px-4 py-2 text-sm font-bold rounded-full transition-all ${!filterBeasiswa ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border'}`}>
                    Semua Pendaftar
                </button>
                <button onClick={() => setFilterBeasiswa(true)} className={`px-4 py-2 text-sm font-bold rounded-full transition-all ${filterBeasiswa ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border'}`}>
                    Khusus Beasiswa / Non-Reguler
                </button>
            </div>

            <div className="grid gap-4">
                {list.length === 0 ? <div className="text-center p-10 text-slate-400 border border-dashed rounded-xl">Tidak ada pendaftaran pending.</div> : (
                    list.filter(item => !filterBeasiswa || (item.path_name && !item.path_name.toLowerCase().includes('reguler'))).map(item => (
                        <Card key={item.id} className={`p-4 flex flex-col md:flex-row justify-between items-center gap-4 border-l-4 ${item.path_name && !item.path_name.toLowerCase().includes('reguler') ? 'border-l-amber-400' : 'border-l-emerald-400'}`}>
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className={`p-3 rounded-full ${item.status === 'document_revision' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}><User size={24} /></div>
                                <div>
                                    <h4 className="font-bold text-lg flex items-center gap-2">
                                        {item.student_name}
                                        {item.path_name && !item.path_name.toLowerCase().includes('reguler') && (
                                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 uppercase font-bold tracking-wide">
                                                {item.path_name}
                                            </span>
                                        )}
                                        {(item.is_internal || (item.path_name && item.path_name.toLowerCase().includes('internal'))) && (
                                            <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200 uppercase font-bold tracking-wide">
                                                Internal
                                            </span>
                                        )}
                                    </h4>
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <span>{item.unit_name}</span>
                                        {item.status === 'document_revision' && <span className="text-red-500 font-bold bg-red-50 px-2 rounded text-xs flex items-center gap-1"><AlertTriangle size={10} /> Revisi</span>}
                                    </div>
                                    <span className="text-xs font-bold text-slate-400">{item.id.slice(0, 8).toUpperCase()}</span>
                                </div>
                            </div>
                            <Button onClick={() => setSelected(item)}>Periksa & Validasi</Button>
                        </Card>
                    ))
                )}
            </div>

            <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Verifikasi Pendaftaran" footer={(
                <div className="flex justify-between w-full pt-4 border-t dark:border-slate-700">
                    <Button variant="danger" onClick={handleRejectTotal}>Tolak Permanen</Button>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setSelected(null)}>Batal</Button>
                        <Button onClick={submitVerification} className="bg-emerald-600 hover:bg-emerald-700">Simpan Hasil Verifikasi</Button>
                    </div>
                </div>
            )}>
                {selected && (
                    <div className="space-y-6 h-[70vh] overflow-y-auto pr-2">
                        {/* Header Info */}
                        <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg border dark:border-slate-600">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><span className="text-slate-500 dark:text-slate-300 block">Nama Siswa</span><strong className="text-lg text-slate-800 dark:text-white">{selected.student_name}</strong></div>
                                <div><span className="text-slate-500 dark:text-slate-300 block">Jalur</span><strong className="text-slate-800 dark:text-white">{selected.path_name}</strong></div>
                                <div><span className="text-slate-500 dark:text-slate-300 block">Cabang Sekolah</span><strong className="text-slate-800 dark:text-white">{selected.unit_name}</strong></div>
                                <div><span className="text-slate-500 dark:text-slate-300 block">Gelombang</span><strong className="text-slate-800 dark:text-white">{selected.wave_name}</strong></div>
                            </div>
                        </div>

                        {/* Document Validation Section */}
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><FileCheck size={20} /> Validasi Dokumen</h4>
                            <div className="space-y-3">
                                {selected.uploaded_docs && Object.keys(selected.uploaded_docs)
                                    .filter(k => {
                                        // 1. HARD EXCLUDES (Must be first)

                                        // Only show SKTM for Yatim/Duafa paths
                                        if (k === 'sktm') {
                                            const path = (selected.path_name || '').toLowerCase();
                                            if (!path.includes('yatim') && !path.includes('duafa')) return false;
                                        }

                                        // Exclude agreements and MCU (handled elsewhere)
                                        if (['agreement_rokok', 'agreement_lgbt', 'agreement_kriminal', 'mcu', 'surat_sehat', 'mcu_letter'].includes(k)) return false;

                                        // 2. Permission based inclusions
                                        // SHOW ALL for Internal/Indent (iff not excluded above)
                                        if (selected.is_indent || selected.is_internal || (selected.path_name || '').toLowerCase().includes('internal')) return true;

                                        return true;
                                    })
                                    .map(k => (
                                        <div key={k} className={`border rounded-xl p-4 transition-all ${docValidation[k]?.status === 'invalid'
                                            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
                                            : (docValidation[k]?.status === 'valid'
                                                ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30'
                                                : 'bg-white dark:bg-slate-800 dark:border-slate-700')
                                            }`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    {k === 'photo_student' ? (
                                                        <div className="relative group">
                                                            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-600 shadow-sm">
                                                                <img src={selected.uploaded_docs[k]} alt="Siswa" className="w-full h-full object-cover" />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-white dark:bg-slate-700 p-2 rounded-full border dark:border-slate-600 shadow-sm">
                                                            <FileText size={18} className="text-slate-500 dark:text-slate-400" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="uppercase font-bold text-sm text-slate-700 dark:text-slate-200 block">{k.replace('_', ' ')}</span>
                                                        {k === 'photo_student' && <span className="text-[10px] text-slate-400 dark:text-slate-500">Cek Background & Pakaian</span>}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleOpenDocument(selected.uploaded_docs[k])}
                                                    className="text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full"
                                                >
                                                    Lihat File
                                                </button>
                                            </div>



                                            {/* Status Toggle */}
                                            <div className="flex gap-2 mb-2">
                                                <button
                                                    onClick={() => updateDocStatus(k, 'valid')}
                                                    className={`flex-1 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 transition-all ${docValidation[k]?.status === 'valid' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                                                >
                                                    <Check size={14} /> Valid
                                                </button>
                                                <button
                                                    onClick={() => updateDocStatus(k, 'invalid')}
                                                    className={`flex-1 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 transition-all ${docValidation[k]?.status === 'invalid' ? 'bg-red-500 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                                                >
                                                    <XCircle size={14} /> Tidak Valid
                                                </button>
                                            </div>

                                            {/* Invalid Note */}
                                            {docValidation[k]?.status === 'invalid' && (
                                                <div className="animate-fade-in mt-2">
                                                    <label className="text-[10px] uppercase font-bold text-red-700 dark:text-red-400 mb-1 block">Alasan Penolakan:</label>
                                                    <input
                                                        type="text"
                                                        className="w-full text-sm border border-red-300 dark:border-red-800 rounded p-2 focus:ring-1 focus:ring-red-500 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                                        placeholder={`Mengapa dokumen ${k} tidak valid?`}
                                                        value={docValidation[k]?.note || ''}
                                                        onChange={(e) => updateDocNote(k, e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Global Notes */}
                        <div>
                            <label className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-2 block">Catatan Tambahan Verifikator (Opsional)</label>
                            <textarea
                                className="w-full border dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                rows={3}
                                placeholder="Catatan umum untuk pendaftar ini..."
                                value={globalNote}
                                onChange={e => setGlobalNote(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
