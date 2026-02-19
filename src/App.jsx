import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate, useLocation, Navigate, Outlet, Routes, Route } from 'react-router-dom';
import { supabase } from './config/supabase';

import {
  UploadCloud, Home, Plus, Users, LogOut, Menu, X, Ban,
  LayoutDashboard, FileText, Megaphone, CreditCard,
  FileSpreadsheet, FileCheck, FileEdit, Video, ClipboardList,
  Trophy, Building, Timer, Wallet, Settings, User, ArrowRightLeft, MessageCircle, DollarSign,
  CheckCircle, Clock, ChevronRight, Bell, Search, Filter, Tag, Globe, CalendarClock, GraduationCap, PieChart, Target, Database
} from 'lucide-react';
import { seedMasterData } from './utils/helpers';
import { Toast, Modal } from './components/ui/Overlays';

import { NavItem } from './components/ui/Elements';
import Header from './components/layout/Header';

// Critical components (always needed) - eager imports
import ErrorBoundary from './classes/ErrorBoundary';
import AuthScreen from './components/auth/AuthScreen';

// Public Components - lazy loaded for smaller initial bundle
const SchoolWebsite = lazy(() => import('./components/public/SchoolWebsite.jsx'));
import NotFound from './components/public/NotFound.jsx';

// Page skeleton for Suspense fallback
const PageSkeleton = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Memuat...</p>
    </div>
  </div>
);

// Lazy-loaded components (downloaded only when navigated to)
const GuidePage = lazy(() => import('./components/public/GuidePage.jsx'));

// User Components - lazy
const UserDashboard = lazy(() => import('./components/user/UserDashboard'));
const RegistrationWizard = lazy(() => import('./components/user/RegistrationWizard'));
const StudentManager = lazy(() => import('./components/user/StudentManager'));
const PsychotestModule = lazy(() => import('./components/user/PsychotestModule'));
const AnnouncementBoard = lazy(() => import('./components/user/AnnouncementBoard'));
const PaymentHistory = lazy(() => import('./components/user/PaymentHistory'));
const UserProfile = lazy(() => import('./components/user/UserProfile'));

// Admin Components - lazy (heaviest, never needed on public pages)
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminAgreements = lazy(() => import('./components/admin/AdminAgreements'));
const AdminStudentReport = lazy(() => import('./components/admin/AdminStudentReport'));
const AdminVerification = lazy(() => import('./components/admin/AdminVerification'));
const AdminIndentVerification = lazy(() => import('./components/admin/AdminIndentVerification'));
const AdminPaymentApproval = lazy(() => import('./components/admin/AdminPaymentApproval'));
const AdminDataRequests = lazy(() => import('./components/admin/AdminDataRequests'));
const AdminFinanceDashboard = lazy(() => import('./components/admin/AdminFinanceDashboard'));
const AdminFollowUp = lazy(() => import('./components/admin/AdminFollowUp'));
const AdminResignation = lazy(() => import('./components/admin/AdminResignation'));
const AdminTransferManager = lazy(() => import('./components/admin/AdminTransferManager'));
const AdminInterviewManager = lazy(() => import('./components/admin/AdminInterviewManager'));
const AdminScoring = lazy(() => import('./components/admin/AdminScoring'));
const AdminRanking = lazy(() => import('./components/admin/AdminRanking'));
const AdminSchoolSettings = lazy(() => import('./components/admin/AdminSchoolSettings'));
const AdminTestSettings = lazy(() => import('./components/admin/AdminTestSettings'));
const AdminPaymentSettings = lazy(() => import('./components/admin/AdminPaymentSettings'));
const AdminAppSettings = lazy(() => import('./components/admin/AdminAppSettings'));
const AdminWebsiteSettings = lazy(() => import('./components/admin/AdminWebsiteSettings'));
const AdminVoucherManager = lazy(() => import('./components/admin/AdminVoucherManager'));
const AdminTestRecap = lazy(() => import('./components/admin/AdminTestRecap'));
const AdminReregistration = lazy(() => import('./components/admin/AdminReregistration'));
const AdminStudentData = lazy(() => import('./components/admin/AdminStudentData'));
const AdminQuotaMonitoring = lazy(() => import('./components/admin/AdminQuotaMonitoring'));
const AdminQuotaRemaining = lazy(() => import('./components/admin/AdminQuotaRemaining'));
const AdminDemographics = lazy(() => import('./components/admin/AdminDemographics'));
const AdminSystemLogs = lazy(() => import('./components/admin/AdminSystemLogs'));
const AdminMarketingTools = lazy(() => import('./components/admin/AdminMarketingTools'));
const AdminCRM = lazy(() => import('./components/admin/AdminCRM'));
const AdminUserManager = lazy(() => import('./components/admin/AdminUserManager'));
const AdminBackup = lazy(() => import('./components/admin/AdminBackup'));

const TAB_TO_PATH = {
  // User
  dashboard: '/dashboard',
  register: '/register',
  register_indent: '/register/indent',
  register_indent_internal: '/register/indent-internal',
  students: '/students',
  announcements: '/announcements',
  payments: '/payments',
  psychotest: '/psychotest',
  profile: '/profile',

  // Admin
  admin_dashboard: '/admin',
  admin_report: '/admin/report',
  admin_verify: '/admin/verify',
  admin_indent_verification: '/admin/indent-verification',
  admin_agreements: '/admin/agreements',
  admin_finance_dashboard: '/admin/finance',
  admin_payment_approval: '/admin/payment-approval',
  admin_vouchers: '/admin/vouchers',
  admin_followup: '/admin/followup',
  admin_requests: '/admin/requests',
  admin_resignation: '/admin/resignation',
  admin_transfers: '/admin/transfers',
  admin_interviews: '/admin/interviews',
  admin_scoring: '/admin/scoring',
  admin_ranking: '/admin/ranking',
  admin_school_settings: '/admin/settings/school',
  admin_quota_monitoring: '/admin/quota-monitoring',
  admin_quota_remaining: '/admin/quota-remaining',
  admin_demographics: '/admin/demographics',
  admin_test_settings: '/admin/settings/test',
  admin_payment_settings: '/admin/settings/payment',
  admin_app_settings: '/admin/settings/app',
  admin_website_settings: '/admin/settings/website',
  admin_test_recap: '/admin/test-recap',
  admin_reregistration: '/admin/reregistration',
  admin_student_data: '/admin/student-data',
  admin_logs: '/admin/logs',
  admin_marketing: '/admin/marketing',
  admin_crm: '/admin/crm',
  admin_users: '/admin/users',
  admin_backup: '/admin/backup'
};

const THEME_CONFIG = {
  default: { // Modern Emerald (Clean, Professional)
    sidebarBg: 'bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xl',
    sidebarText: 'text-slate-600 dark:text-slate-300',
    sidebarHeaderBorder: 'border-slate-100 dark:border-slate-800',
    mobileHeaderBg: 'bg-emerald-600 dark:bg-emerald-700',
    mainBg: 'bg-slate-50/50 dark:bg-slate-950',

    navActive: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-l-4 border-emerald-500',
    navInactive: 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400',
    navIcon: 'text-current'
  },
  berry: {
    sidebarBg: 'bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xl',
    sidebarText: 'text-slate-600 dark:text-slate-300',
    sidebarHeaderBorder: 'border-slate-100 dark:border-slate-800',
    mobileHeaderBg: 'bg-emerald-600 dark:bg-emerald-700',
    mainBg: 'bg-slate-50/50 dark:bg-slate-950',

    navActive: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-l-4 border-emerald-500',
    navInactive: 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400',
    navIcon: 'text-current'
  },
  ocean: {
    sidebarBg: 'bg-gradient-to-b from-cyan-900 to-blue-900 dark:from-slate-900 dark:to-slate-950 shadow-2xl text-white',
    sidebarText: 'text-cyan-100 dark:text-slate-400',
    sidebarHeaderBorder: 'border-cyan-800 dark:border-slate-800',
    mobileHeaderBg: 'bg-cyan-700 dark:bg-slate-800',
    mainBg: 'bg-cyan-50/30 dark:bg-slate-950',

    navActive: 'bg-white/10 text-white backdrop-blur-sm shadow-md rounded-xl mx-2',
    navInactive: 'text-cyan-200/80 hover:bg-white/5 hover:text-white mx-2 rounded-xl transition-all',
    navIcon: 'text-current'
  },
  midnight: {
    sidebarBg: 'bg-[#0f172a] dark:bg-[#020617] border-r border-slate-800 shadow-2xl',
    sidebarText: 'text-slate-400 dark:text-slate-500',
    sidebarHeaderBorder: 'border-slate-800',
    mobileHeaderBg: 'bg-[#0f172a]',
    mainBg: 'bg-[#f3f4f6] dark:bg-[#020617]',

    navActive: 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 rounded-lg mx-2',
    navInactive: 'text-slate-400 hover:text-indigo-400 hover:bg-white/5 mx-2 rounded-lg transition-colors',
    navIcon: 'text-current'
  },
  sunset: {
    sidebarBg: 'bg-white dark:bg-slate-900 border-r border-orange-100 dark:border-slate-800 shadow-lg',
    sidebarText: 'text-slate-600 dark:text-slate-400',
    sidebarHeaderBorder: 'border-orange-50 dark:border-slate-800',
    mobileHeaderBg: 'bg-gradient-to-r from-orange-500 to-rose-500 dark:from-slate-800 dark:to-slate-900',
    mainBg: 'bg-orange-50/30 dark:bg-slate-950',

    navActive: 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/30 rounded-full mx-2',
    navInactive: 'text-slate-500 dark:text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-full mx-2 transition-all',
    navIcon: 'text-current'
  }
};

const RegisterWrapper = ({ user, showToast, isIndent = false, isInternal = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  // Prioritize prop, then fallback to location state (handling both legacy and direct access)
  const indentState = isIndent || location.state?.isIndent || false;
  return <RegistrationWizard user={user} showToast={showToast} onComplete={() => navigate('/dashboard')} initialIndent={indentState} isInternal={isInternal} />;
};

const StudentWrapper = ({ user, showToast }) => {
  const location = useLocation();
  return <StudentManager user={user} showToast={showToast} initialTab={location.state?.tab} />;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPermissions, setAdminPermissions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [appSettings, setAppSettings] = useState({
    app_name: '',
    app_version: '',
    app_logo: '',
    app_template: 'berry'
  });
  const [academicYears, setAcademicYears] = useState([]);
  const [indentInternalActive, setIndentInternalActive] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return false;
  });
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const handleRegisterClick = () => {
    const hasIndent = academicYears.some(ay => ay.indent_enabled && !ay.is_default);
    if (hasIndent || indentInternalActive) {
      setShowRegisterModal(true);
    } else {
      navigate('/register');
    }
  };

  const hasAccess = (moduleId) => {
    if (!isAdmin) return false;
    if (adminPermissions && adminPermissions.length > 0) {
      return adminPermissions.includes(moduleId);
    }
    return true;
  };

  const handleNavigate = (tab, params) => {
    const path = TAB_TO_PATH[tab] || tab;
    // Map legacy 'dashboard' to user or admin dashboard based on role?
    // TAB_TO_PATH['dashboard'] is '/dashboard'.
    // If admin calls 'dashboard', we might want '/admin'.
    // But usually specific calls use specific IDs.

    // Quick fix for Admin Logout redirect or generic calls
    if (tab === 'dashboard' && isAdmin) {
      navigate('/admin', { state: params });
    } else {
      navigate(path, { state: params });
    }
  };

  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  useEffect(() => {
    // Theme logic
    const root = window.document.documentElement;
    root.classList.remove('light');
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Check sessionStorage cache first for instant load
        const cached = sessionStorage.getItem('app_settings_cache');
        if (cached) {
          const cachedData = JSON.parse(cached);
          setAppSettings(cachedData.settings);
          return cachedData.admins;
        }


        // SUPABASE: Fetch settings from app_settings table
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 'main')
          .single();



        if (data) {
          const settings = {
            app_name: data.app_name || '',
            app_version: data.app_version || '',
            app_logo: data.app_logo || '',
            app_template: data.app_template || 'berry'
          };
          setAppSettings(settings);

          // Cache to sessionStorage for faster subsequent loads
          const admins = data.crm_config?.admins || data.admins || [];
          sessionStorage.setItem('app_settings_cache', JSON.stringify({ settings, admins }));

          // SEO & Analytics Implementation
          const seo = data.landing_page?.seo || {};

          if (seo.title) document.title = seo.title;
          else if (data.app_name) document.title = data.app_name;

          let metaDesc = document.querySelector('meta[name="description"]');
          if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = "description";
            document.head.appendChild(metaDesc);
          }
          if (seo.description) metaDesc.content = seo.description;

          let metaKeywords = document.querySelector('meta[name="keywords"]');
          if (!metaKeywords) {
            metaKeywords = document.createElement('meta');
            metaKeywords.name = "keywords";
            document.head.appendChild(metaKeywords);
          }
          if (seo.keywords) metaKeywords.content = seo.keywords;

          // Google Search Console Verification
          if (seo.google_verification) {
            let metaGoogle = document.querySelector('meta[name="google-site-verification"]');
            if (!metaGoogle) {
              metaGoogle = document.createElement('meta');
              metaGoogle.name = "google-site-verification";
              document.head.appendChild(metaGoogle);
            }
            // Extract content if user pasted full tag (e.g. <meta name="..." content="XYZ" />)
            const contentMatch = seo.google_verification.match(/content="([^"]+)"/);
            metaGoogle.content = contentMatch ? contentMatch[1] : seo.google_verification;
          }

          if (seo.gtm_id && !document.getElementById('gtm_script')) {
            const script = document.createElement('script');
            script.id = 'gtm_script';
            script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${seo.gtm_id}');`;
            document.head.appendChild(script);
          }

          if (seo.pixel_id && !document.getElementById('fb_pixel')) {
            const script = document.createElement('script');
            script.id = 'fb_pixel';
            script.innerHTML = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${seo.pixel_id}');
fbq('track', 'PageView');`;
            document.head.appendChild(script);
          }

          return admins;
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      }
      return [];
    };

    const fetchAcademicYears = async () => {
      try {
        // Fetch academic years and indent settings in parallel
        const [ayResult, indentSetResult] = await Promise.all([
          supabase.from('academic_years').select('*'),
          supabase.from('indent_settings').select('*').maybeSingle()
        ]);

        if (ayResult.data) setAcademicYears(ayResult.data);
        if (indentSetResult.data) setIndentInternalActive(indentSetResult.data.active);
      } catch (e) {
        console.error("Failed to load academic years/indent settings", e);
      }
    };

    fetchAcademicYears();
    fetchSettings(); // Critical: Ensure SEO settings load for anonymous users (Googlebot)

    // SUPABASE AUTH LISTENER
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user || null;

      if (u) {
        // 1. Fetch settings and perms first
        const settingsPromise = fetchSettings();
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3000));

        const admins = await Promise.race([settingsPromise, timeoutPromise]);

        // 2. Determine admin status early
        let isUserAdmin = false;
        let perms = [];

        if (admins && admins.length > 0) {
          const adminData = admins.find(a => a.email?.toLowerCase() === u.email?.toLowerCase());
          if (adminData) {
            isUserAdmin = true;
            if (adminData.permissions) perms = adminData.permissions;
          }
        }

        // Hard fallback for emails containing "admin"
        if (!isUserAdmin && u.email?.toLowerCase().includes('admin')) {
          isUserAdmin = true;
        }

        // 3. Update all states in a single batch (React 18 will batch these)
        setIsAdmin(isUserAdmin);
        setAdminPermissions(perms);
        setUser(u);
        setLoading(false);

        // 4. Handle redirects
        if (location.pathname === '/login' || location.pathname === '/') {
          navigate(isUserAdmin ? '/admin' : '/dashboard');
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setAdminPermissions([]);
        setLoading(false);
      }
    });

    const handleSettingsUpdate = (e) => {
      if (e.detail) {
        setAppSettings(prev => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('app-settings-updated', handleSettingsUpdate);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('app-settings-updated', handleSettingsUpdate);
    };
  }, []);

  // Safety Timeout Force Entry
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setLoading(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/login');
  };

  const theme = THEME_CONFIG[appSettings.app_template] || THEME_CONFIG['default'];

  const SidebarItem = useMemo(() => {
    const Component = ({ icon, label, path, badge }) => {
      const location = useLocation();
      const navigate = useNavigate();
      return (
        <NavItem
          icon={icon}
          label={label}
          active={location.pathname === path}
          onClick={() => navigate(path)}
          badge={badge}
          activeClass={theme.navActive}
          inactiveClass={theme.navInactive}
          iconClass={theme.navIcon}
        />
      );
    };
    return Component;
  }, [theme]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Memuat Sistem...</p>
          <button
            onClick={() => { supabase.auth.signOut(); window.location.reload(); }}
            className="text-[10px] text-red-500 hover:underline mt-4 font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
          >
            Batalkan & Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`font-sans text-slate-800 dark:text-slate-200 flex flex-col ${['/', '/panduan', '/login'].includes(location.pathname) ? 'min-h-screen w-full' : 'md:flex-row h-screen overflow-hidden'} ${theme.mainBg} transition-colors duration-300`}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {/* <VisitorLogger /> */}

      <Routes>
        <Route path="/" element={<ErrorBoundary><Suspense fallback={<div className="hero-placeholder"><div className="animate-pulse text-white/50">Memuat...</div></div>}><SchoolWebsite user={user} isAdmin={isAdmin} onLogin={() => navigate('/login')} onDashboard={() => navigate(isAdmin ? '/admin' : '/dashboard')} /></Suspense></ErrorBoundary>} />
        <Route path="/login" element={!user ? <ErrorBoundary><AuthScreen showToast={showToast} onBack={() => navigate('/')} /></ErrorBoundary> : <Navigate to={isAdmin ? '/admin' : '/dashboard'} />} />
        <Route path="/panduan" element={<Suspense fallback={<PageSkeleton />}><GuidePage user={user} isAdmin={isAdmin} /></Suspense>} />

        <Route element={user ? (
          <>
            {/* Mobile Header */}
            <div className={`md:hidden ${theme.mobileHeaderBg} text-white p-4 flex justify-between items-center sticky top-0 z-40 shadow-md`}>
              <div className="flex items-center gap-2">
                {appSettings.app_logo ? (
                  <img src={appSettings.app_logo} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white" />
                ) : (
                  <div className={`w-8 h-8 bg-white rounded-lg flex items-center justify-center font-bold ${theme.mobileHeaderBg === 'bg-white' ? 'text-emerald-700' : 'text-slate-800'}`}>{appSettings.app_name[0]}</div>
                )}
                <span className="font-bold">{appSettings.app_name}</span>
              </div>
              {isAdmin && <button onClick={() => setSidebarOpen(!sidebarOpen)}><Menu /></button>}
            </div>

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 ${theme.sidebarBg} ${theme.sidebarText} transform transition-transform duration-300 ease-in-out flex flex-col md:translate-x-0 md:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${['/', '/panduan', '/login'].includes(location.pathname) ? 'hidden md:hidden' : ''}`}>
              <div className={`p-6 border-b ${theme.sidebarHeaderBorder} flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                  {appSettings.app_logo ? (
                    <img src={appSettings.app_logo} alt="Logo" className="w-10 h-10 rounded-lg object-contain bg-white p-0.5" />
                  ) : (
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-emerald-700 font-bold shadow-sm">{appSettings.app_name[0]}</div>
                  )}
                  <div className="text-sm font-bold leading-tight">{appSettings.app_name}<br /><span className="opacity-50 font-normal text-xs">{appSettings.app_version}</span></div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="md:hidden opacity-70 hover:opacity-100"><X /></button>
              </div>

              <div className="flex-1 p-4 space-y-1 overflow-y-auto">
                {!isAdmin ? (
                  <>
                    <SidebarItem icon={<LayoutDashboard size={18} />} label="Dashboard" path="/dashboard" />
                    <SidebarItem icon={<FileText size={18} />} label="Pendaftaran (eksternal)" path="/register" />
                    {academicYears.some(ay => ay.indent_enabled && !ay.is_default) && (
                      <SidebarItem icon={<CalendarClock size={18} />} label="Pendaftaran Inden" path="/register/indent" />
                    )}
                    {indentInternalActive && (
                      <SidebarItem icon={<CalendarClock size={18} />} label="Inden Internal" path="/register/indent-internal" badge="New" />
                    )}
                    <SidebarItem icon={<Users size={18} />} label="Data Anak" path="/students" />
                    <SidebarItem icon={<Megaphone size={18} />} label="Pengumuman" path="/announcements" />
                    <SidebarItem icon={<CreditCard size={18} />} label="Tagihan" path="/payments" />
                  </>
                ) : (
                  <>
                    <div className="text-xs font-bold px-4 py-2 mt-2 uppercase tracking-wider opacity-50">Main</div>
                    {hasAccess('admin_dashboard') && <SidebarItem icon={<LayoutDashboard size={18} />} label="Dashboard" path="/admin" />}
                    {(hasAccess('admin_school_settings') || hasAccess('admin_report')) && <SidebarItem icon={<PieChart size={18} />} label="Monitoring Kuota" path="/admin/quota-monitoring" />}
                    {(hasAccess('admin_school_settings') || hasAccess('admin_report')) && <SidebarItem icon={<PieChart size={18} />} label="Data Sisa Kuota" path="/admin/quota-remaining" badge="New" />}
                    {(hasAccess('admin_school_settings') || hasAccess('admin_report')) && <SidebarItem icon={<Globe size={18} />} label="Demografi Pendaftaran" path="/admin/demographics" />}

                    <div className="text-xs font-bold px-4 py-2 mt-4 flex items-center gap-2 opacity-50">
                      <span className="uppercase tracking-wider">Seleksi PPDB</span>
                      <div className="h-px bg-current flex-1 opacity-20"></div>
                    </div>
                    {hasAccess('admin_verify') && <SidebarItem icon={<FileCheck size={18} />} label="Verifikasi Data" path="/admin/verify" />}
                    {hasAccess('admin_verify') && <SidebarItem icon={<FileCheck size={18} />} label="Verifikasi Inden Internal" path="/admin/indent-verification" badge="New" />}
                    {hasAccess('admin_verify') && <SidebarItem icon={<FileText size={18} />} label="Surat Perjanjian" path="/admin/agreements" />}
                    {hasAccess('admin_interviews') && <SidebarItem icon={<Video size={18} />} label="Jadwal Test" path="/admin/interviews" />}
                    {hasAccess('admin_scoring') && <SidebarItem icon={<ClipboardList size={18} />} label="Nilai & Kelulusan" path="/admin/scoring" />}
                    {hasAccess('admin_scoring') && <SidebarItem icon={<FileSpreadsheet size={18} />} label="Rekapitulasi Tes" path="/admin/test-recap" badge="New" />}
                    {hasAccess('admin_ranking') && <SidebarItem icon={<Trophy size={18} />} label="Perangkingan" path="/admin/ranking" />}

                    <div className="text-xs font-bold px-4 py-2 mt-4 flex items-center gap-2 opacity-50">
                      <span className="uppercase tracking-wider">Data Siswa</span>
                      <div className="h-px bg-current flex-1 opacity-20"></div>
                    </div>
                    {(hasAccess('admin_verify') || hasAccess('admin_report')) && <SidebarItem icon={<FileCheck size={18} />} label="Proses Daftar Ulang" path="/admin/reregistration" />}
                    {hasAccess('admin_report') && <SidebarItem icon={<FileSpreadsheet size={18} />} label="Data Pendaftar" path="/admin/report" />}
                    {hasAccess('admin_report') && <SidebarItem icon={<GraduationCap size={18} />} label="Data Siswa Lulus" path="/admin/student-data" />}
                    {hasAccess('admin_followup') && <SidebarItem icon={<MessageCircle size={18} />} label="Follow Up (WA)" path="/admin/followup" />}
                    {hasAccess('admin_requests') && <SidebarItem icon={<FileEdit size={18} />} label="Permintaan Edit" path="/admin/requests" />}
                    {hasAccess('admin_resignation') && <SidebarItem icon={<LogOut size={18} />} label="Pengunduran Diri" path="/admin/resignation" />}
                    {hasAccess('admin_transfers') && <SidebarItem icon={<ArrowRightLeft size={18} />} label="Transfer / Mutasi" path="/admin/transfers" badge="Beta" />}

                    <div className="text-xs font-bold px-4 py-2 mt-4 flex items-center gap-2 opacity-50">
                      <span className="uppercase tracking-wider">Keuangan (Finance)</span>
                      <div className="h-px bg-current flex-1 opacity-20"></div>
                    </div>
                    {hasAccess('admin_finance_dashboard') && <SidebarItem icon={<DollarSign size={18} />} label="Dashboard Keuangan" path="/admin/finance" />}
                    {hasAccess('admin_payment_approval') && <SidebarItem icon={<CreditCard size={18} />} label="Approval Manual" path="/admin/payment-approval" />}
                    {hasAccess('admin_vouchers') && <SidebarItem icon={<Tag size={18} />} label="Voucher & Diskon" path="/admin/vouchers" />}
                    {hasAccess('admin_finance_dashboard') && <SidebarItem icon={<Target size={18} />} label="Marketing Tools" path="/admin/marketing" badge="New" />}
                    {/* @turbo-replace: CRM Sidebar Item */}
                    {hasAccess('admin_followup') && <SidebarItem icon={<Users size={18} />} label="CRM & WhatsApp" path="/admin/crm" badge="Beta" />}
                    {hasAccess('admin_app_settings') && <SidebarItem icon={<Users size={18} />} label="Manajemen Akun" path="/admin/users" />}

                    <div className="text-xs font-bold px-4 py-2 mt-4 flex items-center gap-2 opacity-50">
                      <span className="uppercase tracking-wider">Pengaturan</span>
                      <div className="h-px bg-current flex-1 opacity-20"></div>
                    </div>
                    {hasAccess('admin_school_settings') && <SidebarItem icon={<Building size={18} />} label="Penetapan Kuota" path="/admin/settings/school" />}
                    {hasAccess('admin_test_settings') && <SidebarItem icon={<Timer size={18} />} label="Ujian & AI" path="/admin/settings/test" badge="New" />}
                    {hasAccess('admin_payment_settings') && <SidebarItem icon={<Wallet size={18} />} label="Rekening & Biaya" path="/admin/settings/payment" />}
                    {hasAccess('admin_app_settings') && <SidebarItem icon={<Settings size={18} />} label="Aplikasi" path="/admin/settings/app" />}
                    {hasAccess('admin_website_settings') && <SidebarItem icon={<Globe size={18} />} label="Website" path="/admin/settings/website" />}
                    {hasAccess('admin_app_settings') && <SidebarItem icon={<ClipboardList size={18} />} label="Sistem Log" path="/admin/logs" />}
                    {hasAccess('admin_app_settings') && <SidebarItem icon={<Database size={18} />} label="Backup & Restore" path="/admin/backup" />}
                  </>
                )}
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
              {!['/', '/panduan', '/login'].includes(location.pathname) && (
                <Header
                  user={user}
                  isAdmin={isAdmin}
                  appSettings={appSettings}
                  onLogout={handleLogout}
                  onNavigate={(tab) => navigate(TAB_TO_PATH[tab] || tab)}
                  theme={theme}
                  darkMode={darkMode}
                  onToggleDarkMode={() => {
                    const nextMode = !darkMode;
                    setDarkMode(nextMode);
                    showToast(nextMode ? 'Mode Gelap Aktif' : 'Mode Terang Aktif', 'success');
                  }}
                />
              )}
              <main className={`flex-1 overflow-y-auto w-full max-w-[100vw] ${['/', '/panduan', '/login'].includes(location.pathname) ? '' : 'p-4 md:p-8 bg-slate-50/50 pb-32 md:pb-8'}`}>
                <ErrorBoundary>
                  <Suspense fallback={<PageSkeleton />}>
                    <Outlet />
                  </Suspense>
                </ErrorBoundary>
              </main>

              {/* Mobile Bottom Nav */}
              {!isAdmin && (
                <div className="md:hidden fixed bottom-6 left-4 right-4 z-50">
                  <div className="bg-white/90 backdrop-blur-xl border border-slate-200/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-[2.5rem] px-2 py-2 flex justify-between items-center transition-all duration-500">
                    <button onClick={() => navigate('/dashboard')} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[2rem] transition-all duration-300 ${location.pathname === '/dashboard' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 translate-y-[-4px]' : 'text-slate-400 opacity-70 hover:opacity-100'}`}>
                      <Home size={22} strokeWidth={location.pathname === '/dashboard' ? 2.5 : 2} />
                      <span className={`text-[9px] font-black uppercase tracking-widest mt-1 transition-all ${location.pathname === '/dashboard' ? 'block' : 'hidden'}`}>Home</span>
                    </button>
                    <button onClick={() => navigate('/students')} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[2rem] transition-all duration-300 ${location.pathname === '/students' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 translate-y-[-4px]' : 'text-slate-400 opacity-70 hover:opacity-100'}`}>
                      <Users size={22} strokeWidth={location.pathname === '/students' ? 2.5 : 2} />
                      <span className={`text-[9px] font-black uppercase tracking-widest mt-1 transition-all ${location.pathname === '/students' ? 'block' : 'hidden'}`}>Data</span>
                    </button>
                    <div className="mx-1">
                      <button onClick={handleRegisterClick} className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-500 hover:rotate-90 active:scale-90 border-4 border-white ${location.pathname === '/register' ? 'bg-emerald-800 scale-110 shadow-emerald-200' : 'bg-gradient-to-br from-emerald-500 to-teal-500'}`}>
                        <Plus size={32} strokeWidth={3} />
                      </button>
                    </div>
                    <button onClick={() => navigate('/payments')} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[2rem] transition-all duration-300 ${location.pathname === '/payments' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 translate-y-[-4px]' : 'text-slate-400 opacity-70 hover:opacity-100'}`}>
                      <CreditCard size={22} strokeWidth={location.pathname === '/payments' ? 2.5 : 2} />
                      <span className={`text-[9px] font-black uppercase tracking-widest mt-1 transition-all ${location.pathname === '/payments' ? 'block' : 'hidden'}`}>Bayar</span>
                    </button>
                    <button onClick={() => navigate('/profile')} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[2rem] transition-all duration-300 ${location.pathname === '/profile' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 translate-y-[-4px]' : 'text-slate-400 opacity-70 hover:opacity-100'}`}>
                      <User size={22} strokeWidth={location.pathname === '/profile' ? 2.5 : 2} />
                      <span className={`text-[9px] font-black uppercase tracking-widest mt-1 transition-all ${location.pathname === '/profile' ? 'block' : 'hidden'}`}>Akun</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : <Navigate to="/login" />}>
          {/* USER ROUTES - Available for ALL logged in users (including admin) */}
          {user && (
            <>
              <Route path="/dashboard" element={<UserDashboard user={user} onNavigate={handleNavigate} showToast={showToast} />} />
              <Route path="/register" element={<RegisterWrapper user={user} showToast={showToast} isIndent={false} />} />
              <Route path="/register/indent" element={<RegisterWrapper user={user} showToast={showToast} isIndent={true} />} />
              <Route path="/register/indent-internal" element={<RegisterWrapper user={user} showToast={showToast} isIndent={true} isInternal={true} />} />
              <Route path="/students" element={<StudentWrapper user={user} showToast={showToast} />} />
              <Route path="/announcements" element={<AnnouncementBoard user={user} />} />
              <Route path="/payments" element={<PaymentHistory user={user} showToast={showToast} />} />
              <Route path="/psychotest" element={<PsychotestModule user={user} showToast={showToast} onNavigate={handleNavigate} />} />
              <Route path="/profile" element={<UserProfile user={user} showToast={showToast} />} />
            </>
          )}

          {/* ADMIN ROUTES */}
          {isAdmin && (
            <>
              {hasAccess('admin_dashboard') && <Route path="/admin" element={<AdminDashboard />} />}
              {hasAccess('admin_report') && <Route path="/admin/report" element={<AdminStudentReport showToast={showToast} />} />}
              {hasAccess('admin_verify') && <Route path="/admin/verify" element={<AdminVerification showToast={showToast} />} />}
              {hasAccess('admin_verify') && <Route path="/admin/indent-verification" element={<AdminIndentVerification showToast={showToast} />} />}
              {hasAccess('admin_verify') && <Route path="/admin/agreements" element={<AdminAgreements showToast={showToast} />} />}

              {hasAccess('admin_finance_dashboard') && <Route path="/admin/finance" element={<AdminFinanceDashboard showToast={showToast} />} />}
              {hasAccess('admin_payment_approval') && <Route path="/admin/payment-approval" element={<AdminPaymentApproval showToast={showToast} />} />}
              {hasAccess('admin_vouchers') && <Route path="/admin/vouchers" element={<AdminVoucherManager showToast={showToast} />} />}

              {hasAccess('admin_followup') && <Route path="/admin/followup" element={<AdminFollowUp showToast={showToast} />} />}
              {hasAccess('admin_requests') && <Route path="/admin/requests" element={<AdminDataRequests showToast={showToast} />} />}
              {hasAccess('admin_resignation') && <Route path="/admin/resignation" element={<AdminResignation showToast={showToast} />} />}
              {hasAccess('admin_transfers') && <Route path="/admin/transfers" element={<AdminTransferManager showToast={showToast} />} />}

              {hasAccess('admin_interviews') && <Route path="/admin/interviews" element={<AdminInterviewManager showToast={showToast} />} />}
              {hasAccess('admin_scoring') && <Route path="/admin/scoring" element={<AdminScoring showToast={showToast} />} />}
              {hasAccess('admin_ranking') && <Route path="/admin/ranking" element={<AdminRanking showToast={showToast} />} />}

              {hasAccess('admin_school_settings') && <Route path="/admin/settings/school" element={<AdminSchoolSettings showToast={showToast} />} />}
              {(hasAccess('admin_school_settings') || hasAccess('admin_report')) && <Route path="/admin/quota-monitoring" element={<AdminQuotaMonitoring showToast={showToast} />} />}
              {(hasAccess('admin_school_settings') || hasAccess('admin_report')) && <Route path="/admin/quota-remaining" element={<AdminQuotaRemaining showToast={showToast} />} />}
              {(hasAccess('admin_school_settings') || hasAccess('admin_report')) && <Route path="/admin/demographics" element={<AdminDemographics showToast={showToast} />} />}

              {hasAccess('admin_test_settings') && <Route path="/admin/settings/test" element={<AdminTestSettings showToast={showToast} />} />}
              {hasAccess('admin_payment_settings') && <Route path="/admin/settings/payment" element={<AdminPaymentSettings showToast={showToast} />} />}
              {hasAccess('admin_app_settings') && <Route path="/admin/settings/app" element={<AdminAppSettings showToast={showToast} />} />}
              {hasAccess('admin_website_settings') && <Route path="/admin/settings/website" element={<AdminWebsiteSettings showToast={showToast} />} />}

              {hasAccess('admin_scoring') && <Route path="/admin/test-recap" element={<AdminTestRecap showToast={showToast} />} />}
              {(hasAccess('admin_verify') || hasAccess('admin_report')) && <Route path="/admin/reregistration" element={<AdminReregistration showToast={showToast} />} />}
              {hasAccess('admin_report') && <Route path="/admin/student-data" element={<AdminStudentData showToast={showToast} />} />}
              {hasAccess('admin_app_settings') && <Route path="/admin/logs" element={<AdminSystemLogs showToast={showToast} />} />}
              {hasAccess('admin_app_settings') && <Route path="/admin/backup" element={<AdminBackup showToast={showToast} />} />}
              {hasAccess('admin_finance_dashboard') && <Route path="/admin/marketing" element={<AdminMarketingTools showToast={showToast} />} />}
              {/* @turbo-replace: CRM Route - Allow all admins for easier access */}
              <Route path="/admin/crm" element={<AdminCRM showToast={showToast} />} />
              <Route path="/admin/users" element={<AdminUserManager showToast={showToast} />} />
              {/* Profile for Admins */}
              <Route path="/profile" element={<UserProfile user={user} showToast={showToast} />} />
            </>
          )}
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Overlay for Mobile Sidebar */}
      {sidebarOpen && isAdmin && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Register Choice Modal */}
      <Modal isOpen={showRegisterModal} onClose={() => setShowRegisterModal(false)} title="Pilih Jalur Pendaftaran">
        <div className="p-6 grid gap-4">
          <button onClick={() => { setShowRegisterModal(false); navigate('/register'); }} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group text-left shadow-sm">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText size={24} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wide">Pendaftaran Reguler</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Daftar untuk tahun ajaran aktif saat ini.</p>
            </div>
            <div className="ml-auto text-slate-300 group-hover:text-emerald-500 transition-colors">
              <ChevronRight size={20} />
            </div>
          </button>

          <button onClick={() => { setShowRegisterModal(false); navigate('/register/indent'); }} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group text-left shadow-sm">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CalendarClock size={24} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wide">Pendaftaran Inden</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Booking kursi untuk tahun ajaran mendatang.</p>
            </div>
            <div className="ml-auto text-slate-300 group-hover:text-purple-500 transition-colors">
              <ChevronRight size={20} />
            </div>
          </button>

          {indentInternalActive && (
            <button onClick={() => { setShowRegisterModal(false); navigate('/register/indent-internal'); }} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group text-left shadow-sm">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CalendarClock size={24} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wide">Inden Internal</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Khusus siswa internal (naik jenjang).</p>
              </div>
              <div className="ml-auto text-slate-300 group-hover:text-blue-500 transition-colors">
                <ChevronRight size={20} />
              </div>
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}