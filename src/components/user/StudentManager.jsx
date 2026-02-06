import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    User, FileEdit, AlertTriangle, Info, Activity, MapPin, School, Users, FileText, CheckCircle, UploadCloud
} from 'lucide-react';
import { Button, Card } from '../ui/Elements';
import { Modal } from '../ui/Overlays';
import { fileToBase64 } from '../../utils/helpers';

export default function StudentManager({ user, showToast, initialTab }) {
    const [students, setStudents] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [activeTab, setActiveTab] = useState('biodata');

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    const [selectedStudent, setSelectedStudent] = useState(null);
    const [editRequestModal, setEditRequestModal] = useState(false);
    const [editReason, setEditReason] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(null);

    useEffect(() => {
        if (!user) return;

        // Fetch students data
        const fetchStudents = async () => {
            const { data } = await supabase
                .from('students')
                .select('*')
                .eq('user_id', user.id);
            if (data) {
                setStudents(data);
                if (!selectedStudent && data.length > 0) {
                    setSelectedStudent(data[0]);
                }
            }
        };

        // Fetch registrations data
        const fetchRegistrations = async () => {
            const { data } = await supabase
                .from('registrations')
                .select('*')
                .eq('user_id', user.id);
            if (data) setRegistrations(data);
        };

        fetchStudents();
        fetchRegistrations();

        // Real-time subscriptions
        const studentsChannel = supabase.channel('user_students_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'students', filter: `user_id=eq.${user.id}` }, fetchStudents)
            .subscribe();

        const regsChannel = supabase.channel('user_registrations_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `user_id=eq.${user.id}` }, fetchRegistrations)
            .subscribe();

        return () => {
            supabase.removeChannel(studentsChannel);
            supabase.removeChannel(regsChannel);
        };
    }, [user]);

    // Handle when students list updates, update selectedStudent if needed
    useEffect(() => {
        if (selectedStudent && students.length > 0) {
            const updated = students.find(s => s.id === selectedStudent.id);
            if (updated) setSelectedStudent(updated);
        }
    }, [students]);

    const handleRequestEdit = async () => {
        if (!editReason) return showToast("Alasan wajib diisi", "error");

        // Update student with edit request
        await supabase
            .from('students')
            .update({
                edit_request: {
                    status: 'pending',
                    reason: editReason,
                    requested_at: new Date().toISOString()
                }
            })
            .eq('id', selectedStudent.id);

        // Create edit request record
        await supabase.from('edit_requests').insert({
            student_id: selectedStudent.id,
            student_name: selectedStudent.name,
            user_id: user.id,
            parent_name: user.user_metadata?.full_name || user.email,
            reason: editReason,
            status: 'pending',
            requested_at: new Date().toISOString()
        });

        showToast("Permintaan edit data dikirim ke Admin");
        setEditRequestModal(false);
    };

    const openEdit = () => { setEditForm(JSON.parse(JSON.stringify(selectedStudent))); setIsEditing(true); };

    const saveEdit = async () => {
        try {
            const { id, ...dataToUpdate } = editForm;

            // Update student record
            const { error: studentError } = await supabase
                .from('students')
                .update(dataToUpdate)
                .eq('id', id);

            if (studentError) throw studentError;

            // Update related registrations with new name
            const newName = dataToUpdate.name;
            await supabase
                .from('registrations')
                .update({ student_name: newName })
                .eq('student_id', id);

            showToast("Data berhasil diperbarui!");
            setIsEditing(false);
            setEditForm(null);
        } catch (e) {
            showToast("Gagal menyimpan: " + e.message, 'error');
        }
    };

    const handleDocUpload = async (key, file) => {
        if (!file) return;
        const currentReg = registrations.find(r => r.student_id === selectedStudent?.id);
        if (!currentReg) return;

        try {
            showToast('Mengupload dokumen...', 'info');
            const base64 = await fileToBase64(file);

            // Get current uploaded_docs and merge with new doc
            const currentDocs = currentReg.uploaded_docs || {};
            const updatedDocs = { ...currentDocs, [key]: base64 };

            const { error } = await supabase
                .from('registrations')
                .update({
                    uploaded_docs: updatedDocs,
                    agreements_verified: 'pending' // Reset verification if re-uploaded
                })
                .eq('id', currentReg.id);

            if (error) throw error;

            showToast('Dokumen berhasil diupload!');
        } catch (e) {
            showToast('Gagal upload: ' + e.message, 'error');
        }
    };

    const EditField = ({ label, val, onChange, type = 'text', mb = 'mb-3' }) => (
        <div className={mb}>
            <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
            <input
                type={type}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-shadow"
                value={val || ''}
                onChange={e => onChange(e.target.value)}
            />
        </div>
    );

    const InfoRow = ({ label, value }) => (
        <div className="flex flex-col sm:flex-row sm:justify-between border-b border-slate-50 dark:border-slate-700 py-3 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 px-3 rounded transition-colors group">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{label}</span>
            <span className="font-medium text-slate-800 dark:text-white text-sm text-right mt-1 sm:mt-0">{value || '-'}</span>
        </div>
    );

    const SectionHeader = ({ icon, title }) => (
        <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/40 dark:to-slate-800 p-3 rounded-lg mt-8 mb-4 border-l-4 border-emerald-500 shadow-sm text-emerald-800 dark:text-emerald-200 font-bold text-sm uppercase tracking-wider">
            {icon} {title}
        </div>
    );

    const getUploadedDocs = (studentId) => {
        const reg = registrations.find(r => r.student_id === studentId);
        return reg?.uploaded_docs || {};
    };

    if (students.length === 0) {
        return (
            <div className="text-center py-20 bg-white border border-dashed rounded-xl">
                <Users className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                <h3 className="text-sm font-medium text-slate-600">Belum ada data anak.</h3>
                <p className="text-xs text-slate-400 mt-1">Data akan muncul setelah Anda melakukan pendaftaran.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Users className="text-emerald-600" /> Data Anak
                </h2>

                {/* Mobile Student Select if multiple - Horizontal Scroll */}
                {students.length > 1 && (
                    <div className="md:hidden flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                        {students.map(s => (
                            <div
                                key={s.id}
                                onClick={() => setSelectedStudent(s)}
                                className={`shrink-0 w-64 p-4 rounded-2xl border transition-all shadow-sm ${selectedStudent?.id === s.id
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent ring-2 ring-emerald-200 ring-offset-2'
                                    : 'bg-white border-slate-100 text-slate-600'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${selectedStudent?.id === s.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {s.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm truncate w-40">{s.name}</div>
                                        <div className={`text-[10px] ${selectedStudent?.id === s.id ? 'text-emerald-100' : 'text-slate-400'}`}>{s.nik || 'NIK Belum diisi'}</div>
                                    </div>
                                    {selectedStudent?.id === s.id && <CheckCircle className="ml-auto text-emerald-200" size={16} />}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar List (Desktop) */}
                {students.length > 1 && (
                    <div className="hidden md:flex flex-col gap-3 w-72 shrink-0">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 mb-1">Daftar Anak</div>
                        {students.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSelectedStudent(s)}
                                className={`group text-left p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden ${selectedStudent?.id === s.id
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-xl shadow-emerald-900/20 scale-[1.02]'
                                    : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-emerald-200 hover:shadow-md'
                                    }`}
                            >
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-transform group-hover:scale-110 ${selectedStudent?.id === s.id ? 'bg-white/20 backdrop-blur-sm text-white shadow-inner' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                                        {s.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold truncate text-sm md:text-base">{s.name}</div>
                                        <div className={`text-xs mt-0.5 truncate flex items-center gap-1.5 ${selectedStudent?.id === s.id ? 'text-emerald-100' : 'text-slate-400 group-hover:text-emerald-600/70'}`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                            {s.nik || 'NIK -'}
                                        </div>
                                    </div>
                                    {selectedStudent?.id === s.id && (
                                        <div className="bg-white/20 p-1.5 rounded-full backdrop-blur-md">
                                            <CheckCircle size={16} className="text-white" />
                                        </div>
                                    )}
                                </div>
                                {/* Decorative bg blobs */}
                                {selectedStudent?.id === s.id && (
                                    <>
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full blur-xl -ml-10 -mb-10"></div>
                                    </>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Main Content Area */}
                {selectedStudent && (
                    <Card className="flex-1 p-0 overflow-hidden border border-slate-200 shadow-lg md:rounded-2xl">
                        {/* Profile Header */}
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 md:p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-10 -translate-y-1/2 translate-x-1/2"></div>

                            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                                <div className="w-20 h-20 md:w-24 md:h-24 bg-white/20 backdrop-blur-md rounded-full p-1 shadow-2xl border border-white/30">
                                    <div className="w-full h-full bg-white rounded-full flex items-center justify-center overflow-hidden">
                                        <User size={40} className="text-emerald-200" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h1 className="text-2xl md:text-3xl font-black mb-1 text-white drop-shadow-sm tracking-tight">{selectedStudent.name}</h1>
                                    <div className="flex flex-wrap gap-2 text-sm md:text-base text-emerald-50 font-medium items-center">
                                        <span>{selectedStudent.pob}, {selectedStudent.dob}</span>
                                        <span className="opacity-50">•</span>
                                        <span>{selectedStudent.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                                    </div>

                                    {/* Edit Status Badge */}
                                    {selectedStudent.edit_request && (
                                        <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${selectedStudent.edit_request.status === 'pending' ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30' : (selectedStudent.edit_request.status === 'approved' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' : 'bg-red-500/20 text-red-200 border border-red-500/30')}`}>
                                            <Activity size={12} /> Status Edit: {selectedStudent.edit_request.status}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    {selectedStudent.edit_request?.status === 'approved' ? (
                                        <Button onClick={openEdit} className="bg-emerald-500 text-white hover:bg-emerald-400 border-none shadow-lg shadow-emerald-900/20"><FileEdit size={16} /> Edit Sekarang</Button>
                                    ) : (
                                        (!selectedStudent.edit_request || selectedStudent.edit_request?.status === 'rejected') && (
                                            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => setEditRequestModal(true)}><FileEdit size={16} /> Ajukan Edit</Button>
                                        )
                                    )}
                                    {selectedStudent.edit_request?.status === 'pending' && (
                                        <div className="text-xs text-amber-300 italic flex items-center gap-1 bg-amber-900/30 px-3 py-2 rounded-lg border border-amber-500/30">
                                            <Info size={12} /> Menunggu persetujuan admin
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
                            <button
                                onClick={() => setActiveTab('biodata')}
                                className={`flex-1 py-4 px-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${activeTab === 'biodata' ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                            >
                                Biodata Lengkap
                            </button>
                            <button
                                onClick={() => setActiveTab('berkas')}
                                className={`flex-1 py-4 px-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${activeTab === 'berkas' ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                            >
                                Berkas Dokumen
                            </button>
                            {/* NEW TAB FOR DAFTAR ULANG */}
                            {(() => {
                                const st = registrations.find(r => r.student_id === selectedStudent?.id)?.status;
                                // Show for Lulus, Accepted, or any subsequent status
                                if (['lulus', 'accepted', 'paid', 'verified', 'verifying_payment'].includes(st)) {
                                    return (
                                        <button
                                            onClick={() => setActiveTab('daftar_ulang')}
                                            className={`flex-1 py-4 px-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${activeTab === 'daftar_ulang' ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            Persyaratan Daftar Ulang
                                        </button>
                                    );
                                }
                                return null;
                            })()}
                        </div>

                        {/* Content Area */}
                        <div className="p-6 md:p-8 bg-white dark:bg-slate-900 min-h-[500px]">
                            {activeTab === 'biodata' && (
                                <div className="animate-fade-in max-w-4xl mx-auto">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div>
                                            <SectionHeader icon={<User size={16} />} title="A. Keterangan Pribadi" />
                                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                                <InfoRow label="1a. Nama Lengkap" value={selectedStudent.name} />
                                                <InfoRow label="1b. Nama Panggilan" value={selectedStudent.nickname} />
                                                <InfoRow label="NIK" value={selectedStudent.nik} />
                                                <InfoRow label="No. KK" value={selectedStudent.kk} />
                                                <InfoRow label="2. Jenis Kelamin" value={selectedStudent.gender === 'L' ? 'Laki-laki' : 'Perempuan'} />
                                                <InfoRow label="3. Tempat, Tgl Lahir" value={`${selectedStudent.pob}, ${selectedStudent.dob}`} />
                                                <InfoRow label="4. Agama" value={selectedStudent.religion} />
                                                <InfoRow label="5. Kewarganegaraan" value={selectedStudent.nationality || 'Indonesia'} />
                                                <InfoRow label="6. Anak ke" value={selectedStudent.child_order} />
                                                <InfoRow label="7. Jumlah Saudara Kandung" value={selectedStudent.siblings_count} />
                                                <InfoRow label="8. Jumlah Saudara Tiri" value={selectedStudent.siblings_step || '0'} />
                                                <InfoRow label="9. Jumlah Saudara Angkat" value={selectedStudent.siblings_adopted || '0'} />
                                                <InfoRow label="10. Status Anak" value={selectedStudent.orphan_status || 'Lengkap'} />
                                                <InfoRow label="11. Bahasa Sehari-hari" value={selectedStudent.daily_language || 'Indonesia'} />
                                            </div>

                                            <SectionHeader icon={<Activity size={16} />} title="C. Keterangan Kesehatan" />
                                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden p-4">
                                                <div className="grid grid-cols-3 gap-3 mb-4">
                                                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600"><div className="text-[10px] uppercase font-bold text-slate-400 mb-1">20a. Tinggi</div><div className="font-bold text-slate-800 dark:text-white text-lg">{selectedStudent.height} <span className="text-xs font-normal text-slate-500">cm</span></div></div>
                                                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600"><div className="text-[10px] uppercase font-bold text-slate-400 mb-1">20b. Berat</div><div className="font-bold text-slate-800 dark:text-white text-lg">{selectedStudent.weight} <span className="text-xs font-normal text-slate-500">kg</span></div></div>
                                                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600"><div className="text-[10px] uppercase font-bold text-slate-400 mb-1">17. Gol. Darah</div><div className="font-bold text-slate-800 dark:text-white text-lg">{selectedStudent.blood_type}</div></div>
                                                </div>
                                                <div className="space-y-2">
                                                    <InfoRow label="18a. Penyakit yang Pernah Diderita" value={selectedStudent.diseases} />
                                                    <InfoRow label="18b. Tempat Dirawat" value={selectedStudent.diseases_hospital} />
                                                    <InfoRow label="19. Kelainan Jasmani" value={selectedStudent.physical_disability} />
                                                    <InfoRow label="Alergi" value={selectedStudent.allergies} />
                                                    <InfoRow label="Kebutuhan Khusus" value={selectedStudent.special_needs} />
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <SectionHeader icon={<Users size={16} />} title="Data Orang Tua" />
                                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden mb-6">
                                                {/* Father */}
                                                <div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 border-b border-slate-100 dark:border-slate-700">
                                                    <h5 className="font-bold text-blue-800 text-xs uppercase mb-3 flex items-center gap-2"><User size={14} /> Data Ayah</h5>
                                                    <div className="grid grid-cols-1 gap-1">
                                                        <InfoRow label="Nama" value={selectedStudent.parents?.father?.name} />
                                                        <InfoRow label="Pekerjaan" value={selectedStudent.parents?.father?.job} />
                                                        <InfoRow label="No. HP" value={selectedStudent.parents?.father?.phone} />
                                                    </div>
                                                </div>
                                                {/* Mother */}
                                                <div className="p-4 bg-pink-50/50 dark:bg-pink-900/20">
                                                    <h5 className="font-bold text-pink-800 text-xs uppercase mb-3 flex items-center gap-2"><User size={14} /> Data Ibu</h5>
                                                    <div className="grid grid-cols-1 gap-1">
                                                        <InfoRow label="Nama" value={selectedStudent.parents?.mother?.name} />
                                                        <InfoRow label="Pekerjaan" value={selectedStudent.parents?.mother?.job} />
                                                        <InfoRow label="No. HP" value={selectedStudent.parents?.mother?.phone} />
                                                    </div>
                                                </div>
                                            </div>

                                            <SectionHeader icon={<MapPin size={16} />} title="Alamat Tempat Tinggal" />
                                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                                <InfoRow label="Alamat Lengkap" value={selectedStudent.address?.street} />
                                                <InfoRow label="Desa / Kelurahan" value={selectedStudent.address?.village} />
                                                <InfoRow label="Kecamatan" value={selectedStudent.address?.district} />
                                                <InfoRow label="Kabupaten / Kota" value={selectedStudent.address?.regency} />
                                                <InfoRow label="Provinsi" value={selectedStudent.address?.province} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'berkas' && (
                                <div className="animate-fade-in max-w-4xl mx-auto">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {(() => {
                                            const docs = getUploadedDocs(selectedStudent.id);
                                            const docKeys = Object.keys(docs || {});

                                            if (docKeys.length === 0) return <div className="col-span-full text-center p-10 bg-slate-50 rounded-xl border border-dashed text-slate-400">Belum ada dokumen yang diupload.</div>;

                                            return docKeys.map(key => docs[key] ? (
                                                <div key={key} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition group">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                                            <FileText size={20} />
                                                        </div>
                                                        <CheckCircle size={16} className="text-emerald-500" />
                                                    </div>
                                                    <h5 className="font-bold text-slate-700 dark:text-slate-200 text-sm uppercase mb-1">{key.replace('_', ' ')}</h5>
                                                    <p className="text-xs text-slate-400 mb-4">Dokumen Tersimpan</p>

                                                    <button
                                                        onClick={() => { const win = window.open(); win.document.write('<iframe src="' + docs[key] + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>'); }}
                                                        className="w-full py-2 bg-slate-50 text-slate-600 font-bold text-xs rounded-lg hover:bg-slate-100 transition-colors"
                                                    >
                                                        Lihat File
                                                    </button>
                                                </div>
                                            ) : null)
                                        })()}
                                    </div>
                                </div>
                            )}
                            {activeTab === 'daftar_ulang' && (
                                <div className="animate-fade-in max-w-4xl mx-auto">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 p-4 rounded-xl mb-6 flex gap-3 text-blue-800 dark:text-blue-200">
                                        <Info className="shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-bold mb-1">Persyaratan Wajib untuk Daftar Ulang</h4>
                                            <p className="text-sm">Untuk melakukan pembayaran Daftar Ulang, Anda diwajibkan mengupload 4 dokumen berikut:</p>
                                            <ul className="list-disc ml-5 text-sm mt-2 space-y-1">
                                                <li><strong>Surat Pernyataan Tidak Merokok</strong></li>
                                                <li><strong>Surat Pernyataan Tidak Terlibat LGBT</strong></li>
                                                <li><strong>Surat Pernyataan Bebas Kriminal/Kekerasan</strong></li>
                                                <li><strong>Surat Sehat (MCU)</strong> dari Dokter/RS/Puskesmas</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {(() => {
                                        const curReg = registrations.find(r => r.student_id === selectedStudent?.id);
                                        const docs = curReg?.uploaded_docs || {};
                                        const verified = curReg?.agreements_verified;

                                        const uploadItems = [
                                            { key: 'agreement_rokok', label: 'Surat Bebas Asap Rokok', sub: 'Tanda tangan Ortu & Siswa', icon: <FileText size={24} /> },
                                            { key: 'agreement_lgbt', label: 'Surat Tidak Terlibat LGBT', sub: 'Tanda tangan Ortu & Siswa', icon: <FileText size={24} /> },
                                            { key: 'agreement_kriminal', label: 'Surat Bebas Kriminal', sub: 'Tanda tangan Ortu & Siswa', icon: <FileText size={24} /> },
                                            { key: 'mcu_letter', label: 'Surat Sehat (MCU)', sub: 'Dari Dokter / RS / Puskesmas', icon: <Activity size={24} /> }
                                        ];

                                        return (
                                            <div className="space-y-6">
                                                {verified === false && (
                                                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-200 flex gap-3 items-center">
                                                        <AlertTriangle />
                                                        <div>
                                                            <div className="font-bold">Dokumen Ditolak</div>
                                                            <div className="text-sm">{curReg?.agreements_notes || 'Silakan perbaiki dokumen yang ditandai.'}</div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {uploadItems.map(item => (
                                                        <div key={item.key} className="border rounded-xl p-5 bg-white relative overflow-hidden group hover:border-emerald-400 transition-all flex flex-col justify-between h-full">
                                                            <div>
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
                                                                        {item.icon}
                                                                    </div>
                                                                    {docs[item.key] && <CheckCircle className="text-emerald-500" />}
                                                                </div>
                                                                <h4 className="font-bold text-slate-800 dark:text-white">{item.label}</h4>
                                                                <p className="text-xs text-slate-400 mb-4">{item.sub}</p>

                                                                {docs[item.key] ? (
                                                                    <div className="space-y-2">
                                                                        <button onClick={() => { const win = window.open(); win.document.write('<iframe src="' + docs[item.key] + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>'); }} className="w-full py-2 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded hover:bg-slate-100 dark:hover:bg-slate-600">Lihat File</button>
                                                                        {(!['valid', true].includes(verified)) && (
                                                                            <div className="relative">
                                                                                <input type="file" onChange={e => handleDocUpload(item.key, e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="application/pdf,image/*" />
                                                                                <button className="w-full py-2 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-xs font-bold rounded hover:bg-white dark:hover:bg-slate-700">Ganti File</button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="relative">
                                                                        <input type="file" onChange={e => handleDocUpload(item.key, e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="application/pdf,image/*" />
                                                                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors">
                                                                            <UploadCloud className="mx-auto text-slate-300 mb-2" />
                                                                            <span className="text-xs font-bold text-slate-500">Upload File</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {item.key !== 'mcu_letter' && (
                                                                <div className="mt-4 pt-4 border-t">
                                                                    <button onClick={() => showToast('Template didownload... (Simulasi)')} className="text-[10px] text-blue-500 font-bold hover:underline flex items-center gap-1">
                                                                        <FileText size={12} /> Download Template
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </Card>
                )}
            </div>

            {/* MODAL REQUEST EDIT */}
            <Modal isOpen={editRequestModal} onClose={() => setEditRequestModal(false)} title="Ajukan Edit Data" footer={<div className="flex justify-end gap-2 w-full"><Button variant="secondary" onClick={() => setEditRequestModal(false)}>Batal</Button><Button onClick={handleRequestEdit}>Kirim Pengajuan</Button></div>}>
                <div className="space-y-4">
                    <div className="bg-amber-50 p-4 rounded-xl text-amber-800 text-sm flex gap-3 border border-amber-100">
                        <AlertTriangle size={20} className="shrink-0" />
                        <p>Untuk menjaga validitas data, perubahan yang dilakukan setelah pendaftaran harus melalui persetujuan admin. Silakan tulis alasan Anda.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Alasan Perubahan:</label>
                        <textarea className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" rows={4} placeholder="Contoh: Salah input tanggal lahir, pindah alamat, dll." value={editReason} onChange={e => setEditReason(e.target.value)}></textarea>
                    </div>
                </div>
            </Modal>

            {/* MODAL EDIT DATA FORM */}
            <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title={`Edit Data: ${editForm?.name}`} footer={<div className="flex justify-end gap-2 w-full"><Button variant="secondary" onClick={() => setIsEditing(false)}>Batal</Button><Button onClick={saveEdit}>Simpan Perubahan</Button></div>}>
                {editForm && (
                    <div className="space-y-6 h-[70vh] overflow-y-auto pr-2">
                        <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 flex items-center gap-2 border border-blue-100">
                            <Info size={16} />
                            <span>Silakan perbaiki data yang salah di bawah ini.</span>
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-white border-b pb-2 mb-4 uppercase text-xs tracking-wider">Identitas Anak</h4>
                            <EditField label="Nama Lengkap" val={editForm.name} onChange={v => setEditForm({ ...editForm, name: v })} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <EditField label="NIK" val={editForm.nik} onChange={v => setEditForm({ ...editForm, nik: v })} />
                                <EditField label="No. KK" val={editForm.kk} onChange={v => setEditForm({ ...editForm, kk: v })} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <EditField label="Tempat Lahir" val={editForm.pob} onChange={v => setEditForm({ ...editForm, pob: v })} />
                                <EditField label="Tanggal Lahir" type="date" val={editForm.dob} onChange={v => setEditForm({ ...editForm, dob: v })} />
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-white border-b pb-2 mb-4 uppercase text-xs tracking-wider mt-2">Data Orang Tua</h4>
                            <div className="p-4 border rounded-xl bg-slate-50 mb-4">
                                <h5 className="font-bold text-xs text-blue-600 mb-3 flex items-center gap-1"><User size={12} /> DATA AYAH</h5>
                                <EditField label="Nama Ayah" val={editForm.parents?.father?.name} onChange={v => setEditForm({ ...editForm, parents: { ...editForm.parents, father: { ...editForm.parents.father, name: v } } })} />
                                <EditField label="No. HP Ayah" val={editForm.parents?.father?.phone} onChange={v => setEditForm({ ...editForm, parents: { ...editForm.parents, father: { ...editForm.parents.father, phone: v } } })} mb="mb-0" />
                            </div>
                            <div className="p-4 border rounded-xl bg-slate-50">
                                <h5 className="font-bold text-xs text-pink-600 mb-3 flex items-center gap-1"><User size={12} /> DATA IBU</h5>
                                <EditField label="Nama Ibu" val={editForm.parents?.mother?.name} onChange={v => setEditForm({ ...editForm, parents: { ...editForm.parents, mother: { ...editForm.parents.mother, name: v } } })} />
                                <EditField label="No. HP Ibu" val={editForm.parents?.mother?.phone} onChange={v => setEditForm({ ...editForm, parents: { ...editForm.parents, mother: { ...editForm.parents.mother, phone: v } } })} mb="mb-0" />
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
