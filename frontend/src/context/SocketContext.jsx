import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import api, { getAccessToken, setAccessToken } from '../services/api';

const SocketContext = createContext(null);

// In production the frontend is served as static files by Nginx and the backend
// runs on a separate port/process. VITE_BACKEND_URL must point to the backend
// origin (e.g. https://api.attendance.mano.co.in). In local dev, leave it unset
// so Vite's proxy handles /socket.io forwarding automatically.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || undefined;

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if (!user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        // Use a dynamic auth callback so the freshest JWT is always sent on
        // every (re)connect attempt without needing to recreate the socket.
        const newSocket = io(BACKEND_URL, {
            path: '/socket.io/',
            auth: (cb) => {
                const token = getAccessToken();
                cb({
                    token: token ? `Bearer ${token}` : undefined
                });
            },
            // Prefer a direct WebSocket upgrade; fall back to long-polling only
            // if WebSocket is not available (e.g. some corporate proxies).
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 20,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            // Force a new connection rather than reusing a cached one
            forceNew: false,
        });

        newSocket.on('connect', () => {
            console.log('⚡ Socket connected. ID:', newSocket.id, '| Transport:', newSocket.io.engine.transport.name);
        });

        newSocket.io.engine.on('upgrade', (transport) => {
            console.log('🔼 Socket transport upgraded to:', transport.name);
        });

        newSocket.on('disconnect', (reason) => {
            console.warn('🔌 Socket disconnected. Reason:', reason);
        });

        newSocket.on('connect_error', async (error) => {
            console.warn('⚠️ Socket connection error:', error.message);
            
            // If the socket fails to authenticate, try to refresh the access token
            // in-place and reconnect without tearing down the socket instance.
            if (error.message && (
                error.message.toLowerCase().includes('auth') || 
                error.message.toLowerCase().includes('token') || 
                error.message.toLowerCase().includes('signature') || 
                error.message.toLowerCase().includes('expire')
            )) {
                try {
                    const res = await api.post('/auth/refresh');
                    if (res.data?.accessToken) {
                        setAccessToken(res.data.accessToken);
                        console.log('🔄 Socket token refreshed. Retrying connection...');
                        newSocket.connect();
                    }
                } catch (refreshErr) {
                    console.error('❌ Socket auth token refresh failed:', refreshErr);
                }
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [user]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
export default SocketContext;
