import React, { useState, useEffect } from 'react';
import { X, ChevronRight, CheckCircle, Smartphone, CreditCard, QrCode } from 'lucide-react';

export const MidtransMock = ({ isOpen, onClose, invoice, onSuccess }) => {
    const [step, setStep] = useState('method'); // method, instructions, processing, success
    const [paymentType, setPaymentType] = useState(null); // va, ewallet, qris
    const [selectedProvider, setSelectedProvider] = useState(null); // bca, mandiri, gopay, etc.
    const [countdown, setCountdown] = useState(59 * 60 + 59); // 1 hour timer

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setStep('method');
            setPaymentType(null);
            setSelectedProvider(null);
        }
    }, [isOpen]);

    if (!isOpen || !invoice) return null;

    const paymentMethods = [
        {
            id: 'va',
            name: 'Virtual Account',
            icon: <CreditCard size={18} />,
            providers: [
                { name: 'BCA', code: 'bca', logo: 'bg-blue-600', color: 'text-blue-600' },
                { name: 'Mandiri', code: 'mandiri', logo: 'bg-yellow-600', color: 'text-yellow-600' },
                { name: 'BNI', code: 'bni', logo: 'bg-orange-600', color: 'text-orange-600' },
                { name: 'BRI', code: 'bri', logo: 'bg-blue-800', color: 'text-blue-800' },
                { name: 'Permata', code: 'permata', logo: 'bg-green-600', color: 'text-green-600' }
            ]
        },
        {
            id: 'ewallet',
            name: 'E-Wallet / QRIS',
            icon: <Smartphone size={18} />,
            providers: [
                { name: 'GoPay', code: 'gopay', logo: 'bg-blue-400', color: 'text-blue-500' },
                { name: 'ShopeePay', code: 'shopeepay', logo: 'bg-orange-500', color: 'text-orange-500' },
                { name: 'QRIS', code: 'qris', logo: 'bg-black', color: 'text-slate-800', isQR: true }
            ]
        }
    ];

    const handleSelectProvider = (typeId, provider) => {
        setPaymentType(typeId);
        setSelectedProvider(provider);
        setStep('instructions');
    };

    const handleSimulatePayment = () => {
        setStep('processing');
        // Simulate network delay
        setTimeout(() => {
            setStep('success');
            // Wait a bit before auto-closing or let user close
            setTimeout(() => {
                onSuccess();
            }, 2000);
        }, 1500);
    };

    // Helper to format countdown
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 animate-fade-in">
            <div className={`bg-white w-full md:max-w-md md:rounded-xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col ${step === 'success' ? 'h-auto' : 'h-[85vh] md:h-[600px]'} transition-all`}>

                {/* HEAD (Navbar) */}
                <div className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm z-10 sticky top-0">
                    <div className="flex items-center gap-2">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/86/Midtrans.png" alt="Midtrans" className="h-5 object-contain" />
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500 border border-slate-200 uppercase tracking-widest">
                            TEST MODE
                        </span>
                        <button onClick={onClose}><X size={22} className="text-slate-400 hover:text-slate-600" /></button>
                    </div>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 relative">

                    {/* Header Summary */}
                    {step !== 'success' && (
                        <div className="bg-white px-4 py-4 mb-2 shadow-sm border-b sticky top-0 z-0">
                            <div className="flex justify-between items-start mb-1">
                                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total</div>
                                <div className="text-xs text-red-500 font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                    {formatTime(countdown)}
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-slate-800">Rp {invoice.amount.toLocaleString('id-ID')}</div>
                            <div className="text-xs text-slate-400 mt-1 flex justify-between">
                                <span>Order ID: #{invoice.id.slice(0, 8)}...</span>
                                <span className="text-blue-600 font-medium cursor-pointer hover:underline">Rincian</span>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: SELECT METHOD */}
                    {step === 'method' && (
                        <div className="p-4 space-y-4">
                            <p className="text-sm font-bold text-slate-700">Pilih Metode Pembayaran</p>

                            {paymentMethods.map(group => (
                                <div key={group.id}>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1 flex items-center gap-1">
                                        {group.icon} {group.name}
                                    </div>
                                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                        {group.providers.map((provider, idx) => (
                                            <div
                                                key={provider.code}
                                                onClick={() => handleSelectProvider(group.id, provider)}
                                                className={`p-3 md:p-4 cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-between ${idx !== group.providers.length - 1 ? 'border-b border-slate-100' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {provider.isQR ? (
                                                        <div className="w-10 h-10 rounded-lg bg-white border flex items-center justify-center shadow-sm">
                                                            <QrCode size={20} className="text-slate-800" />
                                                        </div>
                                                    ) : (
                                                        <div className={`w-10 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white shadow-sm uppercase ${provider.logo}`}>
                                                            {provider.name}
                                                        </div>
                                                    )}
                                                    <span className="font-medium text-sm text-slate-700">{provider.name}</span>
                                                </div>
                                                <ChevronRight size={16} className="text-slate-300" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* STEP 2: INSTRUCTIONS / PAYMENT */}
                    {step === 'instructions' && selectedProvider && (
                        <div className="min-h-full bg-white pb-6">
                            <div className="bg-slate-50 border-b px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setStep('method')}>
                                <ChevronRight className="rotate-180 text-slate-500" size={16} />
                                <span className="text-sm font-bold text-slate-600">Ganti Metode Pembayaran</span>
                            </div>

                            <div className="p-6 flex flex-col items-center pt-8">
                                <div className={`w-16 h-10 rounded mb-4 flex items-center justify-center text-xs font-bold text-white shadow-md uppercase ${selectedProvider.logo.includes('bg-') ? selectedProvider.logo : 'bg-slate-800'}`}>
                                    {selectedProvider.name}
                                </div>

                                {paymentType === 'va' && (
                                    <>
                                        <div className="text-sm text-slate-500 font-medium mb-1">Nomor Virtual Account</div>
                                        <div className="text-2xl font-mono font-bold text-slate-800 tracking-widest mb-6">
                                            8800 {Math.floor(Math.random() * 10000000000)}
                                        </div>
                                        <div className="w-full bg-slate-50 rounded-lg p-4 text-sm text-slate-600 leading-relaxed border border-slate-100">
                                            <p className="font-bold mb-2 text-slate-800">Cara Pembayaran:</p>
                                            <ol className="list-decimal list-inside space-y-1 text-xs">
                                                <li>Buka aplikasi Mobile Banking {selectedProvider.name}</li>
                                                <li>Pilih menu <b>Bayar / Transfer</b></li>
                                                <li>Pilih <b>Virtual Account</b></li>
                                                <li>Masukkan nomor VA di atas</li>
                                                <li>Konfirmasi pembayaran</li>
                                            </ol>
                                        </div>
                                    </>
                                )}

                                {paymentType === 'ewallet' && selectedProvider.isQR && (
                                    <>
                                        <div className="text-sm text-slate-500 font-medium mb-4">Scan QRIS untuk membayar</div>
                                        <div className="bg-white p-4 rounded-xl border-2 border-slate-800 shadow-lg mb-6">
                                            <div className="w-48 h-48 bg-slate-900 flex items-center justify-center relative overflow-hidden">
                                                {/* Fake QR Pattern */}
                                                <div className="absolute inset-0 opacity-50 bg-[url('https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg')] bg-cover"></div>
                                                <div className="w-12 h-12 bg-white p-1 rounded-lg z-10 shadow-sm flex items-center justify-center">
                                                    <div className="font-bold text-[8px]">QRIS</div>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-center text-slate-400 max-w-xs">
                                            Buka aplikasi Gojek, Shopee, OVO, atau Dana dan scan kode QR di atas.
                                        </p>
                                    </>
                                )}

                                {paymentType === 'ewallet' && !selectedProvider.isQR && (
                                    <div className="text-center w-full">
                                        <p className="text-sm text-slate-600 mb-6">
                                            Anda akan diarahkan ke aplikasi <b>{selectedProvider.name}</b> untuk menyelesaikan pembayaran.
                                        </p>
                                        <div className="w-full p-4 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between mb-4">
                                            <span className="text-sm font-bold text-slate-700">Total Tagihan</span>
                                            <span className="text-sm font-bold text-slate-900">Rp {invoice.amount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}

                            </div>

                            {/* Simulator Control */}
                            <div className="mt-8 px-6">
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <div className="text-[10px] font-bold text-yellow-800 uppercase tracking-wide mb-2 text-center border-b border-yellow-200 pb-2">
                                        Midtrans Simulator
                                    </div>
                                    <button
                                        onClick={handleSimulatePayment}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        {paymentType === 'ewallet' && !selectedProvider.isQR ? 'Buka App & Bayar' : 'Simulasikan Bayar Sukses'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: PROCESSING */}
                    {step === 'processing' && (
                        <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-20">
                            <div className="w-16 h-16 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                            <h4 className="font-bold text-slate-800">Uang sedang diverifikasi...</h4>
                            <p className="text-xs text-slate-400 mt-2">Mohon jangan tutup halaman ini</p>
                        </div>
                    )}

                    {/* STEP 4: SUCCESS */}
                    {step === 'success' && (
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-white h-full animate-scale-in">
                            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-6 animate-bounce">
                                <CheckCircle size={48} strokeWidth={3} />
                            </div>
                            <h4 className="font-bold text-2xl text-slate-800 mb-2">Pembayaran Berhasil!</h4>
                            <p className="text-slate-500 text-sm mb-8">Terima kasih, pembayaran Anda telah kami terima.</p>

                            <div className="w-full bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 mb-6">
                                <div className="flex justify-between items-center text-sm mb-2">
                                    <span className="text-slate-500">Metode</span>
                                    <span className="font-bold text-slate-700 uppercase">{selectedProvider?.name || 'Va'}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Total Bayar</span>
                                    <span className="font-bold text-slate-900">Rp {invoice.amount.toLocaleString()}</span>
                                </div>
                            </div>

                            <button onClick={onSuccess} className="text-sm font-bold text-blue-600 hover:text-blue-700 p-2">
                                Kembali ke Merchant dalam 3s...
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
