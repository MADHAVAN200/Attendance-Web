import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Calendar,
    Clock,
    FileText,
    Settings,
    MapPin,
    User,
    Bug,
    LogOut,
    TrendingUp,
    ClipboardList,
    X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MobileSidebar = ({ isOpen, onClose }) => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const userType = user?.user_type || 'employee';

    // Handle physical back button to close sidebar
    React.useEffect(() => {
        const handlePopState = () => {
            if (isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            window.history.pushState({ sidebarOpen: true }, '');
            window.addEventListener('popstate', handlePopState);
        }

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [isOpen, onClose]);

    const allMenuItems = [
        { icon: <LayoutDashboard size={20} />, text: "Dashboard", to: "/", roles: ['admin', 'hr', 'employee', 'super_admin'] },
        { icon: <Users size={20} />, text: "Employees", to: "/employees", roles: ['admin', 'hr'] },
        { icon: <Calendar size={20} />, text: "Attendance", to: "/attendance", roles: ['admin', 'hr', 'employee'] },
        { icon: <Clock size={20} />, text: "Live Attendance", to: "/attendance-monitoring", roles: ['admin', 'hr'] },
        { icon: <TrendingUp size={20} />, text: "Reports", to: "/reports", roles: ['admin', 'hr'] },
        { icon: <ClipboardList size={20} />, text: "Daily Activity", to: "/daily-activity", roles: ['admin', 'hr', 'employee'] },
        { icon: <MapPin size={20} />, text: "Geo Fencing", to: "/geofencing", roles: ['admin', 'hr'] },
        { icon: <Settings size={20} />, text: "Shift Management", to: "/shift-management", roles: ['admin', 'hr'] },
        { icon: <Calendar size={20} />, text: "Holidays and Leave", to: "/holidays", roles: ['admin', 'hr', 'employee'] },
        { icon: <Bug size={20} />, text: "Bugs & Feedback", to: "/feedback", roles: ['admin', 'hr', 'employee', 'super_admin'] },
    ];

    const menuItems = allMenuItems.filter(item => item.roles.includes(userType));

    const isActive = (to) =>
        location.pathname === to || (to !== '/' && location.pathname.startsWith(to + '/'));

    const linkClass = (to) =>
        `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 group ${isActive(to)
            ? 'bg-indigo-50 dark:bg-github-dark-border text-indigo-600 dark:text-github-dark-accent shadow-sm border border-transparent dark:border-github-dark-border/50'
            : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-github-dark-border/50 hover:text-slate-900 dark:hover:text-github-dark-text'
        }`;

    const iconClass = (to) =>
        `mr-3 transition-colors ${isActive(to)
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-slate-400 dark:text-github-dark-muted group-hover:text-slate-600 dark:group-hover:text-slate-300'
        }`;

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-3/5 bg-white dark:bg-github-dark-subtle border-r border-slate-200 dark:border-github-dark-border transform transition-transform duration-300 ease-in-out flex flex-col shadow-xl ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Header — matches desktop exactly */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 dark:border-github-dark-border shrink-0">
                    <div className="flex items-center gap-3 font-bold text-xl text-indigo-600 dark:text-github-dark-accent">
                        <img src="/mano-logo.svg" alt="MANO" className="w-8 h-8" />
                        <span>MANO</span>
                    </div>
                </div>

                {/* Nav — matches desktop exactly */}
                <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto" style={{paddingBottom: 'env(safe-area-inset-bottom, 16px)'}}>
                    {menuItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            onClick={onClose}
                            className={linkClass(item.to)}
                        >
                            <span className={iconClass(item.to)}>{item.icon}</span>
                            {item.text}
                        </Link>
                    ))}


                </nav>

                {/* Footer — matches desktop exactly */}
                <div className="p-4 border-t border-slate-100 dark:border-github-dark-border space-y-2 shrink-0" style={{paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)'}}>
                    <div className="text-[10px] text-center text-slate-400 dark:text-slate-600 font-mono pt-2">
                        v1.0.0
                    </div>
                </div>
            </aside>
        </>
    );
};

export default MobileSidebar;
