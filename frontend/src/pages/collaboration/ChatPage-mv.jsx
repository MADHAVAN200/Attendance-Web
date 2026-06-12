import React, { useState, useEffect, useRef, useCallback } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { 
    Send, Plus, Search, MessageSquare, Users, Hash, 
    Smile, CheckCheck, 
    ArrowLeft, UserPlus, X, Volume2, Info, Lock,
    Paperclip, FileText, Download, File, Clock, Calendar, MapPin, Pin, ChevronDown, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const formatLastMessagePreview = (messageText) => {
    if (!messageText) return "";
    if (messageText.startsWith("[SYSTEM_CARD:")) {
        const endHeaderIndex = messageText.indexOf("]");
        if (endHeaderIndex !== -1) {
            const header = messageText.substring(13, endHeaderIndex);
            const parts = header.split(":");
            const cardType = parts[0] || "";
            const cardStatus = parts[2] || "";
            
            const body = messageText.substring(endHeaderIndex + 1).trim();
            let payload = null;
            try {
                payload = JSON.parse(body);
            } catch (e) {}

            if (cardType === 'leave_request') {
                if (payload) {
                    const name = payload.employee_name || payload.reviewer_name || "Employee";
                    return `Leave: ${payload.leave_type} (${cardStatus}) - ${name}`;
                }
                return `Leave Request (${cardStatus})`;
            } else if (cardType === 'correction_request') {
                if (payload) {
                    const name = payload.employee_name || payload.reviewer_name || "Employee";
                    return `Correction: ${payload.correction_type} (${cardStatus}) - ${name}`;
                }
                return `Correction Request (${cardStatus})`;
            } else if (cardType === 'group_update') {
                return body;
            }
        }
    }
    return messageText;
};

const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDatePretty = (dateStr) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
};

const formatTimePretty = (timeStr) => {
    if (!timeStr) return '';
    try {
        const date = new Date(timeStr);
        if (isNaN(date.getTime())) return timeStr;
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch (e) {
        return timeStr;
    }
};

// Programmatic premium soft dual-tone chime beep
const playNotificationChime = () => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5 Chime up
        
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
        console.warn("AudioContext failed:", e);
    }
};

const renderParsedMessageContent = (text, isSelf) => {
    if (!text) return null;

    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const mentionRegex = /(@[a-zA-Z0-9._-]+)/g;

    const urlParts = text.split(urlRegex);
    return urlParts.map((urlPart, urlIdx) => {
        if (urlPart.match(urlRegex)) {
            const href = urlPart.startsWith('http') ? urlPart : `https://${urlPart}`;
            return (
                <a
                    key={`url-${urlIdx}`}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`underline break-all font-bold ${
                        isSelf 
                        ? 'text-indigo-100 hover:text-white underline' 
                        : 'text-indigo-600 dark:text-indigo-400 hover:underline'
                    }`}
                >
                    {urlPart}
                </a>
            );
        }

        const mentionParts = urlPart.split(mentionRegex);
        return mentionParts.map((part, mentIdx) => {
            if (part.match(mentionRegex)) {
                return (
                    <span 
                        key={`mention-${urlIdx}-${mentIdx}`} 
                        className={`px-1.5 py-0.5 rounded font-bold ${
                            isSelf 
                            ? 'bg-indigo-700 text-white' 
                            : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100/10'
                        }`}
                    >
                        {part}
                    </span>
                );
            }
            return part;
        });
    });
};

const getUserColor = (userId) => {
    const colors = [
        { text: 'text-rose-600 dark:text-rose-450 font-black', bg: 'bg-rose-50/50 dark:bg-rose-950/15 border-rose-200/60 dark:border-rose-900/20' },
        { text: 'text-emerald-600 dark:text-emerald-450 font-black', bg: 'bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-200/60 dark:border-emerald-900/20' },
        { text: 'text-sky-600 dark:text-sky-450 font-black', bg: 'bg-sky-50/50 dark:bg-sky-950/15 border-sky-200/60 dark:border-sky-900/30' },
        { text: 'text-amber-700 dark:text-amber-450 font-black', bg: 'bg-amber-50/50 dark:bg-amber-950/15 border-amber-200/60 dark:border-amber-900/30' },
        { text: 'text-violet-650 dark:text-violet-450 font-black', bg: 'bg-violet-50/50 dark:bg-violet-950/15 border-violet-200/60 dark:border-violet-900/30' },
        { text: 'text-teal-650 dark:text-teal-450 font-black', bg: 'bg-teal-50/50 dark:bg-teal-950/15 border-teal-200/60 dark:border-teal-900/30' },
        { text: 'text-fuchsia-650 dark:text-fuchsia-450 font-black', bg: 'bg-fuchsia-50/50 dark:bg-fuchsia-950/15 border-fuchsia-200/60 dark:border-fuchsia-900/30' },
        { text: 'text-orange-650 dark:text-orange-450 font-black', bg: 'bg-orange-50/50 dark:bg-orange-950/15 border-orange-200/60 dark:border-orange-900/30' }
    ];
    const id = Number(userId) || 0;
    return colors[id % colors.length];
};

const MobileChatPage = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const navigate = useNavigate();
    const currentUserId = user?.user_id ?? user?.id;

    // Pinned rooms state & handlers
    const [pinnedRoomIds, setPinnedRoomIds] = useState([]);

    useEffect(() => {
        if (currentUserId) {
            try {
                const stored = localStorage.getItem(`pinnedRoomIds_${currentUserId}`);
                setPinnedRoomIds(stored ? JSON.parse(stored) : []);
            } catch (e) {
                setPinnedRoomIds([]);
            }
        }
    }, [currentUserId]);

    const togglePinRoom = (e, roomId) => {
        e.stopPropagation();
        setPinnedRoomIds(prev => {
            const isPinned = prev.includes(roomId);
            const next = isPinned ? prev.filter(id => id !== roomId) : [...prev, roomId];
            if (currentUserId) {
                localStorage.setItem(`pinnedRoomIds_${currentUserId}`, JSON.stringify(next));
            }
            return next;
        });
    };

    // Active states
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessageText, setNewMessageText] = useState('');
    const [coworkers, setCoworkers] = useState([]);
    
    // UI Filters / Triggers
    const [sidebarTab, setSidebarTab] = useState('all'); // 'all' | 'direct' | 'group'
    const [searchQuery, setSearchQuery] = useState('');
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showDmModal, setShowDmModal] = useState(false);
    
    // Group Form State
    const [groupName, setGroupName] = useState('');
    const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
    const [dmSearchQuery, setDmSearchQuery] = useState('');
    const [groupSearchQuery, setGroupSearchQuery] = useState('');

    // Typing Indicators State
    const [typingUsers, setTypingUsers] = useState({});
    const isTypingRef = useRef(false);
    const typingTimeoutRef = useRef(null);

    // Scroll Control
    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);

    // Mention Dropdown State
    const [activeMention, setActiveMention] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');
    const chatInputRef = useRef(null);

    // Attachment Uploads State
    const [pendingAttachment, setPendingAttachment] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Layout States
    const [showMobileChatWindow, setShowMobileChatWindow] = useState(false);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Group Details Management States & Handlers
    const [showGroupDetailsModal, setShowGroupDetailsModal] = useState(false);
    const [groupDetailsSearchQuery, setGroupDetailsSearchQuery] = useState('');

    const handleRemoveMember = async (userIdToRemove) => {
        if (!selectedRoom) return;
        const currentMemberIds = selectedRoom.members?.map(m => Number(m.user_id)) || [];
        const updatedMemberIds = currentMemberIds.filter(id => id !== Number(userIdToRemove));
        
        try {
            const res = await api.put(`/collaboration/rooms/${selectedRoom.room_id}/members`, {
                member_ids: updatedMemberIds
            });
            if (res.data.success) {
                toast.success("Member removed");
                setSelectedRoom(prev => ({
                    ...prev,
                    member_ids: res.data.data.member_ids,
                    members: res.data.data.members
                }));
                fetchRooms(false);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to remove member");
        }
    };

    const handleAddMember = async (userIdToAdd) => {
        if (!selectedRoom) return;
        const currentMemberIds = selectedRoom.members?.map(m => Number(m.user_id)) || [];
        const updatedMemberIds = [...currentMemberIds, Number(userIdToAdd)];
        
        try {
            const res = await api.put(`/collaboration/rooms/${selectedRoom.room_id}/members`, {
                member_ids: updatedMemberIds
            });
            if (res.data.success) {
                toast.success("Member added");
                setSelectedRoom(prev => ({
                    ...prev,
                    member_ids: res.data.data.member_ids,
                    members: res.data.data.members
                }));
                fetchRooms(false);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to add member");
        }
    };

    // Load initial data
    useEffect(() => {
        fetchRooms();
        fetchCoworkers();
    }, []);

    // Set up Socket listeners
    useEffect(() => {
        if (!socket) return;

        const handleIncomingMessage = (message) => {
            if (selectedRoom && Number(selectedRoom.room_id) === Number(message.room_id)) {
                setMessages(prev => {
                    const matchIndex = prev.findIndex(m => 
                        (m.message_id === message.message_id) || 
                        (m.status === 'sending' && 
                         Number(m.sender_id) === Number(message.sender_id) && 
                         m.message_text === message.message_text)
                    );

                    if (matchIndex !== -1) {
                        const updated = [...prev];
                        updated[matchIndex] = { ...message, status: 'sent' };
                        return updated;
                    }

                    if (prev.some(m => m.message_id === message.message_id)) return prev;
                    return [...prev, message];
                });
                markRoomAsRead(message.room_id);
            } else {
                // Play notification alert for other rooms
                playNotificationChime();
            }
            
            fetchRooms(false);
        };

        const handleUserTyping = ({ roomId, userId, username }) => {
            if (Number(userId) === Number(currentUserId)) return;
            setTypingUsers(prev => ({
                ...prev,
                [roomId]: {
                    ...(prev[roomId] || {}),
                    [userId]: username
                }
            }));
        };

        const handleUserStopTyping = ({ roomId, userId }) => {
            setTypingUsers(prev => {
                const nextTyping = { ...(prev[roomId] || {}) };
                delete nextTyping[userId];
                return {
                    ...prev,
                    [roomId]: nextTyping
                };
            });
        };

        socket.on('message_received', handleIncomingMessage);
        socket.on('user_typing', handleUserTyping);
        socket.on('user_stop_typing', handleUserStopTyping);

        const handleGroupUpdated = ({ room_id, member_ids, members }) => {
            if (selectedRoom && Number(selectedRoom.room_id) === Number(room_id)) {
                if (!member_ids.map(Number).includes(Number(currentUserId))) {
                    toast.info("You have been removed from this group.");
                    setSelectedRoom(prev => ({
                        ...prev,
                        is_removed: true,
                        member_ids,
                        members
                    }));
                } else {
                    setSelectedRoom(prev => ({
                        ...prev,
                        is_removed: false,
                        member_ids,
                        members
                    }));
                }
            }
            fetchRooms(false);
        };

        const handleRoomCreated = (room) => {
            fetchRooms(false);
        };

        const handleRoomDeleted = ({ room_id }) => {
            if (selectedRoom && Number(selectedRoom.room_id) === Number(room_id)) {
                toast.info("This chat conversation has been deleted.");
                setSelectedRoom(null);
                setShowMobileChatWindow(false);
            }
            fetchRooms(false);
        };

        socket.on('group_updated', handleGroupUpdated);
        socket.on('room_created', handleRoomCreated);
        socket.on('room_deleted', handleRoomDeleted);

        const handleConnect = () => {
            if (selectedRoom) {
                console.log(`🔌 Mobile Socket (re)connected. Re-joining room: ${selectedRoom.room_id}`);
                socket.emit('join_room', selectedRoom.room_id);
            }
        };

        socket.on('connect', handleConnect);

        // If a room is selected and socket is already connected, join it immediately
        if (selectedRoom) {
            if (socket.connected) {
                socket.emit('join_room', selectedRoom.room_id);
            }
        }

        return () => {
            socket.off('message_received', handleIncomingMessage);
            socket.off('user_typing', handleUserTyping);
            socket.off('user_stop_typing', handleUserStopTyping);
            socket.off('group_updated', handleGroupUpdated);
            socket.off('room_created', handleRoomCreated);
            socket.off('room_deleted', handleRoomDeleted);
            socket.off('connect', handleConnect);
            if (selectedRoom) {
                socket.emit('leave_room', selectedRoom.room_id);
            }
        };
    }, [socket, selectedRoom, currentUserId]);

    // Auto Scroll thread
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typingUsers]);

    const handleScroll = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const isUp = el.scrollHeight - el.scrollTop - el.clientHeight > 250;
        setShowScrollBottom(isUp);
    };

    const fetchRooms = async (showLoading = true) => {
        const shouldShow = showLoading && rooms.length === 0;
        if (shouldShow) setLoadingRooms(true);
        try {
            const res = await api.get('/collaboration/rooms');
            if (res.data.success) {
                const filtered = res.data.data.filter(room => {
                    const name = room.room_name?.toLowerCase() || '';
                    return !(name.includes('bot') || name.includes('assistant') || name.includes('ai'));
                });
                
                const mapped = filtered.map(room => {
                    if (selectedRoom && Number(room.room_id) === Number(selectedRoom.room_id)) {
                        return { ...room, unread_count: 0 };
                    }
                    return room;
                });
                setRooms(mapped);
                
                if (selectedRoom) {
                    const updatedSelected = mapped.find(r => r.room_id === selectedRoom.room_id);
                    if (updatedSelected) setSelectedRoom(updatedSelected);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (showLoading) setLoadingRooms(false);
        }
    };

    const fetchCoworkers = async () => {
        try {
            const res = await api.get('/collaboration/users');
            if (res.data.success) {
                const filtered = res.data.data.filter(u => {
                    const name = u.user_name?.toLowerCase() || '';
                    return !(name.includes('bot') || name.includes('assistant') || name.includes('ai'));
                });
                setCoworkers(filtered);
            }
        } catch (err) {}
    };

    const fetchMessages = async (roomId) => {
        setLoadingMessages(true);
        try {
            const res = await api.get(`/collaboration/rooms/${roomId}/messages`);
            if (res.data.success) {
                setMessages(res.data.data);
            }
        } catch (err) {
            toast.error("Failed to load message history.");
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleRoomSelect = (room) => {
        if (socket && selectedRoom) {
            socket.emit('leave_room', selectedRoom.room_id);
        }
        setSelectedRoom(room);
        fetchMessages(room.room_id);
        markRoomAsRead(room.room_id);
        setShowMobileChatWindow(true);
        setNewMessageText('');
    };

    const markRoomAsRead = async (roomId) => {
        try {
            await api.put(`/collaboration/rooms/${roomId}/read`);
            setRooms(prev => prev.map(r => 
                r.room_id === roomId ? { ...r, unread_count: 0 } : r
            ));
        } catch (err) {}
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const LIMIT_50_MB = 50 * 1024 * 1024;
        if (file.size > LIMIT_50_MB) {
            toast.error("File size exceeds the 50 MB limit.");
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post(`/collaboration/rooms/${selectedRoom.room_id}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data.success) {
                setPendingAttachment(res.data.file);
                toast.success("Attachment uploaded successfully!");
            }
        } catch (err) {
            console.error("Attachment upload error:", err);
            toast.error(err.response?.data?.message || "Failed to upload attachment to S3.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleInputChange = (val) => {
        setNewMessageText(val);
        startTypingIndicator();

        // Mention autocomplete activation logic
        const lastAtIndex = val.lastIndexOf('@');
        if (lastAtIndex !== -1 && (lastAtIndex === 0 || val[lastAtIndex - 1] === ' ')) {
            const search = val.substring(lastAtIndex + 1);
            if (search.length < 20 && !search.includes(' ')) {
                setActiveMention(true);
                setMentionSearch(search);
                return;
            }
        }
        setActiveMention(false);
    };

    const handleMentionSelect = (colleague) => {
        const val = newMessageText;
        const lastAtIndex = val.lastIndexOf('@');
        const prefix = val.substring(0, lastAtIndex);
        setNewMessageText(`${prefix}@${colleague.user_name} `);
        setActiveMention(false);
        chatInputRef.current?.focus();
    };

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if ((!newMessageText.trim() && !pendingAttachment) || !selectedRoom) return;

        const textToSend = newMessageText;
        const attachmentToSend = pendingAttachment;

        setNewMessageText('');
        setPendingAttachment(null);
        setActiveMention(false);
        stopTypingIndicator();

        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticMsg = {
            message_id: optimisticId,
            room_id: Number(selectedRoom.room_id),
            sender_id: Number(currentUserId),
            message_text: textToSend,
            attachment: attachmentToSend,
            created_at: new Date().toISOString(),
            user_name: user?.user_name || 'You',
            profile_image_url: user?.profile_image_url || null,
            status: 'sending'
        };

        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const res = await api.post(`/collaboration/rooms/${selectedRoom.room_id}/messages`, {
                message_text: textToSend,
                attachment: attachmentToSend
            });
            
            if (res.data.success) {
                const confirmedMsg = res.data.data;
                setMessages(prev => prev.map(m => 
                    m.message_id === optimisticId ? { ...confirmedMsg, status: 'sent' } : m
                ));
            }
        } catch (err) {
            console.error("Optimistic send error:", err);
            setMessages(prev => prev.map(m => 
                m.message_id === optimisticId ? { ...m, status: 'failed' } : m
            ));
            toast.error("Message delivery failed.");
        }
    };

    const startTypingIndicator = () => {
        if (!socket || !selectedRoom) return;
        
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            socket.emit('typing', { roomId: selectedRoom.room_id, username: user?.user_name });
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(stopTypingIndicator, 3000);
    };

    const stopTypingIndicator = () => {
        if (!socket || !selectedRoom || !isTypingRef.current) return;
        isTypingRef.current = false;
        socket.emit('stop_typing', { roomId: selectedRoom.room_id });
    };

    const initiateDM = async (otherUser) => {
        try {
            const res = await api.post('/collaboration/rooms', {
                room_type: 'direct',
                member_ids: [otherUser.user_id]
            });
            if (res.data.success) {
                await fetchRooms();
                setShowDmModal(false);
                const targetRoom = res.data.data;
                const formattedRoom = {
                    ...targetRoom,
                    room_name: otherUser.user_name,
                    avatar_url: otherUser.profile_image_url,
                    unread_count: 0
                };
                handleRoomSelect(formattedRoom);
            }
        } catch (err) {
            toast.error("Could not start chat conversation.");
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) return toast.error("Please enter a group name");
        if (selectedGroupMembers.length === 0) return toast.error("Please select at least one member");

        try {
            const res = await api.post('/collaboration/rooms', {
                room_type: 'group',
                room_name: groupName,
                member_ids: selectedGroupMembers
            });
            if (res.data.success) {
                toast.success("Group created!");
                setGroupName('');
                setSelectedGroupMembers([]);
                setShowGroupModal(false);
                fetchRooms();
                handleRoomSelect(res.data.data);
            }
        } catch (err) {
            toast.error("Could not create collaboration group.");
        }
    };

    const toggleMemberSelection = (userId) => {
        setSelectedGroupMembers(prev => 
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    // Filter conversations based on sidebarTab and searchQuery, and sort pinned rooms to the top
    const filteredRooms = rooms
        .filter(room => {
            const matchesTab = 
                sidebarTab === 'all' || 
                (sidebarTab === 'direct' && room.room_type === 'direct') ||
                (sidebarTab === 'group' && room.room_type === 'group');

            const matchesSearch = 
                room.room_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                room.last_message?.text?.toLowerCase().includes(searchQuery.toLowerCase());

            return matchesTab && matchesSearch;
        })
        .sort((a, b) => {
            const aPinned = pinnedRoomIds.includes(a.room_id);
            const bPinned = pinnedRoomIds.includes(b.room_id);
            
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            
            const timeA = a.last_message ? new Date(a.last_message.created_at) : new Date(a.created_at);
            const timeB = b.last_message ? new Date(b.last_message.created_at) : new Date(b.created_at);
            return timeB - timeA;
        });

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    const formatLocalTime = (createdAt) => {
        if (!createdAt) return '';
        try {
            let date;
            if (typeof createdAt === 'string') {
                if (!createdAt.includes('Z') && !createdAt.includes('+') && !createdAt.includes('T')) {
                    const normalized = createdAt.trim().replace(' ', 'T');
                    date = new Date(normalized + 'Z');
                } else if (!createdAt.includes('Z') && !createdAt.includes('+') && createdAt.includes('T')) {
                    date = new Date(createdAt + 'Z');
                } else {
                    date = new Date(createdAt);
                }
            } else {
                date = new Date(createdAt);
            }
            
            if (isNaN(date.getTime())) return '';
            
            return date.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
            });
        } catch (e) {
            return '';
        }
    };

    return (
        <MobileDashboardLayout title="Chat & Collaboration" hideHeader={true}>
            <div className="bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-3xl overflow-hidden h-[calc(100vh-140px)] relative flex">
                
                {/* 1. Sidebar contacts list */}
                <div className={`w-full flex-col h-full ${showMobileChatWindow ? 'hidden' : 'flex bg-white dark:bg-github-dark-subtle'}`}>
                    <div className="p-4 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between shrink-0">
                        <h2 className="text-xl font-black text-slate-800 dark:text-github-dark-text tracking-tight">Chats</h2>
                        <div className="flex gap-2">
                            <button onClick={() => setShowDmModal(true)} className="p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/50 dark:border-white/5 text-slate-600 dark:text-slate-300">
                                <Plus size={16} />
                            </button>
                            <button onClick={() => setShowGroupModal(true)} className="p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/50 dark:border-white/5 text-slate-600 dark:text-slate-300">
                                <Users size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Search chats */}
                    <div className="p-3">
                        <div className="relative">
                            <input 
                                type="text"
                                placeholder="Search chats..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 text-xs bg-slate-50 dark:bg-github-dark-bg rounded-2xl border border-slate-200/60 dark:border-github-dark-border focus:outline-none text-slate-800 dark:text-github-dark-text font-bold"
                            />
                            <Search size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="px-3 pb-3 flex border-b border-slate-100 dark:border-github-dark-border/40 gap-2 shrink-0">
                        {['all', 'direct', 'group'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setSidebarTab(tab)}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                                    sidebarTab === tab 
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                                    : 'bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Room list scroll */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-github-dark-border/40 no-scrollbar">
                        {loadingRooms ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                                <span className="text-xs text-slate-400">Loading chats...</span>
                            </div>
                        ) : filteredRooms.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center py-20">
                                <MessageSquare size={32} className="text-slate-300 dark:text-slate-700 mb-2" />
                                <h4 className="text-sm font-bold text-slate-500">No Chats</h4>
                                <p className="text-xs text-slate-400 mt-1">Tap + to start a DM or create a group room.</p>
                            </div>
                        ) : (
                            filteredRooms.map((room) => {
                                const isSelected = selectedRoom?.room_id === room.room_id;
                                const isGroup = room.room_type === 'group';
                                const typingNames = Object.values(typingUsers[room.room_id] || {});

                                return (
                                    <button
                                        key={room.room_id}
                                        onClick={() => handleRoomSelect(room)}
                                        className="w-full text-left p-4 flex items-center gap-3 active:bg-slate-50 dark:active:bg-white/5 bg-transparent border-none outline-none group"
                                    >
                                        <div className="relative shrink-0">
                                            {isGroup ? (
                                                <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-100 dark:border-indigo-500/10">
                                                    <Users size={18} />
                                                </div>
                                            ) : room.avatar_url ? (
                                                <img src={room.avatar_url} alt={room.room_name} className="w-11 h-11 rounded-2xl object-cover border border-slate-100 dark:border-white/5" />
                                            ) : (
                                                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white flex items-center justify-center font-bold text-sm border border-slate-200 dark:border-github-dark-border">
                                                    {getInitials(room.room_name)}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="text-sm font-black text-slate-800 dark:text-white truncate">{room.room_name}</h4>
                                                {room.last_message && (
                                                    <span className="text-[9px] text-slate-400 font-bold shrink-0">
                                                        {formatLocalTime(room.last_message.created_at)}
                                                    </span>
                                                )}
                                            </div>

                                            {typingNames.length > 0 ? (
                                                <span className="text-[10px] text-indigo-500 font-bold animate-pulse truncate block">typing...</span>
                                            ) : room.last_message ? (
                                                <p className="text-xs truncate block text-slate-500 dark:text-slate-400">
                                                    {room.last_message.sender_id === currentUserId ? 'You: ' : ''}
                                                    {formatLastMessagePreview(room.last_message.text)}
                                                </p>
                                            ) : (
                                                <p className="text-xs italic text-slate-400 truncate block">No messages yet</p>
                                            )}
                                        </div>

                                        {/* Pin & Unread Row */}
                                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                            {room.unread_count > 0 && !(selectedRoom?.room_id === room.room_id && showMobileChatWindow) && (
                                                <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold shadow-md shadow-indigo-600/10">
                                                    {room.unread_count}
                                                </span>
                                            )}
                                            
                                            <button
                                                type="button"
                                                onClick={(e) => togglePinRoom(e, room.room_id)}
                                                className={`p-1.5 active:scale-95 transition-all rounded-xl border-none bg-transparent flex items-center justify-center ${
                                                    pinnedRoomIds.includes(room.room_id) 
                                                    ? 'text-indigo-600 dark:text-indigo-400 opacity-100 bg-indigo-50 dark:bg-indigo-500/10' 
                                                    : 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-white/5'
                                                }`}
                                                title={pinnedRoomIds.includes(room.room_id) ? "Unpin Chat" : "Pin Chat"}
                                            >
                                                <Pin size={13} className={pinnedRoomIds.includes(room.room_id) ? "fill-current" : ""} />
                                            </button>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 2. Main Active Chat Conversation Panel */}
                <div className={`w-full flex-col h-full bg-white dark:bg-github-dark-subtle ${showMobileChatWindow ? 'flex' : 'hidden'}`}>
                    {selectedRoom ? (
                        <>
                            {/* Chat Header */}
                            <div className="h-16 px-4 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-bg/30 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <button onClick={() => setShowMobileChatWindow(false)} className="p-2 text-slate-500 bg-slate-100/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 rounded-xl active:scale-90 transition-all">
                                        <ArrowLeft size={16} />
                                    </button>
                                    
                                    <div className="relative shrink-0">
                                        {selectedRoom.room_type === 'group' ? (
                                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-100/10">
                                                <Users size={16} />
                                            </div>
                                        ) : selectedRoom.avatar_url ? (
                                            <img src={selectedRoom.avatar_url} alt={selectedRoom.room_name} className="w-9 h-9 rounded-xl object-cover" />
                                        ) : (
                                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white flex items-center justify-center font-bold text-sm border border-slate-200 dark:border-github-dark-border">
                                                {getInitials(selectedRoom.room_name)}
                                            </div>
                                        )}
                                    </div>

                                    <div className="truncate">
                                        <h3 className="text-xs font-black text-slate-800 dark:text-white truncate uppercase tracking-wider">{selectedRoom.room_name}</h3>
                                        {Object.values(typingUsers[selectedRoom.room_id] || {}).length > 0 ? (
                                            <span className="text-[9px] text-indigo-500 font-bold animate-pulse">typing...</span>
                                        ) : selectedRoom.room_type === 'group' ? (
                                            <span className="text-[9px] text-slate-400 font-bold">{selectedRoom.members?.length || 0} members</span>
                                        ) : (
                                            <span className="text-[9px] text-emerald-500 font-bold flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {selectedRoom.room_type === 'group' && !selectedRoom.is_removed && (
                                    <button 
                                        onClick={() => {
                                            setGroupDetailsSearchQuery('');
                                            setShowGroupDetailsModal(true);
                                        }}
                                        className="p-2 text-slate-500 bg-slate-100/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 rounded-xl active:scale-90 transition-all flex items-center justify-center animate-in fade-in"
                                        title="Group Info"
                                    >
                                        <Info size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Messages Scroll Area */}
                            <div 
                                ref={scrollContainerRef}
                                onScroll={handleScroll}
                                className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/50 dark:bg-github-dark-bg/10 relative"
                            >
                                {loadingMessages ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                                        <span className="text-xs text-slate-400">Loading messages...</span>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                                            <MessageSquare size={20} />
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-700 dark:text-white">No Messages</h4>
                                        <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Send a greeting message to start chatting.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-center mb-3">
                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50/50 dark:bg-white/5 border border-indigo-100/30 dark:border-white/5 rounded-xl text-[9px] text-slate-500 dark:text-slate-400 font-semibold shadow-sm">
                                                <Lock size={10} className="text-indigo-500" />
                                                <span>End-to-End Encrypted Platform</span>
                                            </div>
                                        </div>

                                        {(() => {
                                            return messages.map((msg, idx) => {
                                                const isSelf = Number(msg.sender_id) === Number(currentUserId);
                                                const hasAvatar = msg.profile_image_url;
                                                
                                                const matchesMention = msg.message_text && msg.message_text.includes(`@${user?.user_name}`);
                                                const isSystemCard = msg.message_text && msg.message_text.startsWith("[SYSTEM_CARD:");
                                                let cardType = "";
                                                let cardEntityId = "";
                                                let cardStatus = "";
                                                let cardPayload = null;
                                                let cardTextTitle = "";
                                                let cardTextDesc = "";

                                                if (isSystemCard) {
                                                    const endHeaderIndex = msg.message_text.indexOf("]");
                                                    if (endHeaderIndex !== -1) {
                                                        const header = msg.message_text.substring(13, endHeaderIndex);
                                                        const parts = header.split(":");
                                                        cardType = parts[0] || "";
                                                        cardEntityId = parts[1] || "";
                                                        cardStatus = parts[2] || "";
                                                        
                                                        const body = msg.message_text.substring(endHeaderIndex + 1).trim();
                                                        try {
                                                            cardPayload = JSON.parse(body);
                                                        } catch (e) {
                                                            const bodyLines = body.split("\n");
                                                            cardTextTitle = bodyLines[0] || "";
                                                            if (bodyLines.length > 1) {
                                                                cardTextDesc = bodyLines.slice(1).join("\n").replace(/^"|"$/g, "").trim();
                                                            }
                                                        }
                                                    }
                                                }

                                                if (Number(msg.sender_id) === 0 || cardType === 'group_update') {
                                                    let cleanText = msg.message_text;
                                                    if (cleanText.startsWith("[SYSTEM_CARD:group_update:info]")) {
                                                        cleanText = cleanText.substring(31).trim();
                                                    } else if (cleanText.startsWith("[SYSTEM_CARD:group_update:alert]")) {
                                                        cleanText = cleanText.substring(32).trim();
                                                    } else if (cleanText.startsWith("[SYSTEM_CARD:")) {
                                                        const closeBracketIdx = cleanText.indexOf("]");
                                                        if (closeBracketIdx !== -1) {
                                                            cleanText = cleanText.substring(closeBracketIdx + 1).trim();
                                                        }
                                                    }
                                                    return (
                                                        <div key={msg.message_id || idx} className="flex justify-center w-full my-2.5">
                                                            <span className="bg-[#f0f3f6] dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-slate-500 dark:text-slate-400 px-4 py-1.5 rounded-full text-[10px] font-bold shadow-sm max-w-[85%] text-center">
                                                                {cleanText}
                                                            </span>
                                                        </div>
                                                    );
                                                }

                                                const uColor = getUserColor(msg.sender_id);
                                                const isMentionPreview = msg.message_text && msg.message_text.includes("Mentioned you in my Daily Activity");
                                                let previewType = "";
                                                let previewTitle = "Untitled Entry";
                                                let previewDesc = "";

                                                if (isMentionPreview) {
                                                    previewType = msg.message_text.includes("Task") ? "Daily Activity Task" : "Daily Activity Meeting";
                                                    const lines = msg.message_text.split("\n");
                                                    if (lines.length > 1) {
                                                        previewTitle = lines[1].replace(/^\*|\*$/g, "").trim();
                                                    }
                                                    if (lines.length > 2) {
                                                        previewDesc = lines.slice(2).join("\n").replace(/^"|"$/g, "").trim();
                                                    }
                                                }

                                                return (
                                                    <motion.div 
                                                        key={msg.message_id || idx}
                                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        className={`flex items-end gap-2 max-w-[85%] ${isSelf ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                                                    >
                                                        {!isSelf && (
                                                            <div className="shrink-0 mb-0.5">
                                                                {msg.profile_image_url ? (
                                                                    <img src={msg.profile_image_url} alt={msg.user_name} className="w-6 h-6 rounded-lg object-cover border border-slate-100 dark:border-white/5" />
                                                                ) : (
                                                                    <div className={`w-6 h-6 rounded-lg ${uColor.bg} ${uColor.text} flex items-center justify-center font-bold text-[10px] border`}>
                                                                        {msg.user_name?.charAt(0)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className={`p-3 rounded-[1.25rem] shadow-sm text-xs font-bold leading-relaxed border transition-all duration-300 ${
                                                            isSystemCard
                                                            ? cardType === 'leave_request'
                                                                ? 'bg-gradient-to-br from-[#e0f2fe] to-[#c7d2fe] text-[#0550ae] dark:from-[#1e1b4b]/30 dark:to-[#312e81]/30 dark:text-[#8c959f] border border-[#a5b4fc]/40 dark:border-[#4338ca]/40 rounded-lg hover:shadow-md min-w-[240px]'
                                                                : cardType === 'correction_request'
                                                                    ? 'bg-gradient-to-br from-[#fef3c7] to-[#fde68a] text-[#b45309] dark:from-[#451a03]/30 dark:to-[#78350f]/30 dark:text-[#ffedd5] border border-[#fcd34d]/40 dark:border-[#92400e]/40 rounded-lg hover:shadow-md min-w-[240px]'
                                                                    : cardType === 'shift_assign'
                                                                        ? 'bg-gradient-to-br from-[#d1fae5] to-[#a7f3d0] text-[#047857] dark:from-[#064e3b]/30 dark:to-[#065f46]/30 dark:text-[#d1fae5] border border-[#6ee7b7]/40 dark:border-[#047857]/40 rounded-lg hover:shadow-md min-w-[240px]'
                                                                        : 'bg-gradient-to-br from-[#f3e8ff] to-[#e9d5ff] text-[#6b21a8] dark:from-[#4a044e]/30 dark:to-[#581c87]/30 dark:text-[#f3e8ff] border border-[#d8b4fe]/40 dark:border-[#7e22ce]/40 rounded-lg hover:shadow-md min-w-[240px]'
                                                            : isMentionPreview
                                                            ? isSelf
                                                                ? 'bg-gradient-to-br from-[#bae6fd] to-[#7dd3fc] dark:from-[#388bfd]/20 dark:to-[#1f6feb]/20 text-[#0550ae] dark:text-[#58a6ff] border border-[#7dd3fc]/30 dark:border-[#388bfd]/30 rounded-br-none hover:shadow-md'
                                                                : 'bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] text-[#24292f] dark:text-[#c9d1d9] rounded-bl-none hover:shadow-md'
                                                            : isSelf 
                                                                ? 'bg-indigo-600 text-white rounded-br-none border-indigo-500' 
                                                                : matchesMention
                                                                    ? 'bg-[#fff8c5] dark:bg-[#382314] border border-[#d4a72c] dark:border-[#9e6a03] text-[#735c0f] dark:text-[#f1e05a] rounded-bl-none font-semibold'
                                                                    : selectedRoom.room_type === 'group'
                                                                        ? `${uColor.bg} text-slate-800 dark:text-white rounded-bl-none`
                                                                        : 'bg-white dark:bg-github-dark-bg text-slate-800 dark:text-white rounded-bl-none border-slate-100 dark:border-white/5'
                                                        }`}>
                                                            {!isSelf && selectedRoom.room_type === 'group' && !isSystemCard && (
                                                                <span className={`block text-[9px] font-extrabold mb-1 ${uColor.text}`}>{msg.user_name}</span>
                                                            )}

                                                            {isSystemCard ? (
                                                                <div className="flex flex-col gap-2.5 min-w-[220px] max-w-sm">
                                                                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-1.5">
                                                                        <div className="flex items-center gap-1.5">
                                                                            {cardType === 'leave_request' && <Calendar size={12} className="shrink-0" />}
                                                                            {cardType === 'correction_request' && <Clock size={12} className="shrink-0" />}
                                                                            {cardType === 'shift_assign' && <Clock size={12} className="shrink-0" />}
                                                                            {cardType === 'geofence_assign' && <MapPin size={12} className="shrink-0" />}
                                                                            <span className={`text-[9px] font-black uppercase tracking-wider ${
                                                                                cardType === 'leave_request' ? 'text-[#0369a1] dark:text-[#388bfd]'
                                                                                : cardType === 'correction_request' ? 'text-[#b45309] dark:text-[#f59e0b]'
                                                                                : cardType === 'shift_assign' ? 'text-[#047857] dark:text-[#34d399]'
                                                                                : 'text-[#6b21a8] dark:text-[#a78bfa]'
                                                                            }`}>
                                                                                {cardType === 'leave_request' && `Leave: ${cardStatus}`}
                                                                                {cardType === 'correction_request' && `Correction: ${cardStatus}`}
                                                                                {cardType === 'shift_assign' && `Shift Assigned`}
                                                                                {cardType === 'geofence_assign' && `Work Location`}
                                                                            </span>
                                                                        </div>
                                                                        {cardPayload?.local_time && (
                                                                            <span className="text-[8px] font-bold opacity-60">
                                                                                {formatTimePretty(cardPayload.local_time)}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex flex-col gap-1.5 text-left font-medium">
                                                                        {cardPayload ? (
                                                                            <>
                                                                                {cardType === 'leave_request' && (
                                                                                    <>
                                                                                        <h5 className="font-extrabold text-[11px] uppercase tracking-wide">
                                                                                            {cardPayload.employee_name || cardPayload.reviewer_name} : {cardPayload.leave_type}
                                                                                        </h5>
                                                                                        <div className="text-[10px] space-y-0.5 opacity-90">
                                                                                            <div><span className="font-bold">Period:</span> {formatDatePretty(cardPayload.start_date)} to {formatDatePretty(cardPayload.end_date)}</div>
                                                                                            <div><span className="font-bold">Reason:</span> "{cardPayload.reason}"</div>
                                                                                            {cardPayload.admin_comment && cardPayload.admin_comment !== 'None' && (
                                                                                                <div className="mt-1 border-t border-sky-950/10 dark:border-sky-50/10 pt-1 text-slate-800 dark:text-slate-200">
                                                                                                    <span className="font-bold">Comment:</span> "{cardPayload.admin_comment}"
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </>
                                                                                )}

                                                                                {cardType === 'correction_request' && (
                                                                                    <>
                                                                                        <h5 className="font-extrabold text-[11px] uppercase tracking-wide">
                                                                                            {cardPayload.employee_name || cardPayload.reviewer_name} : {cardPayload.correction_type}
                                                                                        </h5>
                                                                                        <div className="text-[10px] space-y-0.5 opacity-90">
                                                                                            <div><span className="font-bold">Target Date:</span> {formatDatePretty(cardPayload.request_date)}</div>
                                                                                            <div><span className="font-bold">Reason:</span> "{cardPayload.reason}"</div>
                                                                                            {cardPayload.review_comments && cardPayload.review_comments !== 'None' && (
                                                                                                <div className="mt-1 border-t border-amber-950/10 dark:border-orange-50/10 pt-1 text-slate-800 dark:text-slate-200">
                                                                                                    <span className="font-bold">Comment:</span> "{cardPayload.review_comments}"
                                                                                                </div>
                                                                                            )}
                                                                                            {cardPayload.proposed_data && cardPayload.proposed_data.length > 0 && (
                                                                                                <div className="mt-1 space-y-1">
                                                                                                    <div className="font-bold text-[9px] uppercase tracking-wider opacity-85">Proposed Sessions:</div>
                                                                                                    {cardPayload.proposed_data.map((sess, sIdx) => (
                                                                                                        <div key={sIdx} className="bg-black/5 dark:bg-black/20 p-1 rounded text-[9px] border border-black/5 flex justify-between">
                                                                                                            <span>In: {String(sess.time_in || '').substring(0, 5)}</span>
                                                                                                            <span>Out: {String(sess.time_out || '').substring(0, 5)}</span>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </>
                                                                                )}

                                                                                {cardType === 'shift_assign' && (
                                                                                    <>
                                                                                        <h5 className="font-extrabold text-[11px] uppercase tracking-wide">
                                                                                            Shift Assigned
                                                                                        </h5>
                                                                                        <div className="text-[10px] space-y-0.5 opacity-90">
                                                                                            <div><span className="font-bold">Assigner:</span> {cardPayload.admin_name}</div>
                                                                                            <div><span className="font-bold">Shift name:</span> {cardPayload.shift_name}</div>
                                                                                            <div><span className="font-bold">Timings:</span> {cardPayload.start_time} to {cardPayload.end_time}</div>
                                                                                            <div><span className="font-bold">Grace Allowed:</span> {cardPayload.grace_period_mins} mins</div>
                                                                                        </div>
                                                                                    </>
                                                                                )}

                                                                                {cardType === 'geofence_assign' && (
                                                                                    <>
                                                                                        <h5 className="font-extrabold text-[11px] uppercase tracking-wide">
                                                                                            Work Location Assigned
                                                                                        </h5>
                                                                                        <div className="text-[10px] space-y-0.5 opacity-90">
                                                                                            <div><span className="font-bold">Assigner:</span> {cardPayload.admin_name}</div>
                                                                                            <div><span className="font-bold">Site:</span> {cardPayload.location_name}</div>
                                                                                            <div><span className="font-bold">Address:</span> {cardPayload.address}</div>
                                                                                            <div><span className="font-bold">Radius boundary:</span> {cardPayload.radius} meters</div>
                                                                                        </div>
                                                                                    </>
                                                                                )}

                                                                                {cardPayload.attachments && cardPayload.attachments.length > 0 && (
                                                                                    <div className="mt-2 pt-1.5 border-t border-slate-400/20">
                                                                                        <div className="font-bold text-[9px] uppercase tracking-wider mb-1 opacity-85">Documents:</div>
                                                                                        <div className="space-y-1">
                                                                                            {cardPayload.attachments.map((att, attIdx) => (
                                                                                                <a 
                                                                                                    key={attIdx} 
                                                                                                    href={att.url} 
                                                                                                    target="_blank" 
                                                                                                    rel="noopener noreferrer" 
                                                                                                    className="flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline bg-white/40 dark:bg-black/10 py-1 px-2 rounded border border-slate-400/10 cursor-pointer"
                                                                                                >
                                                                                                    <Paperclip size={10} className="shrink-0" />
                                                                                                    <span className="truncate flex-1 font-semibold">{att.name}</span>
                                                                                                    <Download size={10} className="shrink-0" />
                                                                                                </a>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <h5 className="font-extrabold text-xs tracking-wide uppercase leading-tight">
                                                                                    {cardTextTitle}
                                                                                </h5>
                                                                                {cardTextDesc && (
                                                                                    <p className="text-[11px] leading-relaxed border-l-2 border-slate-400/20 pl-2 mt-1 whitespace-pre-wrap font-medium">
                                                                                        {cardTextDesc}
                                                                                    </p>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const isAdminOrHr = ['admin', 'hr'].includes(user?.user_type);
                                                                            if (cardType === 'leave_request') {
                                                                                navigate(isAdminOrHr ? '/holidays?tab=requests' : '/holidays?tab=leave_application');
                                                                            } else if (cardType === 'correction_request') {
                                                                                navigate(isAdminOrHr ? '/attendance-monitoring?tab=requests' : '/attendance?tab=my_attendance&subTab=correction');
                                                                            } else if (cardType === 'shift_assign') {
                                                                                navigate(isAdminOrHr ? '/shift-management' : '/attendance');
                                                                            } else if (cardType === 'geofence_assign') {
                                                                                navigate(isAdminOrHr ? '/geofencing' : '/attendance');
                                                                            }
                                                                        }}
                                                                        className={`mt-1.5 py-1.5 px-3 rounded text-[10px] font-black text-center border active:scale-95 transition-all cursor-pointer ${
                                                                            cardType === 'leave_request' ? 'bg-[#0284c7] hover:bg-[#0369a1] text-white border-transparent'
                                                                            : cardType === 'correction_request' ? 'bg-[#d97706] hover:bg-[#b45309] text-white border-transparent'
                                                                            : cardType === 'shift_assign' ? 'bg-[#059669] hover:bg-[#047857] text-white border-transparent'
                                                                            : 'bg-[#7c3aed] hover:bg-[#6d28d9] text-white border-transparent'
                                                                        }`}
                                                                    >
                                                                        {cardType === 'leave_request' && 'View Leave Panel'}
                                                                        {cardType === 'correction_request' && 'View Corrections'}
                                                                        {cardType === 'shift_assign' && 'View Shift Details'}
                                                                        {cardType === 'geofence_assign' && 'View Location Map'}
                                                                    </button>
                                                                </div>
                                                            ) : isMentionPreview ? (
                                                                <div className="flex flex-col gap-2 min-w-[200px] max-w-sm">
                                                                    <div className="flex items-center gap-1.5 border-b border-white/10 pb-1">
                                                                        <span className="text-[9px] font-black uppercase tracking-wider text-white">
                                                                            {previewType}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    <div className="flex flex-col gap-1">
                                                                        <h5 className="font-extrabold text-xs tracking-wide uppercase">
                                                                            {previewTitle}
                                                                        </h5>
                                                                        {previewDesc && (
                                                                            <p className={`text-[11px] leading-relaxed border-l-2 pl-2 mt-0.5 ${
                                                                                isSelf ? 'border-white/20 text-indigo-100' : 'border-indigo-500/30 text-slate-500 dark:text-slate-400'
                                                                            }`}>
                                                                                {(() => {
                                                                                    const parts = previewDesc.split(/(@[a-zA-Z0-9\s._-]+)/g);
                                                                                    return parts.map((part, i) => {
                                                                                        if (part.startsWith('@')) {
                                                                                            return (
                                                                                                <span key={i} className={`px-1 py-0.5 rounded font-bold ${
                                                                                                    isSelf 
                                                                                                    ? 'bg-indigo-700 text-white' 
                                                                                                    : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                                                                                }`}>
                                                                                                    {part}
                                                                                                </span>
                                                                                            );
                                                                                        }
                                                                                        return part;
                                                                                    });
                                                                                })()}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {msg.message_text && (
                                                                        <p className="whitespace-pre-wrap break-all">{renderParsedMessageContent(msg.message_text, isSelf)}</p>
                                                                    )}

                                                                    {msg.attachment && (
                                                                        <div className={`mt-2 mb-1 p-2 rounded-xl border flex items-center justify-between gap-3 min-w-[200px] max-w-sm ${
                                                                            isSelf 
                                                                            ? 'bg-indigo-700/30 border-indigo-500/30 text-white' 
                                                                            : 'bg-slate-50 dark:bg-github-dark-bg border-slate-100 dark:border-white/5 text-slate-800 dark:text-white'
                                                                        }`}>
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                {msg.attachment.type.startsWith('image/') ? (
                                                                                    <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer" className="shrink-0 relative group overflow-hidden rounded-lg border border-white/10">
                                                                                        <img src={msg.attachment.url} alt={msg.attachment.name} className="w-12 h-12 object-cover transition-transform group-hover:scale-110" />
                                                                                    </a>
                                                                                ) : (
                                                                                    <FileText size={24} className="text-indigo-500 shrink-0" />
                                                                                )}
                                                                                <div className="truncate">
                                                                                    <span className="text-[11px] font-bold block truncate">{msg.attachment.name}</span>
                                                                                    <span className={`text-[9px] font-semibold uppercase ${isSelf ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                                                        {formatFileSize(msg.attachment.size)}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <a 
                                                                                href={msg.attachment.url} 
                                                                                target="_blank" 
                                                                                rel="noopener noreferrer"
                                                                                download={msg.attachment.name}
                                                                                className={`p-1.5 rounded-lg border transition-all ${
                                                                                    isSelf 
                                                                                    ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white hover:scale-105' 
                                                                                    : 'bg-white dark:bg-[#21262d] border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                                                }`}
                                                                                title="Download File"
                                                                            >
                                                                                <Download size={14} />
                                                                            </a>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}

                                                            <div className="flex items-center justify-end gap-1 mt-1 opacity-70 text-[8px] font-bold">
                                                                <span>{formatLocalTime(msg.created_at)}</span>
                                                                {isSelf && (
                                                                    msg.status === 'sending' ? (
                                                                        <div className="w-2.5 h-2.5 rounded-full border border-white border-t-transparent animate-spin shrink-0" />
                                                                    ) : msg.status === 'failed' ? (
                                                                        <span className="text-red-300 font-black">!</span>
                                                                    ) : (
                                                                        <CheckCheck size={10} className="text-white shrink-0" />
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            });
                                        })()}
                                    </>
                                )}

                                {/* WhatsApp Bouncing Dots Typing Bubble Inline inside feed */}
                                {selectedRoom && Object.values(typingUsers[selectedRoom.room_id] || {}).length > 0 && (
                                    <div className="flex items-center gap-2 max-w-[85%] mr-auto pl-8">
                                        <div className="bg-white dark:bg-github-dark-bg p-3.5 rounded-[1.25rem] rounded-bl-none border border-slate-100 dark:border-white/5 flex items-center gap-2 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <span className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <span className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                                {Object.values(typingUsers[selectedRoom.room_id]).join(', ')} is typing...
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>

                            {/* Floating Snap to Bottom button */}
                            {showScrollBottom && (
                                <button
                                    onClick={() => scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' })}
                                    className="absolute bottom-24 right-6 p-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all border border-indigo-500/30 z-[90] cursor-pointer animate-bounce"
                                >
                                    <ChevronDown size={18} strokeWidth={3} />
                                </button>
                            )}
                            {/* Message Input Controls */}
                            {selectedRoom.is_removed ? (
                                <div className="w-full p-4 bg-red-50 dark:bg-red-950/20 border-t border-slate-100 dark:border-github-dark-border text-center select-none">
                                    <span className="text-xs font-bold text-red-600 dark:text-red-400">
                                        You can't send messages to this group because you have been removed.
                                    </span>
                                </div>
                            ) : (
                                    <>
                                        {/* Mention Suggestions Dropdown */}
                                        <AnimatePresence>
                                            {activeMention && (
                                                (() => {
                                                    const candidateUsers = (selectedRoom?.room_type === 'group' && selectedRoom?.members)
                                                        ? selectedRoom.members.filter(m => Number(m.user_id) !== Number(currentUserId))
                                                        : coworkers;
                                                    const filtered = candidateUsers.filter(u => 
                                                        u.user_name.toLowerCase().includes(mentionSearch.toLowerCase())
                                                    ).slice(0, 5);
   
                                                    if (filtered.length === 0) return null;
   
                                                    return (
                                                        <motion.div 
                                                            initial={{ opacity: 0, y: 15 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 15 }}
                                                            className="absolute left-4 right-4 bottom-full mb-3 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl shadow-2xl z-50 overflow-hidden py-1 max-h-48 text-left"
                                                        >
                                                            <div className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-400 dark:text-github-dark-muted bg-slate-50 dark:bg-github-dark-bg border-b border-slate-100 dark:border-github-dark-border tracking-wider">
                                                                Mention Team Member
                                                            </div>
                                                            {filtered.map(u => (
                                                                <button
                                                                    key={u.user_id}
                                                                    type="button"
                                                                    onClick={() => handleMentionSelect(u)}
                                                                    className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-github-dark-bg transition-colors border-none bg-transparent cursor-pointer"
                                                                >
                                                                    {u.profile_image_url ? (
                                                                        <img src={u.profile_image_url} alt={u.user_name} className="w-6 h-6 rounded-lg object-cover border border-slate-100 dark:border-github-dark-border" />
                                                                    ) : (
                                                                        <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px] border border-slate-200 dark:border-github-dark-border">
                                                                            {u.user_name.charAt(0)}
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <div className="font-bold text-xs text-slate-800 dark:text-white">{u.user_name}</div>
                                                                        <div className="text-[9px] text-slate-450 dark:text-slate-500">{u.dept_name || 'Staff'} • {u.desg_name || 'Member'}</div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    );
                                                })()
                                            )}
                                        </AnimatePresence>
   
                                        {pendingAttachment && (
                                            <div className="mx-3 my-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100/30 dark:border-white/5 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 text-left">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <FileText size={18} className="text-indigo-500 shrink-0" />
                                                    <div className="truncate">
                                                        <span className="text-xs font-bold text-slate-800 dark:text-white block truncate">{pendingAttachment.name}</span>
                                                        <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase">{formatFileSize(pendingAttachment.size)}</span>
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => setPendingAttachment(null)}
                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-655 transition-colors border-none bg-transparent cursor-pointer"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
   
                                        <form onSubmit={handleSend} className="p-3 bg-white dark:bg-github-dark-subtle border-t border-slate-100 dark:border-github-dark-border flex gap-2 items-center shrink-0 relative w-full">
                                            <button 
                                                type="button"
                                                disabled={isUploading}
                                                onClick={() => fileInputRef.current?.click()}
                                                className="p-3 text-slate-500 bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 rounded-2xl active:scale-90 transition-all flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
                                                title="Upload attachment"
                                            >
                                                {isUploading ? (
                                                    <div className="w-4 h-4 rounded-full border border-indigo-600 border-t-transparent animate-spin" />
                                                ) : (
                                                    <Paperclip size={16} />
                                                )}
                                            </button>
                                            <input 
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                onChange={handleFileUpload}
                                            />
   
                                            <input 
                                                ref={chatInputRef}
                                                type="text"
                                                placeholder="Type a message... Use @ to tag"
                                                value={newMessageText}
                                                onChange={(e) => handleInputChange(e.target.value)}
                                                className="flex-1 px-4 py-3 bg-slate-50 dark:bg-github-dark-bg rounded-2xl border border-slate-200/60 dark:border-github-dark-border focus:outline-none text-xs font-bold text-slate-800 dark:text-github-dark-text placeholder-slate-400"
                                            />
                                            <button 
                                                type="submit" 
                                                disabled={!newMessageText.trim() && !pendingAttachment}
                                                className="p-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                                            >
                                                <Send size={16} />
                                            </button>
                                        </form>
                                    </>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-50/50 dark:bg-github-dark-bg/10">
                            <MessageSquare size={48} className="text-slate-300 dark:text-slate-700 mb-3" />
                            <h4 className="text-sm font-bold text-slate-500">No Chat Selected</h4>
                            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Select a teammate or group from the list to start chatting.</p>
                        </div>
                    )}
                </div>

                {/* 3. Direct Message Modal */}
                <AnimatePresence>
                    {showDmModal && (
                        <div className="fixed inset-0 z-[150] flex items-end justify-center">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDmModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                            <motion.div 
                                initial={{ y: '100%' }} 
                                animate={{ y: 0 }} 
                                exit={{ y: '100%' }} 
                                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                                className="bg-white dark:bg-github-dark-subtle rounded-t-3xl p-5 w-full border-t border-slate-100 dark:border-github-dark-border shadow-2xl relative z-10 max-h-[85vh] flex flex-col pb-8"
                            >
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-github-dark-border/40 shrink-0">
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Start Chat</h3>
                                    <button onClick={() => setShowDmModal(false)} className="text-slate-400 p-1 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200/50 dark:border-white/5"><X size={16} /></button>
                                </div>
                                <div className="py-3 shrink-0">
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder="Search teammates..." 
                                            value={dmSearchQuery} 
                                            onChange={(e) => setDmSearchQuery(e.target.value)} 
                                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-github-dark-bg rounded-xl border border-slate-200 dark:border-github-dark-border focus:outline-none text-xs font-bold text-slate-700 dark:text-white" 
                                        />
                                        <Search size={12} className="absolute left-3 top-3 text-slate-400" />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-github-dark-border/30 no-scrollbar">
                                    {coworkers.filter(c => c.user_name.toLowerCase().includes(dmSearchQuery.toLowerCase())).length === 0 ? (
                                        <p className="text-center text-xs text-slate-400 py-6">No teammates found</p>
                                    ) : (
                                        coworkers.filter(c => c.user_name.toLowerCase().includes(dmSearchQuery.toLowerCase())).map(colleague => (
                                            <button 
                                                key={colleague.user_id} 
                                                onClick={() => initiateDM(colleague)} 
                                                className="w-full text-left p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/5 bg-transparent border-none outline-none cursor-pointer"
                                            >
                                                {colleague.profile_image_url ? (
                                                    <img src={colleague.profile_image_url} alt={colleague.user_name} className="w-8 h-8 rounded-xl object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white flex items-center justify-center font-bold text-xs border border-slate-200 dark:border-github-dark-border">{getInitials(colleague.user_name)}</div>
                                                )}
                                                <div>
                                                    <span className="block text-xs font-bold text-slate-800 dark:text-white leading-none mb-0.5">{colleague.user_name}</span>
                                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">{colleague.desg_name || 'Coworker'}</span>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* 4. Create Group Modal */}
                <AnimatePresence>
                    {showGroupModal && (
                        <div className="fixed inset-0 z-[150] flex items-end justify-center">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGroupModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                            <motion.div 
                                initial={{ y: '100%' }} 
                                animate={{ y: 0 }} 
                                exit={{ y: '100%' }} 
                                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                                className="bg-white dark:bg-github-dark-subtle rounded-t-3xl p-5 w-full border-t border-slate-100 dark:border-github-dark-border shadow-2xl relative z-10 max-h-[85vh] flex flex-col pb-8"
                            >
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-github-dark-border/40 shrink-0">
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Create Group</h3>
                                    <button onClick={() => setShowGroupModal(false)} className="text-slate-400 p-1 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200/50 dark:border-white/5"><X size={16} /></button>
                                </div>
                                <div className="py-3 space-y-3 shrink-0">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider px-1">Group Name</label>
                                        <input 
                                            type="text" 
                                            placeholder="Enter group name..." 
                                            value={groupName} 
                                            onChange={(e) => setGroupName(e.target.value)} 
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-github-dark-bg rounded-xl border border-slate-200 dark:border-github-dark-border focus:outline-none text-xs font-bold text-slate-700 dark:text-white" 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider px-1">Select Members</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                placeholder="Search members..." 
                                                value={groupSearchQuery} 
                                                onChange={(e) => setGroupSearchQuery(e.target.value)} 
                                                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-github-dark-bg rounded-xl border border-slate-200 dark:border-github-dark-border focus:outline-none text-xs font-bold text-slate-700 dark:text-white" 
                                            />
                                            <Search size={12} className="absolute left-3 top-3 text-slate-400" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-github-dark-border/30 no-scrollbar">
                                    {coworkers.filter(c => c.user_name.toLowerCase().includes(groupSearchQuery.toLowerCase())).length === 0 ? (
                                        <p className="text-center text-xs text-slate-400 py-6">No teammates found</p>
                                    ) : (
                                        coworkers.filter(c => c.user_name.toLowerCase().includes(groupSearchQuery.toLowerCase())).map(colleague => {
                                            const isSelected = selectedGroupMembers.includes(colleague.user_id);
                                            return (
                                                <button 
                                                    key={colleague.user_id} 
                                                    onClick={() => toggleMemberSelection(colleague.user_id)} 
                                                    className={`w-full text-left p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 border-none outline-none cursor-pointer ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-500/5' : 'bg-transparent'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {colleague.profile_image_url ? (
                                                            <img src={colleague.profile_image_url} alt={colleague.user_name} className="w-8 h-8 rounded-xl object-cover" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white flex items-center justify-center font-bold text-xs border border-slate-200 dark:border-github-dark-border">{getInitials(colleague.user_name)}</div>
                                                        )}
                                                        <div>
                                                            <span className="block text-xs font-bold text-slate-800 dark:text-white leading-none mb-0.5">{colleague.user_name}</span>
                                                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">{colleague.desg_name || 'Coworker'}</span>
                                                        </div>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                                        isSelected ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' : 'border-slate-300 dark:border-slate-700 bg-transparent'
                                                    }`}>
                                                        {isSelected && <X size={12} strokeWidth={3} />}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                                <div className="pt-4 shrink-0 border-t border-slate-100 dark:border-github-dark-border/40">
                                    <button onClick={handleCreateGroup} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-black rounded-2xl transition-all shadow-lg shadow-indigo-600/20 text-sm">
                                        Create Group
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* 5. Group Details & Member Management Modal */}
                <AnimatePresence>
                    {showGroupDetailsModal && selectedRoom && selectedRoom.room_type === 'group' && (
                        <div className="fixed inset-0 z-[150] flex items-end justify-center">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGroupDetailsModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                            <motion.div 
                                initial={{ y: '100%' }} 
                                animate={{ y: 0 }} 
                                exit={{ y: '100%' }} 
                                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                                className="bg-white dark:bg-github-dark-subtle rounded-t-3xl p-5 w-full border-t border-slate-100 dark:border-github-dark-border shadow-2xl relative z-10 max-h-[85vh] flex flex-col pb-8"
                            >
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-github-dark-border/40 shrink-0">
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Group Info</h3>
                                    <button onClick={() => setShowGroupDetailsModal(false)} className="text-slate-400 p-1 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200/50 dark:border-white/5"><X size={16} /></button>
                                </div>
                                
                                <div className="py-3 flex items-center gap-3 bg-slate-50 dark:bg-github-dark-bg p-3 rounded-2xl border border-slate-100 dark:border-github-dark-border shrink-0 mt-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base border border-indigo-100/10 shrink-0">
                                        <Users size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-extrabold text-xs text-slate-800 dark:text-white truncate uppercase tracking-wider">{selectedRoom.room_name}</h4>
                                        <span className="text-[10px] text-slate-400 font-bold">{selectedRoom.members?.length || 0} Members</span>
                                    </div>
                                </div>

                                <div className="space-y-2 mt-4 flex-1 overflow-y-auto no-scrollbar pb-3">
                                    {/* Members List */}
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block px-1">Current Members</label>
                                    <div className="divide-y divide-slate-100 dark:divide-github-dark-border/30">
                                        {selectedRoom.members?.map((member) => {
                                            const isMemberSelf = Number(member.user_id) === Number(currentUserId);
                                            return (
                                                <div 
                                                    key={member.user_id} 
                                                    className="flex items-center justify-between py-2.5 bg-transparent border-none outline-none"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        {member.profile_image_url ? (
                                                            <img src={member.profile_image_url} alt={member.user_name} className="w-7 h-7 rounded-xl object-cover shrink-0 border border-slate-100 dark:border-white/5" />
                                                        ) : (
                                                            <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white flex items-center justify-center font-bold text-[9px] border border-slate-200 dark:border-github-dark-border">
                                                                {getInitials(member.user_name)}
                                                            </div>
                                                        )}
                                                        <div className="truncate">
                                                            <span className="text-xs font-bold text-slate-800 dark:text-white block truncate leading-none mb-0.5">{member.user_name} {isMemberSelf && '(You)'}</span>
                                                            <span className="text-[9px] text-slate-400 block truncate">{member.desg_name || 'Staff'}</span>
                                                        </div>
                                                    </div>
                                                    {!isMemberSelf && (
                                                        <button 
                                                            onClick={() => handleRemoveMember(member.user_id)}
                                                            className="text-red-500 hover:text-red-600 p-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg border-none bg-transparent cursor-pointer text-[10px] font-black"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Add Members section */}
                                    <div className="pt-3 border-t border-slate-100 dark:border-github-dark-border/40">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block px-1 mb-2">Add Teammates</label>
                                        <div className="relative mb-2">
                                            <input 
                                                type="text" 
                                                placeholder="Search other teammates..." 
                                                value={groupDetailsSearchQuery} 
                                                onChange={(e) => setGroupDetailsSearchQuery(e.target.value)} 
                                                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-github-dark-bg rounded-xl border border-slate-200 dark:border-github-dark-border focus:outline-none text-xs font-bold text-slate-700 dark:text-white" 
                                            />
                                            <Search size={12} className="absolute left-2.5 top-3 text-slate-400" />
                                        </div>

                                        <div className="divide-y divide-slate-100 dark:divide-github-dark-border/30">
                                            {(() => {
                                                const currentMemberIds = selectedRoom.members?.map(m => Number(m.user_id)) || [];
                                                const nonMembers = coworkers.filter(c => 
                                                    !currentMemberIds.includes(Number(c.user_id)) &&
                                                    (c.user_name.toLowerCase().includes(groupDetailsSearchQuery.toLowerCase()) ||
                                                     c.desg_name?.toLowerCase().includes(groupDetailsSearchQuery.toLowerCase()))
                                                );

                                                if (nonMembers.length === 0) {
                                                    return <p className="text-[10px] text-slate-400 italic text-center py-4">No other teammates available.</p>;
                                                }

                                                return nonMembers.map((colleague) => (
                                                    <div 
                                                        key={colleague.user_id} 
                                                        className="flex items-center justify-between py-2.5 bg-transparent border-none outline-none"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            {colleague.profile_image_url ? (
                                                                <img src={colleague.profile_image_url} alt={colleague.user_name} className="w-7 h-7 rounded-xl object-cover shrink-0 border border-slate-100 dark:border-white/5" />
                                                            ) : (
                                                                <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white flex items-center justify-center font-bold text-[9px] border border-slate-200 dark:border-github-dark-border">
                                                                    {getInitials(colleague.user_name)}
                                                                </div>
                                                            )}
                                                            <div className="truncate">
                                                                <span className="text-xs font-bold text-slate-800 dark:text-white block truncate leading-none mb-0.5">{colleague.user_name}</span>
                                                                <span className="text-[9px] text-slate-400 block truncate">{colleague.desg_name || 'Staff'}</span>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleAddMember(colleague.user_id)}
                                                            className="text-indigo-500 hover:text-indigo-600 p-1 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg border-none bg-transparent cursor-pointer text-[10px] font-black"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            </div>
        </MobileDashboardLayout>
    );
};

export default MobileChatPage;
