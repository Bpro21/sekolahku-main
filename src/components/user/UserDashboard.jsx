import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    User, FileText, CreditCard, BrainCircuit, Video, Megaphone, CheckCircle, Info,
    MapPin, Plus, Clock, Building, School, Users, XCircle, Upload, AlertTriangle, ArrowRight, Trophy, CalendarClock, Send
} from 'lucide-react';
import { Badge, Button, Card, Input, Select } from '../ui/Elements';
import { Modal } from '../ui/Overlays';
import { fileToBase64, createNotification } from '../../utils/helpers';
import InternalIndentWizard from './InternalIndentWizard';

const RegistrationStepper = ({ status, isScholarship }) => {
    const steps = [
        { label: 'Biodata', icon: FileText, desc: 'Isi Data' },
        { label: 'Bayar', icon: CreditCard, desc: 'Verifikasi' },
        { label: 'Ujian', icon: BrainCircuit, desc: 'Psikotes' },
        { label: 'Jadwal', icon: Video, desc: 'Wawancara' },
        { label: 'Hasil', icon: Megaphone, desc: 'Kelulusan' },
        { label: 'Resmi', icon: School, desc: 'Daftar Ulang' }
    ];

    let currentStep = 0;
    if (status === 'draft') currentStep = 0;
    else if (status === 'paid' || status === 'student' || (status === 'lulus' && isScholarship)) currentStep = 6; // 'lulus' for scholarship means officially registered
    else if (status === 'lulus' || status === 'rejected' || status === 'accepted') currentStep = 5;
    else if (status === 'awaiting_decision') currentStep = 4;
    else if (['psychotest_done', 'interview_scheduled', 'interview_accepted', 'interview_reschedule'].includes(status)) currentStep = 3;
    else if (status === 'verified' || status === 'paid_registration') currentStep = 2;
    else if (['submitted', 'verifying_payment', 'document_revision'].includes(status)) currentStep = 1;

    return (
        <div className="w-full">
            {/* Desktop Horizontal Stepper */}
            <div className="hidden md:block w-full">
                <div className="flex items-center justify-between relative px-2">
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-slate-100 dark:bg-slate-800 -z-10 rounded-full" />
                    <div
                        className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-emerald-500 -z-10 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(100, (currentStep / (steps.length - 1)) * 100)}%` }}
                    />
                    {steps.map((step, idx) => {
                        const isCompleted = idx < currentStep;
                        const isActive = idx === currentStep;
                        const Icon = step.icon;
                        return (
                            <div key={idx} className="flex flex-col items-center gap-3 relative group">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${isCompleted
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : (isActive
                                        ? 'bg-white dark:bg-slate-900 border-emerald-500 text-emerald-600 shadow-xl shadow-emerald-200 scale-125'
                                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-300')
                                    }`}>
                                    {isCompleted ? <CheckCircle size={20} /> : <Icon size={20} />}
                                </div>
                                <div className={`flex flex-col items-center transition-colors duration-300 ${isActive ? 'translate-y-1' : ''}`}>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {step.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mobile Vertical Stepper (Slim & Modern) */}
            <div className="md:hidden relative">
                <div className="absolute left-[20px] top-2 bottom-2 w-0.5 bg-slate-100 dark:bg-slate-800"></div>
                <div
                    className="absolute left-[20px] top-2 w-0.5 bg-emerald-500 transition-all duration-1000 ease-in-out"
                    style={{ height: `${Math.min(100, (currentStep / (steps.length - 1)) * 100)}%` }}
                ></div>
                <div className="space-y-4">
                    {steps.map((step, idx) => {
                        const isCompleted = idx < currentStep;
                        const isActive = idx === currentStep;
                        const Icon = step.icon;
                        return (
                            <div key={idx} className={`relative flex items-center gap-4 pl-1 transition-all duration-300 ${isActive ? 'scale-[1.02] origin-left' : ''}`}>
                                <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${isCompleted
                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200'
                                    : (isActive
                                        ? 'bg-white dark:bg-slate-900 border-emerald-500 text-emerald-600 shadow-xl shadow-emerald-100 ring-4 ring-emerald-50'
                                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-300 opacity-60')
                                    }`}>
                                    {isCompleted ? <CheckCircle size={18} /> : <Icon size={18} />}
                                </div>
                                <div className={`flex flex-col transition-all duration-300 ${isActive ? 'translate-x-1' : ''}`}>
                                    <span className={`text-[11px] font-black uppercase tracking-wider ${isActive ? 'text-emerald-700' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {step.label}
                                    </span>
                                    <span className={`text-[9px] font-medium transition-all ${isActive ? 'text-emerald-500' : 'text-slate-400 opacity-70'}`}>
                                        {step.desc}
                                    </span>
                                </div>
                                {isActive && (
                                    <div className="ml-auto">
                                        <div className="px-2 py-0.5 rounded-full bg-emerald-500 text-[8px] font-black text-white animate-pulse uppercase tracking-widest">Aktif</div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const RegistrationDetail = ({ reg, onNavigate, handleOpenRevision, handleOpenAccept, handleOpenReschedule, showToast }) => {
    return (
        <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative group hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500 rounded-[2rem]">
            <div className={`h-1.5 w-full ${reg.status === 'lulus' ? 'bg-emerald-500' : (reg.status === 'rejected' || reg.status === 'document_revision' ? 'bg-rose-500' : 'bg-emerald-600')}`} />
            <div className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 border border-slate-100 dark:border-slate-800 shadow-inner group-hover:scale-110 transition-transform">
                            <User size={32} />
                        </div>
                        <div>
                            <h4 className="font-black text-slate-800 dark:text-white text-xl tracking-tight">{reg.student_name}</h4>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                                <span className="text-emerald-600">{reg.unit_name}</span>
                                {reg.major && <span className="opacity-30">•</span>}
                                {reg.major && <span className="text-slate-400">{reg.major}</span>}
                            </div>
                        </div>
                    </div>
                    <Badge status={reg.status} />
                </div>

                <div className="mb-8">
                    <RegistrationStepper status={reg.status} isScholarship={reg.is_scholarship || (reg.path_name || '').toLowerCase().includes('prestasi') || (reg.path_name || '').toLowerCase().includes('yatim') || (reg.path_name || '').toLowerCase().includes('beasiswa') || (reg.path_name || '').toLowerCase().includes('tahfidz')} />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50/50 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
                    {reg.status === 'document_revision' && (
                        <div className="p-6">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0 animate-pulse">
                                    <AlertTriangle size={24} />
                                </div>
                                <div className="space-y-1">
                                    <h5 className="font-black text-slate-800 dark:text-white text-lg uppercase tracking-tight">Perbaikan Diperlukan</h5>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Beberapa dokumen perlu diupload ulang untuk verifikasi.</p>
                                </div>
                            </div>
                            <Button onClick={() => handleOpenRevision(reg)} className="w-full bg-rose-600 hover:bg-rose-700 py-4 rounded-2xl shadow-lg shadow-rose-200 uppercase font-black tracking-widest text-xs">
                                Perbaiki Sekarang
                            </Button>
                        </div>
                    )}

                    {/* Payment / Verification Status Block */}
                    {(reg.status === 'submitted' || reg.status === 'verifying_payment' || (
                        reg.status === 'verified' &&
                        !reg.is_internal &&
                        !reg.is_scholarship &&
                        !(reg.path_name || '').toLowerCase().includes('internal') &&
                        !(reg.path_name || '').toLowerCase().includes('prestasi') &&
                        !(reg.path_name || '').toLowerCase().includes('yatim')
                    )) && (
                            <div className="p-6 flex flex-col items-center text-center">
                                {reg.status === 'verifying_payment' ? (
                                    <>
                                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                                            <Clock size={32} className="animate-spin-slow" />
                                        </div>
                                        <h5 className="font-black text-slate-800 dark:text-white text-lg uppercase tracking-tight">Memverifikasi Pembayaran</h5>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Mohon tunggu sebentar, bukti pembayaran sedang diperiksa admin.</p>
                                    </>
                                ) : (
                                    reg.status === 'verified' || reg.status === 'submitted'
                                ) &&
                                    !reg.is_internal &&
                                    !reg.is_scholarship &&
                                    !(reg.path_name || '').toLowerCase().includes('internal') &&
                                    !(reg.path_name || '').toLowerCase().includes('prestasi') &&
                                    !(reg.path_name || '').toLowerCase().includes('yatim') ? (
                                    <>
                                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                                            <CreditCard size={32} />
                                        </div>
                                        <h5 className="font-black text-slate-800 dark:text-white text-lg uppercase tracking-tight">
                                            {reg.status === 'verified' ? 'Dokumen Terverifikasi' : 'Selesaikan Pembayaran'}
                                        </h5>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 mb-6">
                                            {reg.status === 'verified' ? 'Dokumen Anda valid. Silakan lakukan pembayaran pendaftaran.' : 'Klik tombol di bawah untuk melihat rincian tagihan pendaftaran.'}
                                        </p>
                                        <Button onClick={() => onNavigate('payments')} className="w-full bg-emerald-600 hover:bg-emerald-700 py-4 rounded-2xl shadow-lg shadow-emerald-200 uppercase font-black tracking-widest text-xs">
                                            Bayar Tagihan
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                                            <FileText size={32} />
                                        </div>
                                        <h5 className="font-black text-slate-800 dark:text-white text-lg uppercase tracking-tight">Menunggu Verifikasi Berkas</h5>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Data Anda sedang diperiksa oleh admin. Mohon tunggu proses verifikasi.</p>
                                    </>
                                )}
                            </div>
                        )}

                    {/* Psychotest / Exam Block - Show if Paid (Regular) OR Verified (Internal/Scholarship/Prestasi/Yatim) */}
                    {(
                        reg.status === 'paid_registration' ||
                        (reg.status === 'verified' && (
                            reg.is_internal ||
                            reg.is_scholarship ||
                            (reg.path_name || '').toLowerCase().includes('internal') ||
                            (reg.path_name || '').toLowerCase().includes('prestasi') ||
                            (reg.path_name || '').toLowerCase().includes('yatim')
                        ))
                    ) && (
                            <div className="p-6 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                                    <BrainCircuit size={32} />
                                </div>
                                <h5 className="font-black text-slate-800 dark:text-white text-lg uppercase tracking-tight">Siap Untuk Ujian?</h5>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 mb-6">Verifikasi & Administrasi selesai. Silakan ikuti tes seleksi online.</p>
                                <Button onClick={() => onNavigate('psychotest')} variant="ai" className="w-full py-4 rounded-2xl shadow-lg shadow-indigo-100 uppercase font-black tracking-widest text-xs">
                                    Mulai Ujian
                                </Button>
                            </div>
                        )}

                    {reg.interview_schedule && reg.status !== 'lulus' && reg.status !== 'paid' && (
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-6 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><Video size={20} /></div>
                                <div>
                                    <h5 className="font-black text-slate-800 dark:text-white text-sm uppercase">Jadwal Wawancara</h5>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Siswa & Orang Tua</p>
                                </div>
                            </div>

                            {/* Tanggal Wawancara */}
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl border border-blue-100 dark:border-blue-800 mb-4">
                                <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Tanggal</div>
                                <div className="text-base font-black text-blue-800 dark:text-blue-200">
                                    {reg.interview_schedule.date
                                        ? new Date(reg.interview_schedule.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                                        : '-'}
                                </div>
                            </div>

                            {/* Jam Siswa & Wali */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                                    <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Jam Siswa</div>
                                    <div className="text-lg font-black text-emerald-700 dark:text-emerald-200">{reg.interview_schedule.student_time || '-'} WIB</div>
                                </div>
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-2xl border border-purple-100 dark:border-purple-800">
                                    <div className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-1">Jam Wali</div>
                                    <div className="text-lg font-black text-purple-700 dark:text-purple-200">{reg.interview_schedule.parent_time || '-'} WIB</div>
                                </div>
                            </div>

                            {/* Konfirmasi Kehadiran */}
                            {reg.interview_confirmation && (
                                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl border border-emerald-200 mb-4 text-center">
                                    <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">✓ Dikonfirmasi pada</div>
                                    <div className="text-xs font-bold text-emerald-800">{reg.interview_confirmation.confirmed_date} - {reg.interview_confirmation.confirmed_time}</div>
                                </div>
                            )}

                            {reg.status === 'interview_scheduled' && (
                                <div className="flex flex-col gap-3">
                                    <Button onClick={() => handleOpenAccept(reg)} className="bg-emerald-600 hover:bg-emerald-700 py-3 rounded-xl uppercase font-black tracking-widest text-[10px]">Konfirmasi Hadir</Button>
                                    <Button variant="outline" onClick={() => handleOpenReschedule(reg)} className="py-3 rounded-xl uppercase font-black tracking-widest text-[10px]">Reschedule</Button>
                                </div>
                            )}
                            {reg.status === 'interview_accepted' && reg.interview_schedule.zoom_link && (
                                <a href={reg.interview_schedule.zoom_link} target="_blank" className="block w-full text-center bg-blue-600 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px] shadow-lg shadow-blue-100">Masuk Zoom Meeting</a>
                            )}
                        </div>
                    )}

                    {(reg.status === 'lulus' || reg.status === 'paid' || reg.status === 'student' || reg.status === 'accepted') && (
                        (() => {
                            const pName = (reg.path_name || '').toLowerCase();
                            const isExempt = reg.is_scholarship || pName.includes('prestasi') || pName.includes('yatim') || pName.includes('tahfidz') || pName.includes('beasiswa');
                            const isWaitingAgreement = reg.status === 'accepted' && isExempt; // Now 'accepted' is the waiting state
                            const isOfficial = reg.status === 'paid' || reg.status === 'student' || (reg.status === 'lulus' && isExempt);

                            return (
                                <div className="p-6 text-center">
                                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                                        <Trophy size={40} />
                                    </div>
                                    <h5 className="font-black text-emerald-900 text-xl tracking-tight uppercase">
                                        {isOfficial ? 'ANDA RESMI TERDAFTAR!' : (isWaitingAgreement ? 'MENUNGGU VERIFIKASI AKHIR' : (reg.is_internal ? 'KUOTA SUDAH DIDAPATKAN!' : 'Seleksi Berhasil!'))}
                                    </h5>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm mt-2 mb-6">
                                        {isOfficial
                                            ? (reg.is_scholarship || isExempt
                                                ? 'Selamat! Anda resmi terdaftar sebagai siswa baru melalui jalur Beasiswa. Terima kasih atas kepercayaan Anda.'
                                                : 'Terima kasih, administrasi daftar ulang Anda telah lunas. Anda resmi terdaftar sebagai siswa baru.')
                                            : (reg.is_internal
                                                ? (reg.is_scholarship
                                                    ? (isWaitingAgreement ? 'Selamat, Anda lulus seleksi! Mohon lengkapi Surat Perjanjian & MCU untuk peresmian status santri.' : 'Selamat! Anda diterima melalui jalur Beasiswa Inden Internal. Anda Bebas Biaya Daftar Ulang.')
                                                    : 'Terima kasih Selamat Bergabung Kembali ! Silakan selesaikan administrasi daftar ulang.')
                                                : 'Selamat Bergabung! Silakan selesaikan administrasi daftar ulang.')
                                        }
                                    </p>
                                    <div className="flex flex-col gap-3">
                                        <Button onClick={() => onNavigate('announcements')} className="bg-emerald-600 hover:bg-emerald-700 py-3 rounded-xl uppercase font-black tracking-widest text-[10px]">
                                            {isOfficial ? 'LIHAT SURAT KELULUSAN' : (isWaitingAgreement ? 'CEK STATUS' : (reg.is_internal ? 'LOLOS INTERNAL' : 'Lihat Hasil'))}
                                        </Button>
                                        {!isOfficial && (
                                            (() => {
                                                const docs = reg.uploaded_docs || {};
                                                const isComplete = docs.agreement_rokok && docs.agreement_lgbt && docs.agreement_kriminal && docs.mcu_letter;
                                                const pNameInner = (reg.path_name || '').toLowerCase();
                                                const isExemptInner = reg.is_scholarship || pNameInner.includes('prestasi') || pNameInner.includes('yatim');

                                                if (isExemptInner && isComplete) {
                                                    return (
                                                        <div className="p-3 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-widest border border-emerald-100 rounded-xl">
                                                            Berkas Lengkap. Menunggu Finalisasi Admin.
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => {
                                                            if (!isComplete) {
                                                                showToast('Mohon lengkapi Surat Perjanjian & MCU di menu Data Anak terlebih dahulu.', 'error');
                                                                onNavigate('students');
                                                            } else {
                                                                if (!isExemptInner) onNavigate('payments');
                                                            }
                                                        }}
                                                        className={`py-3 rounded-xl uppercase font-black tracking-widest text-[10px] ${!isComplete ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300' : ''}`}
                                                    >
                                                        {isComplete ? 'Bayar Daftar Ulang' : 'Lengkapi Berkas Daftar Ulang'}
                                                    </Button>
                                                );
                                            })()
                                        )}
                                    </div>
                                </div>
                            );
                        })()
                    )}
                </div>
            </div>
        </Card>
    );
};

const QuotaGrid = ({ academicYears, branches, allRegistrations, indentSettings }) => {
    const [activeTab, setActiveTab] = useState(0);

    const defaultAY = academicYears.find(ay => ay.is_default);

    // External Indent (from Academic Years config)
    const indentAY = academicYears.find(ay => ay.indent_enabled && !ay.is_default);
    const hasIndent = !!indentAY;

    // Internal Indent (from Indent Settings)
    const internalTargetYear = indentSettings?.active ? indentSettings?.target_academic_years?.[0] : null;
    const internalAY = internalTargetYear ? academicYears.find(ay => ay.year === internalTargetYear) : null;
    const hasInternal = !!internalAY;

    let currentAY;
    if (activeTab === 2 && internalAY) currentAY = internalAY;
    else if (activeTab === 1 && indentAY) currentAY = indentAY;
    else currentAY = defaultAY;

    if (!currentAY) return null;

    const levelOrder = { 'TK': 1, 'SD': 2, 'SMP': 3, 'SMA': 4, 'SMK': 5 };
    const sortedBranches = [...branches].sort((a, b) => (levelOrder[a.level] || 99) - (levelOrder[b.level] || 99));

    const showTabs = hasIndent || hasInternal;

    return (
        <div className="space-y-6">
            {showTabs && (
                <div className="flex justify-center md:justify-start">
                    <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl flex border border-slate-200 dark:border-slate-800 shadow-inner">
                        <button onClick={() => setActiveTab(0)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 0 ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-md' : 'text-slate-400'}`}>
                            Reguler {defaultAY?.year}
                        </button>
                        {hasIndent && (
                            <button onClick={() => setActiveTab(1)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 1 ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-md' : 'text-slate-400'}`}>
                                Inden {indentAY?.year}
                            </button>
                        )}
                        {hasInternal && (
                            <button onClick={() => setActiveTab(2)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 2 ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-md' : 'text-slate-400'}`}>
                                Inden Internal {internalAY?.year}
                            </button>
                        )}
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedBranches.map(u => {
                    const config = u.academic_configs?.[currentAY.id];

                    // Priority: Academic Config (Year Specific) -> Default Component Values
                    let displayMajors = config?.majors || u.majors || [];

                    // Filter Real-time Registrations for this Unit & Year
                    const unitRegs = allRegistrations.filter(r =>
                        r.unit_id === u.id &&
                        (r.academic_year_id === currentAY.id || r.academic_year === currentAY.year) &&
                        r.status !== 'rejected' &&
                        r.status !== 'cancelled'
                    );

                    let totalQuota = 0;
                    let totalFilled = 0;

                    if (displayMajors.length > 0) {
                        // Recalculate filled per Major dynamically
                        displayMajors = displayMajors.map(m => {
                            const realFilled = unitRegs.filter(r => (r.major === m.name) || (r.major_name === m.name) || (r.major_id && r.major_id === m.id)).length;
                            return { ...m, filled: realFilled };
                        });
                        totalQuota = displayMajors.reduce((acc, m) => acc + (parseInt(m.quota) || 0), 0);
                        totalFilled = displayMajors.reduce((acc, m) => acc + (parseInt(m.filled) || 0), 0);
                    } else {
                        totalQuota = config?.quota !== undefined ? parseInt(config.quota) : (parseInt(u.quota) || 0);
                        totalFilled = unitRegs.length;
                    }

                    const remaining = Math.max(0, totalQuota - totalFilled);
                    const progress = totalQuota > 0 ? (totalFilled / totalQuota) * 100 : 0;

                    return (
                        <Card key={u.id} className="p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all rounded-[2rem] overflow-hidden group">
                            <div className="flex justify-between items-start mb-6">
                                <div className="space-y-1">
                                    <h4 className="font-black text-slate-800 dark:text-white text-lg uppercase tracking-tight">{u.name}</h4>
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1"><MapPin size={12} /> {u.location || 'Kampus Utama'}</span>
                                </div>
                                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-emerald-500 transition-colors"><School size={24} /></div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <div className="space-y-0.5">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa Kuota</div>
                                        <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">{remaining}<span className="text-sm text-slate-300 font-bold">/{totalQuota}</span></div>
                                    </div>
                                    <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${remaining <= 3 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>{remaining <= 0 ? 'Penuh' : 'Tersedia'}</div>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                                </div>
                                <div className="pt-4 flex flex-wrap gap-2">
                                    {displayMajors.map((m, i) => {
                                        const mQuota = parseInt(m.quota) || 0;
                                        const mFilled = parseInt(m.filled) || 0;
                                        const mRemaining = Math.max(0, mQuota - mFilled);
                                        return (
                                            <div key={i} className="px-3 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                                {m.name} <span className="w-1 h-1 rounded-full bg-emerald-400"></span> {mRemaining}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default function UserDashboard({ user, onNavigate, showToast }) {
    const [registrations, setRegistrations] = useState([]);
    const [branches, setBranches] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [allRegistrations, setAllRegistrations] = useState([]);
    const [settings, setSettings] = useState({});
    const [actionModal, setActionModal] = useState(null);
    const [rescheduleReason, setRescheduleReason] = useState('');
    const [revisionModal, setRevisionModal] = useState(null);
    const [revisionFiles, setRevisionFiles] = useState({});
    const [revisionLoading, setRevisionLoading] = useState(false);

    // Internal Indent State
    const [showInternalWizard, setShowInternalWizard] = useState(false);
    const [indentSettings, setIndentSettings] = useState(null);
    const [timeLeft, setTimeLeft] = useState('');

    // Indent Verification State
    const [indentSubmission, setIndentSubmission] = useState(null);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [recommendationFile, setRecommendationFile] = useState(null);
    const [uploadingRec, setUploadingRec] = useState(false);
    const [recStudentName, setRecStudentName] = useState('');
    const [recUnitId, setRecUnitId] = useState('');

    useEffect(() => {
        if (!indentSettings?.active || !indentSettings?.end_date) {
            setTimeLeft('');
            return;
        }

        const updateTimer = () => {
            const end = new Date(indentSettings.end_date + 'T23:59:59');
            const now = new Date();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft('Pendaftaran Ditutup');
            } else {
                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${d} Hari ${h} Jam ${m} Menit ${s} Detik`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [indentSettings]);

    // Data Fetching & Realtime
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            // 1. Settings
            const { data: settingsData } = await supabase.from('app_settings').select('*').eq('id', 'main').single();
            if (settingsData) setSettings(settingsData);

            // 2. Indent Settings
            const { data: indentSet } = await supabase.from('indent_settings').select('*').eq('id', 'main').single();
            if (indentSet) setIndentSettings(indentSet);

            // 3. Academic Years
            const { data: ayData } = await supabase.from('academic_years').select('*');
            if (ayData) setAcademicYears(ayData);

            // 4. Units
            const { data: unitsData } = await supabase.from('units').select('*');
            if (unitsData) setBranches(unitsData);

            // 5. User Registrations
            const { data: userRegs } = await supabase.from('registrations').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            if (userRegs) setRegistrations(userRegs);

            // 6. Indent Submission
            const { data: indentSub } = await supabase.from('indent_submissions').select('*').eq('user_id', user.id).single();
            setIndentSubmission(indentSub || null);

            // 7. All Registrations (for Quota) - Using a light query
            const { data: allRegs } = await supabase.from('registrations').select('id, unit_id, major, major_name, status, academic_year, academic_year_id');
            if (allRegs) setAllRegistrations(allRegs);
        };

        fetchData();

        // Realtime Subscription for Updates
        const channel = supabase.channel('dashboard_updates')
            // Registrations
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `user_id=eq.${user.id}` }, (payload) => {
                // Simplest strategy: Refetch list on any change
                fetchData();
            })
            // Indent Submissions
            .on('postgres_changes', { event: '*', schema: 'public', table: 'indent_submissions', filter: `user_id=eq.${user.id}` }, () => {
                fetchData();
            })
            // Units (Quota updates)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user.id]);

    const handleOpenAccept = (reg) => setActionModal({ type: 'accept', reg });
    const handleOpenReschedule = (reg) => { setRescheduleReason(''); setActionModal({ type: 'reschedule', reg }); };
    const handleOpenRevision = (reg) => { setRevisionFiles({}); setRevisionModal(reg); };

    const submitAction = async () => {
        if (!actionModal) return;
        const { type, reg } = actionModal;
        try {
            if (type === 'accept') {
                const now = new Date();
                const updates = {
                    status: 'interview_accepted',
                    interview_confirmation: {
                        confirmed_at: now.toISOString(),
                        confirmed_date: now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
                        confirmed_time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                        student_scheduled: reg.interview_schedule?.student_time || '-',
                        parent_scheduled: reg.interview_schedule?.parent_time || '-'
                    }
                };

                const { error } = await supabase.from('registrations').update(updates).eq('id', reg.id);
                if (error) throw error;

                showToast('Jadwal dikonfirmasi. Anda akan hadir sesuai jadwal.');
            } else if (type === 'reschedule') {
                if (!rescheduleReason.trim()) return showToast('Alasan harus diisi.', 'error');
                const updates = { status: 'interview_reschedule', reschedule_reason: rescheduleReason };

                const { error } = await supabase.from('registrations').update(updates).eq('id', reg.id);
                if (error) throw error;

                showToast('Pengajuan dikirim.');
            }
        } catch (error) { console.error(error); showToast('Gagal: ' + error.message, 'error'); } finally { setActionModal(null); }
    };

    const handleRevisionFile = async (docType, file) => {
        if (!file) return;
        try {
            const base64 = await fileToBase64(file);
            setRevisionFiles(prev => ({ ...prev, [docType]: base64 }));
        } catch (e) { showToast('Gagal proses file', 'error'); }
    };

    const submitRevision = async () => {
        if (!revisionModal) return;
        setRevisionLoading(true);
        try {
            const currentReg = revisionModal;
            const updates = {
                status: 'submitted',
                rejection_reason: null,
                uploaded_docs: { ...currentReg.uploaded_docs, ...revisionFiles },
                doc_verification: {
                    ...currentReg.doc_verification
                }
            };

            // Reset verification status for updated files
            Object.keys(revisionFiles).forEach(key => {
                if (updates.doc_verification[key]) {
                    updates.doc_verification[key] = { ...updates.doc_verification[key], status: 'pending', note: '' };
                }
            });

            const { error } = await supabase.from('registrations').update(updates).eq('id', revisionModal.id);
            if (error) throw error;

            showToast('Revisi terkirim.');
            setRevisionModal(null);
        } catch (e) { console.error(e); showToast('Gagal kirim: ' + e.message, 'error'); } finally { setRevisionLoading(false); }
    };

    const handleStartIndent = () => {
        if (!indentSubmission) {
            setUploadModalOpen(true);
        } else if (indentSubmission.status === 'pending') {
            showToast('Surat rekomendasi sedang diverifikasi Admin.', 'info');
        } else if (indentSubmission.status === 'approved') {
            setShowInternalWizard(true);
        } else if (indentSubmission.status === 'rejected') {
            setUploadModalOpen(true);
        }
    };

    const handleSubmitRecommendation = async () => {
        if (!recommendationFile || !recStudentName.trim() || !recUnitId) return showToast('Mohon lengkapi Nama, Cabang, dan File Rekomendasi.', 'error');
        setUploadingRec(true);
        try {
            const base64 = await fileToBase64(recommendationFile);
            const targetUnit = branches.find(b => b.id === recUnitId);

            // Upsert indent submission
            const { error } = await supabase.from('indent_submissions').upsert({
                user_id: user.id,
                parent_name: user.user_metadata?.name || user.email, // Supabase user metadata
                user_email: user.email,
                student_name_candidate: recStudentName,
                target_unit_id: recUnitId,
                target_unit_name: targetUnit?.name || 'Unknown',
                recommendation_doc: base64,
                status: 'pending',
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

            if (error) throw error;

            showToast('Surat rekomendasi terkirim. Mohon tunggu verifikasi.');
            setUploadModalOpen(false);
            setRecommendationFile(null);
            setRecStudentName('');
            setRecUnitId('');
        } catch (e) {
            console.error(e);
            showToast('Gagal upload dokumen: ' + e.message, 'error');
        } finally {
            setUploadingRec(false);
        }
    };



    if (showInternalWizard) {
        return (
            <div className="animate-fade-in pb-24 md:pb-8 px-1 md:px-0">
                <div className="mb-6">
                    <Button variant="secondary" onClick={() => setShowInternalWizard(false)} className="px-6 rounded-2xl flex items-center gap-2 font-black uppercase tracking-widest text-[10px]">
                        <ArrowRight size={16} className="rotate-180" /> Kembali ke Dashboard
                    </Button>
                </div>
                <InternalIndentWizard
                    user={user}
                    onComplete={() => setShowInternalWizard(false)}
                    showToast={showToast}
                    indentSettings={indentSettings}
                />
            </div>
        );
    }

    const today = new Date().toISOString().split('T')[0];
    const isIndentActive = indentSettings?.active && (
        !indentSettings.start_date || !indentSettings.end_date ||
        (today >= indentSettings.start_date && today <= indentSettings.end_date)
    );

    return (
        <div className="space-y-6 pb-24 md:pb-8 animate-fade-in px-1 md:px-0">
            {/* Announcement Banner */}
            {settings.announcement?.active && settings.announcement?.text && (
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-[1.5rem] p-5 md:p-6 shadow-xl shadow-orange-500/20 relative overflow-hidden flex gap-5 items-start border border-orange-400/30">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -mr-24 -mt-24 opacity-10 blur-3xl"></div>

                    <div className="bg-white/20 p-3.5 rounded-2xl backdrop-blur-md shrink-0 border border-white/20 shadow-inner">
                        <Megaphone size={28} className="text-white animate-[wiggle_1s_ease-in-out_infinite]" />
                    </div>

                    <div className="relative z-10 pt-1">
                        <h4 className="font-black text-lg md:text-xl mb-1 flex items-center gap-2">
                            PENGUMUMAN PENTING
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                        </h4>
                        <p className="text-orange-50 text-sm md:text-base font-medium leading-relaxed max-w-3xl">
                            {settings.announcement.text}
                        </p>
                    </div>
                </div>
            )}

            {/* Internal Indent Promo Card */}
            {isIndentActive && (
                <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-800 rounded-[2.5rem] p-8 md:p-10 shadow-2xl shadow-emerald-900/20 text-white relative overflow-hidden border border-white/10 group cursor-pointer transition-all hover:shadow-emerald-900/40" onClick={handleStartIndent}>
                    {/* Background Blob */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400 rounded-full -mr-32 -mt-32 blur-[100px] opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-400 rounded-full -ml-20 -mb-20 blur-[80px] opacity-10"></div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex flex-col gap-4 text-center md:text-left flex-1">
                            {/* Priority Badge */}
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-950/30 rounded-full w-fit mx-auto md:mx-0 backdrop-blur-md border border-white/10 shadow-inner">
                                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_10px_rgba(250,204,21,0.6)]"></span>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100">Jalur Prioritas Internal</span>
                            </div>

                            <div>
                                <h3 className="text-3xl md:text-5xl font-black tracking-tighter leading-[0.9] text-white drop-shadow-sm mb-2">
                                    Pendaftaran <br className="hidden md:block" />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-teal-100">Inden Internal</span> Dibuka!
                                </h3>

                                {indentSettings?.target_academic_years?.length > 0 && (
                                    <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-3 animate-slide-down">
                                        <span className="text-emerald-200/70 text-sm font-bold flex items-center">Tahun Ajaran: </span>
                                        {indentSettings.target_academic_years.map(y => (
                                            <span key={y} className="px-3 py-0.5 bg-white/10 rounded-full text-white font-bold text-sm border border-white/20 backdrop-blur-sm shadow-sm">{y}</span>
                                        ))}
                                    </div>
                                )}

                                <p className="text-emerald-100/80 text-sm md:text-lg font-medium max-w-xl leading-relaxed">
                                    Khusus siswa internal. Daftar ulang lebih awal, tanpa tes, kuota terjamin.
                                </p>
                            </div>

                            {/* Timer */}
                            {timeLeft && (
                                <div className="inline-flex items-center gap-2 bg-emerald-950/40 backdrop-blur-md px-4 py-2.5 rounded-xl border border-emerald-500/30 text-yellow-300 text-xs md:text-sm font-mono font-bold w-fit mx-auto md:mx-0 shadow-lg mt-2">
                                    <Clock size={16} className="text-yellow-400" />
                                    <span>Sisa Waktu: {timeLeft}</span>
                                </div>
                            )}
                        </div>

                        {/* CTA Button */}
                        <div className="shrink-0 relative group/btn">
                            <div className="absolute inset-0 bg-white/30 blur-xl rounded-full opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"></div>
                            <div className="bg-white text-emerald-900 px-8 py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl group-hover:scale-105 transition-transform flex items-center gap-3 relative z-10 border-4 border-emerald-50/10">
                                {(!indentSubmission || indentSubmission.status === 'rejected') ? (
                                    <>Daftar Sekarang <ArrowRight size={16} /></>
                                ) : indentSubmission.status === 'pending' ? (
                                    <>Menunggu Verifikasi <Clock size={16} /></>
                                ) : (
                                    <>Lanjut Isi Formulir <ArrowRight size={16} /></>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hero Section */}
            <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-800 text-white p-6 md:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-white/10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white dark:bg-slate-900/5 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse"></div>
                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-300">PSB Portal Sekolah</span>
                        <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[8px] font-black text-emerald-300 leading-none">V2.0</div>
                    </div>
                    <h2 className="text-3xl md:text-6xl font-black mb-4 tracking-tighter leading-tight text-white">Assalamu'alaikum, {user.displayName?.split(' ')[0] || 'User'}!</h2>
                    <p className="text-emerald-100/70 text-sm md:text-lg max-w-lg mb-8 font-medium">Pantau status pendaftaran dan lengkapi administrasi calon siswa baru secara praktis.</p>

                    <div className="w-full max-w-2xl grid grid-cols-5 gap-2 md:gap-4">
                        {[
                            { icon: <Plus size={20} />, label: "Daftar" },
                            { icon: <CreditCard size={20} />, label: "Bayar" },
                            { icon: <BrainCircuit size={20} />, label: "Tes" },
                            { icon: <CheckCircle size={20} />, label: "Lulus" },
                            { icon: <School size={20} />, label: "Resmi" },
                        ].map((s, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-1 group">
                                <div className="w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white group-hover:bg-white group-hover:text-emerald-800 transition-all duration-300 shadow-lg">
                                    <div className="scale-75 md:scale-100">{s.icon}</div>
                                </div>
                                <span className="text-[8px] md:text-xs font-black uppercase tracking-widest text-white/60">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quota Grid */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Building size={20} /></div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Ketersediaan Kuota</h3>
                </div>
                <QuotaGrid academicYears={academicYears} branches={branches} allRegistrations={allRegistrations} indentSettings={indentSettings} />
            </div>

            {/* Registration List */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Users size={20} /></div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Status Pendaftaran Siswa</h3>
                </div>
                {registrations.length === 0 ? (
                    <Card className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-[2.5rem]">
                        <Plus size={48} className="mx-auto text-slate-200 mb-4" />
                        <h4 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Belum Ada Data</h4>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">Daftarkan anak Anda sekarang dengan menekan tombol plus navigasi di bawah.</p>
                    </Card>
                ) : (
                    <div className="space-y-8">
                        {registrations.map(reg => (
                            <RegistrationDetail
                                key={reg.id}
                                reg={reg}
                                onNavigate={onNavigate}
                                handleOpenRevision={handleOpenRevision}
                                handleOpenAccept={handleOpenAccept}
                                handleOpenReschedule={handleOpenReschedule}
                                showToast={showToast}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            <Modal isOpen={!!actionModal} onClose={() => setActionModal(null)} title={actionModal?.type === 'accept' ? 'Konfirmasi Kehadiran' : 'Jadwal Ulang'}>
                <div className="p-6">
                    {actionModal?.type === 'accept' ? (
                        <div className="text-center space-y-4">
                            <CheckCircle size={64} className="mx-auto text-emerald-500" />
                            <p className="font-bold text-slate-800 dark:text-white">Apakah Anda mengonfirmasi kehadiran untuk sesi wawancara ini?</p>
                            <div className="flex gap-3 pt-4">
                                <Button variant="secondary" className="flex-1 rounded-xl" onClick={() => setActionModal(null)}>Batal</Button>
                                <Button className="flex-1 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-200" onClick={submitAction}>Ya, Hadir</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">Alasan Pengajuan:</p>
                            <textarea value={rescheduleReason} onChange={(e) => setRescheduleReason(e.target.value)} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" rows={4} placeholder="Jelaskan alasan Anda..."></textarea>
                            <div className="flex gap-3">
                                <Button variant="secondary" className="flex-1 rounded-xl" onClick={() => setActionModal(null)}>Batal</Button>
                                <Button className="flex-1 bg-emerald-600 rounded-xl" onClick={submitAction}>Kirim</Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            <Modal isOpen={!!revisionModal} onClose={() => setRevisionModal(null)} title="Upload Revisi Dokumen">
                <div className="p-6 space-y-4">
                    {revisionModal && Object.entries(revisionModal.uploaded_docs || {}).map(([key, val]) => {
                        const isInvalid = revisionModal.doc_verification?.[key]?.status === 'invalid';
                        if (!isInvalid) return null;
                        return (
                            <div key={key} className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2">
                                <div className="text-[10px] font-black text-rose-800 uppercase tracking-widest">{key.replace('_', ' ')}</div>
                                <p className="text-[11px] text-rose-600 font-bold italic">Catatan: {revisionModal.doc_verification[key].note}</p>
                                <input type="file" onChange={(e) => handleRevisionFile(key, e.target.files[0])} className="text-xs w-full mt-2" accept="image/*,.pdf" />
                            </div>
                        );
                    })}
                    <div className="flex gap-3 pt-4">
                        <Button variant="secondary" className="flex-1 rounded-xl" onClick={() => setRevisionModal(null)}>Tutup</Button>
                        <Button className="flex-1 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-200" onClick={submitRevision} disabled={revisionLoading || Object.keys(revisionFiles).length === 0}>{revisionLoading ? 'Mengirim...' : 'Kirim Revisi'}</Button>
                    </div>
                </div>
            </Modal>
            {/* Premium Upload Recommendation Modal */}
            <Modal isOpen={uploadModalOpen} onClose={() => setUploadModalOpen(false)} title="Upload Surat Rekomendasi">
                <div className="p-6">
                    <div className="mb-6 p-4 bg-blue-50/50 dark:bg-slate-800/50 border border-blue-100 dark:border-slate-700 rounded-2xl flex items-start gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl shrink-0"><Info size={20} /></div>
                        <div className="space-y-1">
                            <h5 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-tight">Instruksi Upload</h5>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                Pastikan surat rekomendasi asli dari Kepala Sekolah/Yayasan bertanda tangan dan stempel basah. Format: PDF/JPG (Max 5MB).
                            </p>
                            {indentSubmission?.status === 'rejected' && (
                                <div className="mt-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[10px] font-bold">
                                    <span className="block uppercase tracking-widest mb-1">Ditolak Karena:</span>
                                    {indentSubmission.rejection_reason || 'Dokumen tidak valid.'}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 mb-6 animate-fade-in">
                        <Input
                            label="Nama Lengkap Calon Siswa"
                            value={recStudentName}
                            onChange={(e) => setRecStudentName(e.target.value)}
                            placeholder="Contoh: Ahmad Abdullah"
                        />
                        <Select
                            label="Pilih Cabang Tujuan"
                            value={recUnitId}
                            onChange={(e) => setRecUnitId(e.target.value)}
                            options={branches.map(b => ({ value: b.id, label: b.name }))}
                            placeholder="-- Pilih Cabang --"
                        />
                    </div>

                    <div className="relative group cursor-pointer mb-8">
                        <input
                            type="file"
                            id="rec-upload"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={(e) => setRecommendationFile(e.target.files[0])}
                        />
                        <label htmlFor="rec-upload" className={`flex flex-col items-center justify-center p-8 md:p-12 border-2 border-dashed rounded-[2rem] transition-all duration-300 w-full cursor-pointer relative overflow-hidden ${recommendationFile ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                            {recommendationFile ? (
                                <div className="animate-scale-in flex flex-col items-center z-10">
                                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mb-4 shadow-xl shadow-emerald-200/50">
                                        <FileText size={40} />
                                    </div>
                                    <p className="text-base font-black text-slate-800 dark:text-white break-all max-w-[90%] text-center px-4">{recommendationFile.name}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge status="completed" label="Siap Upload" />
                                        <span className="text-[10px] font-bold text-slate-400">{(recommendationFile.size / 1024 / 1024).toFixed(2)} MB</span>
                                    </div>
                                    <button
                                        onClick={(e) => { e.preventDefault(); setRecommendationFile(null); }}
                                        className="mt-6 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors"
                                    >
                                        Ganti File
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center z-10 py-4">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 group-hover:scale-110 transition-all duration-500 rounded-[2rem] flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700 group-hover:border-emerald-200 group-hover:shadow-xl group-hover:shadow-emerald-100/50">
                                        <Upload size={36} />
                                    </div>
                                    <h4 className="text-lg font-black text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">Pilih File Dokumen</h4>
                                    <p className="text-xs text-slate-400 font-medium mt-2 max-w-xs text-center leading-relaxed">Klik area ini untuk memilih file dari perangkat Anda.</p>
                                </div>
                            )}
                        </label>
                    </div>

                    <div className="flex gap-4">
                        <Button variant="secondary" className="flex-1 rounded-2xl font-bold py-4 h-auto" onClick={() => setUploadModalOpen(false)}>Batal</Button>
                        <Button
                            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-2xl shadow-lg shadow-emerald-500/20 font-black tracking-widest uppercase text-xs py-4 h-auto flex items-center justify-center gap-2"
                            onClick={handleSubmitRecommendation}
                            disabled={uploadingRec || !recommendationFile}
                        >
                            {uploadingRec ? <><Clock size={16} className="animate-spin" /> Mengupload...</> : <><Send size={16} /> Kirim Dokumen</>}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
