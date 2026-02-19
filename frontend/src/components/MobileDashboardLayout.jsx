import React, { useState, useEffect } from 'react';
import { Menu, Bell, Moon, Sun } from 'lucide-react';
import MobileSidebar from './MobileSidebar';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const MobileDashboardLayout = ({ children, title = "Dashboard", hideHeader = false }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { unreadCount } = useNotification();

    // ... (theme logic remains the same)
    // Initialize theme from localStorage or default to 'light'
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') || 'light';
        }
        return 'light';
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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-poppins text-slate-900 dark:text-white pb-20 md:pb-0">
            {/* Header */}
            {!hideHeader && (
                <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 z-30 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-lg font-bold text-slate-800 dark:text-white truncate max-w-[200px]">{title}</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTheme}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        >
                            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                        </button>
                        <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                        </button>
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
