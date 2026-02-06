import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    Trophy, XCircle, Download, FileText, Printer, Share2, Info, Clock, CheckCircle,
    User, BarChart3, Megaphone, ChevronDown, ChevronUp, Award, UserCheck, UserX, Users2, School
} from 'lucide-react';
import Confetti from 'react-confetti';
import { Badge, Button, Card } from '../ui/Elements';

export default function AnnouncementBoard({ user }) {
    const [registrations, setRegistrations] = useState([]);
    const [allRegistrations, setAllRegistrations] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [settings, setSettings] = useState(null);
    const [activeTab, setActiveTab] = useState(0); // For multiple children in surat kelulusan
    const [mainTab, setMainTab] = useState('pribadi'); // 'pribadi', 'umum', 'surat'
    const letterRef = React.useRef(null);

    // Lazy load libraries for PDF
    const handleDownloadPDF = async () => {
        try {
            const html2canvas = (await import('html2canvas')).default;
            const jsPDF = (await import('jspdf')).default;

            const element = letterRef.current;
            if (!element) return;

            const canvas = await html2canvas(element, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Surat_Keputusan_${registrations[0]?.student_name || 'Siswa'}.pdf`);
        } catch (error) {
            console.error('PDF Generation failed', error);
            alert('Gagal mendownload PDF. Silakan coba lagi.');
        }
    };

    const handleShare = async () => {
        const shareData = {
            title: 'Pengumuman Kelulusan PSB',
            text: `Alhamdulillah, saya dinyatakan LULUS seleksi penerimaan siswa baru di ${settings?.school_name || 'Sekolah'}.`,
            url: window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Error sharing', err);
            }
        } else {
            navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
            alert('Link pengumuman disalin ke clipboard!');
        }
    };

    useEffect(() => {
        if (!user) return;

        // Fetch user's registrations
        const fetchRegistrations = async () => {
            const { data } = await supabase
                .from('registrations')
                .select('*')
                .eq('user_id', user.id);
            if (data) setRegistrations(data);
        };

        // Fetch settings
        const fetchSettings = async () => {
            const { data } = await supabase
                .from('settings')
                .select('*')
                .eq('id', 'main')
                .single();
            if (data) setSettings(data);
        };

        // Fetch all registrations for public announcements
        const fetchAllRegistrations = async () => {
            const { data } = await supabase
                .from('registrations')
                .select('*');
            if (data) setAllRegistrations(data);
        };

        // Fetch academic years
        const fetchAcademicYears = async () => {
            const { data } = await supabase
                .from('academic_years')
                .select('*');
            if (data) setAcademicYears(data);
        };

        fetchRegistrations();
        fetchSettings();
        fetchAllRegistrations();
        fetchAcademicYears();

        // Real-time subscriptions
        const regsChannel = supabase.channel('user_announcements_regs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `user_id=eq.${user.id}` }, fetchRegistrations)
            .subscribe();

        const allRegsChannel = supabase.channel('all_announcements_regs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, fetchAllRegistrations)
            .subscribe();

        return () => {
            supabase.removeChannel(regsChannel);
            supabase.removeChannel(allRegsChannel);
        };
    }, [user]);

    const LetterHead = () => (
        <div className="flex items-center gap-4 mb-8 border-b-2 border-slate-800 pb-4">
            <div className="w-20 h-20 bg-emerald-900 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                {settings?.school_name ? settings.school_name[0] : 'S'}
            </div>
            <div className="flex-1 text-center">
                <h1 className="font-bold text-xl uppercase tracking-widest text-slate-900">Panitia Penerimaan Siswa Baru</h1>
                <h2 className="font-bold text-2xl text-emerald-800 uppercase my-1">{settings?.school_name || 'Sekolahku'}</h2>
                <p className="text-xs text-slate-600">
                    {settings?.school_address || 'Alamat Sekolah Belum Diatur'}
                    {settings?.school_phone && ` • Telp: ${settings.school_phone}`}
                </p>
                <p className="text-xs text-slate-600">
                    {settings?.school_email && `Email: ${settings.school_email}`}
                </p>
            </div>
        </div>
    );

    if (!user) return null;

    // ============ DATA FOR KELULUSAN PRIBADI ============
    const graduatedRegs = registrations.filter(r =>
        ['lulus', 'tidak_lulus', 'cadangan', 'paid', 'student', 'accepted', 'rejected'].includes(r.status) ||
        r.psychotest_score !== undefined ||
        r.final_score !== undefined
    );

    // ============ DATA FOR KELULUSAN UMUM ============
    const defaultAY = academicYears.find(ay => ay.is_default);
    const currentYearRegs = allRegistrations.filter(r =>
        r.academic_year === defaultAY?.year || r.academic_year_id === defaultAY?.id
    );

    const lulusCount = currentYearRegs.filter(r =>
        r.status === 'lulus' || r.status === 'paid' || r.status === 'student' || r.status === 'accepted'
    ).length;

    const cadanganCount = currentYearRegs.filter(r => r.status === 'cadangan').length;

    const tidakLulusCount = currentYearRegs.filter(r =>
        r.status === 'tidak_lulus' || r.status === 'rejected'
    ).length;

    // Group lulus by unit
    const lulusByUnit = {};
    currentYearRegs.forEach(r => {
        if (r.status === 'lulus' || r.status === 'paid' || r.status === 'student' || r.status === 'accepted') {
            const unitName = r.unit_name || 'Unknown';
            lulusByUnit[unitName] = (lulusByUnit[unitName] || 0) + 1;
        }
    });

    // ============ DATA FOR SURAT KELULUSAN ============
    const passedRegistrations = registrations.filter(reg => {
        const path = (reg.path_name || '').toLowerCase();
        const isScholarship = path.includes('prestasi') || path.includes('beasiswa') || path.includes('yatim') || path.includes('tahfidz');
        let isFinal = reg.status === 'lulus' || reg.status === 'rejected' || reg.status === 'paid' || reg.status === 'student';

        if (!isScholarship && reg.status === 'accepted') {
            isFinal = true;
        }
        return isFinal;
    });

    const inProgressRegs = registrations.filter(reg => {
        const path = (reg.path_name || '').toLowerCase();
        const isScholarship = path.includes('prestasi') || path.includes('beasiswa') || path.includes('yatim') || path.includes('tahfidz');
        let isFinal = reg.status === 'lulus' || reg.status === 'rejected' || reg.status === 'paid' || reg.status === 'student';
        if (!isScholarship && reg.status === 'accepted') isFinal = true;
        return !isFinal;
    });

    const activeReg = passedRegistrations[activeTab];

    // ============ RENDER KELULUSAN PRIBADI ============
    const renderKelulusanPribadi = () => (
        <div className="space-y-4 animate-fade-in">
            {graduatedRegs.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Award size={32} />
                    </div>
                    <h4 className="font-bold text-slate-600 dark:text-slate-300">Belum Ada Hasil</h4>
                    <p className="text-sm text-slate-400 mt-1">Hasil kelulusan Anda akan muncul di sini.</p>
                </div>
            ) : (
                graduatedRegs.map(reg => {
                    const isLulus = ['lulus', 'paid', 'student', 'accepted'].includes(reg.status);
                    const isCadangan = reg.status === 'cadangan';
                    const isTidakLulus = reg.status === 'tidak_lulus' || reg.status === 'rejected';

                    let statusBg, statusText, statusLabel, statusIcon;
                    if (isLulus) {
                        statusBg = 'bg-emerald-100'; statusText = 'text-emerald-700';
                        statusLabel = 'LULUS'; statusIcon = <CheckCircle size={16} />;
                    } else if (isCadangan) {
                        statusBg = 'bg-amber-100'; statusText = 'text-amber-700';
                        statusLabel = 'CADANGAN'; statusIcon = <Clock size={16} />;
                    } else if (isTidakLulus) {
                        statusBg = 'bg-rose-100'; statusText = 'text-rose-700';
                        statusLabel = 'TIDAK LULUS'; statusIcon = <XCircle size={16} />;
                    } else {
                        statusBg = 'bg-blue-100'; statusText = 'text-blue-700';
                        statusLabel = 'MENUNGGU'; statusIcon = <Clock size={16} />;
                    }

                    return (
                        <div key={reg.id} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h4 className="font-black text-slate-800 dark:text-white text-lg">{reg.student_name}</h4>
                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                        <School size={12} /> {reg.unit_name} {reg.major ? `- ${reg.major}` : ''}
                                    </p>
                                </div>
                                <div className={`${statusBg} ${statusText} px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest`}>
                                    {statusIcon} {statusLabel}
                                </div>
                            </div>

                            {(reg.psychotest_score !== undefined || reg.interview_score !== undefined || reg.final_score !== undefined || reg.final_scores || reg.psychotest_result) && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    {(reg.psychotest_score !== undefined || reg.final_scores?.psychotest || reg.psychotest_result?.final_score) && (
                                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nilai Psikotes</div>
                                            <div className="text-xl font-black text-indigo-600">{reg.psychotest_score || reg.final_scores?.psychotest || reg.psychotest_result?.final_score || '-'}</div>
                                        </div>
                                    )}
                                    {(reg.interview_score !== undefined || reg.final_scores?.average_interview || reg.interview_result?.average_score) && (
                                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nilai Wawancara</div>
                                            <div className="text-xl font-black text-blue-600">{reg.interview_score || reg.final_scores?.average_interview || reg.interview_result?.average_score || '-'}</div>
                                        </div>
                                    )}
                                    {reg.academic_score !== undefined && (
                                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nilai Akademik</div>
                                            <div className="text-xl font-black text-amber-600">{reg.academic_score}</div>
                                        </div>
                                    )}
                                    {reg.final_score !== undefined && (
                                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nilai Akhir</div>
                                            <div className="text-2xl font-black text-emerald-600">{reg.final_score}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {reg.ranking !== undefined && (
                                <div className="mt-4 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Trophy size={18} className="text-amber-600" />
                                        <span className="text-xs font-bold text-amber-800 dark:text-amber-300">Peringkat</span>
                                    </div>
                                    <span className="text-lg font-black text-amber-700 dark:text-amber-200">#{reg.ranking}</span>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );

    // ============ RENDER KELULUSAN UMUM ============
    const renderKelulusanUmum = () => (
        <div className="animate-fade-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {/* Lulus */}
                <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="text-2xl md:text-3xl font-black text-emerald-700 dark:text-emerald-300">
                                {lulusCount} <span className="text-base font-bold">Orang</span>
                            </div>
                            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">Lulus</div>
                        </div>
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-xl">
                            <UserCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                </div>

                {/* Cadangan */}
                <div className="p-5 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-2xl border border-amber-100 dark:border-amber-800">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="text-2xl md:text-3xl font-black text-amber-700 dark:text-amber-300">
                                {cadanganCount > 0 ? `${cadanganCount} Orang` : 'Tidak Ada'}
                            </div>
                            <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1">Cadangan</div>
                        </div>
                        <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-xl">
                            <Users2 size={20} className="text-amber-600 dark:text-amber-400" />
                        </div>
                    </div>
                </div>

                {/* Tidak Lulus */}
                <div className="p-5 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-2xl border border-rose-100 dark:border-rose-800">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="text-2xl md:text-3xl font-black text-rose-700 dark:text-rose-300">
                                {tidakLulusCount} <span className="text-base font-bold">Orang</span>
                            </div>
                            <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-1">Tidak Lulus</div>
                        </div>
                        <div className="p-2 bg-rose-100 dark:bg-rose-800 rounded-xl">
                            <UserX size={20} className="text-rose-600 dark:text-rose-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Breakdown by Unit */}
            {Object.keys(lulusByUnit).length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <School size={14} /> Jumlah Lulus per Unit
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(lulusByUnit).map(([unitName, count]) => (
                            <div key={unitName} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{unitName}</span>
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-black">
                                    {count} Siswa
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Academic Year Info */}
            {defaultAY && (
                <div className="mt-6 p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 text-center">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        Data Kelulusan Tahun Ajaran {defaultAY.year}
                    </span>
                </div>
            )}
        </div>
    );

    // ============ RENDER SURAT KELULUSAN ============
    const renderSuratKelulusan = () => {
        const infoCards = inProgressRegs.map(reg => {
            const path = (reg.path_name || '').toLowerCase();
            const isScholarship = path.includes('prestasi') || path.includes('beasiswa') || path.includes('yatim') || path.includes('tahfidz');
            return (
                <Card key={reg.id} className="p-6 border-l-4 border-l-blue-500 mb-6 bg-white shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                            <Clock size={24} />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-lg text-slate-800">{reg.student_name}</h4>
                                    <p className="text-sm text-slate-500 mb-2">No. Peserta: {reg.id.slice(0, 8).toUpperCase()}</p>
                                </div>
                                <Badge status={reg.status} />
                            </div>
                            <p className="text-slate-600 text-sm mt-2">
                                Status saat ini: <span className="font-bold text-slate-800 capitalize">{reg.status === 'submitted' ? 'Data Terkirim' : (reg.status === 'accepted' ? 'Lolos Seleksi Tahap 1' : reg.status.replace('_', ' '))}</span>.
                                {reg.status === 'submitted'
                                    ? " Data pendaftaran Anda telah berhasil dikirim dan sedang menunggu verifikasi admin atau pembayaran biaya pendaftaran."
                                    : (reg.status === 'accepted' && isScholarship)
                                        ? " Selamat! Anda dinyatakan Lolos Seleksi Tahap 1. Namun, Surat Kelulusan resmi baru akan diterbitkan setelah Anda melengkapi berkas Surat Perjanjian & MCU. Silakan cek menu Dashboard."
                                        : " Pengumuman kelulusan resmi akan diterbitkan di halaman ini setelah seluruh proses seleksi selesai."}
                            </p>
                        </div>
                    </div>
                </Card>
            );
        });

        return (
            <div className="animate-fade-in">
                {infoCards}

                {passedRegistrations.length > 0 ? (
                    <div className="space-y-6">
                        {passedRegistrations.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {passedRegistrations.map((reg, idx) => (
                                    <button
                                        key={reg.id}
                                        onClick={() => setActiveTab(idx)}
                                        className={`px-6 py-2 rounded-full font-bold text-sm transition-all whitespace-nowrap ${activeTab === idx
                                            ? 'bg-emerald-600 text-white shadow-lg'
                                            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                                            }`}
                                    >
                                        {reg.student_name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {activeReg && (() => {
                            const reg = activeReg;
                            const path = (reg.path_name || '').toLowerCase();
                            const isScholarship = path.includes('prestasi') || path.includes('beasiswa') || path.includes('yatim') || path.includes('tahfidz');
                            const isLulus = reg.status === 'lulus' || reg.status === 'paid' || reg.status === 'student' || (!isScholarship && reg.status === 'accepted');

                            return (
                                <div key={reg.id} className="relative mb-12 animate-fade-in">
                                    {isLulus && <div className="fixed inset-0 pointer-events-none z-50"><Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={500} gravity={0.15} /></div>}
                                    <div ref={letterRef}>
                                        <Card className="max-w-4xl mx-auto p-8 md:p-12 print:shadow-none print:border-0 relative overflow-hidden bg-white">
                                            <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[150px] font-black opacity-[0.03] rotate-[-30deg] pointer-events-none whitespace-nowrap ${isLulus ? 'text-emerald-900' : 'text-red-900'}`}>{isLulus ? 'LULUS' : 'TIDAK LULUS'}</div>

                                            <LetterHead />

                                            <div className="text-center mb-8">
                                                <h3 className="font-bold text-lg underline underline-offset-4 uppercase mb-2">Surat Keputusan Panitia PSB</h3>
                                                <p className="text-sm">Nomor: {reg.id.slice(0, 6).toUpperCase()}/PSB/2025</p>
                                            </div>

                                            <div className="text-justify leading-relaxed text-slate-800 mb-8 space-y-4">
                                                <p>Berdasarkan hasil Tes Seleksi Masuk (Psikotes dan Wawancara) yang telah dilaksanakan, dengan ini Panitia Penerimaan Siswa Baru memutuskan bahwa calon siswa:</p>
                                                <table className="w-full max-w-lg mx-auto my-6 text-sm font-medium border-collapse">
                                                    <tbody>
                                                        <tr><td className="py-2 pl-4 border-l-4 border-emerald-600 bg-slate-50 w-40">Nama Lengkap</td><td className="py-2 pr-4 bg-slate-50">: {reg.student_name}</td></tr>
                                                        <tr><td className="py-2 pl-4 border-l-4 border-emerald-600 bg-slate-50">Nomor Peserta</td><td className="py-2 pr-4 bg-slate-50">: {reg.id.slice(0, 8).toUpperCase()}</td></tr>
                                                        <tr><td className="py-2 pl-4 border-l-4 border-emerald-600 bg-slate-50">Unit Tujuan</td><td className="py-2 pr-4 bg-slate-50">: {reg.unit_name}</td></tr>
                                                        {reg.major && <tr><td className="py-2 pl-4 border-l-4 border-emerald-600 bg-slate-50">Jurusan</td><td className="py-2 pr-4 bg-slate-50">: {reg.major}</td></tr>}
                                                    </tbody>
                                                </table>

                                                {(reg.final_scores || reg.interview_result || reg.psychotest_result) && (
                                                    <div className="my-6">
                                                        <h4 className="text-center font-bold text-sm uppercase text-slate-700 mb-3 border-b pb-2">Rekap Nilai Seleksi</h4>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
                                                            <div className="bg-blue-50 p-3 rounded-xl text-center border border-blue-100">
                                                                <div className="text-xs text-blue-600 font-medium uppercase">Psikotes</div>
                                                                <div className="text-2xl font-black text-blue-800 mt-1">
                                                                    {reg.final_scores?.psychotest || reg.psychotest_result?.final_score || '-'}
                                                                </div>
                                                            </div>
                                                            <div className="bg-emerald-50 p-3 rounded-xl text-center border border-emerald-100">
                                                                <div className="text-xs text-emerald-600 font-medium uppercase">Wawancara Siswa</div>
                                                                <div className="text-2xl font-black text-emerald-800 mt-1">
                                                                    {reg.final_scores?.student_interview || reg.interview_result?.student_score || '-'}
                                                                </div>
                                                            </div>
                                                            <div className="bg-purple-50 p-3 rounded-xl text-center border border-purple-100">
                                                                <div className="text-xs text-purple-600 font-medium uppercase">Wawancara Wali</div>
                                                                <div className="text-2xl font-black text-purple-800 mt-1">
                                                                    {reg.final_scores?.parent_interview || reg.interview_result?.parent_score || '-'}
                                                                </div>
                                                            </div>
                                                            <div className="bg-amber-50 p-3 rounded-xl text-center border border-amber-100">
                                                                <div className="text-xs text-amber-600 font-medium uppercase">Rata-rata</div>
                                                                <div className="text-2xl font-black text-amber-800 mt-1">
                                                                    {reg.final_scores?.average_interview || reg.interview_result?.average_score || '-'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <p>Dinyatakan:</p>
                                                <div className={`p-4 border-2 rounded-xl text-center font-bold text-3xl uppercase tracking-widest my-8 transform scale-110 shadow-lg ${isLulus ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-red-500 bg-red-50 text-red-800'}`}>
                                                    {isLulus ? (
                                                        <span className="flex items-center justify-center gap-4"><Trophy size={40} /> LULUS SELEKSI</span>
                                                    ) : (
                                                        <span className="flex items-center justify-center gap-4"><XCircle size={40} /> TIDAK LULUS</span>
                                                    )}
                                                </div>

                                                {reg.decision_notes && (
                                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                                                        <h4 className="font-bold text-sm text-slate-700 mb-1">Catatan Panitia:</h4>
                                                        <p className="text-sm text-slate-600 italic">"{reg.decision_notes}"</p>
                                                    </div>
                                                )}

                                                {isLulus ? (
                                                    <>
                                                        {isScholarship ? (
                                                            <p>Selamat bergabung menjadi bagian dari keluarga besar kami. Ananda dinyatakan LULUS melalui jalur <strong>{reg.path_name}</strong>. Dengan ini, Bapak/Ibu <strong>TIDAK DIKENAKAN</strong> biaya Daftar Ulang (Gratis). Mohon segera melengkapi <strong>Surat Perjanjian</strong> dan berkas administrasi lainnya sebagai syarat finalisasi data santri.</p>
                                                        ) : (
                                                            <p>Selamat bergabung menjadi bagian dari keluarga besar kami. Selanjutnya, Bapak/Ibu Wali Murid dimohon untuk segera melakukan <strong>Daftar Ulang</strong> melalui menu Pembayaran sebelum batas waktu yang ditentukan.</p>
                                                        )}
                                                        {(reg.status === 'paid' || reg.status === 'student' || reg.status === 'lulus') && (
                                                            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-3">
                                                                <CheckCircle size={24} />
                                                                <div className="text-sm font-bold">Terima kasih. Anda telah menyelesaikan proses Daftar Ulang. Ananda resmi diterima sebagai santri baru.</div>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <p>Mohon maaf, ananda belum dapat kami terima pada periode ini dikarenakan kuota atau hasil seleksi yang belum memenuhi kriteria. Tetap semangat dan jangan putus asa.</p>
                                                )}
                                            </div>

                                            <div className="flex justify-end mt-16 pt-8">
                                                <div className="text-center w-64 relative">
                                                    <p className="text-sm">{settings?.school_address?.split(',')[1] || 'Tempat'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

                                                    {settings?.signature_image ? (
                                                        <div className="h-28 flex items-center justify-center my-2">
                                                            <img src={settings.signature_image} alt="Tanda Tangan" className="h-full object-contain" />
                                                        </div>
                                                    ) : (
                                                        <div className="h-28"></div>
                                                    )}

                                                    <p className="font-bold underline">{settings?.committee_head || 'H. Ahmad Dahlan, M.Pd'}</p>
                                                    <p className="text-xs">{settings?.committee_position || 'Ketua Panitia PSB'}</p>
                                                </div>
                                            </div>

                                            <div className="mt-8 pt-6 border-t flex flex-wrap justify-center gap-4 print:hidden" data-html2canvas-ignore>
                                                <Button onClick={() => window.print()} variant="secondary" className="flex items-center gap-2"><Printer size={16} /> Cetak Surat</Button>
                                                <Button onClick={handleDownloadPDF} variant="secondary" className="flex items-center gap-2"><Download size={16} /> Download PDF</Button>
                                                <Button onClick={handleShare} variant="secondary" className="flex items-center gap-2"><Share2 size={16} /> Bagikan</Button>
                                            </div>
                                        </Card>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    inProgressRegs.length === 0 && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <FileText size={32} />
                            </div>
                            <h4 className="font-bold text-slate-600 dark:text-slate-300">Belum Ada Surat Kelulusan</h4>
                            <p className="text-sm text-slate-400 mt-1">Surat kelulusan akan tersedia setelah proses seleksi selesai.</p>
                        </div>
                    )
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-24 md:pb-8">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                        <Megaphone size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Pengumuman</h2>
                        <p className="text-xs text-slate-500">Tahun Ajaran {defaultAY?.year || '2025/2026'}</p>
                    </div>
                </div>
            </div>

            {/* Main Tabs */}
            <Card className="p-0 overflow-hidden border border-slate-100 dark:border-slate-800 shadow-lg rounded-[2rem] bg-white dark:bg-slate-900">
                <div className="flex border-b border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => setMainTab('pribadi')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-xs font-black uppercase tracking-widest transition-all ${mainTab === 'pribadi'
                            ? 'text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 border-b-2 border-indigo-500'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <User size={16} /> Kelulusan Pribadi
                    </button>
                    <button
                        onClick={() => setMainTab('umum')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-xs font-black uppercase tracking-widest transition-all ${mainTab === 'umum'
                            ? 'text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 border-b-2 border-indigo-500'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <BarChart3 size={16} /> Kelulusan Umum
                    </button>
                    <button
                        onClick={() => setMainTab('surat')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-xs font-black uppercase tracking-widest transition-all ${mainTab === 'surat'
                            ? 'text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 border-b-2 border-indigo-500'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <FileText size={16} /> Surat Kelulusan
                    </button>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {mainTab === 'pribadi' && renderKelulusanPribadi()}
                    {mainTab === 'umum' && renderKelulusanUmum()}
                    {mainTab === 'surat' && renderSuratKelulusan()}
                </div>
            </Card>
        </div>
    );
}
