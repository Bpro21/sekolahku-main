import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    Building, Trash2, Plus, Lock, CalendarClock, CheckCircle, Info, Layers, Calendar
} from 'lucide-react';
import { Card, Button, Input, Select } from '../ui/Elements';
import { Modal, DeleteConfirmModal } from '../ui/Overlays';

export default function AdminSchoolSettings({ showToast }) {
    const [branches, setBranches] = useState([]);
    const [waves, setWaves] = useState([]);
    const [paths, setPaths] = useState([]);
    const [editingBranch, setEditingBranch] = useState(null);
    const [editingWave, setEditingWave] = useState(null);
    const [academicYears, setAcademicYears] = useState([]);
    const [editingAcademicYear, setEditingAcademicYear] = useState(null);




    // Delete Confirmation State
    const [deleteTarget, setDeleteTarget] = useState(null); // { id: string, name: string } - for branches
    const [deletePassword, setDeletePassword] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteAcademicYear, setDeleteAcademicYear] = useState(null); // { id, year } - for academic years

    const [activeTab, setActiveTab] = useState('branches'); // branches, waves, indent_internal
    const [selectedAcademicYear, setSelectedAcademicYear] = useState(''); // Filter for branches by academic year

    // Internal Indent State
    const [indentInternal, setIndentInternal] = useState(null);
    const [isLoadingIndent, setIsLoadingIndent] = useState(true);

    const fetchAllData = async () => {
        try {
            const { data: uData } = await supabase.from('units').select('*');
            if (uData) setBranches(uData);

            const { data: wData } = await supabase.from('waves').select('*');
            if (wData) setWaves(wData);

            const { data: ayData } = await supabase.from('academic_years').select('*').order('year', { ascending: false });
            if (ayData) setAcademicYears(ayData);

            // Fetch Indent Settings
            const { data: iData } = await supabase.from('indent_settings').select('*').maybeSingle();
            if (iData) {
                setIndentInternal(iData);
            } else {
                setIndentInternal({ start_date: '', end_date: '', active: false, target_academic_years: [] });
            }
            setIsLoadingIndent(false);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchAllData();

        // Realtime Subscriptions
        const channel = supabase.channel('admin_school_settings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, fetchAllData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'waves' }, fetchAllData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_years' }, fetchAllData)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    // Set default academic year to active one
    useEffect(() => {
        if (academicYears.length > 0 && !selectedAcademicYear) {
            const activeYear = academicYears.find(ay => ay.is_active);
            if (activeYear) {
                setSelectedAcademicYear(activeYear.id);
            } else {
                setSelectedAcademicYear(academicYears[0]?.id);
            }
        }
    }, [academicYears, selectedAcademicYear]);

    const handleSaveBranch = async () => {
        try {
            // Before saving, ensure current form values are saved to the active academic config
            const u = { ...editingBranch };
            if (u.active_academic_year_id) {
                if (!u.academic_configs) u.academic_configs = {};

                // For SMK, ensure quota matches sum of majors before saving to config
                let currentQuota = u.quota;
                if (u.level === 'SMK' && u.majors && u.majors.length > 0) {
                    currentQuota = u.majors.reduce((acc, curr) => acc + (curr.quota || 0), 0);
                    u.quota = currentQuota; // Update main object too
                }

                u.academic_configs[u.active_academic_year_id] = {
                    quota: currentQuota,
                    cost_reg: u.cost_reg,
                    cost_rereg: u.cost_rereg,
                    cost_spp: u.cost_spp,
                    spp_includes: u.spp_includes || [],
                    majors: u.majors || [],
                    fee_breakdown: u.fee_breakdown || []
                };
            } else {
                // Even if no academic year active, if SMK, force recalculate
                if (u.level === 'SMK' && u.majors && u.majors.length > 0) {
                    u.quota = u.majors.reduce((acc, curr) => acc + (curr.quota || 0), 0);
                }
            }

            if (u.id) {
                const { id, ...data } = u;
                const { error } = await supabase.from('units').update(data).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('units').insert(u);
                if (error) throw error;
            }
            showToast('Cabang Sekolah tersimpan'); setEditingBranch(null);
            fetchAllData();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleSaveWave = async () => {
        try {
            if (editingWave.id) {
                const { id, ...data } = editingWave;
                const { error } = await supabase.from('waves').update(data).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('waves').insert(editingWave);
                if (error) throw error;
            }
            showToast('Gelombang tersimpan'); setEditingWave(null);
            fetchAllData();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleSaveAcademicYear = async () => {
        try {
            if (editingAcademicYear.id) {
                const { id, ...data } = editingAcademicYear;
                const { error } = await supabase.from('academic_years').update(data).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('academic_years').insert(editingAcademicYear);
                if (error) throw error;
            }
            showToast('Tahun Akademik tersimpan'); setEditingAcademicYear(null);
            fetchAllData();
        } catch (e) { showToast(e.message, 'error'); }
    };


    const handleGenerateDummy = async () => {
        if (!confirm('Ini akan membuat data dummy (Tahun Ajaran, Unit Sekolah, Gelombang, Rincian Biaya, SPP). Lanjutkan?')) return;
        try {
            // 1. Academic Years
            await supabase.from('academic_years').insert([
                { year: '2025/2026', is_active: true, is_default: true, indent_enabled: false },
                { year: '2026/2027', is_active: false, is_default: false, indent_enabled: true, indent_start_date: '2025-01-01', indent_end_date: '2025-12-31' }
            ]);

            // 2. Units with Cost Breakdown and SPP
            await supabase.from('units').insert([
                {
                    name: 'SD Islam Terpadu Cendekia', level: 'SD', location: 'Kampus A - Jakarta', quota: 100, filled: 5, open: true, cost_reg: 350000, cost_rereg: 8500000,
                    facilities: 'AC, Lapangan Futsal, Lab Komputer, Kantin Sehat', majors: [],
                    cost_breakdown: [
                        { name: 'Seragam (4 Stel)', amount: 800000 },
                        { name: 'Buku Paket & LKS', amount: 500000 },
                        { name: 'Kegiatan Ekstrakurikuler', amount: 300000 },
                        { name: 'Asuransi Kesehatan', amount: 200000 }
                    ],
                    spp_amount: 450000,
                    spp_items: ['Biaya Operasional Sekolah', 'Kegiatan Belajar Mengajar', 'Ekstrakurikuler Wajib', 'Perawatan Fasilitas']
                },
                {
                    name: 'SMP Islam Terpadu Cendekia', level: 'SMP', location: 'Kampus B - Bandung', quota: 120, filled: 12, open: true, cost_reg: 400000, cost_rereg: 12500000,
                    facilities: 'AC, Asrama Putra/Putri, Masjid Agung, Lab Sains, Perpustakaan Digital', majors: [],
                    cost_breakdown: [
                        { name: 'Seragam (5 Stel)', amount: 1200000 },
                        { name: 'Buku Paket & Modul', amount: 750000 },
                        { name: 'Biaya Asrama (1 Tahun)', amount: 3500000 },
                        { name: 'Kegiatan OSIS & Pramuka', amount: 400000 },
                        { name: 'Asuransi & Kesehatan', amount: 300000 }
                    ],
                    spp_amount: 850000,
                    spp_items: ['Biaya Operasional Sekolah', 'Biaya Asrama & Makan', 'Ekstrakurikuler Wajib', 'Perawatan Fasilitas & Lab']
                }
            ]);

            // 3. Waves
            await supabase.from('waves').insert([
                { name: 'Gelombang 1', year: '2025/2026', start_date: '2025-01-01', end_date: '2025-03-31', active: true },
                { name: 'Gelombang Inden', year: '2026/2027', start_date: '2025-06-01', end_date: '2025-12-31', active: true }
            ]);

            showToast('Data Dummy Berhasil Dibuat!');
            fetchAllData();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleSaveIndentInternal = async (e) => {
        if (e) e.preventDefault();
        if (!indentInternal) {
            showToast('Data belum dimuat.', 'error');
            return;
        }

        try {
            const dataToSave = { ...indentInternal };
            delete dataToSave.id;

            // Check if exists
            const { data: existing } = await supabase.from('indent_settings').select('id').maybeSingle();

            if (existing) {
                await supabase.from('indent_settings').update(dataToSave).eq('id', existing.id);
            } else {
                await supabase.from('indent_settings').insert(dataToSave);
            }

            showToast('Pengaturan Inden Internal tersimpan');
            fetchAllData();
        } catch (err) {
            console.error(err);
            showToast('Gagal menyimpan: ' + err.message, 'error');
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletePassword) {
            showToast('Masukkan password admin!', 'error');
            return;
        }
        setIsDeleting(true);
        try {
            // 1. Verify Password with Supabase Auth
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Sesi habis. Login ulang.");

            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: deletePassword
            });

            if (signInError) throw new Error("Password Admin salah!");

            // 2. Delete Branch
            const { error: deleteError } = await supabase.from('units').delete().eq('id', deleteTarget.id);
            if (deleteError) throw deleteError;

            showToast(`Cabang Sekolah "${deleteTarget.name}" berhasil dihapus.`);
            setDeleteTarget(null);
            setDeletePassword('');
            fetchAllData();
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    // Function to load branch with correct academic config data
    const handleEditBranch = (branch) => {
        const branchCopy = { ...branch };

        // Override active AY with globally selected AY filter to improve UX
        if (selectedAcademicYear) {
            branchCopy.active_academic_year_id = selectedAcademicYear;
        }

        // If there's an active academic year and config exists, load values from it
        if (branchCopy.active_academic_year_id && branchCopy.academic_configs) {
            const config = branchCopy.academic_configs[branchCopy.active_academic_year_id];
            if (config) {
                branchCopy.quota = config.quota ?? branchCopy.quota ?? 0;
                branchCopy.cost_reg = config.cost_reg ?? branchCopy.cost_reg ?? 0;
                branchCopy.cost_rereg = config.cost_rereg ?? branchCopy.cost_rereg ?? 0;
                branchCopy.majors = config.majors ?? branchCopy.majors ?? [];

                // Load fee breakdown (support legacy cost_breakdown)
                const breakdown = config.fee_breakdown || config.cost_breakdown || branchCopy.fee_breakdown || branchCopy.cost_breakdown || [];
                branchCopy.fee_breakdown = breakdown;
            } else {
                // If config doesn't exist for this year, keep global values as starting point
                // Ensure fee_breakdown is loaded from global
                branchCopy.fee_breakdown = branchCopy.fee_breakdown || branchCopy.cost_breakdown || [];
            }
        } else {
            branchCopy.fee_breakdown = branchCopy.fee_breakdown || branchCopy.cost_breakdown || [];
        }

        setEditingBranch(branchCopy);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Building className="text-emerald-600" /> Penetapan Kuota & Gelombang</h2>
                <Button variant="outline" onClick={handleGenerateDummy} className="text-xs border-dashed text-slate-500 hover:text-emerald-600">+ Load Dummy Data</Button>
            </div>

            <div className="flex gap-3 mb-6 overflow-x-auto pb-2 hide-scrollbar">
                <button
                    onClick={() => setActiveTab('branches')}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'branches'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-2 ring-emerald-600 ring-offset-2 ring-offset-slate-50'
                        : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                        }`}
                >
                    <Building size={16} /> Cabang Sekolah
                </button>
                <button
                    onClick={() => setActiveTab('waves')}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'waves'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-2 ring-emerald-600 ring-offset-2 ring-offset-slate-50'
                        : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                        }`}
                >
                    <Layers size={16} /> Gelombang
                </button>
                <button
                    onClick={() => setActiveTab('academic_years')}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'academic_years'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-2 ring-emerald-600 ring-offset-2 ring-offset-slate-50'
                        : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                        }`}
                >
                    <Calendar size={16} /> Tahun Akademik
                </button>
                <button
                    onClick={() => setActiveTab('indent_internal')}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'indent_internal'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-2 ring-emerald-600 ring-offset-2 ring-offset-slate-50'
                        : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                        }`}
                >
                    <CalendarClock size={16} /> Inden Internal
                </button>
            </div>

            {/* Indent Internal Tab */}
            {activeTab === 'indent_internal' && (
                <div className="animate-fade-in max-w-4xl">
                    <Card className="p-8 bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-4 mb-8 border-b border-slate-100 dark:border-slate-700 pb-6">
                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                                <CalendarClock size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Konfigurasi Inden Internal</h3>
                                <p className="text-slate-500 text-sm mt-1">Atur periode pendaftaran jalur pendaftaran ulang siswa lama (Internal).</p>
                            </div>
                        </div>

                        {/* Info Banner */}
                        <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 p-5 rounded-2xl mb-8 flex gap-4">
                            <Info size={20} className="text-sky-600 shrink-0 mt-0.5" />
                            <div className="text-sm text-sky-800 dark:text-sky-300 leading-relaxed">
                                Fitur ini digunakan untuk membuka pendaftaran khusus siswa internal (naik jenjang).
                                Siswa yang mendaftar melalui jalur ini akan <strong className="font-bold text-sky-700">melewati proses tes & wawancara</strong> dan langsung diarahkan untuk pembayaran daftar ulang.
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* Toggle Active */}
                            <div className="flex items-center justify-between p-6 border rounded-2xl bg-white dark:bg-slate-700/30 dark:border-slate-600 hover:border-emerald-300 transition-colors cursor-pointer shadow-sm group" onClick={() => setIndentInternal({ ...indentInternal, active: !indentInternal?.active })}>
                                <div className="flex-1">
                                    <span className="font-bold text-slate-800 dark:text-white text-lg block mb-1 group-hover:text-emerald-700 transition-colors">Status Pendaftaran Inden</span>
                                    <span className="block text-sm text-slate-500 dark:text-slate-400">Aktifkan switch ini agar menu inden muncul di dashboard siswa.</span>
                                </div>
                                <div className={`w-14 h-8 rounded-full relative transition-colors duration-300 ml-4 ${indentInternal?.active ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600'}`}>
                                    <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${indentInternal?.active ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                </div>
                            </div>

                            {/* Date Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Tanggal Mulai
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
                                        value={indentInternal?.start_date || ''}
                                        onChange={e => setIndentInternal({ ...indentInternal, start_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> Tanggal Selesai
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
                                        value={indentInternal?.end_date || ''}
                                        onChange={e => setIndentInternal({ ...indentInternal, end_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Academic Years Selection */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-2 mb-2">
                                    <Building size={18} className="text-slate-400" />
                                    <label className="text-base font-bold text-slate-800 dark:text-slate-200">Tahun Akademik Terkait (Wajib Dipilih)</label>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 pl-6">Pilih tahun akademik yang dibuka untuk pendaftaran inden ini (bisa lebih dari satu).</p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {academicYears.length === 0 && <span className="text-sm text-slate-400 italic col-span-full text-center py-4 bg-white rounded-lg border border-dashed">Tidak ada data tahun akademik.</span>}
                                    {academicYears.map(ay => {
                                        const isSelected = (indentInternal?.target_academic_years || []).includes(ay.year);
                                        return (
                                            <label key={ay.id} className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden group ${isSelected
                                                ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500 shadow-md shadow-emerald-100'
                                                : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm'
                                                }`}>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        const current = indentInternal?.target_academic_years || [];
                                                        let newSelection;
                                                        if (isSelected) {
                                                            newSelection = current.filter(y => y !== ay.year);
                                                        } else {
                                                            newSelection = [...current, ay.year];
                                                        }
                                                        setIndentInternal({ ...indentInternal, target_academic_years: newSelection });
                                                    }}
                                                />
                                                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected
                                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                                    : 'bg-white border-slate-300 group-hover:border-emerald-400'
                                                    }`}>
                                                    {isSelected && <CheckCircle size={14} strokeWidth={3} />}
                                                </div>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{ay.year}</span>
                                                {ay.is_default && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold ml-auto">Active</span>}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                                <Button onClick={handleSaveIndentInternal} className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-3 rounded-xl shadow-lg shadow-emerald-600/20 font-bold transition-transform hover:-translate-y-1 active:translate-y-0 flex items-center gap-2">
                                    <CheckCircle size={18} /> Simpan Konfigurasi
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* BRANCHES */}
            {activeTab === 'branches' && (
                <Card className="p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h3 className="font-bold text-xl text-slate-800">Cabang Sekolah & Kuota</h3>
                            <p className="text-slate-500 text-sm">Kelola cabang sekolah yang tersedia beserta kuotanya.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Academic Year Filter */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-bold text-slate-600">Tahun Akademik:</label>
                                <select
                                    value={selectedAcademicYear}
                                    onChange={(e) => setSelectedAcademicYear(e.target.value)}
                                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                >
                                    {academicYears.filter(ay => ay.is_active).map(ay => (
                                        <option key={ay.id} value={ay.id}>
                                            {ay.year} {ay.is_default ? '(Default)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <Button onClick={() => setEditingBranch({ name: '', level: 'SD', quota: 0, location: '', cost_reg: 0, cost_rereg: 0, open: true, info_text: '' })} className="shadow-lg shadow-emerald-200">
                                <Plus size={18} /> Tambah Cabang
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {branches.length === 0 && <div className="col-span-full text-center py-10 text-slate-400 italic bg-slate-50 rounded-xl border border-dashed">Belum ada data cabang sekolah.</div>}
                        {branches.map(u => {
                            const hasConfig = u.academic_configs && Object.keys(u.academic_configs).length > 0;
                            const config = u.academic_configs?.[selectedAcademicYear];

                            // Helper to determine value to show
                            // If specific config exists, use it.
                            // If not, but unit has OTHER configs (migrated), show 0 (meanining not set for this year).
                            // If no configs at all, fallback to global legacy value.
                            const showQuota = config ? config.quota : (hasConfig ? 0 : (u.quota ?? 0));
                            const showReg = config ? config.cost_reg : (hasConfig ? 0 : (u.cost_reg ?? 0));
                            const showRereg = config ? config.cost_rereg : (hasConfig ? 0 : (u.cost_rereg ?? 0));

                            return (
                                <div key={u.id} className="relative group p-5 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 transition-all hover:shadow-md">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-lg text-slate-800">{u.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${u.level === 'SD' ? 'bg-orange-100 text-orange-700' :
                                                    u.level === 'SMP' ? 'bg-blue-100 text-blue-700' :
                                                        u.level === 'SMA' ? 'bg-indigo-100 text-indigo-700' :
                                                            'bg-purple-100 text-purple-700'
                                                    }`}>{u.level}</span>
                                                {u.open === false ? (
                                                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">DITUTUP</span>
                                                ) : (
                                                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">DIBUKA</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEditBranch(u)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"><Building size={16} /></button>
                                            <button onClick={() => setDeleteTarget({ id: u.id, name: u.name })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={16} /></button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm mt-4 border-t pt-4">
                                        <div>
                                            <p className="text-slate-500 text-xs mb-0.5">Total Kuota</p>
                                            <p className={`font-bold text-base ${!config && hasConfig ? 'text-slate-300' : 'text-slate-700'}`}>
                                                {showQuota} <span className="text-xs font-normal text-slate-400">Siswa</span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs mb-0.5">Terisi</p>
                                            {/* Filled logic might also need AY filtering if we track filled per AY.
                                            Currently filled is global. Assuming filled is reset or managed per AY in future.
                                            For now, let's keep global filled or 0 if we assume new year is empty. 
                                            But 'filled' field IS currently global. 
                                            Ideally filled should be calculated from Registrations for that AY.
                                            But AdminSchoolSettings only reads 'units' collection.
                                            Let's leave filled as is for now, or hide it if we suspect it's wrong?
                                            User prompt strictly about "data yang sudah di simpan". Filled is calculated data.
                                        */}
                                            <p className="font-bold text-emerald-600 text-base">{u.filled || 0} <span className="text-xs font-normal text-slate-400">Siswa</span></p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs mb-0.5">Biaya Pendaftaran</p>
                                            <p className={`font-bold ${!config && hasConfig ? 'text-slate-300' : 'text-slate-700'}`}>
                                                Rp {showReg.toLocaleString()}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs mb-0.5">Daftar Ulang</p>
                                            <p className={`font-bold ${!config && hasConfig ? 'text-slate-300' : 'text-slate-700'}`}>
                                                Rp {showRereg.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    {u.info_text && <div className="mt-3 p-2 bg-slate-50 rounded text-xs text-slate-500 italic border border-slate-100 line-clamp-1">{u.info_text}</div>}
                                </div>
                            )
                        })}
                    </div>
                </Card>
            )}

            {/* WAVES */}
            {activeTab === 'waves' && (
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-xl text-slate-800">Gelombang Pendaftaran</h3>
                            <p className="text-slate-500 text-sm">Atur jadwal dan periode pendaftaran.</p>
                        </div>
                        <Button onClick={() => setEditingWave({ name: '', year: '2025/2026', active: true })} className="shadow-lg shadow-emerald-200">
                            <Plus size={18} /> Tambah Gelombang
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {waves.length === 0 && <div className="text-center py-10 text-slate-400 italic bg-slate-50 rounded-xl border border-dashed">Belum ada data gelombang.</div>}
                        {waves.map(w => (
                            <div key={w.id} className={`flex flex-col md:flex-row justify-between items-center p-4 border rounded-xl transition-all ${w.active ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-200'}`}>
                                <div className="flex items-center gap-4 mb-3 md:mb-0 w-full md:w-auto">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${w.active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {w.name.replace(/\D/g, '') || '#'}
                                    </div>
                                    <div>
                                        <div className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                            {w.name}
                                            {w.active && <span className="text-[10px] tracking-wider uppercase font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full shadow-emerald-200 shadow">Aktif</span>}
                                        </div>
                                        <div className="text-sm text-slate-500 font-medium">Tahun Ajaran {w.year}</div>
                                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                            <span className="bg-slate-100 px-2 py-0.5 rounded">{w.start_date || '-'}</span>
                                            <span>s/d</span>
                                            <span className="bg-slate-100 px-2 py-0.5 rounded">{w.end_date || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto justify-end">
                                    <Button variant="secondary" onClick={() => setEditingWave(w)} className="text-sm">Edit & Detail</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* ACADEMIC YEARS */}
            {activeTab === 'academic_years' && (
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex-1">
                            <h3 className="font-bold text-xl text-slate-800 dark:text-white">Pengaturan Draft PSB</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Kelola Tahun Akademik dan Status Pendaftaran per Cabang.</p>
                        </div>
                        <Button onClick={() => setEditingAcademicYear({ year: '2025/2026', unit_ids: [], is_active: false })} className="shadow-lg shadow-emerald-200">
                            <Plus size={18} /> Tambah Draft
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 font-bold uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg">No</th>
                                    <th className="px-4 py-3">Tahun Akademik</th>
                                    <th className="px-4 py-3">Cabang Sekolah</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Default</th>
                                    <th className="px-4 py-3">Indent</th>
                                    <th className="px-4 py-3 rounded-r-lg text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {academicYears.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="text-center py-8 text-slate-400 italic">Belum ada data tahun akademik.</td>
                                    </tr>
                                )}
                                {academicYears.map((item, idx) => (
                                    <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${item.is_default ? 'bg-emerald-50/50 dark:bg-emerald-900/20' : ''}`}>
                                        <td className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">{idx + 1}</td>
                                        <td className="px-4 py-3">
                                            <span className="font-bold text-slate-700 dark:text-white">{item.year}</span>
                                            {item.is_default && <span className="ml-2 text-[10px] bg-yellow-500 text-white px-2 py-0.5 rounded-full font-bold">DEFAULT</span>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={item.unit_names}>{item.unit_names || (item.unit_ids ? item.unit_ids.length + ' Cabang' : '-')}</td>

                                        {/* Status Column */}
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={async () => {
                                                    if (item.is_default && item.is_active) {
                                                        showToast('Tahun default tidak bisa dinonaktifkan.', 'error');
                                                        return;
                                                    }
                                                    await supabase.from('academic_years').update({ is_active: !item.is_active }).eq('id', item.id);
                                                    showToast(`Tahun ${item.year} ${!item.is_active ? 'diaktifkan' : 'dinonaktifkan'}`);
                                                    fetchAllData();
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${item.is_active
                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                            >
                                                {item.is_active ? 'Aktif' : 'Nonaktif'}
                                            </button>
                                        </td>

                                        <td className="px-4 py-3">
                                            <button
                                                onClick={async () => {
                                                    if (item.is_default) {
                                                        showToast('Tidak dapat menonaktifkan default. Pilih tahun lain sebagai default.', 'error');
                                                        return;
                                                    }
                                                    // Set all other academic years to is_default: false
                                                    const { error: resetError } = await supabase.from('academic_years').update({ is_default: false }).neq('id', item.id);
                                                    if (resetError) console.error(resetError);

                                                    // Set this one as default and also active
                                                    await supabase.from('academic_years').update({ is_default: true, is_active: true }).eq('id', item.id);
                                                    showToast(`${item.year} ditetapkan sebagai Tahun Akademik Default`);
                                                    fetchAllData();
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${item.is_default ? 'bg-yellow-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-yellow-100 hover:text-yellow-700'}`}
                                            >
                                                {item.is_default ? '★ Default' : 'Set Default'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col items-center gap-1">
                                                <button
                                                    onClick={async () => {
                                                        if (item.is_default && item.indent_enabled) {
                                                            showToast('Tahun akademik default tidak bisa menjadi indent.', 'error');
                                                            return;
                                                        }
                                                        await supabase.from('academic_years').update({ indent_enabled: !item.indent_enabled }).eq('id', item.id);
                                                        showToast(`Indent ${item.year} ${!item.indent_enabled ? 'diaktifkan' : 'dinonaktifkan'}`);
                                                        fetchAllData();
                                                    }}
                                                    disabled={item.is_default}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${item.is_default ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : (item.indent_enabled ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}`}
                                                >
                                                    {item.indent_enabled ? '📌 Aktif' : '− Nonaktif'}
                                                </button>
                                                {item.indent_enabled && item.indent_start_date && item.indent_end_date && (
                                                    <span className="text-[9px] text-purple-400 font-medium italic">
                                                        {new Date(item.indent_start_date).toLocaleDateString('id', { day: 'numeric', month: 'short' })} - {new Date(item.indent_end_date).toLocaleDateString('id', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setEditingAcademicYear(item)} className="px-3 py-1 bg-sky-100 text-sky-600 rounded hover:bg-sky-200 text-xs font-bold transition">Edit</button>
                                                <button
                                                    onClick={() => {
                                                        if (item.is_default) {
                                                            showToast('Tidak dapat menghapus tahun akademik default.', 'error');
                                                            return;
                                                        }
                                                        setDeleteAcademicYear({ id: item.id, year: item.year });
                                                    }}
                                                    disabled={item.is_default}
                                                    className={`px-3 py-1 rounded text-xs font-bold transition ${item.is_default ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                                                >
                                                    Hapus
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}



            {/* MODAL EDIT BRANCH */}
            <Modal isOpen={!!editingBranch} onClose={() => setEditingBranch(null)} title="Edit Cabang Sekolah" footer={<div className="flex justify-end gap-2 w-full"><Button variant="secondary" onClick={() => setEditingBranch(null)}>Batal</Button><Button onClick={handleSaveBranch}>Simpan Cabang</Button></div>}>
                {editingBranch && (
                    <div className="space-y-4">
                        <Input label="Nama Cabang" value={editingBranch.name} onChange={e => setEditingBranch({ ...editingBranch, name: e.target.value })} />
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-100 dark:border-yellow-900/30 mb-2">
                            <label className="block text-xs font-bold text-yellow-800 dark:text-yellow-400 mb-1">Tahun Akademik Aktif</label>
                            <select
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-yellow-200 dark:border-yellow-800 rounded text-sm outline-none focus:ring-2 focus:ring-yellow-500 text-slate-900 dark:text-white"
                                value={editingBranch.active_academic_year_id || ''}
                                onChange={e => {
                                    const newId = e.target.value;
                                    const oldId = editingBranch.active_academic_year_id;

                                    // 1. Save CURRENT state to the OLD ID config
                                    const updatedConfigs = { ...(editingBranch.academic_configs || {}) };
                                    if (oldId) {
                                        updatedConfigs[oldId] = {
                                            quota: editingBranch.quota || 0,
                                            cost_reg: editingBranch.cost_reg || 0,
                                            cost_rereg: editingBranch.cost_rereg || 0,
                                            majors: editingBranch.majors || [],
                                            fee_breakdown: editingBranch.fee_breakdown || []
                                        };
                                    }

                                    // 2. Load NEW state from the NEW ID config (or keep current values as base if new)
                                    let newValues = {};
                                    if (newId && updatedConfigs[newId]) {
                                        const config = updatedConfigs[newId];
                                        const breakdown = config.fee_breakdown || config.cost_breakdown || [];
                                        newValues = {
                                            quota: config.quota,
                                            cost_reg: config.cost_reg,
                                            cost_rereg: config.cost_rereg,
                                            majors: config.majors,
                                            fee_breakdown: breakdown
                                        };
                                    } else {
                                        // Keep current values as base for new config
                                        const breakdown = editingBranch.fee_breakdown || editingBranch.cost_breakdown || [];
                                        newValues = {
                                            quota: editingBranch.quota || 0,
                                            cost_reg: editingBranch.cost_reg || 0,
                                            cost_rereg: editingBranch.cost_rereg || 0,
                                            majors: editingBranch.majors || [],
                                            fee_breakdown: breakdown
                                        };
                                    }

                                    setEditingBranch({
                                        ...editingBranch,
                                        active_academic_year_id: newId,
                                        academic_configs: updatedConfigs,
                                        ...newValues
                                    });
                                }}
                            >
                                <option value="">-- Pilih Tahun Akademik --</option>
                                {academicYears.map(a => (
                                    <option key={a.id} value={a.id}>{a.year}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-yellow-700 mt-1">Pilih konfigurasi tahun akademik yang berlaku saat ini.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Select label="Jenjang" value={editingBranch.level} onChange={e => setEditingBranch({ ...editingBranch, level: e.target.value })} options={[{ value: 'TK' }, { value: 'SD' }, { value: 'SMP' }, { value: 'SMA' }, { value: 'SMK' }]} />
                            <Input
                                label="Total Kuota"
                                type="number"
                                value={
                                    editingBranch.level === 'SMK'
                                        ? (editingBranch.majors || []).reduce((a, b) => a + (b.quota || 0), 0)
                                        : (editingBranch.academic_configs?.[editingBranch.active_academic_year_id]?.quota ?? editingBranch.quota ?? 0)
                                }
                                onChange={e => {
                                    const newQuota = parseInt(e.target.value) || 0;
                                    if (editingBranch.level !== 'SMK') {
                                        // Save to academic_configs for the selected year
                                        const configs = { ...(editingBranch.academic_configs || {}) };
                                        if (editingBranch.active_academic_year_id) {
                                            configs[editingBranch.active_academic_year_id] = {
                                                ...(configs[editingBranch.active_academic_year_id] || {}),
                                                quota: newQuota
                                            };
                                        }
                                        setEditingBranch({
                                            ...editingBranch,
                                            quota: newQuota, // Keep for backward compatibility
                                            academic_configs: configs
                                        });
                                    }
                                }}
                                disabled={editingBranch.level === 'SMK'}
                                className={editingBranch.level === 'SMK' ? "bg-slate-100/50 cursor-not-allowed text-slate-500" : ""}
                            />
                        </div>
                        <Input label="Lokasi Gedung" value={editingBranch.location} onChange={e => setEditingBranch({ ...editingBranch, location: e.target.value })} />

                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Biaya Pendaftaran (Rp)" type="number" value={editingBranch.cost_reg} onChange={e => setEditingBranch({ ...editingBranch, cost_reg: parseInt(e.target.value) || 0 })} placeholder="0" />
                            <Input label="Biaya Daftar Ulang (Rp)" type="number" value={editingBranch.cost_rereg} onChange={e => setEditingBranch({ ...editingBranch, cost_rereg: parseInt(e.target.value) || 0 })} placeholder="0" />
                        </div>

                        {/* Fee Breakdown Section */}
                        {/* Fee Breakdown Section */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-900/30">
                            <label className="block text-sm font-bold text-blue-800 dark:text-blue-300 mb-3 flex justify-between items-center">
                                <span>Rincian Biaya (DSP/Daftar Ulang)</span>
                                <span className="text-[10px] font-normal text-blue-600 bg-white px-2 py-0.5 rounded border border-blue-200">Tampil di Website</span>
                            </label>

                            <div className="space-y-2 mb-4">
                                {(!editingBranch.fee_breakdown || editingBranch.fee_breakdown.length === 0) && (
                                    <div className="text-center py-4 bg-white rounded-lg border border-dashed border-blue-200 text-blue-400 text-xs italic">
                                        Belum ada rincian biaya. Tambahkan item biaya di bawah.
                                    </div>
                                )}
                                {(editingBranch.fee_breakdown || []).map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-blue-100 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-600 transition-colors shadow-sm">
                                        <div className="flex-1">
                                            <p className="text-[10px] text-blue-400 font-bold uppercase mb-0.5 ml-1">Nama Item</p>
                                            <input
                                                className="w-full text-sm font-medium text-slate-700 dark:text-slate-200 border-none outline-none focus:ring-0 p-0 px-1 bg-transparent placeholder-slate-300 dark:placeholder-slate-600"
                                                value={item.label}
                                                placeholder="Contoh: Uang Pangkal"
                                                onChange={e => {
                                                    const newItems = [...editingBranch.fee_breakdown];
                                                    newItems[idx].label = e.target.value;
                                                    setEditingBranch({ ...editingBranch, fee_breakdown: newItems });
                                                }}
                                            />
                                        </div>
                                        <div className="w-px h-8 bg-blue-100 mx-1"></div>
                                        <div className="w-32">
                                            <p className="text-[10px] text-blue-400 font-bold uppercase mb-0.5 text-right mr-1">Nominal (Rp)</p>
                                            <input
                                                type="number"
                                                className="w-full text-sm font-bold text-blue-600 dark:text-blue-400 border-none outline-none focus:ring-0 p-0 px-1 bg-transparent text-right"
                                                value={item.amount}
                                                onChange={e => {
                                                    const newItems = [...editingBranch.fee_breakdown];
                                                    newItems[idx].amount = parseInt(e.target.value) || 0;
                                                    const newTotal = newItems.reduce((sum, item) => sum + (item.amount || 0), 0);
                                                    setEditingBranch({ ...editingBranch, fee_breakdown: newItems, cost_rereg: newTotal });
                                                }}
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                const newItems = editingBranch.fee_breakdown.filter((_, i) => i !== idx);
                                                const newTotal = newItems.reduce((sum, item) => sum + (item.amount || 0), 0);
                                                setEditingBranch({ ...editingBranch, fee_breakdown: newItems, cost_rereg: newTotal });
                                            }}
                                            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all ml-1"
                                            title="Hapus Item"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Total */}
                            {editingBranch.fee_breakdown && editingBranch.fee_breakdown.length > 0 && (
                                <div className="flex justify-between items-center bg-blue-100 dark:bg-blue-900/40 p-3 rounded-lg mb-4">
                                    <span className="font-bold text-blue-800 dark:text-blue-300">Total Rincian</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-300 text-lg">
                                        Rp {(editingBranch.fee_breakdown || []).reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString()}
                                    </span>
                                </div>
                            )}

                            {/* Add new item */}
                            <div className="flex gap-2 items-end bg-white dark:bg-slate-800 p-2 rounded-lg border border-blue-100 dark:border-blue-800">
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase font-bold text-blue-500 mb-1 block">Tambah Rincian Baru</label>
                                    <input id="newFeeLabel" className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-700 rounded bg-blue-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-600 focus:border-blue-500 outline-none transition-colors" placeholder="Contoh: Seragam (5 Setel)" />
                                </div>
                                <div className="w-32">
                                    <label className="text-[10px] uppercase font-bold text-blue-500 mb-1 block">Nominal</label>
                                    <input id="newFeeAmount" type="number" className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-700 rounded bg-blue-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-600 focus:border-blue-500 outline-none transition-colors" placeholder="0" />
                                </div>
                                <Button onClick={() => {
                                    const labelEl = document.getElementById('newFeeLabel');
                                    const amountEl = document.getElementById('newFeeAmount');
                                    if (labelEl.value) {
                                        const newItems = [...(editingBranch.fee_breakdown || []), { label: labelEl.value, amount: parseInt(amountEl.value) || 0 }];
                                        const newTotal = newItems.reduce((sum, item) => sum + (item.amount || 0), 0);
                                        setEditingBranch({ ...editingBranch, fee_breakdown: newItems, cost_rereg: newTotal });
                                        labelEl.value = ''; amountEl.value = '';
                                    }
                                }} className="h-[38px] w-[38px] p-0 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white"><Plus size={20} /></Button>
                            </div>
                            <p className="text-[10px] text-blue-500 mt-2 italic">Rincian ini akan ditampilkan di halaman website bagian "Biaya Pendidikan".</p>
                        </div>

                        {/* SPP Bulanan Section */}
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
                            <label className="block text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-3 flex justify-between items-center">
                                <span>SPP Bulanan</span>
                                <span className="text-[10px] font-normal text-emerald-600 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-700">Biaya Rutin</span>
                            </label>

                            {/* SPP Amount */}
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Nominal SPP / Bulan (Rp)</label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-bold text-emerald-700 dark:text-emerald-400"
                                    placeholder="0"
                                    value={editingBranch.cost_spp || ''}
                                    onChange={e => setEditingBranch({ ...editingBranch, cost_spp: parseInt(e.target.value) || 0 })}
                                />
                            </div>

                            {/* SPP Includes */}
                            <div className="space-y-2 mb-4">
                                <label className="block text-xs font-bold text-emerald-600 uppercase">Termasuk dalam SPP:</label>
                                {(!editingBranch.spp_includes || editingBranch.spp_includes.length === 0) && (
                                    <div className="text-center py-3 bg-white dark:bg-slate-800 rounded-lg border border-dashed border-emerald-200 dark:border-emerald-700 text-emerald-400 text-xs italic">
                                        Belum ada item. Tambahkan fasilitas yang termasuk SPP.
                                    </div>
                                )}
                                {(editingBranch.spp_includes || []).map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-emerald-100 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors">
                                        <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                                        <input
                                            className="flex-1 text-sm text-slate-700 dark:text-slate-200 border-none outline-none focus:ring-0 p-0 px-1 bg-transparent placeholder-slate-300 dark:placeholder-slate-500"
                                            value={item}
                                            placeholder="Contoh: Akses Full Fasilitas"
                                            onChange={e => {
                                                const newItems = [...editingBranch.spp_includes];
                                                newItems[idx] = e.target.value;
                                                setEditingBranch({ ...editingBranch, spp_includes: newItems });
                                            }}
                                        />
                                        <button
                                            onClick={() => {
                                                const newItems = editingBranch.spp_includes.filter((_, i) => i !== idx);
                                                setEditingBranch({ ...editingBranch, spp_includes: newItems });
                                            }}
                                            className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            title="Hapus Item"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Add new SPP item */}
                            <div className="flex gap-2 items-end bg-white dark:bg-slate-800 p-2 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase font-bold text-emerald-500 mb-1 block">Tambah Item SPP</label>
                                    <input id="newSppItem" className="w-full px-3 py-2 text-sm border border-emerald-200 dark:border-emerald-700 rounded bg-emerald-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-600 focus:border-emerald-500 outline-none transition-colors" placeholder="Contoh: Ekstrakurikuler Wajib" />
                                </div>
                                <Button onClick={() => {
                                    const itemEl = document.getElementById('newSppItem');
                                    if (itemEl.value) {
                                        const newItems = [...(editingBranch.spp_includes || []), itemEl.value];
                                        setEditingBranch({ ...editingBranch, spp_includes: newItems });
                                        itemEl.value = '';
                                    }
                                }} className="h-[38px] w-[38px] p-0 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white"><Plus size={20} /></Button>
                            </div>
                        </div>

                        {editingBranch.level === 'SMK' && (
                            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <label className="block text-sm font-bold text-slate-800 dark:text-white mb-3 flex justify-between items-center">
                                    <span>Konfigurasi Jurusan & Kuota</span>
                                    <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">Khusus SMK</span>
                                </label>

                                <div className="space-y-2 mb-4">
                                    {(!editingBranch.majors || editingBranch.majors.length === 0) && (
                                        <div className="text-center py-4 bg-white dark:bg-slate-800 rounded-lg border border-dashed text-slate-400 text-xs italic">
                                            Belum ada jurusan ditambahkan.
                                        </div>
                                    )}
                                    {(editingBranch.majors || []).map((m, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors shadow-sm">
                                            <div className="flex-1">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5 ml-1">Nama Jurusan</p>
                                                <input
                                                    className="w-full text-sm font-bold text-slate-700 dark:text-slate-200 border-none outline-none focus:ring-0 p-0 px-1 bg-transparent placeholder-slate-300 dark:placeholder-slate-600"
                                                    value={m.name}
                                                    placeholder="Nama Jurusan"
                                                    onChange={e => {
                                                        const newMajors = [...editingBranch.majors];
                                                        newMajors[idx].name = e.target.value;
                                                        setEditingBranch({ ...editingBranch, majors: newMajors });
                                                    }}
                                                />
                                            </div>
                                            <div className="w-px h-8 bg-slate-100 dark:bg-slate-700 mx-1"></div>
                                            <div className="w-20">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5 text-right mr-1">Kuota</p>
                                                <input
                                                    type="number"
                                                    className="w-full text-sm font-bold text-emerald-600 dark:text-emerald-400 border-none outline-none focus:ring-0 p-0 px-1 bg-transparent text-right"
                                                    value={m.quota}
                                                    onChange={e => {
                                                        const newMajors = [...editingBranch.majors];
                                                        newMajors[idx].quota = parseInt(e.target.value) || 0;

                                                        // Recalculate Total Quota
                                                        const newTotal = newMajors.reduce((acc, curr) => acc + (curr.quota || 0), 0);

                                                        setEditingBranch({ ...editingBranch, majors: newMajors, quota: newTotal });
                                                    }}
                                                />
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const newMajors = editingBranch.majors.filter((_, i) => i !== idx);

                                                    // Recalculate Total Quota
                                                    const newTotal = newMajors.reduce((acc, curr) => acc + (curr.quota || 0), 0);

                                                    setEditingBranch({ ...editingBranch, majors: newMajors, quota: newTotal });
                                                }}
                                                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all ml-1"
                                                title="Hapus Jurusan"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2 items-end bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div className="flex-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Tambah Jurusan Baru</label>
                                        <input id="newMajorName" className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-600 focus:border-emerald-500 outline-none transition-colors" placeholder="Contoh: Teknik Komputer Jaringan" />
                                    </div>
                                    <div className="w-24">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Kuota</label>
                                        <input id="newMajorQuota" type="number" className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-600 focus:border-emerald-500 outline-none transition-colors" placeholder="0" />
                                    </div>
                                    <Button onClick={() => {
                                        const nameEl = document.getElementById('newMajorName');
                                        const quotaEl = document.getElementById('newMajorQuota');
                                        if (nameEl.value && quotaEl.value) {
                                            const newMajors = [...(editingBranch.majors || []), { name: nameEl.value, quota: parseInt(quotaEl.value), filled: 0 }];

                                            // Recalculate Total Quota
                                            const newTotal = newMajors.reduce((acc, curr) => acc + (curr.quota || 0), 0);

                                            setEditingBranch({ ...editingBranch, majors: newMajors, quota: newTotal });
                                            nameEl.value = ''; quotaEl.value = '';
                                        }
                                    }} className="h-[38px] w-[38px] p-0 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"><Plus size={20} /></Button>
                                </div>
                            </div>
                        )}

                        <div className="border-t dark:border-slate-700 pt-2 mt-2">
                            <div className="flex items-center gap-2 mb-2">
                                <input id="chkOpen" type="checkbox" checked={editingBranch.open !== false} onChange={e => setEditingBranch({ ...editingBranch, open: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-700" />
                                <label htmlFor="chkOpen" className="text-sm font-bold text-slate-700 dark:text-slate-300 select-none">Buka Pendaftaran untuk Cabang Ini</label>
                            </div>
                            <div className="mb-2">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Catatan Informasi (Opsional)</label>
                                <textarea rows={2} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="Contoh: Khusus pendaftar putri asrama penuh." value={editingBranch.info_text || ''} onChange={e => setEditingBranch({ ...editingBranch, info_text: e.target.value })} />
                            </div>
                        </div>
                    </div>
                )}
            </Modal >

            {/* MODAL EDIT WAVE */}
            < Modal isOpen={!!editingWave} onClose={() => setEditingWave(null)} title="Edit Gelombang" footer={< div className="flex justify-end gap-2 w-full" ><Button variant="secondary" onClick={() => setEditingWave(null)}>Batal</Button><Button onClick={handleSaveWave}>Simpan Gelombang</Button></div >}>
                {editingWave && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Nama Gelombang" value={editingWave.name} onChange={e => setEditingWave({ ...editingWave, name: e.target.value })} />
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Tahun Ajaran</label>
                                <select
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm bg-white"
                                    value={editingWave.year}
                                    onChange={e => setEditingWave({ ...editingWave, year: e.target.value })}
                                >
                                    <option value="">-- Pilih Tahun --</option>
                                    {[...new Set(academicYears.map(a => a.year))].sort().map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Tanggal Mulai" type="date" value={editingWave.start_date} onChange={e => setEditingWave({ ...editingWave, start_date: e.target.value })} />
                            <Input label="Tanggal Selesai" type="date" value={editingWave.end_date} onChange={e => setEditingWave({ ...editingWave, end_date: e.target.value })} />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <input type="checkbox" checked={editingWave.active} onChange={e => setEditingWave({ ...editingWave, active: e.target.checked })} />
                            <label className="text-sm font-bold">Set Aktif</label>
                        </div>
                    </div>
                )}
            </Modal >

            {/* MODAL EDIT ACADEMIC YEAR */}
            <Modal isOpen={!!editingAcademicYear} onClose={() => setEditingAcademicYear(null)} title="Edit Draft PSB" footer={<div className="flex justify-end gap-2 w-full"><Button variant="secondary" onClick={() => setEditingAcademicYear(null)}>Batal</Button><Button onClick={handleSaveAcademicYear}>Simpan Draft</Button></div>}>
                {editingAcademicYear && (
                    <div className="space-y-4">
                        <Input label="Tahun Akademik" placeholder="Contoh: 2025/2026" value={editingAcademicYear.year} onChange={e => setEditingAcademicYear({ ...editingAcademicYear, year: e.target.value })} />

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih Cabang Sekolah</label>
                            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto border border-slate-200 p-3 rounded-lg bg-slate-50">
                                {branches.map(u => {
                                    const isSelected = (editingAcademicYear.unit_ids || []).includes(u.id);
                                    return (
                                        <label key={u.id} className="flex items-center gap-3 p-2 bg-white border border-slate-100 rounded cursor-pointer hover:border-emerald-200 transition-colors">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                                checked={isSelected}
                                                onChange={e => {
                                                    const currentIds = editingAcademicYear.unit_ids || [];
                                                    let newIds;
                                                    if (e.target.checked) {
                                                        newIds = [...currentIds, u.id];
                                                    } else {
                                                        newIds = currentIds.filter(id => id !== u.id);
                                                    }

                                                    // Update names too for quick display
                                                    const selectedBranches = branches.filter(branch => newIds.includes(branch.id));
                                                    const names = selectedBranches.map(branch => branch.name).join(', ');

                                                    setEditingAcademicYear({
                                                        ...editingAcademicYear,
                                                        unit_ids: newIds,
                                                        unit_names: names
                                                    });
                                                }}
                                            />
                                            <span className={`text-sm ${isSelected ? 'font-bold text-emerald-700' : 'text-slate-600'}`}>{u.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 italic">Pilih satu atau lebih cabang untuk menerapkan konfigurasi ini.</p>
                        </div>

                        <div className="flex items-center gap-2 mt-2 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                            <input
                                type="checkbox"
                                id="acDefault"
                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                checked={editingAcademicYear.is_default || false}
                                onChange={e => setEditingAcademicYear({ ...editingAcademicYear, is_default: e.target.checked, is_active: e.target.checked ? true : editingAcademicYear.is_active })}
                            />
                            <label htmlFor="acDefault" className="text-sm font-bold text-slate-700 select-none cursor-pointer flex-1">
                                <span className="flex items-center gap-2">
                                    ★ Set sebagai Tahun Akademik Default
                                    {editingAcademicYear.is_default && <span className="text-emerald-600 text-xs bg-emerald-100 px-2 py-0.5 rounded-full">AKTIF</span>}
                                </span>
                                <span className="text-xs text-slate-500 font-normal block mt-1">Tahun akademik default adalah tahun yang sedang berjalan untuk pendaftaran reguler.</span>
                            </label>
                        </div>

                        <div className={`flex flex-col gap-3 mt-2 p-3 rounded-lg border ${editingAcademicYear.is_default ? 'bg-slate-50 border-slate-200 opacity-50' : 'bg-purple-50 border-purple-200'}`}>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="acIndent"
                                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                    checked={editingAcademicYear.indent_enabled || false}
                                    disabled={editingAcademicYear.is_default}
                                    onChange={e => setEditingAcademicYear({ ...editingAcademicYear, indent_enabled: e.target.checked })}
                                />
                                <label htmlFor="acIndent" className="text-sm font-bold text-slate-700 select-none cursor-pointer flex-1">
                                    <span className="flex items-center gap-2">
                                        📌 Buka Pendaftaran Indent
                                        {editingAcademicYear.indent_enabled && !editingAcademicYear.is_default && <span className="text-purple-600 text-xs bg-purple-100 px-2 py-0.5 rounded-full">AKTIF</span>}
                                    </span>
                                    <span className="text-xs text-slate-500 font-normal block mt-1">
                                        {editingAcademicYear.is_default ? 'Tidak dapat mengaktifkan indent untuk tahun akademik default.' : 'Aktifkan untuk membuka pendaftaran dini (booking) tahun ajaran ini.'}
                                    </span>
                                </label>
                            </div>

                            {editingAcademicYear.indent_enabled && !editingAcademicYear.is_default && (
                                <div className="grid grid-cols-2 gap-4 mt-2 pt-3 border-t border-purple-100 animate-slide-down">
                                    <div>
                                        <label className="block text-[10px] font-bold text-purple-600 uppercase mb-1">Mulai Indent</label>
                                        <input
                                            type="date"
                                            className="w-full px-3 py-1.5 text-xs border border-purple-200 rounded-md focus:ring-1 focus:ring-purple-500 outline-none"
                                            value={editingAcademicYear.indent_start_date || ''}
                                            onChange={e => setEditingAcademicYear({ ...editingAcademicYear, indent_start_date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-purple-600 uppercase mb-1">Selesai Indent</label>
                                        <input
                                            type="date"
                                            className="w-full px-3 py-1.5 text-xs border border-purple-200 rounded-md focus:ring-1 focus:ring-purple-500 outline-none"
                                            value={editingAcademicYear.indent_end_date || ''}
                                            onChange={e => setEditingAcademicYear({ ...editingAcademicYear, indent_end_date: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
            {/* DELETE CONFIRMATION MODAL */}
            < Modal isOpen={!!deleteTarget} onClose={() => { setDeleteTarget(null); setDeletePassword(''); }} title="Konfirmasi Hapus Cabang" footer={< div className="flex justify-end gap-2 w-full" ><Button variant="secondary" onClick={() => { setDeleteTarget(null); setDeletePassword(''); }}>Batal</Button><Button variant="danger" onClick={handleConfirmDelete} disabled={isDeleting}>{isDeleting ? 'Memproses...' : 'Hapus Permanen'}</Button></div >}>
                <div className="space-y-4">
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-start gap-3">
                        <Trash2 className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Anda yakin ingin menghapus cabang ini?</p>
                            <p className="text-sm mt-1">Data yang dihapus tidak dapat dikembalikan. Kuota dan Siswa yang terdaftar di cabang ini mungkin akan terpengaruh.</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Password Admin</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="password"
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                placeholder="Masukkan Password Admin untuk konfirmasi"
                                value={deletePassword}
                                onChange={e => setDeletePassword(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </Modal >

            {/* DELETE ACADEMIC YEAR CONFIRMATION MODAL */}
            <DeleteConfirmModal
                isOpen={!!deleteAcademicYear}
                onClose={() => setDeleteAcademicYear(null)}
                onConfirm={async () => {
                    const { error } = await supabase.from('academic_years').delete().eq('id', deleteAcademicYear.id);
                    if (error) {
                        showToast(error.message, 'error');
                        return;
                    }
                    showToast('Tahun Akademik berhasil dihapus');
                    setDeleteAcademicYear(null);
                    fetchAllData();
                }}
                itemName={deleteAcademicYear?.year}
                itemType="Tahun Akademik"
                showToast={showToast}
            />
        </div >
    );
}
