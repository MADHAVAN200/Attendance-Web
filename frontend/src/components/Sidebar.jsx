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
    ClipboardList,
    ClipboardCheck,
    Bug,
    Building,
    ShieldAlert,
    MessageSquare,
    Code
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FeedbackModal from './FeedbackModal';
import { useState } from 'react';

const SidebarItem = ({ icon, text, to }) => {
    const location = useLocation();
    const active = to ? location.pathname === to : false;
    const isActive = active || (to === '/' && location.pathname === '/');

    const content = (
        <>
            <span className={`mr-2.5 transition-colors ${isActive ? 'text-[#0969da] dark:text-github-dark-accent' : 'text-slate-400 dark:text-github-dark-muted group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                {icon}
            </span>
            {text}
        </>
    );

    const className = `flex items-center px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-200 group ${isActive
        ? 'bg-[#f6f8fa] dark:bg-github-dark-border text-[#0969da] dark:text-github-dark-accent shadow-sm border border-transparent dark:border-github-dark-border/50'
        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-github-dark-border/50 hover:text-slate-900 dark:hover:text-github-dark-text'
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
        { icon: <LayoutDashboard size={18} />, text: "Dashboard", to: "/dashboard", roles: ['admin', 'hr', 'employee', 'super_admin'] },
        { icon: <Building size={18} />, text: "Organizations", to: "/organizations", roles: ['super_admin'] },
        { icon: <ShieldAlert size={18} />, text: "Security Alerts", to: "/super-admin/alerts", roles: ['super_admin'] },
        { icon: <MessageSquare size={18} />, text: "User Feedback", to: "/super-admin/feedback", roles: ['super_admin'] },
        { icon: <Code size={18} />, text: "System Logs", to: "/super-admin/logs", roles: ['super_admin'] },
        { icon: <Users size={18} />, text: "Employees", to: "/employees", roles: ['admin', 'hr'] },
        { icon: <Calendar size={18} />, text: "Attendance", to: "/attendance", roles: ['admin', 'hr', 'employee'] },
        { icon: <Clock size={18} />, text: "Live Attendance", to: "/attendance-monitoring", roles: ['admin', 'hr'] },
        { icon: <TrendingUp size={18} />, text: "Reports", to: "/reports", roles: ['admin', 'hr'] },

        { icon: <ClipboardList size={18} />, text: "Daily Activity Report", to: "/daily-activity", roles: ['admin', 'hr', 'employee'] },
        {icon: <MapPin size={18} />, text: "Geo Fencing", to: "/geofencing", roles: ['admin', 'hr'] },
        { icon: <Settings size={18} />, text: "Shift Management", to: "/shift-management", roles: ['admin', 'hr'] },
        { icon: <Calendar size={18} />, text: "Holidays and Leave", to: "/holidays", roles: ['admin', 'hr', 'employee'] },
        // { icon: <CreditCard size={18} />, text: "Subscription", to: "/subscription", roles: ['admin'] },
    ];

    return allItems.filter(item => item.roles.includes(userType));
};

const Sidebar = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
    const { logout, user } = useAuth();
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
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
                fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-github-dark-subtle border-r border-slate-200 dark:border-github-dark-border transform transition-transform duration-300 ease-in-out md:translate-x-0 md:fixed md:top-0 md:h-screen md:flex md:flex-col shadow-xl md:shadow-sm shrink-0
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-github-dark-border">
                    <div className="flex items-center gap-3 font-black text-xl text-[#0969da] dark:text-github-dark-accent tracking-tighter">
                        <img src="/mano-logo.svg" alt="MANO" className="w-8 h-8 object-contain" />
                        <span className="leading-none">MANO</span>
                    </div>
                    <button
                        className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 pt-1.5 pb-4 px-3 space-y-3 overflow-y-auto">
                    {getNavItems(userType).map((item) => (
                        <SidebarItem key={item.to} icon={item.icon} text={item.text} to={item.to} />
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-100 dark:border-github-dark-border space-y-2">
                    <button
                        onClick={() => setIsFeedbackOpen(true)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-github-dark-muted bg-slate-50 dark:bg-github-dark-border/30 hover:bg-slate-100 dark:hover:bg-github-dark-border hover:text-indigo-600 dark:hover:text-github-dark-accent rounded-lg transition-all"
                    >
                        <Bug size={18} />
                        Bugs & Feedback
                    </button>

                    <div className="text-[10px] text-center text-slate-400 dark:text-slate-600 font-mono pt-2">
                        v1.0.0
                    </div>
                </div>
            </aside>

            <FeedbackModal
                isOpen={isFeedbackOpen}
                onClose={() => setIsFeedbackOpen(false)}
            />
        </>
    );
};

export default Sidebar;
