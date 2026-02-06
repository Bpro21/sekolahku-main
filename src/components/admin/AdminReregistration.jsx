import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    Users, Search, Filter, Calendar, Eye, MessageCircle,
    ArrowLeft, Save, CheckCircle, XCircle, FileText, Upload,
    ChevronDown, ChevronUp, AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Card, Button, Input, Badge } from '../ui/Elements';
import { sendWhatsappMessage } from '../../utils/helpers';

export default function AdminReregistration({ showToast }) {
    const [view, setView] = useState('list'); // 'list', 'detail'
    const [selectedData, setSelectedData] = useState(null);
    const [listData, setListData] = useState([]);
    const [loading, setLoading] = useState(true);

    // List View State
    const [academicYears, setAcademicYears] = useState([]);
    const [filterYear, setFilterYear] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [settings, setSettings] = useState({});

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [
                { data: ays },
                { data: regs },
                { data: invoices },
                { data: settingsData }
            ] = await Promise.all([
                supabase.from('academic_years').select('*'),
                supabase.from('registrations').select('*').in('status', ['lulus', 'paid', 'accepted', 'verified']),
                supabase.from('invoices').select('*'),
                supabase.from('app_settings').select('*').eq('id', 'main').single()
            ]);

            const listAys = ays || [];
            setAcademicYears(listAys);
            const activeAy = listAys.find(ay => ay.is_active);
            if (activeAy) setFilterYear(activeAy.year);
            if (settingsData) setSettings(settingsData);

            const regList = regs || [];
            const invList = invoices || [];

            // Merge Invoice Info to Regs
            const mergedData = regList.map(r => {
                // Find reregistration invoice
                const inv = invList.find(i => i.registration_id === r.id && (i.description?.toLowerCase().includes('daftar ulang') || i.is_installment));
                return { ...r, invoice: inv };
            });

            // Client-side sort
            mergedData.sort((a, b) => {
                const tA = new Date(a.created_at).getTime();
                const tB = new Date(b.created_at).getTime();
                return tB - tA;
            });
            setListData(mergedData);
        } catch (err) {
            console.error(err);
            showToast("Gagal memuat data daftar ulang", "error");
        } finally {
            setLoading(false);
        }
    };

    // --- LIST VIEW HELPERS ---
    const getTerminBadges = (data) => {
        const inv = data.invoice;
        if (!inv) return <span className="text-slate-400 text-[10px]">-</span>;

        if (inv.is_installment && inv.installment_schedule) {
            // Only convert from string to object if needed (Supabase usually returns JSONB as object automatically)
            const schedule = typeof inv.installment_schedule === 'string' ? JSON.parse(inv.installment_schedule) : inv.installment_schedule;

            return (
                <div className="flex flex-wrap justify-center gap-1">
                    {schedule.map((term, i) => {
                        let color = 'bg-slate-100 text-slate-500'; // Default / Unpaid
                        if (term.status === 'paid') color = 'bg-emerald-100 text-emerald-600';
                        else if (term.status === 'verifying') color = 'bg-amber-100 text-amber-600';
                        else if (term.status === 'unpaid') color = 'bg-rose-100 text-rose-600';

                        return (
                            <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${color}`} title={`Jatuh Tempo: ${term.due_date}`}>
                                T{term.term || i + 1}
                            </span>
                        );
                    })}
                </div>
            );
        }

        // Non-Installment
        if (inv.status === 'paid') return <span className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded text-[10px] font-bold">LUNAS</span>;
        if (inv.status === 'verifying_payment') return <span className="bg-amber-100 text-amber-600 px-2 py-1 rounded text-[10px] font-bold">Verifikasi</span>;

        return <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-bold">Belum Bayar</span>;
    };

    const getDefermentBadge = (data) => {
        const isInstallment = data.invoice?.is_installment;
        return isInstallment
            ? <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded text-[10px] font-bold">YA (Cicilan)</span>
            : <span className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded text-[10px] font-bold">TIDAK</span>;
    };

    const handleSendReminder = async (data, term) => {
        if (!data.user_phone) {
            showToast("Nomor HP siswa tidak tersedia", "error");
            return;
        }

        let message = `Assalamualaikum, Mengingatkan tagihan cicilan Termin ${term.term} sebesar Rp ${parseInt(term.amount).toLocaleString()} jatuh tempo pada ${term.due_date}. Mohon segera melakukan pembayaran. Terima kasih.`;

        // Use Template if available
        const templateKey = `template_installment_t${term.term}`;
        if (settings && settings[templateKey]) {
            message = settings[templateKey]
                .replace(/{name}/g, data.student_name || 'Siswa')
                .replace(/{amount}/g, `Rp ${parseInt(term.amount).toLocaleString()}`)
                .replace(/{date}/g, term.due_date);
        }

        try {
            await sendWhatsappMessage(data.user_phone, message);
            showToast(`Pengingat T${term.term} terkirim ke WhatsApp`, "success");

            // Update reminder logs
            const currentHistory = data.reminder_history || {};
            currentHistory[`term_${term.term}`] = new Date().toISOString();

            const { error } = await supabase.from('registrations').update({
                reminder_history: currentHistory,
                updated_at: new Date().toISOString()
            }).eq('id', data.id);

            if (error) throw error;

            // Updating local state
            setListData(prev => prev.map(item => {
                if (item.id === data.id) {
                    return { ...item, reminder_history: currentHistory };
                }
                return item;
            }));

        } catch (error) {
            console.error(error);
            showToast("Gagal mengirim pesan WhatsApp", "error");
        }
    };

    const getNotifBadge = (data) => {
        const inv = data.invoice;
        if (inv?.is_installment && inv.installment_schedule) {
            const schedule = typeof inv.installment_schedule === 'string' ? JSON.parse(inv.installment_schedule) : inv.installment_schedule;
            const unpaidTerms = schedule.filter(t => t.status === 'unpaid');
            if (unpaidTerms.length === 0) return <span className="text-emerald-500 font-bold text-xs">Aman</span>;

            return (
                <div className="flex flex-wrap justify-center gap-1">
                    {unpaidTerms.map((term, i) => {
                        const isSent = data.reminder_history?.[`term_${term.term}`];
                        return (
                            <button
                                key={i}
                                onClick={() => handleSendReminder(data, term)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all flex items-center gap-1 ${isSent ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-500 hover:text-blue-600'}`}
                                title={`Kirim Pengingat T${term.term}`}
                            >
                                <MessageCircle size={10} className={isSent ? "fill-emerald-600" : ""} /> T{term.term}
                            </button>
                        );
                    })}
                </div>
            );
        }

        // Existing logic for non-installment (Registration Reminder)
        return data?.reminder_history?.rereg
            ? <span className="text-emerald-500 font-bold text-xs">Sudah</span>
            : <span className="text-red-500 font-bold text-xs">Belum</span>;
    };

    // Filter Logic
    const filteredList = listData.filter(d => {
        const matchYear = filterYear ? (d.academic_year === filterYear || d.wave_name?.includes(filterYear)) : true;
        const matchSearch = searchTerm ? d.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) : true;
        return matchYear && matchSearch;
    });

    const paginatedList = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // --- DETAIL VIEW LOGIC ---
    const handleSaveDetail = async (updatedData) => {
        try {
            const updates = {
                reregistration_docs: updatedData.reregistration_docs,
                reregistration_deferment: updatedData.reregistration_deferment,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from('registrations').update(updates).eq('id', selectedData.id);
            if (error) throw error;

            showToast("Perubahan berhasil disimpan", "success");

            // Refresh local data
            setListData(prev => prev.map(item => item.id === selectedData.id ? { ...item, ...updatedData } : item));
            setView('list');
            setSelectedData(null);
        } catch (e) {
            showToast("Gagal menyimpan: " + e.message, "error");
        }
    };

    // Reset page on filter change
    useEffect(() => { setCurrentPage(1); }, [filterYear, searchTerm, itemsPerPage]);

    if (view === 'detail') {
        return <ReregistrationDetail student={selectedData} onBack={() => setView('list')} onSave={handleSaveDetail} />;
    }

    // Pagination Helpers
    const totalPages = Math.ceil(filteredList.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, filteredList.length);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <span className="w-1.5 h-8 bg-emerald-500 rounded-full inline-block"></span>
                        Proses Daftar Ulang
                    </h1>
                    <p className="text-slate-500 font-medium ml-3.5">Monitoring data siswa dan validasi dokumen daftar ulang.</p>
                </div>
            </div>

            {/* Filters Toolbar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-4 z-20">
                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative w-full md:w-72 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Cari Nama Siswa / NISN..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-transparent focus:bg-white border focus:border-emerald-500 rounded-xl focus:ring-4 focus:ring-emerald-500/10 outline-none font-medium text-slate-700 transition-all"
                        />
                    </div>

                    {/* Year Filter */}
                    <div className="relative w-full md:w-auto">
                        <select
                            value={filterYear}
                            onChange={e => setFilterYear(e.target.value)}
                            className="w-full appearance-none pl-4 pr-10 py-2.5 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer transition-all"
                        >
                            <option value="">Semua Tahun Ajaran</option>
                            {academicYears.map(ay => <option key={ay.id} value={ay.year}>{ay.year}</option>)}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* Pagination Control */}
                <div className="flex items-center gap-3 text-sm font-medium text-slate-500 whitespace-nowrap">
                    <span>Tampilkan</span>
                    <select
                        value={itemsPerPage}
                        onChange={e => setItemsPerPage(Number(e.target.value))}
                        className="bg-slate-50 border-none rounded-lg py-1.5 px-3 font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                    </select>
                    <span>entri</span>
                </div>
            </div>

            {/* Main Table Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="p-4 pl-6 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">No</th>
                                <th className="p-4 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">Siswa</th>
                                <th className="p-4 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]">Program Info</th>
                                <th className="p-4 text-center font-bold text-slate-500 uppercase tracking-wider text-[11px]">Termin Pembayaran</th>
                                <th className="p-4 text-center font-bold text-slate-500 uppercase tracking-wider text-[11px]">Penundaan</th>
                                <th className="p-4 text-center font-bold text-slate-500 uppercase tracking-wider text-[11px]">Notif</th>
                                <th className="p-4 pr-6 text-right font-bold text-slate-500 uppercase tracking-wider text-[11px]">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedList.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-4 pl-6 text-slate-400 font-medium">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">{item.student_name}</div>
                                        <div className="text-[10px] font-medium mt-1 flex items-center gap-1">
                                            {item.is_internal ? (
                                                <span className="bg-blue-100 text-blue-600 px-1.5 rounded font-bold">Internal</span>
                                            ) : (
                                                <span className={`px-1.5 rounded font-bold ${item.wave_name?.toLowerCase().includes('inden') ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {item.wave_name?.toLowerCase().includes('inden') ? 'Inden Eksternal' : 'Eksternal'}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-600">
                                        <div className="font-bold text-xs text-slate-700">{item.major || item.unit_name || '-'}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">{item.branch_name || 'IDN Jonggol'}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        {getTerminBadges(item)}
                                    </td>
                                    <td className="p-4 text-center">{getDefermentBadge(item)}</td>
                                    <td className="p-4 text-center">{getNotifBadge(item)}</td>
                                    <td className="p-4 pr-6 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setSelectedData(item); setView('detail'); }}
                                                className="bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 text-slate-600 p-2 rounded-xl shadow-sm transition-all flex items-center gap-2 text-xs font-bold"
                                            >
                                                <Eye size={16} /> Detail
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {paginatedList.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 opacity-50">
                                            <FileText size={48} className="text-slate-300" />
                                            <p className="font-medium text-slate-500">Tidak ada data siswa ditemukan.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Pagination */}
                {filteredList.length > 0 && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-slate-500 font-medium">
                            Menampilkan <span className="font-bold text-slate-800">{startIndex}</span> - <span className="font-bold text-slate-800">{endIndex}</span> dari <span className="font-bold text-slate-800">{filteredList.length}</span> data
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="h-9 w-9 p-0 flex items-center justify-center rounded-lg border-slate-200 hover:border-emerald-500 disabled:opacity-50"
                            >
                                <ChevronLeft size={16} />
                            </Button>

                            <span className="flex items-center justify-center h-9 px-4 font-bold text-xs bg-white border border-slate-200 rounded-lg text-slate-700 min-w-[3rem] shadow-sm">
                                {currentPage} / {totalPages}
                            </span>

                            <Button
                                variant="secondary"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="h-9 w-9 p-0 flex items-center justify-center rounded-lg border-slate-200 hover:border-emerald-500 disabled:opacity-50"
                            >
                                <ChevronRight size={16} />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// === SUB COMPONENT: DETAIL VIEW ===
function ReregistrationDetail({ student, onBack, onSave }) {
    // Local state for editing validation status
    const [docs, setDocs] = useState(student.reregistration_docs || {});
    const [deferment, setDeferment] = useState(student.reregistration_deferment || { requested: false, reason: '' });

    // Notes
    const [invalidNotes, setInvalidNotes] = useState({
        mcu: docs.mcu?.note || '',
        no_smoking: docs.no_smoking?.note || '',
        no_lgbt: docs.no_lgbt?.note || '',
        transfer: docs.transfer?.note || ''
    });

    const updateDocStatus = (key, status) => {
        setDocs(prev => ({
            ...prev,
            [key]: { ...prev[key], status }
        }));
    };

    const StatusDropdown = ({ value, onChange }) => (
        <select value={value || 'uploaded'} onChange={e => onChange(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 w-full">
            <option value="uploaded">Belum Diperiksa</option>
            <option value="valid">Valid</option>
            <option value="invalid">Tidak Valid</option>
        </select>
    );

    const handleSave = () => {
        // Sync notes
        const finalDocs = { ...docs };
        Object.keys(invalidNotes).forEach(k => {
            if (finalDocs[k]) finalDocs[k].note = invalidNotes[k];
        });

        onSave({
            reregistration_docs: finalDocs,
            reregistration_deferment: deferment
        });
    };

    return (
        <div className="space-y-6 animate-fade-in relative pb-20">
            {/* Breadcrumb & Header */}
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <span className="cursor-pointer hover:text-blue-600" onClick={onBack}>Proses Daftar Ulang</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-800 font-bold">Detail Data Daftar Ulang Santri</span>
            </div>

            <div className="flex items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Detail Daftar Ulang</h2>
            </div>

            {/* ReadOnly Data Section */}
            <Card className="p-6 bg-slate-50 border-none shadow-none">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label="Nama Siswa" value={student.student_name || ''} disabled className="bg-slate-100" />
                    <Input label="Jenis Kelamin" value={student.gender === 'L' ? 'Laki-Laki' : (student.gender === 'P' ? 'Perempuan' : '-')} disabled className="bg-slate-100" />
                    <Input label="Program Pilihan" value={student.major || student.unit_name || '-'} disabled className="bg-slate-100" />
                    <Input label="Cabang" value={student.branch_name || 'IDN Jonggol'} disabled className="bg-slate-100" />
                    <Input label="Total Transfer" value="Rp 0 (Mock)" disabled className="bg-slate-100" />
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">Status Beasiswa</label>
                        <div className="bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-lg text-sm text-slate-600">Reguler</div>
                    </div>
                </div>
            </Card>

            {/* Sibling Data (Mock) */}
            <Card className="p-6">
                <h4 className="font-bold text-blue-600 text-sm mb-4">Data Saudara Kandung di IDN</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="[Nama Lengkap]" disabled className="bg-slate-50" placeholder="-" />
                    <Input label="[Jenjang Pendidikan]" disabled className="bg-slate-50" placeholder="-" />
                    <Input label="[Kelas]" disabled className="bg-slate-50" placeholder="-" />
                    <Input label="[Cabang IDN]" disabled className="bg-slate-50" placeholder="-" />
                </div>
            </Card>

            {/* Document Sections */}
            {[
                { id: 'mcu', label: 'Lampiran Surat MCU (Medical Check Up)' },
                { id: 'no_smoking', label: 'Lampiran Surat Pernyataan (Tidak Merokok)' }, // Simplified for demo
                { id: 'transfer', label: 'Lampiran Bukti Transfer', isTransfer: true }
            ].map(doc => (
                <Card key={doc.id} className="p-6">
                    <h4 className="font-bold text-blue-600 text-sm mb-4">{doc.label}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div className="space-y-2">
                            <div className="text-xs font-bold text-slate-500 mb-1">Preview Dokumen</div>
                            {docs[doc.id]?.url ? (
                                <div className="border rounded-lg p-2 bg-slate-50 text-center">
                                    <a href={docs[doc.id].url} target="_blank" className="text-blue-600 underline text-xs">Lihat Dokumen</a>
                                    {/* In real app, render image preview here */}
                                    <div className="h-32 bg-slate-200 mt-2 rounded flex items-center justify-center text-slate-400">Preview Image</div>
                                </div>
                            ) : (
                                <div className="h-32 bg-slate-100 rounded border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-sm italic">Belum Upload</div>
                            )}
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">Status {doc.label}</label>
                                <StatusDropdown value={docs[doc.id]?.status} onChange={(v) => updateDocStatus(doc.id, v)} />
                            </div>
                            {(docs[doc.id]?.status === 'invalid') && (
                                <div className="space-y-1 w-full animate-slide-down">
                                    <label className="text-xs font-bold text-red-500">Alasan Tidak Valid</label>
                                    <textarea
                                        className="w-full border border-red-200 rounded p-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                        rows={3}
                                        value={invalidNotes[doc.id]}
                                        onChange={e => setInvalidNotes({ ...invalidNotes, [doc.id]: e.target.value })}
                                        placeholder="Jelaskan kenapa dokumen ditolak..."
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            ))}

            {/* Deferment */}
            <Card className="p-6">
                <h4 className="font-bold text-blue-600 text-sm mb-4">Pengajuan Penundaan</h4>
                <div className="space-y-1 w-full md:w-1/3">
                    <label className="text-xs font-bold text-slate-500 bg-white px-1">Penundaan Daftar Ulang</label>
                    <select
                        value={deferment.requested ? 'ya' : 'tidak'}
                        onChange={e => setDeferment(prev => ({ ...prev, requested: e.target.value === 'ya' }))}
                        className="border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none w-full"
                    >
                        <option value="tidak">Tidak</option>
                        <option value="ya">Ya</option>
                    </select>
                </div>
            </Card>

            {/* Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-lg border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-50 flex gap-4 md:pl-72 justify-start">
                <Button onClick={onBack} variant="secondary" className="border-blue-500 text-blue-600 hover:bg-blue-50 flex items-center gap-2"><ArrowLeft size={16} /> Kembali</Button>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 w-32 justify-center"><Save size={16} /> Simpan</Button>
            </div>
            <div className="h-16"></div> {/* Spacer */}
        </div>
    );
}

