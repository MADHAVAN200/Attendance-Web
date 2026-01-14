import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Settings,
    LogOut,
    TrendingUp,
    Calendar,
    X,
    Clock,
    MapPin,
    CreditCard,
    FileText,
    ClipboardList
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

const getNavItems = (userType) => {
    const allItems = [
        { icon: <LayoutDashboard size={20} />, text: "Dashboard", to: "/", roles: ['admin', 'hr', 'employee'] },
        { icon: <Users size={20} />, text: "Employees", to: "/employees", roles: ['admin', 'hr'] },
        { icon: <Calendar size={20} />, text: "My Attendance", to: "/attendance", roles: ['admin', 'hr', 'employee'] },
        { icon: <Clock size={20} />, text: "Live Attendance", to: "/attendance-monitoring", roles: ['admin', 'hr'] },
        { icon: <TrendingUp size={20} />, text: "Reports", to: "/reports", roles: ['admin', 'hr'] },
        { icon: <Calendar size={20} />, text: "Holidays", to: "/holidays", roles: ['admin', 'hr', 'employee'] },
        { icon: <ClipboardList size={20} />, text: "Daily Activity Report", to: "/daily-activity", roles: ['admin', 'hr', 'employee'] },
        { icon: <Settings size={20} />, text: "Policy Engine", to: "/policy-builder", roles: ['admin', 'hr'] },
        { icon: <MapPin size={20} />, text: "Geo Fencing", to: "/geofencing", roles: ['admin', 'hr'] },
        { icon: <CreditCard size={20} />, text: "Subscription", to: "/subscription", roles: ['admin'] },
        { icon: <Users size={20} />, text: "My Profile", to: "/profile", roles: ['admin', 'hr', 'employee'] },
    ];

    return allItems.filter(item => item.roles.includes(userType));
};

const Sidebar = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
    const { logout, user } = useAuth();
    // Default to 'employee' if user_type is not available yet
    const userType = user?.user_type || 'employee';

    return (
        <>
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

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
                    {getNavItems(userType).map((item) => (
                        <SidebarItem key={item.to} icon={item.icon} text={item.text} to={item.to} />
                    ))}
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
        </>
    );
};

export default Sidebar;
