import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import { Card, Button } from '../ui/Elements';
import { Download, Filter, Globe, MapPin } from 'lucide-react';
// import * as XLSX from 'xlsx'; // Removed unused dependency
// Checking package.json... xlsx is NOT in package.json. User has html2canvas, jspdf, lodash.
// I will implement CSV export manually to avoid dependency issues.

export default function AdminDemographics({ showToast }) {
    const [registrations, setRegistrations] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [filterYear, setFilterYear] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchAllData = async () => {
        try {
            // Fetch Academic Years
            const { data: ayData } = await supabase.from('academic_years').select('*');
            if (ayData) {
                setAcademicYears(ayData);

                // Set default year if not set
                // We use a functional update or ref check if we want to avoid closure staleness, 
                // but since this is called in useEffect, we can check state. 
                // However, inside async function, state 'filterYear' might be stale if not careful.
                // But for initialization, it is "''".
                setFilterYear(prev => {
                    if (prev) return prev;
                    const def = ayData.find(y => y.is_default);
                    return def ? def.year : (ayData[0]?.year || '');
                });
            }

            // Fetch Registrations
            const { data: rData } = await supabase.from('registrations').select('id, academic_year, wave_name, biodata');
            if (rData) {
                setRegistrations(rData);
            }
            setLoading(false);
        } catch (error) {
            console.error(error);
        }
    };

    // Fetch Data
    useEffect(() => {
        fetchAllData();

        const channel = supabase.channel('admin_demographics')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_years' }, fetchAllData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, fetchAllData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Process Data
    const stats = useMemo(() => {
        if (!filterYear) return { province: [], city: [] };

        const filtered = registrations.filter(r => {
            // Match Year logic similar to Dashboard
            if (r.academic_year === filterYear) return true;
            if (r.wave_name?.includes(filterYear)) return true;
            return false;
        });

        // Helper to normalize address
        const normalize = (str) => str ? str.trim().toUpperCase() : 'BELUM MENGISI';

        // Count Provinces
        const provMap = {};
        const cityMap = {};

        filtered.forEach(r => {
            const address = r.biodata?.address || {};
            const prov = normalize(address.province);
            const city = normalize(address.regency || address.city); // Support both naming conventions

            provMap[prov] = (provMap[prov] || 0) + 1;
            cityMap[city] = (cityMap[city] || 0) + 1;
        });

        // Convert to Array & Sort
        const toArray = (map) => Object.entries(map)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value);

        return {
            province: toArray(provMap),
            city: toArray(cityMap),
            total: filtered.length
        };
    }, [registrations, filterYear]);

    // Export Excel (CSV actually)
    const handleDownload = () => {
        if (stats.province.length === 0) {
            showToast('Tidak ada data untuk diunduh', 'error');
            return;
        }

        // Prepare CSV Content
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += `Laporan Demografi Pendaftar Tahun Ajaran ${filterYear}\n\n`;

        csvContent += "SEBARAN PROVINSI\n";
        csvContent += "Provinsi,Jumlah\n";
        stats.province.forEach(row => {
            csvContent += `"${row.label}","${row.value}"\n`;
        });

        csvContent += "\nSEBARAN KOTA/KABUPATEN\n";
        csvContent += "Kota/Kabupaten,Jumlah\n";
        stats.city.forEach(row => {
            csvContent += `"${row.label}","${row.value}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `demografi_pendaftar_${filterYear.replace('/', '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Data berhasil diunduh (CSV)', 'success');
    };

    // Chart Components (Simple CSS Conic Gradient)
    const SimplePieChart = ({ data, isDonut = false }) => {
        if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-slate-400">Belum ada data</div>;

        const total = data.reduce((acc, curr) => acc + curr.value, 0);
        let currentAngle = 0;
        const colors = [
            '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
            '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#14b8a6',
            '#d946ef', '#f97316', '#22c55e', '#0ea5e9', '#eab308'
        ];

        const gradientParts = data.map((item, idx) => {
            const percentage = (item.value / total) * 100;
            const angle = (item.value / total) * 360;
            const start = currentAngle;
            const end = currentAngle + angle;
            currentAngle = end;
            return `${colors[idx % colors.length]} ${start}deg ${end}deg`;
        }).join(', ');

        return (
            <div className="flex flex-col md:flex-row items-center gap-8 justify-center">
                <div className="relative w-64 h-64 rounded-full shadow-lg shrink-0"
                    style={{ background: `conic-gradient(${gradientParts})` }}
                >
                    {isDonut && <div className="absolute inset-0 m-auto w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-inner">
                        <span className="font-bold text-2xl text-slate-700">{total}</span>
                    </div>}
                </div>

                {/* Legend */}
                <div className="flex-1 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-1 gap-2">
                        {data.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs p-1 hover:bg-slate-50 rounded">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                                    <span className="font-medium text-slate-600 truncate max-w-[150px]">{item.label}</span>
                                </div>
                                <span className="font-bold text-slate-800">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        Demografi Pendaftaran
                    </h2>
                    <p className="text-slate-500 text-sm">Analisis sebaran wilayah asal pendaftar</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <select
                            className="appearance-none bg-slate-50 border border-slate-200 pl-4 pr-10 py-2 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                        >
                            {academicYears.map(ay => (
                                <option key={ay.id} value={ay.year}>{ay.year}</option>
                            ))}
                        </select>
                        <Filter className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                    </div>

                    <Button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2">
                        <Download size={16} /> Download CSV
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Chart 1: Provinsi */}
                <Card className="p-6 bg-white min-h-[400px]">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Globe size={18} className="text-emerald-600" />
                        Sebaran Pendaftar per Provinsi
                    </h3>
                    <SimplePieChart data={stats.province} isDonut={true} />
                </Card>

                {/* Chart 2: Kota */}
                <Card className="p-6 bg-white min-h-[400px]">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <MapPin size={18} className="text-blue-600" />
                        Sebaran Pendaftar per Kabupaten/Kota
                    </h3>
                    <SimplePieChart data={stats.city} isDonut={false} />
                </Card>
            </div>
        </div>
    );
}
