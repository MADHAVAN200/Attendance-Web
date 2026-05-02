import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        
        try {
            // Fetch unread notifications + some history
            const response = await notificationService.getAll(20, false);
            if (response.ok) {
                setNotifications(response.data);
                setUnreadCount(response.unread_count);
            }
        } catch (error) {
            // If 403 Forbidden, it means the user isn't authorized for notifications (e.g., certain admin roles)
            if (error.message.includes("403") || error.message.includes("Forbidden")) {
                console.warn("Notifications are not enabled for this account type.");
            } else {
                console.error("Failed to fetch notifications:", error);
            }
        }
    }, [user]);

    const markAsRead = async (id) => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => 
                n.notification_id === id ? { ...n, is_read: 1 } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));

            await notificationService.markAsRead(id);
        } catch (error) {
            console.error("Failed to mark notification as read", error);
            // Revert on error would be ideal, but simple logging for now
            fetchNotifications(); 
        }
    };

    const markAllAsRead = async () => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
            setUnreadCount(0);

            await notificationService.markAllAsRead();
        } catch (error) {
            console.error("Failed to mark all notifications as read", error);
            fetchNotifications();
        }
    };

    // Initial fetch and polling
    useEffect(() => {
        if (user) {
            fetchNotifications();
            
            // Poll every 30 seconds
            const intervalId = setInterval(fetchNotifications, 30000);
            return () => clearInterval(intervalId);
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [user, fetchNotifications]);

    return (
        <NotificationContext.Provider value={{ 
            notifications, 
            unreadCount, 
            fetchNotifications, 
            markAsRead, 
            markAllAsRead 
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => useContext(NotificationContext);
