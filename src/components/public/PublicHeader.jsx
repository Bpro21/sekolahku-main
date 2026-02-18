import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Phone, Mail, Facebook, Instagram, Twitter,
    Home, FileText, BookOpen, DollarSign, HelpCircle, LogIn, LayoutDashboard
} from 'lucide-react';

const PublicHeader = ({ settings, user, isAdmin, onLogin, activeTab: initialActiveTab, onNavigate }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [scrolled, setScrolled] = useState(false);
    const [activeTab, setActiveTab] = useState(initialActiveTab || 'home');

    // Handle scroll effect
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (href) => {
        // If we are not on the home page ('/'), navigate there first
        if (location.pathname !== '/' && href.startsWith('#')) {
            navigate('/', { state: { targetId: href } });
            return;
        }

        if (onNavigate) {
            onNavigate(href);
        } else {
            const id = href.replace('#', '');
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
                setActiveTab(id);
            }
        }
    };

    const navLinks = [
        { name: 'Beranda', href: '#home', icon: Home },
        { name: 'Alur Daftar', href: '#flow', icon: FileText },
        { name: 'Program', href: '#programs', icon: BookOpen },
        { name: 'Biaya', href: '#fees', icon: DollarSign },
        { name: 'FAQ', href: '#faq', icon: HelpCircle },
        { name: 'Kontak', href: '#contact', icon: Phone },
    ];

    const contactOffice = settings?.landing_page?.contact_office || '';
    const contactEmail = settings?.landing_page?.contact_email || '';
    const appName = settings?.app_name || '';
    const schoolName = settings?.school_name || '';

    return (
        <>
            {/* Top Bar - Hidden on Mobile */}
            <div className="bg-blue-900 text-white py-2 text-sm hidden md:block relative z-50">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <div className="flex space-x-6">
                        <span className="flex items-center gap-2"><Phone size={14} /> {contactOffice} (Hotline PPDB)</span>
                        <span className="flex items-center gap-2"><Mail size={14} /> {contactEmail}</span>
                    </div>
                    <div className="flex space-x-4">
                        <a href="#" className="hover:text-blue-300 transition" aria-label="Facebook"><Facebook size={16} /></a>
                        <a href="#" className="hover:text-blue-300 transition" aria-label="Instagram"><Instagram size={16} /></a>
                        <a href="#" className="hover:text-blue-300 transition" aria-label="Twitter"><Twitter size={16} /></a>
                    </div>
                </div>
            </div>

            {/* Navigation (Desktop) */}
            <nav className={`sticky top-0 z-40 transition-all duration-300 hidden md:block ${scrolled ? 'bg-white shadow-lg py-2' : 'bg-white md:bg-transparent md:py-4'}`}>
                <div className="container mx-auto px-4">
                    <div className="flex justify-between items-center">
                        {/* Logo */}
                        <div
                            className="flex items-center gap-3 cursor-pointer group"
                            onClick={() => navigate('/')}
                            role="button"
                            aria-label="Kembali ke Beranda"
                        >
                            {settings?.app_logo ? (
                                <img src={settings.app_logo} alt="Logo" className="w-10 h-10 rounded-lg object-contain bg-white group-hover:scale-105 transition" />
                            ) : (
                                <div className="w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:scale-105 transition">
                                    {appName[0]}
                                </div>
                            )}
                            <div className={`flex flex-col ${!scrolled && location.pathname === '/' ? 'md:text-white' : 'text-gray-800'}`}>
                                <span className="font-bold text-lg leading-tight uppercase">{appName}</span>
                                <span className="text-xs tracking-wider">{schoolName}</span>
                            </div>
                        </div>

                        {/* Desktop Menu */}
                        <div className="flex space-x-6 items-center">
                            {navLinks.map((link) => (
                                <button
                                    key={link.name}
                                    onClick={() => scrollToSection(link.href)}
                                    className={`font-medium hover:text-yellow-400 transition ${!scrolled && location.pathname === '/' ? 'text-white' : 'text-gray-700'}`}
                                    aria-label={`Navigasi ke ${link.name}`}
                                >
                                    {link.name}
                                </button>
                            ))}
                            <div className="flex items-center gap-2 border-l border-white/20 pl-4 ml-2">
                                <button
                                    onClick={() => user ? navigate(isAdmin ? '/admin' : '/dashboard') : navigate('/login')}
                                    className={`bg-yellow-500 hover:bg-yellow-600 text-blue-900 px-6 py-2 rounded-full font-bold transition shadow-lg transform hover:scale-105 flex items-center gap-2`}
                                    aria-label={user ? 'Buka Dashboard' : 'Login atau Daftar'}
                                >
                                    {user ? <LayoutDashboard size={18} /> : <LogIn size={18} />}
                                    {user ? 'Dashboard' : 'Login / Daftar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Top Bar - Only on non-home pages or when needed */}
            <div className={`md:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md shadow-sm py-3 px-4 transition-all duration-300 ${scrolled ? 'bg-white' : 'bg-white text-gray-900'}`}>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2" onClick={() => navigate('/')}>
                        <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {appName[0]}
                        </div>
                        <span className="font-bold text-lg text-gray-900 uppercase">{appName}</span>
                    </div>
                    <button
                        onClick={() => user ? navigate(isAdmin ? '/admin' : '/dashboard') : navigate('/login')}
                        className="text-blue-600 font-bold text-sm bg-blue-50 px-3 py-1.5 rounded-full flex items-center gap-1"
                        aria-label={user ? 'Buka Dashboard' : 'Login atau Daftar'}
                    >
                        {user ? <LayoutDashboard size={14} /> : <LogIn size={14} />}
                        {user ? 'Dashboard' : 'Login / Daftar'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default PublicHeader;
