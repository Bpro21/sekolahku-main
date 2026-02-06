import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    AlertCircle, Building, Filter, User, Server, Code, Palette, BookOpen,
    Monitor, Cpu, PenTool, GraduationCap, ChevronDown, CheckCircle, Info
} from 'lucide-react';
import { Card } from '../ui/Elements';

export default function AdminQuotaRemaining({ showToast }) {
    const [years, setYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [units, setUnits] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch Data
    const fetchData = async () => {
        try {
            const [
                { data: yearsData },
                { data: unitsData },
                { data: regsData }
            ] = await Promise.all([
                supabase.from('academic_years').select('*'),
                supabase.from('units').select('*'),
                supabase.from('registrations').select('*')
            ]);

            const list = yearsData || [];
            setYears(list);

            // Set default year Logic
            let targetYear = selectedYear;
            if (!targetYear || !list.find(y => y.year === targetYear)) {
                const active = list.find(y => y.is_default)?.year || list.find(y => y.is_active)?.year || list[0]?.year;
                if (active) targetYear = active;
            }
            if (targetYear) setSelectedYear(targetYear);

            setUnits(unitsData || []);
            setRegistrations(regsData || []);
            setLoading(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        const channel = supabase.channel('admin_quota_remaining')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_years' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, fetchData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Filter Logic
    const yearId = years.find(y => y.year === selectedYear)?.id;
    const filteredRegs = registrations.filter(r =>
        r.academic_year === selectedYear || r.academic_year_id === yearId
    );

    // Helper: Count Stats with Case Insensitive Status
    const countStats = (regs) => {
        let internal = 0;
        let external = 0;

        regs.forEach(r => {
            const isInt = r.is_internal || (r.path_name && (r.path_name.toLowerCase().includes('internal') || r.path_name.toLowerCase().includes('inden')));
            const status = (r.status || '').toLowerCase();

            if (isInt) {
                if (!['rejected', 'mengundurkan_diri', 'draft'].includes(status)) {
                    internal++;
                }
            } else {
                if (['lulus', 'paid', 'accepted', 're_registration', 'student'].includes(status)) {
                    external++;
                }
            }
        });

        return { internal, external, total: internal + external };
    };

    // Icon Mapper
    const getMajorIcon = (name) => {
        const lower = name.toLowerCase();
        if (lower.includes('smp')) return <User size={18} className="text-blue-600" />;
        if (lower.includes('tkj') || lower.includes('network')) return <Server size={18} className="text-emerald-600" />;
        if (lower.includes('rpl') || lower.includes('software')) return <Code size={18} className="text-orange-600" />;
        if (lower.includes('dkv') || lower.includes('multi')) return <Palette size={18} className="text-pink-600" />;
        if (lower.includes('iot')) return <Cpu size={18} className="text-cyan-600" />;
        if (lower.includes('sd')) return <User size={18} className="text-indigo-600" />;
        return <BookOpen size={18} className="text-slate-600" />;
    };
    // Color mapper for Icon Background (Adaptive Dark Mode)
    const getMajorColor = (name) => {
        const lower = name.toLowerCase();
        if (lower.includes('smp')) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50 text-blue-700 dark:text-blue-300';
        if (lower.includes('tkj')) return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300';
        if (lower.includes('rpl')) return 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/50 text-orange-700 dark:text-orange-300';
        if (lower.includes('dkv')) return 'bg-pink-50 dark:bg-pink-900/20 border-pink-100 dark:border-pink-800/50 text-pink-700 dark:text-pink-300';
        if (lower.includes('sd')) return 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300';
        return 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300';
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-slate-500 dark:text-slate-400 text-sm font-medium animate-pulse">Memuat Data Kuota...</div>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in pb-12">

            {/* 1. Stylish Header with Integrated Filter */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6 pb-6 border-b border-slate-200/60 dark:border-slate-700/60">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-1">Kuota Siswa</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Monitoring ketersediaan kursi & status kelulusan</p>
                </div>

                {/* Modern Dropdown */}
                <div className="relative group w-full md:w-64 z-20">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Filter size={16} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <select
                        className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:border-emerald-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all appearance-none cursor-pointer outline-none"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                    >
                        {years.map(y => (
                            <option key={y.id} value={y.year}>{y.year}</option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <ChevronDown size={16} className="text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 transition-colors" />
                    </div>
                </div>
            </div>

            {/* 2. Modern Info Banner */}
            <div className="relative">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    {/* Header with gradient accent */}
                    <div className="relative bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-6 py-4">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-50"></div>
                        <div className="relative flex items-center gap-3">
                            <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                                <Info size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-sm tracking-wide">Sumber Data Perhitungan</h3>
                                <p className="text-emerald-100 text-xs">Kriteria penghitungan kuota siswa</p>
                            </div>
                        </div>
                    </div>

                    {/* Content Cards */}
                    <div className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Internal Card */}
                            <div className="group relative bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800/30 hover:shadow-md hover:border-purple-200 dark:hover:border-purple-700 transition-all">
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-200 dark:shadow-none shrink-0">
                                        1
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1">Siswa Internal</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                            Status sudah <span className="font-semibold text-purple-600 dark:text-purple-400">submit/verifikasi</span> & mendapat rekomendasi lanjut.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* External Card */}
                            <div className="group relative bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800/30 hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700 transition-all">
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-200 dark:shadow-none shrink-0">
                                        2
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1">Siswa Eksternal</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                            Status sudah tes & dinyatakan <span className="font-semibold text-emerald-600 dark:text-emerald-400">LULUS/DITERIMA</span>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Unit Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                {units.map((unit, idx) => {
                    const unitConfig = unit.academic_configs?.[yearId];
                    let majors = unitConfig?.majors || [];

                    // Fallback logic
                    if (majors.length === 0) {
                        majors = [{
                            name: unit.name.includes('SMK') ? 'Belum Ada Jurusan' : 'Reguler',
                            quota: unitConfig?.quota || unit.quota || 0
                        }];
                    }

                    const unitRegs = filteredRegs.filter(r => r.unit_id === unit.id);

                    // Card Theme based on Level
                    const isSMK = unit.level === 'SMK';
                    const isSMP = unit.level === 'SMP';
                    const listColor = isSMK ? 'bg-emerald-500' : (isSMP ? 'bg-blue-500' : 'bg-indigo-500');

                    return (
                        <div key={unit.id} className="group flex flex-col h-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden relative">
                            {/* Top Accent Line */}
                            <div className={`h-1.5 w-full ${listColor}`}></div>

                            <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start">
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1">{unit.level}</div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white leading-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                        {unit.name.replace(unit.level, '').trim() || unit.name}
                                    </h3>
                                </div>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${listColor} bg-opacity-10 dark:bg-opacity-20 text-${isSMK ? 'emerald' : isSMP ? 'blue' : 'indigo'}-600 dark:text-${isSMK ? 'emerald' : isSMP ? 'blue' : 'indigo'}-400`}>
                                    <Building size={16} />
                                </div>
                            </div>

                            <div className="flex-1 p-6 space-y-5">
                                {majors.map((major, mIdx) => {
                                    const normalize = s => s ? s.trim().toLowerCase() : '';
                                    const targetMajor = normalize(major.name);

                                    const isFallback = major.name === 'Reguler' || major.name === 'Belum Ada Jurusan';
                                    const mRegs = isFallback ? unitRegs : unitRegs.filter(r => {
                                        if (r.accepted_major && normalize(r.accepted_major) === targetMajor) return true;
                                        if (!r.accepted_major) {
                                            return normalize(r.major) === targetMajor || normalize(r.major_1) === targetMajor;
                                        }
                                        return false;
                                    });

                                    const stats = countStats(mRegs);
                                    const quota = parseInt(major.quota) || 0;
                                    const filled = stats.total;
                                    const remaining = Math.max(0, quota - filled);

                                    // Progress calculations using raw data to ensure accuracy
                                    const percent = quota > 0 ? (filled / quota) * 100 : 0;

                                    // Status Logic
                                    const isCritical = remaining <= 0;
                                    const isLow = remaining > 0 && remaining <= 5;

                                    const statusColor = isCritical ? 'bg-red-500 shadow-red-200' : (isLow ? 'bg-amber-500 shadow-amber-200' : 'bg-emerald-500 shadow-emerald-200');

                                    // Over Quota Warning
                                    const over = filled - quota;

                                    return (
                                        <div key={mIdx} className="relative">
                                            {/* Major Info Row */}
                                            <div className="flex items-start gap-4 mb-2 z-10 relative">
                                                {/* Icon Box */}
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${getMajorColor(major.name)}`}>
                                                    {getMajorIcon(major.name)}
                                                </div>

                                                {/* Details */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <h4 className="font-bold text-slate-700 dark:text-slate-200 truncate pr-2" title={major.name}>{major.name}</h4>
                                                        <div className={`px-2.5 py-1 rounded-lg text-xs font-black shadow-sm ${isCritical ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                                            Sisa: {remaining}
                                                        </div>
                                                    </div>

                                                    {/* Mini Stats (Int/Ext) */}
                                                    <div className="flex items-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 gap-3">
                                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span> Int: {stats.internal}</span>
                                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Eks: {stats.external}</span>
                                                        {over > 0 && <span className="text-red-500 dark:text-red-400 font-bold ml-auto">+{over} Over!</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress Bar Container */}
                                            <div className="relative pt-1">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 px-0.5">
                                                    <span>Terisi: {filled}</span>
                                                    <span>Target: {quota}</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${statusColor.split(' ')[0]}`}
                                                        style={{ width: `${Math.min(100, percent)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Decorative Bottom Pattern */}
                            <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-slate-50 dark:from-slate-700/50 to-transparent rounded-tl-[3rem] -z-0 opacity-50"></div>
                        </div>
                    );
                })}
            </div>

            <div className="text-center text-slate-400 text-sm font-medium pt-8 pb-4 opacity-60 hover:opacity-100 transition-opacity">
                &copy; 2025 Sekolahku Admin Dashboard &bull; Real-time Monitoring System
            </div>
        </div>
    );
}
