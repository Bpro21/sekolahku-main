import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    Wallet, TrendingUp, TrendingDown, DollarSign, Calendar, CreditCard, CheckCircle, Image as ImageIcon, Tag, Eye, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Card, Select, Button } from '../ui/Elements'; // Ensure Button is imported
import { Modal } from '../ui/Overlays'; // Import Modal

export default function AdminFinanceDashboard() {
    const [invoices, setInvoices] = useState([]);
    // Setup Academic Year States
    const [academicYears, setAcademicYears] = useState([]);
    const [waves, setWaves] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');

    // UI States
    const [viewInvoice, setViewInvoice] = useState(null);
    const [viewVoucherList, setViewVoucherList] = useState(false);
    const [voucherPage, setVoucherPage] = useState(1);
    const [regMap, setRegMap] = useState({});

    useEffect(() => {
        if (viewVoucherList) setVoucherPage(1);
    }, [viewVoucherList]);

    const fetchAllData = async () => {
        try {
            // 1. Fetch Academic Years
            const { data: ayData } = await supabase.from('academic_years').select('*');
            if (ayData) {
                setAcademicYears(ayData);

                // Auto Select Default/Active if not set
                // Note: state 'selectedYear' might be stale here if we rely on closure, but for initial load it's fine.
                // To be robust, we can check inside the setter if needed, but here simple if check is ok as it runs once mostly or updates don't break logic much.
                setSelectedYear(prev => {
                    if (prev) return prev;
                    const def = ayData.find(a => a.is_default) || ayData.find(a => a.is_active);
                    return def ? def.id : '';
                });
            }

            // 2. Fetch Waves
            const { data: wData } = await supabase.from('waves').select('*');
            if (wData) setWaves(wData);

            // 3. Fetch Invoices (Paid only)
            const { data: iData } = await supabase.from('invoices').select('*').eq('status', 'paid');
            if (iData) setInvoices(iData);

            // 4. Fetch Registrations
            const { data: rData } = await supabase.from('registrations').select('*');
            if (rData) {
                const map = {};
                rData.forEach(r => { map[r.id] = r; });
                setRegMap(map);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchAllData();

        const channel = supabase.channel('admin_finance')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, fetchAllData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, fetchAllData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Filter Data by Academic Year Logic
    const filteredInvoices = invoices.filter(i => {
        if (!selectedYear) return false;

        // 1. Direct Invoice AY Match
        if (i.academic_year === selectedYear) return true;

        // 2. Linked Registration Match
        const reg = regMap[i.registration_id];
        if (reg) {
            // Find target AY object from selected ID
            const targetAy = academicYears.find(ay => ay.id === selectedYear);

            // Check direct reg AY (Support both UUID and Name match)
            if (reg.academic_year === selectedYear) return true;
            if (targetAy && reg.academic_year === targetAy.year) return true;

            // Check via Wave
            if (reg.wave_id) {
                const wave = waves.find(w => w.id === reg.wave_id);
                // Robust check for AY ID in wave
                const waveAY = wave?.year || wave?.academic_year_id || wave?.academic_year;
                if (waveAY && waveAY === selectedYear) return true;

                // Fallback: If wave.year is string name "2025/2026", match with ay.year name
                if (wave?.year && !waveAY?.includes('uuid') && academicYears.length > 0) {
                    if (targetAy && wave.year === targetAy.year) return true;
                }
            }
        }
        return false;
    });

    // Calculate Totals
    const totalRevenue = filteredInvoices.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const totalGrossRevenue = filteredInvoices.reduce((acc, curr) => acc + (curr.original_amount || curr.amount || 0), 0);
    const totalDiscountGiven = filteredInvoices.reduce((acc, curr) => acc + (curr.discount_info?.amount || 0), 0);
    const voucherUsageCount = filteredInvoices.filter(i => i.discount_info).length;

    // Categorize
    // Assuming description contains "Pendaftaran" or "Daftar Ulang"
    const registrationIncome = filteredInvoices
        .filter(i => i.description?.toLowerCase().includes('pendaftaran'))
        .reduce((acc, curr) => acc + (curr.amount || 0), 0);

    const reRegistrationIncome = filteredInvoices
        .filter(i => i.description?.toLowerCase().includes('daftar ulang'))
        .reduce((acc, curr) => acc + (curr.amount || 0), 0);

    // Count transactions
    const countReg = filteredInvoices.filter(i => i.description?.toLowerCase().includes('pendaftaran')).length;
    const countReReg = filteredInvoices.filter(i => i.description?.toLowerCase().includes('daftar ulang')).length;


    return (
        <div className="space-y-8 animate-fade-in text-slate-800 dark:text-white">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none text-white transform -rotate-3">
                            <DollarSign size={28} />
                        </div>
                        Finance Dashboard
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-base font-medium">
                        Pusat kendali pendapatan, arus kas, dan validasi pembayaran sekolah.
                    </p>
                </div>
                <div className="w-full md:w-64">
                    <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <Select
                            value={selectedYear}
                            onChange={e => setSelectedYear(e.target.value)}
                            options={academicYears.filter(ay => ay.is_active).map(ay => ({
                                value: ay.id,
                                label: `${ay.year} ${ay.is_default ? '★' : ''}`
                            }))}
                            className="bg-slate-50 border-none font-bold text-slate-700 text-center"
                        />
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 1. Total Revenue (Hero Card) */}
                <Card className="col-span-1 md:col-span-2 lg:col-span-1 p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-xl shadow-blue-200 dark:shadow-none border-none relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                        <Wallet size={120} />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/20 mb-4">
                                <CheckCircle size={12} className="text-emerald-300" /> Pendapatan Bersih
                            </div>
                            <h3 className="text-3xl font-black tracking-tight mb-1 text-white">
                                <span className="text-blue-200 text-lg mr-1">Rp</span>
                                {totalRevenue.toLocaleString('id-ID')}
                            </h3>
                            <p className="text-blue-200 text-xs font-medium">Total Cashflow Masuk</p>
                        </div>
                        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                            <span className="text-xs font-medium text-blue-100">{filteredInvoices.length} Transaksi Berhasil</span>
                            <div className="bg-white/20 p-2 rounded-lg text-white">
                                <TrendingUp size={16} />
                            </div>
                        </div>
                    </div>
                </Card>

                {/* 2. Analysis Discount */}
                <Card className="p-6 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-lg shadow-slate-100 dark:shadow-none hover:shadow-xl transition-all group relative overflow-hidden">
                    <div className="absolute -right-6 -bottom-6 text-amber-50 dark:text-amber-900/100 group-hover:text-amber-100 dark:group-hover:text-amber-900/30 transition-colors">
                        <Tag size={100} transform="rotate(-15)" />
                    </div>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg">
                                    <Tag size={20} />
                                </div>
                                <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Potongan Biaya</span>
                            </div>

                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-1">
                                <span className="text-sm font-bold text-slate-400 mr-1">Rp</span>
                                {totalDiscountGiven.toLocaleString('id-ID')}
                            </h3>
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md w-fit">
                                Total Diskon Diberikan
                            </p>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-end">
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide block mb-0.5">Gross Revenue</span>
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Rp {totalGrossRevenue.toLocaleString('id-ID')}</span>
                                </div>
                                <button
                                    onClick={() => setViewVoucherList(true)}
                                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition"
                                >
                                    <Eye size={14} /> Detail
                                </button>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* 3. New Registration Income */}
                <Card className="p-6 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-lg shadow-slate-100 dark:shadow-none hover:shadow-xl transition-all">
                    <div className="flex flex-col h-full justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl">
                                    <CreditCard size={24} />
                                </div>
                                <span className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-1 rounded-full h-fit">
                                    +{countReg} Siswa
                                </span>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-1 truncate">
                                <span className="text-sm font-bold text-slate-400 mr-1">Rp</span>
                                {registrationIncome.toLocaleString('id-ID')}
                            </h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Omzet Pendaftaran Baru</p>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-4 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(registrationIncome / (totalRevenue || 1)) * 100}%` }}></div>
                        </div>
                    </div>
                </Card>

                {/* 4. Re-Registration Income */}
                <Card className="p-6 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-lg shadow-slate-100 dark:shadow-none hover:shadow-xl transition-all">
                    <div className="flex flex-col h-full justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-sky-50 dark:bg-sky-900/20 text-sky-600 rounded-2xl">
                                    <Calendar size={24} />
                                </div>
                                <span className="bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 text-[10px] font-bold px-2 py-1 rounded-full h-fit">
                                    +{countReReg} Siswa
                                </span>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-1 truncate">
                                <span className="text-sm font-bold text-slate-400 mr-1">Rp</span>
                                {reRegistrationIncome.toLocaleString('id-ID')}
                            </h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Omzet Daftar Ulang</p>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-4 overflow-hidden">
                            <div className="bg-sky-500 h-full rounded-full" style={{ width: `${(reRegistrationIncome / (totalRevenue || 1)) * 100}%` }}></div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Transaction Ledger */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-slate-800">
                    <div>
                        <h3 className="font-bold text-xl text-slate-800 dark:text-white flex items-center gap-2">
                            <TrendingUp className="text-emerald-500" /> Riwayat Transaksi Masuk
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Daftar semua pembayaran yang telah diverifikasi valid oleh sistem/admin.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => window.print()}>Export Laporan</Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs border-b border-slate-100 dark:border-slate-700 sticky top-0">
                            <tr>
                                <th className="p-6">Waktu Transaksi</th>
                                <th className="p-6">Identitas Siswa</th>
                                <th className="p-6">Peruntukan</th>
                                <th className="p-6 text-right">Nominal (IDR)</th>
                                <th className="p-6 text-center">Status</th>
                                <th className="p-6 text-center">Detail</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {filteredInvoices.length > 0 ? (
                                filteredInvoices.sort((a, b) => (new Date(b.paid_at).getTime() || 0) - (new Date(a.paid_at).getTime() || 0)).map((inv, idx) => (
                                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="p-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                                                    {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                                                </span>
                                                <span className="text-xs text-slate-400 font-mono mt-1">
                                                    {inv.paid_at ? new Date(inv.paid_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''} WIB
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                                    {inv.student_name ? inv.student_name.charAt(0).toUpperCase() : '?'}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-white text-sm">{inv.student_name}</div>
                                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded w-fit mt-1">
                                                        #{inv.id.slice(0, 8)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${inv.description?.toLowerCase().includes('pendaftaran')
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                                                : inv.description?.toLowerCase().includes('daftar ulang')
                                                    ? 'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-900/20 dark:border-sky-800 dark:text-sky-400'
                                                    : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300'
                                                }`}>
                                                {inv.description?.toLowerCase().includes('pendaftaran') ? <CreditCard size={14} /> : <Calendar size={14} />}
                                                {inv.description}
                                            </span>
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="font-bold text-slate-800 dark:text-white text-base">Rp {inv.amount.toLocaleString('id-ID')}</div>
                                            {inv.discount_info && <div className="text-[10px] text-amber-500 font-medium mt-0.5" title="Diskon Applied">Hemat Rp {inv.discount_info.amount.toLocaleString()}</div>}
                                        </td>
                                        <td className="p-6 text-center">
                                            <div className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide">
                                                <CheckCircle size={12} className="fill-current" /> Valid
                                            </div>
                                        </td>
                                        <td className="p-6 text-center">
                                            <button
                                                onClick={() => setViewInvoice(inv)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/50 border border-slate-200 dark:border-slate-600 transition-all shadow-sm"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="p-16 text-center">
                                        <div className="flex flex-col items-center justify-center opacity-40">
                                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                                                <DollarSign size={40} className="text-slate-400" />
                                            </div>
                                            <h4 className="text-lg font-bold text-slate-700 dark:text-slate-300">Belum Ada Transaksi</h4>
                                            <p className="text-sm text-slate-500">Transaksi yang lunas akan muncul di sini secara otomatis.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Custom Modal Styles (Detail Modal) */}
            <Modal
                isOpen={!!viewInvoice}
                onClose={() => setViewInvoice(null)}
                title="Rincian Transaksi"
                maxWidth="max-w-xl"
            >
                {viewInvoice && (
                    <div className="space-y-6">
                        {/* Status Banner */}
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl flex items-center gap-4 border border-emerald-100 dark:border-emerald-800">
                            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-300 shadow-sm shrink-0">
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-emerald-800 dark:text-emerald-300">Pembayaran Terverifikasi</h4>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                    Transaksi ini telah lunas dan tercatat dalam sistem keuangan.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                <span className="text-xs text-slate-400 uppercase tracking-wider font-bold block mb-1">Total Tagihan</span>
                                <span className="text-lg font-bold text-slate-700 dark:text-slate-200">
                                    Rp {(viewInvoice.original_amount || viewInvoice.amount).toLocaleString('id-ID')}
                                </span>
                            </div>
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                                <span className="text-xs text-blue-400 uppercase tracking-wider font-bold block mb-1">Total Dibayar</span>
                                <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                                    Rp {viewInvoice.amount.toLocaleString('id-ID')}
                                </span>
                            </div>
                        </div>

                        {/* Detail List */}
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-sm">
                            <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex justify-between">
                                <span className="text-slate-500">ID Transaksi</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">#{viewInvoice.id}</span>
                            </div>
                            <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex justify-between">
                                <span className="text-slate-500">Nama Siswa</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{viewInvoice.student_name}</span>
                            </div>
                            {viewInvoice.discount_info && (
                                <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex justify-between bg-amber-50 dark:bg-amber-900/10 text-amber-900 dark:text-amber-100">
                                    <span className="flex items-center gap-2"><Tag size={14} /> Voucher Diskon</span>
                                    <span className="font-bold">- Rp {viewInvoice.discount_info.amount.toLocaleString()}</span>
                                </div>
                            )}
                        </div>

                        {/* Evidence */}
                        <div>
                            <h5 className="font-bold text-slate-800 dark:text-white mb-3 text-sm flex items-center gap-2">
                                <ImageIcon size={16} /> Bukti Transfer
                            </h5>
                            {viewInvoice.proof_of_transfer ? (
                                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 relative group">
                                    <img
                                        src={viewInvoice.proof_of_transfer}
                                        alt="Bukti Transfer"
                                        className="w-full h-48 object-contain bg-checkered"
                                    />
                                    <a
                                        href={viewInvoice.proof_of_transfer}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold gap-2"
                                    >
                                        <Eye size={20} /> Lihat Full Size
                                    </a>
                                </div>
                            ) : (
                                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-center text-slate-400">
                                    <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                                    <span className="text-xs">Tidak ada lampiran bukti transfer (Cash/Manual).</span>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button onClick={() => setViewInvoice(null)} variant="primary" className="w-full">Tutup Detail</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Voucher List Modal */}
            <Modal
                isOpen={viewVoucherList}
                onClose={() => setViewVoucherList(false)}
                title="Riwayat Penggunaan Voucher"
                maxWidth="max-w-4xl"
            >
                {(() => {
                    const voucherList = filteredInvoices.filter(i => i.discount_info);
                    const totalPages = Math.ceil(voucherList.length / 5);
                    const paginatedList = voucherList.slice((voucherPage - 1) * 5, voucherPage * 5);

                    return (
                        <div className="space-y-4">
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-100 rounded-lg">
                                        <Tag size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-amber-900 dark:text-amber-100 text-sm">Total Potongan Biaya</h4>
                                        <p className="text-xs text-amber-700 dark:text-amber-300">Akumulasi diskon yang diberikan kepada pendaftar.</p>
                                    </div>
                                </div>
                                <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                                    Rp {totalDiscountGiven.toLocaleString('id-ID')}
                                </span>
                            </div>

                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold uppercase text-xs border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="p-4">Tanggal</th>
                                            <th className="p-4">Siswa</th>
                                            <th className="p-4 text-center">Kode Voucher</th>
                                            <th className="p-4 text-right">Nominal Potongan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {paginatedList.length > 0 ? (
                                            paginatedList.map(inv => (
                                                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                    <td className="p-4 font-mono text-xs text-slate-500">
                                                        {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('id-ID') : '-'}
                                                    </td>
                                                    <td className="p-4 font-bold text-slate-700 dark:text-slate-200">{inv.student_name}</td>
                                                    <td className="p-4 text-center">
                                                        <span className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-3 py-1 rounded-md font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                                                            {inv.discount_info.code}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-bold text-amber-500">
                                                        - Rp {inv.discount_info.amount.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan="4" className="p-8 text-center text-slate-400 italic">Tidak ada penggunaan voucher</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-xs text-slate-400">
                                    Halaman {voucherPage} dari {totalPages || 1}
                                </span>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setVoucherPage(p => Math.max(1, p - 1))} disabled={voucherPage === 1}><ChevronLeft size={14} /></Button>
                                    <Button variant="outline" size="sm" onClick={() => setVoucherPage(p => Math.min(totalPages, p + 1))} disabled={voucherPage === totalPages}><ChevronRight size={14} /></Button>
                                    <Button onClick={() => setViewVoucherList(false)} size="sm">Tutup</Button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
}
