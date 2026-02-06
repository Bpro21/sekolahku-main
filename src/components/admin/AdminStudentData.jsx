import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { Card, Button, Input, Select } from '../ui/Elements';
import { Modal } from '../ui/Overlays';
import {
    Users, Download, Search, Eye, GraduationCap, Building,
    User, Phone, Mail, MapPin, Calendar, FileText, CheckCircle, ChevronLeft, ChevronRight, RotateCcw
} from 'lucide-react';

export default function AdminStudentData({ showToast }) {
    const [registrations, setRegistrations] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch data
    const fetchData = async () => {
        try {
            const [
                { data: ayData },
                { data: uData },
                { data: regData }
            ] = await Promise.all([
                supabase.from('academic_years').select('*'),
                supabase.from('units').select('*'),
                supabase.from('registrations').select('*')
            ]);

            const ays = ayData || [];
            setAcademicYears(ays);
            // Set default to active year
            const defaultYear = ays.find(ay => ay.is_default);
            if (defaultYear && !selectedYear) {
                setSelectedYear(defaultYear.year);
            }

            setBranches(uData || []);
            setRegistrations(regData || []);
            setLoading(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        const channel = supabase.channel('admin_student_data')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_years' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, fetchData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Filter students who have "lulus" status
    const passedStudents = registrations.filter(reg => {
        const isLulus = reg.status === 'lulus' || reg.status === 'paid' || reg.status === 'student';
        const matchesYear = !selectedYear || reg.academic_year === selectedYear;
        const matchesSearch = !searchTerm ||
            reg.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reg.major?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reg.unit_name?.toLowerCase().includes(searchTerm.toLowerCase());
        return isLulus && matchesYear && matchesSearch;
    });

    // Pagination
    const totalPages = Math.ceil(passedStudents.length / entriesPerPage);
    const startIndex = (currentPage - 1) * entriesPerPage;
    const paginatedStudents = passedStudents.slice(startIndex, startIndex + entriesPerPage);

    // Get branch name
    const getBranchName = (unitId) => {
        const branch = branches.find(b => b.id === unitId);
        return branch?.name || unitId || '-';
    };

    // Export to Excel/CSV
    const handleExportExcel = () => {
        if (passedStudents.length === 0) {
            showToast('Tidak ada data untuk diexport', 'error');
            return;
        }

        const headers = ['No', 'Nama Lengkap', 'Program/Jurusan', 'Nama Cabang', 'Jenis Santri', 'Status', 'No. WhatsApp', 'Email'];
        const rows = passedStudents.map((student, idx) => [
            idx + 1,
            student.student_name || '-',
            student.major || '-',
            student.unit_name || getBranchName(student.unit_id),
            student.student_type || 'Reguler',
            student.registration_type === 'indent' ? 'Indent' : 'Reguler',
            student.parent_phone || '-',
            student.parent_email || '-'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Data_Santri_Lulus_${selectedYear || 'All'}.csv`;
        link.click();
        showToast('Data berhasil diexport!');
    };

    return (
        <div className="space-y-8 font-sans">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 flex items-center gap-3">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400 shadow-sm">
                            <GraduationCap size={28} />
                        </div>
                        Data Siswa Lulus
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm max-w-2xl leading-relaxed">
                        Daftar siswa yang telah <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1 rounded">LULUS SELEKSI</span> dan menyelesaikan administrasi daftar ulang.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
                    <Calendar size={18} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-bold text-blue-800 dark:text-blue-300">
                        {selectedYear ? `Tahun Ajaran: ${selectedYear}` : 'Semua Tahun Ajaran'}
                    </span>
                </div>
            </div>

            {/* Filter & Actions Card */}
            <Card className="p-1 border-0 shadow-xl shadow-slate-200/60 dark:shadow-black/20 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden">
                <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                    {/* Year Filter */}
                    <div className="md:col-span-4 space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Filter Tahun Ajaran</label>
                        <div className="relative group">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                            <select
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-medium transition-all hover:bg-white"
                                value={selectedYear}
                                onChange={e => { setSelectedYear(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="">Semua Tahun</option>
                                {[...new Set(academicYears.map(ay => ay.year))].sort().reverse().map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Refresh Button & Reset */}
                    <div className="md:col-span-3 flex gap-2">
                        <Button
                            onClick={() => setCurrentPage(1)}
                            className="flex-1 h-[46px] bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-200 dark:shadow-none flex items-center justify-center gap-2"
                        >
                            <span className="font-bold">Terapkan</span>
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => { setSelectedYear(''); setSearchTerm(''); setCurrentPage(1); }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl h-[46px] w-[46px] flex items-center justify-center border-0"
                            title="Reset Filter"
                        >
                            <RotateCcw size={20} />
                        </Button>
                    </div>

                    <div className="hidden md:block md:col-span-2"></div>

                    {/* Export Button */}
                    <div className="md:col-span-3 flex justify-end">
                        <Button
                            onClick={handleExportExcel}
                            variant="secondary"
                            className="w-full md:w-auto h-[46px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 rounded-xl flex items-center justify-center gap-2 font-bold"
                        >
                            <Download size={18} /> Export Data (.csv)
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Data Table Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-black/20 border border-slate-100 dark:border-slate-700 overflow-hidden">
                {/* Controls */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-500">Tampilkan</span>
                        <div className="relative">
                            <select
                                className="appearance-none pl-4 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer hover:border-emerald-300 transition-colors"
                                value={entriesPerPage}
                                onChange={e => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </div>
                        </div>
                        <span className="text-sm font-medium text-slate-500">baris per halaman</span>
                    </div>

                    <div className="relative w-full md:w-72 group">
                        <input
                            type="text"
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all group-hover:border-slate-300"
                            placeholder="Cari nama, jurusan..."
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4 font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-xs">No</th>
                                <th className="px-6 py-4 font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-xs">Nama Lengkap</th>
                                <th className="px-6 py-4 font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-xs">Program</th>
                                <th className="px-6 py-4 font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-xs">Cabang</th>
                                <th className="px-6 py-4 font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-xs">Pendaftaran</th>
                                <th className="px-6 py-4 font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-xs">Status Siswa</th>
                                <th className="px-6 py-4 font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-xs text-center">Opsi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="relative">
                                                <div className="w-12 h-12 border-4 border-slate-100 rounded-full"></div>
                                                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                                            </div>
                                            <span className="text-slate-500 font-medium animate-pulse">Sedang memuat data...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedStudents.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-20 text-center">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-700">
                                            <Users size={40} className="text-slate-300 dark:text-slate-600" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Belum Ada Data</h3>
                                        <p className="text-slate-500 max-w-sm mx-auto mt-2">
                                            Belum ada santri yang berstatus <span className="font-bold text-emerald-600">LULUS</span> pada filter yang dipilih.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedStudents.map((student, idx) => (
                                    <tr key={student.id} className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors border-l-4 border-transparent hover:border-emerald-500">
                                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">{startIndex + idx + 1}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-700 dark:text-white group-hover:text-emerald-700 transition-colors">
                                                {student.student_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{student.major || <span className="text-slate-300 italic">Umum</span>}</td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{student.unit_name || getBranchName(student.unit_id)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border ${(student.is_internal || student.category === 'Internal' || (student.path_name && student.path_name.toLowerCase().includes('internal')))
                                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                : 'bg-sky-50 text-sky-700 border-sky-200'
                                                }`}>
                                                {(student.is_internal || student.category === 'Internal' || (student.path_name && student.path_name.toLowerCase().includes('internal'))) ? 'Internal' : 'Eksternal'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const path = (student.path_name || '').toLowerCase();
                                                const isScholarship = path.includes('prestasi') || path.includes('beasiswa') || path.includes('yatim') || path.includes('tahfidz') || path.includes('karyawan');
                                                return (
                                                    <span className={`flex items-center gap-1.5 px-2.5 py-1 w-fit rounded-md text-[11px] font-bold border ${isScholarship
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        }`}>
                                                        {isScholarship ? <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> : <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                                                        {isScholarship ? 'Beasiswa' : 'Reguler'}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Button
                                                onClick={() => setSelectedStudent(student)}
                                                className="bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 shadow-sm text-xs px-4 py-1.5 h-auto rounded-lg transition-all"
                                            >
                                                <Eye size={14} className="mr-1.5" /> Detail
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {/* Pagination Footer */}
                <div className="p-4 border-t bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-xs text-slate-500">
                        Menampilkan <span className="font-bold text-slate-700">{passedStudents.length > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + entriesPerPage, passedStudents.length)}</span> dari <span className="font-bold text-slate-700">{passedStudents.length}</span> data
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
                            <button
                                disabled={currentPage === 1 || passedStudents.length === 0}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                className="px-3 py-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed border-r border-slate-100 transition-colors text-slate-600"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="px-4 py-2 font-bold text-emerald-600 bg-emerald-50 border-r border-slate-100 min-w-[3rem] text-center">
                                {currentPage}
                            </div>
                            <button
                                disabled={currentPage === totalPages || totalPages === 0}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                className="px-3 py-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-600"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedStudent}
                onClose={() => setSelectedStudent(null)}
                title="Detail Data Siswa"
                size="lg"
            >
                {selectedStudent && (
                    <div className="space-y-6">
                        {/* Header */}
                        <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                                <User size={32} className="text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{selectedStudent.student_name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full font-bold">
                                        <CheckCircle size={12} className="inline mr-1" />LULUS
                                    </span>
                                    <span className="text-sm text-slate-500">TA {selectedStudent.academic_year}</span>
                                </div>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                    <Building size={14} />
                                    <span>Cabang Sekolah</span>
                                </div>
                                <p className="font-bold text-slate-800">{selectedStudent.unit_name || getBranchName(selectedStudent.unit_id)}</p>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                    <GraduationCap size={14} />
                                    <span>Program / Jurusan</span>
                                </div>
                                <p className="font-bold text-slate-800">{selectedStudent.major || '-'}</p>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                    <FileText size={14} />
                                    <span>Status Siswa</span>
                                </div>
                                <p className="font-bold text-slate-800">
                                    {(() => {
                                        const path = (selectedStudent.path_name || '').toLowerCase();
                                        const isScholarship = path.includes('prestasi') || path.includes('beasiswa') || path.includes('yatim') || path.includes('tahfidz') || path.includes('karyawan');
                                        return isScholarship ? 'Beasiswa' : 'Reguler';
                                    })()}
                                </p>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                    <Users size={14} />
                                    <span>Pendaftaran</span>
                                </div>
                                <p className="font-bold text-slate-800">
                                    {(selectedStudent.is_internal || selectedStudent.category === 'Internal' || (selectedStudent.path_name && selectedStudent.path_name.toLowerCase().includes('internal'))) ? 'Internal' : 'Eksternal'}
                                </p>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                    <Phone size={14} />
                                    <span>No. WhatsApp Ortu</span>
                                </div>
                                <p className="font-bold text-slate-800">{selectedStudent.parent_phone || '-'}</p>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                    <Mail size={14} />
                                    <span>Email</span>
                                </div>
                                <p className="font-bold text-slate-800">{selectedStudent.parent_email || '-'}</p>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl md:col-span-2">
                                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                    <Calendar size={14} />
                                    <span>Tanggal Pendaftaran</span>
                                </div>
                                <p className="font-bold text-slate-800">
                                    {selectedStudent.created_at ? new Date(selectedStudent.created_at).toLocaleDateString('id-ID', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    }) : '-'}
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="secondary" onClick={() => setSelectedStudent(null)}>
                                Tutup
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
