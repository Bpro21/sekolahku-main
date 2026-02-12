import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    Timer, Bot, Trash2, Plus, Info
} from 'lucide-react';
import { Card, Button, Input, Select } from '../ui/Elements';
import { Modal, DeleteConfirmModal } from '../ui/Overlays';
import { callGeminiAI } from '../../utils/helpers';

export default function AdminTestSettings({ showToast }) {

    const [activeLevel, setActiveLevel] = useState('SD'); // SD, SMP, SMA, SMK
    const [activeCategoryFilter, setActiveCategoryFilter] = useState('all'); // 'all', 'psychotest', 'adab'
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    const [config, setConfig] = useState({ time_per_question: 60, psychotest_count: 20, adab_count: 20 });
    const [globalSettings, setGlobalSettings] = useState({});
    const [questions, setQuestions] = useState([]);
    const [editingQ, setEditingQ] = useState(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    // Generator State
    const [genCategory, setGenCategory] = useState('psychotest');
    const [genLevel, setGenLevel] = useState('SD');
    const [genReligion, setGenReligion] = useState('General');
    const [genTopic, setGenTopic] = useState('');
    const [genCount, setGenCount] = useState(5);
    const [deleteTarget, setDeleteTarget] = useState(null); // { id, text }

    // Logic Pagination & Filtering
    let filteredQuestions = questions.filter(q => q.level === activeLevel || (!q.level && activeLevel === 'SD'));
    if (activeCategoryFilter !== 'all') {
        filteredQuestions = filteredQuestions.filter(q => q.category === activeCategoryFilter);
    }

    const totalPages = Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE);
    const paginatedQuestions = filteredQuestions.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    useEffect(() => {
        const fetchInitialData = async () => {
            // Config
            const { data: c } = await supabase.from('quiz_config').select('*').eq('id', 'main').single();
            if (c) setConfig(c);

            // App Settings
            const { data: s } = await supabase.from('app_settings').select('*').eq('id', 'main').single();
            if (s) setGlobalSettings(s);

            // Questions
            const { data: q } = await supabase.from('questions').select('*');
            if (q) setQuestions(q);
        };
        fetchInitialData();

        const channel = supabase.channel('admin_test_settings_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_config' }, (payload) => {
                if (payload.new) setConfig(payload.new);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
                if (payload.new) setGlobalSettings(payload.new);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, async () => {
                const { data: q } = await supabase.from('questions').select('*');
                if (q) setQuestions(q);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleSaveConfig = async () => {
        const { error } = await supabase.from('quiz_config').upsert({ id: 'main', ...config });
        if (error) showToast('Gagal menyimpan konfigurasi: ' + error.message, 'error');
        else showToast('Konfigurasi Ujian disimpan');
    };

    const handleGenerateQuestions = async () => {
        if (!globalSettings.gemini_api_key) return alert("API Key Gemini belum diatur di Pengaturan Aplikasi!");
        setIsAiLoading(true);
        try {
            const categoryLabel = genCategory === 'psychotest'
                ? 'Psikotes (Tes Potensi Akademik/Logika)'
                : `Ujian Adab/Akhlak (Konteks Agama: ${genReligion === 'all' ? 'Semua Agama/Universal' : genReligion})`;

            const prompt = `
                Buatkan ${genCount} soal pilihan ganda untuk ${categoryLabel} tingkat ${genLevel}.
                Topik/Tema spesifik: ${genTopic || 'Acak/Umum'}.
                
                Instruksi Penting:
                1. Output HANYA valid JSON Array. JANGAN ada markdown code block (seperti \`\`\`json).
                2. Field "category" HARUS bernilai persis "${genCategory}".
                3. Field "religion" isi "${genReligion}" (atau "General" jika soal bersifat universal). JIKA context agama 'all', buat soal universal.
                
                Format JSON per item: 
                { 
                    "text": "Pertanyaan", 
                    "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"], 
                    "correct": "Teks Jawaban Benar (harus sama persis dengan salah satu opsi)", 
                    "category": "${genCategory}", 
                    "religion": "${genReligion}" 
                }
            `;

            let res = await callGeminiAI(globalSettings.gemini_api_key, prompt);

            // Clean markdown if AI insists on using it
            if (res.includes('```json')) {
                res = res.split('```json')[1].split('```')[0].trim();
            } else if (res.includes('```')) {
                res = res.split('```')[1].split('```')[0].trim();
            }

            const parsed = JSON.parse(res);

            if (Array.isArray(parsed)) {
                let count = 0;
                const questionsToInsert = parsed.map(q => ({
                    ...q,
                    category: genCategory,
                    level: genLevel,
                    created_at: new Date().toISOString()
                }));

                const { error } = await supabase.from('questions').insert(questionsToInsert);

                if (error) throw error;

                showToast(`Berhasil generate & simpan ${parsed.length} soal ${genCategory === 'psychotest' ? 'Psikotes' : 'Adab'}!`);
            } else {
                throw new Error("AI output not an array");
            }
        } catch (e) { console.error(e); showToast("Gagal generate soal: " + e.message, 'error'); } finally { setIsAiLoading(false); }
    };

    const handleSaveQuestion = async () => {
        try {
            if (editingQ.id) {
                const { id, ...data } = editingQ;
                const { error } = await supabase.from('questions').update(data).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('questions').insert(editingQ);
                if (error) throw error;
            }
            showToast('Soal tersimpan'); setEditingQ(null);
        } catch (e) { showToast(e.message, 'error'); }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Timer className="text-emerald-600" /> Pengaturan Ujian (CBT & AI)</h2>
            {/* 1. Parameter Ujian (Merged) */}
            <Card className="p-6 border-emerald-100 bg-emerald-50/10">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-800">Parameter & Konfigurasi Ujian</h3>
                    <Button onClick={handleSaveConfig} className="text-xs shadow-lg shadow-emerald-200">Simpan Konfigurasi</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Input label="Waktu Per Soal (detik)" type="number" value={config.time_per_question} onChange={e => setConfig({ ...config, time_per_question: parseInt(e.target.value) || 0 })} />
                    <Input label="Jml Soal Psikotes" type="number" value={config.psychotest_count} onChange={e => setConfig({ ...config, psychotest_count: parseInt(e.target.value) || 0 })} />
                    <Input label="Jml Soal Adab" type="number" value={config.adab_count} onChange={e => setConfig({ ...config, adab_count: parseInt(e.target.value) || 0 })} />
                </div>
                <p className="text-xs text-slate-400 mt-3 italic">*Konfigurasi ini berlaku global untuk sesi ujian siswa (CBT).</p>
            </Card>

            {/* 2. Bank Soal Content */}
            <div className="mt-8 pt-6 border-t border-slate-200">
                <div className="space-y-6 animate-fade-in">

                    {/* Level & Category Filters */}
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex gap-2 bg-slate-100 p-1 rounded-full w-fit">
                            {['SD', 'SMP', 'SMA', 'SMK'].map(lvl => (
                                <button
                                    key={lvl}
                                    onClick={() => { setActiveLevel(lvl); setPage(1); }}
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeLevel === lvl ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                                >
                                    {lvl}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 bg-slate-100 p-1 rounded-full w-fit">
                            {[
                                { id: 'all', label: 'Semua Kategori' },
                                { id: 'psychotest', label: 'Psikotes' },
                                { id: 'adab', label: 'Adab & Akhlak' }
                            ].map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => { setActiveCategoryFilter(cat.id); setPage(1); }}
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeCategoryFilter === cat.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* AI Generator */}
                    <Card className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100">
                        <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2"><Bot size={18} /> AI Soal Generator</h3>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Jenjang</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={genLevel}
                                    onChange={e => setGenLevel(e.target.value)}
                                >
                                    {['SD', 'SMP', 'SMA', 'SMK'].map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Jenis Soal</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={genCategory}
                                    onChange={e => setGenCategory(e.target.value)}
                                >
                                    <option value="psychotest">Psikotes (Logika/TPA)</option>
                                    <option value="adab">Tes Adab & Akhlak</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Konteks Agama</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={genReligion}
                                    onChange={e => setGenReligion(e.target.value)}
                                    disabled={genCategory === 'psychotest'}
                                >
                                    <option value="General">Umum / General</option>
                                    <option value="Islam">Islam</option>
                                    <option value="Kristen">Kristen</option>
                                    <option value="Katolik">Katolik</option>
                                    <option value="Hindu">Hindu</option>
                                    <option value="Buddha">Buddha</option>
                                    <option value="Konghucu">Konghucu</option>
                                    <option value="all">Semua Agama</option>
                                </select>
                            </div>

                            <div className="md:col-span-4">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Topik Spesifik (Opsional)</label>
                                <input
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={genTopic}
                                    onChange={e => setGenTopic(e.target.value)}
                                    placeholder={genCategory === 'psychotest' ? "Contoh: Deret Angka, Analogi Kata" : "Contoh: Adab Makan"}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Jumlah</label>
                                <input
                                    type="number"
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={genCount}
                                    onChange={e => setGenCount(parseInt(e.target.value))}
                                    min={1} max={20}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Button variant="ai" className="w-full justify-center" onClick={handleGenerateQuestions} disabled={isAiLoading}>
                                    {isAiLoading ? 'Memproses...' : 'Generate AI'}
                                </Button>
                            </div>
                        </div>
                        <p className="text-[10px] text-indigo-400 mt-2 italic">*AI akan membuatkan soal pilihan ganda beserta kunci jawabannya secara otomatis.</p>
                    </Card>

                    {/* Question List */}
                    <div className="flex justify-between items-center bg-white p-4 rounded-lg border">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-700">Daftar Soal {activeLevel}</h3>
                            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-bold">{filteredQuestions.length} Soal</span>
                        </div>
                        <Button onClick={() => setEditingQ({ text: '', options: ['', '', '', ''], correct: '', category: 'psychotest', religion: 'General', level: activeLevel })} className="text-xs"><Plus size={14} /> Buat Soal Manual</Button>
                    </div>

                    <div className="grid gap-3">
                        {paginatedQuestions.map((q, idx) => (
                            <div key={q.id} className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow relative group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${q.category === 'psychotest' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{q.category}</span>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingQ(q)} className="text-blue-500 text-xs font-bold hover:underline">Edit</button>
                                        <button onClick={() => setDeleteTarget({ id: q.id, text: q.text?.substring(0, 50) + '...' })} className="text-red-500 text-xs font-bold hover:underline">Hapus</button>
                                    </div>
                                </div>
                                <p className="font-medium text-slate-800 mb-2">{q.text}</p>
                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                                    {q.options?.map((opt, i) => (<div key={i} className={opt === q.correct ? 'font-bold text-green-600' : ''}>{String.fromCharCode(65 + i)}. {opt}</div>))}
                                </div>
                            </div>
                        ))}
                        {paginatedQuestions.length === 0 && (
                            <div className="text-center p-8 text-slate-400 border border-dashed rounded-lg">
                                Belum ada soal untuk kategori ini.
                            </div>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                Sebelumnya
                            </Button>
                            <span className="flex items-center text-sm font-bold text-slate-500">
                                Halaman {page} dari {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >
                                Selanjutnya
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL EDIT QUESTION */}
            <Modal isOpen={!!editingQ} onClose={() => setEditingQ(null)} title="Editor Soal" footer={<div className="flex justify-end gap-2 w-full"><Button variant="secondary" onClick={() => setEditingQ(null)}>Batal</Button><Button onClick={handleSaveQuestion}>Simpan Soal</Button></div>}>
                {editingQ && (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-2 gap-4">
                            <Select label="Jenjang" value={editingQ.level || 'SD'} onChange={e => setEditingQ({ ...editingQ, level: e.target.value })} options={[{ value: 'SD' }, { value: 'SMP' }, { value: 'SMA' }, { value: 'SMK' }]} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Select label="Kategori" value={editingQ.category} onChange={e => setEditingQ({ ...editingQ, category: e.target.value })} options={[{ value: 'psychotest' }, { value: 'adab' }]} />
                            <Select label="Agama (Khusus Adab)" value={editingQ.religion} onChange={e => setEditingQ({ ...editingQ, religion: e.target.value })} options={[{ value: 'General', label: 'Umum' }, { value: 'Islam' }, { value: 'Kristen' }, { value: 'all', label: 'Semua Agama' }]} />
                        </div>
                        <div className="mb-2">
                            <label className="block text-sm font-bold text-slate-700 mb-1">Pertanyaan</label>
                            <textarea className="w-full border rounded p-2 text-sm" rows={3} value={editingQ.text} onChange={e => setEditingQ({ ...editingQ, text: e.target.value })}></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Pilihan Jawaban & Kunci</label>
                            <div className="space-y-2">
                                {editingQ.options && editingQ.options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className="font-bold text-slate-400 w-6">{String.fromCharCode(65 + idx)}.</span>
                                        <input className={`flex-1 border rounded px-3 py-2 text-sm ${editingQ.correct === opt && opt !== '' ? 'ring-2 ring-green-500 border-green-500 bg-green-50' : ''}`} value={opt} onChange={e => { const newOpt = [...editingQ.options]; newOpt[idx] = e.target.value; setEditingQ({ ...editingQ, options: newOpt }); }} placeholder={`Pilihan ${String.fromCharCode(65 + idx)}`} />
                                        <input type="radio" name="correctAnswer" checked={editingQ.correct === opt && opt !== ''} onChange={() => setEditingQ({ ...editingQ, correct: opt })} className="cursor-pointer" title="Tandai sebagai jawaban benar" />
                                    </div>
                                ))}
                                <p className="text-xs text-slate-500">*Klik radio button di kanan untuk memilih kunci jawaban.</p>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* DELETE CONFIRMATION MODAL */}
            <DeleteConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={async () => {
                    const { error } = await supabase.from('questions').delete().eq('id', deleteTarget.id);
                    if (error) {
                        showToast('Gagal menghapus soal', 'error');
                    } else {
                        showToast('Soal berhasil dihapus');
                    }
                    setDeleteTarget(null);
                }}
                itemName={deleteTarget?.text}
                itemType="Soal"
                showToast={showToast}
            />
        </div >
    );
}
