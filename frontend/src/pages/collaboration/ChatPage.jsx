import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { 
    Send, Plus, Search, MessageSquare, Users, Hash, 
    Smile, CheckCheck, 
    ArrowLeft, UserPlus, X, Volume2, Info, Lock,
    Paperclip, FileText, Download, File, Clock, Calendar, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const formatLastMessagePreview = (messageText) => {
    if (!messageText) return "";
    if (messageText.startsWith("[SYSTEM_CARD:")) {
        const endHeaderIndex = messageText.indexOf("]");
        if (endHeaderIndex !== -1) {
            const header = messageText.substring(13, endHeaderIndex); // omit "[SYSTEM_CARD:"
            const parts = header.split(":");
            const cardType = parts[0] || "";
            const cardStatus = parts[2] || "";
            
            const body = messageText.substring(endHeaderIndex + 1).trim();
            let payload = null;
            try {
                payload = JSON.parse(body);
            } catch (e) {
                // Ignore parsing errors for fallback
            }

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
            } else if (cardType === 'shift_assign') {
                if (payload) {
                    return `Shift Assigned: ${payload.shift_name} (${payload.start_time} - ${payload.end_time})`;
                }
                return `Shift Assigned`;
            } else if (cardType === 'geofence_assign') {
                if (payload) {
                    return `Location Assigned: ${payload.location_name}`;
                }
                return `Location Assigned`;
            }
        }
    }
    return messageText;
};

const ChatPage = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const navigate = useNavigate();
    const currentUserId = user?.user_id ?? user?.id;


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

    const openDmModal = () => {
        setDmSearchQuery('');
        setShowDmModal(true);
    };

    const openGroupModal = () => {
        setGroupSearchQuery('');
        setGroupName('');
        setSelectedGroupMembers([]);
        setShowGroupModal(true);
    };

    // Typing Indicators State
    const [typingUsers, setTypingUsers] = useState({}); // { roomId: { userId: username } }
    const isTypingRef = useRef(false);
    const typingTimeoutRef = useRef(null);

    // Mention Dropdown State
    const [activeMention, setActiveMention] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');
    const chatInputRef = useRef(null);

    // Attachment Uploads State
    const [pendingAttachment, setPendingAttachment] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

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

    // Layout/Mobile responsive states
    const [showMobileChatWindow, setShowMobileChatWindow] = useState(false);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    
    const messagesEndRef = useRef(null);

    // Load initial data
    useEffect(() => {
        fetchRooms();
        fetchCoworkers();
    }, []);

    // Auto-select last active room on mount once rooms are loaded
    const [hasAttemptedAutoSelect, setHasAttemptedAutoSelect] = useState(false);
    useEffect(() => {
        if (!loadingRooms && rooms.length > 0 && !selectedRoom && !hasAttemptedAutoSelect) {
            setHasAttemptedAutoSelect(true);
            const lastActiveId = localStorage.getItem('lastActiveChatRoomId');
            if (lastActiveId) {
                const targetRoom = rooms.find(r => Number(r.room_id) === Number(lastActiveId));
                if (targetRoom) {
                    handleRoomSelect(targetRoom);
                }
            }
        }
    }, [rooms, loadingRooms, selectedRoom, hasAttemptedAutoSelect]);

    // Set up Socket listeners
    useEffect(() => {
        if (!socket) return;

        const handleIncomingMessage = (message) => {
            // If the message belongs to the currently active room, append it and mark as read
            if (selectedRoom && Number(selectedRoom.room_id) === Number(message.room_id)) {
                setMessages(prev => {
                    // Reconcile and replace optimistic message placeholders
                    const matchIndex = prev.findIndex(m => 
                        (m.message_id === message.message_id) || 
                        (m.status === 'sending' && 
                         Number(m.sender_id) === Number(message.sender_id) && 
                         m.message_text === message.message_text && 
                         (!m.attachment || !message.attachment || m.attachment.name === message.attachment.name))
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
            }
            
            // Refresh room previews to show latest message and update unread count
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

        // If a room is selected, join its socket room
        if (selectedRoom) {
            socket.emit('join_room', selectedRoom.room_id);
        }

        return () => {
            socket.off('message_received', handleIncomingMessage);
            socket.off('user_typing', handleUserTyping);
            socket.off('user_stop_typing', handleUserStopTyping);
            if (selectedRoom) {
                socket.emit('leave_room', selectedRoom.room_id);
            }
        };
    }, [socket, selectedRoom, currentUserId]);

    // Scroll to bottom of message thread
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchRooms = async (showLoading = true) => {
        if (showLoading) setLoadingRooms(true);
        try {
            const res = await api.get('/collaboration/rooms');
            if (res.data.success) {
                // Filter out any rooms/channels that are associated with the AI assistant/chatbot
                const filtered = res.data.data.filter(room => {
                    const name = room.room_name?.toLowerCase() || '';
                    return !(
                        name.includes('bot') || 
                        name.includes('assistant') || 
                        name.includes('ai')
                    );
                });
                setRooms(filtered);
                
                // Keep selected room details updated
                if (selectedRoom) {
                    const updatedSelected = filtered.find(r => r.room_id === selectedRoom.room_id);
                    if (updatedSelected) setSelectedRoom(updatedSelected);
                }
            }
        } catch (err) {
            // Failed to load rooms
        } finally {
            if (showLoading) setLoadingRooms(false);
        }
    };

    const fetchCoworkers = async () => {
        try {
            const res = await api.get('/collaboration/users');
            if (res.data.success) {
                // Filter out any AI assistant or chatbot accounts from the directory list
                const filtered = res.data.data.filter(u => {
                    const name = u.user_name?.toLowerCase() || '';
                    const role = u.user_type?.toLowerCase() || '';
                    const dept = u.dept_name?.toLowerCase() || '';
                    const desg = u.desg_name?.toLowerCase() || '';
                    
                    return !(
                        name.includes('bot') || 
                        name.includes('assistant') || 
                        name.includes('ai') || 
                        role.includes('bot') ||
                        dept.includes('ai') ||
                        desg.includes('assistant') ||
                        desg.includes('ai')
                    );
                });
                setCoworkers(filtered);
            }
        } catch (err) {
            // Failed to load directory
        }
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
        if (room && room.room_id) {
            localStorage.setItem('lastActiveChatRoomId', room.room_id);
        }
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
        } catch (err) {
            // Failed to mark room read
        }
    };

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if ((!newMessageText.trim() && !pendingAttachment) || !selectedRoom) return;

        const textToSend = newMessageText;
        const attachmentToSend = pendingAttachment;

        setNewMessageText('');
        setPendingAttachment(null);
        setActiveMention(false);
        
        // Stop typing indicator instantly on send
        stopTypingIndicator();

        // 1. Construct optimistic message
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
            status: 'sending' // 'sending' | 'sent' | 'failed'
        };

        // 2. Append instantly to local messages list
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const res = await api.post(`/collaboration/rooms/${selectedRoom.room_id}/messages`, {
                message_text: textToSend,
                attachment: attachmentToSend
            });
            
            // 3. Mark optimistic message as sent immediately using response payload
            if (res.data.success) {
                const confirmedMsg = res.data.data;
                setMessages(prev => prev.map(m => 
                    m.message_id === optimisticId ? { ...confirmedMsg, status: 'sent' } : m
                ));
            }
        } catch (err) {
            console.error("Optimistic send error:", err);
            // 4. Mark as failed if server rejected it
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

        // Clear existing timeout
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        // Stop typing after 3 seconds of inactivity
        typingTimeoutRef.current = setTimeout(stopTypingIndicator, 3000);
    };

    const stopTypingIndicator = () => {
        if (!socket || !selectedRoom || !isTypingRef.current) return;
        isTypingRef.current = false;
        socket.emit('stop_typing', { roomId: selectedRoom.room_id });
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

    const initiateDM = async (otherUser) => {
        try {
            const res = await api.post('/collaboration/rooms', {
                room_type: 'direct',
                member_ids: [otherUser.user_id]
            });
            if (res.data.success) {
                await fetchRooms();
                setShowDmModal(false);
                
                // Load this DM room
                const targetRoom = res.data.data;
                // If it is newly created, format it locally for immediate loading
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
        if (!groupName.trim()) {
            return toast.error("Please enter a group name");
        }
        if (selectedGroupMembers.length === 0) {
            return toast.error("Please select at least one group member");
        }

        try {
            const res = await api.post('/collaboration/rooms', {
                room_type: 'group',
                room_name: groupName,
                member_ids: selectedGroupMembers
            });
            if (res.data.success) {
                toast.success("Group created successfully!");
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
            prev.includes(userId) 
                ? prev.filter(id => id !== userId) 
                : [...prev, userId]
        );
    };

    // Filter conversations based on sidebarTab and searchQuery
    const filteredRooms = rooms.filter(room => {
        const matchesTab = 
            sidebarTab === 'all' || 
            (sidebarTab === 'direct' && room.room_type === 'direct') ||
            (sidebarTab === 'group' && room.room_type === 'group');

        const matchesSearch = 
            room.room_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            room.last_message?.text?.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesTab && matchesSearch;
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
                // If it is a timezone-less string, normalize to ISO and append 'Z' to treat as UTC
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

    return (
        <DashboardLayout title="Chat & Collaboration">
            <div className="flex bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded-xl overflow-hidden h-[calc(100vh-85px)] relative">
                
                {/* 1. SIDEBAR: Channels & Direct Messages List */}
                <div className={`w-full md:w-80 lg:w-96 shrink-0 border-r border-[#d0d7de] dark:border-[#30363d] flex flex-col bg-[#f0f9ff]/40 dark:bg-[#0d1117] transition-all duration-300 ${showMobileChatWindow ? 'hidden md:flex' : 'flex'}`}>
                    
                    {/* Header: User Controls */}
                    <div className="h-16 px-4 border-b border-[#d0d7de] dark:border-[#30363d] flex items-center justify-between shrink-0">
                        <h2 className="text-sm font-bold text-[#24292f] dark:text-[#c9d1d9] tracking-tight">Messages</h2>
                        
                        <div className="flex items-center gap-1.5">
                            {/* New DM Button */}
                            <button 
                                onClick={openDmModal}
                                className="p-2 hover:bg-[#eaeef2] dark:hover:bg-[#21262d] text-[#57606a] dark:text-[#8b949e] rounded-md transition-colors border-none bg-transparent cursor-pointer"
                                title="New DM"
                            >
                                <MessageSquare size={16} />
                            </button>

                            {/* New Group Button */}
                            <button 
                                onClick={openGroupModal}
                                className="p-2 hover:bg-[#eaeef2] dark:hover:bg-[#21262d] text-[#57606a] dark:text-[#8b949e] rounded-md transition-colors border-none bg-transparent cursor-pointer"
                                title="New Group"
                            >
                                <Users size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Search Field */}
                    <div className="p-3">
                        <div className="relative">
                            <input 
                                type="text"
                                placeholder="Search chats..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-[#010409] rounded-md border border-[#d0d7de] dark:border-[#30363d] focus:outline-none focus:border-[#7dd3fc] focus:ring-1 focus:ring-[#7dd3fc] dark:focus:border-[#388bfd] dark:focus:ring-1 dark:focus:ring-[#388bfd] text-[#24292f] dark:text-[#c9d1d9] placeholder-[#8c959f] dark:placeholder-[#484f58]"
                            />
                            <Search size={14} className="absolute left-3 top-2.5 text-[#8c959f]" />
                        </div>
                    </div>

                    {/* Sidebar Tabs */}
                    <div className="px-3 pb-2 flex border-b border-[#d0d7de]/60 dark:border-[#30363d]/50">
                        {['all', 'direct', 'group'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setSidebarTab(tab)}
                                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-colors border-none cursor-pointer ${
                                    sidebarTab === tab 
                                    ? 'bg-[#e0f2fe] dark:bg-[#21262d] text-[#0550ae] dark:text-[#f0f6fc] border border-[#7dd3fc]/30 dark:border-[#30363d]' 
                                    : 'bg-transparent text-[#57606a] hover:text-[#24292f] dark:text-[#8b949e] dark:hover:text-[#c9d1d9]'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-[#d0d7de]/50 dark:divide-[#30363d]/30 custom-scrollbar">
                        {loadingRooms ? (
                            <div className="flex flex-col items-center justify-center h-48 gap-3">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#7dd3fc] dark:border-[#58a6ff]"></div>
                                <span className="text-xs text-[#57606a] dark:text-[#8b949e]">Loading chats...</span>
                            </div>
                        ) : filteredRooms.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center h-48">
                                <MessageSquare size={32} className="text-[#8c959f] mb-2 opacity-60" />
                                <h4 className="text-xs font-bold text-[#57606a] dark:text-[#8b949e]">No Conversations</h4>
                                <p className="text-[10px] text-[#8c959f] mt-1">Start a direct chat or create a group to collaborate.</p>
                            </div>
                        ) : (
                            filteredRooms.map((room) => {
                                const isSelected = selectedRoom?.room_id === room.room_id;
                                const isGroup = room.room_type === 'group';
                                const activeTyping = typingUsers[room.room_id] || {};
                                const typingNames = Object.values(activeTyping);

                                return (
                                    <button
                                        key={room.room_id}
                                        onClick={() => handleRoomSelect(room)}
                                        className={`w-full text-left p-3 flex items-center gap-3 transition-all cursor-pointer border-none outline-none ${
                                            isSelected 
                                            ? 'bg-white dark:bg-[#21262d] border-l-[3px] border-[#7dd3fc] dark:border-[#388bfd] shadow-sm' 
                                            : 'hover:bg-[#e0f2fe]/40 dark:hover:bg-[#21262d]/50 bg-transparent border-l-[3px] border-transparent'
                                        }`}
                                    >
                                        {/* Avatar */}
                                        <div className="relative shrink-0">
                                            {isGroup ? (
                                                <div className="w-9 h-9 rounded-md bg-[#e0f2fe] dark:bg-[#388bfd]/10 text-[#0550ae] dark:text-[#58a6ff] flex items-center justify-center font-bold text-sm border border-[#7dd3fc]/30 dark:border-[#388bfd]/30">
                                                    <Users size={16} />
                                                </div>
                                            ) : room.avatar_url ? (
                                                <img src={room.avatar_url} alt={room.room_name} className="w-9 h-9 rounded-md object-cover border border-[#d0d7de] dark:border-[#30363d]" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-md bg-white dark:bg-[#21262d] text-[#24292f] dark:text-[#f0f6fc] flex items-center justify-center font-bold text-sm border border-[#d0d7de] dark:border-[#30363d]">
                                                    {getInitials(room.room_name)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Meta Previews */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <h4 className="text-xs font-bold text-[#24292f] dark:text-[#c9d1d9] truncate">{room.room_name}</h4>
                                                
                                                {/* Timestamp */}
                                                {room.last_message && (
                                                    <span className="text-[9px] text-[#57606a] dark:text-[#8b949e] shrink-0 font-medium">
                                                        {formatLocalTime(room.last_message.created_at)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Preview text */}
                                            {typingNames.length > 0 ? (
                                                <span className="text-[10px] text-[#0550ae] dark:text-[#58a6ff] font-medium animate-pulse truncate block">
                                                    typing...
                                                </span>
                                            ) : room.last_message ? (
                                                <p className={`text-[10px] truncate block ${isSelected ? 'text-[#24292f] dark:text-[#c9d1d9]' : 'text-[#57606a] dark:text-[#8b949e]'}`}>
                                                    {room.last_message.sender_id === currentUserId ? 'You: ' : ''}
                                                    {formatLastMessagePreview(room.last_message.text)}
                                                </p>
                                            ) : (
                                                <p className={`text-[10px] italic truncate block ${isSelected ? 'text-[#8c959f] dark:text-[#8b949e]' : 'text-[#8c959f] dark:text-[#484f58]'}`}>No messages yet</p>
                                            )}
                                        </div>

                                        {/* Unread Badge */}
                                        {room.unread_count > 0 && (
                                            <span className="shrink-0 w-4 h-4 bg-[#7dd3fc] dark:bg-[#238636] text-[#0550ae] dark:text-white rounded-full flex items-center justify-center text-[8px] font-bold">
                                                {room.unread_count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 2. MAIN WORKSPACE: Message thread pane */}
                <div className={`flex-1 flex flex-col bg-white dark:bg-[#010409] h-full ${showMobileChatWindow ? 'flex' : 'hidden md:flex'}`}>
                    {selectedRoom ? (
                        <>
                            {/* Window Top Bar Header */}
                            <div className="h-16 px-4 border-b border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#0d1117] flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    {/* Back Button (Mobile Only) */}
                                    <button 
                                        onClick={() => setShowMobileChatWindow(false)}
                                        className="p-1 md:hidden text-[#57606a] hover:bg-[#eaeef2] dark:hover:bg-[#21262d] rounded-md border-none bg-transparent cursor-pointer"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>

                                    {/* Avatar */}
                                    <div className="relative shrink-0">
                                        {selectedRoom.room_type === 'group' ? (
                                            <div className="w-9 h-9 rounded-md bg-[#e0f2fe] dark:bg-[#388bfd]/10 text-[#0550ae] dark:text-[#58a6ff] flex items-center justify-center font-bold text-sm border border-[#7dd3fc]/30 dark:border-[#388bfd]/30">
                                                <Users size={16} />
                                            </div>
                                        ) : selectedRoom.avatar_url ? (
                                            <img src={selectedRoom.avatar_url} alt={selectedRoom.room_name} className="w-9 h-9 rounded-md object-cover border border-[#d0d7de] dark:border-[#30363d]" />
                                        ) : (
                                            <div className="w-9 h-9 rounded-md bg-[#f6f8fa] dark:bg-[#21262d] text-[#24292f] dark:text-[#f0f6fc] flex items-center justify-center font-bold text-sm border border-[#d0d7de] dark:border-[#30363d]">
                                                {getInitials(selectedRoom.room_name)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info text */}
                                    <div className="truncate">
                                        <h3 className="text-xs font-black text-[#24292f] dark:text-[#c9d1d9] truncate uppercase tracking-wider">{selectedRoom.room_name}</h3>
                                        
                                        {/* Status Detail */}
                                        {Object.values(typingUsers[selectedRoom.room_id] || {}).length > 0 ? (
                                            <span className="text-[9px] text-[#0550ae] dark:text-[#58a6ff] font-semibold animate-pulse">
                                                typing...
                                            </span>
                                        ) : selectedRoom.room_type === 'group' ? (
                                            <span className="text-[9px] text-[#57606a] dark:text-[#8b949e]">
                                                {selectedRoom.members?.length || 0} members
                                            </span>
                                        ) : (
                                            <span className="text-[9px] text-[#2da44f] dark:text-[#3fb950] font-semibold flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#2da44f] dark:bg-[#3fb950]"></span> Active
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Call, video and menu actions removed as they are not part of chat features */}
                            </div>

                            {/* Message Panel Area */}
                            <div className="flex-1 overflow-y-auto p-3.5 space-y-2 custom-scrollbar bg-white dark:bg-[#010409]">
                                {loadingMessages ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-2">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7dd3fc] dark:border-[#58a6ff]"></div>
                                        <span className="text-xs text-[#57606a] dark:text-[#8b949e]">Loading messages...</span>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                                        {/* Security Banner for empty state */}
                                        <div className="flex items-center gap-1.5 px-3 py-1 mb-4 bg-[#f0f9ff] dark:bg-[#161b22]/50 border border-[#7dd3fc]/30 dark:border-[#388bfd]/30 rounded-md text-[10px] text-[#0550ae] dark:text-[#58a6ff] font-semibold shadow-sm max-w-max mx-auto whitespace-nowrap">
                                            <Lock size={10} className="shrink-0 text-[#0550ae] dark:text-[#58a6ff]" />
                                            <span>Messages are securely stored and accessible only to members of this chat.</span>
                                        </div>
                                        <div className="w-12 h-12 rounded-lg bg-[#e0f2fe] dark:bg-[#388bfd]/10 text-[#0550ae] dark:text-[#58a6ff] flex items-center justify-center mb-3 border border-[#7dd3fc]/30 dark:border-[#388bfd]/30">
                                            <MessageSquare size={24} />
                                        </div>
                                        <h4 className="text-sm font-bold text-[#24292f] dark:text-[#c9d1d9]">No Messages Yet</h4>
                                        <p className="text-xs text-[#57606a] dark:text-[#8b949e] mt-1 max-w-sm">Say hello! Type your first message below. You can use @ to mention teammates.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Security Banner for active state */}
                                        <div className="flex justify-center mb-3 mt-1">
                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#f0f9ff] dark:bg-[#161b22]/50 border border-[#7dd3fc]/30 dark:border-[#388bfd]/30 rounded-md text-[10px] text-[#0550ae] dark:text-[#58a6ff] font-semibold shadow-sm max-w-max whitespace-nowrap">
                                                <Lock size={10} className="shrink-0 text-[#0550ae] dark:text-[#58a6ff]" />
                                                <span>Messages are securely stored and accessible only to members of this chat.</span>
                                            </div>
                                        </div>
                                        {messages.map((msg, idx) => {
                                            const isSelf = Number(msg.sender_id) === Number(currentUserId);
                                            const hasAvatar = msg.profile_image_url;
                                            
                                            // Detect if this message mentions current user
                                            const matchesMention = msg.message_text.includes(`@${user?.user_name}`);

                                            // System Card Alert Parser
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
                                                    const header = msg.message_text.substring(13, endHeaderIndex); // omit "[SYSTEM_CARD:"
                                                    const parts = header.split(":");
                                                    cardType = parts[0] || "";
                                                    cardEntityId = parts[1] || "";
                                                    cardStatus = parts[2] || "";
                                                    
                                                    const body = msg.message_text.substring(endHeaderIndex + 1).trim();
                                                    try {
                                                        cardPayload = JSON.parse(body);
                                                    } catch (e) {
                                                        // Fallback for legacy plain text messages
                                                        const bodyLines = body.split("\n");
                                                        cardTextTitle = bodyLines[0] || "";
                                                        if (bodyLines.length > 1) {
                                                            cardTextDesc = bodyLines.slice(1).join("\n").replace(/^"|"$/g, "").trim();
                                                        }
                                                    }
                                                }
                                            }


                                            return (
                                                <motion.div 
                                                    key={msg.message_id || idx}
                                                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    transition={{ 
                                                        type: 'spring',
                                                        stiffness: 400,
                                                        damping: 28,
                                                        mass: 0.8
                                                    }}
                                                    className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isSelf ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                                                >
                                                    {/* Avatar */}
                                                    {!isSelf && (
                                                        <div className="shrink-0 mb-1">
                                                            {hasAvatar ? (
                                                                <img src={msg.profile_image_url} alt={msg.user_name} className="w-5 h-5 rounded-md object-cover border border-[#d0d7de] dark:border-[#30363d]" />
                                                            ) : (
                                                                <div className="w-5 h-5 rounded-md bg-[#e0f2fe] dark:bg-[#21262d] text-[#0550ae] dark:text-[#58a6ff] flex items-center justify-center font-bold text-[8px] border border-[#d0d7de] dark:border-[#30363d]">
                                                                    {msg.user_name?.charAt(0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="flex flex-col">
                                                        {/* Sender name for groups */}
                                                        {!isSelf && selectedRoom.room_type === 'group' && (
                                                            <span className="text-[9px] text-[#57606a] dark:text-[#8b949e] font-bold ml-1.5 mb-0.5">{msg.user_name}</span>
                                                        )}

                                                        {/* Message bubble */}
                                                        {(() => {
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
                                                                <div className={`py-2 px-3.5 rounded-lg text-xs leading-normal relative transition-all duration-300 ${
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
                                                                        ? 'bg-[#bae6fd] text-[#0550ae] dark:bg-[#388bfd]/20 dark:text-[#58a6ff] dark:border dark:border-[#388bfd]/30 rounded-br-none' 
                                                                        : matchesMention
                                                                            ? 'bg-[#fff8c5] dark:bg-[#382314] border border-[#d4a72c] dark:border-[#9e6a03] text-[#735c0f] dark:text-[#f1e05a] rounded-bl-none font-semibold'
                                                                            : 'bg-[#f6f8fa] dark:bg-[#161b22] text-[#24292f] dark:text-[#f0f6fc] border border-[#d0d7de] dark:border-[#30363d] rounded-bl-none'
                                                                }`}>
                                                                    
                                                                    {/* Text formatting with mentions styling */}
                                                                    {isSystemCard ? (
                                                                        <div className="flex flex-col gap-2.5 min-w-[250px] max-w-sm">
                                                                            {/* Header Badge */}
                                                                            <div className="flex items-center justify-between border-b border-slate-100/10 dark:border-white/10 pb-1.5">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    {cardType === 'leave_request' && <Calendar size={12} className="shrink-0" />}
                                                                                    {cardType === 'correction_request' && <Clock size={12} className="shrink-0" />}
                                                                                    {cardType === 'shift_assign' && <Clock size={12} className="shrink-0" />}
                                                                                    {cardType === 'geofence_assign' && <MapPin size={12} className="shrink-0" />}
                                                                                    <span className={`text-[9px] font-black uppercase tracking-wider ${
                                                                                        cardType === 'leave_request'
                                                                                            ? 'text-[#0369a1] dark:text-[#388bfd]'
                                                                                            : cardType === 'correction_request'
                                                                                                ? 'text-[#b45309] dark:text-[#f59e0b]'
                                                                                                : cardType === 'shift_assign'
                                                                                                    ? 'text-[#047857] dark:text-[#34d399]'
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

                                                                            {/* Content Block */}
                                                                            <div className="flex flex-col gap-1.5 text-left">
                                                                                {cardPayload ? (
                                                                                    <>
                                                                                        {/* LEAVE DETAILS */}
                                                                                        {cardType === 'leave_request' && (
                                                                                            <>
                                                                                                <h5 className="font-extrabold text-[11px] uppercase tracking-wide">
                                                                                                    {cardPayload.employee_name || cardPayload.reviewer_name} : {cardPayload.leave_type}
                                                                                                </h5>
                                                                                                <div className="text-[10px] space-y-0.5">
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

                                                                                        {/* CORRECTION DETAILS */}
                                                                                        {cardType === 'correction_request' && (
                                                                                            <>
                                                                                                <h5 className="font-extrabold text-[11px] uppercase tracking-wide">
                                                                                                    {cardPayload.employee_name || cardPayload.reviewer_name} : {cardPayload.correction_type}
                                                                                                </h5>
                                                                                                <div className="text-[10px] space-y-0.5">
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
                                                                                                                <div key={sIdx} className="bg-black/5 dark:bg-black/20 p-1 rounded text-[9px] border border-black/5">
                                                                                                                    Session {sIdx + 1}: {sess.time_in ? formatTimePretty(sess.time_in) : '-'} to {sess.time_out ? formatTimePretty(sess.time_out) : '-'}
                                                                                                                </div>
                                                                                                            ))}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            </>
                                                                                        )}

                                                                                        {/* SHIFT DETAILS */}
                                                                                        {cardType === 'shift_assign' && (
                                                                                            <>
                                                                                                <h5 className="font-extrabold text-[11px] uppercase tracking-wide">
                                                                                                    Shift Assigned
                                                                                                </h5>
                                                                                                <div className="text-[10px] space-y-0.5">
                                                                                                    <div><span className="font-bold">Assigner:</span> {cardPayload.admin_name}</div>
                                                                                                    <div><span className="font-bold">Shift name:</span> {cardPayload.shift_name}</div>
                                                                                                    <div><span className="font-bold">Timings:</span> {cardPayload.start_time} to {cardPayload.end_time}</div>
                                                                                                    <div><span className="font-bold">Grace Allowed:</span> {cardPayload.grace_period_mins} mins</div>
                                                                                                </div>
                                                                                            </>
                                                                                        )}

                                                                                        {/* GEOFENCE DETAILS */}
                                                                                        {cardType === 'geofence_assign' && (
                                                                                            <>
                                                                                                <h5 className="font-extrabold text-[11px] uppercase tracking-wide">
                                                                                                    Work Location Assigned
                                                                                                </h5>
                                                                                                <div className="text-[10px] space-y-0.5">
                                                                                                    <div><span className="font-bold">Assigner:</span> {cardPayload.admin_name}</div>
                                                                                                    <div><span className="font-bold">Site:</span> {cardPayload.location_name}</div>
                                                                                                    <div><span className="font-bold">Address:</span> {cardPayload.address}</div>
                                                                                                    <div><span className="font-bold">Radius boundary:</span> {cardPayload.radius} meters</div>
                                                                                                </div>
                                                                                            </>
                                                                                        )}

                                                                                        {/* ATTACHMENTS (DOCUMENTS) */}
                                                                                        {cardPayload.attachments && cardPayload.attachments.length > 0 && (
                                                                                            <div className="mt-2 pt-1.5 border-t border-slate-400/20">
                                                                                                <div className="font-bold text-[9px] uppercase tracking-wider mb-1 opacity-80">Documents:</div>
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
                                                                                    /* LEGACY PLAIN TEXT FALLBACK */
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

                                                                            {/* Deep Link Redirection Button */}
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
                                                                                className={`mt-1.5 py-1 px-3 rounded text-[10px] font-bold text-center border active:scale-95 transition-all cursor-pointer ${
                                                                                    cardType === 'leave_request'
                                                                                        ? 'bg-[#0284c7] hover:bg-[#0369a1] text-white border-transparent'
                                                                                        : cardType === 'correction_request'
                                                                                            ? 'bg-[#d97706] hover:bg-[#b45309] text-white border-transparent'
                                                                                            : cardType === 'shift_assign'
                                                                                                ? 'bg-[#059669] hover:bg-[#047857] text-white border-transparent'
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
                                                                            {/* Label/Header */}
                                                                            <div className="flex items-center gap-1.5 border-b border-slate-100/10 dark:border-white/10 pb-1">
                                                                                <span className={`text-[9px] font-black uppercase tracking-wider ${isSelf ? 'text-[#0550ae] dark:text-[#58a6ff]' : 'text-[#0550ae] dark:text-[#58a6ff]'}`}>
                                                                                    {previewType}
                                                                                </span>
                                                                            </div>
                                                                            
                                                                            {/* Title & Body Card */}
                                                                            <div className="flex flex-col gap-1">
                                                                                <h5 className="font-extrabold text-xs tracking-wide uppercase">
                                                                                    {previewTitle}
                                                                                </h5>
                                                                                {previewDesc && (
                                                                                    <p className={`text-[11px] leading-relaxed border-l-2 pl-2 mt-0.5 ${
                                                                                        isSelf ? 'border-sky-600/30 text-[#044e95] dark:text-blue-100 dark:border-white/30' : 'border-blue-500/30 text-[#57606a] dark:text-[#8b949e]'
                                                                                    }`}>
                                                                                        {(() => {
                                                                                            const parts = previewDesc.split(/(@[a-zA-Z0-9\s._-]+)/g);
                                                                                            return parts.map((part, i) => {
                                                                                                if (part.startsWith('@')) {
                                                                                                    return (
                                                                                                        <span key={i} className={`px-1 py-0.5 rounded font-bold ${
                                                                                                            isSelf 
                                                                                                            ? 'bg-[#0550ae] dark:bg-[#388bfd]/30 text-white dark:text-[#58a6ff]' 
                                                                                                            : 'bg-[#e0f2fe] dark:bg-[#388bfd]/15 text-[#0550ae] dark:text-[#58a6ff] border border-[#7dd3fc]/30 dark:border-[#388bfd]/30'
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
                                                                                <span className="whitespace-pre-wrap font-medium block">
                                                                                    {(() => {
                                                                                        // Convert @Names to stylized pills inside message bubble
                                                                                        const parts = msg.message_text.split(/(@[a-zA-Z0-9\s._-]+)/g);
                                                                                        return parts.map((part, i) => {
                                                                                            if (part.startsWith('@')) {
                                                                                                return (
                                                                                                    <span key={i} className={`px-1.5 py-0.5 rounded font-bold ${
                                                                                                        isSelf 
                                                                                                        ? 'bg-[#0550ae] dark:bg-[#388bfd]/30 text-white dark:text-[#58a6ff]' 
                                                                                                        : 'bg-[#e0f2fe] dark:bg-[#388bfd]/15 text-[#0550ae] dark:text-[#58a6ff] border border-[#7dd3fc]/30 dark:border-[#388bfd]/30'
                                                                                                    }`}>
                                                                                                        {part}
                                                                                                    </span>
                                                                                                );
                                                                                            }
                                                                                            return part;
                                                                                        });
                                                                                    })()}
                                                                                </span>
                                                                            )}
 
                                                                            {msg.attachment && (
                                                                                <div className={`mt-2 mb-1 p-2 rounded-md border flex items-center justify-between gap-3 min-w-[200px] max-w-sm ${
                                                                                    isSelf 
                                                                                    ? 'bg-[#bae6fd]/30 dark:bg-[#21262d] border-[#7dd3fc]/30 dark:border-[#30363d] text-[#0550ae] dark:text-[#f0f6fc]' 
                                                                                    : 'bg-[#f6f8fa] dark:bg-[#161b22] border-[#d0d7de] dark:border-[#30363d] text-[#24292f] dark:text-[#c9d1d9]'
                                                                                }`}>
                                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                                        {msg.attachment.type.startsWith('image/') ? (
                                                                                            <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer" className="shrink-0 relative group overflow-hidden rounded-md border border-white/10">
                                                                                                <img src={msg.attachment.url} alt={msg.attachment.name} className="w-12 h-12 object-cover transition-transform group-hover:scale-110" />
                                                                                            </a>
                                                                                        ) : (
                                                                                            <FileText size={24} className={isSelf ? 'text-[#0550ae] dark:text-[#58a6ff] shrink-0' : 'text-[#0550ae] dark:text-[#58a6ff] shrink-0'} />
                                                                                        )}
                                                                                        <div className="truncate">
                                                                                            <span className="text-[11px] font-bold block truncate">{msg.attachment.name}</span>
                                                                                            <span className={`text-[9px] font-semibold uppercase ${isSelf ? 'text-[#0550ae]/70 dark:text-[#8b949e]' : 'text-[#57606a] dark:text-[#8b949e]'}`}>
                                                                                                {formatFileSize(msg.attachment.size)}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <a 
                                                                                        href={msg.attachment.url} 
                                                                                        target="_blank" 
                                                                                        rel="noopener noreferrer"
                                                                                        download={msg.attachment.name}
                                                                                        className={`p-1.5 rounded-md border transition-all ${
                                                                                            isSelf 
                                                                                            ? 'bg-[#bae6fd] dark:bg-[#30363d] border-[#7dd3fc]/30 dark:border-[#8b949e]/30 text-[#0550ae] dark:text-[#c9d1d9] hover:bg-[#bde0fe] dark:hover:bg-[#21262d]' 
                                                                                            : 'bg-white dark:bg-[#21262d] border-[#d0d7de] dark:border-[#30363d] text-[#57606a] dark:text-[#8b949e] hover:bg-[#eaeef2] dark:hover:bg-[#30363d]'
                                                                                        }`}
                                                                                        title="Download File"
                                                                                    >
                                                                                        <Download size={14} />
                                                                                    </a>
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    )}
 
                                                                    {/* Timestamp and ticks inside bubble */}
                                                                    <div className="flex items-center justify-end gap-1 text-[8px] mt-1.5 opacity-60">
                                                                        <span>
                                                                            {formatLocalTime(msg.created_at)}
                                                                        </span>
                                                                        {isSelf && (
                                                                            msg.status === 'sending' ? (
                                                                                <Clock size={10} className="text-[#0550ae] dark:text-[#58a6ff] animate-spin opacity-85 shrink-0" style={{ animationDuration: '2.5s' }} />
                                                                            ) : msg.status === 'failed' ? (
                                                                                <span className="text-red-300 font-black" title="Failed to send">!</span>
                                                                            ) : (
                                                                                <CheckCheck size={10} className="text-[#0550ae] dark:text-[#58a6ff] opacity-85 shrink-0" />
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input Panel */}
                            <div className="p-4 bg-[#f0f9ff]/40 dark:bg-[#0d1117] border-t border-[#d0d7de] dark:border-[#30363d] relative shrink-0">
                                
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
                                                    className="absolute left-4 right-4 bottom-full mb-3 bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-md shadow-2xl z-50 overflow-hidden py-1 max-h-48"
                                                >
                                                    <div className="px-3 py-1.5 text-[9px] font-black uppercase text-[#57606a] dark:text-[#8b949e] bg-[#f6f8fa] dark:bg-[#0d1117] border-b border-[#d0d7de] dark:border-[#30363d] tracking-wider">
                                                        Mention Team Member
                                                    </div>
                                                    {filtered.map(u => (
                                                        <button
                                                            key={u.user_id}
                                                            type="button"
                                                            onClick={() => handleMentionSelect(u)}
                                                            className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-[#f6f8fa] dark:hover:bg-[#21262d] transition-colors border-none bg-transparent cursor-pointer"
                                                        >
                                                            {u.profile_image_url ? (
                                                                <img src={u.profile_image_url} alt={u.user_name} className="w-6 h-6 rounded-md object-cover border border-[#d0d7de] dark:border-[#30363d]" />
                                                            ) : (
                                                                <div className="w-6 h-6 rounded-md bg-[#e0f2fe] dark:bg-[#21262d] text-[#0550ae] dark:text-[#58a6ff] flex items-center justify-center font-bold text-[10px] border border-[#d0d7de] dark:border-[#30363d]">
                                                                    {u.user_name.charAt(0)}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <div className="font-bold text-xs text-[#24292f] dark:text-[#c9d1d9]">{u.user_name}</div>
                                                                <div className="text-[9px] text-[#57606a] dark:text-[#8b949e]">{u.dept_name || 'Staff'} • {u.desg_name || 'Member'}</div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            );
                                        })()
                                    )}
                                </AnimatePresence>
 
                                {pendingAttachment && (
                                    <div className="px-3 py-2 bg-[#f0f9ff] dark:bg-[#388bfd]/10 border border-[#7dd3fc]/40 dark:border-[#388bfd]/30 rounded-md flex items-center justify-between gap-3 mb-3 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <FileText size={18} className="text-[#0550ae] dark:text-[#58a6ff] shrink-0" />
                                            <div className="truncate">
                                                <span className="text-xs font-bold text-[#24292f] dark:text-[#c9d1d9] block truncate">{pendingAttachment.name}</span>
                                                <span className="text-[9px] text-[#0550ae] dark:text-[#8b949e] font-semibold uppercase">{formatFileSize(pendingAttachment.size)}</span>
                                            </div>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setPendingAttachment(null)}
                                            className="p-1 hover:bg-[#eaeef2] dark:hover:bg-[#21262d] rounded-full text-[#57606a] hover:text-[#24292f] dark:hover:text-[#c9d1d9] transition-colors border-none bg-transparent cursor-pointer"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
 
                                <form onSubmit={handleSend} className="flex items-center gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2 hover:bg-[#eaeef2] dark:hover:bg-[#21262d] text-[#57606a] dark:text-[#8b949e] rounded-md transition-colors border-none bg-transparent cursor-pointer"
                                        title="Upload attachment (max 50MB)"
                                    >
                                        <Paperclip size={18} />
                                    </button>
                                    <input 
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        onChange={handleFileUpload}
                                    />
 
                                    {/* Text Area Input */}
                                    <input 
                                        ref={chatInputRef}
                                        type="text"
                                        placeholder="Type a message... Use @ to tag people"
                                        value={newMessageText}
                                        onChange={(e) => handleInputChange(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-white dark:bg-[#010409] rounded-md border border-[#d0d7de] dark:border-[#30363d] focus:outline-none focus:border-[#7dd3fc] focus:ring-1 focus:ring-[#7dd3fc] dark:focus:border-[#388bfd] dark:focus:ring-1 dark:focus:ring-[#388bfd] text-xs font-semibold text-[#24292f] dark:text-[#f0f6fc] placeholder-[#8c959f] dark:placeholder-[#484f58] shadow-inner"
                                    />
 
                                    {/* Send Trigger */}
                                    <button 
                                        type="submit"
                                        disabled={!newMessageText.trim() && !pendingAttachment}
                                        className={`p-2.5 rounded-md transition-all active:scale-95 cursor-pointer flex items-center justify-center border ${
                                            newMessageText.trim() || pendingAttachment
                                            ? 'bg-[#bae6fd] dark:bg-[#238636] text-[#0550ae] dark:text-white border border-[#7dd3fc]/30 dark:border-transparent hover:bg-[#bde0fe] dark:hover:bg-[#2ea44f] shadow-sm' 
                                            : 'bg-[#f6f8fa] text-[#8c959f] dark:bg-[#21262d] dark:text-[#484f58] border-[#d0d7de] dark:border-[#30363d] cursor-not-allowed shadow-none'
                                        }`}
                                    >
                                        <Send size={14} />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        // Blank state visual mockup
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#f6f8fa]/50 dark:bg-[#010409]/20">
                            <div className="relative mb-6">
                                <div className="w-16 h-16 rounded-xl bg-[#e0f2fe] dark:bg-[#388bfd]/10 text-[#0550ae] dark:text-[#58a6ff] flex items-center justify-center mb-3 border border-[#7dd3fc]/20 dark:border-[#388bfd]/20 animate-bounce">
                                    <MessageSquare size={28} />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-md bg-[#e0f2fe] dark:bg-[#388bfd]/30 text-[#0550ae] dark:text-[#58a6ff] flex items-center justify-center shadow-lg border border-[#7dd3fc]/10 dark:border-transparent">
                                    <Plus size={12} />
                                </div>
                            </div>
                            
                            <h3 className="text-xs font-black text-[#24292f] dark:text-[#c9d1d9] tracking-wider uppercase mb-1">Collaboration Hub</h3>
                            <p className="text-[11px] text-[#57606a] dark:text-[#8b949e] max-w-sm leading-relaxed mb-6">Connect with team members inside your organization. Make group channels, tag people like Instagram, and keep updates synchronized instantly.</p>
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button 
                                    onClick={openDmModal}
                                    className="px-4 py-2 bg-[#f6f8fa] dark:bg-[#21262d] border border-[#d0d7de] dark:border-[#30363d] text-[#24292f] dark:text-[#c9d1d9] rounded-md text-xs font-bold shadow-sm transition-all hover:bg-[#eaeef2] dark:hover:bg-[#30363d] cursor-pointer"
                                >
                                    Start Direct Chat
                                </button>
                                <button 
                                    onClick={openGroupModal}
                                    className="px-4 py-2 bg-[#2ea44f] hover:bg-[#2c974b] dark:bg-[#238636] dark:hover:bg-[#2ea44f] text-white border border-[#1b1f23]/15 rounded-md text-xs font-bold shadow-sm transition-all cursor-pointer"
                                >
                                    Create Group Channel
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- MODAL A: DIRECT MESSAGE INITIATOR --- */}
                <AnimatePresence>
                    {showDmModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-md bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded-md overflow-hidden shadow-2xl"
                            >
                                <div className="p-4 border-b border-[#d0d7de] dark:border-[#30363d] flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-[#24292f] dark:text-[#c9d1d9] uppercase tracking-wider">New Conversation</h3>
                                    <button onClick={() => setShowDmModal(false)} className="p-1 hover:bg-[#eaeef2] dark:hover:bg-[#21262d] rounded-md text-[#57606a] dark:text-[#8b949e] border-none bg-transparent cursor-pointer"><X size={16} /></button>
                                </div>

                                {/* Search Input for Coworkers */}
                                <div className="px-4 pt-3 pb-1 shrink-0">
                                    <div className="relative">
                                        <input 
                                            type="text"
                                            placeholder="Search coworkers..."
                                            value={dmSearchQuery}
                                            onChange={(e) => setDmSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-[#010409] rounded-md border border-[#d0d7de] dark:border-[#30363d] focus:outline-none focus:border-[#7dd3fc] focus:ring-1 focus:ring-[#7dd3fc] dark:focus:border-[#388bfd] dark:focus:ring-1 dark:focus:ring-[#388bfd] text-[#24292f] dark:text-[#c9d1d9] placeholder-[#8c959f] dark:placeholder-[#484f58]"
                                        />
                                        <Search size={14} className="absolute left-3 top-2.5 text-[#8c959f]" />
                                    </div>
                                </div>
                                
                                <div className="p-4 max-h-[300px] overflow-y-auto space-y-2.5 custom-scrollbar">
                                    <p className="text-[10px] text-[#57606a] dark:text-[#8b949e] font-bold uppercase tracking-wider mb-2">Select a coworker</p>
                                    {(() => {
                                        const filteredDmCoworkers = coworkers.filter(colleague => 
                                            colleague.user_name.toLowerCase().includes(dmSearchQuery.toLowerCase()) ||
                                            colleague.dept_name?.toLowerCase().includes(dmSearchQuery.toLowerCase()) ||
                                            colleague.desg_name?.toLowerCase().includes(dmSearchQuery.toLowerCase())
                                        );

                                        if (filteredDmCoworkers.length === 0) {
                                            return <p className="text-xs text-[#57606a] dark:text-[#8b949e] italic text-center py-8">No matching coworkers found.</p>;
                                        }

                                        return filteredDmCoworkers.map((colleague) => (
                                            <button
                                                key={colleague.user_id}
                                                onClick={() => initiateDM(colleague)}
                                                className="w-full p-2 text-left hover:bg-[#f6f8fa] dark:hover:bg-[#161b22] focus:bg-[#f6f8fa] dark:focus:bg-[#161b22] focus:outline-none rounded-md flex items-center gap-3 border-none bg-transparent cursor-pointer transition-colors"
                                            >
                                                {colleague.profile_image_url ? (
                                                    <img src={colleague.profile_image_url} alt={colleague.user_name} className="w-8 h-8 rounded-md object-cover shrink-0 border border-[#d0d7de] dark:border-[#30363d]" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-md bg-[#bae6fd] dark:bg-[#21262d] text-[#0550ae] dark:text-[#58a6ff] flex items-center justify-center font-bold text-xs shrink-0 border border-[#0550ae]/20 dark:border-[#30363d]">
                                                        {getInitials(colleague.user_name)}
                                                    </div>
                                                )}
                                                <div className="truncate">
                                                    <div className="font-bold text-xs text-[#24292f] dark:text-[#c9d1d9] truncate">{colleague.user_name}</div>
                                                    <div className="text-[9px] text-[#57606a] dark:text-[#8b949e] truncate">{colleague.dept_name || 'Staff'} • {colleague.desg_name || 'Member'}</div>
                                                </div>
                                            </button>
                                        ));
                                    })()}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* --- MODAL B: GROUP CREATION DIALOG --- */}
                <AnimatePresence>
                    {showGroupModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-md bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                            >
                                <div className="p-4 border-b border-[#d0d7de] dark:border-[#30363d] flex items-center justify-between shrink-0">
                                    <h3 className="text-sm font-bold text-[#24292f] dark:text-[#c9d1d9] uppercase tracking-wider">Create Group Channel</h3>
                                    <button onClick={() => setShowGroupModal(false)} className="p-1 hover:bg-[#eaeef2] dark:hover:bg-[#21262d] rounded-md text-[#57606a] dark:text-[#8b949e] border-none bg-transparent cursor-pointer"><X size={16} /></button>
                                </div>

                                <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                    {/* Group Name input */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-[#57606a] dark:text-[#8b949e] tracking-wider">Group Name</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Project Sync"
                                            value={groupName}
                                            onChange={(e) => setGroupName(e.target.value)}
                                            className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-[#010409] rounded-md border border-[#d0d7de] dark:border-[#30363d] text-[#24292f] dark:text-[#c9d1d9] focus:outline-none focus:border-[#7dd3fc] focus:ring-1 focus:ring-[#7dd3fc] dark:focus:border-[#388bfd] dark:focus:ring-1 dark:focus:ring-[#388bfd]"
                                        />
                                    </div>

                                    {/* Members selection */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-[#57606a] dark:text-[#8b949e] tracking-wider">Select Team Members</label>
                                        
                                        {/* Search Input */}
                                        <div className="relative mb-2">
                                            <input 
                                                type="text"
                                                placeholder="Search members to add..."
                                                value={groupSearchQuery}
                                                onChange={(e) => setGroupSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-[#010409] rounded-md border border-[#d0d7de] dark:border-[#30363d] focus:outline-none focus:border-[#7dd3fc] focus:ring-1 focus:ring-[#7dd3fc] dark:focus:border-[#388bfd] dark:focus:ring-1 dark:focus:ring-[#388bfd] text-[#24292f] dark:text-[#c9d1d9] placeholder-[#8c959f] dark:placeholder-[#484f58]"
                                            />
                                            <Search size={14} className="absolute left-3 top-2.5 text-[#8c959f]" />
                                        </div>

                                        <div className="space-y-2 max-h-[180px] overflow-y-auto p-1 custom-scrollbar">
                                            {(() => {
                                                const filteredGroupCoworkers = coworkers.filter(colleague => 
                                                    colleague.user_name.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
                                                    colleague.dept_name?.toLowerCase().includes(groupSearchQuery.toLowerCase())
                                                );

                                                if (filteredGroupCoworkers.length === 0) {
                                                    return <p className="text-xs text-[#57606a] dark:text-[#8b949e] italic text-center py-4">No matching members found.</p>;
                                                }

                                                return filteredGroupCoworkers.map((colleague) => {
                                                    const isChecked = selectedGroupMembers.includes(colleague.user_id);
                                                    return (
                                                        <button
                                                            key={colleague.user_id}
                                                            type="button"
                                                            onClick={() => toggleMemberSelection(colleague.user_id)}
                                                            className={`w-full p-2 rounded-md flex items-center justify-between cursor-pointer border transition-colors focus:bg-[#f6f8fa] dark:focus:bg-[#21262d] focus:outline-none ${
                                                                isChecked 
                                                                ? 'bg-[#e0f2fe] dark:bg-[#388bfd]/10 border-[#7dd3fc]/30 dark:border-[#388bfd]/30 text-[#0550ae] dark:text-[#58a6ff]' 
                                                                : 'hover:bg-[#f6f8fa] dark:hover:bg-[#21262d] border-transparent bg-transparent'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3 truncate text-left">
                                                                {colleague.profile_image_url ? (
                                                                    <img src={colleague.profile_image_url} alt={colleague.user_name} className="w-8 h-8 rounded-md object-cover shrink-0 border border-[#d0d7de] dark:border-[#30363d]" />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-md bg-[#e0f2fe] dark:bg-[#21262d] text-[#0550ae] dark:text-[#58a6ff] flex items-center justify-center font-bold text-xs shrink-0 border border-[#d0d7de] dark:border-[#30363d]">
                                                                        {getInitials(colleague.user_name)}
                                                                    </div>
                                                                )}
                                                                <div className="truncate">
                                                                    <div className="font-bold text-xs text-[#24292f] dark:text-[#c9d1d9] truncate">{colleague.user_name}</div>
                                                                    <div className="text-[9px] text-[#57606a] dark:text-[#8b949e] truncate">{colleague.dept_name || 'Staff'}</div>
                                                                </div>
                                                            </div>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isChecked}
                                                                readOnly
                                                                className="rounded text-[#0550ae] dark:text-[#388bfd] focus:ring-[#0550ae] dark:focus:ring-[#388bfd] w-4 h-4 mr-2 cursor-pointer"
                                                            />
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-t border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#010409] flex items-center justify-end gap-3 shrink-0">
                                    <button 
                                        onClick={() => setShowGroupModal(false)}
                                        className="px-4 py-2 border border-[#d0d7de] dark:border-[#30363d] text-[#24292f] dark:text-[#c9d1d9] text-xs font-bold rounded-md hover:bg-[#eaeef2] dark:hover:bg-[#21262d] cursor-pointer bg-white dark:bg-[#0d1117]"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleCreateGroup}
                                        className="px-4 py-2 bg-[#2ea44f] hover:bg-[#2c974b] dark:bg-[#238636] dark:hover:bg-[#2ea44f] text-white text-xs font-bold rounded-md border border-[#1b1f23]/15 shadow-sm cursor-pointer"
                                    >
                                        Create Group
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            </div>
        </DashboardLayout>
    );
};

export default ChatPage;
