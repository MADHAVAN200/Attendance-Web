import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { X, Plus, Clock, AlertCircle, Trash2, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import MiniCalendar from '../dar/MiniCalendar';

const TaskCreationPanel = ({ onClose, onUpdate, initialTimeIn = "09:30", highlightTaskId, initialDate, onDateChange }) => {


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
    const [hasScrolled, setHasScrolled] = useState(false);
    const today = new Date().toISOString().split('T')[0];
    const isPastDate = date < today;

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

    // Initialize defaults on mount or date change
    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const res = await api.get(`/dar/activities/list?date=${date}`);
                const activities = res.data.data.map(a => ({
                    id: a.activity_id,
                    title: a.title,
                    description: a.description,
                    startTime: a.start_time ? a.start_time.slice(0, 5) : '',
                    endTime: a.end_time ? a.end_time.slice(0, 5) : '',
                    category: a.activity_type ? (a.activity_type.charAt(0) + a.activity_type.slice(1).toLowerCase()) : 'General',
                    status: a.status, // Capture status
                    isValid: true,
                    isSaved: true
                }));
                // If no activities, maybe add one empty slot?
                setInputs(activities.length > 0 ? activities : [{
                    id: `new-${Date.now()}`,
                    title: '',
                    description: '',
                    startTime: initialTimeIn, // Start at Time In
                    endTime: addMinutes(initialTimeIn, 60),
                    isValid: true,
                    error: null,
                    isSaved: false,
                    status: 'PENDING'
                }]);
            } catch (err) {
                console.error("Failed to fetch activities", err);
            }
        };

        fetchActivities();
    }, [initialTimeIn, date]);


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
                type: 'task',
                category: task.category || 'General',
                status: task.status,
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
            isValid: true,
            error: null
        };

        const newIndex = inputs.length;
        setInputs([...inputs, newTask]);

        onUpdate({
            id: newTask.id,
            title: `Task ${newIndex + 1}`,
            description: '',
            startTime: newTask.startTime,
            endTime: newTask.endTime,
            type: 'task',
            date: date
        });
    };

    const handleDelete = async (index) => {
        const task = inputs[index];
        // If it's saved in DB (has valid ID not starting with 'new-'), delete from DB
        const isExisting = task.id && !String(task.id).startsWith('new-');

        // Only delete via API if NOT in 'Past Date' mode. 
        // In Past Date mode, we just remove from UI list -> ProposedDiff will show Delete.
        if (isExisting && !isPastDate) {
            try {
                await api.delete(`/dar/activities/delete/${task.id}`);
                // Notify parent to update preview
                onUpdate({ id: task.id, deleted: true });
            } catch (err) {
                alert("Failed to delete task: " + err.response?.data?.message);
                return;
            }
        }

        const newInputs = inputs.filter((_, i) => i !== index);
        setInputs(newInputs);
    };

    return (
        <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full h-full bg-white dark:bg-dark-card rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 flex flex-col"
        >

            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-start bg-white dark:bg-dark-card relative z-20 rounded-t-2xl">
                <div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">Daily Tasks</h3>
                    <p className="text-sm text-gray-400 dark:text-gray-400 mt-1">Plan your day effectively</p>

                    <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full w-fit border border-emerald-100 dark:border-emerald-800">
                            <Clock size={14} />
                            <span>Time In: {initialTimeIn}</span>
                        </div>

                        {/* Date Picker using MiniCalendar (Portal) */}
                        <div className="relative">
                            <button
                                ref={buttonRef}
                                onClick={toggleCalendar}
                                className="flex items-center gap-2 pl-3 pr-4 py-1.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                            >
                                <Calendar size={14} className="text-indigo-500" />
                                <span className="text-xs font-bold text-gray-700 dark:text-slate-200">
                                    {new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            </button>

                            {showCalendar && createPortal(
                                <div className="fixed inset-0 z-[9999] isolate">
                                    {/* Backdrop */}
                                    <div
                                        className="fixed inset-0 bg-transparent"
                                        onClick={() => setShowCalendar(false)}
                                    />
                                    {/* Popup */}
                                    <div
                                        className="fixed z-[10000] drop-shadow-2xl"
                                        style={{
                                            top: calendarPos.top,
                                            left: calendarPos.left,
                                            maxWidth: '320px'
                                        }}
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
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-full text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Task List Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                {inputs.map((task, i) => (
                    <div id={`task-card-${task.id}`} key={task.id} className={`group relative bg-white dark:bg-slate-800 rounded-xl border transition-all p-3 flex flex-col gap-3 ${task.error ? 'border-red-200 ring-1 ring-red-100 dark:border-red-900/50 dark:ring-red-900/30' : 'border-gray-100 dark:border-slate-700 hover:border-indigo-100 dark:hover:border-indigo-900 hover:shadow-sm'} ${highlightTaskId === task.id ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}>
                        {/* Indicator Line */}
                        <div className={`absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full transition-colors ${task.error ? 'bg-red-400' : 'bg-gray-200 group-hover:bg-indigo-500'}`}></div>

                        {/* Top Row: TITLE & Category */}
                        <div className="flex items-center justify-between relative border-b border-gray-50 pb-2 mb-1 gap-2">
                            {/* TITLE INPUT */}
                            <input
                                type="text"
                                placeholder={`TASK ${i + 1 < 10 ? '0' + (i + 1) : i + 1}`}
                                value={task.title}
                                onChange={(e) => handleInputChange(i, 'title', e.target.value)}
                                className="flex-1 min-w-0 text-xs font-bold text-gray-600 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-slate-500 placeholder:font-bold bg-transparent border-none p-0 focus:ring-0 uppercase tracking-wider"
                            />

                            {/* PLANNED BADGE */}
                            {task.status === 'PLANNED' && (
                                <span className="text-[10px] font-bold text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 flex items-center gap-1">
                                    <Clock size={10} /> Planned
                                </span>
                            )}

                            {/* Category Pill Dropdown (Top Right) */}
                            <div className="relative flex-shrink-0">
                                <select
                                    value={task.category || 'General'}
                                    onChange={(e) => handleInputChange(i, 'category', e.target.value)}
                                    className="appearance-none pl-3 pr-6 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-indigo-800 focus:ring-0 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-right"
                                >
                                    {['General', 'Site Visit', 'Inspection', 'Material', 'Meeting', 'Safety', 'Doc'].map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-indigo-500">
                                    <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {/* DESCRIPTION INPUT */}
                            <input
                                type="text"
                                placeholder="Add description..."
                                value={task.description}
                                onChange={(e) => handleInputChange(i, 'description', e.target.value)}
                                className="w-full text-sm font-medium text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-slate-500 placeholder:font-normal bg-transparent border-none p-0 focus:ring-0"
                            />

                            {/* Time Intervals */}
                            {/* Time Intervals & Actions Row */}
                            <div className="flex items-center gap-2 pt-2 border-t border-dashed border-gray-100 dark:border-slate-700">
                                {/* Time Group */}
                                <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-slate-700/30 rounded-lg p-1.5 border border-transparent focus-within:border-indigo-200 dark:focus-within:border-indigo-800 transition-colors">
                                    <Clock size={14} className={task.error ? "text-red-400 ml-1" : "text-gray-400 dark:text-slate-500 ml-1"} />

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

                                {/* Delete Action */}
                                <button
                                    onClick={() => handleDelete(i)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete Task"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            {task.error && (
                                <span className="text-[10px] text-red-500 font-medium flex items-center gap-1 mt-1">
                                    <AlertCircle size={10} /> {task.error}
                                </span>
                            )}
                        </div>
                    </div>
                ))}

                {/* Unavailable Slot Placeholder */}
                <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-between opacity-70">
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
                    Add Another Task
                </button>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-dark-card rounded-b-2xl">
                <button
                    className={`w-full py-3.5 font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 ${isPastDate
                        ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200/50 text-white'
                        : 'bg-gray-900 hover:bg-black shadow-gray-200 dark:shadow-none text-white'}`}
                    onClick={async () => {
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

                        // MOCK REQUEST FLOW -> REAL API CALL
                        if (isPastDate) {
                            try {
                                const response = await api.post('/dar/requests/create', {
                                    request_date: date,
                                    // ideally we should store original state on load, but for now we can just send empty if unknown, 
                                    // or fetch it here. But simpler: The Admin Diff view will fetch the 'current execution' from DB as 'Original' anyway?
                                    // Wait, if we send 'original_data' here, we capture the state BEFORE the user made these edits in the UI? 
                                    // The `inputs` are already modified. 
                                    // We need to fetch the DB state again to be sure what is "Original"

                                    // Better approach: Let the backend fetch 'original' or we fetch it here.
                                    // Let's fetch current DB state here to be accurate.
                                    original_data: (await api.get(`/dar/activities/list?date=${date}`)).data.data.map(a => ({
                                        id: a.activity_id, // Critical for diff
                                        title: a.title,
                                        description: a.description,
                                        start_time: a.start_time,
                                        end_time: a.end_time,
                                        activity_type: a.activity_type
                                    })),
                                    proposed_data: inputs.map(t => ({
                                        id: t.id && !t.id.toString().startsWith('new-') ? t.id : undefined, // Send ID if existing
                                        title: t.title,
                                        description: t.description,
                                        start_time: t.startTime,
                                        end_time: t.endTime,
                                        activity_type: (t.category || 'General').toUpperCase()
                                    }))
                                });

                                if (response.data.ok) {
                                    toast.success("Request submitted to Admin!");
                                    onClose();
                                }
                            } catch (err) {
                                console.error(err);
                                alert("Failed to submit request: " + (err.response?.data?.message || err.message));
                            }
                            return;
                        }

                        // Submit sequentially
                        for (const task of tasksToSave) {
                            try {
                                const payload = {
                                    title: task.title || "Untitled Task",
                                    description: task.description,
                                    start_time: task.startTime,
                                    end_time: task.endTime,
                                    activity_date: date, // Use selected date
                                    activity_type: (task.category || 'General').toUpperCase(),
                                    // Status Logic:
                                    // If Future -> Backend sets PLANNED
                                    // If Today -> Send COMPLETED to enforce validation (convert Plan to Record)
                                    status: date > todayStr ? 'PLANNED' : 'COMPLETED'
                                };

                                // Check if it's an existing task (numeric ID or ID string not starting with 'new-')
                                const isExisting = task.id && !String(task.id).startsWith('new-');

                                if (isExisting) {
                                    await api.put(`/dar/activities/update/${task.id}`, payload);
                                } else {
                                    await api.post('/dar/activities/create', payload);
                                }

                                // visual success feedback could go here
                            } catch (err) {
                                alert(`Failed to save "${task.title}": ${err.response?.data?.message}`);
                                return; // Stop on error
                            }
                        }

                        // If all success
                        onClose();
                    }}
                >
                    {isPastDate ? (
                        <>
                            <AlertCircle size={18} />
                            Submit Request for Approval
                        </>
                    ) : (
                        "Save & Continue"
                    )}
                </button>
            </div>

        </motion.div >
    );
};

export default TaskCreationPanel;
