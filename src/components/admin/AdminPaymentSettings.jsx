import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    Wallet, CreditCard, Banknote, Trash2, Tag, Plus, Calendar, Percent
} from 'lucide-react';
import { Card, Button, Input, Select } from '../ui/Elements';
import { Modal } from '../ui/Overlays';

export default function AdminPaymentSettings({ showToast }) {
    const [payConfig, setPayConfig] = useState({
        registration_fee: 0, reregistration_fee: 0,
        gateway_active: 'manual',
        midtrans_client_key: '', midtrans_server_key: '', midtrans_merchant_id: '',
        midtrans_mode: 'sandbox', // sandbox or production
        manual_banks: []
    });
    const [editingBank, setEditingBank] = useState(null);


    useEffect(() => {
        const fetchConfig = async () => {
            const { data, error } = await supabase.from('payment_config').select('*').eq('id', 'main').maybeSingle();
            if (data) setPayConfig(data);
            if (error && error.code !== 'PGRST116') console.error("Error fetching payment config:", error);
        };
        fetchConfig();
    }, []);

    const handleSaveConfig = async () => {
        // Strip out legacy fields from user DB
        const { registration_fee, reregistration_fee, ...cleanConfig } = payConfig;
        cleanConfig.id = 'main'; // Ensure ID

        const { error } = await supabase.from('payment_config').upsert(cleanConfig);

        if (error) {
            console.error(error);
            if (showToast) showToast('Gagal menyimpan pengaturan', 'error');
        } else {
            if (showToast) showToast('Pengaturan Pembayaran disimpan (Data Lama Dibersihkan)', 'success');
        }
    };

    const handleAddBank = () => {
        if (!editingBank) return;
        const newBanks = [...(payConfig.manual_banks || []), editingBank];
        setPayConfig({ ...payConfig, manual_banks: newBanks });
        setEditingBank(null);
    };
    const handleRemoveBank = (idx) => {
        const newBanks = (payConfig.manual_banks || []).filter((_, i) => i !== idx);
        setPayConfig({ ...payConfig, manual_banks: newBanks });
    };



    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800 dark:text-white"><Wallet className="text-emerald-600" /> Pengaturan Pembayaran</h2>
            <Card className="p-6 bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                    <Tag size={20} />
                    <span className="font-bold">Info Tarif & Biaya</span>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 ml-7">
                    Pengaturan Biaya Pendaftaran dan Daftar Ulang sekarang dikelola secara spesifik pada menu <strong>Cabang Sekolah & Kuota</strong>.
                </p>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* MIDTRANS CONFIG */}
                <Card className={`p-6 border-2 ${payConfig.gateway_active === 'midtrans' ? 'border-emerald-500' : 'border-slate-100 dark:border-slate-700'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white"><CreditCard /> Payment Gateway (Midtrans)</h3>
                        <input type="radio" name="pg" checked={payConfig.gateway_active === 'midtrans'} onChange={() => setPayConfig({ ...payConfig, gateway_active: 'midtrans' })} className="w-5 h-5 cursor-pointer" />
                    </div>
                    <div className="space-y-3">
                        <div className="mb-4">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-2">Mode Midtrans</label>
                            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                                <button
                                    onClick={() => setPayConfig({ ...payConfig, midtrans_mode: 'sandbox' })}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${payConfig.midtrans_mode === 'sandbox' ? 'bg-white dark:bg-slate-600 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Sandbox (Testing)
                                </button>
                                <button
                                    onClick={() => setPayConfig({ ...payConfig, midtrans_mode: 'production' })}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${payConfig.midtrans_mode === 'production' ? 'bg-white dark:bg-emerald-600 text-red-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Production (Live)
                                </button>
                            </div>
                        </div>
                        <Input label="Merchant ID" value={payConfig.midtrans_merchant_id || ''} onChange={e => setPayConfig({ ...payConfig, midtrans_merchant_id: e.target.value })} />
                        <Input label="Client Key" value={payConfig.midtrans_client_key || ''} onChange={e => setPayConfig({ ...payConfig, midtrans_client_key: e.target.value })} />
                        <Input label="Server Key" type="password" value={payConfig.midtrans_server_key || ''} onChange={e => setPayConfig({ ...payConfig, midtrans_server_key: e.target.value })} />
                        <p className="text-xs text-slate-500">
                            {payConfig.midtrans_mode === 'sandbox' ? '🛡️ Menggunakan simulator internal (tidak mengirim tagihan asli).' : '🚀 Menggunakan Midtrans Snap API (pastikan API Key Production benar).'}
                        </p>
                        {payConfig.gateway_active === 'midtrans' && <Button onClick={handleSaveConfig} className="w-full">Simpan Konfigurasi</Button>}
                    </div>
                </Card>

                {/* MANUAL TRANSFER CONFIG */}
                <Card className={`p-6 border-2 ${payConfig.gateway_active === 'manual' ? 'border-emerald-500' : 'border-slate-100 dark:border-slate-700'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white"><Banknote /> Transfer Manual</h3>
                        <input type="radio" name="pg" checked={payConfig.gateway_active === 'manual'} onChange={() => setPayConfig({ ...payConfig, gateway_active: 'manual' })} className="w-5 h-5 cursor-pointer" />
                    </div>

                    <div className="space-y-3 mb-4">
                        {payConfig.manual_banks && payConfig.manual_banks.map((bank, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700 p-2 rounded text-sm">
                                <div>
                                    <span className="font-bold text-slate-800 dark:text-white">{bank.bank_name}</span> - {bank.account_number}
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{bank.holder_name}</div>
                                </div>
                                <button onClick={() => handleRemoveBank(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                            </div>
                        ))}
                    </div>

                    {editingBank ? (
                        <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded space-y-2">
                            <input className="w-full border p-1 text-sm rounded bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white" placeholder="Nama Bank" value={editingBank.bank_name} onChange={e => setEditingBank({ ...editingBank, bank_name: e.target.value })} />
                            <input className="w-full border p-1 text-sm rounded bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white" placeholder="No. Rekening" value={editingBank.account_number} onChange={e => setEditingBank({ ...editingBank, account_number: e.target.value })} />
                            <input className="w-full border p-1 text-sm rounded bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white" placeholder="Atas Nama" value={editingBank.holder_name} onChange={e => setEditingBank({ ...editingBank, holder_name: e.target.value })} />
                            <div className="flex gap-2">
                                <Button onClick={handleAddBank} className="text-xs w-full">Tambah</Button>
                                <Button variant="secondary" onClick={() => setEditingBank(null)} className="text-xs">Batal</Button>
                            </div>
                        </div>
                    ) : (
                        <Button variant="outline" onClick={() => setEditingBank({ bank_name: '', account_number: '', holder_name: '' })} className="w-full text-xs">Tambah Rekening</Button>
                    )}

                    {payConfig.gateway_active === 'manual' && <Button onClick={handleSaveConfig} className="w-full mt-4">Simpan Konfigurasi</Button>}
                </Card>
            </div>

        </div>
    );
}
