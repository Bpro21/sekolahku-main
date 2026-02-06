import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import {
    TrendingUp, Users, DollarSign, PieChart, Plus, Trash2, Edit2, Save, X,
    ChevronDown, ChevronUp, AlertCircle, Target, Briefcase, Calendar, CalendarClock, CheckCircle
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';

export default function AdminMarketingTools({ showToast }) {
    const [stats, setStats] = useState({
        totalRevenue: 0,
        paidRegistrants: 0,
        totalRAB: 0,
        netProfit: 0
    });
    const [rabItems, setRabItems] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('all'); // 'all' or specific academic_year_id

    const [rawInvoices, setRawInvoices] = useState([]);
    const [regMap, setRegMap] = useState({}); // { registration_id: academic_year_id }

    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [itemForm, setItemForm] = useState({ name: '', amount: '', category: 'Iklan', notes: '', academic_year_id: '' });
    const [editingId, setEditingId] = useState(null);

    // Helper to normalize year string for matching
    const normalize = (s) => s ? s.toString().replace(/\s+/g, '').trim() : '';

    const fetchData = async () => {
        try {
            setLoading(true);

            const [
                { data: periods },
                { data: regs },
                { data: invs },
                { data: rab }
            ] = await Promise.all([
                supabase.from('academic_years').select('*'),
                supabase.from('registrations').select('id, academic_year, academic_year_id'),
                supabase.from('invoices').select('*'),
                supabase.from('marketing_rab').select('*').order('created_at', { ascending: false })
            ]);

            if (periods) setAcademicYears(periods);

            // Create helper map from fetched periods
            const yearStringToId = {};
            (periods || []).forEach(y => {
                if (y.year) yearStringToId[normalize(y.year)] = y.id;
            });

            // Set default to active year
            // Note: Keep user selection if already set and not 'all', otherwise default to active
            if (selectedYear === 'all' && periods) {
                const activeStart = periods.find(y => y.is_active);
                if (activeStart) setSelectedYear(activeStart.id);
            }

            // Map registrations
            const mapping = {};
            (regs || []).forEach((d) => {
                let ayId = d.academic_year_id;
                if (!ayId && d.academic_year) {
                    ayId = yearStringToId[normalize(d.academic_year)];
                }
                if (ayId) mapping[d.id] = ayId;
            });
            setRegMap(mapping);

            setRawInvoices(invs || []);
            setRabItems(rab || []);

            setLoading(false);
        } catch (err) {
            console.error("Error fetching marketing data:", err);
            if (showToast) showToast("Gagal memuat data marketing", "error");
            setLoading(false);
        }
    };

    // Fetch Initial Data
    useEffect(() => {
        fetchData();

        // Subscribe to changes
        const channel = supabase.channel('admin_marketing_tools')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_rab' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, fetchData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Recalculate Stats when Filter or Data Changes
    useEffect(() => {
        if (loading) return;

        // 1. Filter Invoices
        const filteredInvoices = rawInvoices.filter(inv => {
            if (inv.status !== 'paid') return false;
            // Get Academic Year of this invoice's registration
            const ayId = regMap[inv.registration_id];
            // If selectedYear is 'all', allow all. Else, match IDs.
            if (selectedYear === 'all') return true;
            return ayId === selectedYear;
        });

        // 2. Calculate Revenue
        const totalRev = filteredInvoices.reduce((acc, curr) => acc + (parseInt(curr.amount) || 0), 0);
        const uniquePaidRegs = new Set(filteredInvoices.map(inv => inv.registration_id)).size;

        // 3. Filter RAB
        const filteredRABItems = rabItems.filter(item => {
            if (selectedYear === 'all') return true;
            return item.academic_year_id === selectedYear;
        });
        const totalCost = filteredRABItems.reduce((acc, curr) => acc + (parseInt(curr.amount) || 0), 0);

        setStats({
            totalRevenue: totalRev,
            paidRegistrants: uniquePaidRegs,
            totalRAB: totalCost,
            netProfit: totalRev - totalCost
        });

    }, [selectedYear, rawInvoices, rabItems, regMap, loading]);


    const handleSaveRAB = async (e) => {
        e.preventDefault();
        if (!itemForm.name || !itemForm.amount) return;

        try {
            const amount = parseInt(itemForm.amount.replace(/\D/g, ''));
            const data = {
                name: itemForm.name,
                amount: amount,
                category: itemForm.category,
                notes: itemForm.notes || '-',
                academic_year_id: itemForm.academic_year_id || selectedYear || null, // Create data linked to current selection
                updated_at: new Date().toISOString()
            };

            if (editingId) {
                const { error } = await supabase.from('marketing_rab').update(data).eq('id', editingId);
                if (error) throw error;
                if (showToast) showToast('RAB berhasil diperbarui', 'success');
            } else {
                data.created_at = new Date().toISOString();
                const { error } = await supabase.from('marketing_rab').insert(data);
                if (error) throw error;
                if (showToast) showToast('Item RAB berhasil ditambahkan', 'success');
            }

            setIsFormOpen(false);
            setEditingId(null);
            fetchData();
        } catch (error) {
            console.error("Error saving RAB:", error);
            if (showToast) showToast('Gagal menyimpan data', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus item ini?')) return;
        try {
            const { error } = await supabase.from('marketing_rab').delete().eq('id', id);
            if (error) throw error;
            if (showToast) showToast('Item dihapus', 'success');
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleEdit = (item) => {
        setItemForm({
            name: item.name,
            amount: item.amount.toString(),
            category: item.category,
            notes: item.notes,
            academic_year_id: item.academic_year_id || ''
        });
        setEditingId(item.id);
        setIsFormOpen(true);
    };

    // Calculate Summary per Academic Year
    const yearSummary = useMemo(() => {
        const summary = {};

        // Initialize with default values for all known years
        academicYears.forEach(ay => {
            summary[ay.id] = {
                id: ay.id,
                year: ay.year,
                active: ay.is_active,
                totalRegs: 0,
                paidRegs: 0,
                revenue: 0,
                rab: 0
            };
        });

        // 1. Count Total Registrants (Leads)
        // regMap contains all registrations: { registration_id: academic_year_id }
        Object.values(regMap).forEach(ayId => {
            if (summary[ayId]) summary[ayId].totalRegs += 1;
        });

        // 2. Count Revenue & Paid Unique Registrants
        const processedPaidRegs = new Set(); // To avoid double counting paid regs if multiple invoices

        rawInvoices.forEach(inv => {
            if (inv.status === 'paid') {
                const ayId = regMap[inv.registration_id];
                if (summary[ayId]) {
                    summary[ayId].revenue += (parseInt(inv.amount) || 0);
                    processedPaidRegs.add(inv.registration_id);
                }
            }
        });

        // Map processed paid regs back to their year to count 'paidRegs'
        processedPaidRegs.forEach(regId => {
            const ayId = regMap[regId];
            if (summary[ayId]) summary[ayId].paidRegs += 1;
        });

        // 3. Sum RAB
        rabItems.forEach(item => {
            if (item.academic_year_id && summary[item.academic_year_id]) {
                summary[item.academic_year_id].rab += (parseInt(item.amount) || 0);
            }
        });

        // Return array sorted by year descending
        return Object.values(summary).sort((a, b) => b.year.localeCompare(a.year));
    }, [academicYears, regMap, rawInvoices, rabItems]);

    // Chart Data Preparation
    const chartData = useMemo(() => {
        return [
            { name: 'Pendapatan', value: stats.totalRevenue, fill: '#10b981' },
            { name: 'Pengeluaran (RAB)', value: stats.totalRAB, fill: '#ef4444' },
            { name: 'Profit Bersih', value: stats.netProfit, fill: '#3b82f6' }
        ];
    }, [stats]);

    if (loading) return <div className="p-8 text-center text-slate-500">Memuat Analisa Marketing...</div>;

    // Get Active Year Label
    const selectedYearLabel = selectedYear === 'all' ? 'Semua Tahun' : academicYears.find(y => y.id === selectedYear)?.year || 'Tahun Tidak Dikenal';

    return (
        <div className="space-y-8 animate-fade-in text-slate-800 dark:text-white">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none text-white">
                            <Target size={24} />
                        </div>
                        Marketing & Finance
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm">
                        Monitor performa pendaftaran, analisa ROI marketing, dan kelola anggaran.
                    </p>
                </div>

                {/* Year Filter */}
                <div className="w-full md:w-64">
                    <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600">
                            <Calendar size={18} />
                        </div>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none w-full cursor-pointer p-1"
                        >
                            <option value="all" className="dark:bg-slate-800">Semua Tahun Akademik</option>
                            {academicYears.map(ay => (
                                <option key={ay.id} value={ay.id} className="dark:bg-slate-800">{ay.year} {ay.is_active ? '★' : ''}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 1. Paid Registrants */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-800 transition-all group">
                    <div className="flex justify-between items-start mb-3">
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <Users size={22} />
                        </div>
                        <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-full">
                            Lead Konversi
                        </span>
                    </div>
                    <div>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white mb-0.5">{stats.paidRegistrants}</h3>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pendaftar Membayar</p>
                    </div>
                </div>

                {/* 2. Total Revenue */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl shadow-lg shadow-emerald-200/50 dark:shadow-none text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                        <DollarSign size={80} />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <TrendingUp size={18} className="text-white" />
                            </div>
                            <span className="text-emerald-100 font-bold text-xs uppercase tracking-wider">Total Revenue</span>
                        </div>
                        <div>
                            <h3 className="text-3xl font-bold tracking-tight mb-0.5">
                                {(stats.totalRevenue / 1000000).toFixed(1)} <span className="text-lg font-medium text-emerald-100">Juta</span>
                            </h3>
                            <p className="text-xs text-emerald-100 opacity-80 font-mono">Rp {stats.totalRevenue.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* 3. Total RAB */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-red-200 dark:hover:border-red-800 transition-all group">
                    <div className="flex justify-between items-start mb-3">
                        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl group-hover:bg-red-500 group-hover:text-white transition-colors">
                            <PieChart size={22} />
                        </div>
                        <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-1 rounded-full">
                            Budget Used
                        </span>
                    </div>
                    <div>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white mb-0.5">
                            {(stats.totalRAB / 1000000).toFixed(1)} <span className="text-lg font-medium text-slate-400">Juta</span>
                        </h3>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Pengeluaran (RAB)</p>
                    </div>
                </div>

                {/* 4. Net Profit */}
                <div className={`p-5 rounded-2xl shadow-sm border flex flex-col justify-between relative overflow-hidden hover:shadow-lg transition-all ${stats.netProfit >= 0
                    ? 'bg-white dark:bg-slate-800 border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-300'
                    : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900'
                    }`}>
                    <div className="flex justify-between items-start mb-3">
                        <div className={`p-2.5 rounded-xl transition-colors ${stats.netProfit >= 0
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                            : 'bg-red-100 dark:bg-red-800 text-red-600'
                            }`}>
                            <Briefcase size={22} />
                        </div>
                        {stats.netProfit >= 0 && (
                            <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-full">
                                Profitability
                            </span>
                        )}
                    </div>
                    <div>
                        <h3 className={`text-3xl font-bold mb-0.5 ${stats.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                            {(stats.netProfit / 1000000).toFixed(1)} <span className="text-lg font-medium opacity-60">Juta</span>
                        </h3>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Estimasi Profit Bersih</p>
                    </div>

                    {/* Background Pattern */}
                    <div className="absolute -bottom-4 -right-4 opacity-5">
                        <Target size={80} />
                    </div>
                </div>
            </div>

            {/* Year-over-Year Summary Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                        <CalendarClock className="text-emerald-600" size={20} /> Ringkasan Per Tahun Ajaran
                    </h3>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Live Data</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-5">Tahun Ajaran</th>
                                <th className="px-6 py-5 text-center">Total Pendaftar</th>
                                <th className="px-6 py-5 text-center">Siswa Membayar</th>
                                <th className="px-6 py-5 text-center w-64">Konversi</th>
                                <th className="px-6 py-5 text-right">Total Pendapatan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {yearSummary.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-12 text-slate-400 italic">Belum ada data tahun ajaran.</td></tr>
                            ) : (
                                yearSummary.map((row) => {
                                    const conversionRate = row.totalRegs > 0 ? (row.paidRegs / row.totalRegs) * 100 : 0;
                                    let progressColor = 'bg-slate-200 dark:bg-slate-600';
                                    if (conversionRate >= 50) progressColor = 'bg-emerald-500 shadow-lg shadow-emerald-200 dark:shadow-none';
                                    else if (conversionRate >= 20) progressColor = 'bg-blue-500 shadow-lg shadow-blue-200 dark:shadow-none';
                                    else if (conversionRate > 0) progressColor = 'bg-amber-400 shadow-lg shadow-amber-200 dark:shadow-none';

                                    return (
                                        <tr key={row.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition group ${row.active ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 dark:text-white text-base">{row.year}</span>
                                                    {row.active && (
                                                        <span className="inline-flex items-center gap-1 w-fit mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                            <CheckCircle size={10} /> Aktif
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <div className="inline-flex flex-col items-center">
                                                    <span className="text-xl font-black text-slate-700 dark:text-slate-200">{row.totalRegs}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Leads</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <div className="inline-flex flex-col items-center">
                                                    <span className="text-xl font-black text-blue-600 dark:text-blue-400">{row.paidRegs}</span>
                                                    <span className="text-[10px] text-blue-400/80 font-bold uppercase">Paid</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Rate: {conversionRate.toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${progressColor} transition-all duration-1000 ease-out`}
                                                        style={{ width: `${conversionRate}%` }}
                                                    ></div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-lg">
                                                    Rp {row.revenue.toLocaleString()}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Charts & RAB Table Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Charts */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 h-96 flex flex-col">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-6 text-sm uppercase flex items-center gap-2 tracking-wider">
                            <PieChart size={18} className="text-slate-400" /> Analisa Keuangan
                        </h3>
                        <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" className="dark:opacity-10" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip
                                        cursor={{ fill: 'transparent' }}
                                        formatter={(value) => `Rp ${value.toLocaleString()}`}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#fff', color: '#1e293b' }}
                                    />
                                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="font-bold text-xl mb-3 flex items-center gap-2">
                                <Briefcase size={20} className="text-emerald-200" /> Strategi Marketing
                            </h3>
                            <p className="text-emerald-100 text-sm leading-relaxed mb-6 opacity-90">
                                Pastikan RAB marketing tidak melebihi <span className="font-bold text-white">20%</span> dari total pendapatan untuk menjaga kesehatan finansial sekolah.
                            </p>
                            <div className="inline-block bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                                <div className="text-xs text-emerald-200 uppercase tracking-widest font-bold mb-1">Marketing ROI</div>
                                <div className="text-2xl font-black text-white">
                                    {stats.totalRAB > 0 ? ((stats.totalRevenue - stats.totalRAB) / stats.totalRAB * 100).toFixed(0) : 0}%
                                </div>
                            </div>
                        </div>
                        <Briefcase className="absolute -bottom-10 -right-10 text-white opacity-5" size={200} />
                    </div>
                </div>

                {/* Right: RAB Customization */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-center px-2">
                        <div>
                            <h3 className="font-bold text-xl text-slate-800 dark:text-white">Rencana Anggaran Biaya</h3>
                            <p className="text-slate-500 text-sm">Kelola pengeluaran operasional marketing.</p>
                        </div>
                        <button
                            onClick={() => {
                                setItemForm({
                                    name: '', amount: '', category: 'Iklan', notes: '',
                                    academic_year_id: selectedYear === 'all' ? (academicYears.find(y => y.is_active)?.id || '') : selectedYear
                                });
                                setEditingId(null);
                                setIsFormOpen(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-200/50 dark:shadow-none hover:-translate-y-0.5"
                        >
                            <Plus size={18} /> Tambah Item
                        </button>
                    </div>

                    {/* RAB Table/List */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs border-b border-slate-100 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4">Nama Pengeluaran</th>
                                    <th className="px-6 py-4">Kategori</th>
                                    <th className="px-6 py-4 text-right">Biaya (IDR)</th>
                                    <th className="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                {rabItems.filter(item => selectedYear === 'all' ? true : item.academic_year_id === selectedYear).length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="text-center py-16 text-slate-400">
                                            <div className="flex flex-col items-center gap-3 opacity-60">
                                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                                                    <DollarSign size={32} />
                                                </div>
                                                <span className="text-sm font-medium">Belum ada data RAB. Mulai tambahkan pengeluaran.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    rabItems
                                        .filter(item => selectedYear === 'all' ? true : item.academic_year_id === selectedYear)
                                        .map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition group">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800 dark:text-white mb-0.5">{item.name}</div>
                                                    <div className="text-xs text-slate-400 flex items-center gap-2">
                                                        {item.notes && <span className="truncate max-w-[200px]">{item.notes}</span>}

                                                        {selectedYear === 'all' && item.academic_year_id && (
                                                            <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                                                                {academicYears.find(y => y.id === item.academic_year_id)?.year || '?'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${item.category === 'Iklan' ? 'bg-purple-50 border-purple-100 text-purple-600 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' :
                                                        item.category === 'Event' ? 'bg-orange-50 border-orange-100 text-orange-600 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300' :
                                                            'bg-slate-50 border-slate-100 text-slate-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300'
                                                        }`}>
                                                        {item.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                                    Rp {item.amount.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleEdit(item)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"><Edit2 size={16} /></button>
                                                        <button onClick={() => handleDelete(item.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                )}
                            </tbody>
                            {stats.totalRAB > 0 && (
                                <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <td colSpan="2" className="px-6 py-5 text-right font-bold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">Total Anggaran</td>
                                        <td className="px-6 py-5 text-right font-black text-red-600 dark:text-red-400 text-lg">Rp {stats.totalRAB.toLocaleString()}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal Form */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border border-slate-100 dark:border-slate-700">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
                            <div>
                                <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingId ? 'Edit Item Pengeluaran' : 'Tambah Pengeluaran RAB'}</h3>
                                <p className="text-sm text-slate-400">Pastikan data pengeluaran akurat.</p>
                            </div>
                            <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition text-slate-400 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveRAB} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Nama Item</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Contoh: Facebook Ads Bulan Ini"
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-medium transition-all"
                                    value={itemForm.name}
                                    onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Estimasi Biaya</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3 text-slate-400 font-bold">Rp</span>
                                        <input
                                            type="text"
                                            required
                                            placeholder="0"
                                            className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-mono font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-white transition-all"
                                            value={itemForm.amount}
                                            onChange={e => setItemForm({ ...itemForm, amount: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Kategori</label>
                                    <select
                                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-medium transition-all cursor-pointer"
                                        value={itemForm.category}
                                        onChange={e => setItemForm({ ...itemForm, category: e.target.value })}
                                    >
                                        <option value="Iklan">Iklan / Ads</option>
                                        <option value="Cetak">Cetak / Brosur</option>
                                        <option value="Event">Event / Pameran</option>
                                        <option value="Gaji">Honor / Komisi</option>
                                        <option value="Ops">Operasional</option>
                                        <option value="Lainnya">Lainnya</option>
                                    </select>
                                </div>
                            </div>

                            {/* Academic Year Selection in Form */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Tahun Akademik</label>
                                <select
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-medium transition-all cursor-pointer"
                                    value={itemForm.academic_year_id}
                                    onChange={e => setItemForm({ ...itemForm, academic_year_id: e.target.value })}
                                >
                                    <option value="" disabled>Pilih Tahun Akademik</option>
                                    {academicYears.map(ay => (
                                        <option key={ay.id} value={ay.id}>{ay.year} {ay.is_active ? '(Aktif)' : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Catatan (Opsional)</label>
                                <textarea
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-medium transition-all resize-none"
                                    rows="2"
                                    placeholder="Detail tambahan..."
                                    value={itemForm.notes}
                                    onChange={e => setItemForm({ ...itemForm, notes: e.target.value })}
                                ></textarea>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="flex-1 px-6 py-3 border border-slate-200 dark:border-slate-600 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-200/50 dark:shadow-none hover:-translate-y-0.5"
                                >
                                    <Save size={18} /> Simpan Data
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
