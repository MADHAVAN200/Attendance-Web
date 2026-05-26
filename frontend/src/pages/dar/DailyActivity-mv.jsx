import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Calendar, 
    Plus, 
    ChevronDown, 
    CheckSquare, 
    Video, 
    Shield, 
    Clock, 
    MoreVertical, 
    AlertCircle, 
    CheckCircle2,
    Briefcase,
    Users,
    MapPin,
    ArrowLeft,
    ChevronRight,
    ChevronLeft,
    RefreshCw
} from 'lucide-react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import MiniCalendar from '../../components/dar/MiniCalendar';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import TaskCreationPanel from '../../components/dar/TaskCreationPanel';
import EventMeetingModal from '../../components/dar/EventMeetingModal';


const getTodayLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getLocalDateString = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


const DailyActivityMobile = () => {
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState(getTodayLocalDateString());
    const [showFullCalendar, setShowFullCalendar] = useState(false);
    const calendarButtonRef = useRef(null);
    const [tasks, setTasks] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [holidays, setHolidays] = useState({});
    const [loading, setLoading] = useState(true);
    const [sidebarMode, setSidebarMode] = useState('default'); // 'default' | 'create-task'
    const [showActions, setShowActions] = useState(false);
    const [eventModal, setEventModal] = useState({ isOpen: false, type: 'Meeting' });
    const [lastCreateRequest, setLastCreateRequest] = useState({ type: 'TASK', timestamp: 0 });
    const [selectedTaskId, setSelectedTaskId] = useState(null);

    // Fetch data for selected date
    useEffect(() => {
        fetchDayData();
    }, [selectedDate]);

    const fetchDayData = async () => {
        setLoading(true);
        try {
            const [eventsRes, activitiesRes, attendanceRes, holidayRes] = await Promise.all([
                api.get('/dar/events/list', { params: { date_from: selectedDate, date_to: selectedDate } }),
                api.get('/dar/activities/list', { params: { date_from: selectedDate, date_to: selectedDate } }),
                api.get('/attendance/records', { params: { date_from: selectedDate, date_to: selectedDate } }),
                api.get('/holiday')
            ]);

            // Process Holidays
            const rawHols = holidayRes.data.holidays || [];
            const holMap = {};
            rawHols.forEach(h => { holMap[h.holiday_date] = h.holiday_name; });
            setHolidays(holMap);

            // Process Tasks & Events
            const transformedData = [];
            
            // Events
            (eventsRes.data.data || []).forEach(e => {
                transformedData.push({
                    id: `evt-${e.event_id}`,
                    title: e.title,
                    description: e.description,
                    startTime: e.start_time ? e.start_time.slice(0, 5) : '',
                    endTime: e.end_time ? e.end_time.slice(0, 5) : '',
                    date: e.event_date,
                    type: e.type.toLowerCase(),
                    location: e.location
                });
            });

            // Activities
            (activitiesRes.data.data || []).forEach(a => {
                transformedData.push({
                    id: `act-${a.activity_id}`,
                    title: a.title,
                    description: a.description,
                    startTime: a.start_time ? a.start_time.slice(0, 5) : '',
                    endTime: a.end_time ? a.end_time.slice(0, 5) : '',
                    date: a.activity_date,
                    type: 'task',
                    status: a.status
                });
            });

            // Sort chronologically
            transformedData.sort((a, b) => a.startTime.localeCompare(b.startTime));
            setTasks(transformedData);

            // Process Attendance
            const attMap = {};
            const attendanceRecs = attendanceRes.data.data || [];
            attendanceRecs.forEach(a => {
                const dateKey = getLocalDateString(a.time_in);
                const timeIn = new Date(a.time_in).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                const timeOut = a.time_out ? new Date(a.time_out).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : null;

                if (!attMap[dateKey]) {
                    attMap[dateKey] = {
                        timeIn,
                        timeOut,
                        status: a.status || 'Present',
                        hasTimedIn: true,
                        intervals: []
                    };
                }
                attMap[dateKey].intervals.push({ start: timeIn, end: timeOut });
                if (timeOut && (!attMap[dateKey].timeOut || timeOut > attMap[dateKey].timeOut)) {
                    attMap[dateKey].timeOut = timeOut;
                }
            });
            setAttendanceData(attMap);

        } catch (error) {
            console.error("Failed to load mobile DAR data", error);
        } finally {
            setLoading(false);
        }
    };

    // Generate week view dates
    const weekDates = useMemo(() => {
        const dates = [];
        const current = new Date(selectedDate);
        // Show 3 days before and 3 days after
        for (let i = -3; i <= 3; i++) {
            const d = new Date(current);
            d.setDate(current.getDate() + i);
            dates.push(getLocalDateString(d));
        }
        return dates;
    }, [selectedDate]);

    const handleCreate = (type) => {
        const createType = (type === 'Task' ? 'TASK' : type.toUpperCase());
        setLastCreateRequest({ type: createType, timestamp: Date.now() });
        setSidebarMode('create-task');
        setShowActions(false);
    };

    const handleEditTask = (t) => {
        if (t.type === 'task') {
            setSidebarMode('create-task');
            const rawId = t.id.startsWith('act-') ? t.id.split('-')[1] : null;
            if (rawId) setSelectedTaskId(Number(rawId));
        } else {
            const type = t.type === 'meeting' ? 'Meeting' : 'Event';
            setEventModal({ isOpen: true, type, initialData: t });
        }
    };

    const isToday = selectedDate === getTodayLocalDateString();
    const holidayName = holidays[selectedDate];

    return (
        <MobileDashboardLayout title="Daily Activity">
            <div className="flex flex-col gap-6">
                
                {/* --- COMPACT HORIZONTAL DATE PICKER --- */}
                <div className="bg-white dark:bg-github-dark-subtle rounded-2xl p-4 border border-slate-100 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <div 
                            ref={calendarButtonRef}
                            onClick={() => setShowFullCalendar(!showFullCalendar)}
                            className="flex flex-col cursor-pointer hover:opacity-70 transition-opacity active:scale-95 origin-left"
                        >
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none">Schedule For</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-bold text-slate-800 dark:text-white uppercase">
                                    {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </span>
                                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${showFullCalendar ? 'rotate-180' : ''}`} />
                            </div>
                        </div>

                        {showFullCalendar && createPortal(
                            <div className="fixed inset-0 z-[9999] isolate">
                                <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px]" onClick={() => setShowFullCalendar(false)} />
                                <div className="fixed top-[150px] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm drop-shadow-2xl">
                                    <motion.div
                                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-white/10"
                                    >
                                        <MiniCalendar
                                            selectedDate={selectedDate}
                                            disableRange={true}
                                            onDateSelect={(range) => {
                                                setSelectedDate(range.start);
                                                setShowFullCalendar(false);
                                            }}
                                        />
                                    </motion.div>
                                </div>
                            </div>,
                            document.body
                        )}
                        <button 
                            onClick={() => setSelectedDate(getTodayLocalDateString())}
                            className={`px-3 py-1.5 rounded-full text-[9px] font-semibold uppercase tracking-widest transition-all ${isToday ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-slate-100 text-slate-500 dark:bg-white/5'}`}
                        >
                            Today
                        </button>
                    </div>
                    
                    <div className="flex justify-between items-center gap-1">
                        {weekDates.map((dateStr) => {
                            const d = new Date(dateStr);
                            const active = dateStr === selectedDate;
                            const isCurrentDay = dateStr === getTodayLocalDateString();
                            
                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => setSelectedDate(dateStr)}
                                    className={`flex-1 flex flex-col items-center py-3 rounded-2xl transition-all duration-300 ${
                                        active 
                                            ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-lg scale-105 z-10' 
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <span className={`text-[8px] font-semibold uppercase tracking-tighter mb-1 ${active ? 'opacity-70' : ''}`}>
                                        {d.toLocaleDateString('en-US', { weekday: 'short' })}
                                    </span>
                                    <span className="text-xs font-bold">
                                        {d.getDate()}
                                    </span>
                                    {isCurrentDay && !active && (
                                        <div className="w-1 h-1 bg-indigo-500 rounded-full mt-1" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* --- SCHEDULE SUMMARY / ATTENDANCE --- */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-github-dark-subtle p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <Clock size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest block leading-none">Time In</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-white uppercase">{attendanceData[selectedDate]?.timeIn || '--:--'}</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-github-dark-subtle p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                            <RefreshCw size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest block leading-none">Tasks</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-white uppercase">{tasks.length} Items</span>
                        </div>
                    </div>
                </div>

                {/* --- MAIN SCHEDULE LIST --- */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-[10px] font-semibold text-slate-800 dark:text-white uppercase tracking-[0.2em]">Agenda</h3>
                        {holidayName && (
                            <span className="px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-semibold uppercase rounded-full border border-amber-100 dark:border-amber-500/20 animate-pulse">
                                {holidayName}
                            </span>
                        )}
                    </div>

                    <div className="relative pl-4 space-y-4">
                        {/* Timeline vertical line */}
                        <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-white/5 rounded-full" />

                        {loading ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-3">
                                <div className="w-8 h-8 border-3 border-indigo-100 dark:border-indigo-900/30 border-t-indigo-500 rounded-full animate-spin" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading agenda...</p>
                            </div>
                        ) : tasks.length > 0 ? (
                            <AnimatePresence mode="popLayout">
                                {tasks.map((task, idx) => {
                                    const isTask = task.type === 'task';
                                    const isMeeting = task.type === 'meeting';
                                    
                                    let typeIcon = <CheckSquare size={14} />;
                                    let typeColor = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400';
                                    let borderColor = 'border-emerald-100 dark:border-emerald-500/10';
                                    
                                    if (isMeeting) {
                                        typeIcon = <Video size={14} />;
                                        typeColor = 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400';
                                        borderColor = 'border-purple-100 dark:border-purple-500/10';
                                    } else if (task.type === 'event') {
                                        typeIcon = <Users size={14} />;
                                        typeColor = 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400';
                                        borderColor = 'border-blue-100 dark:border-blue-500/10';
                                    }

                                    return (
                                        <motion.div
                                            key={task.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ delay: idx * 0.05 }}
                                            onClick={() => handleEditTask(task)}
                                            className="relative flex items-start gap-4 active:scale-[0.98] transition-all"
                                        >
                                            {/* Timeline dot */}
                                            <div className={`absolute -left-[21px] top-4 w-3 h-3 rounded-full border-2 border-white dark:border-github-dark-bg z-10 bg-slate-200 dark:bg-slate-700`} />

                                            <div className={`flex-1 bg-white dark:bg-github-dark-subtle p-4 rounded-2xl border ${borderColor} shadow-sm space-y-3`}>
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${typeColor}`}>
                                                            {typeIcon}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase leading-tight truncate max-w-[150px]">
                                                                {task.title}
                                                            </h4>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <Clock size={10} className="text-slate-400" />
                                                                <span className="text-[9px] font-semibold text-slate-400 uppercase">{task.startTime} - {task.endTime}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {task.status === 'PLANNED' ? (
                                                        <span className="text-[8px] font-bold uppercase px-2 py-1 bg-slate-100 dark:bg-white/5 text-slate-400 rounded-lg border border-slate-200 dark:border-white/5">PLANNED</span>
                                                    ) : (
                                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                                    )}
                                                </div>

                                                {task.description && (
                                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 pl-1">
                                                        {task.description}
                                                    </p>
                                                )}
                                                
                                                {(task.location || isMeeting) && (
                                                    <div className="flex items-center gap-2 pl-1">
                                                        <MapPin size={10} className="text-slate-300" />
                                                        <span className="text-[10px] font-semibold text-slate-400 truncate uppercase tracking-tight">
                                                            {task.location || 'Remote Session'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        ) : (
                            <div className="bg-white dark:bg-github-dark-subtle rounded-2xl border border-dashed border-slate-200 dark:border-white/5 p-12 flex flex-col items-center justify-center gap-4 text-center">
                                <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-200 dark:text-white/10">
                                    <RefreshCw size={32} />
                                </div>
                                <div>
                                    <h5 className="text-xs font-bold text-slate-800 dark:text-white uppercase">Quiet Day Ahead</h5>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1">No activities scheduled yet</p>
                                </div>
                                <button 
                                    onClick={() => handleCreate('Task')}
                                    className="px-6 py-2.5 bg-slate-900 dark:bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-lg active:scale-95 transition-all"
                                >
                                    Add Your First Task
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Floating Action Button */}
                <div className="fixed bottom-8 right-6 z-40">
                    <div className="relative">
                        <AnimatePresence>
                            {showActions && (
                                <motion.div
                                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                                    className="absolute bottom-20 right-0 w-52 bg-white dark:bg-github-dark-subtle rounded-2xl shadow-2xl border border-slate-100 dark:border-white/10 p-1.5 overflow-hidden flex flex-col gap-1"
                                >
                                    <button 
                                        onClick={() => handleCreate('Task')}
                                        className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                            <CheckSquare size={16} strokeWidth={2.5} />
                                        </div>
                                        <span className="text-xs font-semibold text-slate-700 dark:text-white whitespace-nowrap">New Task</span>
                                    </button>
                                    <button 
                                        onClick={() => handleCreate('Meeting')}
                                        className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-500">
                                            <Video size={16} strokeWidth={2.5} />
                                        </div>
                                        <span className="text-xs font-semibold text-slate-700 dark:text-white whitespace-nowrap">New Meeting</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        
                        <button
                            onClick={() => setShowActions(!showActions)}
                            className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-2xl transition-all duration-500 active:scale-90 ${
                                showActions ? 'bg-slate-900 rotate-45' : 'bg-indigo-600 shadow-indigo-500/40'
                            } text-white`}
                        >
                            <Plus size={28} strokeWidth={3} />
                        </button>
                    </div>
                </div>

                {/* --- FULL SCREEN MOBILE PANELS --- */}
                <AnimatePresence>
                    {sidebarMode === 'create-task' && (
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-0 z-50 bg-white dark:bg-github-dark-bg overflow-hidden"
                        >
                            <TaskCreationPanel
                                onClose={() => {
                                    setSidebarMode('default');
                                    setSelectedTaskId(null);
                                    fetchDayData();
                                }}
                                onUpdate={() => {}} // Local updates handled in panel
                                initialTimeIn={attendanceData[selectedDate]?.timeIn || "09:00"}
                                attendanceIntervals={attendanceData[selectedDate]?.intervals || []}
                                highlightTaskId={selectedTaskId}
                                initialDate={selectedDate}
                                lastCreateRequest={lastCreateRequest}
                                onDateChange={(d) => setSelectedDate(d)}
                                isAbsent={
                                    selectedDate < getTodayLocalDateString() &&
                                    !holidays[selectedDate] &&
                                    (!attendanceData[selectedDate] || !attendanceData[selectedDate].hasTimedIn)
                                }
                            />
                        </motion.div>
                    )}

                    {eventModal.isOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="w-full max-w-sm"
                            >
                                <EventMeetingModal
                                    type={eventModal.type}
                                    initialDate={selectedDate}
                                    initialData={eventModal.initialData}
                                    onClose={() => setEventModal({ ...eventModal, isOpen: false, initialData: null })}
                                    onSave={() => {
                                        fetchDayData();
                                        toast.success(`${eventModal.type} updated successfully!`);
                                    }}
                                />
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            </div>
        </MobileDashboardLayout>
    );
};

export default DailyActivityMobile;
