import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import { FileSpreadsheet, Search, Filter, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Eye, Download } from 'lucide-react';
import { Card, Button, Input, Badge } from '../ui/Elements';

export default function AdminTestRecap({ showToast }) {
    const [registrations, setRegistrations] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [waves, setWaves] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterYear, setFilterYear] = useState('');
    const [filterBatch, setFilterBatch] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Expanded Rows
    const [expandedRows, setExpandedRows] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Academic Years
                const { data: ayData, error: ayError } = await supabase.from('academic_years').select('*');
                if (ayError) throw ayError;
                setAcademicYears(ayData);

                // Set default year to active one
                const activeAy = ayData.find(ay => ay.is_active);
                if (activeAy) setFilterYear(activeAy.year);

                // Fetch Waves (Batches)
                const { data: wavesData, error: wavesError } = await supabase.from('waves').select('*');
                if (wavesError) throw wavesError;
                setWaves(wavesData);

                // Fetch All Registrations
                const { data: regsData, error: regsError } = await supabase
                    .from('registrations')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (regsError) throw regsError;
                setRegistrations(regsData);

                setLoading(false);
            } catch (err) {
                console.error("Error fetching data:", err);
                showToast("Gagal memuat data rekapitulasi", "error");
                setLoading(false);
            }
        };
        fetchData();

        // Subscription for real-time updates
        const channel = supabase.channel('admin_test_recap_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, async () => {
                // Ideally optimize this to not re-fetch everything, but for consistency:
                const { data: regsData } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });
                if (regsData) setRegistrations(regsData);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    // Helper: Calculate Final Score / Status Logic
    const getStatusBadge = (status) => {
        if (['lulus', 'paid', 'accepted'].includes(status)) return <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">Lulus</span>;
        if (status === 'rejected') return <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-bold">Tidak Lulus</span>;
        if (['interview_done', 'psychotest_done'].includes(status)) return <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs font-bold">Proses</span>;
        return <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs font-bold">-</span>;
    };

    const getPublicationBadge = (status) => {
        if (['lulus', 'paid', 'accepted', 'rejected'].includes(status)) return <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-600 text-[10px] uppercase font-bold border border-emerald-200">Release</span>;
        return <span className="px-2 py-1 rounded bg-slate-50 text-slate-400 text-[10px] uppercase font-bold border border-slate-200">Pending</span>;
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        return registrations.filter(reg => {
            const matchYear = filterYear ? (reg.academic_year === filterYear || reg.wave_name?.includes(filterYear)) : true;
            const matchBatch = filterBatch ? reg.wave_name === filterBatch : true;
            const matchSearch = searchTerm ? reg.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) : true;

            // Filter by Status that implies "Tested" (Assuming only processed students show up in recap)
            // Or show all? The screenshot shows "Data Kelulusan", implying results.
            const hasResult = true; // reg.status !== 'draft'; 

            return matchYear && matchBatch && matchSearch && hasResult;
        });
    }, [registrations, filterYear, filterBatch, searchTerm]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const toggleExpand = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><FileSpreadsheet className="text-emerald-600" /> Rekapitulasi Tes</h2>
                <p className="text-slate-500 text-sm ml-8">Rekapitulasi data hasil semua jenis tes</p>
            </div>

            {/* Filter Card */}
            <Card className="p-6 border-t-4 border-t-emerald-500">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-4">
                    <h3 className="font-bold text-slate-700 text-lg">Data Kelulusan PSB Tahun Ajaran <span className="text-blue-600">{filterYear || '...'}</span></h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">Pilih Tahun Ajaran</label>
                        <select
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                        >
                            <option value="">Semua Tahun</option>
                            {academicYears.map(ay => (
                                <option key={ay.id} value={ay.year}>{ay.year}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">Pilih Batch Tes</label>
                        <select
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={filterBatch}
                            onChange={(e) => setFilterBatch(e.target.value)}
                        >
                            <option value="">--Pilih--</option>
                            {waves.map(w => (
                                <option key={w.id} value={w.name}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">Filter Tanggal Release</label>
                        <div className="relative">
                            <input
                                type="date"
                                className="w-full p-2.5 pl-10 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-500"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                            />
                            <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
                        </div>
                    </div>

                    <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto h-[42px] flex items-center justify-center gap-2">
                        <Search size={16} /> Filter
                    </Button>
                </div>
            </Card>

            {/* Table Section */}
            <Card className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h3 className="font-bold text-slate-700 text-lg">Tabel Hasil Akhir Tes</h3>
                    <div className="flex items-center gap-2">
                        <span className="bg-cyan-500 text-white px-3 py-1 rounded text-xs font-bold shadow-sm shadow-cyan-200">PSB Tahun Ajaran {filterYear}</span>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span>Tampilkan</span>
                        <select
                            className="border border-slate-200 rounded p-1 text-sm bg-white focus:ring-2 focus:ring-emerald-500"
                            value={itemsPerPage}
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <span>entri</span>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <span className="text-sm text-slate-600">Cari:</span>
                        <input
                            type="text"
                            className="border border-slate-200 rounded px-3 py-1.5 text-sm w-full md:w-64 focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder=""
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                            <tr>
                                <th className="p-3 text-left w-10"></th>
                                <th className="p-3 text-left">No</th>
                                <th className="p-3 text-left">Nama</th>
                                <th className="p-3 text-center">Psikotes</th>
                                <th className="p-3 text-center">W. Siswa</th>
                                <th className="p-3 text-center">W. Wali</th>
                                <th className="p-3 text-center">Rata Wawancara</th>
                                <th className="p-3 text-center">Hasil Akhir</th>
                                <th className="p-3 text-center">Nilai Akhir</th>
                                <th className="p-3 text-center">Publikasi</th>
                                <th className="p-3 text-left">Waktu Pengumuman</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="11" className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                            ) : paginatedData.length === 0 ? (
                                <tr><td colSpan="11" className="p-8 text-center text-slate-400 italic">Tidak ada data ditemukan</td></tr>
                            ) : paginatedData.map((reg, idx) => {
                                const index = (currentPage - 1) * itemsPerPage + idx + 1;
                                const isExpanded = expandedRows[reg.id];

                                // Data extraction
                                const scores = reg.final_scores || {};
                                const psychotest = reg.psychotest_result || {};
                                const interviewResult = reg.interview_result || {};

                                const psikoScore = parseFloat(scores.psychotest || psychotest.final_score || 0);
                                const studentInterview = parseFloat(scores.student_interview || interviewResult.student_score || 0);
                                const parentInterview = parseFloat(scores.parent_interview || interviewResult.parent_score || 0);
                                const avgInterview = parseFloat(scores.average_interview || interviewResult.average_score || 0);

                                // New Weight Calculation: 50% Psiko + 50% Aug Interview
                                const totalScore = (psikoScore * 0.5) + (avgInterview * 0.5);

                                return (
                                    <React.Fragment key={reg.id}>
                                        <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}>
                                            <td className="p-3 text-center">
                                                <button
                                                    onClick={() => toggleExpand(reg.id)}
                                                    className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs transition-transform hover:scale-110"
                                                    style={{ backgroundColor: isExpanded ? '#ef4444' : '#3b82f6' }} // Red for -, Blue for +
                                                >
                                                    {isExpanded ? '-' : '+'}
                                                </button>
                                            </td>
                                            <td className="p-3">{index}</td>
                                            <td className="p-3 font-medium text-slate-800">
                                                {reg.student_name}
                                                <div className="text-[10px] text-slate-400 font-mono">{reg.id.slice(0, 8)}</div>
                                            </td>
                                            <td className="p-3 text-center font-mono">{psikoScore || '-'}</td>
                                            <td className="p-3 text-center font-mono text-emerald-600">{studentInterview || '-'}</td>
                                            <td className="p-3 text-center font-mono text-purple-600">{parentInterview || '-'}</td>
                                            <td className="p-3 text-center font-bold font-mono text-amber-600">{avgInterview || '-'}</td>
                                            <td className="p-3 text-center">{getStatusBadge(reg.status)}</td>
                                            <td className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/50 rounded">{totalScore ? totalScore.toFixed(2) : '-'}</td>
                                            <td className="p-3 text-center">{getPublicationBadge(reg.status)}</td>
                                            <td className="p-3 text-xs text-slate-500">{formatDate(reg.decided_at)}</td>
                                        </tr>
                                        {/* Expanded Detail Row */}
                                        {isExpanded && (
                                            <tr className="bg-slate-50 animate-fade-in">
                                                <td colSpan="11" className="p-4 pl-12 border-t border-slate-100">
                                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                                                        <div>
                                                            <span className="text-slate-500 block text-xs font-bold uppercase mb-1">Program</span>
                                                            <span className="font-medium text-slate-800">{reg.unit_name}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500 block text-xs font-bold uppercase mb-1">Jurusan</span>
                                                            <span className="font-medium text-slate-800">{reg.major || '-'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500 block text-xs font-bold uppercase mb-1">Waktu Tes</span>
                                                            <span className="font-medium text-slate-800">{formatDate(reg.created_at)}</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <span className="text-slate-500 text-xs font-bold uppercase mr-4">Catatan</span>
                                                            <span className="text-xs italic text-slate-600">{reg.decision_notes || 'Tidak ada catatan khusus.'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="flex flex-col md:flex-row justify-between items-center mt-6 text-sm text-slate-500 gap-4">
                    <div>
                        Menampilkan {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} sampai {Math.min(currentPage * itemsPerPage, filteredData.length)} dari {filteredData.length} data
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="px-4 font-medium text-slate-700">Halaman {currentPage}</span>
                        <button
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
