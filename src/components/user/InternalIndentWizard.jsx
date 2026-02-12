import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase'; // Updated Import
import {
    User, FileText, MapPin, Building, GraduationCap, CheckCircle,
    Activity, School, CheckSquare, Users, CalendarClock
} from 'lucide-react';
import { Card, Button, Input, Select } from '../ui/Elements';
import { fetchRegionData, fileToBase64 } from '../../utils/helpers';

export default function InternalIndentWizard({ user, onComplete, showToast, indentSettings }) {
    const [step, setStep] = useState(1);
    const [branches, setBranches] = useState([]);
    const [paths, setPaths] = useState([]);
    const [waves, setWaves] = useState([]); // This will hold the filtered Indent Waves
    const [loading, setLoading] = useState(false);

    // Copying formData structure from RegistrationWizard
    const [formData, setFormData] = useState({
        unit_id: '', major: '', path_id: '', wave_id: '',
        student_new: {
            name: '', nickname: '', gender: 'L', pob: '', dob: '', nik: '', kk: '',
            religion: 'Islam', nationality: 'Indonesia',
            child_order: '', siblings_count: '', siblings_step: '', siblings_adopted: '',
            orphan_status: 'Lengkap', daily_language: 'Indonesia',
            height: '', weight: '', blood_type: '', diseases: '', diseases_hospital: '',
            allergies: '', special_needs: '', physical_disability: ''
        },
        education: {
            origin_school: '', npsn: '', school_status: 'Swasta', grad_year: '',
            diploma_no: '', diploma_date: '', study_duration: '',
            grade_math: '', grade_ind: '', grade_eng: '', grade_ipa: '', achievements: ''
        },
        address: {
            street: '', village: '', district: '', regency: '', province: '', postal_code: '',
            phone: '', address_status: 'Milik Sendiri', distance: '', transport_mode: '',
            residence_status: 'Orang Tua'
        },
        father: { name: '', nik: '', job: '', education: '', income: '', phone: '' },
        mother: { name: '', nik: '', job: '', education: '', income: '', phone: '' },
        guardian: { name: '', relation: '', phone: '' },
        documents: { kk: null, akta: null, rapor: null, surat_sehat: null, sktm: null, photo_student: null },
        agreed_health: false
    });

    const [uploadingDocs, setUploadingDocs] = useState({ kk: false, akta: false, rapor: false, surat_sehat: false, sktm: false, photo_student: false });
    const [regions, setRegions] = useState({ provinces: [], regencies: [], districts: [], villages: [] });
    const [regionIds, setRegionIds] = useState({ province: '', regency: '', district: '' });

    const incomeOptions = [{ value: 'range_1', label: 'Rp 10.000.000 – Rp 14.999.999' }, { value: 'range_2', label: 'Rp 15.000.000 – Rp 19.999.999' }, { value: 'range_3', label: 'Rp 20.000.000 – Rp 29.999.999' }, { value: 'range_4', label: 'Rp 30.000.000 – Rp 39.999.999' }, { value: 'range_5', label: 'Rp 40.000.000 – Rp 49.999.999' }, { value: 'range_6', label: 'Rp 50.000.000 – Rp 59.999.999' }, { value: 'range_7', label: 'Rp 60.000.000 – Rp 69.999.999' }, { value: 'range_8', label: 'Rp 70.000.000 – Rp 79.999.999' }, { value: 'range_9', label: 'Rp 80.000.000 – Rp 89.999.999' }, { value: 'range_10', label: 'Rp 90.000.000 – Rp 100.000.000' }, { value: 'range_11', label: 'Di atas Rp 100.000.000' }, { value: 'range_0', label: 'Di bawah Rp 10.000.000' }];

    useEffect(() => {
        const fd = async () => {
            // Fetch Units
            const { data: uData } = await supabase.from('units').select('*');
            if (uData) {
                setBranches(uData.filter(b => b.open !== false));
            }

            // Fetch Paths
            const { data: pData } = await supabase.from('paths').select('*');
            if (pData && pData.length > 0) {
                setPaths(pData);
            } else {
                setPaths([
                    { id: 'internal', name: 'Internal' },
                    { id: 'reg', name: 'Reguler' },
                    { id: 'prestasi', name: 'Prestasi' }
                ]);
            }

            // Fetch Waves - INTERNAL INDENT LOGIC
            const { data: wData } = await supabase.from('waves').select('*').eq('active', true);
            let activeWaves = wData || [];

            if (indentSettings?.target_academic_years && indentSettings.target_academic_years.length > 0) {
                // Keep only waves belonging to the target academic years
                activeWaves = activeWaves.filter(w => indentSettings.target_academic_years.includes(w.year));
            } else {
                // Fallback or empty if not configured
                activeWaves = [];
            }
            setWaves(activeWaves);

            // Fetch Regions
            fetchRegionData('provinces').then(data => setRegions(prev => ({ ...prev, provinces: data })));
        };
        fd();
    }, [indentSettings]);

    const handleNestedChange = (category, field, value) => { setFormData(prev => ({ ...prev, [category]: { ...prev[category], [field]: value } })); };
    const handleMainChange = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };

    const handleRegionChange = async (level, id, name) => {
        const newIds = { ...regionIds };
        const newAddress = { ...formData.address };

        if (level === 'province') {
            newIds.province = id; newIds.regency = ''; newIds.district = '';
            newAddress.province = name; newAddress.regency = ''; newAddress.district = ''; newAddress.village = '';
            setRegions(prev => ({ ...prev, regencies: [], districts: [], villages: [] }));
            const data = await fetchRegionData('regencies', id);
            setRegions(prev => ({ ...prev, regencies: data }));
        }
        else if (level === 'regency') {
            newIds.regency = id; newIds.district = '';
            newAddress.regency = name; newAddress.district = ''; newAddress.village = '';
            setRegions(prev => ({ ...prev, districts: [], villages: [] }));
            const data = await fetchRegionData('districts', id);
            setRegions(prev => ({ ...prev, districts: data }));
        }
        else if (level === 'district') {
            newIds.district = id;
            newAddress.district = name; newAddress.village = '';
            setRegions(prev => ({ ...prev, villages: [] }));
            const data = await fetchRegionData('villages', id);
            setRegions(prev => ({ ...prev, villages: data }));
        }
        else if (level === 'village') {
            newAddress.village = name;
        }

        setRegionIds(newIds);
        setFormData(prev => ({ ...prev, address: newAddress }));
    };

    const uploadFile = async (type, file) => {
        if (!file) return; setUploadingDocs(prev => ({ ...prev, [type]: true }));
        try { const base64Data = await fileToBase64(file); setFormData(prev => ({ ...prev, documents: { ...prev.documents, [type]: base64Data } })); showToast('Dokumen berhasil diupload (Lokal)!'); } catch (error) { showToast(error.message, 'error'); } finally { setUploadingDocs(prev => ({ ...prev, [type]: false })); }
    };

    const selectedBranch = branches.find(u => u.id === formData.unit_id);
    const selectedWave = waves.find(w => w.id === formData.wave_id);

    const handleSubmit = async () => {
        if (!formData.agreed_health) return showToast('Harap setujui pernyataan kesehatan anak.', 'error');
        setLoading(true);
        try {
            // 0. PREVENT DUPLICATE REGISTRATION
            const { data: dupData } = await supabase.from('registrations')
                .select('*')
                .eq('user_id', user.id)
                .eq('unit_id', formData.unit_id);

            const isDuplicate = dupData?.some(data =>
                data.academic_year === (selectedWave?.year || 'Unknown') &&
                data.status !== 'rejected' &&
                data.status !== 'cancelled'
            );

            if (isDuplicate) {
                showToast('Anda sudah memiliki pendaftaran aktif untuk siswa ini di unit dan tahun ajaran yang sama.', 'error');
                setLoading(false);
                return;
            }

            // 1. REAL-TIME QUOTA CHECK
            // Fetch latest unit data from Supabase
            const { data: latestUnit, error: unitError } = await supabase.from('units').select('*').eq('id', selectedBranch.id).single();
            if (unitError || !latestUnit) throw new Error("Data unit sekolah tidak ditemukan.");

            let isFull = false;
            let currentMajors = latestUnit.majors || [];

            // Check Quota
            if (currentMajors.length > 0 && formData.major) {
                const majorData = currentMajors.find(m => m.name === formData.major);
                if (majorData) {
                    const q = parseInt(majorData.quota) || 0;
                    const f = parseInt(majorData.filled) || 0;
                    if (f >= q) isFull = true;
                }
            } else {
                // Check global unit quota
                const q = parseInt(latestUnit.quota) || 0;
                const f = parseInt(latestUnit.filled) || 0;
                if (f >= q) isFull = true;
            }

            if (isFull) {
                showToast('Mohon maaf, kuota pilihan ini baru saja PENUH.', 'error');
                setLoading(false);
                return;
            }

            // Find Path Name
            const pathName = paths.find(p => p.id === formData.path_id)?.name || 'Unknown';
            const isScholarship = pathName.toLowerCase().includes('prestasi') || pathName.toLowerCase().includes('yatim');

            const studentData = { ...formData.student_new, education: formData.education, address: formData.address, parents: { father: formData.father, mother: formData.mother, guardian: formData.guardian } };

            const regData = {
                user_id: user.id, // Supabase user id
                parent_name: user.user_metadata?.displayName || user.user_metadata?.full_name || user.email,
                student_name: formData.student_new.name,
                student_religion: formData.student_new.religion,
                unit_id: formData.unit_id,
                unit_name: selectedBranch?.name || 'Unknown',
                unit_level: selectedBranch?.level || '',
                major: formData.major || null,
                path_id: formData.path_id,
                path_name: pathName,
                wave_id: formData.wave_id,
                wave_name: selectedWave ? `${selectedWave.year} - ${selectedWave.name}` : 'Unknown',
                academic_year: selectedWave?.year || 'Unknown',
                status: 'submitted',
                is_indent: true,
                is_internal: true,
                uploaded_docs: formData.documents,
                cost_reg: 0, // Indent internal often 0 or specific
                cost_rereg: selectedBranch?.cost_rereg !== undefined ? selectedBranch.cost_rereg : 0,
                is_scholarship: isScholarship,
                biodata: studentData, // Store complete form data
                created_at: new Date().toISOString()
            };

            const { data: newReg, error: regError } = await supabase.from('registrations').insert(regData).select().single();
            if (regError) throw regError;

            // Update Quota (Manual update for now - race condition possible)
            if (currentMajors.length > 0 && formData.major) {
                const updatedMajors = currentMajors.map(m => m.name === formData.major ? { ...m, filled: (parseInt(m.filled) || 0) + 1 } : m);
                await supabase.from('units').update({ majors: updatedMajors, filled: (latestUnit.filled || 0) + 1 }).eq('id', selectedBranch.id);
            } else {
                await supabase.from('units').update({ filled: (latestUnit.filled || 0) + 1 }).eq('id', selectedBranch.id);
            }

            // Invoice creation handled by admin verification mainly, or triggered separately.

            onComplete(); showToast('Pendaftaran Inden Internal Berhasil Disimpan!', 'success');
        } catch (err) { console.error(err); showToast(err.message, 'error'); } finally { setLoading(false); }
    };

    const renderNav = (prevStep, nextStep, disableNext) => (
        <div className="mt-12 flex justify-between items-center pt-8 border-t border-slate-100">
            {prevStep ? (
                <Button variant="secondary" onClick={() => setStep(prevStep)} className="px-8 rounded-2xl group flex items-center gap-2 font-black uppercase tracking-widest text-[10px]">
                    <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Sebelumnya
                </Button>
            ) : <div />}
            {nextStep ? (
                <Button
                    onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setStep(nextStep);
                    }}
                    disabled={disableNext}
                    className="px-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 group flex items-center gap-2 font-black uppercase tracking-widest text-[10px] text-white"
                >
                    Selanjutnya <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                </Button>
            ) : (
                <Button
                    onClick={handleSubmit}
                    disabled={disableNext || loading}
                    className="px-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 font-black uppercase tracking-widest text-[10px] text-white"
                >
                    {loading ? 'Memproses...' : 'Submit Inden Internal'}
                </Button>
            )}
        </div>
    );

    const steps_list = [
        { title: 'Personal', icon: User, desc: 'Data Diri' },
        { title: 'Pendidikan', icon: GraduationCap, desc: 'Sekolah' },
        { title: 'Alamat', icon: MapPin, desc: 'Lokasi' },
        { title: 'Keluarga', icon: Users, desc: 'Orang Tua' },
        { title: 'Pilihan', icon: School, desc: 'Unit & Jalur' },
        { title: 'Dokumen', icon: FileText, desc: 'Upload' },
        { title: 'Review', icon: CheckSquare, desc: 'Konfirmasi' }
    ];

    return (
        <div className="max-w-4xl mx-auto px-1 md:px-0">
            <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl shadow-emerald-900/5 rounded-[2.5rem] bg-white dark:!bg-slate-900 relative">
                {/* Progress Bar (High Fidelity) */}
                <div className="absolute top-0 left-0 w-full h-2.5 bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 transition-all duration-1000 ease-in-out relative overflow-hidden"
                        style={{ width: `${(step / steps_list.length) * 100}%` }}>
                        <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
                    </div>
                </div>

                <div className="p-8 md:p-16">
                    <div className="mb-12 text-center">
                        <div className="inline-flex items-center gap-3 px-5 py-2 bg-emerald-50/50 dark:bg-emerald-900/20 rounded-full text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] mb-6 backdrop-blur-sm border border-emerald-100 dark:border-emerald-900/30">
                            Sekolahku Wizard • Step {step}/{steps_list.length}
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none mb-4">
                            Formulir <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Inden Internal</span>
                        </h2>
                        <div className="w-20 h-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 mx-auto rounded-full mb-6"></div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-lg mx-auto leading-relaxed">Pendaftaran eksklusif bagi siswa aktif Yayasan untuk melanjutkan jenjang pendidikan berikutnya secara prioritas.</p>
                    </div>

                    {/* Step Icons (Premium Design) */}
                    <div className="flex justify-between mb-16 relative overflow-x-auto no-scrollbar py-6 gap-6 px-2">
                        {steps_list.map((s, idx) => {
                            const Icon = s.icon;
                            const isActive = step === idx + 1;
                            const isCompleted = step > idx + 1;
                            return (
                                <div key={idx} className="flex flex-col items-center gap-3 min-w-fit first:pl-0 last:pr-0 group">
                                    <div
                                        onClick={() => isCompleted && setStep(idx + 1)}
                                        className={`w-14 h-14 rounded-2xl flex items-center justify-center border-4 transition-all duration-700 cursor-pointer ${isActive
                                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-white dark:border-slate-800 text-white shadow-2xl shadow-emerald-500/20 scale-125 z-10'
                                            : (isCompleted
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-600'
                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-50 dark:border-slate-800 text-slate-300 dark:text-slate-600')
                                            }`}
                                    >
                                        {isCompleted ? <CheckCircle size={22} /> : <Icon size={22} />}
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className={`text-[9px] font-black uppercase tracking-[0.15em] transition-colors duration-300 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                            {s.title}
                                        </span>
                                        <span className={`text-[7px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-[0.1em] opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'opacity-100' : ''}`}>
                                            {s.desc}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Steps Content */}
                    {step === 1 && (
                        <div className="animate-fade-in space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2 mb-4 flex items-center gap-2"><User size={20} /> A. Keterangan Pribadi</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="1a. Nama Lengkap (Sesuai Akta)" value={formData.student_new.name} onChange={e => handleNestedChange('student_new', 'name', e.target.value)} required />
                                <Input label="1b. Nama Panggilan" value={formData.student_new.nickname} onChange={e => handleNestedChange('student_new', 'nickname', e.target.value)} />
                                <Select label="2. Jenis Kelamin" value={formData.student_new.gender} onChange={e => handleNestedChange('student_new', 'gender', e.target.value)} options={[{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }]} />
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="3a. Tempat Lahir" value={formData.student_new.pob} onChange={e => handleNestedChange('student_new', 'pob', e.target.value)} />
                                    <Input label="3b. Tanggal Lahir" type="date" value={formData.student_new.dob} onChange={e => handleNestedChange('student_new', 'dob', e.target.value)} />
                                </div>
                                <Select label="4. Agama" value={formData.student_new.religion} onChange={e => handleNestedChange('student_new', 'religion', e.target.value)} options={[{ value: 'Islam' }, { value: 'Kristen' }, { value: 'Katolik' }, { value: 'Hindu' }, { value: 'Buddha' }, { value: 'Konghucu' }]} />
                                <Input label="5. Kewarganegaraan" value={formData.student_new.nationality} onChange={e => handleNestedChange('student_new', 'nationality', e.target.value)} placeholder="Indonesia" />
                                <Input label="NIK (16 Digit)" value={formData.student_new.nik} onChange={e => handleNestedChange('student_new', 'nik', e.target.value)} placeholder="16 digit NIK" />
                                <Input label="Nomor KK" value={formData.student_new.kk} onChange={e => handleNestedChange('student_new', 'kk', e.target.value)} placeholder="16 digit No. KK" />
                            </div>

                            <div className="bg-gray-50 dark:!bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mt-4">
                                <h4 className="font-bold text-sm mb-3 text-slate-700 dark:text-slate-200">Data Keluarga</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <Input label="6. Anak ke-" type="number" value={formData.student_new.child_order} onChange={e => handleNestedChange('student_new', 'child_order', e.target.value)} />
                                    <Input label="7. Jml Saudara Kandung" type="number" value={formData.student_new.siblings_count} onChange={e => handleNestedChange('student_new', 'siblings_count', e.target.value)} />
                                    <Input label="8. Jml Saudara Tiri" type="number" value={formData.student_new.siblings_step} onChange={e => handleNestedChange('student_new', 'siblings_step', e.target.value)} placeholder="0" />
                                    <Input label="9. Jml Saudara Angkat" type="number" value={formData.student_new.siblings_adopted} onChange={e => handleNestedChange('student_new', 'siblings_adopted', e.target.value)} placeholder="0" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <Select label="10. Status Anak" value={formData.student_new.orphan_status} onChange={e => handleNestedChange('student_new', 'orphan_status', e.target.value)} options={[{ value: 'Lengkap', label: 'Orang Tua Lengkap' }, { value: 'Yatim', label: 'Yatim (Ayah Meninggal)' }, { value: 'Piatu', label: 'Piatu (Ibu Meninggal)' }, { value: 'Yatim Piatu', label: 'Yatim Piatu' }]} />
                                    <Input label="11. Bahasa Sehari-hari di Rumah" value={formData.student_new.daily_language} onChange={e => handleNestedChange('student_new', 'daily_language', e.target.value)} placeholder="Indonesia / Jawa / Sunda / dll" />
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2 mt-6 mb-4 flex items-center gap-2"><Activity size={20} /> C. Keterangan Kesehatan</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input label="17. Golongan Darah" value={formData.student_new.blood_type} onChange={e => handleNestedChange('student_new', 'blood_type', e.target.value)} placeholder="A / B / AB / O" />
                                <Input label="20a. Tinggi Badan (cm)" type="number" value={formData.student_new.height} onChange={e => handleNestedChange('student_new', 'height', e.target.value)} />
                                <Input label="20b. Berat Badan (kg)" type="number" value={formData.student_new.weight} onChange={e => handleNestedChange('student_new', 'weight', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="18a. Penyakit yang Pernah Diderita" value={formData.student_new.diseases} onChange={e => handleNestedChange('student_new', 'diseases', e.target.value)} placeholder="Contoh: Asma, Tifus (Kosongkan jika tidak ada)" />
                                <Input label="18b. Tempat Dirawat" value={formData.student_new.diseases_hospital} onChange={e => handleNestedChange('student_new', 'diseases_hospital', e.target.value)} placeholder="Contoh: RS Mitra Keluarga" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="19. Kelainan Jasmani" value={formData.student_new.physical_disability} onChange={e => handleNestedChange('student_new', 'physical_disability', e.target.value)} placeholder="Kosongkan jika tidak ada" />
                                <Input label="Alergi" value={formData.student_new.allergies} onChange={e => handleNestedChange('student_new', 'allergies', e.target.value)} placeholder="Contoh: Udang, Antibiotik" />
                            </div>
                            <Input label="Kebutuhan Khusus (ABK)" value={formData.student_new.special_needs} onChange={e => handleNestedChange('student_new', 'special_needs', e.target.value)} placeholder="Tuliskan jika ada" />
                            {renderNav(null, 2, !formData.student_new.name || !formData.student_new.nik)}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-fade-in space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2 mb-4 flex items-center gap-2"><School size={20} /> D. Keterangan Pendidikan Sebelumnya</h3>

                            {/* MODIFIED: Asal Sekolah as Select Dropdown of Branches */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select
                                    label="21a. Tujuan Cabang yang dipilih"
                                    value={formData.education.origin_school}
                                    onChange={e => handleNestedChange('education', 'origin_school', e.target.value)}
                                    options={branches.map(b => ({ value: b.name, label: b.name }))}
                                    placeholder="-- Pilih Unit Asal --"
                                    required
                                />
                                <Input label="NPSN Sekolah" value={formData.education.npsn} onChange={e => handleNestedChange('education', 'npsn', e.target.value)} />
                                <Select label="Status Sekolah" value={formData.education.school_status} onChange={e => handleNestedChange('education', 'school_status', e.target.value)} options={[{ value: 'Negeri', label: 'Negeri' }, { value: 'Swasta', label: 'Swasta' }]} />
                                <Input label="21c. Lama Belajar (Tahun)" type="number" value={formData.education.study_duration} onChange={e => handleNestedChange('education', 'study_duration', e.target.value)} placeholder="Contoh: 6" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input label="21b. Nomor STTB/Ijazah" value={formData.education.diploma_no} onChange={e => handleNestedChange('education', 'diploma_no', e.target.value)} />
                                <Input label="Tanggal STTB/Ijazah" type="date" value={formData.education.diploma_date} onChange={e => handleNestedChange('education', 'diploma_date', e.target.value)} />
                                <Input label="Tahun Lulus" type="number" value={formData.education.grad_year} onChange={e => handleNestedChange('education', 'grad_year', e.target.value)} />
                            </div>
                            <div className="bg-gray-50 dark:!bg-slate-900 p-4 rounded-lg mt-4 border border-gray-200 dark:border-slate-700">
                                <h4 className="font-bold text-sm mb-3 text-slate-700 dark:text-slate-200">Nilai Rapor Terakhir (Skala 10-100)</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <Input label="Matematika" type="number" value={formData.education.grade_math} onChange={e => handleNestedChange('education', 'grade_math', e.target.value)} />
                                    <Input label="B. Indonesia" type="number" value={formData.education.grade_ind} onChange={e => handleNestedChange('education', 'grade_ind', e.target.value)} />
                                    <Input label="B. Inggris" type="number" value={formData.education.grade_eng} onChange={e => handleNestedChange('education', 'grade_eng', e.target.value)} />
                                    <Input label="IPA (Opsional)" type="number" value={formData.education.grade_ipa} onChange={e => handleNestedChange('education', 'grade_ipa', e.target.value)} />
                                </div>
                            </div>
                            <Input label="Prestasi Akademik / Non-Akademik" value={formData.education.achievements} onChange={e => handleNestedChange('education', 'achievements', e.target.value)} placeholder="Contoh: Juara 1 Lomba Pidato Tingkat Kota" />
                            {renderNav(1, 3, !formData.education.origin_school)}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-fade-in space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2 mb-4 flex items-center gap-2"><MapPin size={20} /> B. Keterangan Tempat Tinggal</h3>
                            <Input label="12. Alamat Lengkap (Jalan, RT/RW, No. Rumah)" value={formData.address.street} onChange={e => handleNestedChange('address', 'street', e.target.value)} required />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select label="Provinsi" value={regionIds.province} onChange={(e) => { const opt = regions.provinces.find(p => p.id === e.target.value); handleRegionChange('province', e.target.value, opt?.text); }} options={regions.provinces.map(p => ({ value: p.id, label: p.text }))} placeholder="Pilih Provinsi" />
                                <Select label="Kabupaten / Kota" value={regionIds.regency} onChange={(e) => { const opt = regions.regencies.find(p => p.id === e.target.value); handleRegionChange('regency', e.target.value, opt?.text); }} options={regions.regencies.map(p => ({ value: p.id, label: p.text }))} disabled={!regionIds.province} placeholder="Pilih Kota/Kab" />
                                <Select label="Kecamatan" value={regionIds.district} onChange={(e) => { const opt = regions.districts.find(p => p.id === e.target.value); handleRegionChange('district', e.target.value, opt?.text); }} options={regions.districts.map(p => ({ value: p.id, label: p.text }))} disabled={!regionIds.regency} placeholder="Pilih Kecamatan" />
                                <Select label="Desa / Kelurahan" value={formData.address.village} onChange={(e) => { handleRegionChange('village', null, e.target.value); }} options={regions.villages.map(p => ({ value: p.text, label: p.text }))} disabled={!regionIds.district} placeholder="Pilih Desa/Kelurahan" />
                                <Input label="Kode Pos" value={formData.address.postal_code} onChange={e => handleNestedChange('address', 'postal_code', e.target.value)} />
                                <Input label="13. Nomor Telepon Rumah" value={formData.address.phone} onChange={e => handleNestedChange('address', 'phone', e.target.value)} placeholder="Contoh: 021-7654321" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select label="14. Alamat Tersebut" value={formData.address.address_status} onChange={e => handleNestedChange('address', 'address_status', e.target.value)} options={[{ value: 'Milik Sendiri', label: 'Milik Sendiri' }, { value: 'Rumah Dinas', label: 'Rumah Dinas' }, { value: 'Kontrak/Sewa', label: 'Kontrak/Sewa' }, { value: 'Menumpang', label: 'Menumpang' }, { value: 'Lainnya', label: 'Lainnya' }]} />
                                <Input label="15. Jarak ke Sekolah (km)" type="number" value={formData.address.distance} onChange={e => handleNestedChange('address', 'distance', e.target.value)} placeholder="Perkiraan KM" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select label="16. Ke Sekolah Dengan" value={formData.address.transport_mode} onChange={e => handleNestedChange('address', 'transport_mode', e.target.value)} options={[{ value: 'Jalan Kaki', label: 'Jalan Kaki' }, { value: 'Sepeda', label: 'Sepeda' }, { value: 'Sepeda Motor', label: 'Sepeda Motor' }, { value: 'Mobil Pribadi', label: 'Mobil Pribadi' }, { value: 'Angkutan Umum', label: 'Angkutan Umum' }, { value: 'Antar Jemput Sekolah', label: 'Antar Jemput Sekolah' }, { value: 'Ojek Online', label: 'Ojek Online' }, { value: 'Lainnya', label: 'Lainnya' }]} />
                                <Select label="Tinggal Bersama" value={formData.address.residence_status} onChange={e => handleNestedChange('address', 'residence_status', e.target.value)} options={[{ value: 'Orang Tua', label: 'Bersama Orang Tua' }, { value: 'Wali', label: 'Bersama Wali' }, { value: 'Asrama', label: 'Asrama / Kost' }]} />
                            </div>
                            {renderNav(2, 4, !formData.address.street)}
                        </div>
                    )}

                    {step === 4 && (<div className="animate-fade-in space-y-6"><h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2 mb-4 flex items-center gap-2"><User size={20} /> 4. Data Orang Tua / Wali</h3><div className="border p-5 rounded-xl bg-blue-50/50 dark:!bg-slate-900 border-blue-100 dark:border-slate-700"><h4 className="font-bold text-blue-800 dark:text-blue-400 mb-4 flex items-center gap-2">👨🦱 Data Ayah</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Nama Lengkap Ayah" value={formData.father.name} onChange={e => handleNestedChange('father', 'name', e.target.value)} required /><Input label="NIK Ayah" value={formData.father.nik} onChange={e => handleNestedChange('father', 'nik', e.target.value)} /><Input label="Pekerjaan" value={formData.father.job} onChange={e => handleNestedChange('father', 'job', e.target.value)} /><Select label="Pendidikan Terakhir" value={formData.father.education} onChange={e => handleNestedChange('father', 'education', e.target.value)} options={[{ value: 'SD', label: 'SD' }, { value: 'SMP', label: 'SMP' }, { value: 'SMA', label: 'SMA' }, { value: 'S1', label: 'S1' }, { value: 'S2', label: 'S2' }, { value: 'S3', label: 'S3' }, { value: 'Lainnya', label: 'Lainnya' }]} /><div className="md:col-span-2"><Select label="Penghasilan Ayah Per Bulan" value={formData.father.income} onChange={e => handleNestedChange('father', 'income', e.target.value)} options={incomeOptions} /></div><Input label="Nomor HP" value={formData.father.phone} onChange={e => handleNestedChange('father', 'phone', e.target.value)} /></div></div><div className="border p-5 rounded-xl bg-pink-50/50 dark:!bg-slate-900 border-pink-100 dark:border-slate-700"><h4 className="font-bold text-pink-800 dark:text-pink-400 mb-4 flex items-center gap-2">👩🦰 Data Ibu</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Nama Lengkap Ibu" value={formData.mother.name} onChange={e => handleNestedChange('mother', 'name', e.target.value)} required /><Input label="NIK Ibu" value={formData.mother.nik} onChange={e => handleNestedChange('mother', 'nik', e.target.value)} /><Input label="Pekerjaan" value={formData.mother.job} onChange={e => handleNestedChange('mother', 'job', e.target.value)} /><Select label="Pendidikan Terakhir" value={formData.mother.education} onChange={e => handleNestedChange('mother', 'education', e.target.value)} options={[{ value: 'SD', label: 'SD' }, { value: 'SMP', label: 'SMP' }, { value: 'SMA', label: 'SMA' }, { value: 'S1', label: 'S1' }, { value: 'S2', label: 'S2' }, { value: 'S3', label: 'S3' }, { value: 'Lainnya', label: 'Lainnya' }]} /><div className="md:col-span-2"><Select label="Penghasilan Ibu Per Bulan" value={formData.mother.income} onChange={e => handleNestedChange('mother', 'income', e.target.value)} options={incomeOptions} /></div><Input label="Nomor HP" value={formData.mother.phone} onChange={e => handleNestedChange('mother', 'phone', e.target.value)} /></div></div><div className="border p-5 rounded-xl bg-gray-50 dark:!bg-slate-900 border-gray-200 dark:border-slate-700"><h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Data Wali (Jika Ada)</h4><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Input label="Nama Wali" value={formData.guardian.name} onChange={e => handleNestedChange('guardian', 'name', e.target.value)} /><Input label="Hubungan dengan Santri" value={formData.guardian.relation} onChange={e => handleNestedChange('guardian', 'relation', e.target.value)} placeholder="Contoh: Paman, Kakek" /><Input label="Nomor HP" value={formData.guardian.phone} onChange={e => handleNestedChange('guardian', 'phone', e.target.value)} /></div></div>{renderNav(3, 5, !formData.father.name || !formData.mother.name)}</div>)}

                    {step === 5 && (
                        <div className="animate-fade-in">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2 mb-6 flex items-center gap-2"><Building size={20} /> 5. Pilih Cabang & Jalur (Inden Internal)</h3>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Pilih Cabang Sekolah Tujuan</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {branches.map(u => {
                                        const isSMK = u.level === 'SMK';
                                        return (
                                            <div key={u.id} onClick={() => u.open !== false && handleMainChange('unit_id', u.id)} className={`border p-4 rounded-xl cursor-pointer transition-all ${formData.unit_id === u.id ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'hover:border-emerald-300'} bg-white`}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-800 dark:text-white">{u.name}</span>
                                                            <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded font-bold uppercase">{u.level}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1">{u.location}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedBranch && selectedBranch.level === 'SMK' && selectedBranch.majors && (
                                <div className="mb-4 animate-fade-in bg-blue-50 p-4 rounded-lg border border-blue-100">
                                    <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><GraduationCap size={18} /> Pilih Jurusan</h4>
                                    <Select label="Jurusan / Program Studi" name="major" value={formData.major} onChange={e => handleMainChange('major', e.target.value)} options={selectedBranch.majors.map(m => { const left = (parseInt(m.quota) || 0) - (parseInt(m.filled) || 0); return { value: m.name, label: `${m.name}` }; })} required />
                                </div>
                            )}

                            <Select label="Jalur Pendaftaran" name="path_id" value={formData.path_id} onChange={e => handleMainChange('path_id', e.target.value)} options={paths.map(p => ({ value: p.id, label: p.name }))} placeholder="Pilih Jalur (contoh: Prestasi / Reguler)" />

                            {/* Wave Selection - Only Indent Waves */}
                            {waves.length > 0 ? (
                                <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                                    <Select
                                        label="📌 Tahun Ajaran / Gelombang (INDENT)"
                                        name="wave_id"
                                        value={formData.wave_id}
                                        onChange={e => handleMainChange('wave_id', e.target.value)}
                                        options={waves.map(w => ({ value: w.id, label: `${w.year} - ${w.name} (Indent)` }))}
                                    />
                                    <p className="text-xs text-purple-600 mt-2 italic">⚠️ Anda mendaftar melalui jalur Inden Internal untuk tahun ajaran mendatang.</p>
                                </div>
                            ) : (
                                <div className="text-red-500 text-sm mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
                                    Tidak ada gelombang inden yang tersedia saat ini. Hubungi admin.
                                </div>
                            )}

                            {renderNav(4, 6, !formData.unit_id || !formData.wave_id || !formData.path_id || (selectedBranch?.level === 'SMK' && !formData.major))}
                        </div>
                    )}

                    {step === 6 && (
                        <div className="animate-fade-in">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2 mb-4 flex items-center gap-2"><FileText size={20} /> 6. Upload Dokumen Persyaratan</h3>

                            {/* Student Photo Upload Section */}
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 mb-6">
                                <h4 className="font-bold text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-2">📸 Pas Foto Siswa (Wajib)</h4>
                                <div className="text-sm text-emerald-700 dark:text-emerald-400 mb-4 bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>Foto harus <strong>jelas dan tajam</strong>.</li>
                                        <li>Menggunakan <strong>pakaian putih rapi</strong>.</li>
                                        <li>Background sesuaikan tahun kelahiran (Ganjil=Merah, Genap=Biru).</li>
                                    </ul>
                                </div>
                                <div className="flex items-center justify-between p-4 border rounded-xl bg-white dark:bg-slate-800 hover:shadow transition-all border-emerald-200 dark:border-emerald-700">
                                    <span className="uppercase font-medium text-sm flex items-center gap-3 text-slate-700 dark:text-slate-200">
                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-full border border-emerald-200 dark:border-emerald-700"><User size={16} className="text-emerald-600 dark:text-emerald-400" /></div> Pas Foto Siswa
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {uploadingDocs.photo_student ? (<span className="text-xs text-blue-600 font-bold flex items-center gap-1"><div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> Memproses...</span>) : formData.documents.photo_student ? (<div className="flex flex-col items-end"><span className="text-emerald-600 font-bold text-xs flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800"><CheckCircle size={14} /> Terupload</span></div>) : (<div className="relative"><input type="file" onChange={(e) => uploadFile('photo_student', e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" /><Button variant="secondary" className="text-xs py-1 pointer-events-none">Upload Foto</Button></div>)}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 mb-6">
                                {['kk', 'akta', 'rapor', 'surat_sehat'].map((type) => (
                                    <div key={type} className="flex items-center justify-between p-4 border rounded-xl bg-slate-50 hover:bg-white hover:shadow transition-all">
                                        <span className="uppercase font-medium text-sm flex items-center gap-3"><div className="p-2 bg-white rounded-full border"><FileText size={16} className="text-slate-500" /></div>{type.replace('_', ' ')}</span>
                                        <div className="flex items-center gap-2">{uploadingDocs[type] ? (<span className="text-xs text-blue-600 font-bold flex items-center gap-1"><div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> Memproses...</span>) : formData.documents[type] ? (<div className="flex flex-col items-end"><span className="text-emerald-600 font-bold text-xs flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100"><CheckCircle size={14} /> Terupload</span></div>) : (<div className="relative"><input type="file" onChange={(e) => uploadFile(type, e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*,.pdf" /><Button variant="secondary" className="text-xs py-1 pointer-events-none">Pilih File</Button></div>)}</div>
                                    </div>
                                ))}
                                {!(paths.find(p => p.id === formData.path_id)?.name || '').toLowerCase().includes('reguler') && (
                                    <div className="flex items-center justify-between p-4 border rounded-xl bg-yellow-50 hover:bg-white hover:shadow transition-all border-yellow-200">
                                        <div><span className="uppercase font-medium text-sm flex items-center gap-3"><div className="p-2 bg-white rounded-full border"><FileText size={16} className="text-slate-500" /></div>Surat Keterangan Desa ({paths.find(p => p.id === formData.path_id)?.name})</span></div>
                                        <div className="flex items-center gap-2">{uploadingDocs['sktm'] ? (<span className="text-xs text-blue-600 font-bold flex items-center gap-1"><div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> Memproses...</span>) : formData.documents['sktm'] ? (<div className="flex flex-col items-end"><span className="text-emerald-600 font-bold text-xs flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100"><CheckCircle size={14} /> Terupload</span></div>) : (<div className="relative"><input type="file" onChange={(e) => uploadFile('sktm', e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*,.pdf" /><Button variant="secondary" className="text-xs py-1 pointer-events-none">Pilih File</Button></div>)}</div>
                                    </div>
                                )}
                            </div>
                            {renderNav(5, 7, !formData.documents.kk || !formData.documents.surat_sehat || !formData.documents.photo_student || (!(paths.find(p => p.id === formData.path_id)?.name || '').toLowerCase().includes('reguler') && !formData.documents.sktm))}
                        </div>
                    )}

                    {step === 7 && (
                        <div className="animate-fade-in">
                            <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100 mb-6">
                                <h3 className="font-bold text-emerald-800 text-lg mb-2 flex items-center gap-2"><CheckSquare size={20} /> 7. Konfirmasi Akhir (Inden Internal)</h3>
                                <div className="text-left bg-white p-5 rounded-lg border text-sm space-y-3 mb-4 shadow-sm">
                                    <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Nama Siswa</span> <strong className="text-slate-800 dark:text-white">{formData.student_new.name}</strong></div>
                                    <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Asal Unit</span> <strong className="text-slate-800 dark:text-white">{formData.education.origin_school}</strong></div>
                                    <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Tujuan Unit</span> <strong className="text-slate-800 dark:text-white">{selectedBranch?.name}</strong></div>
                                    {formData.major && <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Jurusan</span> <strong className="text-slate-800 dark:text-white">{formData.major}</strong></div>}
                                    <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Gelombang Inden</span> <strong className="text-slate-800 dark:text-white">{waves.find(w => w.id === formData.wave_id)?.name}</strong></div>
                                    <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Jalur Pendaftaran</span> <strong className="text-slate-800 dark:text-white">{paths.find(p => p.id === formData.path_id)?.name}</strong></div>
                                    <div className="flex justify-between border-t pt-2 mt-2 font-bold text-emerald-700">
                                        <span>Total Biaya Daftar Ulang (Estimasi):</span>
                                        {(() => {
                                            const reregFee = selectedBranch?.cost_rereg !== undefined ? selectedBranch.cost_rereg : 0;
                                            const pName = paths.find(p => p.id === formData.path_id)?.name || '';
                                            const isScholarship = pName.toLowerCase().includes('prestasi') || pName.toLowerCase().includes('yatim');
                                            return <span>{isScholarship ? 'GRATIS (Beasiswa)' : `Rp ${reregFee.toLocaleString()}`}</span>;
                                        })()}
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <input type="checkbox" id="healthCheckIndent" checked={formData.agreed_health} onChange={e => handleMainChange('agreed_health', e.target.checked)} className="mt-1 w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500" />
                                    <label htmlFor="healthCheckIndent" className="text-sm text-yellow-800 leading-snug cursor-pointer select-none">Saya menyatakan data yang diisi benar. Saya memahami pendaftaran ini adalah <strong>Inden Internal</strong> untuk tahun ajaran mendatang, dan saya bersedia menanggung biaya daftar ulang sesuai ketentuan.</label>
                                </div>
                            </div>
                            {renderNav(6, null, !formData.agreed_health)}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
