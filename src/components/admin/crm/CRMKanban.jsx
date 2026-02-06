import React, { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';
import { Card, Button, Input } from '../../ui/Elements';
import { Modal } from '../../ui/Overlays';
import { Plus, MoreHorizontal, Phone, Calendar, ArrowRight, User, Loader2, Trash2, Search, BarChart2, CheckCircle, XCircle, Tag, FileText, Download } from 'lucide-react';

const PIPELINE_STAGES = [
    { id: 'followup', label: 'Follow Up', color: 'blue' },
    { id: 'biodata', label: 'Isi Biodata', color: 'cyan' },
    { id: 'bayar_daftar', label: 'Bayar Daftar', color: 'amber' },
    { id: 'berkas', label: 'Kelengkapan Berkas', color: 'orange' },
    { id: 'test', label: 'Test', color: 'purple' },
    { id: 'wawancara', label: 'Wawancara', color: 'indigo' },
    { id: 'daftar_ulang', label: 'Daftar Ulang', color: 'pink' },
    { id: 'lunas', label: 'Lunas', color: 'emerald' },
    { id: 'termin', label: 'Cicilan/Termin', color: 'teal' },
    { id: 'lost', label: 'Batal / Lost', color: 'slate' }
];

export default function CRMKanban({ showToast }) {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // View State
    const [mainTab, setMainTab] = useState('kanban'); // 'kanban' | 'report'
    const [reportSubTab, setReportSubTab] = useState('summary'); // 'summary' | 'detail'

    const [availableTags, setAvailableTags] = useState(["Hot", "Warm", "Cold", "New", "Follow Up"]); // Default fallback
    const [adminList, setAdminList] = useState([]); // List of admins for assignment
    const [settingsLoading, setSettingsLoading] = useState(true);

    const [showTagsModal, setShowTagsModal] = useState(false);
    const [tagInput, setTagInput] = useState('');

    // Add Lead State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newLead, setNewLead] = useState({ name: '', phone: '', source: 'Website', notes: '', assigned_to: '' });
    const [submitting, setSubmitting] = useState(false);

    // Delete Lead State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [leadToDelete, setLeadToDelete] = useState(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');

    // Edit Lead State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingLead, setEditingLead] = useState(null);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLeads(data || []);
        } catch (error) {
            console.error('Error fetching leads:', error);
            showToast('Gagal memuat data leads', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase.from('app_settings').select('crm_config, admins').single();
            if (data?.crm_config?.tags) {
                setAvailableTags(data.crm_config.tags);
            }
            if (data?.admins) {
                // Ensure admins is an array
                const admins = Array.isArray(data.admins) ? data.admins : [];
                setAdminList(admins);
            }
        } catch (error) {
            console.log("Using default tags/admins");
        } finally {
            setSettingsLoading(false);
        }
    };



    const moveLead = async (leadId, newStatus) => {
        const prevLeads = [...leads];
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));

        try {
            const { error } = await supabase
                .from('leads')
                .update({ status: newStatus, updated_at: new Date() })
                .eq('id', leadId);

            if (error) throw error;
            showToast(`Status berhasil diupdate`);
        } catch (error) {
            console.error('Error updating lead:', error);
            setLeads(prevLeads);
            showToast('Gagal update status', 'error');
        }
    };

    const handleAddLead = async () => {
        if (!newLead.name || !newLead.phone) {
            showToast('Nama dan No. HP wajib diisi', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const { data, error } = await supabase
                .from('leads')
                .insert([{
                    name: newLead.name,
                    phone: newLead.phone,
                    source: newLead.source,
                    notes: newLead.notes,
                    assigned_to: newLead.assigned_to || null,
                    status: 'followup'
                }])
                .select()
                .single();

            if (error) throw error;

            await supabase.from('conversations').insert({
                lead_id: data.id,
                phone: data.phone,
                name: data.name,
                messages: [],
                status: 'open'
            });

            setLeads([data, ...leads]);
            setShowAddModal(false);
            setNewLead({ name: '', phone: '', source: 'Website', notes: '', assigned_to: '' });
            showToast('Lead baru berhasil ditambahkan');
        } catch (error) {
            console.error('Error adding lead:', error);
            showToast(error.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };



    const handleUpdateLead = async () => {
        if (!editingLead.name || !editingLead.phone) {
            showToast('Nama dan No. HP wajib diisi', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('leads')
                .update({
                    name: editingLead.name,
                    phone: editingLead.phone,
                    source: editingLead.source,
                    notes: editingLead.notes,
                    assigned_to: editingLead.assigned_to || null,
                    updated_at: new Date()
                })
                .eq('id', editingLead.id);

            if (error) throw error;

            setLeads(prev => prev.map(l => l.id === editingLead.id ? { ...l, ...editingLead } : l));
            setShowEditModal(false);
            setEditingLead(null);
            showToast('Data lead berhasil diperbarui');
        } catch (error) {
            console.error('Error updating lead:', error);
            showToast('Gagal update lead: ' + error.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteLead = async () => {
        if (deletePassword !== 'admin123') {
            setDeleteError('Password admin salah');
            return;
        }

        setSubmitting(true);
        try {
            // Attempt to delete related records (swallow errors if tables don't exist)
            await supabase.from('conversations').delete().eq('lead_id', leadToDelete.id);
            try {
                await supabase.from('crm_activities').delete().eq('lead_id', leadToDelete.id);
            } catch (e) { /* ignore if crm_activities doesn't exist */ }

            const { error } = await supabase
                .from('leads')
                .delete()
                .eq('id', leadToDelete.id);

            if (error) throw error;

            setLeads(prev => prev.filter(l => l.id !== leadToDelete.id));
            setShowDeleteModal(false);
            setLeadToDelete(null);
            setDeletePassword('');
            setDeleteError('');
            showToast('Lead berhasil dihapus permanently');
        } catch (error) {
            console.error('Error deleting lead:', error);
            showToast('Gagal menghapus lead: ' + error.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const downloadCSV = () => {
        const headers = ['Nama', 'Telepon', 'Status', 'Sumber', 'Tags', 'Catatan', 'Tanggal'];
        const rows = leads.map(l => [
            l.name,
            l.phone,
            PIPELINE_STAGES.find(s => s.id === l.status)?.label || l.status,
            l.source || '-',
            (l.tags || []).join('; '),
            (l.notes || '').replace(/"/g, '""'), // Escape quotes
            new Date(l.created_at).toLocaleDateString()
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(','), ...rows.map(e => e.map(i => `"${i}"`).join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `crm_leads_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- TAG & ROLE MANAGEMENT ---
    // Mock Role (ideal abuse Context/Profile)
    const canManageCRM = true; // Temporary bypass for dev. Use 'role === crm_admin' later.

    const handleUpdateTags = async (leadId, currentTags, newTag) => {
        if (!canManageCRM) {
            showToast('Akses ditolak: Hanya Admin CRM', 'error');
            return;
        }

        const tags = currentTags || [];
        let updatedTags;

        if (tags.includes(newTag)) {
            updatedTags = tags.filter(t => t !== newTag);
        } else {
            updatedTags = [...tags, newTag];
        }

        // Optimistic Update
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, tags: updatedTags } : l));

        try {
            const { error } = await supabase
                .from('leads')
                .update({ tags: updatedTags, updated_at: new Date() })
                .eq('id', leadId);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating tags:', error);
            showToast('Gagal update tags', 'error');
            fetchLeads(); // Revert
        }
    };

    const handleAddGlobalTag = async () => {
        if (!tagInput.trim()) return;
        const newTags = [...availableTags, tagInput.trim()];
        setAvailableTags(newTags);
        setTagInput('');

        // Update DB
        await updateAppSettingsTags(newTags);
    };

    const handleDeleteGlobalTag = async (tagToDelete) => {
        const newTags = availableTags.filter(t => t !== tagToDelete);
        setAvailableTags(newTags);

        // Update DB
        await updateAppSettingsTags(newTags);
    };

    const updateAppSettingsTags = async (tags) => {
        try {
            // Get current config first to preserve other keys
            const { data } = await supabase.from('app_settings').select('crm_config').single();
            const currentConfig = data?.crm_config || {};

            await supabase.from('app_settings').update({
                crm_config: { ...currentConfig, tags }
            }).eq('id', 'main');

            showToast('Tags berhasil diupdate');
        } catch (error) {
            console.error('Error updating global tags:', error);
            showToast('Gagal update tags global', 'error');
        }
    };

    // Filter leads by search query
    const filteredLeads = leads.filter(lead => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return lead.name?.toLowerCase().includes(query) || lead.phone?.includes(query);
    });

    return (
        <>
            {/* Top Navigation Tabs */}
            <div className="mb-6">
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 w-fit rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setMainTab('kanban')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${mainTab === 'kanban'
                            ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        Kanban Board
                    </button>
                    <button
                        onClick={() => setMainTab('report')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all ${mainTab === 'report'
                            ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <BarChart2 size={16} /> Laporan & Statistik
                    </button>
                </div>
            </div>

            {/* ERROR HANDLING IF NOT LOADED */}
            {/* Search Bar & Actions (ONLY IN KANBAN) */}
            {mainTab === 'kanban' && (
                <div className="flex flex-col md:flex-row gap-4 mb-4 justify-between items-center">
                    <div className="relative w-full max-w-md">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari nama atau nomor WhatsApp..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                            <Plus size={16} /> Lead Baru
                        </Button>
                        <Button onClick={() => setShowTagsModal(true)} variant="outline" className="flex items-center gap-2 border-slate-300 dark:border-slate-600">
                            <Tag size={16} className="text-blue-600" />
                            Tags
                        </Button>
                    </div>
                </div>
            )}

            {/* KANBAN BOARD CONTENT */}
            {mainTab === 'kanban' && (
                <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-220px)] min-h-[500px]">
                    {loading ? (
                        <div className="flex items-center justify-center w-full">
                            <Loader2 className="animate-spin text-emerald-600" size={40} />
                        </div>
                    ) : (
                        PIPELINE_STAGES.map(stage => {
                            // Filter leads for this stage
                            const stageLeads = filteredLeads.filter(l => l.status === stage.id);
                            const totalAmount = stageLeads.length;

                            return (
                                <div key={stage.id} className="min-w-[320px] w-[320px] flex flex-col bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 h-full">
                                    {/* Header Column */}
                                    <div className={`p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center border-l-4 border-l-${stage.color}-500 bg-white dark:bg-slate-800 rounded-t-xl`}>
                                        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wide">{stage.label}</h3>
                                        <span className={`bg-${stage.color}-100 text-${stage.color}-700 text-xs font-bold px-2 py-0.5 rounded-full`}>
                                            {totalAmount}
                                        </span>
                                    </div>

                                    <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-0">
                                        {loading && stage.id === 'inquiry' ? (
                                            <div className="py-4 text-center text-slate-400"><Loader2 className="animate-spin mx-auto" /></div>
                                        ) : (
                                            stageLeads.map(lead => (
                                                <div key={lead.id} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 group hover:shadow-md transition-all">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{lead.source}</span>
                                                        <div className="relative group/menu">
                                                            <button className="text-slate-300 hover:text-slate-600 p-1"><MoreHorizontal size={16} /></button>
                                                            <div className="absolute right-0 top-full hidden group-hover/menu:block z-[40] bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-lg min-w-[140px] overflow-hidden">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingLead({ ...lead });
                                                                        setShowEditModal(true);
                                                                    }}
                                                                    className="w-full px-4 py-3 text-left text-xs text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 font-bold"
                                                                >
                                                                    <FileText size={14} /> Edit Data
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setLeadToDelete(lead);
                                                                        setShowDeleteModal(true);
                                                                    }}
                                                                    className="w-full px-4 py-3 text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 font-bold"
                                                                >
                                                                    <Trash2 size={14} /> Hapus Lead
                                                                </button>

                                                                <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                                                                <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase">Tags</div>
                                                                {availableTags.map(tag => (
                                                                    <button
                                                                        key={tag}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleUpdateTags(lead.id, lead.tags, tag);
                                                                        }}
                                                                        className={`w-full px-4 py-2 text-left text-xs flex items-center gap-2 ${(lead.tags || []).includes(tag) ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 hover:bg-slate-50'}`}
                                                                    >
                                                                        {(lead.tags || []).includes(tag) ? <CheckCircle size={12} /> : <Tag size={12} />}
                                                                        {tag}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 dark:text-white mb-1 text-sm">{lead.name}</h4>
                                                    <p className="text-xs text-slate-500 mb-3 flex items-center gap-1 font-mono">
                                                        <Phone size={12} /> {lead.phone}
                                                    </p>

                                                    {/* Assigned To Info */}
                                                    {lead.assigned_to && (
                                                        <div className="mb-3 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded border border-indigo-100 dark:border-indigo-800 flex items-center gap-2 w-fit">
                                                            <User size={12} className="text-indigo-500" />
                                                            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                                                                {lead.assigned_to}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-slate-700 mt-2">
                                                        <div className="flex flex-col gap-2 w-full">
                                                            {/* Tags Display */}
                                                            <div className="flex flex-wrap gap-1 mb-1">
                                                                {(lead.tags || []).map((tag, idx) => (
                                                                    <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600">
                                                                        #{tag}
                                                                    </span>
                                                                ))}
                                                                {(!lead.tags || lead.tags.length === 0) && (
                                                                    <span className="text-[10px] text-slate-300 italic">No tags</span>
                                                                )}
                                                            </div>

                                                            <div className="flex justify-between items-center w-full">
                                                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                                    <Calendar size={12} /> {new Date(lead.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                                </span>
                                                                <div className="flex gap-1">
                                                                    {!['lunas', 'termin', 'lost'].includes(stage.id) && (
                                                                        <button
                                                                            onClick={() => moveLead(lead.id, PIPELINE_STAGES[PIPELINE_STAGES.findIndex(s => s.id === stage.id) + 1].id)}
                                                                            className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                                                                        >
                                                                            <ArrowRight size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        <button
                                            onClick={() => setShowAddModal(true)}
                                            className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-emerald-300 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Plus size={16} /> Tambah Lead
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* REPORT VIEW CONTENT */}
            {mainTab === 'report' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm min-h-[500px]">
                    {/* Reuse Report Content Here - Will be added in next replacement if logic flows correctly */}
                    {/* PLACEHOLDER FOR NEXT STEP - actually I should do it here or below */}
                    <div className="space-y-6">
                        {/* Tabs Navigation */}
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setReportSubTab('summary')}
                                    className={`text-sm font-bold pb-2 border-b-2 transition-colors ${reportSubTab === 'summary' ? 'text-emerald-600 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
                                >
                                    Ringkasan Statistik
                                </button>
                                <button
                                    onClick={() => setReportSubTab('detail')}
                                    className={`text-sm font-bold pb-2 border-b-2 transition-colors ${reportSubTab === 'detail' ? 'text-emerald-600 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
                                >
                                    Data Detail & Export
                                </button>
                            </div>
                            {reportSubTab === 'detail' && (
                                <Button size="sm" onClick={downloadCSV} className="flex items-center gap-2 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200">
                                    <Download size={14} /> Download Excel (.csv)
                                </Button>
                            )}
                        </div>

                        {reportSubTab === 'summary' ? (
                            <>
                                {/* Key Metrics */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase">Total Leads</h4>
                                        <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{leads.length}</p>
                                    </div>
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800 text-center">
                                        <h4 className="text-xs font-bold text-emerald-600 uppercase">Diterima/Lunas</h4>
                                        <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                                            {leads.filter(l => l.status === 'lunas' || l.status === 'student').length}
                                        </p>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 text-center">
                                        <h4 className="text-xs font-bold text-blue-600 uppercase">Inquiry Hari Ini</h4>
                                        <p className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-1">
                                            {leads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length}
                                        </p>
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 text-center">
                                        <h4 className="text-xs font-bold text-indigo-600 uppercase">Konversi Rate</h4>
                                        <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-1">
                                            {leads.length > 0
                                                ? Math.round((leads.filter(l => ['lunas', 'termin', 'student'].includes(l.status)).length / leads.length) * 100)
                                                : 0}%
                                        </p>
                                    </div>
                                </div>

                                {/* Breakdown per Stage */}
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white mb-3">Breakdown per Tahapan</h4>
                                    <div className="space-y-2">
                                        {PIPELINE_STAGES.map(stage => {
                                            const count = leads.filter(l => l.status === stage.id).length;
                                            const percentage = leads.length > 0 ? (count / leads.length) * 100 : 0;
                                            return (count > 0 && (
                                                <div key={stage.id} className="flex items-center gap-3">
                                                    <div className="w-32 text-xs font-semibold text-slate-600 dark:text-slate-400">{stage.label}</div>
                                                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full bg-${stage.color}-500 rounded-full`}
                                                            style={{ width: `${percentage}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="w-10 text-right text-xs font-bold text-slate-800 dark:text-white">{count}</div>
                                                </div>
                                            ));
                                        })}
                                    </div>
                                </div>

                                {/* Breakdown by Source */}
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white mb-3">Sumber Lead (Asal Data)</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['Website', 'Facebook', 'Instagram', 'Google', 'Sekolah', 'Teman', 'Saudara', 'Iklan', 'Spanduk', 'Event', 'Lainnya'].map(src => {
                                            const count = leads.filter(l => (l.source || '').toLowerCase().includes(src.toLowerCase())).length;
                                            if (count === 0) return null;
                                            const percentage = Math.round((count / leads.length) * 100);
                                            return (
                                                <div key={src} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-500">{src}</div>
                                                        <div className="text-lg font-black text-slate-800 dark:text-white">{count}</div>
                                                    </div>
                                                    <div className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
                                                        {percentage}%
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Recommendations */}
                                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
                                    <h4 className="font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-2">
                                        💡 Rekomendasi Tindakan
                                    </h4>
                                    <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1.5 list-disc ml-4">
                                        {leads.filter(l => l.status === 'followup').length > 5 && (
                                            <li>Ada <b>{leads.filter(l => l.status === 'followup').length} prospek</b> di tahap Follow Up. Segera hubungi mereka untuk meningkatkan konversi.</li>
                                        )}
                                        {leads.filter(l => l.status === 'bayar_daftar').length > 0 && (
                                            <li>Pastikan untuk memverifikasi pembayaran pendaftaran dari <b>{leads.filter(l => l.status === 'bayar_daftar').length} calon siswa</b>.</li>
                                        )}
                                        {leads.length === 0 && (
                                            <li>Belum ada data leads. Pastikan form pendaftaran di website berfungsi atau tambahkan leads manual.</li>
                                        )}
                                        <li>Gunakan fitur <b>Broadcast WA</b> untuk mengirim pengingat kepada calon siswa yang berhenti di tahap "Isi Biodata".</li>
                                    </ul>
                                </div>
                            </>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="px-4 py-3">Nama</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Sumber</th>
                                            <th className="px-4 py-3">Tags</th>
                                            <th className="px-4 py-3">Tanggal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {leads.map(lead => (
                                            <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-800 dark:text-white">{lead.name}</div>
                                                    <div className="text-xs text-slate-500 font-mono">{lead.phone}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase bg-${PIPELINE_STAGES.find(s => s.id === lead.status)?.color}-100 text-${PIPELINE_STAGES.find(s => s.id === lead.status)?.color}-700`}>
                                                        {PIPELINE_STAGES.find(s => s.id === lead.status)?.label || lead.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                                                    {lead.source || '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(lead.tags || []).map((t, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 rounded border border-slate-200 text-[10px] text-slate-500">
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500">
                                                    {new Date(lead.created_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah Prospek Baru">
                <div className="space-y-4">
                    <Input label="Nama" value={newLead.name} onChange={e => setNewLead({ ...newLead, name: e.target.value })} />
                    <Input label="No WhatsApp" value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })} />

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Sumber Lead</label>
                        <select
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                            value={newLead.source}
                            onChange={e => setNewLead({ ...newLead, source: e.target.value })}
                        >
                            <option value="Website">Website</option>
                            <option value="Facebook">Facebook</option>
                            <option value="Instagram">Instagram</option>
                            <option value="Google">Google</option>
                            <option value="Sekolah">Sekolah Asal</option>
                            <option value="Teman">Teman</option>
                            <option value="Saudara">Saudara</option>
                            <option value="Iklan">Iklan / Ads</option>
                            <option value="Spanduk">Spanduk / Brosur</option>
                            <option value="Event">Event / Pameran</option>
                            <option value="Lainnya">Lainnya</option>
                        </select>
                    </div>

                    {/* Assignment Dropdown */}
                    {adminList.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Assign Ke</label>
                            <select
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                value={newLead.assigned_to || ''}
                                onChange={e => setNewLead({ ...newLead, assigned_to: e.target.value })}
                            >
                                <option value="">-- Pilih Admin --</option>
                                {adminList.map((admin, idx) => (
                                    <option key={idx} value={admin.name || admin.email}>
                                        {admin.name || admin.email} ({admin.role})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <Input label="Catatan" value={newLead.notes} onChange={e => setNewLead({ ...newLead, notes: e.target.value })} />
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setShowAddModal(false)}>Batal</Button>
                        <Button onClick={handleAddLead} className="bg-emerald-600 text-white" disabled={submitting}>Simpan</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Hapus Lead Permanen">
                <div className="space-y-4">
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm font-medium">
                        Anda akan menghapus lead <span className="font-bold">{leadToDelete?.name}</span>.
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Password Admin</label>
                        <Input type="password" value={deletePassword} onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }} />
                        {deleteError && <p className="text-[10px] text-red-500 font-bold">{deleteError}</p>}
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Batal</Button>
                        <Button onClick={handleDeleteLead} className="bg-red-600 text-white" disabled={submitting}>Ya, Hapus</Button>
                    </div>
                </div>
            </Modal>


            <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Data Prospek">
                <div className="space-y-4">
                    <Input label="Nama" value={editingLead?.name || ''} onChange={e => setEditingLead({ ...editingLead, name: e.target.value })} />
                    <Input label="No WhatsApp" value={editingLead?.phone || ''} onChange={e => setEditingLead({ ...editingLead, phone: e.target.value })} />

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Sumber Lead</label>
                        <select
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                            value={editingLead?.source || 'Website'}
                            onChange={e => setEditingLead({ ...editingLead, source: e.target.value })}
                        >
                            <option value="Website">Website</option>
                            <option value="Facebook">Facebook</option>
                            <option value="Instagram">Instagram</option>
                            <option value="Google">Google</option>
                            <option value="Sekolah">Sekolah Asal</option>
                            <option value="Teman">Teman</option>
                            <option value="Saudara">Saudara</option>
                            <option value="Iklan">Iklan / Ads</option>
                            <option value="Spanduk">Spanduk / Brosur</option>
                            <option value="Event">Event / Pameran</option>
                            <option value="Lainnya">Lainnya</option>
                        </select>
                    </div>

                    {/* Assignment Dropdown Edit */}
                    {adminList.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Assign Ke</label>
                            <select
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                value={editingLead?.assigned_to || ''}
                                onChange={e => setEditingLead({ ...editingLead, assigned_to: e.target.value })}
                            >
                                <option value="">-- Pilih Admin --</option>
                                {adminList.map((admin, idx) => (
                                    <option key={idx} value={admin.name || admin.email}>
                                        {admin.name || admin.email} ({admin.role})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <Input label="Catatan" value={editingLead?.notes || ''} onChange={e => setEditingLead({ ...editingLead, notes: e.target.value })} />
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setShowEditModal(false)}>Batal</Button>
                        <Button onClick={handleUpdateLead} className="bg-emerald-600 text-white" disabled={submitting}>Simpan Perubahan</Button>
                    </div>
                </div>
            </Modal>
            {/* Tags Management Modal */}
            <Modal isOpen={showTagsModal} onClose={() => setShowTagsModal(false)} title="Manajemen Tags Lead">
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            placeholder="Nama Tag Baru..."
                            className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddGlobalTag()}
                        />
                        <Button onClick={handleAddGlobalTag}>Tambah</Button>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {availableTags.map(tag => (
                            <div key={tag} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                                <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <Tag size={14} className="text-slate-400" /> {tag}
                                </span>
                                <button
                                    onClick={() => handleDeleteGlobalTag(tag)}
                                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                >
                                    <XCircle size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button variant="secondary" onClick={() => setShowTagsModal(false)}>Tutup</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
