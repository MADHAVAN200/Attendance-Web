import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Settings,
    Bell,
    LogOut,
    TrendingUp,
    Calendar,
    Menu,
    X,
    Moon,
    Sun,
    Clock,
    MapPin,
    CreditCard,
    ClipboardList
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import NotificationDropdown from './NotificationDropdown';

const SidebarItem = ({ icon, text, to }) => {
    const location = useLocation();
    const active = to ? location.pathname === to : false;
    const isActive = active || (to === '/' && location.pathname === '/');

    const content = (
        <>
            <span className={`mr-3 transition-colors ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                {icon}
            </span>
            {text}
        </>
    );

    const className = `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 group ${isActive
        ? 'bg-indigo-50 dark:bg-dark-card text-indigo-600 dark:text-indigo-400 shadow-sm border border-transparent dark:border-slate-700'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-dark-card hover:text-slate-900 dark:hover:text-slate-200'
        }`;

    if (to) {
        return (
            <Link to={to} className={className}>
                {content}
            </Link>
        );
    }

    return (
        <a href="#" className={className}>
            {content}
        </a>
    );
};

const DashboardLayout = ({ children, title = "Dashboard" }) => {
    const { logout } = useAuth();
    const { unreadCount } = useNotification();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);

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
        <div className="flex h-screen bg-slate-50 dark:bg-dark-bg font-poppins text-slate-900 dark:text-white transition-colors duration-300">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-dark-bg border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex md:flex-col shadow-xl md:shadow-sm
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 font-bold text-xl text-indigo-600 dark:text-indigo-400">
                        <img src="/mano-logo.svg" alt="MANO" className="w-8 h-8" />
                        <span>MANO</span>
                    </div>
                    <button
                        className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                    <SidebarItem icon={<LayoutDashboard size={20} />} text="Dashboard" to="/" />
                    <SidebarItem icon={<Users size={20} />} text="Employees" to="/employees" />
                    <SidebarItem icon={<Calendar size={20} />} text="My Attendance" to="/attendance" />
                    <SidebarItem icon={<Clock size={20} />} text="Live Attendance" to="/attendance-monitoring" />
                    <SidebarItem icon={<TrendingUp size={20} />} text="Reports" to="/reports" />
                    <SidebarItem icon={<Calendar size={20} />} text="Holidays" to="/holidays" />
                    <SidebarItem icon={<ClipboardList size={20} />} text="Daily Activity Report" to="/daily-activity" />
                    <SidebarItem icon={<Settings size={20} />} text="Policy Engine" to="/policy-builder" />
                    <SidebarItem icon={<MapPin size={20} />} text="Geo Fencing" to="/geofencing" />
                    <SidebarItem icon={<CreditCard size={20} />} text="Subscription" to="/subscription" />
                </nav>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={logout}
                        className="flex items-center gap-3 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors w-full px-4 py-2 text-sm font-medium">
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden relative w-full">
                {/* Header */}
                <header className="h-16 bg-white dark:bg-dark-bg border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-10 z-10 shadow-sm shrink-0 transition-colors duration-300">
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

                        <Link to="/profile" className="flex items-center gap-3 pl-4 sm:pl-6 border-l border-slate-200 dark:border-slate-700 hover:opacity-80 transition-opacity">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 capitalize">
                                    {useAuth().user?.user_name || 'Admin User'}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                                    {useAuth().user?.user_type || 'Administrator'}
                                </p>
                            </div>
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold border-2 border-white dark:border-slate-700 shadow-sm text-sm sm:text-base cursor-pointer">
                                {useAuth().user?.user_name?.charAt(0).toUpperCase() || 'A'}
                            </div>
                        </Link>
                    </div>
                </header>

                {/* Scrollable Content Area */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50 dark:bg-dark-bg transition-colors duration-300">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
