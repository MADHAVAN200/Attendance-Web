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
                    className="fixed inset-0 bg-black/60 z-40 transition-opacity backdrop-blur-md"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 bottom-0 w-72 bg-white dark:bg-[#111827] z-50 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col border-r border-slate-100 dark:border-slate-800/50 ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="h-20 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <img src="/mano-logo.svg" alt="MANO" className="w-8 h-8" />
                        <span className="text-xl font-bold text-indigo-600 dark:text-white tracking-tight">MANO</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-2 px-4 space-y-1 custom-scrollbar">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.to || (item.to !== '/mobile-view' && location.pathname.startsWith(item.to));
                        return (
                            <Link
                                key={item.to}
                                to={item.to}
                                onClick={onClose}
                                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all ${isActive
                                    ? 'text-indigo-400 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/20'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-200'
                                    }`}
                            >
                                <div className={`${isActive ? 'text-indigo-500' : 'text-slate-500 dark:text-slate-500'}`}>
                                    {item.icon}
                                </div>
                                <span>{item.text}</span>
                            </Link>
                        );
                    })}

                    <Link
                        to="/mobile-view/profile"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all mt-4 ${location.pathname === '/mobile-view/profile'
                            ? 'text-indigo-400 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/20'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-200'
                            }`}
                    >
                        <div className={`${location.pathname === '/mobile-view/profile' ? 'text-indigo-500' : 'text-slate-500 dark:text-slate-500'}`}>
                            <User size={20} />
                        </div>
                        <span>My Profile</span>
                    </Link>
                </nav>

                {/* Footer */}
                <div className="p-4 shrink-0 mb-4">
                    <Link
                        to="/mobile-view/feedback"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl text-[15px] font-medium transition-colors ${location.pathname === '/mobile-view/feedback'
                            ? 'bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-400 dark:text-indigo-300'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <Bug size={20} className={location.pathname === '/mobile-view/feedback' ? "text-indigo-500" : "text-slate-500"} />
                        <span>Bugs & Feedback</span>
                    </Link>
                </div>
            </aside>
        </>
    );
};

export default MobileSidebar;
