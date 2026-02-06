import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import {
    FileSpreadsheet, Search, Filter, Download, MessageCircle,
    Eye, FileText, User, MapPin, Phone, ChevronLeft, ChevronRight,
    Edit, Lock, Save, X
} from 'lucide-react';
import { Card, Button, Badge, Input, Select } from '../ui/Elements';
import { Modal } from '../ui/Overlays';
import { sendWhatsappMessage } from '../../utils/helpers';

const PhoneCell = ({ userId, initial }) => {
    const [phone, setPhone] = useState(initial);
    useEffect(() => {
        if (phone || !userId) return;
        const fetchPhone = async () => {
            const { data } = await supabase.from('profiles').select('phone').eq('id', userId).single();
            if (data) setPhone(data.phone);
        };
        fetchPhone();
    }, [userId, phone]);

    return <span>{phone || <span className="text-slate-300 italic">No Phone</span>}</span>;
};

export default function AdminStudentReport({ showToast }) { // Receive showToast prop
    const [data, setData] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [search, setSearch] = useState('');
    const [filterBranch, setFilterBranch] = useState('');
    const [branches, setBranches] = useState([]);
    const [waves, setWaves] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [filterYear, setFilterYear] = useState('');

    // Pagination State
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Detail Modal State
    const [viewModal, setViewModal] = useState(null);
    const [studentDetail, setStudentDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [activeTab, setActiveTab] = useState('biodata'); // 'biodata' or 'berkas'

    // Edit Mode State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editFormData, setEditFormData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Password Verification Modal
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [adminSettings, setAdminSettings] = useState(null);

    const fetchData = async () => {
        const { data: regs } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });
        if (regs) {
            setData(regs);
            setFiltered(regs);
        }
        const { data: units } = await supabase.from('units').select('*');
        if (units) setBranches(units);

        const { data: wv } = await supabase.from('waves').select('*');
        if (wv) setWaves(wv);

        const { data: ays } = await supabase.from('academic_years').select('*');
        if (ays) setAcademicYears(ays);

        const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 'main').single();
        if (settings) setAdminSettings(settings);
    };

    useEffect(() => {
        fetchData();

        const channel = supabase.channel('admin_report_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, fetchData)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const yearOptions = useMemo(() => {
        if (academicYears.length > 0) {
            return academicYears.map(ay => ({
                id: ay.id,
                name: ay.name || ay.year // Handle 'year' field from academic_years collection
            }));
        }
        // Fallback 1: From Waves
        const fromWaves = [...new Set(waves.map(w => w.year).filter(Boolean))];
        if (fromWaves.length > 0) return fromWaves.map(y => ({ id: y, name: y }));
        // Fallback 2: From Data
        const fromData = [...new Set(data.map(r => r.academic_year_name || r.year).filter(Boolean))];
        return fromData.map(y => ({ id: y, name: y }));
    }, [academicYears, waves, data]);

    const [filterCategory, setFilterCategory] = useState('all'); // all, unpaid_reg, unpaid_rereg

    useEffect(() => {
        let res = data;

        // 1. Text Search
        if (search) res = res.filter(r => r.student_name.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase()));

        // 2. Branch Filter
        if (filterBranch) res = res.filter(r => r.unit_id === filterBranch);

        // 3. Year Filter
        if (filterYear) {
            res = res.filter(r => r.academic_year_id === filterYear || r.academic_year_name === filterYear || r.year === filterYear);
        }

        // 3. Category Filter
        if (filterCategory === 'unpaid_reg') {
            res = res.filter(r => r.status === 'submitted'); // Belum bayar pendaftaran
        } else if (filterCategory === 'unpaid_rereg') {
            res = res.filter(r => r.status === 'lulus'); // Belum daftar ulang
        } else if (filterCategory === 'draft') {
            res = res.filter(r => r.status === 'draft'); // Belum selesai
        }

        setFiltered(res);
    }, [search, filterBranch, filterCategory, data]);

    const handleViewDetail = async (reg) => {
        setViewModal(reg);
        setLoadingDetail(true);
        setActiveTab('biodata');
        setIsEditMode(false);
        setEditFormData(null);

        // Use biodata from the record if available, otherwise formatted object
        // We merge top-level columns into the detail view if needed, but the form mainly uses biodata structure
        let details = reg.biodata || {};

        // Ensure some fields are present from top-level if missing in biodata
        if (!details.name) details.name = reg.student_name;

        setStudentDetail(details);
        setLoadingDetail(false);
    };

    // Handle Edit Button Click - Show Password Modal
    const handleEditClick = () => {
        setShowPasswordModal(true);
        setAdminPassword('');
        setPasswordError('');
    };

    // Verify Admin Password using Supabase Auth
    const [isVerifying, setIsVerifying] = useState(false);

    const handleVerifyPassword = async () => {
        if (!adminPassword) {
            setPasswordError('Masukkan password!');
            return;
        }

        setIsVerifying(true);
        setPasswordError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !user.email) throw new Error("Sesi habis. Silakan login ulang.");

            // Verify by attempting to sign in (or re-auth if Supabase supported it directly, but signIn works)
            const { error } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: adminPassword
            });

            if (error) {
                throw error;
            }

            // Success - Close password modal and enable edit mode
            setShowPasswordModal(false);
            setIsEditMode(true);
            // Initialize edit form with current data
            setEditFormData({
                ...studentDetail,
                // Flatten some nested data for easier editing
                name: studentDetail?.name || viewModal?.student_name || '',
                nik: studentDetail?.nik || '',
                nisn: studentDetail?.nisn || '',
                pob: studentDetail?.pob || '',
                dob: studentDetail?.dob || '',
                gender: studentDetail?.gender || '',
                religion: studentDetail?.religion || '',
                child_order: studentDetail?.child_order || '',
                siblings_count: studentDetail?.siblings_count || '',
                height: studentDetail?.height || '',
                weight: studentDetail?.weight || '',
                blood_type: studentDetail?.blood_type || '',
                address: studentDetail?.address || {},
                education: studentDetail?.education || {},
                parents: studentDetail?.parents || {}
            });
            setAdminPassword('');
        } catch (error) {
            console.error("Re-auth error:", error);
            setPasswordError('Password salah atau verifikasi gagal.');
        }
        setIsVerifying(false);
    };

    // Cancel Edit Mode
    const handleCancelEdit = () => {
        setIsEditMode(false);
        setEditFormData(null);
    };

    // Save Edited Data
    const handleSaveEdit = async () => {
        if (!viewModal?.id) {
            showToast('Data tidak lengkap untuk menyimpan', 'error');
            return;
        }

        setIsSaving(true);
        try {
            // Prepare payload
            const updatedBiodata = {
                ...studentDetail,
                ...editFormData,
                updated_at: new Date().toISOString() // Add timestamp to biodata
            };

            const updates = {
                biodata: updatedBiodata,
                updated_at: new Date().toISOString()
            };

            // If name changed, update top-level column too
            if (editFormData.name && editFormData.name !== viewModal.student_name) {
                updates.student_name = editFormData.name;
            }

            const { error } = await supabase.from('registrations').update(updates).eq('id', viewModal.id);

            if (error) throw error;

            // Update local state
            setStudentDetail(updatedBiodata);

            // Also update viewModal name if changed
            if (updates.student_name) {
                setViewModal(prev => ({ ...prev, student_name: updates.student_name }));
            }

            setIsEditMode(false);
            setEditFormData(null);
            showToast('Data berhasil diperbarui!');
            fetchData(); // Refresh list to show changes
        } catch (e) {
            console.error("Error saving edit:", e);
            showToast('Gagal menyimpan perubahan: ' + e.message, 'error');
        }
        setIsSaving(false);
    };

    // Helper to update nested form data
    const updateFormField = (path, value) => {
        setEditFormData(prev => {
            const newData = { ...prev };
            const keys = path.split('.');
            let current = newData;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            return newData;
        });
    };

    // Reset pagination when filters change
    useEffect(() => { setCurrentPage(1); }, [search, filterBranch, filterYear, filterCategory]);

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    const exportCSV = async () => {
        const confirmExport = window.confirm("Export data lengkap akan memakan waktu tergantung jumlah siswa. Lanjutkan?");
        if (!confirmExport) return;

        const detailedRows = [];
        const headers = [
            "ID Pendaftaran", "Tanggal Daftar", "Status",
            "Cabang Tujuan", "Jurusan", "Jalur", "Gelombang",
            "Nilai Psikotes",
            // Biodata Siswa
            "Nama Lengkap", "Nama Panggilan", "NIK", "NISN", "Tempat Lahir", "Tanggal Lahir", "Jenis Kelamin", "Agama",
            "Anak Ke", "Jml Saudara", "Tinggi (cm)", "Berat (kg)", "Gol. Darah", "Penyakit", "Alergi", "Kebutuhan Khusus",
            // Alamat
            "Alamat Lengkap", "Provinsi", "Kota/Kab", "Kecamatan", "Desa/Kel", "Kode Pos", "Jarak (km)", "Status Tinggal",
            // Pendidikan
            "Sekolah Asal", "NPSN", "Status Sekolah", "Tahun Lulus", "No Ijazah", "Prestasi",
            // Nilai
            "Nilai MTK", "Nilai B.Ind", "Nilai B.Ing", "Nilai IPA",
            // Ayah
            "Nama Ayah", "NIK Ayah", "Pekerjaan Ayah", "Pendidikan Ayah", "Penghasilan Ayah", "No HP Ayah",
            // Ibu
            "Nama Ibu", "NIK Ibu", "Pekerjaan Ibu", "Pendidikan Ibu", "Penghasilan Ibu", "No HP Ibu",
            // Wali
            "Nama Wali", "Hubungan", "No HP Wali"
        ];

        // Helper to safe get nested
        const get = (obj, path) => path.split('.').reduce((acc, part) => acc && acc[part], obj) || '-';

        for (const r of filtered) {
            let details = r.biodata || {};

            // Combine registration data (r) and detailed student data (details)
            detailedRows.push([
                r.id, r.created_at ? new Date(r.created_at).toLocaleDateString() : '-', r.status,
                r.unit_name, r.major || '-', r.path_name, r.wave_name,
                r.psychotest_result?.final_score || '0',

                // Student
                details.name || r.student_name, get(details, 'nickname'), get(details, 'nik'), get(details, 'nisn'), get(details, 'pob'), get(details, 'dob'), get(details, 'gender'), get(details, 'religion'),
                get(details, 'child_order'), get(details, 'siblings_count'), get(details, 'height'), get(details, 'weight'), get(details, 'blood_type'), get(details, 'diseases'), get(details, 'allergies'), get(details, 'special_needs'),

                // Address
                get(details, 'address.street'), get(details, 'address.province'), get(details, 'address.regency'), get(details, 'address.district'), get(details, 'address.village'), get(details, 'address.postal_code'), get(details, 'address.distance'), get(details, 'address.residence_status'),

                // Education
                get(details, 'education.origin_school'), get(details, 'education.npsn'), get(details, 'education.school_status'), get(details, 'education.grad_year'), get(details, 'education.diploma_no'), get(details, 'education.achievements'),
                get(details, 'education.grade_math'), get(details, 'education.grade_ind'), get(details, 'education.grade_eng'), get(details, 'education.grade_ipa'),

                // Father
                get(details, 'parents.father.name'), get(details, 'parents.father.nik'), get(details, 'parents.father.job'), get(details, 'parents.father.education'), get(details, 'parents.father.income'), get(details, 'parents.father.phone'),

                // Mother
                get(details, 'parents.mother.name'), get(details, 'parents.mother.nik'), get(details, 'parents.mother.job'), get(details, 'parents.mother.education'), get(details, 'parents.mother.income'), get(details, 'parents.mother.phone'),

                // Guardian
                get(details, 'parents.guardian.name'), get(details, 'parents.guardian.relation'), get(details, 'parents.guardian.phone')
            ].map(String).map(s => s.replace(/"/g, '""'))); // Simple escape
        }

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...detailedRows.map(e => e.map(i => `"${i}"`).join(','))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Data_Lengkap_PSB_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSendReminder = async (student, type) => {
        let confirmMsg = `Kirim reminder ke ${student.student_name}?`;
        if (type === 'payment') confirmMsg = `Kirim reminder BAYAR PENDAFTARAN ke ${student.student_name}?`;
        if (type === 'reregistration') confirmMsg = `Kirim reminder DAFTAR ULANG ke ${student.student_name}?`;
        if (type === 'document') confirmMsg = `Kirim reminder LENGKAPI DOKUMEN ke ${student.student_name}?`;

        if (!confirm(confirmMsg)) return;

        try {
            // 1. Get Settings
            const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 'main').single();
            if (!settings) throw new Error("Pengaturan tidak ditemukan");

            let template = '';
            if (type === 'payment') template = settings.template_payment_reminder;
            else if (type === 'reregistration') template = settings.template_reminder; // Existing key for rereg
            else if (type === 'document') template = settings.template_document_reminder;

            if (!template) throw new Error("Template pesan belum diatur di Pengaturan Aplikasi.");

            // 2. Get Phone
            let phone = '';
            // Try User Profile First
            const { data: profile } = await supabase.from('profiles').select('phone').eq('id', student.user_id).single();
            if (profile?.phone) phone = profile.phone;

            // Fallback to Parents Data in biodata
            if (!phone && student.biodata?.parents) {
                const p = student.biodata.parents;
                phone = p.father?.phone || p.mother?.phone || p.guardian?.phone;
            }

            if (!phone) throw new Error("Nomor HP tidak ditemukan (Cek Profil Akun / Data Wali).");

            // 3. Send
            const msg = template.replace(/{name}/g, student.student_name);
            await sendWhatsappMessage(phone, msg);
            showToast(`Reminder terkirim ke ${student.student_name}`);

        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        }
    };

    const handleOpenDocument = async (dataUrl) => {
        if (!dataUrl) return;

        // If simple URL
        if (dataUrl.startsWith('http')) {
            window.open(dataUrl, '_blank');
            return;
        }

        // If Base64
        const win = window.open();
        win.document.write('<iframe src="' + dataUrl + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><FileSpreadsheet className="text-emerald-600" /> Data Pendaftar</h2>
                <Button onClick={exportCSV} variant="secondary" className="text-sm"><Download size={16} /> Export CSV</Button>
            </div>

            {/* Quick Filter Tabs */}
            {/* Quick Filter Tabs */}
            <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-200">
                <button
                    onClick={() => setFilterCategory('all')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition-all ${filterCategory === 'all' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-emerald-600'}`}
                >
                    Semua Data
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${filterCategory === 'all' ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                        {data.length}
                    </span>
                </button>
                <button
                    onClick={() => setFilterCategory('unpaid_reg')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition-all ${filterCategory === 'unpaid_reg' ? 'border-amber-500 text-amber-700 bg-amber-50/50' : 'border-transparent text-slate-500 hover:text-amber-600'}`}
                >
                    Belum Bayar Daftar
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${filterCategory === 'unpaid_reg' ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                        {data.filter(r => r.status === 'submitted').length}
                    </span>
                </button>
                <button
                    onClick={() => setFilterCategory('unpaid_rereg')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition-all ${filterCategory === 'unpaid_rereg' ? 'border-blue-500 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-blue-600'}`}
                >
                    Belum Daftar Ulang
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${filterCategory === 'unpaid_rereg' ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                        {data.filter(r => r.status === 'lulus').length}
                    </span>
                </button>
                <button
                    onClick={() => setFilterCategory('draft')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition-all ${filterCategory === 'draft' ? 'border-slate-500 text-slate-700 bg-slate-50/50' : 'border-transparent text-slate-500 hover:text-slate-600'}`}
                >
                    Belum Lengkap (Draft)
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${filterCategory === 'draft' ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'}`}>
                        {data.filter(r => r.status === 'draft').length}
                    </span>
                </button>
            </div>

            <Card className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-20 shrink-0">
                        <select
                            className="w-full border p-2 rounded-lg text-sm outline-none font-bold text-center cursor-pointer hover:bg-slate-50 focus:ring-1 focus:ring-emerald-500"
                            value={itemsPerPage}
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            title="Jumlah baris per halaman"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <div className="relative">
                            <input className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="Cari Nama / ID Pendaftaran..." value={search} onChange={e => setSearch(e.target.value)} />
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <select className="w-full md:w-40 border p-2 rounded-lg text-sm outline-none" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                            <option value="">Semua Tahun</option>
                            {yearOptions.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                        </select>
                        <select className="w-full md:w-48 border p-2 rounded-lg text-sm outline-none" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                            <option value="">Semua Cabang</option>
                            {branches.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                </div>
            </Card>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs border-b">
                            <tr>
                                <th className="p-4 w-12 text-center">No</th>
                                <th className="p-4">No. WhatsApp</th>
                                <th className="p-4">Nama Lengkap</th>
                                <th className="p-4">Cabang</th>
                                <th className="p-4">Program</th>
                                <th className="p-4 text-center">Voucher Digunakan</th>
                                <th className="p-4">Pendaftaran</th>
                                <th className="p-4">Waktu Daftar</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-center">Opsi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {currentItems.length > 0 ? currentItems.map((r, idx) => (
                                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-center text-slate-500 font-mono text-xs">{indexOfFirstItem + idx + 1}</td>
                                    <td className="p-4 font-mono text-xs text-slate-600">
                                        <PhoneCell userId={r.user_id} initial={r.user_phone} />
                                    </td>
                                    <td className="p-4 font-bold text-slate-700">{r.student_name}</td>
                                    <td className="p-4 text-slate-600">{r.unit_name}</td>
                                    <td className="p-4">
                                        <div className="text-slate-600">{r.major || '-'}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        {r.voucher_code ? (
                                            <span className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded text-xs font-bold border border-emerald-200 uppercase">
                                                {r.voucher_code}
                                            </span>
                                        ) : (
                                            <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-xs font-bold">Tidak</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-slate-600">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${(r.is_internal || r.category === 'Internal' || (r.path_name && r.path_name.toLowerCase().includes('internal')))
                                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                            : 'bg-sky-100 text-sky-700 border border-sky-200'
                                            }`}>
                                            {(r.is_internal || r.category === 'Internal' || (r.path_name && r.path_name.toLowerCase().includes('internal'))) ? 'Internal' : 'Eksternal'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-xs text-slate-500 font-mono">
                                        {r.created_at ? new Date(r.created_at).toLocaleString('id-ID') : '-'}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <Badge status={r.status} />
                                            {(r.path_name || '').toLowerCase().includes('prestasi') && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-700 border border-purple-200 tracking-wide">
                                                    PRESTASI
                                                </span>
                                            )}
                                            {(r.path_name || '').toLowerCase().includes('yatim') && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200 tracking-wide">
                                                    YATIM
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center flex justify-center gap-2">
                                        <button onClick={() => handleViewDetail(r)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 text-xs font-bold transition flex items-center gap-1">
                                            <Eye size={14} /> Detail
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="9" className="p-8 text-center text-slate-400">Tidak ada data ditemukan.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Footer */}
                <div className="p-4 border-t bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-xs text-slate-500">
                        Menampilkan <span className="font-bold text-slate-700">{Math.min(indexOfFirstItem + 1, filtered.length)}-{Math.min(indexOfLastItem, filtered.length)}</span> dari <span className="font-bold text-slate-700">{filtered.length}</span> data
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
                            <button
                                disabled={currentPage === 1}
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

            {/* Application Detail Modal */}
            <Modal isOpen={!!viewModal} onClose={() => { setViewModal(null); setStudentDetail(null); }} title="Detail Data Pendaftar" maxWidth="max-w-5xl">
                {viewModal && (
                    <div className="space-y-4">
                        {/* Header Summary */}
                        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xl">
                                {viewModal.student_name?.[0]}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">{viewModal.student_name}</h3>
                                <div className="text-sm text-slate-500 flex flex-wrap gap-2 items-center">
                                    <span>#{viewModal.id.slice(0, 8)}</span>
                                    <span>•</span>
                                    <span>{viewModal.unit_name}</span>
                                    <span>•</span>
                                    <Badge status={viewModal.status} />
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-200">
                            <button
                                onClick={() => setActiveTab('biodata')}
                                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'biodata' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                <User size={16} className="inline mr-1" /> Biodata Siswa
                            </button>
                            <button
                                onClick={() => setActiveTab('berkas')}
                                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'berkas' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                <FileText size={16} className="inline mr-1" /> Berkas Dokumen
                            </button>
                        </div>

                        {/* Content */}
                        <div className="min-h-[300px]">
                            {loadingDetail ? (
                                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
                            ) : (
                                <>
                                    {activeTab === 'biodata' && studentDetail && (
                                        <div className="space-y-6 text-sm animate-fade-in overflow-y-auto max-h-[60vh] pr-2">
                                            {/* Edit Mode Banner */}
                                            {isEditMode && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-amber-700">
                                                    <Edit size={16} />
                                                    <span className="font-medium">Mode Edit Aktif</span>
                                                    <span className="text-xs">- Ubah data sesuai kebutuhan, lalu klik "Simpan Perubahan"</span>
                                                </div>
                                            )}

                                            {/* 1. Identitas & Fisik */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <h4 className="font-bold text-slate-700 border-b pb-1 flex items-center gap-2"><User size={14} /> Identitas Pribadi</h4>
                                                    {isEditMode && editFormData ? (
                                                        <div className="space-y-3">
                                                            <div>
                                                                <label className="block text-xs text-slate-500 mb-1">Nama Lengkap</label>
                                                                <input type="text" value={editFormData.name || ''} onChange={(e) => updateFormField('name', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">NIK</label>
                                                                    <input type="text" value={editFormData.nik || ''} onChange={(e) => updateFormField('nik', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">NISN</label>
                                                                    <input type="text" value={editFormData.nisn || ''} onChange={(e) => updateFormField('nisn', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Tempat Lahir</label>
                                                                    <input type="text" value={editFormData.pob || ''} onChange={(e) => updateFormField('pob', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Tanggal Lahir</label>
                                                                    <input type="date" value={editFormData.dob || ''} onChange={(e) => updateFormField('dob', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Jenis Kelamin</label>
                                                                    <select value={editFormData.gender || ''} onChange={(e) => updateFormField('gender', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                                                                        <option value="">Pilih</option>
                                                                        <option value="L">Laki-laki</option>
                                                                        <option value="P">Perempuan</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Agama</label>
                                                                    <select value={editFormData.religion || ''} onChange={(e) => updateFormField('religion', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                                                                        <option value="">Pilih</option>
                                                                        <option value="Islam">Islam</option>
                                                                        <option value="Kristen">Kristen</option>
                                                                        <option value="Katolik">Katolik</option>
                                                                        <option value="Hindu">Hindu</option>
                                                                        <option value="Buddha">Buddha</option>
                                                                        <option value="Konghucu">Konghucu</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Anak Ke</label>
                                                                    <input type="number" value={editFormData.child_order || ''} onChange={(e) => updateFormField('child_order', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Jumlah Saudara</label>
                                                                    <input type="number" value={editFormData.siblings_count || ''} onChange={(e) => updateFormField('siblings_count', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-3 gap-y-2 gap-x-4">
                                                            <span className="text-slate-500">NIK</span>
                                                            <span className="col-span-2 font-medium break-all">{studentDetail.nik || '-'}</span>
                                                            <span className="text-slate-500">NISN</span>
                                                            <span className="col-span-2 font-medium">{studentDetail.nisn || '-'}</span>
                                                            <span className="text-slate-500">TTL</span>
                                                            <span className="col-span-2 font-medium">{studentDetail.pob}, {studentDetail.dob}</span>
                                                            <span className="text-slate-500">Gender</span>
                                                            <span className="col-span-2 font-medium">{studentDetail.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                                                            <span className="text-slate-500">Agama</span>
                                                            <span className="col-span-2 font-medium">{studentDetail.religion || '-'}</span>
                                                            <span className="text-slate-500">Anak Ke</span>
                                                            <span className="col-span-2 font-medium">{studentDetail.child_order || '-'} dari {studentDetail.siblings_count || '-'} bersaudara</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-3">
                                                    <h4 className="font-bold text-slate-700 border-b pb-1 flex items-center gap-2"><MapPin size={14} /> Alamat & Fisik</h4>
                                                    {isEditMode && editFormData ? (
                                                        <div className="space-y-3">
                                                            <div className="grid grid-cols-3 gap-3">
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Tinggi (cm)</label>
                                                                    <input type="number" value={editFormData.height || ''} onChange={(e) => updateFormField('height', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Berat (kg)</label>
                                                                    <input type="number" value={editFormData.weight || ''} onChange={(e) => updateFormField('weight', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Gol. Darah</label>
                                                                    <select value={editFormData.blood_type || ''} onChange={(e) => updateFormField('blood_type', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                                                                        <option value="">Pilih</option>
                                                                        <option value="A">A</option>
                                                                        <option value="B">B</option>
                                                                        <option value="AB">AB</option>
                                                                        <option value="O">O</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-slate-500 mb-1">Alamat</label>
                                                                <textarea value={editFormData.address?.street || ''} onChange={(e) => updateFormField('address.street', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" rows={2} />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Desa/Kelurahan</label>
                                                                    <input type="text" value={editFormData.address?.village || ''} onChange={(e) => updateFormField('address.village', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Kecamatan</label>
                                                                    <input type="text" value={editFormData.address?.district || ''} onChange={(e) => updateFormField('address.district', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Kota/Kabupaten</label>
                                                                    <input type="text" value={editFormData.address?.regency || ''} onChange={(e) => updateFormField('address.regency', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Provinsi</label>
                                                                    <input type="text" value={editFormData.address?.province || ''} onChange={(e) => updateFormField('address.province', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-slate-500 mb-1">Kode Pos</label>
                                                                <input type="text" value={editFormData.address?.postal_code || ''} onChange={(e) => updateFormField('address.postal_code', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-3 gap-y-2 gap-x-4">
                                                            <span className="text-slate-500">Tinggi/Berat</span>
                                                            <span className="col-span-2 font-medium">{studentDetail.height || '-'} cm / {studentDetail.weight || '-'} kg</span>
                                                            <span className="text-slate-500">Gol. Darah</span>
                                                            <span className="col-span-2 font-medium">{studentDetail.blood_type || '-'}</span>
                                                            <span className="text-slate-500">Alamat</span>
                                                            <span className="col-span-2 font-medium">{studentDetail.address?.street || '-'}</span>
                                                            <span className="text-slate-500">Wilayah</span>
                                                            <span className="col-span-2 font-medium">
                                                                {studentDetail.address?.village}, {studentDetail.address?.district}<br />
                                                                {studentDetail.address?.regency}, {studentDetail.address?.province}
                                                            </span>
                                                            <span className="text-slate-500">Kode Pos</span>
                                                            <span className="col-span-2 font-medium">{studentDetail.address?.postal_code || '-'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. Pendidikan Asal */}
                                            <div className="space-y-3">
                                                <h4 className="font-bold text-slate-700 border-b pb-1 flex items-center gap-2"><FileText size={14} /> Pendidikan Asal</h4>
                                                {isEditMode && editFormData ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs text-slate-500 mb-1">Sekolah Asal</label>
                                                            <input type="text" value={editFormData.education?.origin_school || ''} onChange={(e) => updateFormField('education.origin_school', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-slate-500 mb-1">NPSN</label>
                                                            <input type="text" value={editFormData.education?.npsn || ''} onChange={(e) => updateFormField('education.npsn', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-slate-500 mb-1">Tahun Lulus</label>
                                                            <input type="text" value={editFormData.education?.grad_year || ''} onChange={(e) => updateFormField('education.grad_year', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-slate-500 mb-1">No. Ijazah</label>
                                                            <input type="text" value={editFormData.education?.diploma_no || ''} onChange={(e) => updateFormField('education.diploma_no', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                                                        <div className="grid grid-cols-3 gap-y-2">
                                                            <span className="text-slate-500">Sekolah Asal</span>
                                                            <span className="col-span-2 font-medium">{studentDetail.education?.origin_school || '-'}</span>
                                                            <span className="text-slate-500">NPSN</span>
                                                            <span className="col-span-2 font-medium">{studentDetail.education?.npsn || '-'}</span>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-y-2">
                                                            <span className="text-slate-500">Thn Lulus</span>
                                                            <span className="col-span-2 font-medium">{studentDetail.education?.grad_year || '-'}</span>
                                                            <span className="text-slate-500">No. Ijazah</span>
                                                            <span className="col-span-2 font-medium">{studentDetail.education?.diploma_no || '-'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 3. Orang Tua */}
                                            <div className="space-y-3">
                                                <h4 className="font-bold text-slate-700 border-b pb-1 flex items-center gap-2"><User size={14} /> Data Orang Tua</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Ayah */}
                                                    <div className="bg-slate-50 p-4 rounded-lg border">
                                                        <h5 className="font-bold text-slate-500 uppercase text-xs mb-3">Data Ayah</h5>
                                                        {isEditMode && editFormData ? (
                                                            <div className="space-y-2">
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Nama</label>
                                                                    <input type="text" value={editFormData.parents?.father?.name || ''} onChange={(e) => updateFormField('parents.father.name', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">NIK</label>
                                                                    <input type="text" value={editFormData.parents?.father?.nik || ''} onChange={(e) => updateFormField('parents.father.nik', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">No. HP</label>
                                                                    <input type="text" value={editFormData.parents?.father?.phone || ''} onChange={(e) => updateFormField('parents.father.phone', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Pekerjaan</label>
                                                                    <input type="text" value={editFormData.parents?.father?.job || ''} onChange={(e) => updateFormField('parents.father.job', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <span className="text-slate-500">Nama</span>
                                                                    <span className="col-span-2 font-medium">{studentDetail.parents?.father?.name || '-'}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <span className="text-slate-500">NIK</span>
                                                                    <span className="col-span-2 font-medium text-xs font-mono">{studentDetail.parents?.father?.nik || '-'}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <span className="text-slate-500">Pekerjaan</span>
                                                                    <span className="col-span-2 font-medium">{studentDetail.parents?.father?.job || '-'}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <span className="text-slate-500">Pendidikan</span>
                                                                    <span className="col-span-2 font-medium">{studentDetail.parents?.father?.education || '-'}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <span className="text-slate-500">Penghasilan</span>
                                                                    <span className="col-span-2 font-medium">{studentDetail.parents?.father?.income || '-'}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <span className="text-slate-500">No. HP</span>
                                                                    <span className="col-span-2 font-medium flex items-center gap-1"><Phone size={10} /> {studentDetail.parents?.father?.phone || '-'}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Ibu */}
                                                    <div className="bg-slate-50 p-4 rounded-lg border">
                                                        <h5 className="font-bold text-slate-500 uppercase text-xs mb-3">Data Ibu</h5>
                                                        {isEditMode && editFormData ? (
                                                            <div className="space-y-2">
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Nama</label>
                                                                    <input type="text" value={editFormData.parents?.mother?.name || ''} onChange={(e) => updateFormField('parents.mother.name', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">NIK</label>
                                                                    <input type="text" value={editFormData.parents?.mother?.nik || ''} onChange={(e) => updateFormField('parents.mother.nik', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">No. HP</label>
                                                                    <input type="text" value={editFormData.parents?.mother?.phone || ''} onChange={(e) => updateFormField('parents.mother.phone', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-500 mb-1">Pekerjaan</label>
                                                                    <input type="text" value={editFormData.parents?.mother?.job || ''} onChange={(e) => updateFormField('parents.mother.job', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <span className="text-slate-500">Nama</span>
                                                                    <span className="col-span-2 font-medium">{studentDetail.parents?.mother?.name || '-'}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <span className="text-slate-500">NIK</span>
                                                                    <span className="col-span-2 font-medium text-xs font-mono">{studentDetail.parents?.mother?.nik || '-'}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <span className="text-slate-500">Pekerjaan</span>
                                                                    <span className="col-span-2 font-medium">{studentDetail.parents?.mother?.job || '-'}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <span className="text-slate-500">Pendidikan</span>
                                                                    <span className="col-span-2 font-medium">{studentDetail.parents?.mother?.education || '-'}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <span className="text-slate-500">Penghasilan</span>
                                                                    <span className="col-span-2 font-medium">{studentDetail.parents?.mother?.income || '-'}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <span className="text-slate-500">No. HP</span>
                                                                    <span className="col-span-2 font-medium flex items-center gap-1"><Phone size={10} /> {studentDetail.parents?.mother?.phone || '-'}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Wali (Optional) */}
                                                    {(studentDetail.parents?.guardian?.name || isEditMode) && (
                                                        <div className="bg-slate-50 p-4 rounded-lg border md:col-span-2">
                                                            <h5 className="font-bold text-slate-500 uppercase text-xs mb-3">Data Wali</h5>
                                                            {isEditMode && editFormData ? (
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                    <div>
                                                                        <label className="block text-xs text-slate-500 mb-1">Nama</label>
                                                                        <input type="text" value={editFormData.parents?.guardian?.name || ''} onChange={(e) => updateFormField('parents.guardian.name', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs text-slate-500 mb-1">Hubungan</label>
                                                                        <input type="text" value={editFormData.parents?.guardian?.relation || ''} onChange={(e) => updateFormField('parents.guardian.relation', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs text-slate-500 mb-1">No. HP</label>
                                                                        <input type="text" value={editFormData.parents?.guardian?.phone || ''} onChange={(e) => updateFormField('parents.guardian.phone', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div className="grid grid-cols-3 gap-1">
                                                                        <span className="text-slate-500">Nama</span>
                                                                        <span className="col-span-2 font-medium">{studentDetail.parents?.guardian?.name || '-'}</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 gap-1">
                                                                        <span className="text-slate-500">Hubungan</span>
                                                                        <span className="col-span-2 font-medium">{studentDetail.parents?.guardian?.relation || '-'}</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 gap-1">
                                                                        <span className="text-slate-500">No. HP</span>
                                                                        <span className="col-span-2 font-medium flex items-center gap-1"><Phone size={10} /> {studentDetail.parents?.guardian?.phone || '-'}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'berkas' && (
                                        <div className="space-y-4 animate-fade-in">
                                            {viewModal.uploaded_docs && Object.keys(viewModal.uploaded_docs).length > 0 ? (
                                                <div className="grid grid-cols-1 gap-2">
                                                    {Object.entries(viewModal.uploaded_docs).map(([docName, url]) => {
                                                        const isAgreement = ['agreement_rokok', 'agreement_lgbt', 'agreement_kriminal', 'mcu_letter'].includes(docName);

                                                        let status = 'pending';
                                                        if (isAgreement) {
                                                            if (viewModal.agreements_verified === true) status = 'valid';
                                                            else if (viewModal.agreements_verified === false) status = 'invalid';
                                                        } else {
                                                            // Check Reregistration Docs first (latest status), then initial Verification
                                                            const s = viewModal.reregistration_docs?.[docName]?.status || viewModal.doc_verification?.[docName]?.status;
                                                            if (s) {
                                                                status = s;
                                                            } else {
                                                                // Infer VALID status if overall registration is verified/advanced
                                                                // "Verified from start" logic
                                                                const verifiedStatuses = ['verified', 'interview_scheduled', 'interview_accepted', 'interview_reschedule', 'awaiting_decision', 'lulus', 'paid', 'accepted'];
                                                                if (verifiedStatuses.includes(viewModal.status)) {
                                                                    status = 'valid';
                                                                }
                                                            }
                                                        }

                                                        return (
                                                            <div key={docName} className="flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-slate-50 transition">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded">
                                                                        <FileText size={18} />
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-bold text-sm uppercase text-slate-700">{docName.replace('_', ' ')}</div>
                                                                        <div className="text-xs text-slate-400">Teriupload</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {status === 'valid' && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">Valid</span>}
                                                                    {status === 'invalid' && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">Invalid</span>}
                                                                    {status === 'pending' && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">Pending</span>}

                                                                    <button onClick={() => handleOpenDocument(url)} className="text-blue-600 hover:underline text-xs font-bold border border-blue-200 px-2 py-1 rounded bg-blue-50 cursor-pointer">
                                                                        Lihat
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-center py-10 text-slate-400 border-2 border-dashed rounded-xl">
                                                    Belum ada berkas diupload.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer Action */}
                        <div className="mt-4 pt-4 border-t flex justify-between gap-2">
                            <div>
                                {(!isEditMode && activeTab === 'biodata') && (
                                    <Button onClick={handleEditClick} variant="secondary" className="flex items-center gap-2">
                                        <Edit size={16} /> Edit Data
                                    </Button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {isEditMode ? (
                                    <>
                                        <Button onClick={handleCancelEdit} variant="secondary" className="flex items-center gap-2">
                                            <X size={16} /> Batal
                                        </Button>
                                        <Button onClick={handleSaveEdit} disabled={isSaving} className="flex items-center gap-2">
                                            {isSaving ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            ) : (
                                                <Save size={16} />
                                            )}
                                            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                                        </Button>
                                    </>
                                ) : (
                                    <Button onClick={() => { setViewModal(null); setIsEditMode(false); setEditFormData(null); }} variant="secondary">Tutup</Button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Password Verification Modal */}
            <Modal
                isOpen={showPasswordModal}
                onClose={() => { setShowPasswordModal(false); setPasswordError(''); setAdminPassword(''); }}
                title="Verifikasi Admin"
                maxWidth="max-w-md"
            >
                <div className="space-y-4">
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-4">
                            <Lock size={32} className="text-amber-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Masukkan Password Admin</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Untuk mengedit data pendaftar, silakan masukkan password admin.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <input
                            type="password"
                            value={adminPassword}
                            onChange={(e) => { setAdminPassword(e.target.value); setPasswordError(''); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                            placeholder="Masukkan password admin..."
                            className="w-full px-4 py-3 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            autoFocus
                        />
                        {passwordError && (
                            <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">
                                {passwordError}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button
                            onClick={() => { setShowPasswordModal(false); setPasswordError(''); setAdminPassword(''); }}
                            variant="secondary"
                            className="flex-1"
                            disabled={isVerifying}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleVerifyPassword}
                            className="flex-1"
                            disabled={!adminPassword || isVerifying}
                        >
                            {isVerifying ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Memverifikasi...
                                </div>
                            ) : (
                                'Verifikasi'
                            )}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
