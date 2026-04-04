import React, { useRef, useEffect } from 'react';
import { Bell, Check, Clock, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

const NotificationDropdown = ({ isOpen, onClose }) => {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
    const dropdownRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const getIcon = (type) => {
        switch (type) {
            case 'WARNING': return <AlertTriangle size={16} className="text-amber-500" />;
            case 'SUCCESS': return <CheckCircle size={16} className="text-emerald-500" />;
            case 'ERROR': return <XCircle size={16} className="text-red-500" />;
            case 'INFO':
            default: return <Info size={16} className="text-blue-500" />;
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div 
            ref={dropdownRef}
            className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-dark-card rounded-xl shadow-lg border border-slate-100 dark:border-github-dark-border overflow-hidden z-50 transform origin-top-right transition-all animate-in fade-in slide-in-from-top-2"
        >
            <div className="p-4 border-b border-slate-100 dark:border-github-dark-border flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 dark:text-github-dark-text">Notifications</h3>
                {unreadCount > 0 && (
                    <button 
                        onClick={markAllAsRead}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
                    >
                        <Check size={14} />
                        Mark all read
                    </button>
                )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 dark:text-github-dark-muted">
                        <Bell className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">No notifications yet</p>
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <div 
                            key={notification.notification_id}
                            className={`p-4 border-b border-slate-50 dark:border-github-dark-border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer relative group ${notification.is_read ? 'opacity-70' : 'bg-indigo-50/10'}`}
                            onClick={() => !notification.is_read && markAsRead(notification.notification_id)}
                        >
                            <div className="flex gap-3">
                                <div className={`mt-1 p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0 ${
                                    notification.type === 'WARNING' ? 'bg-amber-100 dark:bg-amber-900/20' :
                                    notification.type === 'SUCCESS' ? 'bg-emerald-100 dark:bg-emerald-900/20' :
                                    notification.type === 'ERROR' ? 'bg-red-100 dark:bg-red-900/20' :
                                    'bg-blue-100 dark:bg-blue-900/20'
                                }`}>
                                    {getIcon(notification.type)}
                                {notification.is_read === 0 && (
                                    <span className="absolute top-4 right-4 h-2 w-2 bg-indigo-500 rounded-full"></span>
                                )}
                                </div>
                                <div className="flex-1">
                                    <p className={`text-sm ${notification.is_read ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-semibold text-slate-900 dark:text-github-dark-text'}`}>
                                        {notification.title}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-1 line-clamp-2">
                                        {notification.message}
                                    </p>
                                    <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400">
                                        <Clock size={10} />
                                        <span>{formatTime(notification.created_at)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            {notifications.length > 0 && (
                 <div className="p-2 border-t border-slate-100 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/30 text-center">
                    <button className="text-xs text-slate-500 hover:text-indigo-600 font-medium">
                        View earlier notifications
                    </button>
                 </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
