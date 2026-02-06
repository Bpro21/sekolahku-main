import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    Video, Calendar, Clock, Sparkles, CheckCircle, User
} from 'lucide-react';
import { Card, Button, Input } from '../ui/Elements';
import { Modal } from '../ui/Overlays';
import { sendWhatsappMessage } from '../../utils/helpers';

export default function AdminInterviewManager({ showToast }) {
    const [candidates, setCandidates] = useState([]);
    const [historyData, setHistoryData] = useState([]); // Interview history
    const [selected, setSelected] = useState(null);
    const [schedule, setSchedule] = useState({ date: '', time_student: '', time_parent: '', zoom_link: '', interviewer: '' });
    const [notes, setNotes] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // all, verified, psychotest_done, scheduled, done, history
    const [activeTab, setActiveTab] = useState('active'); // active, history
    const [completeModal, setCompleteModal] = useState(null); // For marking interview as completed
    const [isEditMode, setIsEditMode] = useState(false); // Edit mode for saved interview results
    const [interviewResult, setInterviewResult] = useState({
        student_interviewer: '', student_notes: '', student_score: '',
        parent_interviewer: '', parent_notes: '', parent_score: ''
    });

    const fetchData = async () => {
        // Active candidates (pending interviews)
        const activeStatuses = ['verified', 'psychotest_done', 'interview_scheduled', 'interview_reschedule', 'interview_accepted', 'paid_registration'];
        const { data: activeCandidates } = await supabase.from('registrations')
            .select('*')
            .in('status', activeStatuses)
            .order('created_at', { ascending: false });

        if (activeCandidates) setCandidates(activeCandidates);

        // History candidates (completed interviews)
        const historyStatuses = ['interview_done', 'lulus', 'rejected', 'paid', 'student', 'accepted'];
        const { data: historyCandidates } = await supabase.from('registrations')
            .select('*')
            .in('status', historyStatuses)
            .order('updated_at', { ascending: false });

        if (historyCandidates) {
            // Only include those who had an interview (check interview_schedule or interview_result)
            const list = historyCandidates.filter(r => r.interview_schedule || r.interview_result);
            setHistoryData(list);
        }
    };

    useEffect(() => {
        fetchData();

        const channel = supabase.channel('admin_interview_manager')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, fetchData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const filteredCandidates = candidates.filter(c => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'scheduled') return ['interview_scheduled', 'interview_accepted', 'interview_reschedule'].includes(c.status);
        return c.status === filterStatus;
    });

    const handleSetSchedule = async () => {
        try {
            if (!schedule.date || !schedule.time_student) return showToast('Tanggal dan Jam Siswa wajib diisi', 'error');

            const payload = {
                status: 'interview_scheduled',
                interview_schedule: {
                    date: schedule.date,
                    student_time: schedule.time_student,
                    parent_time: schedule.time_parent,
                    zoom_link: schedule.zoom_link,
                    interviewer: schedule.interviewer,
                    set_at: new Date().toISOString()
                }
            };

            const { error } = await supabase.from('registrations').update(payload).eq('id', selected.id);
            if (error) throw error;

            // Fetch Phone from User Profile (Registered Account) & Send WhatsApp
            let phone = '';
            try {
                const { data: profile } = await supabase.from('profiles').select('phone').eq('id', selected.user_id).single();
                if (profile) {
                    phone = profile.phone;
                }
            } catch (err) {
                console.error("Error fetching user phone:", err);
            }

            if (phone) {
                const dateStr = new Date(schedule.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                const msg = `*Jadwal Wawancara PPDB*\n\nHalo Orang Tua dari ${selected.student_name},\n\nBerikut jadwal wawancara Ananda:\n📅 Tanggal: ${dateStr}\n⏰ Jam: ${schedule.time_student} WIB\n📍 Lokasi/Link: ${schedule.zoom_link || 'Gedung Sekolah'}\n\nMohon hadir tepat waktu. Terima kasih.`;
                await sendWhatsappMessage(phone, msg);
                showToast('Undangan dikirim & Notifikasi WA terkirim ke Nomor Akun!');
            } else {
                showToast('Undangan dikirim (No WA Akun tidak ditemukan)', 'warning');
            }

            setSelected(null); setSchedule({ date: '', time_student: '', time_parent: '', zoom_link: '', interviewer: '' });
        } catch (e) { showToast(e.message, 'error'); }
    };

    // Mark interview as completed or update interview result
    const handleCompleteInterview = async () => {
        if (!completeModal) return;
        try {
            const studentScore = parseInt(interviewResult.student_score) || 0;
            const parentScore = parseInt(interviewResult.parent_score) || 0;
            const avgScore = studentScore && parentScore ? Math.round((studentScore + parentScore) / 2) : (studentScore || parentScore);

            // Check if candidate is already in "completed" status (history)
            const isHistoryCandidate = ['lulus', 'rejected', 'paid', 'student', 'accepted', 'interview_done'].includes(completeModal.status);

            const updates = {
                // Set to 'interview_done' when completing, or keep current if already in history
                ...(isHistoryCandidate ? {} : { status: 'interview_done' }),
                interview_result: {
                    // Student interview result
                    student_interviewer: interviewResult.student_interviewer || completeModal.interview_schedule?.interviewer || '',
                    student_notes: interviewResult.student_notes || '',
                    student_score: studentScore,
                    student_completed: !!interviewResult.student_notes || !!studentScore,
                    // Parent interview result
                    parent_interviewer: interviewResult.parent_interviewer || '',
                    parent_notes: interviewResult.parent_notes || '',
                    parent_score: parentScore,
                    parent_completed: !!interviewResult.parent_notes || !!parentScore,
                    // Aggregate score
                    average_score: avgScore,
                    // General
                    completed_at: completeModal.interview_result?.completed_at || new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            };

            const { error } = await supabase.from('registrations').update(updates).eq('id', completeModal.id);
            if (error) throw error;

            showToast(isHistoryCandidate ? 'Nilai wawancara disimpan!' : 'Wawancara ditandai selesai!');
            setCompleteModal(null);
            setIsEditMode(false);
            setInterviewResult({ student_interviewer: '', student_notes: '', student_score: '', parent_interviewer: '', parent_notes: '', parent_score: '' });
            fetchData();
        } catch (e) { showToast(e.message, 'error'); }
    };


    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Video className="text-emerald-600" /> Manajemen Jadwal & Wawancara</h2>

            {/* Tab Switcher */}
            <div className="flex gap-2 border-b border-slate-200 pb-1">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-all ${activeTab === 'active' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                    Kandidat Aktif ({candidates.length})
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                    Histori Wawancara ({historyData.length})
                </button>
            </div>

            {activeTab === 'active' && (
                <>
                    {/* Status Summary / Filter Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { id: 'all', label: 'Semua Kandidat', icon: Video, color: 'emerald' },
                            { id: 'verified', label: 'Perlu Jadwal', icon: Calendar, color: 'amber' },
                            { id: 'interview_scheduled', label: 'Terjadwal', icon: Clock, color: 'blue' },
                            { id: 'interview_accepted', label: 'Dikonfirmasi', icon: CheckCircle, color: 'green' },
                            { id: 'interview_reschedule', label: 'Reschedule', icon: Sparkles, color: 'purple' }
                        ].map(item => {
                            const count = item.id === 'all' ? candidates.length : candidates.filter(c => c.status === item.id).length;
                            const isActive = filterStatus === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setFilterStatus(item.id)}
                                    className={`p-3 rounded-xl border text-left transition-all ${isActive ? `bg-${item.color}-50 dark:bg-${item.color}-900/20 border-${item.color}-500 ring-1 ring-${item.color}-500` : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-300'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? `text-${item.color}-700 dark:text-${item.color}-300` : 'text-slate-500 dark:text-slate-400'}`}>{item.label}</span>
                                        <item.icon size={14} className={isActive ? `text-${item.color}-600 dark:text-${item.color}-400` : 'text-slate-400'} />
                                    </div>
                                    <div className="text-2xl font-bold text-slate-800 dark:text-white">{count}</div>
                                </button>
                            )
                        })}
                    </div>

                    <Card className="p-0 overflow-hidden border border-slate-200 shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="p-4">Calon Siswa</th>
                                        <th className="p-4">Cabang & Jalur</th>
                                        <th className="p-4">Status & Info</th>
                                        <th className="p-4 text-center">Jadwal</th>
                                        <th className="p-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {filteredCandidates.length > 0 ? filteredCandidates.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800 dark:text-white text-base">{c.student_name}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">#{c.id.slice(0, 8)}</span>
                                                    {c.status === 'interview_reschedule' && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full animate-pulse">
                                                            <Sparkles size={10} /> Minta Reschedule
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-slate-700 dark:text-slate-200">{c.unit_name}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">{c.major || 'Non-Kejuruan'} • {c.path_name}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${c.status === 'interview_accepted' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    c.status === 'interview_scheduled' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        c.status === 'interview_reschedule' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                            'bg-slate-50 text-slate-600 border-slate-200'
                                                    }`}>
                                                    {c.status === 'interview_accepted' ? <CheckCircle size={12} /> :
                                                        c.status === 'interview_scheduled' ? <Clock size={12} /> :
                                                            c.status === 'interview_reschedule' ? <Sparkles size={12} /> : <Calendar size={12} />}
                                                    {c.status.replace(/_/g, ' ').toUpperCase()}
                                                </div>
                                                {c.status === 'interview_reschedule' && <div className="mt-2 text-xs text-amber-600 italic">"{c.reschedule_reason}"</div>}
                                            </td>
                                            <td className="p-4 text-center">
                                                {c.interview_schedule?.date ? (
                                                    <div>
                                                        <div className="font-bold text-slate-700 dark:text-white">{new Date(c.interview_schedule.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                                                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 inline-block px-1 rounded mt-0.5">{c.interview_schedule.student_time} WIB</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic">- Belum diatur -</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex justify-center gap-2 flex-wrap">
                                                    <Button onClick={() => setSelected(c)} size="sm" variant="secondary" className="h-8 text-xs">
                                                        {c.status.includes('interview') ? 'Edit Jadwal' : 'Atur Jadwal'}
                                                    </Button>
                                                    {['interview_scheduled', 'interview_accepted'].includes(c.status) && (
                                                        <Button
                                                            onClick={() => {
                                                                setCompleteModal(c);
                                                                setInterviewResult({
                                                                    student_interviewer: c.interview_result?.student_interviewer || c.interview_schedule?.interviewer || '',
                                                                    student_notes: c.interview_result?.student_notes || '',
                                                                    student_score: c.interview_result?.student_score || '',
                                                                    parent_interviewer: c.interview_result?.parent_interviewer || '',
                                                                    parent_notes: c.interview_result?.parent_notes || '',
                                                                    parent_score: c.interview_result?.parent_score || ''
                                                                });
                                                            }}
                                                            size="sm"
                                                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                                                        >
                                                            <CheckCircle size={14} className="mr-1" /> Selesai
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="p-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center gap-2">
                                                <Calendar size={32} className="opacity-20" />
                                                <span>Tidak ada kandidat untuk filter ini.</span>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Modal isOpen={!!selected} onClose={() => { setSelected(null); }} title={`Jadwal & Wawancara: ${selected?.student_name}`} footer={<div className="flex justify-end gap-2 w-full"><Button variant="secondary" onClick={() => setSelected(null)}>Tutup</Button><Button onClick={handleSetSchedule}>Kirim Undangan</Button></div>}>
                        <div className="space-y-4">
                            <Input label="Tanggal Wawancara" type="date" value={schedule.date} onChange={e => setSchedule({ ...schedule, date: e.target.value })} />
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Jam Siswa" type="time" value={schedule.time_student} onChange={e => setSchedule({ ...schedule, time_student: e.target.value })} />
                                <Input label="Jam Wali (Opsional)" type="time" value={schedule.time_parent} onChange={e => setSchedule({ ...schedule, time_parent: e.target.value })} />
                            </div>
                            <Input label="Link Zoom / Lokasi" value={schedule.zoom_link} onChange={e => setSchedule({ ...schedule, zoom_link: e.target.value })} placeholder="https://zoom.us/j/..." />

                            <hr className="my-4" />

                            {/* Pewawancara Section */}
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                <h4 className="font-bold text-emerald-900 mb-3 flex items-center gap-2"><User size={16} /> Pewawancara</h4>
                                <Input
                                    label="Nama Pewawancara"
                                    value={schedule.interviewer}
                                    onChange={e => setSchedule({ ...schedule, interviewer: e.target.value })}
                                    placeholder="Masukkan nama pewawancara..."
                                />
                                <p className="text-xs text-emerald-600 mt-2 italic">
                                    * Catatan hasil wawancara diinput setelah wawancara selesai
                                </p>
                            </div>
                        </div>
                    </Modal>
                </>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800">
                        <h3 className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                            <Clock size={18} /> Histori Wawancara - Kandidat yang Sudah Selesai
                        </h3>
                        <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">Menampilkan kandidat yang sudah melewati tahap wawancara</p>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {historyData.length > 0 ? historyData.map(c => (
                            <div key={c.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                {/* Header Row */}
                                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <div className="font-bold text-slate-800 dark:text-white text-base">{c.student_name}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                {c.unit_name} • {c.path_name} • <span className="font-mono">#{c.id.slice(0, 8)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Edit button for adding/editing interview results */}
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 text-xs"
                                            onClick={() => {
                                                setCompleteModal(c);
                                                setInterviewResult({
                                                    student_interviewer: c.interview_result?.student_interviewer || c.interview_schedule?.interviewer || '',
                                                    student_notes: c.interview_result?.student_notes || '',
                                                    student_score: c.interview_result?.student_score || '',
                                                    parent_interviewer: c.interview_result?.parent_interviewer || '',
                                                    parent_notes: c.interview_result?.parent_notes || '',
                                                    parent_score: c.interview_result?.parent_score || ''
                                                });
                                            }}
                                        >
                                            {c.interview_result?.student_score || c.interview_result?.parent_score ? 'Edit' : '+ Input Nilai'}
                                        </Button>
                                        {c.interview_schedule?.date && (
                                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100">
                                                <Calendar size={10} className="inline mr-1" />
                                                {new Date(c.interview_schedule.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        )}
                                        {/* Average Score Badge */}
                                        {c.interview_result?.average_score > 0 && (
                                            <span className={`px-3 py-1 rounded-full text-sm font-black ${c.interview_result.average_score >= 75 ? 'bg-emerald-100 text-emerald-700' :
                                                c.interview_result.average_score >= 50 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                Rata: {c.interview_result.average_score}
                                            </span>
                                        )}
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${c.status === 'lulus' || c.status === 'paid' || c.status === 'student' || c.status === 'accepted' || c.status === 'interview_done'
                                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                            : 'bg-red-100 text-red-700 border border-red-200'
                                            }`}>
                                            {c.status === 'interview_done' ? 'SELESAI WAWANCARA' :
                                                c.status === 'lulus' ? 'LULUS' :
                                                    c.status === 'paid' ? 'TERDAFTAR' :
                                                        c.status === 'student' ? 'SANTRI' :
                                                            c.status === 'accepted' ? 'DITERIMA' : 'TIDAK LULUS'}
                                        </span>
                                    </div>
                                </div>

                                {/* Interview Results Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Student Interview */}
                                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                                        <div className="flex items-center gap-2 mb-2">
                                            <User size={14} className="text-emerald-600 dark:text-emerald-500" />
                                            <span className="font-bold text-emerald-800 dark:text-emerald-400 text-xs uppercase">Wawancara Siswa</span>
                                            {c.interview_result?.student_score > 0 && (
                                                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-black ${c.interview_result.student_score >= 75 ? 'bg-emerald-200 text-emerald-800' :
                                                    c.interview_result.student_score >= 50 ? 'bg-amber-200 text-amber-800' :
                                                        'bg-red-200 text-red-800'
                                                    }`}>
                                                    {c.interview_result.student_score}
                                                </span>
                                            )}
                                            {c.interview_result?.student_completed && !c.interview_result?.student_score && (
                                                <CheckCircle size={12} className="text-emerald-600 ml-auto" />
                                            )}
                                        </div>
                                        {c.interview_result?.student_interviewer ? (
                                            <>
                                                <div className="text-xs text-emerald-600 dark:text-emerald-500 mb-1">
                                                    Pewawancara: <span className="font-bold text-emerald-800 dark:text-emerald-400">{c.interview_result.student_interviewer}</span>
                                                </div>
                                                <div className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded border border-emerald-100 dark:border-emerald-900/30 mt-1">
                                                    {c.interview_result.student_notes || <span className="italic text-slate-400">Tidak ada catatan</span>}
                                                </div>
                                            </>
                                        ) : c.interview_schedule?.interviewer ? (
                                            <>
                                                <div className="text-xs text-emerald-600 dark:text-emerald-500 mb-1">
                                                    Pewawancara: <span className="font-bold text-emerald-800 dark:text-emerald-400">{c.interview_schedule.interviewer}</span>
                                                </div>
                                                <div className="text-xs italic text-slate-400">Belum ada catatan hasil</div>
                                            </>
                                        ) : (
                                            <div className="text-xs italic text-slate-400">Belum ada data wawancara siswa</div>
                                        )}
                                    </div>

                                    {/* Parent Interview */}
                                    <div className="bg-purple-50 dark:bg-purple-900/10 p-3 rounded-xl border border-purple-100 dark:border-purple-900/30">
                                        <div className="flex items-center gap-2 mb-2">
                                            <User size={14} className="text-purple-600 dark:text-purple-500" />
                                            <span className="font-bold text-purple-800 dark:text-purple-400 text-xs uppercase">Wawancara Wali</span>
                                            {c.interview_result?.parent_score > 0 && (
                                                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-black ${c.interview_result.parent_score >= 75 ? 'bg-purple-200 text-purple-800' :
                                                    c.interview_result.parent_score >= 50 ? 'bg-amber-200 text-amber-800' :
                                                        'bg-red-200 text-red-800'
                                                    }`}>
                                                    {c.interview_result.parent_score}
                                                </span>
                                            )}
                                            {c.interview_result?.parent_completed && !c.interview_result?.parent_score && (
                                                <CheckCircle size={12} className="text-purple-600 ml-auto" />
                                            )}
                                        </div>
                                        {c.interview_result?.parent_interviewer ? (
                                            <>
                                                <div className="text-xs text-purple-600 dark:text-purple-500 mb-1">
                                                    Pewawancara: <span className="font-bold text-purple-800 dark:text-purple-400">{c.interview_result.parent_interviewer}</span>
                                                </div>
                                                <div className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded border border-purple-100 dark:border-purple-900/30 mt-1">
                                                    {c.interview_result.parent_notes || <span className="italic text-slate-400">Tidak ada catatan</span>}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-xs italic text-slate-400">Belum ada data wawancara wali</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="p-12 text-center text-slate-400">
                                <Calendar size={32} className="mx-auto opacity-20 mb-2" />
                                <span>Belum ada histori wawancara.</span>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Complete Interview Modal */}
            <Modal
                isOpen={!!completeModal}
                onClose={() => { setCompleteModal(null); setIsEditMode(false); setInterviewResult({ student_interviewer: '', student_notes: '', student_score: '', parent_interviewer: '', parent_notes: '', parent_score: '' }); }}
                title={`Hasil Wawancara: ${completeModal?.student_name}`}
                footer={
                    <div className="flex justify-between items-center w-full">
                        {/* Saved indicator */}
                        {completeModal?.interview_result?.completed_at && !isEditMode && (
                            <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                                <CheckCircle size={14} />
                                <span>Tersimpan {completeModal.interview_result.updated_at ? '(Diedit)' : ''}</span>
                            </div>
                        )}
                        {!completeModal?.interview_result?.completed_at && <div />}

                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => { setCompleteModal(null); setIsEditMode(false); }}>Tutup</Button>
                            {completeModal?.interview_result?.completed_at && !isEditMode ? (
                                <Button onClick={() => setIsEditMode(true)} className="bg-blue-600 hover:bg-blue-700">
                                    Edit Nilai
                                </Button>
                            ) : (
                                <Button onClick={handleCompleteInterview} className="bg-emerald-600 hover:bg-emerald-700">
                                    <CheckCircle size={16} className="mr-1" /> {completeModal?.interview_result?.completed_at ? 'Simpan Perubahan' : 'Tandai Selesai'}
                                </Button>
                            )}
                        </div>
                    </div>
                }
            >
                {completeModal && (
                    <div className="space-y-4">
                        {/* Saved State Banner */}
                        {completeModal.interview_result?.completed_at && !isEditMode && (
                            <div className="bg-emerald-100 border border-emerald-200 rounded-xl p-4 text-center">
                                <CheckCircle size={32} className="text-emerald-600 mx-auto mb-2" />
                                <div className="font-bold text-emerald-800">Data Wawancara Tersimpan</div>
                                <div className="text-xs text-emerald-600 mt-1">
                                    Disimpan: {new Date(completeModal.interview_result.completed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </div>
                                {completeModal.interview_result.average_score > 0 && (
                                    <div className="mt-3">
                                        <span className={`px-4 py-2 rounded-full text-lg font-black ${completeModal.interview_result.average_score >= 75 ? 'bg-emerald-200 text-emerald-800' :
                                            completeModal.interview_result.average_score >= 50 ? 'bg-amber-200 text-amber-800' :
                                                'bg-red-200 text-red-800'
                                            }`}>
                                            Rata-rata: {completeModal.interview_result.average_score}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Info Jadwal */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                            <h4 className="font-bold text-blue-800 dark:text-blue-400 mb-2 flex items-center gap-2">
                                <Calendar size={16} /> Info Jadwal Wawancara
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-blue-600 dark:text-blue-400 font-medium">Tanggal:</span>
                                    <div className="font-bold text-slate-800 dark:text-white">
                                        {completeModal.interview_schedule?.date
                                            ? new Date(completeModal.interview_schedule.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                                            : '-'}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-blue-600 dark:text-blue-400 font-medium">Jam Siswa / Wali:</span>
                                    <div className="font-bold text-slate-800 dark:text-white">
                                        {completeModal.interview_schedule?.student_time || '-'} / {completeModal.interview_schedule?.parent_time || '-'} WIB
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Show form only if not saved OR in edit mode */}
                        {(!completeModal.interview_result?.completed_at || isEditMode) && (
                            <>
                                {/* Input Hasil Wawancara SISWA */}
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                                    <h4 className="font-bold text-emerald-900 dark:text-emerald-400 mb-3 flex items-center gap-2">
                                        <User size={16} /> Wawancara SISWA
                                        {interviewResult.student_score && (
                                            <span className="ml-auto bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-black">
                                                Nilai: {interviewResult.student_score}
                                            </span>
                                        )}
                                    </h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2">
                                            <Input
                                                label="Pewawancara Siswa"
                                                value={interviewResult.student_interviewer}
                                                onChange={e => setInterviewResult({ ...interviewResult, student_interviewer: e.target.value })}
                                                placeholder="Nama pewawancara..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-emerald-700 dark:text-emerald-500 mb-2">Nilai (10-100)</label>
                                            <input
                                                type="number"
                                                min="10"
                                                max="100"
                                                className="w-full p-3 text-lg font-black text-center border-2 border-emerald-300 dark:border-emerald-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-slate-800 dark:text-white"
                                                placeholder="75"
                                                value={interviewResult.student_score}
                                                onChange={e => {
                                                    const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                                    setInterviewResult({ ...interviewResult, student_score: e.target.value ? val : '' });
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Catatan Wawancara Siswa</label>
                                        <textarea
                                            className="w-full p-3 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none dark:bg-slate-800 dark:text-white dark:border-slate-700"
                                            rows="2"
                                            placeholder="Hasil observasi siswa, sikap, jawaban, dll..."
                                            value={interviewResult.student_notes}
                                            onChange={e => setInterviewResult({ ...interviewResult, student_notes: e.target.value })}
                                        ></textarea>
                                    </div>
                                </div>

                                {/* Input Hasil Wawancara WALI */}
                                <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30">
                                    <h4 className="font-bold text-purple-900 dark:text-purple-400 mb-3 flex items-center gap-2">
                                        <User size={16} /> Wawancara WALI / ORANG TUA
                                    </h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2">
                                            <Input
                                                label="Pewawancara Wali"
                                                value={interviewResult.parent_interviewer}
                                                onChange={e => setInterviewResult({ ...interviewResult, parent_interviewer: e.target.value })}
                                                placeholder="Nama pewawancara..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-purple-700 dark:text-purple-500 mb-2">Nilai (10-100)</label>
                                            <input
                                                type="number"
                                                min="10"
                                                max="100"
                                                className="w-full p-3 text-lg font-black text-center border-2 border-purple-300 dark:border-purple-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-slate-800 dark:text-white"
                                                placeholder="75"
                                                value={interviewResult.parent_score}
                                                onChange={e => {
                                                    const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                                    setInterviewResult({ ...interviewResult, parent_score: e.target.value ? val : '' });
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Catatan Wawancara Wali</label>
                                        <textarea
                                            className="w-full p-3 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none dark:bg-slate-800 dark:text-white dark:border-slate-700"
                                            rows="2"
                                            placeholder="Komitmen orang tua, dukungan, harapan, dll..."
                                            value={interviewResult.parent_notes}
                                            onChange={e => setInterviewResult({ ...interviewResult, parent_notes: e.target.value })}
                                        ></textarea>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
