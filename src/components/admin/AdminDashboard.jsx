import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../config/supabase';
import {
    LayoutDashboard, TrendingUp, Users, DollarSign, Target, Bot, Send, Sparkles, Building, Briefcase,
    FileText, CheckCircle, XCircle, Clock, AlertTriangle, AlertCircle, UserCheck, User
} from 'lucide-react';
import { Card, Button } from '../ui/Elements';
import { callGeminiAI } from '../../utils/helpers';
import PSBStatistik from './PSBStatistik';

export default function AdminDashboard() {
    const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, passed: 0, revenue: 0 });
    const [detailedStats, setDetailedStats] = useState({
        docs: { incomplete: 0, checking: 0, valid: 0, invalid: 0 },
        tests: { adab: { done: 0, pending: 0 }, psiko: { done: 0, pending: 0 }, parent: { done: 0, pending: 0 }, student: { done: 0, pending: 0 } },
        final: { passed: 0, failed: 0, pending: 0 }
    });
    const [registrations, setRegistrations] = useState([]);
    const [allRegistrations, setAllRegistrations] = useState([]); // Raw unfiltered data
    const [allInvoices, setAllInvoices] = useState([]); // Raw unfiltered invoices
    const [allWaves, setAllWaves] = useState([]); // All waves for ID mapping
    const [chartData, setChartData] = useState([]);
    const [filter, setFilter] = useState({
        mode: 'daily', // daily, weekly, monthly
        start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [branches, setBranches] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [filterYear, setFilterYear] = useState('all');
    const [chatOpen, setChatOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', text: 'Halo! Saya AI Advisor data PPDB Anda. Ada yang bisa saya bantu analisis hari ini?' }
    ]);
    const [inputMsg, setInputMsg] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [config, setConfig] = useState({});
    const [settings, setSettings] = useState(null);
    const chatEndRef = useRef(null);

    // Initial Data Fetch
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // 1. Academic Years
                const { data: ayData } = await supabase.from('academic_years').select('*');
                if (ayData) {
                    setAcademicYears(ayData);
                    const defaultYear = ayData.find(y => y.is_default);
                    if (defaultYear && filterYear === 'all') {
                        setFilterYear(defaultYear.year);
                    }
                }

                // 2. Waves
                const { data: wData } = await supabase.from('waves').select('*');
                if (wData) setAllWaves(wData);

                // 3. Units
                const { data: uData } = await supabase.from('units').select('*');
                if (uData) setBranches(uData);

                // 4. Registrations
                const { data: rData } = await supabase.from('registrations').select('*');
                if (rData) setAllRegistrations(rData);

                // 5. Invoices
                const { data: iData } = await supabase.from('invoices').select('*');
                if (iData) setAllInvoices(iData);

                // 6. Settings & Config
                const { data: sData } = await supabase.from('app_settings').select('*').eq('id', 'main').single();
                if (sData) {
                    setSettings(sData);
                    // Map legacy quiz_config if it exists in JSON or a new column
                    if (sData.quiz_config) setConfig(sData.quiz_config);
                }

            } catch (error) {
                console.error("Dashboard Data Fetch Error:", error);
            }
        };

        fetchInitialData();

        // Realtime Subscription
        const channel = supabase.channel('admin_dashboard_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, (payload) => {
                // Refresh or Optimistically Update. For Dashboard, full refresh is safest for now.
                fetchInitialData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => { fetchInitialData(); })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Effect to filter and calculate stats based on selected year
    useEffect(() => {
        // Filter data based on selected year
        const data = filterYear === 'all'
            ? allRegistrations
            : allRegistrations.filter(d => {
                // 1. Check if academic_year field exists (future proofing)
                if (d.academic_year === filterYear) return true;

                // 2. Map via wave_id (Robust)
                if (d.wave_id) {
                    const wave = allWaves.find(w => w.id === d.wave_id);
                    if (wave && wave.year === filterYear) return true;
                }

                // 3. String match on wave_name (Fallback for current data)
                return d.wave_name?.includes(filterYear);
            });

        // Helper for "Lulus" (Calculates passed or paid/daftar ulang)
        const isLulus = (s) => ['lulus', 'paid'].includes(s);

        // Basic Stats Counts
        const pendingCount = data.filter(d => ['submitted', 'verifying_payment'].includes(d.status)).length;
        const verifiedCount = data.filter(d => !['draft', 'submitted', 'verifying_payment', 'document_revision', 'rejected', 'mengundurkan_diri'].includes(d.status)).length;
        const passedCount = data.filter(d => isLulus(d.status)).length;

        // Calculate Revenue specific to the filtered data/year
        const filteredInvoices = allInvoices.filter(inv => {
            if (inv.status !== 'paid') return false;

            // If invoice has explicit AY match
            if (filterYear !== 'all' && inv.academic_year && inv.academic_year === filterYear) return true;
            if (filterYear === 'all') return true;

            // Otherwise, check if invoice belongs to a filtered registration
            const linkedReg = data.find(r => r.id === inv.registration_id);
            return !!linkedReg;
        });
        const totalRev = filteredInvoices.reduce((acc, curr) => acc + (curr.amount || 0), 0);

        setStats({
            total: data.length,
            pending: pendingCount,
            verified: verifiedCount,
            passed: passedCount,
            revenue: totalRev
        });

        // Detailed Stats Calculation
        const docStats = {
            incomplete: data.filter(d => d.status === 'draft').length,
            checking: data.filter(d => ['submitted', 'verifying_payment'].includes(d.status)).length,
            valid: verifiedCount, // verified and beyond
            invalid: data.filter(d => d.status === 'document_revision').length
        };

        const testStats = {
            adab: {
                done: data.filter(d => d.psychotest_result?.scores?.adab || d.final_scores?.adab).length,
                pending: data.length - data.filter(d => d.psychotest_result?.scores?.adab || d.final_scores?.adab).length
            },
            psiko: {
                done: data.filter(d => d.psychotest_result).length,
                pending: data.length - data.filter(d => d.psychotest_result).length
            },
            parent: {
                done: data.filter(d => d.final_scores?.interview).length,
                pending: data.filter(d => !d.final_scores?.interview && !['rejected', 'mengundurkan_diri', 'draft'].includes(d.status)).length
            },
            student: {
                done: data.filter(d => d.final_scores?.quran || d.final_scores?.academic).length,
                pending: data.filter(d => !(d.final_scores?.quran || d.final_scores?.academic) && !['rejected', 'mengundurkan_diri', 'draft'].includes(d.status)).length
            }
        };

        const finalStats = {
            passed: passedCount,
            failed: data.filter(d => d.status === 'rejected').length,
            withdrawn: data.filter(d => d.status === 'mengundurkan_diri').length,
            pending: data.filter(d => !['lulus', 'paid', 'rejected', 'mengundurkan_diri'].includes(d.status)).length,
            interview_pending: data.filter(d => !d.final_scores?.interview && !['draft', 'rejected', 'mengundurkan_diri', 'lulus', 'paid'].includes(d.status)).length
        };

        setDetailedStats({ docs: docStats, tests: testStats, final: finalStats });

        // Save filtered data for chart processing
        setRegistrations(data);
    }, [allRegistrations, filterYear, allInvoices, allWaves]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputMsg.trim()) return;
        if (!settings?.gemini_api_key) return alert("API Key Gemini belum diatur di menu Pengaturan Aplikasi → Setup API.");

        const userText = inputMsg;
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setInputMsg('');
        setIsTyping(true);

        try {
            // Build Context (Re-using logic)
            // Need to calculate dailyData for context if needed, or just use stats.
            const contextPrompt = `
                Anda adalah AI Advisor untuk Sistem PPDB Sekolah. 
                Data Realtime Sekolah saat ini:
                - Total Pendaftar: ${stats.total}
                - Menunggu Verifikasi: ${stats.pending}
                - Sudah Verifikasi/Test: ${stats.verified}
                - Lulus: ${stats.passed}
                - Estimasi Revenue: Rp ${stats.revenue.toLocaleString()}
                
                Jawab pertanyaan user berdasarkan data ini. Berikan jawaban singkat, padat, dan strategis.
                Pertanyaan User: "${userText}"
            `;

            const result = await callGeminiAI(settings.gemini_api_key, contextPrompt);
            setMessages(prev => [...prev, { role: 'assistant', text: result }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', text: "Maaf, terjadi kesalahan koneksi ke AI." }]);
        } finally {
            setIsTyping(false);
        }
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, chatOpen]);

    // Chart Processing Effect
    useEffect(() => {
        const data = [];
        const start = new Date(filter.start);
        const end = new Date(filter.end);

        let current = new Date(start);
        let loops = 0;

        while (current <= end && loops < 1000) {
            let label = '';
            let key = '';
            let count = 0;

            if (filter.mode === 'daily') {
                key = current.toISOString().split('T')[0];
                label = current.toLocaleDateString('id', { day: 'numeric', month: 'short' });

                count = registrations.filter(r => {
                    const rDate = r.created_at ? new Date(r.created_at) : null;
                    return rDate && rDate.toISOString().startsWith(key);
                }).length;

                current.setDate(current.getDate() + 1);
            } else {
                const m = current.getMonth();
                const y = current.getFullYear();
                key = `${y}-${String(m + 1).padStart(2, '0')}`;
                label = current.toLocaleDateString('id', { month: 'short', year: '2-digit' });

                count = registrations.filter(r => {
                    const rDate = r.created_at ? new Date(r.created_at) : null;
                    return rDate && rDate.getMonth() === m && rDate.getFullYear() === y;
                }).length;

                current.setMonth(current.getMonth() + 1);
            }
            data.push({ label, count, fullDate: key });
            loops++;
        }
        setChartData(data);
    }, [registrations, filter]);

    // Calculate dynamic total quota based on filtered year for stats
    const activeAY = academicYears.find(ay => ay.year === filterYear);
    const activeAyId = activeAY?.id;
    const totalCurrentQuota = branches.reduce((acc, u) => {
        let q = parseInt(u.quota) || 0;
        if (activeAyId && u.academic_configs && u.academic_configs[activeAyId]) {
            q = parseInt(u.academic_configs[activeAyId].quota) || 0;
        }
        return acc + q;
    }, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white transition-colors">Executive Dashboard</h2>
                    <p className="text-slate-500 dark:text-slate-300 text-sm">Overview performa PPDB Realtime</p>
                </div>
                {/* Year Filter */}
                <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <div className="text-emerald-600 dark:text-emerald-400">
                        <Target size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wide">Tahun Akademik</span>
                        <select
                            className="bg-transparent text-emerald-800 dark:text-emerald-200 font-bold text-sm outline-none cursor-pointer -mt-0.5"
                            value={filterYear}
                            onChange={e => setFilterYear(e.target.value)}
                        >
                            <option value="all" className="dark:bg-slate-900">Semua Tahun</option>
                            {academicYears.map(ay => (
                                <option key={ay.id} value={ay.year} className="dark:bg-slate-900">
                                    {ay.year} {ay.is_default ? '★' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
            {/* Floating Chat Widget */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 print:hidden">
                {chatOpen && (
                    <div className="bg-white w-80 md:w-96 rounded-2xl shadow-2xl border border-slate-200 flex flex-col animate-slide-up" style={{ maxHeight: '500px', height: '500px' }}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 rounded-t-2xl flex justify-between items-center text-white shadow-md">
                            <div className="flex items-center gap-2">
                                <div className="bg-white/20 p-2 rounded-full"><Bot size={20} /></div>
                                <div>
                                    <h4 className="font-bold text-sm">AI Strategic Advisor</h4>
                                    <div className="flex items-center gap-1 text-[10px] opacity-80"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> Online</div>
                                </div>
                            </div>
                            <button onClick={() => setChatOpen(false)} className="hover:bg-white/20 p-1 rounded transition"><Send className="rotate-90" size={16} /></button>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                            {messages.map((m, idx) => (
                                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-700 rounded-bl-none border border-slate-200'}`}>
                                        {m.role === 'assistant' ? <div dangerouslySetInnerHTML={{ __html: m.text }} /> : m.text}
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-slate-200 text-slate-500 text-xs italic flex items-center gap-1">
                                        <Sparkles size={12} className="animate-spin" /> Menulis...
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 rounded-b-2xl flex gap-2">
                            <input
                                className="flex-1 px-4 py-2 bg-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                placeholder="Tanya tentang data pendaftaran..."
                                value={inputMsg}
                                onChange={e => setInputMsg(e.target.value)}
                            />
                            <button type="submit" disabled={!inputMsg.trim() || isTyping} className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md transition-all">
                                <Send size={18} />
                            </button>
                        </form>
                    </div>
                )}

                <button onClick={() => setChatOpen(!chatOpen)} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all duration-300 group relative">
                    {chatOpen ? <Send className="rotate-90" size={24} /> : <Bot size={28} className="animate-bounce-slow" />}
                    {!chatOpen && <span className="absolute right-0 top-0 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
                    <div className="absolute right-full mr-4 top-1/2 transform -translate-y-1/2 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Ask AI Advisor</div>
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-6 border-l-4 border-l-blue-500 flex items-center justify-between">
                    <div><p className="text-slate-500 dark:text-slate-300 text-xs font-bold uppercase">Total Pendaftar</p><h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{stats.total}</h3></div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full"><Users size={24} /></div>
                </Card>
                <Card className="p-6 border-l-4 border-l-amber-500 flex items-center justify-between">
                    <div><p className="text-slate-500 dark:text-slate-300 text-xs font-bold uppercase">Perlu Tindakan</p><h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{stats.pending}</h3></div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full"><TrendingUp size={24} /></div>
                </Card>
                <Card className="p-6 border-l-4 border-l-emerald-500 flex items-center justify-between">
                    <div><p className="text-slate-500 dark:text-slate-300 text-xs font-bold uppercase">Total Revenue</p><h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{(stats.revenue / 1000000).toFixed(1)} Jt</h3></div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full"><DollarSign size={24} /></div>
                </Card>
                <Card className="p-6 border-l-4 border-l-purple-500 flex items-center justify-between">
                    <div><p className="text-slate-500 dark:text-slate-300 text-xs font-bold uppercase">Target Tercapai</p><h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{Math.round((stats.verified / (totalCurrentQuota || 1)) * 100)}%</h3></div>
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full"><Target size={24} /></div>
                </Card>
            </div>

            {/* PSB Statistics (Lulus/Accepted) */}
            <PSBStatistik registrations={allRegistrations} branches={branches} />

            {/* Detailed Stats Section (New) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Document Stats */}
                <Card className="p-6 h-full flex flex-col">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 transition-colors shrink-0">Statistik Cek Berkas</h3>
                    <div className="flex-1 flex flex-col justify-between gap-4">
                        <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-lg">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{detailedStats.docs.incomplete} Orang</span>
                            <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">Belum Lengkap <Send size={10} className="transform rotate-45" /></span>
                        </div>
                        <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-lg">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{detailedStats.docs.checking} Orang</span>
                            <span className="bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">Proses Cek <Send size={10} className="transform rotate-45" /></span>
                        </div>
                        <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-lg">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{detailedStats.docs.valid} Orang</span>
                            <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">Valid <Send size={10} className="transform rotate-45" /></span>
                        </div>
                        <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-lg">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{detailedStats.docs.invalid} Orang</span>
                            <span className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">Tidak Valid <Send size={10} className="transform rotate-45" /></span>
                        </div>
                    </div>
                </Card>

                {/* 2. Test Execution Stats */}
                <Card className="p-6 h-full flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 shrink-0">Statistik Pelaksanaan Tes</h3>
                    <div className="flex-1 flex flex-col justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-orange-50 p-2 rounded-lg text-orange-500"><AlertTriangle size={20} /></div>
                            <div className="flex-1">
                                <h5 className="font-bold text-sm text-slate-700">Adab dan Ibadah</h5>
                                <div className="text-[10px] text-slate-500 flex gap-2">
                                    <span>Belum: {detailedStats.tests.adab.pending}</span>
                                    <span className="border-l pl-2">Sudah: {detailedStats.tests.adab.done}</span>
                                </div>
                            </div>
                            <div className="text-orange-300"><Send size={16} className="rotate-45" /></div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="bg-red-50 p-2 rounded-lg text-red-500"><Sparkles size={20} /></div>
                            <div className="flex-1">
                                <h5 className="font-bold text-sm text-slate-700">Psikotes</h5>
                                <div className="text-[10px] text-slate-500 flex gap-2">
                                    <span>Belum: {detailedStats.tests.psiko.pending}</span>
                                    <span className="border-l pl-2">Sudah: {detailedStats.tests.psiko.done}</span>
                                </div>
                            </div>
                            <div className="text-red-300"><Send size={16} className="rotate-45" /></div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="bg-emerald-50 p-2 rounded-lg text-emerald-500"><Users size={20} /></div>
                            <div className="flex-1">
                                <h5 className="font-bold text-sm text-slate-700">Wawancara Wali</h5>
                                <div className="text-[10px] text-slate-500 flex gap-2">
                                    <span>Belum: {detailedStats.tests.parent.pending}</span>
                                    <span className="border-l pl-2">Sudah: {detailedStats.tests.parent.done}</span>
                                </div>
                            </div>
                            <div className="text-emerald-300"><Send size={16} className="rotate-45" /></div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="bg-cyan-50 p-2 rounded-lg text-cyan-500"><User size={20} /></div>
                            <div className="flex-1">
                                <h5 className="font-bold text-sm text-slate-700">Wawancara Siswa</h5>
                                <div className="text-[10px] text-slate-500 flex gap-2">
                                    <span>Belum: {detailedStats.tests.student.pending}</span>
                                    <span className="border-l pl-2">Sudah: {detailedStats.tests.student.done}</span>
                                </div>
                            </div>
                            <div className="text-cyan-300"><Send size={16} className="rotate-45" /></div>
                        </div>
                    </div>
                </Card>

                {/* 3. Final Results */}
                <Card className="relative overflow-hidden h-full flex flex-col">
                    {/* Background Header */}
                    <div className="h-24 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700"></div>
                    {/* Content */}
                    <div className="px-6 pb-6 text-center -mt-10 flex-1 flex flex-col">
                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full p-1 mx-auto shadow-lg mb-3">
                            <div className="w-full h-full bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold text-2xl overflow-hidden">
                                {settings?.app_logo ? (
                                    <img src={settings.app_logo} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <span>{Math.round((detailedStats.final.passed / (stats.total || 1)) * 100)}%</span>
                                )}
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white transition-colors">Hasil Akhir PPDB</h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 font-medium uppercase tracking-wide">Status Kelulusan Siswa</p>

                        <div className="grid grid-cols-3 gap-2 text-center mb-6">
                            <div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Lulus</div>
                                <div className="text-xl font-bold text-emerald-600">{detailedStats.final.passed}</div>
                            </div>
                            <div className="border-l border-slate-100">
                                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Gagal</div>
                                <div className="text-xl font-bold text-red-500">{detailedStats.final.failed}</div>
                            </div>
                            <div className="border-l border-slate-100">
                                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Mundur</div>
                                <div className="text-xl font-bold text-slate-500">{detailedStats.final.withdrawn}</div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 mb-4 transition-colors">
                            <div className="text-left">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-300 block">Belum Tes / Penilaian</span>
                                <span className="text-lg font-bold text-slate-700 dark:text-slate-200">{detailedStats.final.pending} <span className="text-xs font-normal text-slate-400">Siswa</span></span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-300 block">Belum Wawancara</span>
                                <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{detailedStats.final.interview_pending} <span className="text-xs font-normal text-slate-400">Siswa</span></span>
                            </div>
                        </div>

                        <Button className="w-full bg-blue-600 hover:bg-blue-700 mt-auto">Lihat Laporan Lengkap</Button>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Chart Section */}
                <Card className="md:col-span-2 p-6 h-full">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <TrendingUp size={20} className="text-emerald-600" /> Tren Pendaftaran
                        </h3>

                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                            <select
                                value={filter.mode}
                                onChange={e => setFilter(prev => ({ ...prev, mode: e.target.value }))}
                                className="text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded px-2 py-1.5 focus:outline-emerald-500"
                            >
                                <option value="daily">Harian</option>
                                <option value="monthly">Bulanan</option>
                            </select>
                            <div className="h-4 w-px bg-slate-300 mx-1"></div>
                            <input
                                type="date"
                                value={filter.start}
                                onChange={e => setFilter(prev => ({ ...prev, start: e.target.value }))}
                                className="text-xs text-slate-600 bg-white border border-slate-200 rounded px-2 py-1.5 focus:outline-emerald-500"
                            />
                            <span className="text-slate-400 text-xs">-</span>
                            <input
                                type="date"
                                value={filter.end}
                                onChange={e => setFilter(prev => ({ ...prev, end: e.target.value }))}
                                className="text-xs text-slate-600 bg-white border border-slate-200 rounded px-2 py-1.5 focus:outline-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto pb-2 scrollbar-hide">
                        <div className="flex items-end justify-between h-48 gap-2" style={{ minWidth: Math.max(chartData.length * 40, 300) + 'px' }}>
                            {chartData.length === 0 && <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm italic">Tidak ada data di periode ini</div>}
                            {chartData.map((d, idx) => (
                                <div key={idx} className="w-full flex-1 flex flex-col items-center gap-2 group min-w-[30px]">
                                    <div className="relative w-full flex justify-end flex-col items-center h-full">
                                        <div className="w-full max-w-[40px] bg-emerald-100 rounded-t-lg transition-all duration-500 group-hover:bg-emerald-200 relative" style={{ height: `${Math.max(d.count * 5, 2)}%`, maxHeight: '100%' }}>
                                            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-[10px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap">
                                                {d.count} Pendaftar
                                                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{d.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                {/* Unit Targets */}
                <Card className="p-6 h-full flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 shrink-0"><Target size={20} className="text-orange-500" /> Target Kuota Cabang</h3>
                    <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                        {branches.map(u => {
                            // Find corresponding academic year ID to get the correct quota config
                            const selectedAY = academicYears.find(ay => ay.year === filterYear);
                            const ayId = selectedAY?.id;

                            // Determine cap (quota) from academic config if available for the filtered year
                            let cap = parseInt(u.quota) || 0;
                            if (ayId && u.academic_configs && u.academic_configs[ayId]) {
                                cap = parseInt(u.academic_configs[ayId].quota) || 0;
                            }

                            // Calculate filled from actual filtered registrations
                            // registrations state is already filtered by year in the useEffect
                            const unitRegs = registrations.filter(r => r.unit_id === u.id && !['draft', 'rejected', 'mengundurkan_diri'].includes(r.status));
                            const fill = unitRegs.length;

                            const pct = cap > 0 ? Math.min((fill / cap) * 100, 100) : 0;
                            return (
                                <div key={u.id}>
                                    <div className="flex justify-between text-xs mb-1 font-bold text-slate-700 dark:text-slate-300"><span>{u.name}</span><span>{fill}/{cap}</span></div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-2 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${pct > 90 ? 'bg-emerald-500' : (pct > 50 ? 'bg-blue-500' : 'bg-orange-500')}`} style={{ width: `${pct}%` }}></div></div>
                                </div>
                            )
                        })}
                    </div>
                </Card>
            </div>
        </div>
    );
}
