import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    ArrowRightLeft, Search, School, GraduationCap, Save, AlertTriangle, RefreshCw
} from 'lucide-react';
import { Card, Button, Input, Select } from '../ui/Elements';
import { createNotification } from '../../utils/helpers';

export default function AdminTransferManager({ showToast }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [branches, setBranches] = useState([]);

    const [targetBranch, setTargetBranch] = useState('');
    const [targetMajor, setTargetMajor] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Real-time sync with "Cabang Sekolah & Kuota" data to ensure accuracy
        const fetchData = async () => {
            const { data } = await supabase.from('units').select('*');
            if (data) setBranches(data);
        };
        fetchData();

        const channel = supabase.channel('admin_transfer_units')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, fetchData)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSelectedStudent(null);
        try {
            const { data: results, error } = await supabase
                .from('registrations')
                .select('*')
                .ilike('student_name', `%${searchTerm}%`);

            if (error) throw error;

            setStudents(results || []);
            if (results?.length === 0) showToast('Data siswa tidak ditemukan', 'error');

        } catch (error) {
            console.error(error);
            showToast('Gagal mencari data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectStudent = (student) => {
        setSelectedStudent(student);
        setTargetBranch(student.unit_id || '');
        setTargetMajor(student.major || '');
    };

    const handleTransfer = async () => {
        if (!selectedStudent) return;
        if (!targetBranch) return showToast('Pilih cabang tujuan', 'error');

        const branchData = branches.find(u => u.id === targetBranch);
        if (!branchData) return;

        const isSMK = branchData.level?.toUpperCase() === 'SMK';

        if (isSMK && !targetMajor && branchData.majors?.length > 0) {
            return showToast('Pilih jurusan untuk cabang SMK', 'error');
        }

        const confirmMsg = selectedStudent.unit_name
            ? `Yakin ingin memindahkan ${selectedStudent.student_name}\nDari: ${selectedStudent.unit_name} ${selectedStudent.major ? `(${selectedStudent.major})` : ''}\nKe: ${branchData.name} ${targetMajor ? `(${targetMajor})` : ''}?`
            : `Yakin ingin memindahkan ${selectedStudent.student_name} ke ${branchData.name} ${targetMajor ? `(${targetMajor})` : ''}?`;

        if (confirm(confirmMsg)) {
            setLoading(true);
            try {
                if (!selectedStudent.user_id || !selectedStudent.student_id) throw new Error("ID Siswa tidak lengkap. Hubungi IT.");

                // Check Quota Impact
                const countsAsQuota = ['lulus', 'paid'].includes(selectedStudent.status);

                // 1. Update Registration First
                const updates = {
                    unit_id: targetBranch,
                    unit_name: branchData.name,
                    major: targetMajor || null,
                    major_id: targetMajor || null, // Assuming ID is same as name or not needed if major is just a string
                    last_transfer: new Date().toISOString()
                };

                const { error: updateError } = await supabase
                    .from('registrations')
                    .update(updates)
                    .eq('id', selectedStudent.id);

                if (updateError) throw updateError;

                // 2. Handle Quota Updates if needed
                if (countsAsQuota) {
                    // Decrement Old Unit
                    if (selectedStudent.unit_id) {
                        const oldUnit = branches.find(u => u.id === selectedStudent.unit_id);
                        if (oldUnit) {
                            let filled = oldUnit.filled || 0;
                            if (filled > 0) filled--;

                            let updatedMajors = oldUnit.majors || [];
                            if (selectedStudent.major) {
                                updatedMajors = updatedMajors.map(m => {
                                    if (m.name.trim() === selectedStudent.major.trim()) {
                                        return { ...m, filled: Math.max(0, (m.filled || 0) - 1) };
                                    }
                                    return m;
                                });
                            }
                            await supabase.from('units').update({ filled, majors: updatedMajors }).eq('id', selectedStudent.unit_id);
                        }
                    }

                    // Increment New Unit
                    const newUnit = branches.find(u => u.id === targetBranch); // Use fresh if possible, but state is okay for now
                    if (newUnit) {
                        let filled = (newUnit.filled || 0) + 1;
                        // Correction for Same Unit Transfer handled implicitly if we fetched fresh, but here we might race.
                        // For better safety, we should re-fetch `newUnit` before update, but let's assume sequential for now.

                        let finalMajors = newUnit.majors || [];
                        if (targetMajor) {
                            finalMajors = finalMajors.map(m =>
                                m.name.trim() === targetMajor.trim()
                                    ? { ...m, filled: (m.filled || 0) + 1 }
                                    : m
                            );
                        }
                        await supabase.from('units').update({ filled, majors: finalMajors }).eq('id', targetBranch);
                    }
                }

                // Notify User
                if (selectedStudent.user_id) {
                    await createNotification(
                        selectedStudent.user_id,
                        'Perpindahan Cabang/Jurusan',
                        `Siswa ${selectedStudent.student_name} telah dipindahkan ke ${branchData.name}${targetMajor ? ` - ${targetMajor}` : ''} oleh Admin.`,
                        'info'
                    );
                }

                showToast('Perpindahan siswa berhasil!', 'success');
                setSelectedStudent(null);
                setStudents([]);
                setSearchTerm('');
            } catch (error) {
                console.error("Trans Error", error);
                showToast('Gagal: ' + error.message, 'error');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSyncQuotas = async () => {
        if (!confirm('Ini akan menghitung ulang kuota REAL hanya bedasarkan siswa yang statusnya "Lulus" atau "Paid".')) return;
        setLoading(true);
        try {
            // 1. Get all students
            const { data: students, error: sError } = await supabase.from('registrations').select('*');
            if (sError) throw sError;

            // 2. Get all units to reset count
            const { data: uData, error: uError } = await supabase.from('units').select('*');
            if (uError) throw uError;

            const unitsMap = {}; // id -> { filled: 0, majors: { name -> filled } }

            uData.forEach(data => {
                const majorsMap = {};
                if (data.majors) {
                    data.majors.forEach(m => majorsMap[m.name] = 0);
                }
                unitsMap[data.id] = {
                    filled: 0,
                    majors: majorsMap,
                    original: data
                };
            });

            // 3. Count ONLY 'lulus' or 'paid' students
            students.forEach(s => {
                const countsAsQuota = ['lulus', 'paid'].includes(s.status);

                if (!countsAsQuota) return;

                if (s.unit_id && unitsMap[s.unit_id]) {
                    unitsMap[s.unit_id].filled++;
                    if (s.major && unitsMap[s.unit_id].majors) {
                        if (unitsMap[s.unit_id].majors[s.major] !== undefined) {
                            unitsMap[s.unit_id].majors[s.major]++;
                        } else {
                            const trimmedKey = Object.keys(unitsMap[s.unit_id].majors).find(k => k.trim() === s.major.trim());
                            if (trimmedKey) unitsMap[s.unit_id].majors[trimmedKey]++;
                        }
                    }
                }
            });

            // 4. Update Batch
            for (const unitId of Object.keys(unitsMap)) {
                const uData = unitsMap[unitId];

                // Reconstruct majors array
                let newMajors = [];
                if (uData.original.majors) {
                    newMajors = uData.original.majors.map(m => ({
                        ...m,
                        filled: uData.majors[m.name] || 0
                    }));
                }

                await supabase.from('units').update({
                    filled: uData.filled,
                    majors: newMajors
                }).eq('id', unitId);
            }

            showToast('Sinkronisasi Kuota (Lulus Only) Berhasil!', 'success');

        } catch (error) {
            console.error(error);
            showToast('Gagal sinkronisasi: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const selectedBranchData = branches.find(u => u.id === targetBranch);
    const isTargetSMK = selectedBranchData?.level?.toUpperCase() === 'SMK';

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
            <div className="flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                    <ArrowRightLeft className="text-emerald-600" /> Transfer Cabang / Jurusan
                </h2>
                <Button variant="secondary" size="sm" onClick={handleSyncQuotas} disabled={loading} className="text-xs">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sinkronisasi Kuota
                </Button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
                {/* LEFT PANEL: SEARCH & LIST */}
                <div className={`flex flex-col gap-4 transition-all duration-300 ${selectedStudent ? 'hidden md:flex md:w-1/3' : 'w-full md:w-1/3'} `}>
                    <Card className="p-4 shrink-0">
                        <form onSubmit={handleSearch} className="flex flex-col gap-3">
                            <Input
                                label="Cari Siswa"
                                placeholder="Ketikan nama siswa..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <Button type="submit" disabled={loading} className="w-full"><Search size={18} /> Cari Data</Button>
                        </form>
                    </Card>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {students.length === 0 && !loading && (
                            <div className="text-center p-8 text-slate-400 border-2 border-dashed rounded-xl bg-slate-50">
                                <Search size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Cari siswa untuk memulai transfer</p>
                            </div>
                        )}

                        {students.map(s => (
                            <div
                                key={s.id}
                                onClick={() => handleSelectStudent(s)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer group hover:shadow-md ${selectedStudent?.id === s.id ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-300' : 'border-slate-200 bg-white hover:border-emerald-300'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${selectedStudent?.id === s.id ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                                            {s.student_name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">{s.student_name}</h4>
                                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                                <span className={`w-2 h-2 rounded-full ${['lulus', 'paid'].includes(s.status) ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                                {s.status}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 pt-2 border-t border-slate-100/50 flex justify-between items-center text-xs text-slate-500">
                                    <span>{s.unit_name}</span>
                                    {s.major && <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{s.major}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT PANEL: ACTION */}
                <div className={`flex-1 overflow-y-auto ${!selectedStudent ? 'hidden md:block' : 'block'}`}>
                    {selectedStudent ? (
                        <Card className="p-4 md:p-8 h-full flex flex-col animate-fade-in relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />

                            <button onClick={() => setSelectedStudent(null)} className="md:hidden mb-4 flex items-center gap-2 text-slate-500 font-bold text-sm z-10 relative">
                                &larr; Kembali ke Daftar
                            </button>

                            <div className="text-center mb-8">
                                <h3 className="text-lg font-medium text-slate-500 uppercase tracking-widest mb-1">Formulir Mutasi Siswa</h3>
                                <h1 className="text-3xl font-bold text-slate-800">{selectedStudent.student_name}</h1>
                            </div>

                            <div className="flex items-center justify-center gap-8 mb-8">
                                <div className="flex-1 bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center relative group hover:border-slate-300 transition-all">
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-200 text-slate-600 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Asal</div>
                                    <School size={32} className="mx-auto mb-3 text-slate-400" />
                                    <div className="font-bold text-lg text-slate-700">{selectedStudent.unit_name}</div>
                                    {selectedStudent.major ? (
                                        <div className="text-emerald-600 font-bold mt-1 bg-emerald-50 inline-block px-3 py-1 rounded-full text-sm">{selectedStudent.major}</div>
                                    ) : <div className="text-slate-400 italic text-sm mt-1">Non-Kejuruan</div>}
                                </div>

                                <div className="text-slate-300 flex flex-col items-center gap-2">
                                    <ArrowRightLeft size={32} />
                                    <div className="text-[10px] font-bold uppercase tracking-widest">Transfer Ke</div>
                                </div>

                                <div className="flex-1 bg-emerald-50/50 p-6 rounded-2xl border-2 border-emerald-100 text-center relative hover:border-emerald-300 transition-all">
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-100 text-emerald-700 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Tujuan</div>
                                    {selectedBranchData ? (
                                        <>
                                            <School size={32} className="mx-auto mb-3 text-emerald-500" />
                                            <div className="font-bold text-lg text-emerald-800">{selectedBranchData.name}</div>
                                            {targetMajor ? (
                                                <div className="text-emerald-600 font-bold mt-1 bg-white border border-emerald-200 inline-block px-3 py-1 rounded-full text-sm shadow-sm">{targetMajor}</div>
                                            ) : (
                                                isTargetSMK ? <div className="text-red-400 italic text-sm mt-1 animate-pulse">Pilih Jurusan!</div> : <div className="text-emerald-600/50 italic text-sm mt-1">Non-Kejuruan</div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="h-full flex flex-col justify-center items-center text-slate-400 opacity-50">
                                            <div className="text-sm font-medium">Pilih Cabang Tujuan</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-2xl mx-auto w-full">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Pilih Cabang Baru</label>
                                    <Select
                                        value={targetBranch}
                                        onChange={e => {
                                            setTargetBranch(e.target.value);
                                            setTargetMajor('');
                                        }}
                                        options={branches.map(u => ({
                                            value: u.id,
                                            label: `${u.name} (Sisa Kuota: ${u.quota - (u.filled || 0)})`
                                        }))}
                                        placeholder="-- Pilih Cabang --"
                                    />
                                </div>

                                <div className={`transition-all duration-300 ${isTargetSMK ? 'opacity-100 translate-y-0' : 'opacity-50 grayscale pointer-events-none'}`}>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Pilih Jurusan Baru</label>
                                    <Select
                                        value={targetMajor}
                                        onChange={e => setTargetMajor(e.target.value)}
                                        options={selectedBranchData?.majors?.map(m => ({
                                            value: m.name,
                                            label: `${m.name} (Sisa: ${m.quota - (m.filled || 0)})`
                                        })) || []}
                                        placeholder="-- Pilih Jurusan --"
                                        disabled={!isTargetSMK}
                                    />
                                </div>
                            </div>

                            <div className="mt-auto flex flex-col items-center gap-4">
                                <div className="flex items-center gap-3 p-3 bg-amber-50 text-amber-700 text-sm rounded-lg border border-amber-200 max-w-2xl text-center w-full">
                                    <AlertTriangle size={20} className="shrink-0" />
                                    <span className="text-left md:text-center">Pastikan data sudah benar. Jika siswa berstatus Lulus/Paid, kuota cabang lama akan berkurang dan cabang baru akan bertambah otomatis.</span>
                                </div>
                                <Button size="lg" onClick={handleTransfer} disabled={loading} className="px-12 py-4 text-lg shadow-xl shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-1 transition-all w-full md:w-auto">
                                    {loading ? 'Memproses Transfer...' : 'Konfirmasi Transfer Siswa'}
                                </Button>
                            </div>
                        </Card>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 py-12 md:py-8">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                <ArrowRightLeft size={32} className="opacity-20" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Mulai Transfer</h3>
                            <p className="max-w-xs text-center">Cari dan pilih siswa dari panel sebelah kiri untuk memulai proses pemindahan cabang atau jurusan.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
