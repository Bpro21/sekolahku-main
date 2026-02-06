import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    CalendarClock, Search, CheckCircle, XCircle, Trash2, Eye, ExternalLink, Filter
} from 'lucide-react';
import { Card, Button, Input, Select, Badge } from '../ui/Elements';
import { Modal } from '../ui/Overlays';

export default function AdminIndentManager({ showToast }) {
    const [indents, setIndents] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterYear, setFilterYear] = useState('all');
    const [viewIndent, setViewIndent] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchAllData = async () => {
        const { data: years } = await supabase.from('academic_years').select('*');
        if (years) {
            setAcademicYears(years);
            // Set default filter to the default academic year
            setFilterYear(prev => {
                if (prev !== 'all') return prev;
                const defaultYear = years.find(y => y.is_default);
                return defaultYear ? defaultYear.year : 'all';
            });
        }

        const { data: indentsData } = await supabase.from('indents').select('*').order('created_at', { ascending: false });
        if (indentsData) {
            setIndents(indentsData);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();

        const channel = supabase.channel('admin_indent_manager')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_years' }, fetchAllData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'indents' }, fetchAllData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const filteredIndents = indents.filter(item => {
        const matchSearch = item.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.parent_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = filterStatus === 'all' || item.status === filterStatus;
        const matchYear = filterYear === 'all' || item.target_year === filterYear;
        return matchSearch && matchStatus && matchYear;
    });

    const handleVerify = async (indent, isValid) => {
        setIsProcessing(true);
        try {
            const updates = { status: isValid ? 'paid' : 'rejected' };

            // Update indent record
            const { error } = await supabase.from('indents').update(updates).eq('id', indent.id);
            if (error) throw error;

            // Create Notification
            const title = isValid ? 'Indent Berhasil Diverifikasi' : 'Indent Ditolak';
            const message = isValid
                ? `Selamat! Pendaftaran indent untuk ${indent.student_name} telah dikonfirmasi. Terima kasih.`
                : `Mohon maaf, bukti pembayaran indent untuk ${indent.student_name} tidak valid.`;

            await supabase.from('notifications').insert({
                user_id: indent.user_id,
                title,
                message,
                type: isValid ? 'success' : 'error',
                created_at: new Date().toISOString(),
                is_read: false
            });

            showToast(isValid ? "Indent berhasil diverifikasi (Paid)." : "Indent ditolak.");
            setViewIndent(null);
        } catch (error) {
            console.error(error);
            showToast("Gagal memproses data.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async (indent) => {
        if (!window.confirm("Yakin ingin menghapus data indent ini permanen?")) return;
        try {
            const { error } = await supabase.from('indents').delete().eq('id', indent.id);
            if (error) throw error;
            showToast("Data indent dihapus.");
        } catch (error) {
            showToast("Gagal menghapus data.", 'error');
        }
    }

    const IndentStatusBadge = ({ status }) => {
        const badges = {
            paid: <span className="px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide bg-emerald-100 text-emerald-700">Terverifikasi</span>,
            pending: <span className="px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide bg-amber-100 text-amber-700">Menunggu Verifikasi</span>,
            rejected: <span className="px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide bg-red-100 text-red-700">Ditolak</span>,
            used: <span className="px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide bg-slate-100 text-slate-500">Sudah Terpakai</span>
        };
        return badges[status] || <span className="px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide bg-slate-100 text-slate-500">{status}</span>;
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <CalendarClock className="text-purple-600" /> Data Pendaftaran Indent
            </h2>

            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Cari nama siswa atau orang tua..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                    {/* Year Filter */}
                    <div className="flex items-center gap-2">
                        <CalendarClock size={18} className="text-purple-500" />
                        <select
                            className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none font-medium text-purple-700"
                            value={filterYear}
                            onChange={e => setFilterYear(e.target.value)}
                        >
                            <option value="all">Semua Tahun</option>
                            {academicYears.map(ay => (
                                <option key={ay.id} value={ay.year}>
                                    {ay.year} {ay.is_default ? '(Default)' : ''} {ay.indent_enabled ? '📌' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                        <Filter size={18} className="text-slate-400" />
                        <select
                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="all">Semua Status</option>
                            <option value="pending">Menunggu Verifikasi</option>
                            <option value="paid">Terverifikasi</option>
                            <option value="rejected">Ditolak</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-xs">
                        <tr>
                            <th className="p-4">Siswa</th>
                            <th className="p-4">Tahun & Unit</th>
                            <th className="p-4">Orang Tua</th>
                            <th className="p-4">Tanggal</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredIndents.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-slate-400 italic">Tidak ada data ditemukan.</td>
                            </tr>
                        ) : filteredIndents.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-bold text-slate-800">{item.student_name}</td>
                                <td className="p-4">
                                    <div className="font-semibold text-purple-600">{item.target_year}</div>
                                    <div className="text-xs text-slate-500">{item.target_unit}</div>
                                    {item.target_major && <div className="text-xs text-slate-400 font-medium">{item.target_major}</div>}
                                    <div className="mt-1">
                                        {item.indent_type === 'internal' ? (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Jalur Internal</span>
                                        ) : (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Jalur Eksternal</span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="text-slate-700">{item.parent_name}</div>
                                    <div className="text-xs text-slate-400">{item.parent_phone}</div>
                                </td>
                                <td className="p-4 text-slate-500">
                                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
                                </td>
                                <td className="p-4">
                                    <IndentStatusBadge status={item.status} />
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => setViewIndent(item)}>
                                            <Eye size={16} /> Detail
                                        </Button>
                                        <Button size="sm" className="bg-red-50 text-red-600 hover:bg-red-100 border-none shadow-none" onClick={() => handleDelete(item)}>
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* DETAILS MODAL */}
            <Modal
                isOpen={!!viewIndent}
                onClose={() => setViewIndent(null)}
                title="Detail Pendaftaran Indent"
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <Button variant="secondary" onClick={() => setViewIndent(null)}>Tutup</Button>
                        {viewIndent?.status === 'pending' && (
                            <>
                                <Button variant="danger" disabled={isProcessing} onClick={() => handleVerify(viewIndent, false)}>Tolak</Button>
                                <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={isProcessing} onClick={() => handleVerify(viewIndent, true)}>Verifikasi (Lunas)</Button>
                            </>
                        )}
                    </div>
                }
            >
                {viewIndent && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
                            <div className="w-12 h-12 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center font-bold text-lg">
                                {viewIndent.student_name[0]}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">{viewIndent.student_name}</h3>
                                <p className="text-sm text-slate-600">
                                    Calon Siswa {viewIndent.target_unit}
                                    {viewIndent.target_major && <span> ({viewIndent.target_major})</span>}
                                    • {viewIndent.target_year}
                                </p>
                                <div className="mt-1">
                                    {viewIndent.indent_type === 'internal' ? (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                                            <CheckCircle size={12} />
                                            Jalur Internal (Rekomendasi)
                                        </div>
                                    ) : (
                                        <div className="inline-flex px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                                            Jalur Eksternal
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase">Nama Orang Tua</label>
                                <p className="font-semibold text-slate-700">{viewIndent.parent_name}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase">No. WhatsApp</label>
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold text-slate-700">{viewIndent.parent_phone}</p>
                                    <a href={`https://wa.me/${viewIndent.parent_phone}`} target="_blank" rel="noreferrer" className="text-emerald-500 hover:text-emerald-700"><ExternalLink size={14} /></a>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase">Email User</label>
                                <p className="font-semibold text-slate-700">{viewIndent.user_email}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase">Biaya Booking</label>
                                <p className="font-bold text-purple-600">Rp {(viewIndent.booking_fee || 0).toLocaleString()}</p>
                            </div>
                        </div>

                        {viewIndent.indent_type === 'internal' && viewIndent.recommendation_letter && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Surat Rekomendasi Kepala Sekolah</label>
                                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-200 p-2 rounded-lg text-emerald-700">
                                            <ExternalLink size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-emerald-900">Dokumen Rekomendasi</div>
                                            <div className="text-xs text-emerald-700">Wajib untuk Jalur Internal</div>
                                        </div>
                                    </div>
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => {
                                        const win = window.open();
                                        win.document.write('<iframe src="' + viewIndent.recommendation_letter + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
                                    }}>
                                        Lihat Dokumen
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Bukti Transfer</label>
                            <div className="bg-slate-100 rounded-xl p-2 border border-slate-200">
                                {viewIndent.proof_of_transfer ? (
                                    <img
                                        src={viewIndent.proof_of_transfer}
                                        alt="Bukti Transfer"
                                        className="max-h-96 mx-auto rounded-lg object-contain cursor-pointer hover:opacity-95 transition"
                                        onClick={() => window.open(viewIndent.proof_of_transfer, '_blank')}
                                    />
                                ) : (
                                    <div className="text-center py-10 text-slate-400">Tidak ada bukti transfer</div>
                                )}
                            </div>
                            <p className="text-xs text-center text-slate-400 mt-2">Klik gambar untuk memperbesar</p>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
