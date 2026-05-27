import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Menu,
    Bell,
    Moon,
    Sun,
    LogOut,
    User,
    ChevronDown,
    Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import NotificationSidebar from './NotificationSidebar';
import Sidebar from './Sidebar';
import InternalChatbotWidget from './InternalChatbotWidget';

const DashboardLayout = ({ children, title = "Dashboard", noPadding = false }) => {
    const { unreadCount } = useNotification();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const { logout, user, avatarTimestamp } = useAuth();

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
        // Save preference
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-github-dark-bg font-poppins text-slate-900 dark:text-github-dark-text transition-colors duration-300">
            {/* Sidebar */}
            <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col relative w-full min-w-0 md:ml-64">
                {/* Header - Fixed */}
                <header className="fixed top-0 right-0 left-0 md:left-64 h-16 bg-white dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between px-4 sm:px-10 z-40 shadow-sm shrink-0 transition-colors duration-300">
                    <div className="flex items-center gap-4">
                        <button
                            className="md:hidden p-2 bg-slate-100 dark:bg-github-dark-subtle rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu size={20} />
                        </button>
                        <h1 className="text-xl font-semibold text-slate-800 dark:text-github-dark-text hidden sm:block">{title}</h1>
                        <img src="/mano-logo.svg" alt="MANO" className="w-8 h-8 sm:hidden" />
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6">

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-github-dark-muted transition-colors"
                        >
                            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                        </button>

                        <div className="relative">
                            <button
                                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                                className="relative p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <Bell className="w-5 h-5 text-slate-500 dark:text-github-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-github-dark-subtle animate-pulse"></span>
                                )}
                            </button>
                            <NotificationSidebar
                                isOpen={isNotificationOpen}
                                onClose={() => setIsNotificationOpen(false)}
                            />
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-3 pl-4 sm:pl-6 border-l border-slate-200 dark:border-github-dark-border hover:opacity-80 transition-opacity outline-none"
                            >
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-medium text-slate-700 dark:text-github-dark-text capitalize">
                                        {user?.user_name || 'User'}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-github-dark-muted capitalize">
                                        {user?.user_type || 'Role'}
                                    </p>
                                </div>
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold border-2 border-white dark:border-github-dark-border shadow-sm text-sm sm:text-base cursor-pointer overflow-hidden">
                                    {useAuth().user?.profile_image_url ? (
                                        <img
                                            src={`${useAuth().user?.profile_image_url}?t=${avatarTimestamp}`}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        useAuth().user?.user_name?.charAt(0).toUpperCase() || 'U'
                                    )}
                                </div>
                            </button>

                            {/* Profile Dropdown */}
                            {isProfileOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setIsProfileOpen(false)}
                                    ></div>
                                    <div className="absolute right-0 mt-3 w-48 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-slate-100 dark:border-github-dark-border z-20 py-1 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="px-4 py-2 border-b border-slate-100 dark:border-github-dark-border sm:hidden">
                                            <p className="text-sm font-medium text-slate-900 dark:text-github-dark-text truncate">{user?.user_name}</p>
                                            <p className="text-xs text-slate-500 dark:text-github-dark-muted truncate">{user?.email}</p>
                                        </div>

                                        <Link
                                            to="/profile"
                                            onClick={() => setIsProfileOpen(false)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-github-dark-text hover:bg-slate-50 dark:hover:bg-github-dark-border transition-colors"
                                        >
                                            <User size={16} />
                                            My Profile
                                        </Link>

                                        <div className="my-1 border-t border-slate-100 dark:border-github-dark-border"></div>

                                        <button
                                            onClick={() => {
                                                logout();
                                                setIsProfileOpen(false);
                                            }}
                                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
                                        >
                                            <LogOut size={16} />
                                            Logout
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Scrollable Content Area */}
                <main className={`flex-1 flex flex-col ${noPadding ? '' : 'p-4 sm:p-6'} bg-slate-50/50 dark:bg-github-dark-bg transition-colors duration-300 mt-16`}>
                    {children}
                </main>
            </div>
            <InternalChatbotWidget />
        </div>
    );
};


export default DashboardLayout;
