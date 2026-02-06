import React from 'react';
import { ChevronRight } from 'lucide-react';

export const Card = ({ children, className = "" }) => (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800/50 transition-colors duration-300 ${className}`}>
        {children}
    </div>
);

export const Button = ({ children, onClick, variant = 'primary', className = "", disabled = false, type = "button" }) => {
    const baseStyle = "px-4 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 touch-manipulation";
    const variants = {
        primary: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20",
        secondary: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:bg-slate-100 dark:disabled:bg-slate-900",
        outline: "border-2 border-emerald-600 dark:border-emerald-500 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
        danger: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40",
        ai: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200 dark:shadow-purple-900/20",
        white: "bg-white text-emerald-800 hover:bg-emerald-50 shadow-lg"
    };
    return (
        <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
            {children}
        </button>
    );
};

export const Input = ({ label, type = "text", value, onChange, placeholder, required = false, name, disabled = false, className = "", helperText = "" }) => (
    <div className="mb-4">
        {label && <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>}
        <input
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all disabled:opacity-50 text-base placeholder:text-slate-400 dark:placeholder:text-slate-600 ${className}`}
            required={required}
        />
        {helperText && <p className="text-[10px] text-slate-500 mt-1.5 ml-1 italic">{helperText}</p>}
    </div>
);

export const Select = ({ label, value, onChange, options, placeholder, name, required = false, disabled = false }) => (
    <div className="mb-4">
        {label && <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>}
        <div className="relative">
            <select
                name={name}
                value={value}
                onChange={onChange}
                disabled={disabled}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all appearance-none text-base disabled:opacity-50"
                required={required}
            >
                <option value="">{placeholder || "Pilih salah satu"}</option>
                {options.map((opt, idx) => (<option key={idx} value={opt.value} disabled={opt.disabled}>{opt.label || opt.value} {opt.disabled ? '(Penuh)' : ''}</option>))}
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500 dark:text-slate-400"><ChevronRight size={16} className="rotate-90" /></div>
        </div>
    </div>
);

export const Badge = ({ status }) => {
    const s = status || 'draft';
    const styles = {
        draft: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
        submitted: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800",
        verifying_payment: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800",
        verified: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800",
        psychotest_done: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800",
        interview_scheduled: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800",
        interview_accepted: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800",
        awaiting_decision: "bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-700",
        lulus: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800",
        pending: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800",
        pending_payment: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800",
        requesting_installment: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800",
        installment_approved: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800",
        paid: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800",
        rejected: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800",
        wawancara_selesai: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800",
        mengundurkan_diri: "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 border border-red-100 dark:border-red-900 line-through"
    };
    return <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide ${styles[s] || styles.draft}`}>{s.replace(/_/g, " ")}</span>;
};

export const NavItem = ({ icon, label, active, onClick, badge, activeClass, inactiveClass, iconClass }) => {
    const defaultActive = 'bg-white/10 text-white shadow-inner font-bold';
    const defaultInactive = 'text-emerald-100 hover:bg-emerald-800/50 hover:text-white';

    return (
        <button
            onClick={onClick}
            className={`w-full group flex items-center gap-3 px-4 py-3 mx-1 rounded-xl text-sm font-medium transition-all duration-200 relative ${active
                ? (activeClass || defaultActive)
                : (inactiveClass || defaultInactive)
                }`}
            style={{ width: 'calc(100% - 8px)' }}
        >
            <span className={`transition-transform duration-200 ${iconClass || (active ? 'text-emerald-300' : 'group-hover:text-emerald-300')}`}>{icon}</span>
            <span className="flex-1 text-left">{label}</span>
            {badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm ${badge === 'New' || badge === 'Beta' ? 'bg-amber-400 text-amber-900 animate-pulse' : 'bg-white/20 text-white'
                    }`}>
                    {badge}
                </span>
            )}
        </button>
    );
};

// Add missing exports for LoadingSpinner and EmptyState
export const LoadingSpinner = () => (
    <div className="flex justify-center items-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
    </div>
);

export const EmptyState = ({ icon: Icon, title, description }) => (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
        <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full mb-3 text-slate-400">
            {Icon ? <Icon size={24} /> : <div className="w-6 h-6" />}
        </div>
        <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">{title}</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>
    </div>
);
