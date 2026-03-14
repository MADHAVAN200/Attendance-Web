import React, { useState, useEffect } from 'react';
import { Menu, Bell, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileSidebar from './MobileSidebar';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const MobileDashboardLayout = ({ children, title = "Dashboard", hideHeader = false }) => {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { unreadCount } = useNotification();

    // Initialize theme from localStorage or default to 'dark' logic
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') || 'dark'; // defaulting to dark for this aesthetic update
        }
        return 'dark';
    });

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#111827] font-poppins text-slate-900 dark:text-white pb-6 md:pb-0 transition-colors duration-300 overflow-x-hidden">
            {/* Header */}
            {!hideHeader && (
                <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-[#111827] border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between px-4 z-30">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                        >
                            <Menu size={24} strokeWidth={2.5} />
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-wide">{title}</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="text-slate-500 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                        >
                            {theme === 'light' ? <Moon size={22} fill="currentColor" /> : <Moon size={22} fill="currentColor" />}
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => navigate('/mobile-view/notifications')}
                                className="relative text-slate-500 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                            >
                                <Bell size={22} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-[#111827]"></span>
                                )}
                            </button>
                        </div>
                    </div>
                </header>
            )}

            {/* Sidebar */}
            <MobileSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Main Content */}
            <main className={`${hideHeader ? '' : 'pt-20 px-4 space-y-6'}`}>
                {children}
            </main>
        </div>
    );
};

export default MobileDashboardLayout;
