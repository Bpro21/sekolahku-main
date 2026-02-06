import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    ClipboardList, CheckCircle, XCircle, Bot, Medal
} from 'lucide-react';
import { Card, Button, Input, Badge } from '../ui/Elements';
import { Modal } from '../ui/Overlays';
import { callGeminiAI, sendWhatsappMessage } from '../../utils/helpers';

export default function AdminScoring({ showToast }) {
    const [candidates, setCandidates] = useState([]);
    const [selected, setSelected] = useState(null);
    const [decision, setDecision] = useState('accepted');
    const [notes, setNotes] = useState('');
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [config, setConfig] = useState({});

    // Fetch Candidates
    const fetchCandidates = async () => {
        const { data, error } = await supabase.from('registrations')
            .select('*')
            .in('status', ['psychotest_done', 'interview_done', 'verified', 'interview_scheduled', 'interview_accepted']);
        if (error) console.error(error);
        else setCandidates(data || []);
    };

    useEffect(() => {
        fetchCandidates();

        const channel = supabase.channel('admin_scoring')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, fetchCandidates)
            .subscribe();

        // Fetch Config (AI Key)
        const fetchConfig = async () => {
            const { data } = await supabase.from('app_settings').select('ai_assistant').eq('id', 'main').single();
            if (data?.ai_assistant) setConfig(data.ai_assistant);
        };
        fetchConfig();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleAiAnalysis = async () => {
        if (!config.google_gemini_api_key) return alert("API Key belum diset! (Cek Pengaturan Aplikasi -> AI Assistant)");
        try {
            const psiko = selected.psychotest_result?.final_score || 0;
            const studentScore = selected.interview_result?.student_score || 0;
            const parentScore = selected.interview_result?.parent_score || 0;
            const avgInterview = selected.interview_result?.average_score || 0;

            const prompt = `
        Analisis potensi siswa untuk kelulusan:
        Nama: ${selected.student_name}
        Nilai Psikotes: ${psiko}
        Nilai Wawancara Siswa: ${studentScore}
        Nilai Wawancara Wali: ${parentScore}
        Rata-rata Wawancara: ${avgInterview}
        Catatan Wawancara Siswa: ${selected.interview_result?.student_notes || 'Tidak ada'}
        Catatan Wawancara Wali: ${selected.interview_result?.parent_notes || 'Tidak ada'}
        Jalur: ${selected.path_name}

        Berikan rekomendasi (LULUS/TIDAK) dan alasan singkat dalam 2-3 kalimat.
      `;
            const res = await callGeminiAI(config.google_gemini_api_key, prompt);
            setAiAnalysis(res);
        } catch (e) { showToast("Gagal analisis AI", 'error'); }
    };

    const submitDecision = async () => {
        try {
            if (!decision) return;

            const finalUpdates = {
                status: decision, // 'lulus' or 'rejected' or 'accepted'
                final_scores: {
                    psychotest: selected.psychotest_result?.final_score || 0,
                    student_interview: selected.interview_result?.student_score || 0,
                    parent_interview: selected.interview_result?.parent_score || 0,
                    average_interview: selected.interview_result?.average_score || 0
                },
                decision_notes: notes,
                decided_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from('registrations').update(finalUpdates).eq('id', selected.id);
            if (error) throw error;

            // --- WHATSAPP NOTIFICATION ---
            if (decision === 'accepted' || decision === 'lulus') {
                try {
                    // 1. Get Settings for Template
                    const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 'main').single();
                    if (!settings) return; // Should not happen

                    // Use notification_config from settings if structure differs
                    // We might store templates in a JSONB column `notification_templates` or similar
                    // For now, I'll attempt to access it from `settings` object if I fetched *, but since column doesn't exist, it won't return it.
                    // I'll skip WA if template missing or use Hardcoded fallback.

                    const template = settings.template_graduation || "Selamat, {name} dinyatakan LULUS seleksi.";
                    const fonnteToken = settings.fonnte_token;

                    if (fonnteToken) {
                        // Get Phone from biodata
                        const phone = selected.biodata?.parents?.father?.phone || selected.biodata?.parents?.mother?.phone || selected.biodata?.parents?.guardian?.phone;

                        if (phone) {
                            const msg = template.replace(/{name}/g, selected.student_name);
                            await sendWhatsappMessage(phone, msg);
                            showToast('Notifikasi WhatsApp terkirim ke Wali Murid');
                        }
                    }
                } catch (err) {
                    console.error("WA Error", err);
                    showToast('Gagal kirim WA: ' + err.message, 'error');
                }
            }

            showToast(`Siswa dinyatakan ${decision === 'accepted' ? 'LOLOS SELEKSI (DITERIMA)' : decision.toUpperCase()}`);
            setSelected(null); setNotes(''); setAiAnalysis('');
        } catch (e) { showToast(e.message, 'error'); }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><ClipboardList className="text-emerald-600" /> Penilaian & Kelulusan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidates.map(c => (
                    <Card key={c.id} className="p-4 cursor-pointer hover:border-emerald-500 transition-all border-l-4 border-l-slate-200">
                        <div className="flex justify-between mb-2">
                            <h4 className="font-bold text-slate-800">{c.student_name}</h4>
                            <Badge status={c.status} />
                        </div>
                        <div className="text-xs space-y-1 text-slate-600 mb-4">
                            <div className="flex justify-between"><span>Psikotes:</span> <strong>{c.psychotest_result?.final_score || '-'}</strong></div>
                            <div className="flex justify-between"><span>Cabang:</span> <span>{c.unit_name}</span></div>
                        </div>
                        <Button onClick={() => setSelected(c)} className="w-full text-xs box-border">Input Nilai & Putuskan</Button>
                    </Card>
                ))}
                {candidates.length === 0 && <div className="col-span-3 text-center p-10 text-slate-400 border border-dashed rounded-xl">Belum ada kandidat siap dinilai.</div>}
            </div>

            <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`Penilaian: ${selected?.student_name}`} footer={<div className="flex justify-end gap-2 w-full"><Button variant="secondary" onClick={() => setSelected(null)}>Batal</Button><Button onClick={submitDecision} className={(decision === 'lulus' || decision === 'accepted') ? 'bg-emerald-600' : 'bg-red-600'}>Simpan Keputusan: {(decision === 'accepted' ? 'LULUS (DITERIMA)' : decision.toUpperCase())}</Button></div>}>
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-2 border rounded bg-slate-50 text-center">
                            <div className="text-xs text-slate-500">Psikotes (Auto)</div>
                            <div className="font-bold text-xl">{selected?.psychotest_result?.final_score || 0}</div>
                        </div>
                        <div className="p-2 border rounded bg-slate-50 text-center">
                            <div className="text-xs text-slate-500">Tes Adab (Auto)</div>
                            <div className="font-bold text-xl">{selected?.psychotest_result?.scores?.adab || 0}</div>
                        </div>
                        <div className="p-2 border rounded bg-slate-50 text-center">
                            <div className="text-xs text-slate-500">Total CBT</div>
                            <div className="font-bold text-xl text-purple-600">{selected?.psychotest_result?.final_score || 0}</div>
                        </div>
                    </div>

                    {/* Hasil Wawancara dari Interview Manager */}
                    <h4 className="font-bold text-sm border-b pb-1 mt-4 flex items-center gap-2">
                        <Medal size={16} className="text-emerald-600" /> Hasil Wawancara
                    </h4>
                    {selected?.interview_result ? (
                        <div className="grid grid-cols-2 gap-3">
                            {/* Wawancara Siswa */}
                            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-emerald-800 text-xs uppercase">Siswa</span>
                                    {selected.interview_result.student_score > 0 && (
                                        <span className={`px-2 py-0.5 rounded-full text-sm font-black ${selected.interview_result.student_score >= 75 ? 'bg-emerald-200 text-emerald-800' :
                                            selected.interview_result.student_score >= 50 ? 'bg-amber-200 text-amber-800' :
                                                'bg-red-200 text-red-800'
                                            }`}>
                                            {selected.interview_result.student_score}
                                        </span>
                                    )}
                                </div>
                                {selected.interview_result.student_interviewer && (
                                    <div className="text-xs text-emerald-600 mb-1">
                                        Pewawancara: <span className="font-bold">{selected.interview_result.student_interviewer}</span>
                                    </div>
                                )}
                                <div className="text-xs text-slate-700 bg-white p-2 rounded border border-emerald-100">
                                    {selected.interview_result.student_notes || <span className="italic text-slate-400">Tidak ada catatan</span>}
                                </div>
                            </div>

                            {/* Wawancara Wali */}
                            <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-purple-800 text-xs uppercase">Wali</span>
                                    {selected.interview_result.parent_score > 0 && (
                                        <span className={`px-2 py-0.5 rounded-full text-sm font-black ${selected.interview_result.parent_score >= 75 ? 'bg-purple-200 text-purple-800' :
                                            selected.interview_result.parent_score >= 50 ? 'bg-amber-200 text-amber-800' :
                                                'bg-red-200 text-red-800'
                                            }`}>
                                            {selected.interview_result.parent_score}
                                        </span>
                                    )}
                                </div>
                                {selected.interview_result.parent_interviewer && (
                                    <div className="text-xs text-purple-600 mb-1">
                                        Pewawancara: <span className="font-bold">{selected.interview_result.parent_interviewer}</span>
                                    </div>
                                )}
                                <div className="text-xs text-slate-700 bg-white p-2 rounded border border-purple-100">
                                    {selected.interview_result.parent_notes || <span className="italic text-slate-400">Tidak ada catatan</span>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-4 rounded-xl text-center text-slate-400 text-sm border border-dashed">
                            Belum ada hasil wawancara. Silakan input melalui menu Manajemen Wawancara.
                        </div>
                    )}

                    {/* Rata-rata Nilai Wawancara */}
                    {selected?.interview_result?.average_score > 0 && (
                        <div className="p-3 bg-gradient-to-r from-emerald-50 to-purple-50 rounded-xl border text-center">
                            <div className="text-xs text-slate-500 uppercase">Rata-rata Nilai Wawancara</div>
                            <div className={`text-3xl font-black mt-1 ${selected.interview_result.average_score >= 75 ? 'text-emerald-600' :
                                selected.interview_result.average_score >= 50 ? 'text-amber-600' :
                                    'text-red-600'
                                }`}>
                                {selected.interview_result.average_score}
                            </div>
                        </div>
                    )}

                    <div className="bg-gradient-to-r from-purple-50 to-white p-4 rounded-xl border border-purple-100 mt-4">
                        <h4 className="font-bold text-purple-900 text-sm mb-2 flex items-center gap-2"><Bot size={16} /> AI Recommendation</h4>
                        {aiAnalysis ? (
                            <p className="text-sm text-slate-700 italic bg-white p-2 rounded border">{aiAnalysis}</p>
                        ) : (
                            <div className="text-center"><Button variant="ai" onClick={handleAiAnalysis} className="text-xs py-1 h-8">Analisis Kelulusan</Button></div>
                        )}
                    </div>

                    <div className="mt-4">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Keputusan Akhir</label>
                        <div className="flex gap-4 mb-4">
                            <div onClick={() => setDecision('accepted')} className={`flex-1 p-3 border-2 rounded-xl cursor-pointer text-center font-bold transition-all ${decision === 'accepted' || decision === 'lulus' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:border-emerald-200'}`}><CheckCircle className="mx-auto mb-1" /> LULUS / DITERIMA</div>
                            <div onClick={() => setDecision('rejected')} className={`flex-1 p-3 border-2 rounded-xl cursor-pointer text-center font-bold transition-all ${decision === 'rejected' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 hover:border-red-200'}`}><XCircle className="mx-auto mb-1" /> TIDAK LULUS</div>
                        </div>
                        <Input label="Catatan Keputusan (Opsional)" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alasan kelulusan/penolakan..." />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
