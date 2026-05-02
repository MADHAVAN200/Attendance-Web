import React, { useState, useEffect } from 'react';
import { Menu, Bell, Moon, Sun, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileSidebar from './MobileSidebar';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const MobileDashboardLayout = ({ children, title = "Dashboard", hideHeader = false, headerAction, showBackButton = false }) => {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { unreadCount } = useNotification();
    const { user, avatarTimestamp } = useAuth();

    // Initialize theme from localStorage or default to 'dark' logic
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') || 'light'; // matches desktop default
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

    const avatarUrl = user?.avatar 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/uploads/avatars/${user.avatar}?t=${avatarTimestamp}`
        : null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-black font-poppins text-slate-900 dark:text-github-dark-text pb-6 md:pb-0 transition-colors duration-300 overflow-x-hidden">
            {/* Header */}
            {!hideHeader && (
                <header className="fixed top-0 left-0 right-0 h-20 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    <div className="flex items-center gap-3">
                        {showBackButton ? (
                            <button
                                onClick={() => navigate(-1)}
                                className="text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                            >
                                <Menu size={20} strokeWidth={2.5} />
                            </button>
                        )}
                        <h1 className="text-lg font-bold text-slate-800 dark:text-github-dark-text tracking-tight">{title}</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {headerAction}
                        <button
                            onClick={toggleTheme}
                            className="text-slate-500 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                        >
                            <Moon size={18} fill="currentColor" />
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => navigate('/notifications')}
                                className="relative text-slate-500 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center"
                            >
                                <Bell size={18} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-github-dark-subtle"></span>
                                )}
                            </button>
                        </div>
                        
                        {/* Profile Avatar */}
                        <button 
                            onClick={() => navigate('/profile')}
                            className="w-8 h-8 rounded-full border border-slate-200 dark:border-github-dark-border overflow-hidden active:scale-95 transition-transform"
                        >
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold uppercase">
                                    {user?.name?.charAt(0) || 'U'}
                                </div>
                            )}
                        </button>
                    </div>
                </header>
            )}

            {/* Sidebar */}
            <MobileSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Main Content */}
            <main className={`${hideHeader ? '' : 'pt-24 px-4 space-y-6'}`}>
                {children}
            </main>
        </div>
    );
};

export default MobileDashboardLayout;
