import React, { useMemo } from 'react';
import { Card } from '../ui/Elements';

export default function PSBStatistik({ registrations, branches }) {
    // 1. Hooks MUST be at the top level, unconditional
    const [activeTab, setActiveTab] = React.useState('ALL'); // ALL, TK, SD, SMP, SMA, SMK

    // Process Data
    const stats = useMemo(() => {
        // 1. Filter LULUS only
        const lulusData = registrations.filter(r => ['lulus', 'paid', 'accepted'].includes(r.status));

        // 2. Identify Unique Academic Years and sort descending
        const years = [...new Set(lulusData.map(r => r.academic_year || r.wave_name?.split(' ')[0] || 'Unknown'))]
            .filter(y => y !== 'Unknown')
            .sort((a, b) => b.localeCompare(a))
            .slice(0, 3); // Take top 3 years

        // 3. Build aggregation structure
        // Structure: { [Year]: { total: 0, byId: {}, byName: {}, globalMajors: {} } }
        const data = {};

        years.forEach(year => {
            data[year] = { total: 0, byId: {}, byName: {}, globalMajors: {} };

            // Filter data for this year
            const yearData = lulusData.filter(r => (r.academic_year === year) || (r.wave_name && r.wave_name.includes(year)));

            data[year].total = yearData.length;

            yearData.forEach(reg => {
                const unitName = reg.unit_name || reg.branch_name || 'Unknown Unit';
                const unitId = reg.unit_id;

                // Determine Major/Label
                let label = reg.major;
                if (!label) {
                    if (unitName.toLowerCase().includes('smp')) label = 'SMP';
                    else if (unitName.toLowerCase().includes('mts')) label = 'MTS';
                    else if (unitName.toLowerCase().includes('sd')) label = 'SD';
                    else if (unitName.toLowerCase().includes('tk')) label = 'TK';
                    else if (unitName.toLowerCase().includes('smk')) label = 'SMK';
                    else if (unitName.toLowerCase().includes('sma')) label = 'SMA';
                    else label = 'Other';
                }

                // Increment Global Counts (IDN Total)
                data[year].globalMajors[label] = (data[year].globalMajors[label] || 0) + 1;

                // Helper to update unit stats
                const updateUnitStats = (storage, key) => {
                    if (!key) return;
                    if (!storage[key]) storage[key] = { total: 0, majors: {} };
                    storage[key].total += 1;
                    storage[key].majors[label] = (storage[key].majors[label] || 0) + 1;
                };

                // Store by ID (Primary)
                updateUnitStats(data[year].byId, unitId);
                // Store by Name (Fallback)
                updateUnitStats(data[year].byName, unitName);
            });
        });

        return { years, data };
    }, [registrations]);

    // Filter branches based on activeTab
    // This hook must also be unconditional
    const filteredBranches = useMemo(() => {
        if (!branches) return [];
        if (activeTab === 'ALL') return branches;
        return branches.filter(b => b.name.toUpperCase().includes(activeTab));
    }, [branches, activeTab]);

    const { years, data } = stats;

    // Helper to format majors string
    const formatMajors = (majorsObj) => {
        if (!majorsObj) return '-';
        return Object.entries(majorsObj)
            .sort((a, b) => b[1] - a[1]) // Sort by count descending
            .map(([key, val]) => `${key} : ${val}`)
            .join(' | ');
    };

    // 2. Early Returns (Conditional Rendering) happen AFTER hooks
    if (years.length === 0 && (!branches || branches.length === 0)) {
        return (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center shadow-sm mt-6">
                <div className="text-slate-400 font-medium mb-2">Belum ada Data Kelulusan</div>
                <p className="text-slate-500 text-sm">Statistik akan muncul setelah ada siswa yang berstatus Lulus atau Diterima.</p>
            </div>
        );
    }

    const TABS = ['ALL', 'TK', 'SD', 'SMP', 'SMA', 'SMK'];

    return (
        <div className="animate-fade-in mt-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-700 dark:text-white flex items-center gap-2">
                        Statistik Kelulusan PSB
                        <span className="text-xs font-normal px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500">
                            {years.length} Tahun Terakhir
                        </span>
                    </h2>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto max-w-full">
                    {TABS.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab
                                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                        >
                            {tab === 'ALL' ? 'Semua Unit' : tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. IDN Total Card (Only show on ALL tab or maybe always?) -> Let's show only on ALL to save space, or keep it as summary */}
                {activeTab === 'ALL' && years.length > 0 && (
                    <Card className="p-5 h-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="text-6xl font-black text-slate-300">IDN</span>
                        </div>
                        <h3 className="font-bold text-lg text-slate-600 dark:text-slate-200 mb-4 relative z-10">Total Keseluruhan</h3>
                        <div className="space-y-3 relative z-10">
                            {years.map(year => (
                                <div key={year} className="p-3 border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{year}</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{data[year].total} Santri</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                        {formatMajors(data[year].globalMajors)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* 2. & 3. Specific Units Cards (Filtered) */}
                {filteredBranches && filteredBranches.map(branch => (
                    <Card key={branch.id} className="p-5 h-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 h-full flex flex-col">
                        <h3 className="font-bold text-lg text-slate-600 dark:text-slate-200 mb-4">{branch.name}</h3>
                        <div className="space-y-3 flex-1">
                            {years.length > 0 ? years.map(year => {
                                // Try ID match first, then Name
                                const uData = data[year].byId[branch.id] || data[year].byName[branch.name] || { total: 0, majors: {} };
                                const hasData = uData.total > 0;

                                return (
                                    <div key={year} className={`p-3 border rounded-xl transition-all ${hasData ? 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700' : 'bg-slate-50/50 dark:bg-slate-900/20 border-transparent opacity-60'}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{year}</span>
                                            <span className={`font-bold text-sm ${hasData ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>{uData.total} Santri</span>
                                        </div>
                                        {hasData && (
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium border-t border-slate-50 dark:border-slate-800 pt-1 mt-1">
                                                {formatMajors(uData.majors)}
                                            </div>
                                        )}
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-8 text-slate-400 text-sm italic">Belum ada data statistik</div>
                            )}
                        </div>
                    </Card>
                ))}

                {filteredBranches.length === 0 && (
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                        <p className="text-slate-400 font-medium">Tidak ada unit sekolah ditemukan untuk kategori {activeTab}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

