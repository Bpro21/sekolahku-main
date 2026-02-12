import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { Card, Button } from '../ui/Elements';
import { Modal } from '../ui/Overlays';
import {
    Database, Download, Upload, RefreshCw, CheckCircle, AlertTriangle,
    FileJson, FileSpreadsheet, Loader2, Trash2, Cloud, HardDrive, Clock
} from 'lucide-react';

// All tables to backup
const BACKUP_TABLES = [
    { name: 'registrations', label: 'Data Pendaftaran', critical: true },
    { name: 'profiles', label: 'Profil User', critical: true },
    { name: 'invoices', label: 'Tagihan & Pembayaran', critical: true },
    { name: 'leads', label: 'CRM Leads', critical: true },
    { name: 'conversations', label: 'CRM Conversations', critical: false },
    { name: 'units', label: 'Unit Sekolah', critical: true },
    { name: 'paths', label: 'Jalur Pendaftaran', critical: true },
    { name: 'waves', label: 'Gelombang', critical: true },
    { name: 'academic_years', label: 'Tahun Ajaran', critical: true },
    { name: 'app_settings', label: 'Pengaturan Aplikasi', critical: true },
    { name: 'payment_config', label: 'Konfigurasi Pembayaran', critical: true },
    { name: 'vouchers', label: 'Voucher & Diskon', critical: false },
    { name: 'notifications', label: 'Notifikasi', critical: false },
    { name: 'indent_settings', label: 'Pengaturan Indent', critical: false },
    { name: 'user_lookup', label: 'User Lookup', critical: false },
    { name: 'edit_requests', label: 'Permintaan Edit', critical: false }
];

export default function AdminBackup({ showToast }) {
    const [loading, setLoading] = useState(false);
    const [backupProgress, setBackupProgress] = useState(null);
    const [restoreProgress, setRestoreProgress] = useState(null);
    const [backupHistory, setBackupHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [bucketReady, setBucketReady] = useState(true); // Assume ready, check on load

    // Restore Modal
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [restoreFile, setRestoreFile] = useState(null);
    const [restoreData, setRestoreData] = useState(null);
    const [restoreConfirm, setRestoreConfirm] = useState('');
    const [restoring, setRestoring] = useState(false);

    // Fetch backup history from storage
    useEffect(() => {
        fetchBackupHistory();
    }, []);

    const fetchBackupHistory = async () => {
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase.storage
                .from('backups')
                .list('', { sortBy: { column: 'created_at', order: 'desc' }, limit: 10 });

            if (error) {
                // Bucket doesn't exist
                if (error.message.includes('not found') || error.message.includes('Bucket')) {
                    setBucketReady(false);
                }
                setBackupHistory([]);
            } else {
                setBucketReady(true);
                setBackupHistory(data || []);
            }
        } catch (e) {
            console.error('Error fetching backup history:', e);
            setBackupHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    // ==================== BACKUP FUNCTIONS ====================

    const exportAllData = async (saveToCloud = false) => {
        setLoading(true);
        setBackupProgress({ current: 0, total: BACKUP_TABLES.length, table: '' });

        try {
            const backup = {
                meta: {
                    version: '1.0',
                    created_at: new Date().toISOString(),
                    tables: []
                },
                data: {}
            };

            for (let i = 0; i < BACKUP_TABLES.length; i++) {
                const table = BACKUP_TABLES[i];
                setBackupProgress({ current: i + 1, total: BACKUP_TABLES.length, table: table.label });

                try {
                    const { data, error } = await supabase.from(table.name).select('*');
                    if (!error && data) {
                        backup.data[table.name] = data;
                        backup.meta.tables.push({ name: table.name, count: data.length });
                    }
                } catch (tableError) {
                    console.warn(`Table ${table.name} skipped:`, tableError.message);
                    backup.data[table.name] = [];
                    backup.meta.tables.push({ name: table.name, count: 0, error: tableError.message });
                }
            }

            const jsonString = JSON.stringify(backup, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `backup_${timestamp}.json`;

            if (saveToCloud) {
                // Check if bucket is ready
                if (!bucketReady) {
                    showToast('Bucket belum siap. Jalankan SQL script di Supabase terlebih dahulu.', 'error');
                    setLoading(false);
                    setBackupProgress(null);
                    return;
                }

                // Upload to Supabase Storage
                const { error: uploadError } = await supabase.storage
                    .from('backups')
                    .upload(filename, blob, { upsert: true });

                if (uploadError) {
                    if (uploadError.message.includes('not found') || uploadError.message.includes('Bucket')) {
                        setBucketReady(false);
                        showToast('Bucket "backups" belum dibuat. Jalankan scripts/create_backups_bucket.sql di Supabase.', 'error');
                    } else {
                        throw uploadError;
                    }
                } else {
                    showToast('Backup berhasil disimpan ke cloud!');
                    fetchBackupHistory();
                }
            } else {
                // Download to local
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                showToast(`Backup berhasil! File: ${filename}`);
            }
        } catch (error) {
            console.error('Backup error:', error);
            showToast('Gagal membuat backup: ' + error.message, 'error');
        } finally {
            setLoading(false);
            setBackupProgress(null);
        }
    };

    const exportAsCSV = async (tableName, label) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from(tableName).select('*');
            if (error) throw error;

            if (!data || data.length === 0) {
                showToast('Tidak ada data untuk di-export', 'error');
                return;
            }

            // Convert to CSV
            const headers = Object.keys(data[0]);
            const csvRows = [
                headers.join(','),
                ...data.map(row =>
                    headers.map(h => {
                        let val = row[h];
                        if (val === null || val === undefined) return '';
                        if (typeof val === 'object') val = JSON.stringify(val);
                        return `"${String(val).replace(/"/g, '""')}"`;
                    }).join(',')
                )
            ];

            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${tableName}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast(`Export ${label} berhasil!`);
        } catch (error) {
            console.error('CSV export error:', error);
            showToast('Gagal export CSV: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const downloadFromCloud = async (filename) => {
        try {
            const { data, error } = await supabase.storage
                .from('backups')
                .download(filename);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('Download berhasil!');
        } catch (error) {
            showToast('Gagal download: ' + error.message, 'error');
        }
    };

    const deleteFromCloud = async (filename) => {
        if (!confirm(`Hapus backup ${filename}?`)) return;

        try {
            const { error } = await supabase.storage
                .from('backups')
                .remove([filename]);

            if (error) throw error;

            showToast('Backup dihapus');
            fetchBackupHistory();
        } catch (error) {
            showToast('Gagal hapus: ' + error.message, 'error');
        }
    };

    // ==================== RESTORE FUNCTIONS ====================

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            showToast('File harus berformat JSON', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);

                // Validate backup structure
                if (!parsed.meta || !parsed.data) {
                    throw new Error('Format backup tidak valid');
                }

                setRestoreFile(file);
                setRestoreData(parsed);
                setShowRestoreModal(true);
            } catch (err) {
                showToast('File backup tidak valid: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    };

    const executeRestore = async () => {
        if (restoreConfirm !== 'RESTORE') {
            showToast('Ketik RESTORE untuk konfirmasi', 'error');
            return;
        }

        setRestoring(true);
        setRestoreProgress({ current: 0, total: Object.keys(restoreData.data).length, table: '', results: [] });

        try {
            const tables = Object.keys(restoreData.data);
            const results = [];

            for (let i = 0; i < tables.length; i++) {
                const tableName = tables[i];
                const tableData = restoreData.data[tableName];
                const tableInfo = BACKUP_TABLES.find(t => t.name === tableName);

                setRestoreProgress(prev => ({
                    ...prev,
                    current: i + 1,
                    table: tableInfo?.label || tableName
                }));

                if (!tableData || tableData.length === 0) {
                    results.push({ table: tableName, status: 'skipped', message: 'Tidak ada data' });
                    continue;
                }

                try {
                    // Use upsert to avoid duplicates (requires primary key)
                    const { error } = await supabase
                        .from(tableName)
                        .upsert(tableData, { onConflict: 'id', ignoreDuplicates: false });

                    if (error) {
                        // Try insert if upsert fails
                        const { error: insertError } = await supabase
                            .from(tableName)
                            .insert(tableData);

                        if (insertError) {
                            results.push({ table: tableName, status: 'error', message: insertError.message });
                        } else {
                            results.push({ table: tableName, status: 'success', count: tableData.length });
                        }
                    } else {
                        results.push({ table: tableName, status: 'success', count: tableData.length });
                    }
                } catch (tableError) {
                    results.push({ table: tableName, status: 'error', message: tableError.message });
                }
            }

            setRestoreProgress(prev => ({ ...prev, results }));

            const successCount = results.filter(r => r.status === 'success').length;
            const errorCount = results.filter(r => r.status === 'error').length;

            if (errorCount === 0) {
                showToast(`Restore berhasil! ${successCount} tabel dipulihkan.`);
            } else {
                showToast(`Restore selesai dengan ${errorCount} error. Cek hasil di bawah.`, 'warning');
            }
        } catch (error) {
            console.error('Restore error:', error);
            showToast('Restore gagal: ' + error.message, 'error');
        } finally {
            setRestoring(false);
        }
    };

    const closeRestoreModal = () => {
        setShowRestoreModal(false);
        setRestoreFile(null);
        setRestoreData(null);
        setRestoreConfirm('');
        setRestoreProgress(null);
    };

    // ==================== RENDER ====================

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <Database className="text-emerald-600" /> Backup & Restore Database
            </h2>

            {/* Bucket Setup Warning */}
            {!bucketReady && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">Setup Diperlukan untuk Cloud Backup</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 mb-3">
                                Bucket storage "backups" belum dibuat. Untuk mengaktifkan fitur simpan ke cloud:
                            </p>
                            <ol className="text-xs text-amber-700 dark:text-amber-400 list-decimal list-inside space-y-1">
                                <li>Buka Supabase Dashboard → SQL Editor</li>
                                <li>Jalankan script <code className="bg-amber-200 dark:bg-amber-800 px-1 rounded">scripts/create_backups_bucket.sql</code></li>
                                <li>Refresh halaman ini</li>
                            </ol>
                            <p className="text-xs text-amber-600 mt-2">
                                <strong>Catatan:</strong> Download backup ke lokal tetap bisa digunakan tanpa setup.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Backup Section */}
            <Card className="p-6">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Download className="text-blue-600" size={20} /> Backup Data
                </h3>

                {/* Progress Bar */}
                {backupProgress && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3 mb-2">
                            <Loader2 className="animate-spin text-blue-600" size={20} />
                            <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                                Memproses: {backupProgress.table}
                            </span>
                        </div>
                        <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(backupProgress.current / backupProgress.total) * 100}%` }}
                            />
                        </div>
                        <p className="text-xs text-blue-500 mt-2">
                            {backupProgress.current} / {backupProgress.total} tabel
                        </p>
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <button
                        onClick={() => exportAllData(false)}
                        disabled={loading}
                        className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all text-left group"
                    >
                        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <HardDrive className="text-emerald-600 dark:text-emerald-400" size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-emerald-800 dark:text-emerald-300">Download Backup (JSON)</h4>
                            <p className="text-xs text-emerald-600 dark:text-emerald-500">
                                Simpan semua data ke komputer Anda
                            </p>
                        </div>
                    </button>

                    <button
                        onClick={() => exportAllData(true)}
                        disabled={loading}
                        className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all text-left group"
                    >
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Cloud className="text-blue-600 dark:text-blue-400" size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-blue-800 dark:text-blue-300">Simpan ke Cloud</h4>
                            <p className="text-xs text-blue-600 dark:text-blue-500">
                                Backup ke Supabase Storage
                            </p>
                        </div>
                    </button>
                </div>

                {/* Quick Export CSVs */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                        <FileSpreadsheet size={16} /> Export CSV (untuk Excel)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => exportAsCSV('registrations', 'Pendaftaran')}
                            disabled={loading}
                        >
                            📝 Pendaftaran
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => exportAsCSV('leads', 'Leads')}
                            disabled={loading}
                        >
                            👥 Leads
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => exportAsCSV('invoices', 'Tagihan')}
                            disabled={loading}
                        >
                            💰 Tagihan
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => exportAsCSV('profiles', 'Profil')}
                            disabled={loading}
                        >
                            👤 Profil User
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Restore Section */}
            <Card className="p-6">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Upload className="text-orange-600" size={20} /> Restore Data
                </h3>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">Peringatan</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                Restore akan menimpa data yang sudah ada. Pastikan Anda sudah membuat backup terbaru sebelum melakukan restore.
                            </p>
                        </div>
                    </div>
                </div>

                <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <FileJson className="text-slate-400 mb-3" size={40} />
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                        Klik untuk upload file backup (.json)
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                        Atau drag & drop file ke sini
                    </span>
                </label>
            </Card>

            {/* Backup History */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                        <Clock className="text-purple-600" size={20} /> Riwayat Backup (Cloud)
                    </h3>
                    <Button size="sm" variant="secondary" onClick={fetchBackupHistory}>
                        <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
                    </Button>
                </div>

                {historyLoading ? (
                    <div className="text-center py-8 text-slate-400">
                        <Loader2 className="animate-spin mx-auto mb-2" />
                        <span className="text-sm">Memuat...</span>
                    </div>
                ) : backupHistory.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 border border-dashed rounded-xl">
                        <Cloud size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Belum ada backup yang tersimpan di cloud</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {backupHistory.map((file) => (
                            <div
                                key={file.name}
                                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                            >
                                <div className="flex items-center gap-3">
                                    <FileJson className="text-blue-600" size={20} />
                                    <div>
                                        <span className="font-mono text-sm text-slate-700 dark:text-slate-300">
                                            {file.name}
                                        </span>
                                        <p className="text-xs text-slate-400">
                                            {file.metadata?.size ? `${(file.metadata.size / 1024 / 1024).toFixed(2)} MB` : '-'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => downloadFromCloud(file.name)}
                                    >
                                        <Download size={14} />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={() => deleteFromCloud(file.name)}
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Restore Modal */}
            <Modal
                isOpen={showRestoreModal}
                onClose={closeRestoreModal}
                title="Konfirmasi Restore Data"
                maxWidth="max-w-2xl"
            >
                {restoreData && (
                    <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Info Backup</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-slate-500">Dibuat:</span>{' '}
                                    <span className="font-mono text-slate-700 dark:text-slate-300">
                                        {new Date(restoreData.meta.created_at).toLocaleString('id-ID')}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Versi:</span>{' '}
                                    <span className="font-mono text-slate-700 dark:text-slate-300">
                                        {restoreData.meta.version}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Data yang akan di-restore ({restoreData.meta.tables?.length || 0} tabel):
                            </h4>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {restoreData.meta.tables?.map((table) => (
                                    <div
                                        key={table.name}
                                        className="flex justify-between text-sm py-1 px-2 bg-slate-100 dark:bg-slate-700 rounded"
                                    >
                                        <span className="text-slate-600 dark:text-slate-300">{table.name}</span>
                                        <span className="font-bold text-slate-800 dark:text-white">
                                            {table.count} records
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Progress */}
                        {restoreProgress && (
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-3 mb-2">
                                    <Loader2 className="animate-spin text-blue-600" size={20} />
                                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                                        Memproses: {restoreProgress.table}
                                    </span>
                                </div>
                                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${(restoreProgress.current / restoreProgress.total) * 100}%` }}
                                    />
                                </div>

                                {/* Results */}
                                {restoreProgress.results && restoreProgress.results.length > 0 && (
                                    <div className="mt-4 max-h-32 overflow-y-auto space-y-1">
                                        {restoreProgress.results.map((r, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs">
                                                {r.status === 'success' && <CheckCircle className="text-green-500" size={14} />}
                                                {r.status === 'error' && <AlertTriangle className="text-red-500" size={14} />}
                                                {r.status === 'skipped' && <span className="text-slate-400">⊘</span>}
                                                <span className="text-slate-600 dark:text-slate-400">{r.table}</span>
                                                {r.count && <span className="text-green-600">({r.count})</span>}
                                                {r.message && <span className="text-red-500 text-[10px]">{r.message}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Confirmation */}
                        {!restoring && !restoreProgress?.results && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                <label className="block text-sm font-bold text-red-700 dark:text-red-400 mb-2">
                                    Ketik <span className="font-mono bg-red-100 dark:bg-red-800 px-1 rounded">RESTORE</span> untuk konfirmasi:
                                </label>
                                <input
                                    type="text"
                                    value={restoreConfirm}
                                    onChange={(e) => setRestoreConfirm(e.target.value.toUpperCase())}
                                    className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-mono text-center"
                                    placeholder="RESTORE"
                                />
                            </div>
                        )}

                        <div className="flex gap-2 pt-4 border-t dark:border-slate-700">
                            <Button variant="secondary" onClick={closeRestoreModal} className="flex-1">
                                Batal
                            </Button>
                            {!restoreProgress?.results && (
                                <Button
                                    onClick={executeRestore}
                                    disabled={restoring || restoreConfirm !== 'RESTORE'}
                                    className="flex-1 bg-red-600 hover:bg-red-700"
                                >
                                    {restoring ? <Loader2 className="animate-spin mr-2" size={16} /> : <Upload size={16} className="mr-2" />}
                                    {restoring ? 'Memproses...' : 'Mulai Restore'}
                                </Button>
                            )}
                            {restoreProgress?.results && (
                                <Button onClick={closeRestoreModal} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                                    <CheckCircle size={16} className="mr-2" /> Selesai
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
