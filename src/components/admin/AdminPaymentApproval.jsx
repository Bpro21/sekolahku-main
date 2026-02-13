
import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    CreditCard, CheckCircle, XCircle, Eye, Search, Image as ImageIcon, Ticket,
    Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Card, Button, Badge } from '../ui/Elements';
import { Modal } from '../ui/Overlays';

export default function AdminPaymentApproval({ showToast }) {
    const [invoices, setInvoices] = useState([]);
    const [selectedInv, setSelectedInv] = useState(null);
    const [settings, setSettings] = useState({});
    const [activeTab, setActiveTab] = useState('pending');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'unpaid', 'processing'
    const [searchTerm, setSearchTerm] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [availableYears, setAvailableYears] = useState([]);
    const [regMap, setRegMap] = useState({});
    const [installmentPlan, setInstallmentPlan] = useState([]);
    const [isEditingPlan, setIsEditingPlan] = useState(false);

    // Date filter states
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Fetch Active Academic Year & Registrations & Settings
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [
                    { data: ays },
                    { data: regs },
                    { data: settingsData }
                ] = await Promise.all([
                    supabase.from('academic_years').select('*'),
                    supabase.from('registrations').select('id, academic_year'),
                    supabase.from('app_settings').select('*').eq('id', 'main').single()
                ]);

                if (settingsData) setSettings(settingsData);

                // Process Academic Years
                const validYears = (ays || [])
                    .map(a => a.year)
                    .filter(year => year && year.includes('/'))
                    .sort((a, b) => b.localeCompare(a));
                setAvailableYears(validYears);

                const activeAy = (ays || []).find(ay => ay.is_active);
                if (activeAy) {
                    setFilterYear(activeAy.year);
                } else if (validYears.length > 0) {
                    setFilterYear(validYears[0]);
                }

                // Process Registrations Map (RegID -> AcademicYear)
                const map = {};
                (regs || []).forEach(d => {
                    if (d.academic_year) map[d.id] = d.academic_year;
                });
                setRegMap(map);

            } catch (e) { console.error("Failed to fetch initial data", e); }
        };
        fetchInitialData();
    }, []);

    // Fetch Invoices Realtime with Join
    const fetchInvoices = async () => {
        const { data, error } = await supabase
            .from('invoices')
            .select('*, registrations(academic_year, student_name, unit_name)')
            .order('created_at', { ascending: false });

        if (error) console.error("Error fetching invoices:", error);
        if (data) {
            // Flatten the registration data for easier filtering if needed
            const formatted = data.map(inv => ({
                ...inv,
                // Fallback for academic_year if not directly on invoice
                reg_academic_year: inv.registrations?.academic_year || inv.academic_year,
                // Fallback for student_name if missing on invoice
                display_student_name: inv.student_name || inv.registrations?.student_name || 'Tanpa Nama'
            }));
            setInvoices(formatted);
        }
    };

    useEffect(() => {
        fetchInvoices();
        const channel = supabase.channel('admin_payment_approval')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, fetchInvoices)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Handle Selection & Plan Init
    useEffect(() => {
        if (selectedInv) {
            if (selectedInv.installment_schedule) {
                setInstallmentPlan(selectedInv.installment_schedule);
            } else if (selectedInv.is_installment_request) {
                const terms = selectedInv.installment_terms_request || 2;
                const amountPerTerm = Math.ceil(selectedInv.amount / terms);
                const plan = Array.from({ length: terms }, (_, i) => ({
                    term: i + 1,
                    amount: i === terms - 1 ? selectedInv.amount - (amountPerTerm * (terms - 1)) : amountPerTerm,
                    due_date: new Date(Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    status: 'unpaid'
                }));
                setInstallmentPlan(plan);
            }
            setIsEditingPlan(false);
        }
    }, [selectedInv]);

    const handleApprove = async () => {
        try {
            let approverName = 'Admin';
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                try {
                    const { data: p } = await supabase.from('profiles').select('name, role').eq('id', user.id).single();
                    if (p) {
                        const role = p.role ? (p.role.charAt(0).toUpperCase() + p.role.slice(1)) : 'Admin';
                        approverName = `${p.name || 'Admin'} - ${role}`;
                    }
                } catch (e) {
                    // ignore
                }
            }

            if (selectedInv.is_installment_request || selectedInv.status === 'installment_approved') {
                const updates = {
                    status: 'installment_approved',
                    installment_schedule: installmentPlan.map((p, i) => {
                        const existingTerm = selectedInv.installment_schedule?.[i];
                        return {
                            ...p,
                            status: existingTerm?.status || 'unpaid',
                            paid_at: existingTerm?.paid_at || null,
                            proof_of_transfer: existingTerm?.proof_of_transfer || null,
                            approved_at: existingTerm?.approved_at || null,
                            due_date: p.due_date
                        };
                    }),
                    approved_at: selectedInv.approved_at || new Date().toISOString(),
                    approved_by: approverName,
                    is_installment: true,
                    updated_at: new Date().toISOString()
                };

                const { error } = await supabase.from('invoices').update(updates).eq('id', selectedInv.id);
                if (error) throw error;

                const isUpdate = selectedInv.status === 'installment_approved';

                await supabase.from('notifications').insert({
                    user_id: selectedInv.user_id,
                    title: isUpdate ? 'Jadwal Cicilan Diperbarui' : 'Pengajuan Cicilan Disetujui',
                    message: isUpdate
                        ? `Jadwal cicilan untuk tagihan ${selectedInv.description} telah diperbarui.Silakan cek jadwal pembayaran Anda.`
                        : `Pengajuan cicilan untuk tagihan ${selectedInv.description} telah disetujui.Silakan cek jadwal pembayaran Anda.`,
                    type: 'success',
                    created_at: new Date().toISOString()
                });

                showToast(isUpdate ? "Jadwal cicilan diperbarui!" : "Pengajuan cicilan disetujui!");
                setSelectedInv(null);
                fetchInvoices();
                return;
            }

            // --- GENERATE SEQUENTIAL INVOICE NUMBER ---
            // Read-modify-write for counter
            let newSeq = 1;
            const { data: counterData } = await supabase.from('counters').select('count').eq('id', 'invoices').single();
            if (counterData) {
                newSeq = counterData.count + 1;
            }
            await supabase.from('counters').upsert({ id: 'invoices', count: newSeq, updated_at: new Date().toISOString() });

            const prefix = settings.invoice_prefix || 'PSB26-';
            const formattedId = `${prefix}${newSeq.toString().padStart(4, '0')}`;

            const updates = {
                status: 'paid',
                paid_at: new Date().toISOString(),
                approved_by: approverName,
                invoice_number: newSeq,
                invoice_number_formatted: formattedId
            };

            const { error: invError } = await supabase.from('invoices').update(updates).eq('id', selectedInv.id);
            if (invError) throw invError;

            // Update Registration Status
            const { data: regData } = await supabase.from('registrations').select('status').eq('id', selectedInv.registration_id).single();
            const currentStatus = regData?.status;

            let newStatus = currentStatus;

            if (selectedInv.description?.toLowerCase().includes('re-registration') || selectedInv.description?.toLowerCase().includes('daftar ulang')) {
                newStatus = 'paid';
            } else if (selectedInv.description?.toLowerCase().includes('pendaftaran')) {
                newStatus = 'paid_registration';
            }

            if (newStatus !== currentStatus) {
                await supabase.from('registrations').update({ status: newStatus }).eq('id', selectedInv.registration_id);
            }

            await supabase.from('notifications').insert({
                user_id: selectedInv.user_id,
                title: 'Pembayaran Diterima',
                message: `Pembayaran tagihan ${selectedInv.description} sebesar Rp ${selectedInv.amount.toLocaleString()} telah disetujui. Invoice #${formattedId}`,
                type: 'success',
                created_at: new Date().toISOString()
            });

            showToast(`Pembayaran disetujui! Invoice: ${formattedId}`);

            // Auto-cancel duplicate pending invoices for this registration
            if (selectedInv.registration_id) {
                const duplicates = invoices.filter(inv =>
                    inv.registration_id === selectedInv.registration_id &&
                    inv.id !== selectedInv.id &&
                    (inv.status === 'pending' || inv.status === 'requesting_installment')
                );
                for (const dup of duplicates) {
                    try {
                        await supabase.from('invoices').update({ status: 'cancelled' }).eq('id', dup.id);
                    } catch (err) { console.error("Failed to cancel duplicate", err); }
                }
            }

            setSelectedInv(null);
            fetchInvoices();
        } catch (e) { showToast(e.message, 'error'); }
    };


    const handleReject = async () => {
        try {
            if (selectedInv.is_installment_request) {
                const updates = {
                    status: 'pending',
                    is_installment_request: false,
                    installment_terms_request: null,
                    requested_at: null
                };

                const { error } = await supabase.from('invoices').update(updates).eq('id', selectedInv.id);
                if (error) throw error;

                // Notify User
                await supabase.from('notifications').insert({
                    user_id: selectedInv.user_id,
                    title: 'Pengajuan Cicilan Ditolak',
                    message: `Pengajuan cicilan untuk tagihan ${selectedInv.description} ditolak.Silakan lakukan pembayaran penuh atau ajukan kembali.`,
                    type: 'error',
                    created_at: new Date().toISOString()
                });

                showToast("Pengajuan cicilan ditolak.");
            } else {
                let updates = { status: 'pending', proof_of_transfer: null };

                // If invoice used a voucher (stored in discount_info), reset amount to original price
                if (selectedInv.discount_info) {
                    const originalPrice = selectedInv.original_amount || (selectedInv.amount + (selectedInv.discount_info.amount || 0));

                    updates = {
                        ...updates,
                        amount: originalPrice,
                        discount_info: null,
                        original_amount: null
                    };

                    // Restore Voucher Quota (Decrement 'used')
                    if (selectedInv.discount_info.code) {
                        try {
                            const { data: v } = await supabase.from('vouchers').select('used, id').eq('code', selectedInv.discount_info.code).single();
                            if (v) {
                                await supabase.from('vouchers').update({ used: Math.max(0, (v.used || 0) - 1) }).eq('id', v.id);
                            }
                        } catch (err) {
                            console.error("Failed to restore voucher quota", err);
                        }
                    }
                }

                const { error } = await supabase.from('invoices').update(updates).eq('id', selectedInv.id);
                if (error) throw error;

                // Notify User
                await supabase.from('notifications').insert({
                    user_id: selectedInv.user_id,
                    title: 'Bukti Pembayaran Ditolak',
                    message: `Bukti transfer untuk tagihan ${selectedInv.description} ditolak karena buram atau tidak sesuai.Silakan upload kembali.`,
                    type: 'error',
                    created_at: new Date().toISOString()
                });

                showToast("Pembayaran ditolak. User diminta upload ulang.");
            }
            setSelectedInv(null);
            fetchInvoices();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleApproveTermPayment = async (termIndex) => {
        try {
            const newSchedule = [...selectedInv.installment_schedule];
            newSchedule[termIndex] = {
                ...newSchedule[termIndex],
                status: 'paid',
                approved_at: new Date().toISOString()
            };

            const updates = {
                installment_schedule: newSchedule
            };

            // Check if all terms are paid
            const allPaid = newSchedule.every(t => t.status === 'paid');
            let formattedId = '';

            if (allPaid) {
                // --- GENERATE SEQUENTIAL INVOICE NUMBER ---
                let newSeq = 1;
                const { data: counterData } = await supabase.from('counters').select('count').eq('id', 'invoices').single();
                if (counterData) {
                    newSeq = counterData.count + 1;
                }
                await supabase.from('counters').upsert({ id: 'invoices', count: newSeq, updated_at: new Date().toISOString() });

                const prefix = settings.invoice_prefix || 'PSB26-';
                formattedId = `${prefix}${newSeq.toString().padStart(4, '0')}`;

                updates.status = 'paid';
                updates.paid_at = new Date().toISOString();
                updates.approved_by = 'admin'; // Or dynamic name
                updates.invoice_number = newSeq;
                updates.invoice_number_formatted = formattedId;
            }

            const { error } = await supabase.from('invoices').update(updates).eq('id', selectedInv.id);
            if (error) throw error;

            // Update registration status if all paid
            if (allPaid) {
                const { data: regData } = await supabase.from('registrations').select('status').eq('id', selectedInv.registration_id).single();
                const currentStatus = regData?.status;
                let newStatus = 'verified';
                if (currentStatus === 'lulus' || selectedInv.description?.toLowerCase().includes('daftar ulang')) newStatus = 'paid';

                await supabase.from('registrations').update({ status: newStatus }).eq('id', selectedInv.registration_id);
            }

            await supabase.from('notifications').insert({
                user_id: selectedInv.user_id,
                title: allPaid ? 'Pembayaran Cicilan Lunas' : `Pembayaran Termin ${termIndex + 1} Diterima`,
                message: allPaid
                    ? `Semua cicilan untuk tagihan ${selectedInv.description} telah lunas ${formattedId ? `(Invoice #${formattedId})` : ''}. Terima kasih.`
                    : `Pembayaran termin ${termIndex + 1} sebesar Rp ${newSchedule[termIndex].amount.toLocaleString()} telah disetujui.`,
                type: 'success',
                created_at: new Date().toISOString()
            });

            showToast(allPaid ? `Semua cicilan lunas! Invoice: ${formattedId}` : `Termin ${termIndex + 1} disetujui!`);
            setSelectedInv(null);
            fetchInvoices();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleRejectTermPayment = async (termIndex) => {
        try {
            const newSchedule = [...selectedInv.installment_schedule];
            newSchedule[termIndex] = {
                ...newSchedule[termIndex],
                status: 'unpaid',
                proof_of_transfer: null,
                paid_at: null
            };

            const updates = {
                installment_schedule: newSchedule
            };

            const { error } = await supabase.from('invoices').update(updates).eq('id', selectedInv.id);
            if (error) throw error;

            await supabase.from('notifications').insert({
                user_id: selectedInv.user_id,
                title: `Pembayaran Termin ${termIndex + 1} Ditolak`,
                message: `Bukti transfer termin ${termIndex + 1} ditolak.Silakan upload kembali bukti yang jelas.`,
                type: 'error',
                created_at: new Date().toISOString()
            });

            showToast(`Termin ${termIndex + 1} ditolak.User diminta upload ulang.`);
            setSelectedInv(null);
            fetchInvoices();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const filteredInvoices = invoices.filter(inv => {
        // 1. Tab filtering (Pending vs History)
        const matchesTab = activeTab === 'pending'
            ? (inv.status === 'pending' || inv.status === 'requesting_installment' || inv.status === 'installment_approved')
            : (inv.status === 'paid' || inv.status === 'rejected');

        if (!matchesTab) return false;

        // 2. Year Filter
        const matchesYear = filterYear
            ? (inv.reg_academic_year === filterYear)
            : true;
        if (!matchesYear) return false;

        // 3. Status sub-filter (for pending tab)
        let matchesStatus = true;
        if (activeTab === 'pending' && statusFilter !== 'all') {
            if (statusFilter === 'unpaid') {
                matchesStatus = inv.status === 'pending' && !inv.proof_of_transfer;
            } else if (statusFilter === 'processing') {
                matchesStatus = (inv.status === 'pending' && inv.proof_of_transfer) ||
                    inv.status === 'requesting_installment' ||
                    inv.status === 'installment_approved';
            }
        }
        if (!matchesStatus) return false;

        // 4. Search Filter
        const matchesSearch = searchTerm
            ? (inv.display_student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inv.invoice_number_formatted?.toLowerCase().includes(searchTerm.toLowerCase()))
            : true;
        if (!matchesSearch) return false;

        // 5. Date filter
        let matchesDate = true;
        if (dateFrom || dateTo) {
            const invDate = inv.created_at ? new Date(inv.created_at) : null;
            if (invDate) {
                if (dateFrom) {
                    const fromDate = new Date(dateFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    matchesDate = matchesDate && invDate >= fromDate;
                }
                if (dateTo) {
                    const toDate = new Date(dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    matchesDate = matchesDate && invDate <= toDate;
                }
            } else {
                matchesDate = false;
            }
        }
        return matchesDate;
    });

    // Pagination calculations
    const totalItems = filteredInvoices.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, statusFilter, searchTerm, filterYear, dateFrom, dateTo, itemsPerPage]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800 dark:text-white"><CreditCard className="text-emerald-600" /> Approval Pembayaran Manual</h2>
            <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => { setActiveTab('pending'); setStatusFilter('all'); }}
                    className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'pending' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Perlu Persetujuan
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'history' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Riwayat Persetujuan
                </button>
            </div>

            {/* Sub-filter for Pending Tab */}
            {activeTab === 'pending' && (
                <div className="space-y-4">
                    {/* Status Filter Tabs */}
                    <div className="flex flex-wrap gap-2">
                        {(() => {
                            // Count invoices by status
                            // Count invoices by status, MATCHING current filters (Year, Search, Date)
                            const baseFiltered = invoices.filter(inv => {
                                const mYear = filterYear ? (inv.reg_academic_year === filterYear) : true;
                                const mSearch = searchTerm ? (inv.display_student_name?.toLowerCase().includes(searchTerm.toLowerCase())) : true;
                                let mDate = true;
                                if (dateFrom || dateTo) {
                                    const d = inv.created_at ? new Date(inv.created_at) : null;
                                    if (d) {
                                        if (dateFrom) { const f = new Date(dateFrom); f.setHours(0, 0, 0, 0); mDate = mDate && d >= f; }
                                        if (dateTo) { const t = new Date(dateTo); t.setHours(23, 59, 59, 999); mDate = mDate && d <= t; }
                                    } else mDate = false;
                                }
                                return mYear && mSearch && mDate;
                            });

                            const pendingInvoices = baseFiltered.filter(inv =>
                                inv.status === 'pending' || inv.status === 'requesting_installment' || inv.status === 'installment_approved'
                            );
                            const unpaidCount = pendingInvoices.filter(inv =>
                                inv.status === 'pending' && !inv.proof_of_transfer
                            ).length;
                            const processingCount = pendingInvoices.filter(inv =>
                                (inv.status === 'pending' && inv.proof_of_transfer) ||
                                inv.status === 'requesting_installment' ||
                                inv.status === 'installment_approved'
                            ).length;
                            const allCount = pendingInvoices.length;

                            return (
                                <>
                                    <button
                                        onClick={() => setStatusFilter('all')}
                                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${statusFilter === 'all'
                                            ? 'bg-slate-800 text-white shadow-lg'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        Semua ({allCount})
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('unpaid')}
                                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${statusFilter === 'unpaid'
                                            ? 'bg-amber-500 text-white shadow-lg'
                                            : 'bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50'
                                            }`}
                                    >
                                        Belum Bayar ({unpaidCount})
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('processing')}
                                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${statusFilter === 'processing'
                                            ? 'bg-blue-500 text-white shadow-lg'
                                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50'
                                            }`}
                                    >
                                        Proses ({processingCount})
                                    </button>
                                </>
                            );
                        })()}
                    </div>

                    {/* Search & Year Filter for Pending */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Cari nama siswa..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            />
                        </div>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="px-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        >
                            <option value="">Semua Tahun</option>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    {/* Date Filter & Items Per Page */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-slate-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                placeholder="Dari"
                            />
                            <span className="text-slate-400 text-sm">s/d</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                placeholder="Sampai"
                            />
                            {(dateFrom || dateTo) && (
                                <button
                                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                                    className="px-2 py-1 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-sm text-slate-500">Tampilkan:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span className="text-sm text-slate-500">data</span>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-4">
                    {/* Search & Year Filter for History */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Cari nama siswa..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            />
                        </div>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="px-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        >
                            <option value="">Semua Tahun</option>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    {/* Date Filter & Items Per Page */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-slate-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            />
                            <span className="text-slate-400 text-sm">s/d</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            />
                            {(dateFrom || dateTo) && (
                                <button
                                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                                    className="px-2 py-1 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-sm text-slate-500">Tampilkan:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span className="text-sm text-slate-500">data</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Info */}
            <div className="flex items-center justify-between text-sm text-slate-500">
                <div>
                    Menampilkan {paginatedInvoices.length > 0 ? startIndex + 1 : 0} - {Math.min(endIndex, totalItems)} dari {totalItems} data
                </div>
                {totalPages > 1 && (
                    <div className="text-xs">
                        Halaman {currentPage} dari {totalPages}
                    </div>
                )}
            </div>

            <div className="grid gap-4">
                {paginatedInvoices.length === 0 ? <div className="text-center p-10 text-slate-400 dark:text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">Tidak ada data.</div> : (
                    paginatedInvoices.map(inv => (
                        <Card key={inv.id} className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center text-slate-400 overflow-hidden cursor-pointer" onClick={() => setSelectedInv(inv)}>
                                    {inv.proof_of_transfer ? <img src={inv.proof_of_transfer} className="w-full h-full object-cover" alt="Proof" /> : <CreditCard />}
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-slate-800 dark:text-white">Rp {inv.amount.toLocaleString()}</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{inv.description}</p>
                                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                        {inv.display_student_name}
                                        {inv.registrations?.unit_name && <span className="text-slate-400 ml-2 font-normal">({inv.registrations.unit_name})</span>}
                                    </div>

                                    {/* Status Badges for Pending Tab */}
                                    {activeTab === 'pending' && inv.status === 'pending' && !inv.proof_of_transfer && (
                                        <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 rounded-full">
                                            Belum Bayar
                                        </span>
                                    )}
                                    {activeTab === 'pending' && inv.status === 'pending' && inv.proof_of_transfer && (
                                        <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 rounded-full">
                                            Processing
                                        </span>
                                    )}

                                    {inv.is_installment_request && inv.status === 'requesting_installment' && <Badge status="processing" className="mt-1">Ajukan Cicilan {inv.installment_terms_request}x</Badge>}
                                    {inv.status === 'installment_approved' && (
                                        <div className="mt-2 space-y-1">
                                            <Badge status="success" className="mr-1">Cicilan Disetujui</Badge>
                                            {inv.installment_schedule && (
                                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                                                    <div className="font-bold mb-1">
                                                        {inv.installment_schedule.filter(t => t.status === 'paid').length} / {inv.installment_schedule.length} Termin Lunas
                                                    </div>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {inv.installment_schedule.map((term, idx) => (
                                                            <div key={idx} className="relative group">
                                                                {term.proof_of_transfer ? (
                                                                    <div className="w-10 h-10 rounded border-2 border-emerald-500 overflow-hidden cursor-pointer" onClick={() => window.open(term.proof_of_transfer, '_blank')}>
                                                                        <img src={term.proof_of_transfer} className="w-full h-full object-cover" alt={`Termin ${idx + 1} `} />
                                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                            <span className="text-white text-[8px] font-bold opacity-0 group-hover:opacity-100">{idx + 1}</span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[10px] font-bold">
                                                                        {idx + 1}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {inv.status === 'paid' && <Badge status="paid" className="mt-1">Lunas</Badge>}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {activeTab === 'pending' ? (
                                    <Button variant="outline" onClick={() => setSelectedInv(inv)}><Eye size={16} /> Cek Bukti</Button>
                                ) : (
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                            {inv.approved_by === 'admin' ? '✓ Oleh Admin' : (inv.approved_by ? `✓ Oleh: ${inv.approved_by}` : '✓ Lunas')}
                                        </div>
                                        <div className="text-[10px] text-slate-400 italic">
                                            {inv.approved_at
                                                ? new Date(inv.approved_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                : inv.paid_at
                                                    ? new Date(inv.paid_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                                                    : '-'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 1
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800'
                            : 'bg-white border hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700'
                            }`}
                    >
                        Awal
                    </button>
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-lg transition-colors ${currentPage === 1
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800'
                            : 'bg-white border hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700'
                            }`}
                    >
                        <ChevronLeft size={18} />
                    </button>

                    {/* Page Numbers */}
                    <div className="flex gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (currentPage <= 3) {
                                pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                            } else {
                                pageNum = currentPage - 2 + i;
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`w-10 h-10 rounded-lg text-sm font-bold transition-colors ${currentPage === pageNum
                                        ? 'bg-emerald-600 text-white shadow-lg'
                                        : 'bg-white border hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700'
                                        }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className={`p-2 rounded-lg transition-colors ${currentPage === totalPages
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800'
                            : 'bg-white border hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700'
                            }`}
                    >
                        <ChevronRight size={18} />
                    </button>
                    <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === totalPages
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800'
                            : 'bg-white border hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700'
                            }`}
                    >
                        Akhir
                    </button>
                </div>
            )}

            <Modal
                isOpen={!!selectedInv}
                onClose={() => setSelectedInv(null)}
                title="Validasi Bukti Transfer"
                footer={
                    (selectedInv?.is_installment_request && selectedInv?.status !== 'installment_approved') ? (
                        <div className="flex justify-between w-full">
                            <Button variant="danger" onClick={handleReject}>Tolak Pengajuan</Button>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => setSelectedInv(null)}>Batal</Button>
                                <Button onClick={handleApprove}>Setujui Cicilan</Button>
                            </div>
                        </div>
                    ) : selectedInv?.status === 'installment_approved' ? (
                        <div className="flex justify-end w-full gap-2">
                            <Button variant="secondary" onClick={() => setSelectedInv(null)}>Tutup</Button>
                            <Button onClick={handleApprove}>Update Cicilan</Button>
                        </div>
                    ) : (
                        <div className="flex justify-between w-full">
                            <Button variant="danger" onClick={handleReject}>Tolak (Buram/Salah)</Button>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => setSelectedInv(null)}>Batal</Button>
                                <Button onClick={handleApprove}>Valid & Setujui</Button>
                            </div>
                        </div>
                    )
                }
            >
                {selectedInv && (
                    <div className="space-y-4">
                        {(selectedInv.is_installment_request || selectedInv.status === 'installment_approved') ? (
                            <div className="space-y-8">
                                {/* Section 1: Skema Cicilan (Top) */}
                                <div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                                        <div className="flex justify-between items-center mb-6">
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-white">Skema Cicilan</h4>
                                                <p className="text-xs text-slate-500">{selectedInv.installment_terms_request} Bulan</p>
                                            </div>
                                            {isEditingPlan ? (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            // Restore original plan from selectedInv
                                                            const terms = selectedInv.installment_terms_request || 2;
                                                            const amountPerTerm = Math.ceil(selectedInv.amount / terms);
                                                            const plan = Array.from({ length: terms }, (_, i) => ({
                                                                term: i + 1,
                                                                amount: i === terms - 1 ? selectedInv.amount - (amountPerTerm * (terms - 1)) : amountPerTerm,
                                                                due_date: new Date(Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                                            }));
                                                            setInstallmentPlan(plan);
                                                            setIsEditingPlan(false);
                                                        }}
                                                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-all"
                                                    >
                                                        Batal
                                                    </button>
                                                    <button
                                                        onClick={() => setIsEditingPlan(false)}
                                                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-all"
                                                    >
                                                        Simpan
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setIsEditingPlan(true)}
                                                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border hover:bg-slate-50 text-slate-600 transition-all"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </div>

                                        <div className="max-h-[600px] overflow-y-auto pr-2 space-y-0 relative">
                                            {/* Timeline Line */}
                                            <div className="absolute left-[15px] top-2 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-700" />

                                            {installmentPlan.map((term, idx) => (
                                                <div key={idx} className="relative pl-10 pb-8 last:pb-0 group">
                                                    {/* Timeline Dot */}
                                                    <div className={`absolute left - [9px] top - 1.5 w - 3.5 h - 3.5 rounded - full border - 2 border - white dark: border - slate - 800 ${idx === 0 ? 'bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900/30' : 'bg-slate-300 dark:bg-slate-600'} `} />

                                                    <div className="flex flex-col gap-3">
                                                        {/* Header: Term Info */}
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex flex-col">
                                                                <span className={`text - sm font - bold ${idx === 0 ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-400'} `}>
                                                                    {idx === 0 ? 'Termin 1 (DP)' : `Termin ${term.term} `}
                                                                </span>
                                                                {isEditingPlan ? (
                                                                    <div className="flex gap-2 mt-1">
                                                                        <input
                                                                            type="number"
                                                                            value={term.amount}
                                                                            onChange={e => {
                                                                                const newPlan = [...installmentPlan.map(p => ({ ...p }))];
                                                                                const newValue = parseInt(e.target.value) || 0;
                                                                                if (idx === 0) {
                                                                                    const remainingAmount = selectedInv.amount - newValue;
                                                                                    const remainingTerms = installmentPlan.length - 1;
                                                                                    if (remainingTerms > 0 && remainingAmount >= 0) {
                                                                                        const amountPerTerm = Math.floor(remainingAmount / remainingTerms);
                                                                                        for (let i = 1; i < newPlan.length; i++) newPlan[i].amount = amountPerTerm;
                                                                                        const distributed = amountPerTerm * remainingTerms;
                                                                                        const remainder = remainingAmount - distributed;
                                                                                        newPlan[newPlan.length - 1].amount += remainder;
                                                                                    }
                                                                                }
                                                                                newPlan[idx].amount = newValue;
                                                                                setInstallmentPlan(newPlan);
                                                                            }}
                                                                            className="w-24 text-xs font-bold border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
                                                                            placeholder="Rp..."
                                                                        />
                                                                        <input
                                                                            type="date"
                                                                            value={term.due_date}
                                                                            onChange={e => {
                                                                                const newPlan = [...installmentPlan];
                                                                                newPlan[idx].due_date = e.target.value;
                                                                                setInstallmentPlan(newPlan);
                                                                            }}
                                                                            className="w-auto text-xs border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-xs text-slate-500 mt-0.5">
                                                                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">Rp {term.amount.toLocaleString()}</span>
                                                                        {' • '}
                                                                        <span>{new Date(term.due_date).toLocaleDateString(['id-ID'], { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {term.status === 'verifying' ? (
                                                                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">MENUNGGU VERIFIKASI</span>
                                                            ) : term.status === 'paid' ? (
                                                                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">PAID</span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">MENUNGGU</span>
                                                            )}
                                                        </div>

                                                        {/* Body: Proof Section */}
                                                        <div className="mt-1">
                                                            {(term.proof_of_transfer || term.status === 'verifying' || (idx === 0 && selectedInv.proof_of_transfer)) ? (
                                                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-sm shadow-sm">
                                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Bukti Transfer (Saat Ini)</p>
                                                                    {(selectedInv.proof_of_transfer || term.proof_of_transfer) ? (
                                                                        <div className="relative group rounded-lg overflow-hidden cursor-pointer mb-3" onClick={() => window.open(selectedInv.proof_of_transfer || term.proof_of_transfer, '_blank')}>
                                                                            <img
                                                                                src={selectedInv.proof_of_transfer || term.proof_of_transfer}
                                                                                className="w-full h-auto max-h-[200px] object-cover bg-slate-50"
                                                                                alt={`Bukti Transfer Term ${idx + 1} `}
                                                                            />
                                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
                                                                                <Eye className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                                                                                <span className="absolute bottom-2 right-2 text-[10px] text-white bg-black/50 px-2 py-1 rounded opacity-0 group-hover:opacity-100">Zoom</span>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="bg-slate-50 dark:bg-slate-800 h-24 rounded flex items-center justify-center text-xs text-slate-400 italic mb-3">
                                                                            Tidak ada gambar
                                                                        </div>
                                                                    )}
                                                                    <div className="flex gap-2">
                                                                        <Button variant="danger" size="sm" onClick={() => handleRejectTermPayment(idx)} className="flex-1 text-xs">Tolak (Upload Ulang)</Button>
                                                                        <Button onClick={() => handleApproveTermPayment(idx)} size="sm" className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">Verifikasi & Aktifkan</Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 w-full max-w-sm flex items-center justify-center gap-2 text-slate-400">
                                                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                                                        <ImageIcon size={14} />
                                                                    </div>
                                                                    <span className="text-xs italic">Belum ada bukti pembayaran</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pt-4 mt-2 border-t border-slate-200 dark:border-slate-700">
                                            <div className="flex justify-between items-center text-xs mb-1 text-slate-500">
                                                <span>Total Tagihan</span>
                                                <span>Rp {selectedInv.amount.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm font-bold text-slate-800 dark:text-white">
                                                <span>Rencana</span>
                                                <span className={installmentPlan.reduce((a, b) => a + (b.amount || 0), 0) === selectedInv.amount ? 'text-emerald-600' : 'text-red-500'}>
                                                    Rp {installmentPlan.reduce((a, b) => a + (b.amount || 0), 0).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded text-center">
                                    <img src={selectedInv.proof_of_transfer} className="max-h-[50vh] mx-auto rounded shadow-sm border dark:border-slate-700" alt="Bukti Transfer" />
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                                    <div className="border dark:border-slate-700 p-2 rounded bg-white dark:bg-slate-800">
                                        <span className="text-slate-500 dark:text-slate-400 block text-xs">Nominal Tagihan</span>
                                        <strong className="text-lg text-slate-800 dark:text-white">Rp {selectedInv.amount.toLocaleString()}</strong>
                                        {selectedInv.discount_info && (
                                            <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                        <Ticket size={10} /> Voucher: <span className="font-mono font-bold bg-emerald-50 text-emerald-600 px-1 rounded">{selectedInv.discount_info.code}</span>
                                                    </span>
                                                    <span className="text-xs text-emerald-600 font-bold ml-4">
                                                        Hemat Rp {parseInt(selectedInv.discount_info.amount).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="border dark:border-slate-700 p-2 rounded bg-white dark:bg-slate-800">
                                        <span className="text-slate-500 dark:text-slate-400 block text-xs">Bank Tujuan</span>
                                        <strong className="text-slate-800 dark:text-white">{selectedInv.bank_destination || 'Manual'}</strong>
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
