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
import NotificationDropdown from './NotificationDropdown';
import Sidebar from './Sidebar';

const DashboardLayout = ({ children, title = "Dashboard" }) => {
    const { unreadCount } = useNotification();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const { logout, user } = useAuth();

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
        <div className="flex min-h-screen bg-slate-50 dark:bg-dark-bg font-poppins text-slate-900 dark:text-white transition-colors duration-300">
            {/* Sidebar */}
            <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col relative w-full min-w-0">
                {/* Header */}
                <header className="h-16 bg-white dark:bg-dark-bg border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-10 z-10 shadow-sm shrink-0 transition-colors duration-300 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button
                            className="md:hidden p-2 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu size={20} />
                        </button>
                        <h1 className="text-xl font-semibold text-slate-800 dark:text-white hidden sm:block">{title}</h1>
                        <img src="/mano-logo.svg" alt="MANO" className="w-8 h-8 sm:hidden" />
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6">

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                        >
                            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                        </button>

                        <div className="relative">
                            <button
                                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                                className="relative p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <Bell className="w-5 h-5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-dark-bg animate-pulse"></span>
                                )}
                            </button>
                            <NotificationDropdown
                                isOpen={isNotificationOpen}
                                onClose={() => setIsNotificationOpen(false)}
                            />
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-3 pl-4 sm:pl-6 border-l border-slate-200 dark:border-slate-700 hover:opacity-80 transition-opacity outline-none"
                            >
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 capitalize">
                                        {user?.user_name || 'User'}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                                        {user?.user_type || 'Role'}
                                    </p>
                                </div>
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold border-2 border-white dark:border-slate-700 shadow-sm text-sm sm:text-base cursor-pointer overflow-hidden">
                                    {useAuth().user?.avatar_url || useAuth().user?.profile_image_url ? (
                                        <img
                                            src={useAuth().user?.avatar_url || useAuth().user?.profile_image_url}
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
                                    <div className="absolute right-0 mt-3 w-48 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-slate-100 dark:border-slate-700 z-20 py-1 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 sm:hidden">
                                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.user_name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                                        </div>

                                        <Link
                                            to="/profile"
                                            onClick={() => setIsProfileOpen(false)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                        >
                                            <User size={16} />
                                            My Profile
                                        </Link>

                                        <div className="my-1 border-t border-slate-100 dark:border-slate-800"></div>

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
                <main className="flex-1 p-4 sm:p-8 bg-slate-50/50 dark:bg-dark-bg transition-colors duration-300">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
