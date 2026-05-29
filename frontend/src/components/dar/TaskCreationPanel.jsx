import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { X, Plus, Clock, AlertCircle, Trash2, Calendar, ChevronLeft, ChevronRight, Video, MapPin, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import MiniCalendar from '../dar/MiniCalendar';
import MobileConfirmModal from '../MobileConfirmModal';

const TaskCreationPanel = ({ onClose, onUpdate, initialTimeIn = "09:30", attendanceIntervals = [], highlightTaskId, initialDate, lastCreateRequest, onDateChange, isAbsent = false, draftTasks, onDraftUpdate }) => {


    // Helper to add minutes to HH:MM time
    const addMinutes = (timeStr, minutes) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m + minutes);
        return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    };

    // Helper: check if t1 < t2
    const isBefore = (t1, t2) => {
        if (!t1 || !t2) return false;
        return t1.localeCompare(t2) < 0;
    };

    const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);

    // Sync state with prop if it changes
    useEffect(() => {
        if (initialDate) setDate(initialDate);
    }, [initialDate]);

    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarPos, setCalendarPos] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);

    const toggleCalendar = () => {
        if (!showCalendar && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setCalendarPos({
                top: rect.bottom + 8,
                left: rect.left
            });
        }
        setShowCalendar(!showCalendar);
    };

    const [inputs, setInputs] = useState([]);
    const [availableCategories, setAvailableCategories] = useState(['General']);
    const [hasScrolled, setHasScrolled] = useState(false);
    const today = new Date().toISOString().split('T')[0];
    const isPastDate = date < today;

    const [showReasonModal, setShowReasonModal] = useState(false);
    const [reason, setReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [openCategoryIdx, setOpenCategoryIdx] = useState(null);
    const dropdownRef = useRef(null);

    // --- MENTIONS SYSTEM STATE & LOGIC ---
    const [orgUsers, setOrgUsers] = useState([]);
    const [activeMentionIdx, setActiveMentionIdx] = useState(null);
    const [mentionSearch, setMentionSearch] = useState('');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await api.get('/collaboration/users');
                if (res.data.success) {
                    setOrgUsers(res.data.data);
                }
            } catch (err) {
                console.warn("Failed to load organization directory for mentions", err);
            }
        };
        fetchUsers();
    }, []);

    const handleDescriptionChange = (index, value) => {
        handleInputChange(index, 'description', value);
        
        const lastAtIndex = value.lastIndexOf('@');
        if (lastAtIndex !== -1 && (lastAtIndex === 0 || value[lastAtIndex - 1] === ' ')) {
            const search = value.substring(lastAtIndex + 1);
            if (search.length < 20 && !search.includes('\n')) {
                setActiveMentionIdx(index);
                setMentionSearch(search);
            } else {
                setActiveMentionIdx(null);
                setMentionSearch('');
            }
        } else {
            setActiveMentionIdx(null);
            setMentionSearch('');
        }
    };

    const insertMention = (index, user) => {
        const task = inputs[index];
        if (!task) return;
        const val = task.description || '';
        const lastAtIndex = val.lastIndexOf('@');
        const prefix = val.substring(0, lastAtIndex);
        const newVal = `${prefix}@${user.user_name} `;
        handleInputChange(index, 'description', newVal);
        setActiveMentionIdx(null);
        setMentionSearch('');
    };

    // --- CONFIRM MODAL STATE ---
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => {},
        confirmText: 'Confirm'
    });

    // Handle physical back button to close panel and its modals
    useEffect(() => {
        const handlePopState = () => {
            if (showCalendar) {
                setShowCalendar(false);
                return;
            }
            if (showReasonModal) {
                setShowReasonModal(false);
                return;
            }
            if (confirmModal.isOpen) {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                return;
            }
            // If nothing else is open, close the panel itself
            onClose();
        };

        const isAnyThingOpen = true; // The panel itself is open

        if (isAnyThingOpen) {
            window.history.pushState({ panelOpen: true }, '');
            window.addEventListener('popstate', handlePopState);
        }

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [showCalendar, showReasonModal, confirmModal.isOpen, onClose]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpenCategoryIdx(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSaveClick = async () => {
        // Filter for unsaved OR (Today + Planned) tasks
        // This logic forces 'PLANNED' tasks to be re-submitted for validation when execution day arrives
        const todayStr = new Date().toISOString().split('T')[0];
        const isToday = date === todayStr;

        const tasksToSave = inputs.filter(t =>
            !t.isSaved || (isToday && t.status === 'PLANNED')
        );

        if (tasksToSave.length === 0) {
            onClose();
            return;
        }

        if (isPastDate) {
            setShowReasonModal(true);
            return;
        }

        // Submit sequentially (Normal Flow)
        for (const task of tasksToSave) {
            try {
                if (task.type === 'TASK') {
                    const payload = {
                        title: task.title || "Untitled Task",
                        description: task.description,
                        start_time: task.startTime,
                        end_time: task.endTime,
                        activity_date: date,
                        activity_type: (task.category || 'General').toUpperCase(),
                        status: date > todayStr ? 'PLANNED' : 'COMPLETED'
                    };
                    const isExisting = task.id && !String(task.id).startsWith('new-');
                    if (isExisting) {
                        await api.put(`/dar/activities/update/${task.id}`, payload);
                    } else {
                        await api.post('/dar/activities/create', payload);
                    }
                } else {
                    // MEETING or EVENT
                    const payload = {
                        title: task.title || `Unnamed ${task.type.toLowerCase()}`,
                        description: task.description,
                        start_time: task.startTime,
                        end_time: task.endTime,
                        event_date: date,
                        type: task.type,
                        location: task.locationType === 'online' ? task.meetLink : task.address
                    };
                    const isExisting = task.id && !String(task.id).startsWith('new-');
                    if (isExisting) {
                        await api.put(`/dar/events/update/${task.id}`, payload);
                    } else {
                        await api.post('/dar/events/create', payload);
                    }
                }
            } catch (err) {
                setConfirmModal({
                    isOpen: true,
                    title: 'Save Failed',
                    message: `Failed to save "${task.title}": ${err.response?.data?.message || err.message}`,
                    type: 'warning',
                    confirmText: 'Dismiss',
                    onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                });
                return; // Stop on error
            }
        }

        // If all success
        toast.success("Daily tasks saved successfully!");
        if (onDraftUpdate) onDraftUpdate(null); // Clear drafts on successful save
        onClose();
    };

    const handleSubmitRequest = async () => {
        setIsSubmitting(true);
        try {
            const response = await api.post('/dar/requests/create', {
                request_date: date,
                original_data: (await api.get(`/dar/activities/list?date=${date}`)).data.data.map(a => ({
                    id: a.activity_id,
                    title: a.title,
                    description: a.description,
                    start_time: a.start_time,
                    end_time: a.end_time,
                    activity_type: a.activity_type
                })),
                proposed_data: inputs.map(t => ({
                    id: t.id && !t.id.toString().startsWith('new-') ? t.id : undefined,
                    title: t.title,
                    description: t.description,
                    start_time: t.startTime,
                    end_time: t.endTime,
                    activity_type: (t.category || 'General').toUpperCase()
                })),
                reason: reason // Send reason
            });

            if (response.data.ok) {
                toast.success("Request submitted to Admin!");
                setShowReasonModal(false);
                if (onDraftUpdate) onDraftUpdate(null); // Clear drafts
                onClose();
            }
        } catch (err) {
            console.error(err);
            setConfirmModal({
                isOpen: true,
                title: 'Submission Error',
                message: "Failed to submit request: " + (err.response?.data?.message || err.message),
                type: 'warning',
                confirmText: 'Retry',
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset scroll flag when highlighting a new task
    useEffect(() => {
        setHasScrolled(false);
    }, [highlightTaskId]);

    // Auto-scroll to highlight (Only once per task)
    useEffect(() => {
        if (highlightTaskId && !hasScrolled && inputs.length > 0) {
            // Slight delay to ensure DOM is ready
            const timer = setTimeout(() => {
                const el = document.getElementById(`task-card-${highlightTaskId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setHasScrolled(true);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [highlightTaskId, inputs, hasScrolled]);

    useEffect(() => {
        const fetchActivitiesAndSettings = async () => {
            try {
                // 1. Process Activities, Events, and Settings
                const [actRes, evtRes, setRes] = await Promise.all([
                    api.get(`/dar/activities/list?date=${date}`),
                    api.get(`/dar/events/list`, { params: { date_from: date, date_to: date } }),
                    api.get('/dar/settings/list')
                ]);

                // Process Settings
                if (setRes.data.ok) {
                    const cats = setRes.data.data.categories;
                    if (Array.isArray(cats) && cats.length > 0) {
                        setAvailableCategories(cats);
                    }
                }

                const activities = actRes.data.data.map(a => ({
                    id: a.activity_id,
                    title: a.title,
                    description: a.description,
                    startTime: a.start_time ? a.start_time.slice(0, 5) : '',
                    endTime: a.end_time ? a.end_time.slice(0, 5) : '',
                    category: a.activity_type || 'General',
                    status: a.status,
                    type: 'TASK',
                    isValid: true,
                    isSaved: true
                }));

                const events = evtRes.data.data.map(e => {
                    const isUrl = /^(http|https):\/\/[^ "]+$/.test(e.location || '');
                    return {
                        id: e.event_id,
                        title: e.title,
                        description: e.description,
                        startTime: e.start_time ? e.start_time.slice(0, 5) : '',
                        endTime: e.end_time ? e.end_time.slice(0, 5) : '',
                        type: e.type.toUpperCase(),
                        locationType: isUrl ? 'online' : 'offline',
                        meetLink: isUrl ? e.location : '',
                        address: !isUrl ? e.location : '',
                        isValid: true,
                        isSaved: true
                    };
                });

                const combined = [...activities, ...events].sort((a, b) => a.startTime.localeCompare(b.startTime));

                if (draftTasks && draftTasks.length > 0) {
                    setInputs(draftTasks);
                } else {
                    setInputs(combined.length > 0 ? combined : [{
                        id: `new-${Date.now()}`,
                        title: '',
                        description: '',
                        startTime: initialTimeIn,
                        endTime: addMinutes(initialTimeIn, 60),
                        type: lastCreateRequest?.type || 'TASK',
                        locationType: 'online',
                        meetLink: '',
                        address: '',
                        isValid: true,
                        isSaved: false,
                        status: 'PENDING'
                    }]);
                }

            } catch (err) {
                console.error("Failed to fetch data", err);
            }
        };

        fetchActivitiesAndSettings();
    }, [initialTimeIn, date]);

    // Synergy with Quick Action Popup (Switch or Append)
    useEffect(() => {
        if (!lastCreateRequest || lastCreateRequest.timestamp === 0) return;

        // Find the first card to see if it's pristine
        const firstInput = inputs[0];
        const isFirstPristine = inputs.length === 1 &&
            (!firstInput.title || firstInput.title.trim() === '') &&
            (!firstInput.description || firstInput.description.trim() === '') &&
            !firstInput.isSaved;

        if (isFirstPristine) {
            // SWITCH: Just change the type of the first card
            handleInputChange(0, 'type', lastCreateRequest.type);
        } else {
            // APPEND: Add a new entry of that type
            const lastTask = inputs[inputs.length - 1];
            let nextStart = lastTask ? lastTask.endTime : initialTimeIn;
            let nextEnd = addMinutes(nextStart, 60);

            const newTask = {
                id: `new-${Date.now()}`,
                title: '',
                description: '',
                startTime: nextStart,
                endTime: nextEnd,
                type: lastCreateRequest.type,
                locationType: 'online',
                meetLink: '',
                address: '',
                isValid: true,
                error: null
            };

            setInputs(prev => [...prev, newTask]);
            // Scroll to bottom
            setTimeout(() => {
                const el = document.getElementById(`task-card-${newTask.id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [lastCreateRequest]);


    const handleInputChange = (index, field, value) => {
        const newInputs = [...inputs];
        let task = { ...newInputs[index], [field]: value, isSaved: false }; // Mark modified

        // Validation
        if (field === 'startTime') {
            if (isBefore(value, initialTimeIn)) {
                task.error = "Cannot start before Time In";
            } else {
                task.error = null;
            }
        }

        newInputs[index] = task;
        setInputs(newInputs);
        if (onDraftUpdate) onDraftUpdate(newInputs); // Sync draft to parent

        // Update Parent
        if (task.startTime && !task.error) {
            // Logic: If title is empty, send "Task X". Ensure description is passed.
            const displayTitle = task.title.trim() === '' ? `Task ${index + 1}` : task.title;

            onUpdate({
                id: task.id,
                title: displayTitle,
                description: task.description,
                startTime: task.startTime,
                endTime: task.endTime,
                type: task.type.toLowerCase(),
                category: task.category || 'General',
                status: task.status,
                location: task.locationType === 'online' ? task.meetLink : task.address,
                date: date
            });
        }
    };

    const handleAddAnother = () => {
        const lastTask = inputs[inputs.length - 1];
        let nextStart = lastTask ? lastTask.endTime : initialTimeIn;
        let nextEnd = addMinutes(nextStart, 60);

        const newTask = {
            id: `new-${inputs.length + Math.random().toString(36).substr(2, 5)}`,
            title: '',
            description: '',
            startTime: nextStart,
            endTime: nextEnd,
            type: 'TASK',
            isValid: true,
            error: null
        };

        const newIndex = inputs.length;
        const updatedInputs = [...inputs, newTask];
        setInputs(updatedInputs);

        onUpdate({
            id: newTask.id,
            title: `Task ${newIndex + 1}`,
            description: '',
            startTime: newTask.startTime,
            endTime: newTask.endTime,
            type: 'task',
            date: date
        });
        if (onDraftUpdate) onDraftUpdate(updatedInputs); // Sync draft to parent
    };

    const handleDelete = async (index) => {
        const task = inputs[index];
        // If it's saved in DB (has valid ID not starting with 'new-'), delete from DB
        const isExisting = task.id && !String(task.id).startsWith('new-');

        // Only delete via API if NOT in 'Past Date' mode. 
        // In Past Date mode, we just remove from UI list -> ProposedDiff will show Delete.
        if (isExisting && !isPastDate) {
            try {
                if (task.type === 'TASK') {
                    await api.delete(`/dar/activities/delete/${task.id}`);
                } else {
                    await api.delete(`/dar/events/delete/${task.id}`);
                }
            } catch (err) {
                setConfirmModal({
                    isOpen: true,
                    title: 'Delete Failed',
                    message: "Failed to delete entry: " + (err.response?.data?.message || err.message),
                    type: 'warning',
                    confirmText: 'Dismiss',
                    onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                });
                return;
            }
        }

        // Notify parent regardless of draft or DB delete
        onUpdate({ id: task.id, deleted: true, isDraftDelete: isPastDate || !isExisting });

        const newInputs = inputs.filter((_, i) => i !== index);
        setInputs(newInputs);
        if (onDraftUpdate) onDraftUpdate(newInputs); // Sync draft to parent
    };

    return (
        <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full h-full bg-white dark:bg-dark-card rounded-2xl shadow-xl border border-gray-200 dark:border-github-dark-border flex flex-col relative"
        >

            <div className="p-4 border-b border-gray-100 dark:border-github-dark-border flex flex-col gap-3 bg-white dark:bg-dark-card relative z-20 rounded-t-2xl">

                {/* Top Row: Title, Calendar, Close */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-github-dark-text tracking-tight">Daily Tasks</h3>

                        {/* Date Picker using MiniCalendar (Portal) */}
                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-github-dark-subtle/50 p-1 rounded-lg border border-gray-100 dark:border-github-dark-border/50">
                            {/* Prev Day */}
                            <button
                                onClick={() => {
                                    const d = new Date(date);
                                    d.setDate(d.getDate() - 1);
                                    const newDate = d.toISOString().split('T')[0];
                                    setDate(newDate);
                                    if (onDateChange) onDateChange(newDate);
                                }}
                                className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>

                            <div className="relative">
                                <button
                                    ref={buttonRef}
                                    onClick={toggleCalendar}
                                    className="flex items-center gap-2 px-2 py-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors group"
                                >
                                    <Calendar size={14} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-bold text-gray-700 dark:text-github-dark-text">
                                        {new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                    </span>
                                </button>

                                {showCalendar && createPortal(
                                    <div className="fixed inset-0 z-[9999] isolate">
                                        <div className="fixed inset-0 bg-transparent" onClick={() => setShowCalendar(false)} />
                                        <div
                                            className="fixed z-[10000] drop-shadow-2xl"
                                            style={{ top: calendarPos.top, left: calendarPos.left, maxWidth: '320px' }}
                                        >
                                            <MiniCalendar
                                                selectedDate={date}
                                                disableRange={true}
                                                onDateSelect={(range) => {
                                                    setDate(range.start);
                                                    setShowCalendar(false);
                                                    if (onDateChange) onDateChange(range.start);
                                                }}
                                            />
                                        </div>
                                    </div>,
                                    document.body
                                )}
                            </div>

                            {/* Next Day */}
                            <button
                                onClick={() => {
                                    const d = new Date(date);
                                    d.setDate(d.getDate() + 1);
                                    const newDate = d.toISOString().split('T')[0];
                                    setDate(newDate);
                                    if (onDateChange) onDateChange(newDate);
                                }}
                                className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Close Button (Minimal) */}
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Subtitle & Slots */}
                <div>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">Plan your day effectively</p>

                    {/* Active Sessions Grid (Sleek Dynamic Pills) */}
                    <div className="grid grid-cols-2 gap-2 w-full">
                        {attendanceIntervals.length > 0 ? (
                            attendanceIntervals.map((interval, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-800 transition-colors">
                                    <Clock size={14} />
                                    <span className="truncate">Slot: {interval.start} - {interval.end || 'Now'}</span>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 col-span-2">
                                <Clock size={14} />
                                <span>Not Timed In</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            {isAbsent ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                    <div className="mb-2.5 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-full">
                        <AlertCircle size={28} className="text-red-500" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-github-dark-text mb-1">Absent Day</h3>
                    <p className="text-[11px] text-slate-500 dark:text-github-dark-muted max-w-[200px]">
                        You were absent on this day. Submission is not allowed.
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">

                    {inputs.map((task, i) => (
                        <motion.div
                            layout
                            id={`task-card-${task.id}`}
                            key={task.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`group relative bg-white dark:bg-github-dark-subtle rounded-xl border transition-all p-3 flex flex-col gap-3 ${task.error ? 'border-red-200 ring-1 ring-red-100 dark:border-red-900/50 dark:ring-red-900/30' : 'border-gray-100 dark:border-github-dark-border hover:border-indigo-100 dark:hover:border-indigo-900 hover:shadow-sm'} ${highlightTaskId === task.id ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}
                        >
                            {/* Indicator Line */}
                            <div className={`absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full transition-colors ${task.error ? 'bg-red-400' : 'bg-gray-200 group-hover:bg-indigo-500'}`}></div>

                            {/* Top Row: Type Logic, TITLE & Actions */}
                            <div className="flex items-center justify-between gap-3 border-b border-gray-50 dark:border-github-dark-border/50 pb-2 mb-1">
                                <div className="flex items-center flex-1 min-w-0 gap-2">
                                    {/* Type Selector */}
                                    <div className="flex items-center bg-gray-100 dark:bg-slate-700 p-0.5 rounded-lg shrink-0">
                                        {(!lastCreateRequest || lastCreateRequest.type === 'TASK') && (
                                            <button
                                                onClick={() => handleInputChange(i, 'type', 'TASK')}
                                                className={`px-1.5 py-0.5 text-[9px] font-black rounded-md transition-all ${task.type === 'TASK' ? 'bg-white dark:bg-slate-600 text-indigo-600 shadow-sm' : 'text-gray-400 opacity-60'}`}
                                            >
                                                TASK
                                            </button>
                                        )}
                                        {(!lastCreateRequest || lastCreateRequest.type === 'MEETING' || lastCreateRequest.type === 'EVENT') && (
                                            <button
                                                onClick={() => handleInputChange(i, 'type', 'MEETING')}
                                                className={`px-1.5 py-0.5 text-[9px] font-black rounded-md transition-all ${task.type === 'MEETING' ? 'bg-white dark:bg-slate-600 text-purple-600 shadow-sm' : 'text-gray-400 opacity-60'}`}
                                            >
                                                MTG
                                            </button>
                                        )}
                                    </div>

                                    {/* TITLE INPUT */}
                                    <input
                                        type="text"
                                        placeholder={task.type === 'TASK' ? `TASK ${i + 1 < 10 ? '0' + (i + 1) : i + 1}` : 'Meeting Title'}
                                        value={task.title}
                                        onChange={(e) => handleInputChange(i, 'title', e.target.value)}
                                        className="flex-1 min-w-0 text-xs font-bold text-gray-600 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-slate-500 placeholder:font-bold bg-transparent border-none p-0 focus:ring-0 uppercase tracking-wider"
                                    />
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <AnimatePresence mode="wait">
                                        {task.type === 'TASK' ? (
                                            <motion.div
                                                key="task-category"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                className="relative"
                                                ref={openCategoryIdx === i ? dropdownRef : null}
                                            >
                                                <button
                                                    onClick={() => setOpenCategoryIdx(openCategoryIdx === i ? null : i)}
                                                    className="flex items-center gap-1 pl-3 pr-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 rounded-full border border-indigo-100 dark:border-indigo-500/20 transition-all hover:bg-indigo-100 dark:hover:bg-indigo-500/20 active:scale-95"
                                                >
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                                        {task.category || 'General'}
                                                    </span>
                                                    <div className={`text-indigo-500 transition-transform duration-200 ${openCategoryIdx === i ? 'rotate-180' : ''}`}>
                                                        <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                                        </svg>
                                                    </div>
                                                </button>

                                                {/* Custom Dropdown Menu */}
                                                <AnimatePresence>
                                                    {openCategoryIdx === i && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                            className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-white/10 overflow-hidden z-50 py-1"
                                                        >
                                                            {availableCategories.map(cat => (
                                                                <button
                                                                    key={cat}
                                                                    onClick={() => {
                                                                        handleInputChange(i, 'category', cat);
                                                                        setOpenCategoryIdx(null);
                                                                    }}
                                                                    className={`w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-between ${
                                                                        (task.category || 'General') === cat 
                                                                        ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' 
                                                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                                                                    }`}
                                                                >
                                                                    {cat}
                                                                    {(task.category || 'General') === cat && <div className="w-1 h-1 rounded-full bg-indigo-500" />}
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="meeting-options"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                className="flex items-center gap-1"
                                            >
                                                <button
                                                    onClick={() => handleInputChange(i, 'locationType', 'online')}
                                                    className={`p-1 rounded-md border transition-all ${task.locationType === 'online' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-transparent text-gray-300 border-gray-100'}`}
                                                >
                                                    <Video size={10} />
                                                </button>
                                                <button
                                                    onClick={() => handleInputChange(i, 'locationType', 'offline')}
                                                    className={`p-1 rounded-md border transition-all ${task.locationType === 'offline' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-transparent text-gray-300 border-gray-100'}`}
                                                >
                                                    <MapPin size={10} />
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Delete Action Button */}
                                    <button
                                        onClick={() => handleDelete(i)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Delete Entry"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3 relative">
                                {/* DESCRIPTION INPUT */}
                                <input
                                    type="text"
                                    placeholder="Add description..."
                                    value={task.description}
                                    onChange={(e) => handleDescriptionChange(i, e.target.value)}
                                    className="w-full text-sm font-medium text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-slate-500 placeholder:font-normal bg-transparent border-none p-0 focus:ring-0"
                                />

                                {activeMentionIdx === i && (
                                    (() => {
                                        const filtered = orgUsers.filter(u => 
                                            u.user_name.toLowerCase().includes(mentionSearch.toLowerCase())
                                        ).slice(0, 5);
                                        
                                        if (filtered.length === 0) return null;

                                        return (
                                            <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 py-1 max-h-40 overflow-y-auto">
                                                {filtered.map(u => (
                                                    <button
                                                        key={u.user_id}
                                                        type="button"
                                                        onClick={() => insertMention(i, u)}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-2 transition-colors border-none bg-transparent cursor-pointer"
                                                    >
                                                        {u.profile_image_url ? (
                                                            <img src={u.profile_image_url} alt={u.user_name} className="w-5 h-5 rounded-full object-cover shrink-0" />
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[9px] shrink-0">
                                                                {u.user_name.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div className="truncate">
                                                            <div className="font-bold text-gray-700 dark:text-github-dark-text truncate">{u.user_name}</div>
                                                            <div className="text-[9px] text-gray-400 dark:text-gray-500 truncate">{u.dept_name || 'Staff'} • {u.desg_name || 'Member'}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        );
                                    })()
                                )}

                                <AnimatePresence>
                                    {task.type !== 'TASK' && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="pt-2">
                                                {task.locationType === 'online' ? (
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="Meeting link (Groq, Meets, Zoom...)"
                                                            value={task.meetLink}
                                                            onChange={(e) => handleInputChange(i, 'meetLink', e.target.value)}
                                                            className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-50 dark:bg-github-dark-subtle/80 rounded-md border border-slate-100 dark:border-github-dark-border text-indigo-600 dark:text-indigo-400"
                                                        />
                                                        <LinkIcon size={12} className="absolute left-2 top-2.5 opacity-50" />
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="Meeting location / Room name"
                                                            value={task.address}
                                                            onChange={(e) => handleInputChange(i, 'address', e.target.value)}
                                                            className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-50 dark:bg-github-dark-subtle/80 rounded-md border border-slate-100 dark:border-github-dark-border"
                                                        />
                                                        <MapPin size={12} className="absolute left-2 top-2.5 opacity-50" />
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Time Intervals */}
                                <div className="pt-2 border-t border-dashed border-gray-100 dark:border-github-dark-border">
                                    <div className="w-full flex items-center gap-2 bg-gray-50 dark:bg-slate-700/30 rounded-lg p-2 border border-transparent focus-within:border-indigo-200 dark:focus-within:border-indigo-800 transition-colors">
                                        <Clock size={14} className={task.error ? "text-red-400 ml-1" : "text-gray-400 dark:text-github-dark-muted ml-1"} />
                                        <div className="flex items-center gap-1 flex-1">
                                            <input
                                                type="time"
                                                value={task.startTime}
                                                onChange={(e) => handleInputChange(i, 'startTime', e.target.value)}
                                                className={`w-full bg-transparent border-none p-0 text-xs font-medium focus:ring-0 text-center no-calendar-picker ${task.error ? 'text-red-600' : 'text-gray-600 dark:text-gray-300'}`}
                                            />
                                            <span className="text-gray-300 text-[10px]">•</span>
                                            <input
                                                type="time"
                                                value={task.endTime}
                                                onChange={(e) => handleInputChange(i, 'endTime', e.target.value)}
                                                className="w-full bg-transparent border-none p-0 text-xs font-medium text-gray-600 dark:text-gray-300 focus:ring-0 text-center no-calendar-picker"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {task.error && (
                                    <span className="text-[10px] text-red-500 font-medium flex items-center gap-1 mt-1">
                                        <AlertCircle size={10} /> {task.error}
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    ))}

                    {/* Unavailable Slot Placeholder */}
                    <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-github-dark-border bg-gray-50/50 dark:bg-github-dark-subtle/50 flex items-center justify-between opacity-70">
                        <span className="text-xs font-bold text-gray-400 uppercase">
                            End of Day
                        </span>
                        <div className="flex items-center gap-2 text-xs text-orange-500 font-medium">
                            <AlertCircle size={14} />
                            <span>Unavailable</span>
                        </div>
                    </div>

                    {/* Add New */}
                    <button
                        onClick={handleAddAnother}
                        className="w-full py-4 border border-dashed border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center gap-2 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all text-sm font-bold"
                    >
                        <Plus size={16} />
                        Add Another Entry
                    </button>

                </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-github-dark-border bg-gray-50 dark:bg-dark-card rounded-b-2xl">
                {isAbsent ? (
                    <button
                        disabled
                        className="w-full py-2.5 font-bold rounded-xl text-[10px] flex items-center justify-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-400 dark:text-red-500 cursor-not-allowed"
                    >
                        <AlertCircle size={14} />
                        Absent — Submission Blocked
                    </button>
                ) : (
                    <button
                        className={`w-full py-2.5 font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] text-[10px] flex items-center justify-center gap-2 ${isPastDate
                            ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200/50 text-white'
                            : 'bg-gray-900 hover:bg-black shadow-gray-200 dark:shadow-none text-white'}`}
                        onClick={handleSaveClick}
                    >
                        {isPastDate ? (
                            <>
                                <AlertCircle size={14} />
                                Submit Request for Approval
                            </>
                        ) : (
                            "Save & Continue"
                        )}
                    </button>
                )}
            </div>

            {/* REASON MODAL */}
            {showReasonModal && createPortal(
                <div className="fixed inset-0 z-[10000] overflow-y-auto bg-black/60 backdrop-blur-sm">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative mx-auto z-10 bg-white dark:bg-[#13151f] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text mb-2">Request Reason</h3>
                            <p className="text-sm text-slate-500 dark:text-github-dark-muted mb-4">
                                Please explain why you are modifying a past record. This will be visible to the admin.
                            </p>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full h-32 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none mb-4"
                                placeholder="E.g., Forgot to log the client meeting..."
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowReasonModal(false)}
                                    className="flex-1 py-2.5 rounded-xl font-medium text-slate-600 dark:text-github-dark-muted hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitRequest}
                                    disabled={!reason.trim() || isSubmitting}
                                    className="flex-1 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </div>
                        </motion.div>
                    </div>
                </div>,
                document.body
            )}

            <MobileConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
            />
        </motion.div >
    );
};

export default TaskCreationPanel;
