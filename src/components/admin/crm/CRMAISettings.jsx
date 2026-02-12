import React, { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';
import { Button, Input } from '../../ui/Elements';
import { Modal } from '../../ui/Overlays';
import { Plus, Trash2, FileText, ToggleLeft, ToggleRight, Sparkles, Loader2 } from 'lucide-react';

export default function CRMAISettings({ showToast }) {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);

    // Create new template state
    const [showModal, setShowModal] = useState(false);
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        trigger_keywords: '',
        response_template: '',
        use_ai: false,
        buttons: [] // [{id, text}, ...]
    });

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('ai_templates')
                .select('*')
                .order('priority', { ascending: false });

            if (error) {
                if (error.code !== '42501' && error.code !== 'PGRST301') {
                    console.error('Fetch error:', error);
                }
            } else {
                setTemplates(data || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const [apiKey, setApiKey] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchTemplates();
        fetchApiKey();
    }, []);

    const fetchApiKey = async () => {
        const { data } = await supabase.from('app_settings').select('gemini_api_key').single();
        if (data?.gemini_api_key) setApiKey(data.gemini_api_key);
    };

    const saveApiKey = async () => {
        if (!apiKey) return showToast('API Key tidak boleh kosong', 'error');
        setSaving(true);
        try {
            const { error } = await supabase.from('app_settings').update({ gemini_api_key: apiKey }).eq('id', 'main');
            if (error) throw error;
            showToast('API Key berhasil disimpan');
        } catch (error) {
            console.error(error);
            showToast('Gagal menyimpan API Key', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (id, currentStatus) => {
        setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: !currentStatus } : t));
        try {
            const { error } = await supabase
                .from('ai_templates')
                .update({ is_active: !currentStatus })
                .eq('id', id);
            if (error) throw error;
        } catch (error) {
            setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: currentStatus } : t));
            showToast('Gagal update status', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus template ini?')) return;
        try {
            const { error } = await supabase.from('ai_templates').delete().eq('id', id);
            if (error) throw error;
            setTemplates(prev => prev.filter(t => t.id !== id));
            showToast('Template berhasil dihapus');
        } catch (error) {
            showToast('Gagal menghapus template', 'error');
        }
    };

    const handleSaveTemplate = async () => {
        if (!newTemplate.name || (!newTemplate.response_template && !newTemplate.use_ai)) {
            showToast('Mohon lengkapi data template', 'error');
            return;
        }
        try {
            // Convert buttons to numbered menu format
            let finalResponse = newTemplate.response_template;
            if (newTemplate.buttons.length > 0) {
                // Generate numbered menu from buttons
                const menuItems = newTemplate.buttons.map((btn, i) => {
                    const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i] || `${i + 1}.`;
                    return `${emoji} ${btn.text}`;
                }).join('\n');
                finalResponse = newTemplate.response_template + '\n\n' + menuItems + '\n\nBalas dengan angka untuk memilih.';
            }

            const payload = {
                name: newTemplate.name,
                trigger_keywords: newTemplate.trigger_keywords.split(',').map(k => k.trim()),
                response_template: finalResponse,
                use_ai: newTemplate.use_ai,
                is_active: true,
                priority: 50
            };
            const { data, error } = await supabase.from('ai_templates').insert([payload]).select().single();
            if (error) throw error;
            setTemplates([data, ...templates]);
            setShowModal(false);
            setNewTemplate({ name: '', trigger_keywords: '', response_template: '', use_ai: false, buttons: [] });
            showToast('Template berhasil disimpan');
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        }
    };

    return (
        <div className="animate-fade-in text-slate-800 dark:text-slate-200">
            {/* API Configuration Section */}
            <div className="mb-6 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Sparkles size={100} className="text-indigo-500" />
                </div>

                <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Sparkles className="text-indigo-500" /> Konfigurasi AI
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Gemini API Key</label>
                        <div className="flex gap-2">
                            <Input
                                type="password"
                                placeholder="Paste API Key Gemini disini..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="flex-1 bg-slate-50 border-slate-300 focus:border-indigo-500"
                            />
                            <Button
                                onClick={saveApiKey}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]"
                            >
                                {saving ? <Loader2 className="animate-spin" /> : 'Simpan'}
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Dapatkan API Key di <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-600 underline">Google AI Studio</a>.
                        </p>
                    </div>
                </div>
            </div>
            {/* Templates List */}
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div>
                        <h3 className="font-bold text-xl text-slate-800 dark:text-white">Daftar Template Respons Bot</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Kelola template jawaban otomatis untuk pertanyaan umum calon siswa.</p>
                    </div>
                    <Button size="sm" onClick={() => setShowModal(true)} className="bg-emerald-600 text-white hover:bg-emerald-700">
                        <Plus size={16} className="mr-2" /> Tambah Template
                    </Button>
                </div>

                {loading ? (
                    <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-emerald-500" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {templates.map(tpl => (
                            <div key={tpl.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-lg ${tpl.use_ai ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                            {tpl.use_ai ? <Sparkles size={18} /> : <FileText size={18} />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-white text-sm">{tpl.name}</h4>
                                            {tpl.use_ai && <span className="text-[10px] text-indigo-500 font-bold">AI Generated</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => toggleActive(tpl.id, tpl.is_active)} className={`${tpl.is_active ? 'text-emerald-500' : 'text-slate-300'}`} title={tpl.is_active ? "Nonaktifkan" : "Aktifkan"}>
                                            {tpl.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                        </button>
                                        <button onClick={() => handleDelete(tpl.id)} className="text-slate-400 hover:text-red-500" title="Hapus">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Kata Kunci (Trigger)</span>
                                        <div className="flex flex-wrap gap-1">
                                            {tpl.trigger_keywords && tpl.trigger_keywords.map((k, i) => (
                                                <span key={i} className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs">{k.trim()}</span>
                                            ))}
                                        </div>
                                    </div>

                                    {!tpl.use_ai && (
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-xs text-slate-600 dark:text-slate-400 italic whitespace-pre-wrap max-h-32 overflow-y-auto">
                                            "{tpl.response_template?.split('|||BUTTONS:')[0] || tpl.response_template}"
                                        </div>
                                    )}

                                    {/* Show buttons if embedded in response_template */}
                                    {tpl.response_template?.includes('|||BUTTONS:') && (
                                        <div className="mt-2">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Tombol Menu</span>
                                            <div className="flex flex-wrap gap-1">
                                                {JSON.parse(tpl.response_template.split('|||BUTTONS:')[1] || '[]').map((btn, i) => (
                                                    <span key={i} className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded text-xs font-bold">
                                                        {btn.text}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* KEEP MODAL AS IS MOSTLY */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Tambah Template Baru">
                <div className="space-y-4 text-slate-800 dark:text-slate-200">
                    <Input
                        label="Nama Template"
                        placeholder="Contoh: Jawaban Biaya"
                        value={newTemplate.name}
                        onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    />
                    <Input
                        label="Kata Kunci (pisahkan dengan koma)"
                        placeholder="biaya, harga, bayar, spp"
                        value={newTemplate.trigger_keywords}
                        onChange={e => setNewTemplate({ ...newTemplate, trigger_keywords: e.target.value })}
                    />

                    <div className="flex items-center gap-2 py-2">
                        <input
                            type="checkbox"
                            id="use_ai"
                            checked={newTemplate.use_ai}
                            onChange={e => setNewTemplate({ ...newTemplate, use_ai: e.target.checked })}
                            className="w-4 h-4 text-emerald-600 rounded"
                        />
                        <label htmlFor="use_ai" className="text-sm font-bold flex items-center gap-1">
                            Gunakan AI Generator <Sparkles size={14} className="text-indigo-500" />
                        </label>
                    </div>

                    {!newTemplate.use_ai && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Template Jawaban</label>
                            <textarea
                                rows={5}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="Tulis jawaban otomatis di sini..."
                                value={newTemplate.response_template}
                                onChange={e => setNewTemplate({ ...newTemplate, response_template: e.target.value })}
                            />
                        </div>
                    )}

                    {/* Button Configuration */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Tombol Interaktif (Opsional)</label>
                            {newTemplate.buttons.length < 3 && (
                                <button
                                    type="button"
                                    onClick={() => setNewTemplate({
                                        ...newTemplate,
                                        buttons: [...newTemplate.buttons, { id: `btn_${Date.now()}`, text: '' }]
                                    })}
                                    className="text-xs text-emerald-600 font-bold hover:underline"
                                >
                                    + Tambah Tombol
                                </button>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 mb-2">Akan dikonversi menjadi menu angka (1, 2, 3...) di chat.</p>
                        <div className="space-y-2">
                            {newTemplate.buttons.map((btn, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <Input
                                        placeholder={`Label Tombol ${idx + 1} (cth: SD)`}
                                        value={btn.text}
                                        onChange={e => {
                                            const updated = [...newTemplate.buttons];
                                            updated[idx].text = e.target.value;
                                            setNewTemplate({ ...newTemplate, buttons: updated });
                                        }}
                                        className="flex-1"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const updated = newTemplate.buttons.filter((_, i) => i !== idx);
                                            setNewTemplate({ ...newTemplate, buttons: updated });
                                        }}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-4">
                        <Button variant="secondary" onClick={() => setShowModal(false)}>Batal</Button>
                        <Button onClick={handleSaveTemplate} className="bg-emerald-600 text-white">Simpan Template</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
