import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    Wallet, UploadCloud, History, CreditCard, Banknote, ChevronRight, CheckCircle, Printer, Download, Share2, Tag, X, Clock
} from 'lucide-react';
import { Button, Card, Badge } from '../ui/Elements';
import { Modal } from '../ui/Overlays';
import { fileToBase64 } from '../../utils/helpers';
import { MidtransService } from '../../services/MidtransService';
import { MidtransMock } from './MidtransMock';

export default function PaymentHistory({ user, showToast }) {
    const [invoices, setInvoices] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [activeInvoice, setActiveInvoice] = useState(null); // For Payment Gateway
    const [payConfig, setPayConfig] = useState({
        gateway_active: 'manual',
        midtrans_mode: 'sandbox',
        manual_banks: []
    });
    const [uploadProof, setUploadProof] = useState(null);
    const [selectedBank, setSelectedBank] = useState(null);
    const [isInstallment, setIsInstallment] = useState(false);
    const [installmentTerms, setInstallmentTerms] = useState(2);
    const [settings, setSettings] = useState({});

    // Installment Payment State
    const [viewInstallment, setViewInstallment] = useState(null); // To view installment schedule
    const [activeTermPay, setActiveTermPay] = useState(null); // Which term is being paid { index, amount, ... }

    const [viewInvoice, setViewInvoice] = useState(null);
    const invoiceRef = React.useRef(null);

    // Voucher State
    const [voucherCode, setVoucherCode] = useState('');
    const [appliedVoucher, setAppliedVoucher] = useState(null);
    const [calculating, setCalculating] = useState(false);

    const handleDownloadPDF = async () => {
        try {
            const html2canvas = (await import('html2canvas')).default;
            const jsPDF = (await import('jspdf')).default;

            const element = invoiceRef.current;
            if (!element) return;

            const canvas = await html2canvas(element, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4'); // Invoice fits A4
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Invoice_${viewInvoice?.invoice_number_formatted || viewInvoice?.id || 'Bayar'}.pdf`);
        } catch (error) {
            console.error('PDF Generation failed', error);
            alert('Gagal mendownload PDF.');
        }
    };

    const handleShare = async () => {
        const shareData = {
            title: 'Invoice Pembayaran Sekolah',
            text: `Invoice ${viewInvoice?.invoice_number_formatted ? '#' + viewInvoice.invoice_number_formatted : '#' + viewInvoice?.id} sebesar Rp ${viewInvoice?.amount?.toLocaleString()}`,
            url: window.location.href
        };
        if (navigator.share) {
            try { await navigator.share(shareData); } catch (e) { }
        } else {
            navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
            alert('Info invoice disalin!');
        }
    };

    useEffect(() => {
        if (!user) return;

        // Fetch invoices
        const fetchInvoices = async () => {
            const { data } = await supabase
                .from('invoices')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (data) setInvoices(data);
        };

        // Fetch registrations
        const fetchRegistrations = async () => {
            const { data } = await supabase
                .from('registrations')
                .select('*')
                .eq('user_id', user.id);
            if (data) setRegistrations(data);
        };

        // Fetch payment config
        const fetchConfig = async () => {
            const { data } = await supabase
                .from('payment_config')
                .select('*')
                .eq('id', 'main')
                .maybeSingle(); // Better for missing data
            if (data) setPayConfig(data);
        };

        // Fetch settings
        const fetchSettings = async () => {
            const { data } = await supabase
                .from('app_settings') // Fixed table name
                .select('*')
                .eq('id', 'main')
                .maybeSingle();
            if (data) setSettings(data);
        };

        fetchInvoices();
        fetchRegistrations();
        fetchConfig();
        fetchSettings();

        // Real-time subscriptions
        const invoicesChannel = supabase.channel('user_invoices_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `user_id=eq.${user.id}` }, fetchInvoices)
            .subscribe();

        const regsChannel = supabase.channel('user_payment_regs_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `user_id=eq.${user.id}` }, fetchRegistrations)
            .subscribe();

        const configChannel = supabase.channel('payment_config_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_config' }, fetchConfig)
            .subscribe();

        return () => {
            supabase.removeChannel(invoicesChannel);
            supabase.removeChannel(regsChannel);
            supabase.removeChannel(configChannel);
        };
    }, [user]);

    useEffect(() => {
        const checkAndGenerateInvoices = async () => {
            if (!registrations.length) return;

            for (const reg of registrations) {
                const isScholarship = reg.is_scholarship || (reg.path_name && (reg.path_name.toLowerCase().includes('prestasi') || reg.path_name.toLowerCase().includes('yatim')));
                const isIndenInternal = reg.is_indent || reg.is_internal || (reg.path_name && (reg.path_name.toLowerCase().includes('internal') || reg.path_name.toLowerCase().includes('indent')));

                // 1. AUTO-GENERATE MISSING REGISTRATION/INDENT FEE (For existing users stuck)
                if (reg.status === 'submitted' && !isScholarship) {
                    const regFeeId = `reg_fee_${reg.id}`;
                    // Client-side quick check
                    const hasRegFee = invoices.find(inv => inv.id === regFeeId || (inv.registration_id === reg.id && inv.description?.toLowerCase().includes('pendaftaran')));

                    if (!hasRegFee) {
                        try {
                            const { data: units } = await supabase.from('units').select('name, cost_reg').eq('id', reg.unit_id).maybeSingle();
                            const amount = units?.cost_reg || 0;
                            const desc = isIndenInternal ? `Biaya Pendaftaran Inden Internal - ${units?.name || 'Sekolah'}` : `Biaya Pendaftaran - ${units?.name || 'Sekolah'}`;

                            // Serverside check to be safe
                            const { data: remoteExists } = await supabase.from('invoices').select('id').eq('id', regFeeId).maybeSingle();

                            if (!remoteExists) {
                                await supabase.from('invoices').insert({
                                    id: regFeeId,
                                    user_id: user.id,
                                    registration_id: reg.id,
                                    student_name: reg.student_name,
                                    amount: amount,
                                    description: desc,
                                    status: 'pending',
                                    created_at: new Date(reg.created_at || Date.now()).toISOString(),
                                    due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
                                });
                                showToast('Tagihan Pendaftaran baru saja diaktifkan.', 'success');
                            }
                        } catch (err) { console.error("Auto Reg Fee error", err); }
                    }
                }

                // 2. AUTO-GENERATE RE-REGISTRATION FEE (Daftar Ulang)
                if ((reg.status === 'lulus' || reg.status === 'accepted') && reg.agreements_verified === true && !isScholarship) {
                    const deterministicId = `rereg_${reg.id}`;
                    const exists = invoices.find(inv => inv.id === deterministicId || (inv.registration_id === reg.id && inv.description?.toLowerCase().includes('daftar ulang')));

                    if (!exists) {
                        try {
                            // Double check with server
                            const { data: existingInv } = await supabase
                                .from('invoices')
                                .select('id')
                                .eq('id', deterministicId)
                                .maybeSingle();
                            if (existingInv) continue;

                            let amount = 0;
                            // Try Unit Cost
                            if (reg.unit_id) {
                                const { data: unitData } = await supabase
                                    .from('units')
                                    .select('cost_rereg')
                                    .eq('id', reg.unit_id)
                                    .maybeSingle();
                                if (unitData?.cost_rereg) {
                                    amount = parseInt(unitData.cost_rereg);
                                }
                            }
                            // Fallback to Global
                            if (!amount && settings.reregistration_fee) {
                                amount = parseInt(settings.reregistration_fee);
                            }

                            if (amount > 0) {
                                const invData = {
                                    id: deterministicId,
                                    registration_id: reg.id,
                                    student_name: reg.student_name,
                                    amount: amount,
                                    description: 'Biaya Daftar Ulang',
                                    status: 'pending',
                                    created_at: new Date().toISOString(),
                                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                                    user_id: user.id
                                };

                                await supabase.from('invoices').insert(invData);
                                showToast('Tagihan Daftar Ulang berhasil dibuat.', 'success');
                            }
                        } catch (e) {
                            console.error("Auto invoice creation failed", e);
                        }
                    }
                }
            }
        };

        if (user && settings) {
            checkAndGenerateInvoices();
        }
    }, [registrations, invoices, settings, user]);

    const handlePay = async (inv) => {
        if (!inv) return;
        console.log("Initiating payment for invoice:", inv.id);

        // Validation for Daftar Ulang (Must upload Agreement & MCU)
        const isDaftarUlang = inv.description?.toLowerCase().includes('daftar ulang') || inv.description?.toLowerCase().includes('re-registration');

        if (isDaftarUlang) {
            try {
                const { data: regData } = await supabase
                    .from('registrations')
                    .select('uploaded_docs, id')
                    .eq('id', inv.registration_id)
                    .single();

                if (regData) {
                    const docs = regData.uploaded_docs || {};
                    const hasRokok = docs.agreement_rokok;
                    const hasLGBT = docs.agreement_lgbt;
                    const hasKriminal = docs.agreement_kriminal;
                    const hasMCU = docs.mcu_letter;

                    if (!hasRokok || !hasLGBT || !hasKriminal || !hasMCU) {
                        showToast('Harap lengkapi 3 Surat Pernyataan & Surat Sehat (MCU) di menu Data Anak!', 'error');
                        return;
                    }
                }
            } catch (e) {
                console.error("Payment Doc Check Error:", e);
                // Continue anyway if query fails to avoid blocking user completely? 
                // No, better to be safe but let's not crash.
            }
        }

        // Set Active Invoice to trigger the modal
        if (payConfig.gateway_active === 'midtrans') {
            try {
                showToast('Menyiapkan gerbang pembayaran...', 'info');
                const token = await MidtransService.getSnapToken(inv);

                if (window.snap) {
                    window.snap.pay(token, {
                        onSuccess: (result) => {
                            console.log('payment success!', result);
                            onPaymentSuccess(inv); // Use existing success handler
                        },
                        onPending: (result) => {
                            console.log('payment pending!', result);
                            showToast('Pembayaran tertunda/menunggu bayar.', 'info');
                        },
                        onError: (result) => {
                            console.log('payment error!', result);
                            showToast('Pembayaran gagal.', 'error');
                        },
                        onClose: () => {
                            console.log('customer closed the popup tanpa menyelesaikan pembayaran');
                        }
                    });
                } else {
                    throw new Error("SDK Midtrans tidak termuat. Periksa koneksi internet.");
                }
            } catch (err) {
                console.error("Real Snap Error:", err);

                // Detailed error for CORS/Network vs API errors
                let errMsg = err.message;
                if (err.message.includes('Failed to fetch')) {
                    errMsg = "Gagal terhubung ke Server Token (CORS/Network Error). Pastikan Edge Function sudah dideploy.";
                }

                showToast(errMsg, 'error');

                // Fallback to Mock if in Sandbox, but with a warning
                if (payConfig.midtrans_mode === 'sandbox') {
                    console.warn("Falling back to Internal Simulator due to error.");
                    // Only open if the user hasn't seen the error toast yet or as a choice? 
                    // For now, let's still open but inform them.
                    setActiveInvoice(inv);
                }
            }
        } else {
            setActiveInvoice(inv);
        }
    };

    const handleManualUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const base64 = await fileToBase64(file);
            setUploadProof(base64);
        } catch (err) { showToast(err.message, 'error'); }
    };

    const handleApplyVoucher = async () => {
        if (!voucherCode) return;
        setCalculating(true);
        try {
            // Find voucher from Supabase
            const { data: voucherData, error } = await supabase
                .from('vouchers')
                .select('*')
                .eq('code', voucherCode.toUpperCase().trim())
                .eq('active', true)
                .single();

            if (error || !voucherData) throw new Error('Kode voucher tidak ditemukan atau tidak aktif.');

            const voucher = voucherData;

            if (voucher.quota > 0 && (voucher.used || 0) >= voucher.quota) {
                throw new Error('Kuota voucher telah habis.');
            }

            if (!activeInvoice.description.toLowerCase().includes('daftar ulang')) {
                throw new Error('Voucher ini hanya berlaku untuk Daftar Ulang.');
            }

            // Calculate Discount
            let discount = 0;
            if (voucher.type === 'fixed') {
                discount = voucher.amount;
            } else {
                discount = (activeInvoice.amount * voucher.amount) / 100;
            }

            if (discount > activeInvoice.amount) discount = activeInvoice.amount;

            setAppliedVoucher({
                ...voucher,
                discount_amount: discount,
                final_amount: activeInvoice.amount - discount
            });
            showToast('Voucher berhasil dipasang!', 'success');
        } catch (error) {
            showToast(error.message, 'error');
            setAppliedVoucher(null);
        } finally {
            setCalculating(false);
        }
    };

    const removeVoucher = () => {
        setAppliedVoucher(null);
        setVoucherCode('');
    };

    const submitManualPayment = async () => {
        // Handle Installment Request (Initial)
        if (isInstallment) {
            try {
                const updates = {
                    status: 'requesting_installment',
                    installment_terms_request: parseInt(installmentTerms),
                    requested_at: new Date().toISOString(),
                    is_installment_request: true
                };

                await supabase.from('invoices').update(updates).eq('id', activeInvoice.id);

                showToast('Pengajuan cicilan berhasil dikirim. Menunggu persetujuan admin.');
                setActiveInvoice(null); setUploadProof(null); setSelectedBank(null); setAppliedVoucher(null); setVoucherCode('');
                setIsInstallment(false);
            } catch (err) { console.error(err); showToast('Gagal mengirim pengajuan.', 'error'); }
            return;
        }

        if (!uploadProof) return showToast('Bukti transfer harus diupload!', 'error');
        if (!selectedBank && payConfig.manual_banks?.length > 0) return showToast('Pilih bank tujuan transfer!', 'error');

        try {
            // Handle Installment Term Payment
            if (activeTermPay !== null && activeInvoice) {
                const newSchedule = [...activeInvoice.installment_schedule];
                newSchedule[activeTermPay.index] = {
                    ...newSchedule[activeTermPay.index],
                    status: 'verifying',
                    paid_at: new Date().toISOString(),
                    bank_destination: selectedBank || 'Manual'
                };

                // Self-Healing Term Mapping
                if ('proof_of_transfer' in newSchedule[activeTermPay.index] || !('payment_proof' in newSchedule[activeTermPay.index])) {
                    newSchedule[activeTermPay.index].proof_of_transfer = uploadProof;
                } else {
                    newSchedule[activeTermPay.index].payment_proof = uploadProof;
                }

                await supabase.from('invoices').update({ installment_schedule: newSchedule }).eq('id', activeInvoice.id);

                showToast('Bukti pembayaran cicilan berhasil dikirim. Menunggu verifikasi.');
                setActiveInvoice(null); setUploadProof(null); setSelectedBank(null);
                setActiveTermPay(null);
                return;
            }

            // Normal Full Payment
            const updates = {
                status: 'verifying_payment',
                paid_at: new Date().toISOString(),
                bank_destination: selectedBank || 'Manual'
            };

            // Self-Healing Column Detection
            if ('proof_of_transfer' in activeInvoice || !('payment_proof' in activeInvoice)) {
                updates.proof_of_transfer = uploadProof;
            } else {
                updates.payment_proof = uploadProof;
            }

            // If voucher applied, include it in updates and increment usage
            if (appliedVoucher) {
                updates.original_amount = activeInvoice.amount;
                updates.amount = appliedVoucher.final_amount;
                updates.discount_info = {
                    code: appliedVoucher.code,
                    amount: appliedVoucher.discount_amount,
                    type: appliedVoucher.type,
                    value: appliedVoucher.amount
                };

                // Increment voucher usage using RPC or manual increment
                const { data: vData } = await supabase.from('vouchers').select('used').eq('id', appliedVoucher.id).single();
                await supabase.from('vouchers').update({ used: (vData?.used || 0) + 1 }).eq('id', appliedVoucher.id);
            }

            await supabase.from('invoices').update(updates).eq('id', activeInvoice.id);

            const regUpdates = { status: 'verifying_payment' };
            if (appliedVoucher) {
                regUpdates.voucher_code = appliedVoucher.code;
            }

            await supabase.from('registrations').update(regUpdates).eq('id', activeInvoice.registration_id);

            // Update CRM Lead status to 'bayar_daftar' (syncs with kanban)
            try {
                const userPhone = user.user_metadata?.phone || user.phone;
                if (userPhone) {
                    const sanitizedPhone = userPhone.replace(/[^0-9]/g, '');
                    await supabase
                        .from('leads')
                        .update({
                            status: 'bayar_daftar',
                            notes: `Bukti bayar dikirim untuk: ${activeInvoice.student_name}`,
                            updated_at: new Date().toISOString()
                        })
                        .eq('phone', sanitizedPhone);
                }
            } catch (crmError) {
                console.warn("CRM lead update skipped:", crmError);
            }

            showToast('Bukti pembayaran berhasil dikirim. Menunggu verifikasi admin.');
            setActiveInvoice(null); setUploadProof(null); setSelectedBank(null); setAppliedVoucher(null); setVoucherCode('');
        } catch (err) { console.error(err); showToast('Gagal kirim bukti.', 'error'); }
    };

    // Callback for Mock Gateway (Refactored to take inv)
    const onPaymentSuccess = async (targetInv = activeInvoice) => {
        if (!targetInv) return;
        try {
            const updates = {
                status: 'paid',
                paid_at: new Date().toISOString(),
                payment_method: 'Midtrans VA',
                transaction_id: `MID-${Date.now()}`
            };
            await supabase.from('invoices').update(updates).eq('id', targetInv.id);

            // Update Registration Status
            const { data: regData } = await supabase
                .from('registrations')
                .select('status')
                .eq('id', targetInv.registration_id)
                .single();

            const currentRegStatus = regData?.status;
            let newRegStatus = 'verified';
            if (currentRegStatus === 'lulus' || targetInv.description.toLowerCase().includes('daftar ulang')) {
                newRegStatus = 'paid';
            }

            await supabase.from('registrations').update({ status: newRegStatus }).eq('id', targetInv.registration_id);

            showToast('Pembayaran Berhasil! Status pendaftaran diperbarui.', 'success');
            setActiveInvoice(null);
        } catch (err) { console.error(err); showToast('Gagal memproses status pembayaran.', 'error'); }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><History className="text-emerald-600" /> Riwayat Tagihan & Pembayaran</h2>

            {/* Manual Transfer Modal */}
            {activeInvoice && payConfig.gateway_active === 'manual' && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="font-bold text-lg mb-4 text-slate-800">
                            {activeTermPay ? `Bayar Cicilan #${activeTermPay.term}` : 'Transfer Manual'}
                        </h3>
                        <div className="bg-slate-50 p-4 rounded-lg mb-4 border border-slate-100">
                            <div className="text-xs text-slate-500 mb-1">Total Tagihan</div>
                            {activeTermPay ? (
                                <div className="text-2xl font-bold text-slate-800 mb-2">Rp {activeTermPay.amount.toLocaleString()}</div>
                            ) : appliedVoucher ? (
                                <div>
                                    <div className="flex items-center gap-2 text-slate-400 line-through text-sm">
                                        Rp {activeInvoice.amount.toLocaleString()}
                                    </div>
                                    <div className="text-2xl font-bold text-emerald-600 mb-2">
                                        Rp {appliedVoucher.final_amount.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-flex items-center gap-1 border border-emerald-100">
                                        <Tag size={12} /> Hemat Rp {appliedVoucher.discount_amount.toLocaleString()} ({appliedVoucher.code})
                                    </div>
                                </div>
                            ) : (
                                <div className="text-2xl font-bold text-slate-800 mb-2">Rp {activeInvoice.amount.toLocaleString()}</div>
                            )}

                            <div className="text-xs text-slate-500 mt-2 pt-2 border-t flex justify-between items-center">
                                <span>{activeInvoice.description}</span>
                                {activeInvoice.description.toLowerCase().includes('daftar ulang') && !appliedVoucher && !activeTermPay && (
                                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded animate-pulse">Diskon Tersedia?</span>
                                )}
                            </div>
                        </div>

                        {/* Voucher Input - Only for Daftar Ulang - HIDDEN if Paying Specific Term */}
                        {!activeTermPay && activeInvoice.description.toLowerCase().includes('daftar ulang') && (
                            <div className="mb-4">
                                <label className="text-sm font-bold text-slate-700 block mb-2">Punya Kode Voucher?</label>
                                {appliedVoucher ? (
                                    <div className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle size={16} className="text-green-600" />
                                            <span className="font-bold text-green-700 text-sm">{appliedVoucher.code}</span>
                                        </div>
                                        <button onClick={removeVoucher} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            placeholder="Masukkan Kode Voucher"
                                            value={voucherCode}
                                            onChange={e => setVoucherCode(e.target.value)}
                                            className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                                        />
                                        <Button variant="secondary" onClick={handleApplyVoucher} disabled={calculating || !voucherCode} className="whitespace-nowrap">
                                            {calculating ? '...' : 'Gunakan'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mb-4 pt-4 border-t">
                            {/* Only Show Installment Option if NOT paying a specific term and NOT already in installment AND is Re-registration */}
                            {!activeTermPay && (activeInvoice.description?.toLowerCase().includes('daftar ulang') || activeInvoice.type === 're_registration') && (
                                <div className="flex items-start gap-3">
                                    <div className="pt-1">
                                        <input
                                            type="checkbox"
                                            id="installmentCheck"
                                            checked={isInstallment}
                                            onChange={e => setIsInstallment(e.target.checked)}
                                            className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label htmlFor="installmentCheck" className="text-sm font-bold text-slate-800 cursor-pointer select-none">
                                            Ajukan Pembayaran Bertahap (Cicilan)
                                        </label>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Centang opsi ini jika Anda ingin mengajukan pembayaran secara bertahap (cicilan).
                                        </p>

                                        {isInstallment && (
                                            <div className="mt-3 bg-blue-50 border border-blue-100 p-3 rounded-lg animate-fade-in">
                                                <label className="text-xs font-bold text-slate-700 block mb-1">Rencana Termin (Durasi)</label>
                                                <select
                                                    value={installmentTerms}
                                                    onChange={e => setInstallmentTerms(e.target.value)}
                                                    className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="2">2 Bulan (2x Pembayaran)</option>
                                                    <option value="3">3 Bulan (3x Pembayaran)</option>
                                                    <option value="4">4 Bulan (4x Pembayaran)</option>
                                                </select>
                                                <p className="text-[10px] text-blue-600 mt-2">
                                                    * Besaran cicilan dan jatuh tempo akan ditentukan oleh Admin setelah pengajuan disetujui.
                                                </p>
                                                <p className="text-[10px] text-blue-600 mt-2">
                                                    * Jika Anda mengajukan pembayaran bertahap (cicilan), Diskon atau Voucher dalam bentuk apapun tidak bisa di CLAIM.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {!isInstallment && (<>
                            <div className="mb-4">
                                <label className="text-sm font-bold text-slate-700 block mb-2">1. Transfer ke salah satu rekening:</label>
                                <div className="space-y-2">
                                    {payConfig.manual_banks && payConfig.manual_banks.map((bank, idx) => (
                                        <div key={idx} onClick={() => setSelectedBank(`${bank.bank_name} - ${bank.account_number}`)} className={`border p-3 rounded-lg cursor-pointer transition-all flex justify-between items-center ${selectedBank?.includes(bank.account_number) ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'hover:border-slate-300'}`}>
                                            <div>
                                                <div className="font-bold text-slate-800">{bank.bank_name}</div>
                                                <div className="font-mono text-slate-600 text-sm">{bank.account_number}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">a.n {bank.holder_name}</div>
                                            </div>
                                            {selectedBank?.includes(bank.account_number) && <div className="w-4 h-4 rounded-full bg-emerald-500"></div>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-6 animate-fade-in">
                                <label className="text-sm font-bold text-slate-700 block mb-2">2. Upload Bukti Transfer:</label>
                                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors relative">
                                    <input type="file" accept="image/*" onChange={handleManualUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                    {uploadProof ? (
                                        <div className="text-emerald-600 text-sm font-bold flex flex-col items-center gap-2">
                                            <img src={uploadProof} className="max-h-24 rounded border shadow-sm" alt="Preview" />
                                            <span>Ganti File</span>
                                        </div>
                                    ) : (
                                        <div className="text-slate-400 flex flex-col items-center gap-2">
                                            <UploadCloud size={24} />
                                            <span className="text-xs">Klik untuk upload (Max 500KB)</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>)}

                        <div className="flex gap-2">
                            <Button onClick={submitManualPayment} className="flex-1 px-8">
                                {isInstallment
                                    ? 'Kirim Pengajuan Cicilan'
                                    : (activeTermPay ? `Bayar Cicilan Rp ${activeTermPay.amount.toLocaleString()}` : (appliedVoucher ? `Bayar Rp ${appliedVoucher.final_amount.toLocaleString()}` : 'Kirim Bukti Bayar'))
                                }
                            </Button>
                            <Button variant="secondary" onClick={() => { setActiveInvoice(null); setUploadProof(null); setSelectedBank(null); setAppliedVoucher(null); setVoucherCode(''); setActiveTermPay(null); }}>Batal</Button>
                        </div>
                    </Card>
                </div>
            )}


            <MidtransMock
                isOpen={!!activeInvoice && payConfig.gateway_active === 'midtrans' && payConfig.midtrans_mode !== 'production'}
                onClose={() => setActiveInvoice(null)}
                invoice={activeInvoice}
                onSuccess={onPaymentSuccess}
            />

            <div className="space-y-4">
                {invoices.length === 0 ? (
                    <div className="text-slate-400 text-center py-10 bg-white rounded-xl border border-dashed text-sm">Belum ada history tagihan.</div>
                ) : (
                    invoices.map(inv => (
                        <Card key={inv.id} className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-full mt-1 ${inv.status === 'paid' ? 'bg-green-100 text-green-600' : (inv.status === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600')}`}>
                                    {inv.status === 'paid' ? <CheckCircle size={24} /> : (inv.status === 'pending' ? <Wallet size={24} /> : <History size={24} />)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-lg">Rp {inv.amount.toLocaleString()}</h4>
                                    <p className="font-medium text-slate-600 text-sm">{inv.description}</p>
                                    <p className="text-xs text-slate-400 mt-1">{inv.student_name} • {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '-'}</p>
                                    {inv.payment_method && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 mt-2 inline-block font-mono">Via {inv.payment_method}</span>}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                                <Badge status={inv.status} />
                                {inv.status === 'pending' && !inv.is_installment && (
                                    <div className="w-full md:w-auto flex flex-col items-center gap-1">
                                        <Button onClick={() => handlePay(inv)} className="w-full md:w-auto text-xs py-2 px-4 shadow-orange-100 bg-orange-500 hover:bg-orange-600">
                                            <CreditCard size={14} className="mr-1" /> Bayar Sekarang
                                        </Button>
                                        {payConfig.gateway_active === 'midtrans' && (
                                            <button
                                                onClick={() => setActiveInvoice(inv)}
                                                className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                                            >
                                                Punya Bukti Transfer? Klik disini
                                            </button>
                                        )}
                                    </div>
                                )}
                                {inv.status === 'installment_approved' && (
                                    <Button onClick={() => setViewInstallment(inv)} className="w-full md:w-auto text-xs py-2 px-4 shadow-blue-100 bg-blue-500 hover:bg-blue-600">
                                        <Clock size={14} className="mr-1" /> Lihat Cicilan
                                    </Button>
                                )}
                                {inv.status === 'requesting_installment' && (
                                    <span className="text-xs text-orange-500 italic bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                        Verifikasi Pengajuan Cicilan
                                    </span>
                                )}
                                {inv.status === 'paid' && (
                                    <Button variant="secondary" onClick={() => setViewInvoice(inv)} className="w-full md:w-auto text-xs py-1.5 px-3">
                                        <Printer size={14} className="mr-1" /> Cetak Invoice
                                    </Button>
                                )}
                                {inv.status === 'verifying_payment' && (
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge status="processing">Menunggu Verifikasi</Badge>
                                        <span className="text-[10px] text-slate-400 italic">Admin akan segera mengecek bukti bayar Anda</span>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))
                )}
                {/* Installment Detail Modal */}
                <Modal
                    isOpen={!!viewInstallment}
                    onClose={() => setViewInstallment(null)}
                    title="Rencana Pembayaran Cicilan"
                    maxWidth="max-w-lg"
                >
                    {viewInstallment && (
                        <div className="space-y-4">
                            <div className="bg-slate-50 p-4 rounded-lg flex justify-between items-center">
                                <div>
                                    <span className="text-xs text-slate-500 block">Total Tagihan</span>
                                    <span className="font-bold text-slate-800">Rp {viewInstallment.amount.toLocaleString()}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-slate-500 block">Sisa Pembayaran</span>
                                    <span className="font-bold text-red-600">
                                        Rp {(viewInstallment.installment_schedule.reduce((acc, curr) => curr.status === 'paid' ? acc : acc + curr.amount, 0)).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {viewInstallment.installment_schedule.map((term, idx) => {
                                    const dueDateSafe = term.due_date ? new Date(term.due_date) : new Date();
                                    const isValidDate = !isNaN(dueDateSafe.getTime());

                                    return (
                                        <div key={idx} className={`border rounded-lg p-3 flex justify-between items-center ${term.status === 'paid' ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-700">Cicilan #{term.term}</span>
                                                    {term.status === 'paid' && <Badge status="paid" />}
                                                    {term.status === 'verifying' && <Badge status="processing">Verifikasi</Badge>}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Jatuh Tempo: {isValidDate ? dueDateSafe.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-slate-800 mb-1">Rp {term.amount.toLocaleString()}</div>
                                                {term.status === 'unpaid' && (
                                                    <Button size="sm" onClick={() => {
                                                        setActiveInvoice(viewInstallment); // Use same invoice
                                                        setActiveTermPay({ index: idx, ...term }); // Set term context
                                                        setViewInstallment(null); // Close list modal, open payment modal
                                                    }}>
                                                        Bayar
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button variant="secondary" onClick={() => setViewInstallment(null)}>Tutup</Button>
                            </div>
                        </div>
                    )}
                </Modal>

            </div>

            {/* Printable Invoice Modal */}
            <Modal
                isOpen={!!viewInvoice}
                onClose={() => setViewInvoice(null)}
                title="Cetak Invoice Formal"
                maxWidth="max-w-5xl"
                footer={
                    <div className="flex justify-end gap-2 w-full print:hidden">
                        <Button variant="secondary" onClick={() => setViewInvoice(null)}>Tutup</Button>
                        <Button variant="secondary" onClick={handleDownloadPDF}><Download size={16} /></Button>
                        <Button variant="secondary" onClick={handleShare}><Share2 size={16} /></Button>
                        <Button onClick={() => window.print()}><Printer size={16} className="mr-2" /> Cetak</Button>
                    </div>
                }
            >
                {viewInvoice && (
                    <div className="w-full bg-slate-200 p-4 md:p-8 overflow-auto flex justify-center">
                        <div
                            className="bg-white text-slate-900 shadow-2xl mx-auto relative flex flex-col"
                            style={{
                                width: '210mm',
                                minHeight: '297mm',
                                padding: '15mm',
                                boxSizing: 'border-box'
                            }}
                            id="invoice-print"
                            ref={invoiceRef}
                        >
                            {/* Formal Header */}
                            <div className="flex justify-between items-center border-b-4 border-double border-slate-800 pb-6 mb-8 gap-6">
                                {/* LOGO SEKOLAH */}
                                {settings.app_logo && (
                                    <div className="w-24 h-24 flex-shrink-0 flex items-center justify-center">
                                        <img src={settings.app_logo} className="w-full h-full object-contain" alt="Logo" />
                                    </div>
                                )}

                                <div className="flex-1">
                                    <h1 className="text-3xl font-serif font-black text-slate-900 uppercase tracking-wide leading-tight mb-2">
                                        {settings.school_name || 'Sekolah Islam Terpadu Cendekia'}
                                    </h1>
                                    <div className="text-sm font-serif text-slate-600 leading-snug">
                                        <p>{settings.school_address || 'Jl. Pendidikan No. 1, Kota Bogor, Jawa Barat'}</p>
                                        <p>Telp: {settings.school_phone || '(0251) 8312345'} | Email: {settings.school_email || 'admin@sekolahku.sch.id'}</p>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <h2 className="text-5xl font-serif font-bold text-slate-100 tracking-widest select-none">INVOICE</h2>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="flex justify-between items-start mb-10 font-serif">
                                <div className="w-1/2 pr-8 border-r border-slate-100">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Ditagihkan Kepada:</h3>
                                    <p className="text-xl font-bold text-slate-900">{viewInvoice.student_name}</p>
                                    <p className="text-sm text-slate-600 italic mt-1">Wali Murid / Orang Tua</p>
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <p className="text-xs text-slate-500">ID Registrasi:</p>
                                        <p className="font-mono text-sm">{viewInvoice.registration_id.slice(0, 8).toUpperCase()}</p>
                                    </div>
                                </div>
                                <div className="w-1/2 pl-8 flex flex-col items-end text-right">
                                    <div className="mb-4">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nomor Invoice</h3>
                                        <p className="text-lg font-mono font-bold text-slate-900">
                                            {viewInvoice.invoice_number_formatted ?
                                                `#${viewInvoice.invoice_number_formatted}` :
                                                `#${settings.invoice_prefix || ''}${viewInvoice.id.slice(0, 10).toUpperCase()}`
                                            }
                                        </p>
                                    </div>
                                    <div className="mb-4">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Tanggal & Waktu Bayar</h3>
                                        <p className="font-serif text-lg text-slate-800">
                                            {viewInvoice.paid_at ? new Date(viewInvoice.paid_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {viewInvoice.paid_at ? new Date(viewInvoice.paid_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : ''}
                                        </p>
                                    </div>
                                    <div className="border border-green-200 bg-green-50 text-green-700 px-4 py-2 rounded text-sm font-bold uppercase tracking-widest">
                                        LUNAS / PAID
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="mb-8 flex-1">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="border-y-2 border-slate-800">
                                            <th className="py-3 text-left font-serif font-bold text-slate-800 uppercase text-sm w-[60%]">Deskripsi Layanan</th>
                                            <th className="py-3 text-right font-serif font-bold text-slate-800 uppercase text-sm">Nominal (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="py-6 border-b border-slate-200 align-top">
                                                <p className="font-bold text-lg text-slate-800 mb-1">{viewInvoice.description}</p>
                                                <p className="text-sm text-slate-500 font-serif">Pembayaran Administrasi Sekolah</p>

                                                {viewInvoice.is_installment && (
                                                    <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded text-sm font-mono">
                                                        <p className="font-bold text-slate-700 underline mb-1">Rincian Cicilan:</p>
                                                        <ul className="list-disc list-inside">
                                                            {viewInvoice.installment_schedule?.map((t, idx) => (
                                                                <li key={idx} className={t.status === 'paid' ? 'text-green-600' : 'text-slate-500'}>
                                                                    Term {t.term}: Rp {t.amount.toLocaleString()} ({t.status})
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {viewInvoice.discount_info && (
                                                    <div className="mt-2 text-sm text-emerald-600 italic">
                                                        Termasuk Potongan Voucher: {viewInvoice.discount_info.code}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-6 border-b border-slate-200 text-right align-top">
                                                <p className="font-mono text-lg text-slate-800">
                                                    Rp {(viewInvoice.original_amount || viewInvoice.amount).toLocaleString()}
                                                </p>
                                                {viewInvoice.discount_info && (
                                                    <p className="font-mono text-sm text-red-500">
                                                        - Rp {viewInvoice.discount_info.amount.toLocaleString()}
                                                    </p>
                                                )}
                                            </td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td className="pt-4 text-right font-serif font-bold text-slate-600 uppercase pr-8">Total Pembayaran</td>
                                            <td className="pt-4 text-right font-mono font-bold text-2xl text-slate-900 border-t-2 border-slate-800 mt-2 block">
                                                Rp {viewInvoice.amount.toLocaleString()}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Footer / Signature */}
                            <div className="mt-auto pt-16 grid grid-cols-2 gap-16 items-end">
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm mb-2">Metode Pembayaran:</h4>
                                    <div className="p-3 border border-slate-200 rounded text-sm text-slate-600 bg-slate-50 mb-6">
                                        <p>{viewInvoice.payment_method || 'Manual Transfer'}</p>
                                        {viewInvoice.bank_destination && <p className="font-mono text-xs mt-1">{viewInvoice.bank_destination}</p>}
                                    </div>
                                    <div className="text-xs text-slate-400 leading-relaxed font-serif">
                                        {settings.invoice_footer_note || 'Bukti pembayaran ini adalah dokumen sah yang diterbitkan sistem komputerisasi.'}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-serif text-slate-600 mb-6">
                                        {settings.school_address?.split(',')[1] || 'Kota Bogor'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>

                                    <div className="relative h-28 w-full flex items-center justify-center mb-2">
                                        {(settings.finance_signature || settings.signature_image) && (
                                            <img src={settings.finance_signature || settings.signature_image} className="h-full w-auto object-contain mix-blend-multiply opacity-90" alt="Tanda Tangan" style={{ maxWidth: '150px' }} />
                                        )}
                                    </div>

                                    <p className="font-bold text-slate-800 uppercase text-sm border-b border-slate-800 inline-block px-4 pb-1">
                                        {settings.finance_head || settings.committee_head || 'Bendahara Sekolah'}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {settings.finance_position || 'Bagian Keuangan'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
