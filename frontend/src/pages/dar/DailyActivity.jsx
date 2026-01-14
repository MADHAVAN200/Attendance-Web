import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { darService } from '../../services/mockDarService';
import MultiDayTimeline from '../../components/dar/MultiDayTimeline';
import MiniCalendar from '../../components/dar/MiniCalendar';
import UpcomingMeetings from '../../components/dar/UpcomingMeetings';
import UpcomingHolidays from '../../components/dar/UpcomingHolidays';
import TaskCreationPanel from '../../components/dar/TaskCreationPanel';
import { Plus, ChevronDown, Calendar, CheckSquare, Video } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';


const DailyActivity = () => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [tasks, setTasks] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Mode State
    const [sidebarMode, setSidebarMode] = useState('default'); // 'default' | 'create-task'

    // Load data for a range (e.g., selected date + 7 days)
    useEffect(() => {
        fetchRangeData();
    }, [selectedDate]);

    const fetchRangeData = async () => {
        setLoading(true);
        try {
            // Fetch 7 days of data starting from selectedDate
            const rangeDates = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + i);
                rangeDates.push(d.toISOString().split('T')[0]);
            }

            // Mock fetching loop (in real world, single API call for range)
            const allTasks = [];
            const attMap = {};

            for (const date of rangeDates) {
                const t = await darService.getTasks(date);
                const a = await darService.getAttendanceStatus(date);
                allTasks.push(...t);
                attMap[date] = a;
            }

            setTasks(allTasks);
            setAttendanceData(attMap);

        } catch (error) {
            console.error(error);
            toast.error("Failed to load schedule.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = (type) => {
        setIsCreateOpen(false);
        if (type === 'Task') {
            setSidebarMode('create-task');
        } else {
            toast.info(`Create ${type} - Coming Soon`);
        }
    };

    // Live update from TaskCreationPanel
    const handleTaskPreviewUpdate = (partials) => {
        // partials = { id, title, startTime, endTime, date, type, deleted }

        if (partials.deleted) {
            setTasks(prev => prev.filter(t => t.id !== partials.id));
            return;
        }

        // Check if task exists in state (by temp id)
        setTasks(prev => {
            const exists = prev.find(t => t.id === partials.id);
            if (exists) {
                return prev.map(t => t.id === partials.id ? { ...t, ...partials } : t);
            } else {
                // Add new task skeleton
                if (partials.startTime) {
                    return [...prev, partials];
                }
                return prev;
            }
        });
    };

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
                                onClose={() => setSidebarMode('default')}
                                onUpdate={handleTaskPreviewUpdate}
                                initialTimeIn={attendanceData[new Date().toISOString().split('T')[0]]?.timeIn || "09:00"}
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
                                {/* Create Button Dropdown */}
                                <div className="relative z-20">
                                    <button
                                        onClick={() => setIsCreateOpen(!isCreateOpen)}
                                        className={`w-full py-3 px-4 bg-white border shadow-sm rounded-full flex items-center justify-between transition-all ${isCreateOpen ? 'ring-2 ring-indigo-100 border-indigo-200' : 'border-gray-200 hover:shadow-md'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-1 rounded-full bg-indigo-50 text-indigo-600">
                                                <Plus size={24} />
                                            </div>
                                            <span className="font-semibold text-gray-700">Create</span>
                                        </div>
                                        <ChevronDown
                                            size={18}
                                            className={`text-gray-400 transition-transform duration-200 ${isCreateOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>

                                    {/* Dropdown */}
                                    {isCreateOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-2 animate-in fade-in zoom-in-95 duration-100">
                                            <button onClick={() => handleCreate('Event')} className="flex items-center gap-3 w-full p-2 hover:bg-indigo-50 rounded-lg text-gray-600 text-sm">
                                                <Calendar size={18} className="text-indigo-500" /> Event
                                            </button>
                                            <button onClick={() => handleCreate('Meeting')} className="flex items-center gap-3 w-full p-2 hover:bg-indigo-50 rounded-lg text-gray-600 text-sm">
                                                <Video size={18} className="text-purple-500" /> Meeting
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Mini Calendar */}
                                <MiniCalendar
                                    selectedDate={selectedDate}
                                    onDateSelect={setSelectedDate}
                                />

                                {/* Add Task Button (Standalone) */}
                                <button
                                    onClick={() => handleCreate('Task')}
                                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 font-semibold"
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
                    className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col"
                >
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-gray-800">
                                {new Date(selectedDate).toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </h2>
                            {sidebarMode === 'create-task' && (
                                <motion.span
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold animate-pulse"
                                >
                                    Editing Today...
                                </motion.span>
                            )}
                        </div>
                        <div className="text-sm text-gray-500">
                            7-Day View
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-50">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : (
                            <MultiDayTimeline
                                tasks={tasks}
                                startDate={selectedDate}
                                daysToShow={7}
                                attendanceData={attendanceData}
                                onEditTask={(t) => toast.info(`Edit ${t.title}`)}
                            />
                        )}
                    </div>
                </motion.div>
            </div>
        </DashboardLayout>
    );
};

export default DailyActivity;
