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
    X,
    LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MobileSidebar = ({ isOpen, onClose }) => {
    const location = useLocation();
    const { user, logout } = useAuth();

    const menuItems = [
        { icon: <LayoutDashboard size={20} />, text: "Dashboard", to: "/mobile-view" },
        { icon: <Users size={20} />, text: "Employees", to: "/mobile-view/employees" },
        { icon: <Calendar size={20} />, text: "Attendance", to: "/mobile-view/attendance" },
        { icon: <Clock size={20} />, text: "Live Attendance", to: "/mobile-view/attendance-monitoring" }, // Assuming route
        { icon: <Calendar size={20} />, text: "Holidays & Leave", to: "/mobile-view/holidays" },
        { icon: <FileText size={20} />, text: "Reports & Exports", to: "/mobile-view/reports" },
        { icon: <Settings size={20} />, text: "Shift Management", to: "/mobile-view/shifts" },
        { icon: <MapPin size={20} />, text: "Geo-Fencing", to: "/mobile-view/geofencing" },
    ];

    // "My Profile" is special in the screenshot (at bottom or separate)
    // Screenshot shows "My Profile" after Geo-Fencing, before Bugs.
    // Actually it shows "My Profile" with a purple background active state.

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
                className={`fixed top-0 left-0 bottom-0 w-72 bg-white dark:bg-dark-card z-50 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <img src="/mano-logo.svg" alt="MANO" className="w-8 h-8" />
                        <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">MANO</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.to;
                        return (
                            <Link
                                key={item.to}
                                to={item.to}
                                onClick={onClose}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                {item.icon}
                                <span>{item.text}</span>
                            </Link>
                        );
                    })}

                    <Link
                        to="/mobile-view/profile"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all mt-2 ${location.pathname === '/mobile-view/profile'
                            ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <User size={20} />
                        <span>My Profile</span>
                    </Link>
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2 shrink-0">
                    <button
                        className="flex items-center gap-3 px-4 py-3 w-full text-slate-600 dark:text-slate-400 hover:text-indigo-600 text-sm font-medium"
                    >
                        <Bug size={20} />
                        <span>Bugs & Feedback</span>
                    </button>
                    {/* Logout is handled in profile page in screenshots, but good to have here too? Screenshot doesn't show it here. */}
                </div>
            </aside>
        </>
    );
};

export default MobileSidebar;
