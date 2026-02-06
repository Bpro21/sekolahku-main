import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    BrainCircuit, Lock, HeartHandshakeIcon, CheckCircle, Info, BookOpen
} from 'lucide-react';
import { Button, Card } from '../ui/Elements';

export default function PsychotestModule({ user, showToast, onNavigate }) {
    const [activeReg, setActiveReg] = useState(null);
    const [registrations, setRegistrations] = useState([]);
    const [step, setStep] = useState('select');
    const [testType, setTestType] = useState(null); // 'psychotest' or 'adab'
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [config, setConfig] = useState({ time_per_question: 60, psychotest_count: 20, adab_count: 20 });

    useEffect(() => {
        if (!user) return;

        // Fetch registrations
        const fetchRegistrations = async () => {
            const { data } = await supabase
                .from('registrations')
                .select('*')
                .eq('user_id', user.id);
            if (data) setRegistrations(data);
        };

        // Fetch quiz config
        const fetchConfig = async () => {
            const { data } = await supabase
                .from('quiz_config')
                .select('*')
                .eq('id', 'main')
                .single();
            if (data) setConfig(prev => ({ ...prev, ...data }));
        };

        fetchRegistrations();
        fetchConfig();

        // Real-time subscriptions
        const regsChannel = supabase.channel('user_psychotest_regs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `user_id=eq.${user.id}` }, fetchRegistrations)
            .subscribe();

        const configChannel = supabase.channel('quiz_config_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_config' }, fetchConfig)
            .subscribe();

        return () => {
            supabase.removeChannel(regsChannel);
            supabase.removeChannel(configChannel);
        };
    }, [user]);

    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    const loadQuestions = async (reg, type) => {
        // Fetch questions from Supabase
        const { data: allQ, error } = await supabase
            .from('questions')
            .select('*')
            .eq('category', type);

        if (error || !allQ) {
            console.error('Error loading questions:', error);
            return;
        }

        let filteredQ = [...allQ];

        // Filter by Level (Jenjang)
        const studentLevel = reg.unit_level || 'Unknown';
        if (studentLevel && studentLevel !== 'Unknown') {
            filteredQ = filteredQ.filter(q => {
                const qLevel = q.level || 'all';
                return qLevel === 'all' || qLevel === studentLevel;
            });
        }

        // Filter Adab by Religion
        if (type === 'adab') {
            const studentRel = reg.student_religion || 'General';
            const valid = ['all', 'General'];
            if (studentRel) valid.push(studentRel);
            filteredQ = filteredQ.filter(q => valid.includes(q.religion));
        }

        // Limit Questions based on Config
        const count = type === 'psychotest' ? (config.psychotest_count || 20) : (config.adab_count || 20);
        const selectedQ = shuffleArray(filteredQ).slice(0, count);

        setQuestions(selectedQ);
        setCurrentIndex(0);
        setAnswers({});
        setTimeLeft(selectedQ.length * config.time_per_question);
    };

    const openTestMenu = (reg) => {
        const pName = (reg.path_name || '').toLowerCase();
        const isExempt = reg.is_scholarship || reg.is_internal || pName.includes('internal') || pName.includes('prestasi') || pName.includes('yatim');

        // Allow 'verified' status ONLY for exempt users (Prestasi, Yatim, Internal, Scholarship)
        const isVerifiedExempt = isExempt && reg.status === 'verified';
        const isPaidStandard = reg.status === 'paid_registration';

        // Advanced statuses where test is allowed (or results shown)
        const isAdvanced = ['psychotest_done', 'interview_scheduled', 'interview_accepted', 'lulus', 'paid'].includes(reg.status);

        if (isVerifiedExempt || isPaidStandard || isAdvanced) {
            setActiveReg(reg);
            if (reg.psychotest_result) {
                setAnalysisResult(reg.psychotest_result);
                setStep('result');
            } else {
                setStep('test_menu');
            }
            return;
        }

        // Error Handling
        if (reg.status === 'submitted' || (!isExempt && reg.status === 'verified')) {
            alert(isExempt ? "Mohon tunggu verifikasi berkas oleh admin." : "Mohon lakukan pembayaran biaya pendaftaran terlebih dahulu.");
            if (onNavigate && !isExempt) onNavigate('payments');
            return;
        }

        if (reg.status === 'verifying_payment' || reg.status === 'pending_payment') {
            alert("Mohon tunggu verifikasi pembayaran/berkas oleh admin.");
            return;
        }

        alert("Status pendaftaran belum memenuhi syarat untuk mengikuti tes.");
    };

    const startSpecificTest = async (type) => {
        setTestType(type);
        await loadQuestions(activeReg, type);
        setStep('intro');
    };

    const confirmStart = () => { setStep('test'); };

    useEffect(() => {
        if (step === 'test' && timeLeft > 0) {
            const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearInterval(timer);
        } else if (step === 'test' && timeLeft === 0) {
            submitTest();
        }
    }, [step, timeLeft]);

    const handleOptionSelect = (option) => { setAnswers(prev => ({ ...prev, [currentIndex]: option })); };
    const formatTime = (seconds) => { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m}:${s < 10 ? '0' : ''}${s}`; };

    const submitTest = async () => {
        if (!activeReg || !testType) return;
        setIsAnalyzing(true);

        // Calculate Score for this section
        let correctCount = 0;
        questions.forEach((q, idx) => {
            if (answers[idx] === q.correct) correctCount++;
        });
        const score = Math.round((correctCount / questions.length) * 100);

        // Update local exam data
        const examData = {
            score: score,
            status: 'done',
            completed_at: new Date().toISOString()
        };

        const currentExams = activeReg.exams || {};
        const updatedExams = { ...currentExams, [testType]: examData };

        // Check if both exams are done
        const isPsikotesDone = updatedExams.psychotest?.status === 'done';
        const isAdabDone = updatedExams.adab?.status === 'done';

        const updates = { exams: updatedExams };

        // If both done, calculate final result and lock
        if (isPsikotesDone && isAdabDone) {
            const finalScore = Math.round((updatedExams.psychotest.score + updatedExams.adab.score) / 2);

            let summaryText = "";
            if (finalScore >= 80) summaryText = "Sangat Baik. Disarankan Lulus.";
            else if (finalScore >= 60) summaryText = "Cukup Baik. Pertimbangkan.";
            else summaryText = "Kurang. Perlu Tinjauan.";

            const resultData = {
                final_score: finalScore,
                summary: summaryText,
                scores: {
                    psychotest: updatedExams.psychotest.score,
                    adab: updatedExams.adab.score
                },
                completed_at: new Date().toISOString()
            };

            updates.status = 'psychotest_done';
            updates.psychotest_result = resultData;
            setAnalysisResult(resultData);
        } else {
            // Just update reg object locally to reflect partial progress
            setActiveReg(prev => ({ ...prev, exams: updatedExams }));
        }

        // Save to Supabase
        const { error } = await supabase
            .from('registrations')
            .update(updates)
            .eq('id', activeReg.id);

        if (error) console.error('Error saving test results:', error);

        setIsAnalyzing(false);

        if (updates.status === 'psychotest_done') {
            setStep('result');
        } else {
            setStep('test_menu');
            showToast(`${testType === 'psychotest' ? 'Psikotes' : 'Tes Adab'} selesai. Skor: ${score}`);
        }
    };

    if (step === 'select') {
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2"><BrainCircuit className="text-purple-600" /> Ujian Seleksi (CBT)</h2>
                <div className="grid gap-4">
                    {registrations.map(reg => {
                        const isLocked = reg.status === 'submitted' || reg.status === 'pending_payment' || reg.status === 'verifying_payment';
                        return (
                            <Card key={reg.id} className={`p-4 flex justify-between items-center ${isLocked ? 'opacity-70 bg-slate-50 dark:bg-slate-800/50' : ''}`}>
                                <div>
                                    <h4 className="font-bold text-lg">{reg.student_name}</h4>
                                    <p className="text-slate-500">{reg.unit_name} • {reg.student_religion || 'Umum'}</p>
                                    {isLocked && <div className="text-xs text-red-500 font-bold flex items-center gap-1 mt-1"><Lock size={12} /> {reg.status === 'submitted' ? 'Bayar Pendaftaran Dulu' : 'Menunggu Verifikasi'}</div>}
                                    {reg.psychotest_result && <span className="text-xs text-green-600 font-bold">Selesai (Total: {reg.psychotest_result.final_score})</span>}
                                </div>
                                <Button variant={isLocked ? 'secondary' : (reg.psychotest_result ? "secondary" : "ai")} onClick={() => openTestMenu(reg)}>
                                    {reg.psychotest_result ? "Lihat Hasil" : "Buka Menu Ujian"}
                                </Button>
                            </Card>
                        )
                    })}
                    {registrations.length === 0 && <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed">Belum ada pendaftaran.</div>}
                </div>
            </div>
        );
    }

    if (step === 'test_menu') {
        const exams = activeReg.exams || {};
        const pStatus = exams.psychotest?.status === 'done';
        const aStatus = exams.adab?.status === 'done';

        return (
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center gap-2 mb-4">
                    <Button variant="secondary" onClick={() => setStep('select')}>&larr; Kembali</Button>
                    <h3 className="text-xl font-bold">Menu Ujian: {activeReg.student_name}</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    {/* Card Psikotes */}
                    <Card className={`p-6 border-l-4 ${pStatus ? 'border-l-green-500 bg-green-50' : 'border-l-purple-500'}`}>
                        <div className="mb-4">
                            <h4 className="font-bold text-lg flex items-center gap-2"><BrainCircuit size={20} /> Tes Psikotes</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-200 mt-1">Logika, Kepribadian & Potensi Akademik</p>
                            <div className="mt-2 text-xs font-bold text-slate-500">{config.psychotest_count || 20} Soal • {Math.round((config.psychotest_count || 20) * config.time_per_question / 60)} Menit</div>
                        </div>
                        {pStatus ? (
                            <div className="text-green-700 font-bold flex items-center gap-2"><CheckCircle /> Selesai (Skor: {exams.psychotest.score})</div>
                        ) : (
                            <Button variant="ai" onClick={() => startSpecificTest('psychotest')} className="w-full">Mulai Tes</Button>
                        )}
                    </Card>

                    {/* Card Adab */}
                    <Card className={`p-6 border-l-4 ${aStatus ? 'border-l-green-500 bg-green-50' : 'border-l-orange-500'}`}>
                        <div className="mb-4">
                            <h4 className="font-bold text-lg flex items-center gap-2"><HeartHandshakeIcon size={20} /> Tes Adab & Ibadah</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-200 mt-1">Pengetahuan Agama & Etika Siswa</p>
                            <div className="mt-2 text-xs font-bold text-slate-500">{config.adab_count || 20} Soal • {Math.round((config.adab_count || 20) * config.time_per_question / 60)} Menit</div>
                        </div>
                        {aStatus ? (
                            <div className="text-green-700 font-bold flex items-center gap-2"><CheckCircle /> Selesai (Skor: {exams.adab.score})</div>
                        ) : (
                            <Button variant="primary" onClick={() => startSpecificTest('adab')} className="w-full bg-orange-600 hover:bg-orange-700">Mulai Tes</Button>
                        )}
                    </Card>
                </div>
                <div className="bg-blue-50 p-4 rounded text-sm text-blue-800 flex items-start gap-2">
                    <Info size={16} className="mt-0.5" />
                    <div>
                        <strong>Petunjuk:</strong>
                        <ul className="list-disc pl-4 mt-1">
                            <li>Anda wajib menyelesaikan kedua tes di atas.</li>
                            <li>Hasil akhir akan dihitung rata-rata dari kedua tes.</li>
                            <li>Pastikan koneksi internet stabil sebelum memulai.</li>
                        </ul>
                    </div>
                </div>
            </div>
        )
    }

    if (step === 'intro') {
        return (
            <div className="max-w-2xl mx-auto text-center space-y-6 p-8 bg-white dark:bg-slate-900 rounded-xl shadow">
                <BookOpen size={64} className="mx-auto text-purple-600" />
                <h2 className="text-2xl font-bold">Persiapan Ujian</h2>
                <div className="text-left space-y-2 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg">
                    <p><strong>Nama:</strong> {activeReg.student_name}</p>
                    <p><strong>Materi:</strong> {testType === 'psychotest' ? 'Psikotes & Potensi Akademik' : 'Adab & Pengetahuan Agama'}</p>
                    <p><strong>Jumlah Soal:</strong> {questions.length} Butir</p>
                    <p><strong>Waktu:</strong> {Math.round(questions.length * config.time_per_question / 60)} Menit</p>
                </div>
                <Button onClick={confirmStart} className="w-full py-3 text-lg">Mulai Mengerjakan</Button>
            </div>
        )
    }

    if (step === 'test') {
        if (isAnalyzing) return (<div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8"><div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-6"></div><h3 className="text-2xl font-bold text-slate-800 dark:text-white animate-pulse">Menilai Jawaban...</h3></div>);
        const q = questions[currentIndex];
        if (!q) return <div>Memuat soal...</div>;
        return (
            <div className="max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-4 bg-slate-900 text-white p-4 rounded-lg">
                    <div className="font-bold">Soal {currentIndex + 1} / {questions.length}</div>
                    <div className={`font-mono text-xl ${timeLeft < 60 ? 'text-red-400 animate-pulse' : ''}`}>{formatTime(timeLeft)}</div>
                </div>
                <Card className="p-8 mb-4">
                    <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded mb-4 uppercase font-bold">{q.category}</span>
                    <h3 className="text-xl font-medium text-slate-800 dark:text-white mb-8">{q.text}</h3>
                    <div className="space-y-3">
                        {q.options.map((opt, idx) => (<div key={idx} onClick={() => handleOptionSelect(opt)} className={`p-4 border rounded-lg cursor-pointer transition-all ${answers[currentIndex] === opt ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-500' : 'hover:bg-slate-50 dark:bg-slate-800/50'}`}><div className="flex items-center gap-3"><div className={`w-5 h-5 rounded-full border flex items-center justify-center ${answers[currentIndex] === opt ? 'border-purple-600' : 'border-slate-400'}`}>{answers[currentIndex] === opt && <div className="w-3 h-3 bg-purple-600 rounded-full"></div>}</div><span>{opt}</span></div></div>))}
                    </div>
                </Card>
                <div className="flex justify-between"><Button variant="secondary" onClick={() => setCurrentIndex(p => Math.max(0, p - 1))} disabled={currentIndex === 0}>Sebelumnya</Button>{currentIndex < questions.length - 1 ? (<Button onClick={() => setCurrentIndex(p => p + 1)}>Selanjutnya &rarr;</Button>) : (<Button variant="ai" onClick={submitTest}>Selesai & Kirim Jawaban</Button>)}</div>
            </div>
        );
    }

    if (step === 'result' && analysisResult) {
        const score = analysisResult.final_score || 0;
        const getScoreColor = () => {
            if (score >= 80) return { bg: 'from-emerald-600 to-green-700', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
            if (score >= 60) return { bg: 'from-blue-600 to-indigo-700', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700 border-blue-200' };
            return { bg: 'from-orange-600 to-red-700', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700 border-orange-200' };
        };
        const colors = getScoreColor();

        return (
            <div className="max-w-4xl mx-auto animate-fade-in">
                <div className="flex gap-2 mb-4"><Button variant="secondary" onClick={() => setStep('select')}>&larr; Kembali</Button></div>

                {/* Header with Score */}
                <div className={`bg-gradient-to-r ${colors.bg} text-white p-8 rounded-t-2xl shadow-xl`}>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">Hasil Akhir Seleksi</h2>
                            <p className="text-white/80 text-lg">Peserta: <span className="font-bold">{activeReg?.student_name}</span></p>
                        </div>
                        <BrainCircuit size={64} className="opacity-20" />
                    </div>

                    {/* Score Display */}
                    <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                        <div className="text-center">
                            <div className="text-sm font-bold text-white/70 uppercase tracking-wider mb-2">Total Skor Akhir</div>
                            <div className="text-7xl font-black mb-2">{score}</div>
                            <div className="text-xl font-bold text-white/90">dari 100</div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4 bg-white/20 rounded-full h-3 overflow-hidden">
                            <div
                                className="bg-white h-full rounded-full transition-all duration-1000 ease-out shadow-lg"
                                style={{ width: `${score}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Content Card */}
                <Card className="rounded-t-none p-8 border-t-0 shadow-xl">
                    {/* Evaluation Summary */}
                    <div className="mb-8">
                        <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <CheckCircle className={colors.text} size={24} />
                            Evaluasi Sistem
                        </h3>
                        <div className={`p-6 rounded-xl border-2 ${colors.badge}`}>
                            <p className="text-lg leading-relaxed font-medium">{analysisResult.summary}</p>
                        </div>
                    </div>

                    {/* Score Breakdown */}
                    <div className="mb-8">
                        <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-4">Rincian Skor</h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Psychotest Score */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                                            <BrainCircuit className="text-white" size={24} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-blue-600 uppercase tracking-wide">Psikotes</div>
                                            <div className="text-xs text-slate-500">Logika & Potensi Akademik</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-5xl font-black text-blue-600 mb-2">{analysisResult.scores.psychotest}</div>
                                <div className="bg-blue-200/50 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-blue-600 h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${analysisResult.scores.psychotest}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Adab Score */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-6 rounded-xl border-2 border-orange-200 dark:border-orange-800 hover:shadow-lg transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center">
                                            <HeartHandshakeIcon className="text-white" size={24} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-orange-600 uppercase tracking-wide">Adab & Ibadah</div>
                                            <div className="text-xs text-slate-500">Pengetahuan Agama & Etika</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-5xl font-black text-orange-600 mb-2">{analysisResult.scores.adab}</div>
                                <div className="bg-orange-200/50 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-orange-600 h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${analysisResult.scores.adab}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Additional Info */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-start gap-3">
                            <Info size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                                <p className="font-bold mb-2">Catatan Penting:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Hasil ini merupakan evaluasi otomatis sistem berdasarkan jawaban Anda.</li>
                                    <li>Keputusan akhir penerimaan akan ditentukan oleh panitia seleksi.</li>
                                    <li>Anda akan dihubungi melalui kontak yang terdaftar untuk informasi lebih lanjut.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }
    return null;
}
