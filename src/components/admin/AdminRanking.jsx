import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    Trophy, Medal, ArrowDownUp, AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Card, Badge, Select, Button } from '../ui/Elements';

export default function AdminRanking({ showToast }) {
    const [data, setData] = useState([]);
    const [branchFilter, setBranchFilter] = useState('');
    const [branches, setBranches] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [yearFilter, setYearFilter] = useState('');
    const [loading, setLoading] = useState(true);

    // Pagination State
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const ITEM_PER_PAGE_OPTIONS = [10, 20, 50, 100];

    const processData = (regs) => {
        let d = regs.map(doc => ({ ...doc }));

        // Filter for those who have at least a psychotest score
        d = d.filter(s => s.status !== 'draft' && s.status !== 'submitted' && s.psychotest_result?.final_score);

        // Calculate Scores
        d = d.map(s => {
            // Prioritize final_scores object if exists (from AdminScoring), else fallback or 0
            const psiko = parseFloat(s.final_scores?.psychotest || s.psychotest_result?.final_score || 0);
            // Use average interview score from interview_result
            const interviewAvg = parseFloat(s.final_scores?.average_interview || s.interview_result?.average_score || 0);
            const interviewStudent = parseFloat(s.final_scores?.student_interview || s.interview_result?.student_score || 0);
            const interviewParent = parseFloat(s.final_scores?.parent_interview || s.interview_result?.parent_score || 0);

            // New Weights: 50% Psiko, 50% Wawancara (rata-rata)
            const total = (psiko * 0.5) + (interviewAvg * 0.5);

            return {
                ...s,
                scores: { psiko, interviewAvg, interviewStudent, interviewParent },
                totalScore: isNaN(total) ? 0 : parseFloat(total.toFixed(2))
            };
        });

        // Sort by Total Score Descending
        d.sort((a, b) => b.totalScore - a.totalScore);
        setData(d);
        setLoading(false);
    };

    const fetchData = async () => {
        try {
            const [
                { data: regsData },
                { data: unitsData },
                { data: yearsData }
            ] = await Promise.all([
                supabase.from('registrations').select('*'),
                supabase.from('units').select('*'),
                supabase.from('academic_years').select('*')
            ]);

            if (regsData) processData(regsData);
            if (unitsData) setBranches(unitsData);

            const years = yearsData || [];
            setAcademicYears(years);
            if (!yearFilter) {
                const def = years.find(y => y.is_default);
                if (def) setYearFilter(def.year);
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        const channel = supabase.channel('admin_ranking')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_years' }, fetchData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [branchFilter, data.length]);

    const filteredData = data.filter(d => {
        const matchBranch = branchFilter ? d.unit_id === branchFilter : true;
        const matchYear = yearFilter ? d.academic_year === yearFilter : true;
        return matchBranch && matchYear;
    });

    // Pagination Calculations
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentData = filteredData.slice(startIndex, startIndex + itemsPerPage);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Trophy className="text-emerald-600" /> Perangkingan Seleksi</h2>
                    <p className="text-slate-500 text-sm mt-1">Real-time ranking berdasarkan bobot penilaian: <span className="font-semibold text-emerald-600">50% Psikotes, 50% Wawancara (Rata-rata Siswa & Wali)</span>.</p>
                </div>
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    <div className="w-full md:w-48">
                        <Select
                            value={yearFilter}
                            onChange={e => setYearFilter(e.target.value)}
                            options={[{ value: '', label: 'Semua Tahun' }, ...academicYears.map(y => ({ value: y.year, label: y.year }))]}
                        />
                    </div>
                    <div className="w-full md:w-64">
                        <Select
                            value={branchFilter}
                            onChange={e => setBranchFilter(e.target.value)}
                            options={[{ value: '', label: 'Semua Cabang Sekolah' }, ...branches.map(u => ({ value: u.id, label: u.name }))]}
                        />
                    </div>
                </div>
            </div>

            <Card className="overflow-hidden border border-slate-200 shadow-sm p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs border-b border-slate-200 tracking-wider">
                            <tr>
                                <th className="p-4 w-20 text-center">Rank</th>
                                <th className="p-4 min-w-[200px]">Nama Siswa</th>
                                <th className="p-4">Cabang Tujuan</th>
                                <th className="p-4 text-center text-slate-400">Psikotes<br /><span className="text-[10px] lowercase font-normal">(50%)</span></th>
                                <th className="p-4 text-center text-emerald-600">W. Siswa<br /><span className="text-[10px] lowercase font-normal">/100</span></th>
                                <th className="p-4 text-center text-purple-600">W. Wali<br /><span className="text-[10px] lowercase font-normal">/100</span></th>
                                <th className="p-4 text-center text-amber-600">Rata-rata<br /><span className="text-[10px] lowercase font-normal">(50%)</span></th>
                                <th className="p-4 text-center text-emerald-700 bg-emerald-50/50">Total Skor</th>
                                <th className="p-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading ? (
                                <tr><td colSpan="9" className="p-12 text-center text-slate-400">Loading data perangkingan...</td></tr>
                            ) : currentData.length > 0 ? currentData.map((d, idx) => {
                                const realRank = startIndex + idx + 1;
                                return (
                                    <tr key={d.id} className={`hover:bg-slate-50 transition-colors ${realRank <= 3 && !branchFilter ? 'bg-amber-50/10' : ''}`}>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center">
                                                {realRank === 1 && <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center"><Medal size={18} /></div>}
                                                {realRank === 2 && <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"><Medal size={18} /></div>}
                                                {realRank === 3 && <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><Medal size={18} /></div>}
                                                {realRank > 3 && <span className="text-slate-500 font-mono font-bold">#{realRank}</span>}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-700 text-base">{d.student_name}</div>
                                            <div className="text-xs text-slate-400 font-mono mt-0.5">ID: {d.id.slice(0, 8)}</div>
                                        </td>
                                        <td className="p-4 align-middle">
                                            <div className="text-slate-600 font-medium">{d.unit_name}</div>
                                            {d.major && <div className="text-xs text-slate-400">{d.major}</div>}
                                        </td>
                                        <td className="p-4 text-center align-middle text-slate-500">{d.scores.psiko || '-'}<span className="text-[10px] text-slate-300 ml-1">/100</span></td>
                                        <td className="p-4 text-center align-middle text-emerald-600 font-bold">{d.scores.interviewStudent || '-'}<span className="text-[10px] text-slate-300 ml-1">/100</span></td>
                                        <td className="p-4 text-center align-middle text-purple-600 font-bold">{d.scores.interviewParent || '-'}<span className="text-[10px] text-slate-300 ml-1">/100</span></td>
                                        <td className="p-4 text-center align-middle text-amber-600 font-bold">{d.scores.interviewAvg || '-'}<span className="text-[10px] text-slate-300 ml-1">/100</span></td>
                                        <td className="p-4 text-center align-middle bg-emerald-50/30">
                                            <div className="font-mono font-bold text-emerald-600 text-xl">{d.totalScore}</div>
                                        </td>
                                        <td className="p-4 text-center align-middle"><Badge status={d.status} /></td>
                                    </tr>
                                )
                            }) : (
                                <tr>
                                    <td colSpan="9" className="p-12">
                                        <div className="flex flex-col items-center justify-center text-center text-slate-400 gap-3">
                                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                                                <Trophy size={32} className="text-slate-300" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-600">Belum ada data siswa untuk dirangking.</p>
                                                <p className="text-sm mt-1">Pastikan siswa sudah memiliki nilai Psikotes dan Wawancara.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {!loading && filteredData.length > 0 && (
                    <div className="flex flex-col md:flex-row justify-between items-center p-4 border-t border-slate-100 bg-slate-50/50 gap-4">
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                            <span>Tampilkan</span>
                            <select
                                className="border border-slate-300 rounded-md p-1.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={itemsPerPage}
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span>baris per halaman</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-500 mr-2">
                                Halaman {currentPage} dari {totalPages} (Total: {filteredData.length})
                            </span>
                            <div className="flex gap-1">
                                <Button
                                    variant="outline"
                                    className="px-2 h-9"
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft size={16} />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="px-2 h-9"
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronRight size={16} />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
