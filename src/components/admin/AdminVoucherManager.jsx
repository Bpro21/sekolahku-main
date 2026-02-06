import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    Tag, Plus, Trash2, Wallet, Ticket, Layers, Sparkles
} from 'lucide-react';
import { Card, Button, Input, Select } from '../ui/Elements';
import { Modal, DeleteConfirmModal } from '../ui/Overlays';

export default function AdminVoucherManager({ showToast }) {
    const [vouchers, setVouchers] = useState([]);
    const [editingVoucher, setEditingVoucher] = useState(null);
    const [bulkModal, setBulkModal] = useState(false);
    const [bulkConfig, setBulkConfig] = useState({
        prefix: 'PROMO',
        count: 10,
        length: 6,
        type: 'fixed',
        amount: 50000,
        quota: 1,
        description: 'Voucher Promo Massal'
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null); // { id, name }

    useEffect(() => {
        const fetchData = async () => {
            const { data } = await supabase.from('vouchers').select('*');
            if (data) setVouchers(data);
        };
        fetchData();

        const channel = supabase.channel('admin_vouchers')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, fetchData)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleSaveVoucher = async () => {
        try {
            const data = {
                ...editingVoucher,
                code: editingVoucher.code.toUpperCase().replace(/\s/g, ''),
                amount: parseInt(editingVoucher.amount),
                quota: parseInt(editingVoucher.quota) || 0
            };

            if (editingVoucher.id) {
                const { error } = await supabase.from('vouchers').update(data).eq('id', editingVoucher.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('vouchers').insert({ ...data, used: 0 });
                if (error) throw error;
            }
            setEditingVoucher(null);
            showToast('Voucher berhasil disimpan');
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleDeleteVoucher = async () => {
        const { error } = await supabase.from('vouchers').delete().eq('id', deleteTarget.id);
        if (error) {
            showToast(error.message, 'error');
        } else {
            showToast('Voucher berhasil dihapus');
        }
        setDeleteTarget(null);
    };

    const generateRandomString = (length) => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const handleBulkGenerate = async () => {
        if (bulkConfig.count > 100) return showToast('Maksimal 100 voucher sekaligus.', 'error');
        setIsGenerating(true);
        try {
            const vouchersToInsert = [];
            const generatedCodes = [];

            for (let i = 0; i < bulkConfig.count; i++) {
                let uniqueCode = '';
                let isUnique = false;
                let attempts = 0;

                // Very basic collision avoidance
                while (!isUnique && attempts < 10) {
                    uniqueCode = `${bulkConfig.prefix}-${generateRandomString(bulkConfig.length)}`.toUpperCase();
                    // Check local uniqueness against current vouchers (not perfect absolute safety but good enough for UI)
                    if (!vouchers.some(v => v.code === uniqueCode) && !generatedCodes.includes(uniqueCode)) {
                        isUnique = true;
                    }
                    attempts++;
                }

                if (isUnique) {
                    generatedCodes.push(uniqueCode);
                    const voucherData = {
                        code: uniqueCode,
                        type: bulkConfig.type,
                        amount: parseInt(bulkConfig.amount),
                        quota: parseInt(bulkConfig.quota) || 1,
                        description: bulkConfig.description,
                        active: true,
                        used: 0,
                        created_at: new Date().toISOString()
                    };
                    vouchersToInsert.push(voucherData);
                }
            }

            const { error } = await supabase.from('vouchers').insert(vouchersToInsert);
            if (error) throw error;

            setBulkModal(false);
            showToast(`${vouchersToInsert.length} voucher berhasil di-generate!`);
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Ticket className="text-emerald-600" /> Manajemen Voucher & Diskon</h2>

            <Card className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2"><Tag size={20} className="text-emerald-600" /> Daftar Voucher Aktif</h3>
                        <p className="text-sm text-slate-500">Kelola kode voucher untuk potongan biaya daftar ulang.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setBulkModal(true)} variant="secondary" className="text-xs">
                            <Layers size={14} /> Generate Masal
                        </Button>
                        <Button onClick={() => setEditingVoucher({ code: '', type: 'fixed', amount: 0, quota: 100, active: true })} className="text-xs">
                            <Plus size={14} /> Buat Voucher
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {vouchers.length === 0 && <div className="col-span-full text-center py-8 bg-slate-50 rounded border border-dashed text-slate-400 italic">Belum ada voucher aktif.</div>}
                    {vouchers.map(v => (
                        <div key={v.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-md transition-shadow relative overflow-hidden">
                            <div className="flex justify-between items-start mb-2">
                                <div className="font-mono font-bold text-lg text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 tracking-wider inline-block">
                                    {v.code}
                                </div>
                                <div className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${v.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {v.active ? 'Aktif' : 'Nonaktif'}
                                </div>
                            </div>

                            <div className="space-y-1 mb-3">
                                <div className="text-2xl font-bold text-slate-800">
                                    {v.type === 'fixed' ? `Rp ${v.amount.toLocaleString()}` : `${v.amount}%`}
                                    <span className="text-xs font-normal text-slate-400 ml-1">OFF</span>
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                    <Tag size={12} /> {v.description || 'Potongan Biaya'}
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-2">
                                <div className="text-xs font-mono text-slate-500">
                                    Used: <span className="font-bold text-slate-700">{v.used || 0}</span> / {v.quota}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingVoucher(v)} className="text-blue-500 hover:bg-blue-50 p-1 rounded transition"><Wallet size={14} /></button>
                                    <button onClick={() => setDeleteTarget({ id: v.id, name: v.code })} className="text-red-500 hover:bg-red-50 p-1 rounded transition"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* VOUCHER MODAL */}
            <Modal
                isOpen={!!editingVoucher}
                onClose={() => setEditingVoucher(null)}
                title={editingVoucher?.id ? "Edit Voucher" : "Buat Voucher Baru"}
                footer={<div className="flex justify-end gap-2 w-full"><Button variant="secondary" onClick={() => setEditingVoucher(null)}>Batal</Button><Button onClick={handleSaveVoucher}>Simpan Voucher</Button></div>}
            >
                {editingVoucher && (
                    <div className="space-y-4">
                        <Input
                            label="Kode Voucher (Unik)"
                            placeholder="CONTOH: HEMAT50"
                            value={editingVoucher.code}
                            onChange={e => setEditingVoucher({ ...editingVoucher, code: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Select
                                label="Tipe Potongan"
                                value={editingVoucher.type}
                                onChange={e => setEditingVoucher({ ...editingVoucher, type: e.target.value })}
                                options={[{ value: 'fixed', label: 'Nominal (Rp)' }, { value: 'percent', label: 'Persentase (%)' }]}
                            />
                            <Input
                                label={editingVoucher.type === 'fixed' ? 'Nominal Potongan (Rp)' : 'Persentase (%)'}
                                type="number"
                                value={editingVoucher.amount}
                                onChange={e => setEditingVoucher({ ...editingVoucher, amount: e.target.value })}
                            />
                        </div>
                        <Input
                            label="Deskripsi Singkat"
                            placeholder="Contoh: Diskon Khusus Alumni"
                            value={editingVoucher.description}
                            onChange={e => setEditingVoucher({ ...editingVoucher, description: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Batas Kuota Penggunaan"
                                type="number"
                                value={editingVoucher.quota}
                                onChange={e => setEditingVoucher({ ...editingVoucher, quota: e.target.value })}
                            />
                            <div className="flex items-center h-full pt-6">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="vActive"
                                        checked={editingVoucher.active}
                                        onChange={e => setEditingVoucher({ ...editingVoucher, active: e.target.checked })}
                                        className="w-5 h-5 rounded text-emerald-600"
                                    />
                                    <label htmlFor="vActive" className="font-bold text-slate-700">Status Aktif</label>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-orange-500 italic">* Voucher hanya berlaku untuk pembayaran jenis "Daftar Ulang".</p>
                    </div>
                )}
            </Modal>

            {/* BULK GENERATE MODAL */}
            <Modal
                isOpen={bulkModal}
                onClose={() => setBulkModal(false)}
                title="Generate Voucher Masal"
                footer={<div className="flex justify-end gap-2 w-full"><Button variant="secondary" onClick={() => setBulkModal(false)}>Batal</Button><Button onClick={handleBulkGenerate} disabled={isGenerating}>{isGenerating ? 'Generating...' : 'Generate Codes'}</Button></div>}
            >
                <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex items-start gap-3">
                        <Sparkles className="text-indigo-600 shrink-0 mt-0.5" size={20} />
                        <div className="text-sm text-indigo-800">
                            Fitur ini akan membuat banyak kode voucher unik sekaligus.
                            <br /> Format: <span className="font-mono font-bold">{bulkConfig.prefix}-XXXXXX</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Prefix (Awalan)"
                            placeholder="Contoh: PROMO"
                            value={bulkConfig.prefix}
                            onChange={e => setBulkConfig({ ...bulkConfig, prefix: e.target.value.toUpperCase() })}
                        />
                        <Input
                            label="Jumlah Voucher"
                            type="number"
                            min="1" max="100"
                            value={bulkConfig.count}
                            onChange={e => setBulkConfig({ ...bulkConfig, count: parseInt(e.target.value) })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Panjang Kode Acak"
                            type="number"
                            min="4" max="10"
                            value={bulkConfig.length}
                            onChange={e => setBulkConfig({ ...bulkConfig, length: parseInt(e.target.value) })}
                        />
                        <Input
                            label="Kuota per Voucher"
                            type="number"
                            value={bulkConfig.quota}
                            onChange={e => setBulkConfig({ ...bulkConfig, quota: parseInt(e.target.value) })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Tipe Potongan"
                            value={bulkConfig.type}
                            onChange={e => setBulkConfig({ ...bulkConfig, type: e.target.value })}
                            options={[{ value: 'fixed', label: 'Nominal (Rp)' }, { value: 'percent', label: 'Persentase (%)' }]}
                        />
                        <Input
                            label={bulkConfig.type === 'fixed' ? 'Nominal (Rp)' : 'Persentase (%)'}
                            type="number"
                            value={bulkConfig.amount}
                            onChange={e => setBulkConfig({ ...bulkConfig, amount: parseInt(e.target.value) })}
                        />
                    </div>

                    <Input
                        label="Deskripsi Singkat"
                        placeholder="Contoh: Voucher GiveAway Instagram"
                        value={bulkConfig.description}
                        onChange={e => setBulkConfig({ ...bulkConfig, description: e.target.value })}
                    />
                </div>
            </Modal>

            {/* DELETE CONFIRMATION MODAL */}
            <DeleteConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteVoucher}
                itemName={deleteTarget?.name}
                itemType="Voucher"
                showToast={showToast}
            />
        </div>
    );
}
