import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, User, LogOut, Settings, Moon, Sun, ChevronDown, CheckCircle } from 'lucide-react';
import { supabase } from '../../config/supabase';

export default function Header({ user, isAdmin, onLogout, onNavigate, theme, darkMode, onToggleDarkMode, appSettings }) {
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const profileRef = useRef(null);
    const notifRef = useRef(null);

    const navigate = useNavigate();

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            if (data) {
                setNotifications(data);
                setUnreadCount(data.filter(n => !n.read).length);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    };

    const handleClearNotifications = async () => {
        if (notifications.length === 0) return;

        try {
            // Delete notifications for this user
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user.id);

            if (error) throw error;

            // Optimistic update
            setNotifications([]);
            setUnreadCount(0);
        } catch (error) {
            console.error("Failed to clear notifications:", error);
        }
    };

    // Listen for Notifications
    useEffect(() => {
        if (!user) return;

        // Initial Fetch
        fetchNotifications();

        // Realtime Subscription
        const channel = supabase.channel('header_notifications')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    console.log('Notification change received!', payload);
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    return (
        <header className="sticky top-0 z-30 flex w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 transition-colors duration-300">
            <div className="flex flex-grow items-center justify-between px-4 py-3 md:px-6 2xl:px-11">
                <div className="hidden lg:block flex-1 max-w-md">
                    {/* Placeholder for center content if needed */}
                </div>

                <div className="flex items-center gap-4 ml-auto">
                    {/* Back to Website Link (Logo Only) */}
                    <button
                        onClick={() => navigate('/')}
                        className="group flex flex-col items-center hover:opacity-80 transition-all p-1"
                        title="Kembali ke Website Utama"
                    >
                        {appSettings?.app_logo ? (
                            <img src={appSettings.app_logo} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shadow-sm border border-slate-100 dark:border-slate-800" />
                        ) : (
                            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md">
                                {appSettings?.app_name?.[0] || 'S'}
                            </div>
                        )}
                        <span className="text-[7px] font-black uppercase tracking-tighter text-slate-400 mt-1">Website</span>
                    </button>

                    {/* Divider */}
                    <div className="h-6 w-px bg-slate-100 dark:bg-slate-800 hidden sm:block"></div>

                    {/* Dark Mode Toggle */}
                    <button
                        type="button"
                        onClick={onToggleDarkMode}
                        className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400"
                        title={darkMode ? "Current: Dark. Click to switch to Light." : "Current: Light. Click to switch to Dark."}
                    >
                        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    {/* Notification Bell */}
                    <ul className="flex items-center gap-2">
                        <li className="relative" ref={notifRef}>
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                            >
                                <span className={`absolute top-2 right-2.5 z-1 h-2 w-2 rounded-full bg-red-600 ${unreadCount === 0 ? 'hidden' : 'inline'}`}>
                                    <span className="absolute -z-1 inline-flex h-full w-full animate-ping rounded-full bg-red-600 opacity-75"></span>
                                </span>
                                <Bell size={20} />
                            </button>

                            {showNotifications && (
                                <div className="fixed md:absolute top-20 md:top-full right-4 md:right-0 left-4 md:left-auto mt-3 flex md:w-80 flex-col rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[100] overflow-hidden animate-slide-down">
                                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                                        <h5 className="text-sm font-black text-slate-800 dark:text-white dark:text-slate-200 uppercase tracking-tight">Notifikasi</h5>
                                        {notifications.length > 0 && (
                                            <button
                                                onClick={handleClearNotifications}
                                                className="text-[10px] text-red-500 hover:text-red-700 font-black uppercase tracking-widest hover:underline"
                                            >
                                                Hapus Semua
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex flex-col max-h-[400px] overflow-y-auto custom-scrollbar">
                                        {notifications.length > 0 ? (
                                            notifications.map((notif) => (
                                                <div key={notif.id} className="p-4 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                                                    <div className="flex gap-3">
                                                        <div className={`mt-1 p-1.5 rounded-lg shrink-0 ${notif.read ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'}`}>
                                                            <CheckCircle size={14} />
                                                        </div>
                                                        <div>
                                                            <p className={`text-xs leading-relaxed ${notif.read ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-white dark:text-slate-200 font-bold'}`}>{notif.message}</p>
                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block tracking-wider">{notif.created_at ? new Date(notif.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-200">
                                                    <Bell size={32} />
                                                </div>
                                                <span className="text-xs font-black uppercase tracking-widest opacity-60">Tidak ada notifikasi baru</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </li>
                    </ul>

                    {/* Divider */}
                    <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

                    {/* Profile Dropdown */}
                    <div className="relative" ref={profileRef}>
                        <button
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="flex items-center gap-3 p-1.5 pr-3 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
                        >
                            <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20">
                                {(user?.user_metadata?.displayName || user?.user_metadata?.full_name)?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="hidden lg:block text-left">
                                <span className="block text-xs font-black text-slate-800 dark:text-white dark:text-slate-200 leading-tight uppercase tracking-tighter">
                                    {user?.user_metadata?.displayName || user?.user_metadata?.full_name || 'User'}
                                </span>
                                <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    {isAdmin ? 'Administrator' : 'Wali Murid'}
                                </span>
                            </div>
                            <ChevronDown size={16} className="hidden sm:block text-slate-500 dark:text-slate-400" />
                        </button>

                        {/* Dropdown Start */}
                        {showProfileMenu && (
                            <div className="fixed md:absolute top-20 md:top-full right-4 md:right-0 left-4 md:left-auto mt-4 flex md:w-64 flex-col rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[100] min-w-[240px] overflow-hidden animate-slide-down">
                                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                    <span className="block text-sm font-black text-slate-800 dark:text-white dark:text-slate-200 uppercase tracking-tight">
                                        {user?.user_metadata?.displayName || user?.user_metadata?.full_name || 'User'}
                                    </span>
                                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                                        {isAdmin ? 'Administrator' : 'Wali Murid'}
                                    </span>
                                </div>
                                <ul className="flex flex-col gap-1 p-2">
                                    <li>
                                        <button
                                            onClick={() => { onNavigate('profile'); setShowProfileMenu(false); }}
                                            className="flex w-full items-center gap-3.5 px-4 py-3 text-sm font-bold duration-300 ease-in-out hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-2xl text-slate-600 dark:text-slate-400"
                                        >
                                            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
                                                <User size={18} />
                                            </div>
                                            Profil Saya
                                        </button>
                                    </li>
                                </ul>
                                <div className="p-2 border-t border-slate-50 dark:border-slate-800/50">
                                    <button
                                        onClick={onLogout}
                                        className="flex w-full items-center gap-3.5 px-4 py-3 text-sm font-bold duration-300 ease-in-out hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-2xl text-slate-600 dark:text-slate-400"
                                    >
                                        <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:bg-red-100 dark:group-hover:bg-red-900/50 transition-colors">
                                            <LogOut size={18} />
                                        </div>
                                        Log Out
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* Dropdown End */}
                    </div>
                </div>
            </div>
        </header >
    );
}
