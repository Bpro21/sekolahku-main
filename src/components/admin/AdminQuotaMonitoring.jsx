import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { PieChart, Users, Target, Activity, Settings, Save, AlertCircle, Building, Filter, CornerDownRight } from 'lucide-react';
import { Card, Button } from '../ui/Elements';

export default function AdminQuotaMonitoring({ showToast }) {
    const [years, setYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [units, setUnits] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [allocations, setAllocations] = useState({}); // { [year]: { internal: 50, indent: 30 } }
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch Data
    const fetchData = async () => {
        try {
            const [
                { data: yearsData },
                { data: unitsData },
                { data: regsData },
                { data: allocData }
            ] = await Promise.all([
                supabase.from('academic_years').select('*'),
                supabase.from('units').select('*'),
                supabase.from('registrations').select('*'),
                supabase.from('quota_allocations').select('*')
            ]);

            const list = yearsData || [];
            setYears(list);

            // Set default year Logic
            // If we have selectedYear, keep it. If not, pick active or first.
            let targetYear = selectedYear;
            if (!targetYear || !list.find(y => y.year === targetYear)) {
                const active = list.find(y => y.is_default)?.year || list.find(y => y.is_active)?.year || list[0]?.year;
                if (active) targetYear = active;
            }
            if (targetYear) setSelectedYear(targetYear);

            setUnits(unitsData || []);
            setRegistrations(regsData || []);

            const allocMap = {};
            (allocData || []).forEach(a => {
                allocMap[a.academic_year] = a;
            });
            setAllocations(allocMap);

            setLoading(false);
        } catch (e) { console.error(e); setLoading(false); }
    };

    useEffect(() => {
        fetchData();

        const channel = supabase.channel('admin_quota_monitoring')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_years' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'quota_allocations' }, fetchData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Logic Calculation
    const getTotalQuota = () => {
        const yearObj = years.find(y => y.year === selectedYear);
        if (!yearObj) return 0;

        return units.reduce((acc, unit) => {
            const config = unit.academic_configs?.[yearObj.id];
            return acc + parseInt(config?.quota || unit.quota || 0);
        }, 0);
    };

    const handleSaveAllocation = async () => {
        setIsSaving(true);
        try {
            const current = allocations[selectedYear] || {};
            const payload = {
                academic_year: selectedYear,
                internal: parseInt(current.internal || 0),
                indent_external: parseInt(current.indent_external || 0),
                updated_at: new Date().toISOString()
            };

            // Try upsert first (requires UNIQUE constraint on academic_year)
            const { error } = await supabase
                .from('quota_allocations')
                .upsert(payload, { onConflict: 'academic_year' });

            if (error) {
                console.error('Upsert error:', error);

                // Fallback: check if row exists, then insert or update manually
                const { data: existing } = await supabase
                    .from('quota_allocations')
                    .select('id')
                    .eq('academic_year', selectedYear)
                    .maybeSingle();

                if (existing?.id) {
                    // Row exists → UPDATE
                    const { error: updateError } = await supabase
                        .from('quota_allocations')
                        .update({ internal: payload.internal, indent_external: payload.indent_external, updated_at: payload.updated_at })
                        .eq('academic_year', selectedYear);
                    if (updateError) throw updateError;
                } else {
                    // Row doesn't exist → INSERT
                    const { error: insertError } = await supabase
                        .from('quota_allocations')
                        .insert(payload);
                    if (insertError) throw insertError;
                }
            }

            if (showToast) showToast('Target alokasi berhasil disimpan!', 'success');
            fetchData();
        } catch (e) {
            console.error('Save allocation failed:', e);
            if (showToast) showToast(`Gagal menyimpan target: ${e.message || 'Unknown error'}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Calculate Stats
    const totalQuota = getTotalQuota();
    const currentAlloc = allocations[selectedYear] || { internal: 0, indent_external: 0 };
    const totalAllocated = (parseInt(currentAlloc.internal) || 0) + (parseInt(currentAlloc.indent_external) || 0);
    const regularQuota = Math.max(0, totalQuota - totalAllocated);

    // Filter Registrations
    const yearId = years.find(y => y.year === selectedYear)?.id;
    const filteredRegs = registrations.filter(r => r.academic_year === selectedYear || r.academic_year_id === yearId);

    // Count Taken
    // Status taken: verified, paid, accepted, lulus, student, re_registration, verifying_payment
    // Include 'submitted' as potential? Original code did include it? Let's exclude submitted for stricter monitoring, OR include based on previous logic.
    // Let's stick to strict: Verified and above.
    const TAKEN_STATUS = ['verified', 'verifying_payment', 'paid', 'accepted', 'lulus', 're_registration', 'student'];

    const countTaken = (type) => {
        return filteredRegs.filter(r => {
            const isInt = r.is_internal || (r.path_name && r.path_name.toLowerCase().includes('internal'));
            const isInd = r.is_indent || (r.path_name && r.path_name.toLowerCase().includes('inden'));

            // Logic Type
            if (type === 'internal') return isInt;
            if (type === 'indent') return isInd && !isInt;
            if (type === 'external') return !isInt && !isInd;
            return false;
        }).filter(r => TAKEN_STATUS.includes(r.status)).length;
    };

    const takenInternal = countTaken('internal');
    const takenIndent = countTaken('indent');
    const takenExternal = countTaken('external');
    const totalTaken = takenInternal + takenIndent + takenExternal;

    const QuotaCard = ({ title, icon: Icon, color, current, max, editable, allocKey }) => {
        const percent = max > 0 ? Math.round((current / max) * 100) : 0;
        const colorClass = {
            purple: 'text-purple-600 bg-purple-100',
            amber: 'text-amber-600 bg-amber-100',
            emerald: 'text-emerald-600 bg-emerald-100',
        }[color];

        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl ${colorClass} dark:bg-opacity-20`}>
                        <Icon size={24} />
                    </div>
                    {editable ? (
                        <div className="text-right">
                            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Target</div>
                            <div className="flex items-center justify-end gap-1">
                                <input
                                    type="number"
                                    className="w-16 text-right font-bold border-b border-slate-300 dark:border-slate-600 focus:border-emerald-500 outline-none bg-transparent dark:text-white"
                                    value={allocations[selectedYear]?.[allocKey] || 0}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setAllocations(prev => ({
                                            ...prev,
                                            [selectedYear]: { ...prev[selectedYear], [allocKey]: val }
                                        }));
                                    }}
                                />
                                <Settings size={12} className="text-slate-300 dark:text-slate-600" />
                            </div>
                        </div>
                    ) : (
                        <div className="text-right">
                            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Alokasi Otomatis</div>
                            <div className="font-bold text-lg text-slate-700 dark:text-slate-200">{max}</div>
                        </div>
                    )}
                </div>

                <h3 className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">{title}</h3>
                <div className="flex items-end gap-2 mt-1 mb-4">
                    <span className="text-4xl font-black text-slate-800 dark:text-white">{current}</span>
                    <span className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-1.5">/ {max}</span>
                </div>

                <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${color === 'purple' ? 'bg-purple-500' : color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, percent)}%` }}></div>
                </div>
                <div className="flex justify-between mt-2 text-xs font-bold text-slate-400 dark:text-slate-500">
                    <span className={percent >= 100 ? 'text-red-500' : ''}>{percent}% Terisi</span>
                    <span>{Math.max(0, max - current)} Tersedia</span>
                </div>
            </div>
        );
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Loading Configuration...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <PieChart className="text-emerald-600" /> Monitoring Kuota & Alokasi
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Tetapkan target kuota Inden dan pantau keterisian secara global.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <select
                            className="pl-4 pr-10 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer dark:text-white"
                            value={selectedYear}
                            onChange={e => setSelectedYear(e.target.value)}
                        >
                            {years.map(y => <option key={y.id} value={y.year}>{y.year}</option>)}
                        </select>
                        <Filter className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                    </div>
                    <Button onClick={handleSaveAllocation} disabled={isSaving} className="bg-emerald-600 text-white hover:bg-emerald-700">
                        <Save size={16} /> {isSaving ? 'Menyimpan...' : 'Simpan Target'}
                    </Button>
                </div>
            </div>

            {/* Main Stats */}
            <div className="bg-slate-800 rounded-2xl p-8 text-white relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-3xl opacity-20 translate-x-1/2 -translate-y-1/2"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 text-center md:text-left">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Total Kapasitas Sekolah</div>
                        <div className="text-5xl font-black">{totalQuota} <span className="text-2xl font-medium text-slate-500">Kursi</span></div>
                    </div>
                    <div className="flex gap-8 border-l border-slate-700 pl-8">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-emerald-400">{totalTaken}</div>
                            <div className="text-xs font-bold text-slate-500 uppercase">Terisi</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">{Math.max(0, totalQuota - totalTaken)}</div>
                            <div className="text-xs font-bold text-slate-500 uppercase">Kosong</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Warning if allocation mismatch */}
            {totalAllocated > totalQuota && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-800">
                    <AlertCircle />
                    <div>
                        <strong className="block font-bold">Over Allocation!</strong>
                        <span className="text-sm">Total target ({totalAllocated}) melebihi kapasitas ({totalQuota}). Harap kurangi target.</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <QuotaCard
                    title="Inden Internal"
                    icon={Target}
                    color="purple"
                    current={takenInternal}
                    max={allocations[selectedYear]?.internal || 0}
                    editable={true}
                    allocKey="internal"
                />
                <QuotaCard
                    title="Inden Eksternal"
                    icon={Activity}
                    color="amber"
                    current={takenIndent}
                    max={allocations[selectedYear]?.indent_external || 0}
                    editable={true}
                    allocKey="indent_external"
                />
                <QuotaCard
                    title="Reguler (Sisa)"
                    icon={Users}
                    color="emerald"
                    current={takenExternal}
                    max={regularQuota}
                    editable={false}
                />
            </div>

            {/* Detail Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                        <Filter size={18} className="text-slate-400" /> Detail Pendaftar ({selectedYear})
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => {
                        // Export CSV Logic
                        const headers = ['Unit/Jurusan', 'Internal', 'Inden Eks', 'Reguler', 'Total'];
                        const rows = [];

                        let grandTotal = { int: 0, ind: 0, reg: 0, tot: 0 };

                        units.forEach(u => {
                            const uRegs = filteredRegs.filter(r => r.unit_id === u.id && TAKEN_STATUS.includes(r.status));

                            // Unit Level Stats
                            let uInt = 0, uInd = 0, uReg = 0;
                            uRegs.forEach(r => {
                                const isInt = r.is_internal || (r.path_name && r.path_name.toLowerCase().includes('internal'));
                                const isInd = r.is_indent || (r.path_name && r.path_name.toLowerCase().includes('inden'));
                                if (isInt) uInt++;
                                else if (isInd) uInd++;
                                else uReg++;
                            });

                            rows.push([u.name, uInt, uInd, uReg, uInt + uInd + uReg]);
                            grandTotal.int += uInt;
                            grandTotal.ind += uInd;
                            grandTotal.reg += uReg;
                            grandTotal.tot += (uInt + uInd + uReg);

                            // Majors
                            const majors = u.academic_configs?.[selectedYear]?.majors || [];
                            majors.forEach(m => {
                                const mRegs = uRegs.filter(r => {
                                    // Robust Major Matching
                                    const targetMajor = m.name.toLowerCase();
                                    if (r.accepted_major && r.accepted_major.toLowerCase() === targetMajor) return true;
                                    if (!r.accepted_major) {
                                        return (r.major && r.major.toLowerCase() === targetMajor) || (r.major_1 && r.major_1.toLowerCase() === targetMajor);
                                    }
                                    return false;
                                });

                                let mInt = 0, mInd = 0, mReg = 0;
                                mRegs.forEach(r => {
                                    const isInt = r.is_internal || (r.path_name && r.path_name.toLowerCase().includes('internal'));
                                    const isInd = r.is_indent || (r.path_name && r.path_name.toLowerCase().includes('inden'));
                                    if (isInt) mInt++;
                                    else if (isInd) mInd++;
                                    else mReg++;
                                });
                                rows.push([`   ↳ ${m.name}`, mInt, mInd, mReg, mInt + mInd + mReg]);
                            });
                        });

                        rows.push(['TOTAL KESELURUHAN', grandTotal.int, grandTotal.ind, grandTotal.reg, grandTotal.tot]);

                        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `detail_pendaftar_${selectedYear}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);

                    }} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                        Export CSV
                    </Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4 font-bold">Unit</th>
                                <th className="px-6 py-4 font-bold text-purple-600 dark:text-purple-400 text-center">Internal</th>
                                <th className="px-6 py-4 font-bold text-amber-600 dark:text-amber-400 text-center">Inden Eks</th>
                                <th className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400 text-center">Reguler</th>
                                <th className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {units.map((u) => {
                                const uRegs = filteredRegs.filter(r => r.unit_id === u.id && TAKEN_STATUS.includes(r.status));

                                // Calculate Unit Stats
                                let uInt = 0, uInd = 0, uReg = 0;
                                uRegs.forEach(r => {
                                    const isInt = r.is_internal || (r.path_name && r.path_name.toLowerCase().includes('internal'));
                                    const isInd = r.is_indent || (r.path_name && r.path_name.toLowerCase().includes('inden'));
                                    if (isInt) uInt++;
                                    else if (isInd) uInd++;
                                    else uReg++;
                                });

                                const majors = u.academic_configs?.[selectedYear]?.majors || [];

                                return (
                                    <React.Fragment key={u.id}>
                                        <tr className="bg-slate-50/50 dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{u.name}</td>
                                            <td className="px-6 py-4 text-center font-bold text-purple-600 dark:text-purple-400">{uInt}</td>
                                            <td className="px-6 py-4 text-center font-bold text-amber-600 dark:text-amber-400">{uInd}</td>
                                            <td className="px-6 py-4 text-center font-bold text-emerald-600 dark:text-emerald-400">{uReg}</td>
                                            <td className="px-6 py-4 text-right font-black text-slate-800 dark:text-white">{uInt + uInd + uReg}</td>
                                        </tr>
                                        {majors.map((m, mIdx) => {
                                            const mRegs = uRegs.filter(r => {
                                                const targetMajor = m.name.toLowerCase();
                                                // Prioritize accepted_major if exists
                                                if (r.accepted_major && r.accepted_major.toLowerCase() === targetMajor) return true;
                                                // Else check choices if accepted_major is not set
                                                if (!r.accepted_major) {
                                                    return (r.major && r.major.toLowerCase() === targetMajor) || (r.major_1 && r.major_1.toLowerCase() === targetMajor);
                                                }
                                                return false;
                                            });

                                            let mInt = 0, mInd = 0, mReg = 0;
                                            mRegs.forEach(r => {
                                                const isInt = r.is_internal || (r.path_name && r.path_name.toLowerCase().includes('internal'));
                                                const isInd = r.is_indent || (r.path_name && r.path_name.toLowerCase().includes('inden'));
                                                if (isInt) mInt++;
                                                else if (isInd) mInd++;
                                                else mReg++;
                                            });

                                            return (
                                                <tr key={`${u.id}-${mIdx}`} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                                    <td className="px-6 py-3 pl-12 text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                                                        <CornerDownRight size={14} className="opacity-50" /> {m.name}
                                                    </td>
                                                    <td className="px-6 py-3 text-center text-purple-400 dark:text-purple-500/80 font-medium text-xs">{mInt}</td>
                                                    <td className="px-6 py-3 text-center text-amber-400 dark:text-amber-500/80 font-medium text-xs">{mInd}</td>
                                                    <td className="px-6 py-3 text-center text-emerald-400 dark:text-emerald-500/80 font-medium text-xs">{mReg}</td>
                                                    <td className="px-6 py-3 text-right text-slate-400 dark:text-slate-500 font-medium text-xs">{mInt + mInd + mReg}</td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}

                            {/* Grand Total Row */}
                            <tr className="bg-slate-100 dark:bg-slate-700 border-t-2 border-slate-200 dark:border-slate-600">
                                <td className="px-6 py-4 font-black text-slate-800 dark:text-white tracking-wider">TOTAL KESELURUHAN</td>
                                <td className="px-6 py-4 text-center font-black text-purple-700 dark:text-purple-300">{takenInternal}</td>
                                <td className="px-6 py-4 text-center font-black text-amber-700 dark:text-amber-300">{takenIndent}</td>
                                <td className="px-6 py-4 text-center font-black text-emerald-700 dark:text-emerald-300">{takenExternal}</td>
                                <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white text-lg">{totalTaken}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
