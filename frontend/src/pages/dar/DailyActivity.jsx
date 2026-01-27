import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
// import { darService } from '../../services/mockDarService';
import MultiDayTimeline from '../../components/dar/MultiDayTimeline';
import MiniCalendar from '../../components/dar/MiniCalendar';
import UpcomingMeetings from '../../components/dar/UpcomingMeetings';
import UpcomingHolidays from '../../components/dar/UpcomingHolidays';
import TaskCreationPanel from '../../components/dar/TaskCreationPanel';
import EventMeetingModal from '../../components/dar/EventMeetingModal'; // Import
import { Plus, ChevronDown, Calendar, CheckSquare, Video } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';


const DailyActivity = () => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [daysToShow, setDaysToShow] = useState(7);
    const [tasks, setTasks] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [holidays, setHolidays] = useState([]); // Store holidays
    const [loading, setLoading] = useState(true);


    // Modal State
    const [eventModal, setEventModal] = useState({ isOpen: false, type: 'Meeting' }); // New State

    // Selection for Edit
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [panelDate, setPanelDate] = useState(new Date().toISOString().split('T')[0]); // Track date for panel

    // Mode State
    const [sidebarMode, setSidebarMode] = useState('default'); // 'default' | 'create-task'

    // Load data for a range (e.g., selected date + N days)
    useEffect(() => {
        fetchRangeData();
    }, [selectedDate, daysToShow]);

    const handleDateRangeSelect = (range) => {
        if (typeof range === 'string') {
            setSelectedDate(range);
            setDaysToShow(7);
        } else if (range.start && range.end) {
            setSelectedDate(range.start);
            // Calculate days difference (Safe)
            const d1 = new Date(range.start + 'T12:00:00'); // Force noon
            const d2 = new Date(range.end + 'T12:00:00');
            const diffTime = Math.abs(d2 - d1);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            setDaysToShow(diffDays < 1 ? 1 : diffDays);
        }
    };

    const fetchRangeData = async () => {
        setLoading(true);
        try {
            // Calculate Date Range Safely
            const startDate = selectedDate;
            const [y, m, day] = selectedDate.split('-').map(Number);
            // Use noon to avoid timezone flip
            const d = new Date(y, m - 1, day, 12, 0, 0);
            d.setDate(d.getDate() + daysToShow - 1);

            const endY = d.getFullYear();
            const endM = String(d.getMonth() + 1).padStart(2, '0');
            const endD = String(d.getDate()).padStart(2, '0');
            const endDate = `${endY}-${endM}-${endD}`;

            // Parallel Fetches
            const [eventsRes, activitiesRes, attendanceRes, holidayRes] = await Promise.all([
                api.get('/dar/events/list', { params: { date_from: startDate, date_to: endDate } }),
                api.get('/dar/activities/list', { params: { date_from: startDate, date_to: endDate } }),
                api.get('/attendance/records', { params: { date_from: startDate, date_to: endDate } }),
                api.get('/holiday')
            ]);

            const events = eventsRes.data.data || [];
            const activities = activitiesRes.data.data || [];
            const attendanceRecs = attendanceRes.data.data || [];

            // Holidays: Filter for relevant range or store all? Store all for lookup.
            const rawHols = holidayRes.data.holidays || [];
            const holMap = {};
            rawHols.forEach(h => {
                holMap[h.holiday_date] = h.holiday_name;
            });
            setHolidays(holMap);

            // Transform Events & Activities to Task Format
            const transformedData = [];

            // 1. Events
            events.forEach(e => {
                transformedData.push({
                    id: `evt-${e.event_id}`,
                    title: e.title,
                    description: e.description,
                    startTime: e.start_time ? e.start_time.slice(0, 5) : '',
                    endTime: e.end_time ? e.end_time.slice(0, 5) : '',
                    date: e.event_date,
                    type: e.type.toLowerCase(), // 'event' or 'meeting'
                    location: e.location
                });
            });

            // 2. Activities (Tasks)
            activities.forEach(a => {
                transformedData.push({
                    id: `act-${a.activity_id}`,
                    title: a.title,
                    description: a.description,
                    startTime: a.start_time ? a.start_time.slice(0, 5) : '',
                    endTime: a.end_time ? a.end_time.slice(0, 5) : '',
                    date: a.activity_date,
                    type: 'task', // 'task'
                    status: a.status
                });
            });

            setTasks(transformedData);

            // Transform Attendance
            const attMap = {};
            // Sort records by time_in to ensure chronological order for intervals
            attendanceRecs.sort((a, b) => new Date(a.time_in) - new Date(b.time_in));

            attendanceRecs.forEach(a => {
                const dateKey = new Date(a.time_in).toISOString().split('T')[0];
                const timeIn = new Date(a.time_in).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                const timeOut = a.time_out ? new Date(a.time_out).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : null;

                if (!attMap[dateKey]) {
                    attMap[dateKey] = {
                        timeIn: timeIn, // Earliest Time In
                        timeOut: timeOut, // Latest Time Out (will update)
                        status: a.status || 'Present',
                        hasTimedIn: true,
                        intervals: []
                    };
                }

                // Add Interval
                attMap[dateKey].intervals.push({ start: timeIn, end: timeOut });

                // Update Latest Time Out if later
                if (timeOut && (!attMap[dateKey].timeOut || timeOut > attMap[dateKey].timeOut)) {
                    attMap[dateKey].timeOut = timeOut;
                }
            });
            setAttendanceData(attMap);

        } catch (error) {
            console.error(error);
            toast.error("Failed to load schedule.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = (type) => {

        if (type === 'Task') {
            setSidebarMode('create-task');
            setPanelDate(new Date().toISOString().split('T')[0]); // Default to Today
        } else if (type === 'Event' || type === 'Meeting') {
            setEventModal({ isOpen: true, type });
        } else {
            toast.info(`Create ${type} - Coming Soon`);
        }
    };

    // Live update from TaskCreationPanel
    const handleTaskPreviewUpdate = (partials) => {
        // partials = { id, title, startTime, endTime, date, type, deleted }

        if (partials.deleted) {
            setTasks(prev => prev.filter(t => t.id !== partials.id && t.id !== `act-${partials.id}`));
            return;
        }

        // Check if task exists in state (handling 'act-' prefix mismatch)
        setTasks(prev => {
            // Try to find exact match OR match with 'act-' prefix
            const existingTask = prev.find(t => t.id === partials.id || t.id === `act-${partials.id}`);

            if (existingTask) {
                // Update existing task, preserving its original view ID (e.g. 'act-123')
                return prev.map(t => t.id === existingTask.id ? { ...t, ...partials, id: existingTask.id } : t);
            } else {
                // Add new task skeleton
                if (partials.startTime) {
                    return [...prev, partials];
                }
                return prev;
            }
        });
    };

    // --- SHIFT & TIMELINE RANGE LOGIC ---
    const { user } = useAuth(); // Get current user
    const [timelineRange, setTimelineRange] = useState({ start: 7, end: 19 }); // Default

    useEffect(() => {
        const fetchShift = async () => {
            if (!user) return;
            try {
                // We need to find the user's shift definition. 
                // Since we don't have a direct "get my shift" endpoint that returns the RULES, 
                // we fetch all shifts and match against user.shift_name (assuming it's available on user object)
                // If user object doesn't have shift_name, we might need to fetch user profile first.
                // For now, let's assume user.shift_name exists or we fallback to 'General'.

                const res = await api.get('/admin/shifts');
                if (res.data.success) {
                    const shifts = res.data.shifts;
                    // Find user's shift. Fallback to 'General' or first shift.
                    const userShiftName = user.shift_name || user.shift || 'General';
                    let targetShift = shifts.find(s => s.shift_name === userShiftName);

                    if (!targetShift) targetShift = shifts.find(s => s.shift_name === 'General') || shifts[0];

                    if (targetShift) {
                        try {
                            const rules = typeof targetShift.policy_rules === 'string'
                                ? JSON.parse(targetShift.policy_rules)
                                : targetShift.policy_rules;

                            const startStr = rules?.shift_timing?.start_time || "09:00";
                            const endStr = rules?.shift_timing?.end_time || "18:00";

                            let startH = parseInt(startStr.split(':')[0]);
                            let endH = parseInt(endStr.split(':')[0]);

                            // Handle Overnight Cross-over (e.g., 18:00 to 02:00)
                            if (endH < startH) {
                                endH += 24;
                            }

                            setTimelineRange({
                                start: Math.max(0, startH - 1),
                                end: endH + 1
                            });
                        } catch (e) {
                            console.error("Error parsing shift rules", e);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch shift info", err);
            }
        };

        fetchShift();
    }, [user]);


    return (
        <DashboardLayout title="Daily Activity Report">
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">

                {/* Left Sidebar (Dynamic Width) */}
                <motion.div
                    layout
                    initial={false}
                    animate={{ width: sidebarMode === 'create-task' ? 420 : 300 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="shrink-0 flex flex-col gap-6"
                >
                    <AnimatePresence mode="wait">
                        {sidebarMode === 'create-task' ? (
                            <TaskCreationPanel
                                key="task-panel"
                                onClose={() => {
                                    setSidebarMode('default');
                                    setSelectedTaskId(null);
                                    fetchRangeData(); // Refresh after save
                                }}
                                onUpdate={handleTaskPreviewUpdate} // Optional: keep for live preview if logic supports
                                initialTimeIn={attendanceData[panelDate]?.timeIn || "09:00"}
                                attendanceIntervals={attendanceData[panelDate]?.intervals || []}
                                highlightTaskId={selectedTaskId}
                                initialDate={panelDate}
                                onDateChange={(d) => setPanelDate(d)}
                            />
                        ) : (
                            <motion.div
                                key="default-sidebar"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col gap-6 w-full"
                            >
                                {/* Create Meeting Button (Direct) */}
                                <div className="relative z-20">
                                    <button
                                        onClick={() => handleCreate('Meeting')}
                                        className="w-full py-3 px-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 shadow-sm rounded-full flex items-center justify-between transition-all hover:shadow-md active:scale-95"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-1 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                                                <Plus size={24} />
                                            </div>
                                            <span className="font-semibold text-gray-700 dark:text-gray-200">Create Meeting</span>
                                        </div>
                                    </button>
                                </div>

                                {/* Mini Calendar */}
                                <MiniCalendar
                                    selectedDate={selectedDate}
                                    endDate={(() => {
                                        const d = new Date(selectedDate);
                                        d.setDate(d.getDate() + daysToShow - 1);
                                        return d.toISOString().split('T')[0];
                                    })()}
                                    onDateSelect={handleDateRangeSelect} // Updated handler
                                />

                                {/* Add Task Button (Standalone) */}
                                <button
                                    onClick={() => handleCreate('Task')}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors active:scale-95"
                                >
                                    <CheckSquare size={18} />
                                    <span>Add Daily Tasks</span>
                                </button>

                                {/* Upcoming Meetings Widget */}
                                <UpcomingMeetings />

                                {/* Upcoming Holidays Widget */}
                                <UpcomingHolidays />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>


                {/* Main Content (Horizontal Multi-Day Timeline) */}
                <motion.div
                    layout
                    className="flex-1 min-w-0 bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col"
                >
                    <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-dark-card/50">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                                {new Date(selectedDate).toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </h2>
                            {sidebarMode === 'create-task' && (
                                <motion.span
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs font-bold animate-pulse"
                                >
                                    Editing {new Date(panelDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}...
                                </motion.span>
                            )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-slate-400">
                            {daysToShow}-Day View
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 z-50">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : (
                            <MultiDayTimeline
                                tasks={tasks}
                                startDate={selectedDate}
                                daysToShow={daysToShow} // Dynamic days
                                attendanceData={attendanceData}
                                holidays={holidays} // Pass holidays
                                startHour={timelineRange.start}
                                endHour={timelineRange.end}
                                onEditTask={(t) => {
                                    if (t.type === 'task') {
                                        setSidebarMode('create-task');
                                        const rawId = t.id.startsWith('act-') ? t.id.split('-')[1] : null;
                                        if (rawId) setSelectedTaskId(Number(rawId));
                                        setPanelDate(t.date); // Set panel date to task's date
                                    } else {
                                        // It's an Event or Meeting
                                        // Open Modal in Edit Mode
                                        const type = t.type === 'meeting' ? 'Meeting' : 'Event';
                                        setEventModal({ isOpen: true, type, initialData: t });
                                    }
                                }}
                            />
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Draggable Event/Meeting Modal */}
            <AnimatePresence>
                {eventModal.isOpen && (
                    <EventMeetingModal
                        type={eventModal.type}
                        initialDate={selectedDate}
                        initialData={eventModal.initialData}
                        onClose={() => setEventModal({ ...eventModal, isOpen: false, initialData: null })}
                        onSave={() => {
                            fetchRangeData(); // Refresh all data
                            toast.success(`${eventModal.type} updated successfully!`);
                        }}
                    />
                )}
            </AnimatePresence>

        </DashboardLayout>
    );
};

export default DailyActivity;
