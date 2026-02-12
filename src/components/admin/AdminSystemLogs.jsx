import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { Search, Filter, Download, Activity, User, Calendar, RefreshCcw, Ban, ShieldAlert, Globe, Monitor } from 'lucide-react';
import { LoadingSpinner, EmptyState, Button } from '../ui/Elements';

const AdminSystemLogs = ({ showToast }) => {
    const [activeTab, setActiveTab] = useState('system'); // 'system' | 'visitors'

    // System Logs State
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterAction, setFilterAction] = useState('ALL');
    const [lastVisible, setLastVisible] = useState(null);
    const [hasMore, setHasMore] = useState(true);

    // Visitor Logs State
    const [visitorLogs, setVisitorLogs] = useState([]);
    const [visitorLoading, setVisitorLoading] = useState(true);
    const [visitorLastVisible, setVisitorLastVisible] = useState(null);
    const [visitorHasMore, setVisitorHasMore] = useState(true);

    const [processingIp, setProcessingIp] = useState(null);

    // Constants
    const PAGE_SIZE = 20;
    const ACTION_TYPES = ['ALL', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'SETTINGS'];

    const formatDate = (timestamp) => {
        if (!timestamp) return '-';
        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(timestamp));
    };

    // Fetch System Logs
    const fetchLogs = async (isNext = false) => {
        setLoading(true);
        try {
            let query = supabase
                .from('system_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(PAGE_SIZE);

            if (filterAction !== 'ALL') {
                query = query.eq('action', filterAction);
            }

            if (isNext && lastVisible) {
                query = query.lt('created_at', lastVisible.created_at);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data.length < PAGE_SIZE) setHasMore(false);
            else setHasMore(true);

            if (data.length > 0)
                setLastVisible(data[data.length - 1]);

            if (isNext) setLogs(prev => [...prev, ...data]);
            else setLogs(data);
        } catch (error) {
            console.error("Error fetching logs:", error);
            showToast(`Gagal: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Fetch Visitor Logs
    const fetchVisitorLogs = async (isNext = false) => {
        setVisitorLoading(true);
        try {
            let query = supabase
                .from('visitor_logs')
                .select('*')
                .order('id', { ascending: false })
                .limit(PAGE_SIZE);

            if (isNext && visitorLastVisible) {
                query = query.lt('id', visitorLastVisible.id);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data.length < PAGE_SIZE) setVisitorHasMore(false);
            else setVisitorHasMore(true);

            if (data.length > 0)
                setVisitorLastVisible(data[data.length - 1]);

            if (isNext) setVisitorLogs(prev => [...prev, ...data]);
            else setVisitorLogs(data);
        } catch (error) {
            console.error("Error fetching visitor logs:", error);
            showToast(`Gagal: ${error.message}`, 'error');
        } finally {
            setVisitorLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'system') {
            setLastVisible(null);
            fetchLogs(false);
        } else {
            setVisitorLastVisible(null);
            fetchVisitorLogs(false);
        }
    }, [activeTab, filterAction]);

    const handleBlockIP = async (ip, userName = 'Visitor') => {
        if (!ip || ip === 'Unknown') {
            showToast('IP Address tidak valid', 'error');
            return;
        }
        if (!confirm(`Apakah Anda yakin ingin memblokir IP ${ip} ?\nPengguna dengan IP ini tidak akan bisa mengakses aplikasi.`)) return;

        setProcessingIp(ip);
        try {
            const { error } = await supabase.from('blocked_ips').upsert({
                ip_address: ip,
                blocked_at: new Date().toISOString(),
                reason: `Blocked via ${activeTab === 'system' ? 'System' : 'Visitor'} Logs by Admin`,
                blocked_user_name: userName
            });

            if (error) throw error;

            showToast(`IP ${ip} berhasil diblokir.`, 'success');
        } catch (error) {
            console.error(error);
            showToast('Gagal memblokir IP', 'error');
        } finally {
            setProcessingIp(null);
        }
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'CREATE': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
            case 'DELETE': return 'text-red-600 bg-red-50 border-red-200';
            case 'UPDATE': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'LOGIN': return 'text-purple-600 bg-purple-50 border-purple-200';
            case 'SETTINGS': return 'text-orange-600 bg-orange-50 border-orange-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Activity className="text-blue-600" />
                        Sistem Log & Keamanan
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Memantau aktivitas sistem dan pengunjung secara real-time.</p>
                </div>
                <button
                    onClick={() => {
                        if (activeTab === 'system') { setLastVisible(null); fetchLogs(false); }
                        else { setVisitorLastVisible(null); fetchVisitorLogs(false); }
                    }}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                    title="Refresh"
                >
                    <RefreshCcw size={20} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
                <button
                    className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'system' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    onClick={() => setActiveTab('system')}
                >
                    <Activity size={16} />
                    Log Aktivitas Sistem
                </button>
                <button
                    className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'visitors' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    onClick={() => setActiveTab('visitors')}
                >
                    <Globe size={16} />
                    Log Pengunjung (Visitor)
                </button>
            </div>

            {/* SEARCH / FILTERS */}
            {activeTab === 'system' && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                        <Filter size={16} />
                        Filter Aksi:
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {ACTION_TYPES.map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterAction(type)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterAction === type
                                    ? 'bg-slate-800 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: SYSTEM LOGS */}
            {activeTab === 'system' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {loading && logs.length === 0 ? (
                        <div className="p-12"><LoadingSpinner /></div>
                    ) : logs.length === 0 ? (
                        <EmptyState
                            icon={Activity}
                            title="Belum ada aktivitas"
                            description="Log aktivitas akan muncul di sini setelah ada interaksi pengguna."
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500">
                                        <th className="p-4 font-semibold">Waktu</th>
                                        <th className="p-4 font-semibold">User</th>
                                        <th className="p-4 font-semibold">IP Address</th>
                                        <th className="p-4 font-semibold">Aksi</th>
                                        <th className="p-4 font-semibold">Deskripsi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
                                                    <Calendar size={14} />
                                                    {formatDate(log.created_at)}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                        {log.user_name ? log.user_name[0] : '?'}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{log.user_name}</div>
                                                        <div className="text-xs text-slate-500">{log.user_email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-slate-600 dark:text-slate-400 font-mono border border-slate-200 dark:border-slate-700">
                                                        {log.ip_address || 'Unknown'}
                                                    </code>
                                                    {log.ip_address && log.ip_address !== 'Unknown' && (
                                                        <button
                                                            onClick={() => handleBlockIP(log.ip_address, log.user_name)}
                                                            disabled={processingIp === log.ip_address}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-md transition-colors"
                                                            title="Blokir IP Ini"
                                                        >
                                                            <ShieldAlert size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getActionColor(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <p className="text-sm text-slate-700 dark:text-slate-300 max-w-md truncate" title={log.description}>
                                                    {log.description}
                                                </p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {hasMore && !loading && (
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 text-center">
                            <button onClick={() => fetchLogs(true)} className="text-sm text-blue-600 font-medium hover:underline">
                                Muat lebih banyak...
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: VISITOR LOGS */}
            {activeTab === 'visitors' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {visitorLoading && visitorLogs.length === 0 ? (
                        <div className="p-12"><LoadingSpinner /></div>
                    ) : visitorLogs.length === 0 ? (
                        <EmptyState
                            icon={Globe}
                            title="Belum ada data pengunjung"
                            description="Data kunjungan halaman akan muncul di sini."
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500">
                                        <th className="p-4 font-semibold">Waktu</th>
                                        <th className="p-4 font-semibold">IP Address</th>
                                        <th className="p-4 font-semibold">Halaman</th>
                                        <th className="p-4 font-semibold hidden md:table-cell">Browser / Device</th>
                                        <th className="p-4 font-semibold w-16">Tindakan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {visitorLogs.map((log) => (
                                        <tr key={log.id || Math.random()} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
                                                    <Calendar size={14} />
                                                    {formatDate(log.created_at)}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <Monitor size={14} className="text-slate-400" />
                                                    <code className="text-sm font-mono text-slate-700 dark:text-slate-300">
                                                        {log.ip || 'Unknown'}
                                                    </code>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">
                                                    {log.page}
                                                </span>
                                            </td>
                                            <td className="p-4 hidden md:table-cell">
                                                <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate" title={log.user_agent}>
                                                    {log.user_agent}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                {log.ip && log.ip !== 'Unknown' && (
                                                    <button
                                                        onClick={() => handleBlockIP(log.ip, 'Anonymous Visitor')}
                                                        disabled={processingIp === log.ip}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors group relative"
                                                        title="Blokir IP Ini"
                                                    >
                                                        <Ban size={18} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {visitorHasMore && !visitorLoading && (
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 text-center">
                            <button onClick={() => fetchVisitorLogs(true)} className="text-sm text-blue-600 font-medium hover:underline">
                                Muat lebih banyak...
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminSystemLogs;
