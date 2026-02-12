import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { Card, Button } from '../ui/Elements';
import { FileText, CheckCircle, XCircle, User, Calendar, School, MapPin, Image, Download, ExternalLink, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Overlays';

// Component to display documents from Supabase Storage or base64
function DocumentViewer({ filePath }) {
    const [url, setUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadDocument = async () => {
            if (!filePath) {
                setLoading(false);
                return;
            }

            // If it's already a base64 data URL, use directly
            if (filePath.startsWith('data:')) {
                setUrl(filePath);
                setLoading(false);
                return;
            }

            // If it's a full http URL, use directly
            if (filePath.startsWith('http')) {
                setUrl(filePath);
                setLoading(false);
                return;
            }

            // Otherwise, it's a storage path - get signed URL
            try {
                const { data, error: signError } = await supabase.storage
                    .from('documents')
                    .createSignedUrl(filePath, 3600); // 1 hour expiry

                if (signError) throw signError;
                setUrl(data.signedUrl);
            } catch (e) {
                console.error('Error getting signed URL:', e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        loadDocument();
    }, [filePath]);

    if (loading) {
        return (
            <div className="bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 min-h-[300px] flex items-center justify-center">
                <div className="text-slate-400 text-center">
                    <Loader2 size={32} className="mx-auto mb-2 animate-spin" />
                    <p>Memuat dokumen...</p>
                </div>
            </div>
        );
    }

    if (error || !url) {
        return (
            <div className="bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 min-h-[300px] flex items-center justify-center">
                <div className="text-slate-400 text-center">
                    <FileText size={48} className="mx-auto mb-2 opacity-50" />
                    <p>{error || 'Dokumen tidak tersedia'}</p>
                </div>
            </div>
        );
    }

    const isImage = url.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(filePath || '');
    const isPdf = url.includes('pdf') || /\.pdf$/i.test(filePath || '');

    return (
        <div className="bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 min-h-[300px] relative">
            {isImage ? (
                <img src={url} alt="Dokumen" className="max-w-full max-h-[500px] object-contain mx-auto" />
            ) : isPdf ? (
                <iframe src={url} className="w-full h-[500px]" title="PDF Viewer"></iframe>
            ) : (
                <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
                    <FileText size={48} className="text-slate-400" />
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <ExternalLink size={18} /> Buka Dokumen
                    </a>
                </div>
            )}
        </div>
    );
}


export default function AdminIndentVerification({ showToast }) {
    const [submissions, setSubmissions] = useState([]);
    const [selected, setSelected] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [activeTab, setActiveTab] = useState('pending');

    const fetchSubmissions = async () => {
        // Fetch from indent_submissions table
        let q = supabase.from('indent_submissions').select('*');

        if (activeTab === 'pending') {
            q = q.eq('status', 'pending');
        } else {
            q = q.in('status', ['approved', 'rejected']);
        }

        const { data, error } = await q.order('created_at', { ascending: false });
        if (data) {
            setSubmissions(data);
        } else if (error) {
            console.error('Fetch error:', error);
        }
    };

    useEffect(() => {
        fetchSubmissions();

        const channel = supabase.channel('admin_indent_verification')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'indent_submissions' }, fetchSubmissions)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeTab]);

    const handleApprove = async () => {
        if (!selected) return;
        try {
            const { error } = await supabase.from('indent_submissions').update({
                status: 'approved',
                admin_verified_at: new Date().toISOString()
            }).eq('id', selected.id);

            if (error) throw error;

            showToast('Pengajuan disetujui.');
            setSelected(null);
            fetchSubmissions();
        } catch (e) {
            console.error(e);
            showToast('Gagal menyetujui.', 'error');
        }
    };

    const handleReject = async () => {
        if (!selected || !rejectReason.trim()) return showToast('Alasan penolakan wajib diisi.', 'error');
        try {
            const { error } = await supabase.from('indent_submissions').update({
                status: 'rejected',
                rejection_reason: rejectReason,
                admin_verified_at: new Date().toISOString()
            }).eq('id', selected.id);

            if (error) throw error;

            showToast('Pengajuan ditolak.');
            setSelected(null);
            setRejectReason('');
            fetchSubmissions();
        } catch (e) {
            console.error(e);
            showToast('Gagal menolak.', 'error');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="text-emerald-600" /> Verifikasi Inden Internal
            </h2>

            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-1">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all rounded-t-lg ${activeTab === 'pending' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Perlu Verifikasi
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all rounded-t-lg ${activeTab === 'history' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Riwayat
                </button>
            </div>

            <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm bg-white dark:bg-slate-800">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="py-4 pl-6 pr-4 w-[30%] text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Calon Siswa</th>
                                <th className="px-4 py-4 w-[25%] text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Tujuan Cabang</th>
                                <th className="px-4 py-4 w-[20%] text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Waktu Upload</th>
                                <th className="px-4 py-4 w-[15%] text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider text-center">Status</th>
                                <th className="px-4 py-4 w-[10%] text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                            {submissions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-16 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4 text-slate-400">
                                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center border border-slate-100 dark:border-slate-600">
                                                <FileText size={32} className="text-slate-300 dark:text-slate-500" />
                                            </div>
                                            <span className="font-medium">{activeTab === 'pending' ? 'Tidak ada pengajuan yang perlu diverifikasi.' : 'Belum ada riwayat verifikasi.'}</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {submissions.map(sub => (
                                <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group">
                                    <td className="py-4 pl-6 pr-4 align-middle">
                                        <div>
                                            <div className="font-bold text-slate-800 dark:text-white text-[15px]">{sub.student_name_candidate || '-'}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                                                <User size={12} className="text-slate-400" /> {sub.parent_name}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 align-middle">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100/60 dark:border-emerald-800">
                                            <School size={14} strokeWidth={2.5} className="opacity-70" />
                                            <span className="font-bold text-xs">{sub.target_unit_name || 'Unit Unknown'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 align-middle">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-0.5">
                                                <Calendar size={12} className="text-slate-400" />
                                                {sub.created_at ? new Date(sub.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium pl-4.5 ml-0.5">
                                                {sub.created_at ? new Date(sub.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''} WIB
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 align-middle text-center">
                                        {sub.status === 'pending' ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800 font-bold text-[10px] uppercase tracking-wider shadow-sm shadow-amber-100">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                                                Pending
                                            </span>
                                        ) : sub.status === 'approved' ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 font-bold text-[10px] uppercase tracking-wider">
                                                <CheckCircle size={12} /> Disetujui
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800 font-bold text-[10px] uppercase tracking-wider">
                                                <XCircle size={12} /> Ditolak
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 align-middle text-center">
                                        <Button
                                            onClick={() => setSelected(sub)}
                                            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md shadow-slate-200 dark:shadow-none transition-all hover:-translate-y-0.5"
                                        >
                                            {activeTab === 'pending' ? 'Tinjau' : 'Lihat'}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Verifikasi Surat Rekomendasi" size="lg">
                <div className="p-6 space-y-6">
                    {selected && (
                        <>
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Nama Calon Siswa</div>
                                    <div className="font-bold text-slate-800 dark:text-white">{selected.student_name_candidate || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Tujuan Unit</div>
                                    <div className="font-bold text-emerald-600 flex items-center gap-1"><School size={14} /> {selected.target_unit_name || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Orang Tua / Wali</div>
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{selected.parent_name}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Email Akun</div>
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{selected.user_email}</div>
                                </div>
                            </div>

                            {/* Recommendation Document */}
                            <DocumentViewer filePath={selected.recommendation_doc} />

                            <div className="pt-6 border-t border-slate-100 dark:border-slate-700 space-y-4">
                                {activeTab === 'history' ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className={`p-4 rounded-xl border ${selected.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-400'}`}>
                                            <div className="flex items-center gap-2 font-bold mb-1">
                                                {selected.status === 'approved' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                                Status: {selected.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                                            </div>
                                            <div className="text-sm opacity-80 mb-2">
                                                Diverifikasi pada: {selected.admin_verified_at ? new Date(selected.admin_verified_at).toLocaleString('id-ID') : '-'}
                                            </div>
                                            {selected.rejection_reason && (
                                                <div className="mt-2 text-sm bg-white/50 dark:bg-slate-900/50 p-2 rounded border border-rose-100 dark:border-rose-800">
                                                    <strong>Alasan Penolakan:</strong>
                                                    <p className="mt-1 italic">"{selected.rejection_reason}"</p>
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold rounded-xl"
                                            onClick={() => setSelected(null)}
                                        >
                                            Tutup
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-400 tracking-widest mb-2 block">Catatan Verifikasi / Alasan Penolakan</label>
                                            <textarea
                                                className="w-full border-2 border-slate-200 dark:border-slate-600 rounded-xl p-3 text-sm focus:ring-2 focus:ring-slate-400 outline-none transition-all bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                                                placeholder="Tulis catatan atau alasan penolakan di sini..."
                                                rows={3}
                                                value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)}
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1 italic">* Wajib diisi jika menolak dokumen.</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Button
                                                className="w-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:text-rose-700 py-3.5 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                onClick={handleReject}
                                                disabled={!rejectReason.trim()}
                                            >
                                                <XCircle size={18} /> Tolak Dokumen
                                            </Button>
                                            <Button
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 py-3.5 rounded-xl shadow-lg shadow-emerald-600/20 font-bold text-white transition-all hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2"
                                                onClick={handleApprove}
                                            >
                                                <CheckCircle size={18} /> Setujui Dokumen
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
}
