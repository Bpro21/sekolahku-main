import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, X, Trash2, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../../config/supabase';

export const Toast = ({ message, type = 'success', onClose }) => {
    useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
    const bg = type === 'success' ? 'bg-emerald-600' : 'bg-red-600';
    return (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 w-[90vw] md:w-auto ${bg} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 z-[100] animate-slide-down border border-white/20 backdrop-blur-md`}>
            <div className="flex items-center gap-3">
                {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                <span className="text-sm font-black tracking-tight">{message}</span>
            </div>
            <button onClick={onClose} className="bg-white/20 p-1 rounded-full hover:bg-white/30 transition-colors">
                <X size={16} />
            </button>
        </div>
    );
};

export const Modal = ({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-lg' }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className={`bg-white dark:bg-slate-800 rounded-t-2xl md:rounded-xl shadow-2xl w-full ${maxWidth} overflow-hidden transform transition-all scale-100 max-h-[90vh] overflow-y-auto`}>
                <div className="flex justify-between items-center p-4 border-b dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700 p-1 rounded-full"><X size={20} /></button>
                </div>
                <div className="p-4 md:p-6 text-slate-800 dark:text-slate-200">{children}</div>
                {footer && <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-700 flex justify-end gap-2 sticky bottom-0">{footer}</div>}
            </div>
        </div>
    );
};

// Reusable Delete Confirmation Modal with Password
export const DeleteConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    itemName = 'item ini',
    itemType = 'Data',
    showToast
}) => {
    const [password, setPassword] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setPassword('');
            setIsDeleting(false);
        }
    }, [isOpen]);

    const handleConfirm = async () => {
        if (!password) {
            showToast?.('Masukkan password admin!', 'error');
            return;
        }

        setIsDeleting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Sesi habis. Login ulang.");

            // Re-authenticate logic: Try to sign in to verify password
            const { error } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: password
            });

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    throw new Error('Password Admin salah!');
                }
                throw error;
            }

            // Execute delete callback
            await onConfirm();

            onClose();
        } catch (error) {
            console.error(error);
            showToast?.(error.message, 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-red-50 dark:bg-red-900/30 p-6 text-center border-b border-red-100 dark:border-red-900">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 size={32} className="text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-2">Konfirmasi Hapus {itemType}</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">
                        Anda akan menghapus <strong className="text-red-600 dark:text-red-400">"{itemName}"</strong>.
                        Aksi ini tidak dapat dibatalkan.
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                            <Lock size={14} /> Password Admin
                        </label>
                        <input
                            type="password"
                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                            placeholder="Masukkan password untuk konfirmasi..."
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                            autoFocus
                        />
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                            Untuk keamanan, masukkan password akun admin Anda.
                        </p>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isDeleting || !password}
                        className="px-6 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" /> Menghapus...
                            </>
                        ) : (
                            <>
                                <Trash2 size={16} /> Hapus Permanen
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
