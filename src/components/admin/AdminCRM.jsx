import React, { useState } from 'react';
import { LayoutDashboard, MessageCircle, BarChart2, Settings, Users, ArrowUpRight } from 'lucide-react';
import CRMInbox from './crm/CRMInbox';
import CRMKanban from './crm/CRMKanban';
import CRMAISettings from './crm/CRMAISettings';

export default function AdminCRM({ showToast }) {
    const [activeTab, setActiveTab] = useState('pipeline');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Users className="text-emerald-600" /> CRM & WhatsApp AI
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Kelola prospek calon siswa dan komunikasi otomatis.</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('pipeline')}
                        className={`pb-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === 'pipeline'
                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <LayoutDashboard size={18} /> Itinerary / Pipeline
                    </button>
                    <button
                        onClick={() => setActiveTab('inbox')}
                        className={`pb-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === 'inbox'
                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <MessageCircle size={18} /> Inbox & Chat
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full">2</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`pb-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === 'settings'
                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <Settings size={18} /> Konfigurasi AI
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="animate-fade-in min-h-[500px]">
                {activeTab === 'pipeline' && <CRMKanban showToast={showToast} />}
                {activeTab === 'inbox' && <CRMInbox showToast={showToast} />}
                {activeTab === 'settings' && <CRMAISettings showToast={showToast} />}
            </div>
        </div>
    );
}
