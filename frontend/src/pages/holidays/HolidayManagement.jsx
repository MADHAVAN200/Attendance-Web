import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { holidayService } from '../../services/holidayService';
import { toast } from 'react-toastify';
import {
    Calendar,
    Upload,
    Plus,
    Trash2,
    Search,
    X,
    FileText,
    Pencil,
    AlertTriangle,
    ChevronDown,
    Check
} from 'lucide-react';
import LeaveApplication from './LeaveApplication';
import HolidayCalendarView from '../../components/HolidayCalendarView';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from '../../components/DatePicker';

const HolidayManagement = () => {
    const navigate = useNavigate();


    const { user } = useAuth();
    const [holidays, setHolidays] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('holidays'); // 'holidays' | 'leave_application'

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('mano-active-tab', {
            detail: { tab: activeTab }
        }));
    }, [activeTab]);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
    const [newHoliday, setNewHoliday] = useState({
        name: '',
        date: '',
        type: 'Public',
    });

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isEditTypeOpen, setIsEditTypeOpen] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', date: '', type: 'Public' });

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => {},
        confirmText: 'Confirm'
    });
    const [isDeleting, setIsDeleting] = useState(false);

    // Fetch Initial Data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const holidayRes = await holidayService.getHolidays();

            if (holidayRes.ok) {
                const parsedHolidays = holidayRes.holidays.map(h => ({
                    id: h.holiday_id,
                    name: h.holiday_name,
                    date: h.holiday_date,
                    type: h.holiday_type
                }));
                setHolidays(parsedHolidays);
            }
        } catch (error) {
            console.error("Failed to load data", error);
            toast.error("Failed to load holidays");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddHoliday = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                holiday_name: newHoliday.name,
                holiday_date: newHoliday.date,
                holiday_type: newHoliday.type,
                // Defaulting to "All Locations" for DB consistency, though UI ignores it
                applicable_json: ['All Locations']
            };

            await holidayService.addHoliday(payload);
            toast.success("Holiday added successfully");
            setIsAddModalOpen(false);
            setNewHoliday({ name: '', date: '', type: 'Public' });
            loadData(); // Reload list
        } catch (error) {
            console.error("Add holiday error", error);
            toast.error(error.message);
        }
    };

    const handleDeleteClick = (holiday) => {
        setConfirmModal({
            isOpen: true,
            title: "Delete Holiday?",
            message: `Are you sure you want to remove "${holiday.name}" from the schedule? This action cannot be undone.`,
            type: 'danger',
            confirmText: "Delete",
            onConfirm: async () => {
                try {
                    setIsDeleting(true);
                    await holidayService.deleteHolidays([holiday.id]);
                    toast.success("Holiday deleted successfully");
                    setHolidays(prev => prev.filter(h => h.id !== holiday.id));
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    console.error("Delete error", error);
                    toast.error("Failed to delete holiday");
                } finally {
                    setIsDeleting(false);
                }
            }
        });
    };

    const handleEdit = (holiday) => {
        setEditingHoliday(holiday);
        setEditForm({ name: holiday.name, date: holiday.date, type: holiday.type });
        setIsEditModalOpen(true);
    };

    const handleUpdateHoliday = async (e) => {
        e.preventDefault();
        try {
            await holidayService.updateHoliday(editingHoliday.id, {
                holiday_name: editForm.name,
                holiday_date: editForm.date,
                holiday_type: editForm.type,
                applicable_json: ['All Locations']
            });
            toast.success("Holiday updated successfully");
            setIsEditModalOpen(false);
            setEditingHoliday(null);
            loadData();
        } catch (error) {
            console.error("Update holiday error", error);
            toast.error(error.message);
        }
    };

    // Filter holidays based on search term
    const filteredHolidays = holidays.filter(holiday =>
        holiday.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const [calendarDate, setCalendarDate] = useState(new Date());
    const [selectedLeave, setSelectedLeave] = useState(null);

    // Reset selected leave when tab changes to holidays
    useEffect(() => {
        if (activeTab === 'holidays') {
            setSelectedLeave(null);
        }
    }, [activeTab]);

    const handleSelectLeave = (leave) => {
        setSelectedLeave(leave);
        if (leave && leave.start_date) {
            const startDate = new Date(leave.start_date);
            if (startDate.getMonth() !== calendarDate.getMonth() || startDate.getFullYear() !== calendarDate.getFullYear()) {
                setCalendarDate(startDate);
            }
        }
    };

    // Derived lists based on calendar selection
    const selectedMonthHolidays = filteredHolidays.filter(h => {
        const d = new Date(h.date);
        return d.getMonth() === calendarDate.getMonth() && d.getFullYear() === calendarDate.getFullYear();
    });

    const upcomingHolidays = filteredHolidays.filter(h => {
        const d = new Date(h.date);
        const viewEnd = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
        return d > viewEnd;
    });

    // Helper to render a group of holidays
    const renderHolidayList = (list, title) => {
        if (list.length === 0) return null;

        // Group by Month-Year (though for selected month it will be just one group usually)
        const groups = list.reduce((groups, holiday) => {
            const date = new Date(holiday.date);
            const key = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            if (!groups[key]) groups[key] = [];
            groups[key].push(holiday);
            return groups;
        }, {});

        const sortedKeys = Object.keys(groups).sort((a, b) => {
            return new Date(groups[a][0].date) - new Date(groups[b][0].date);
        });

        return (
            <div className="space-y-4">
                {title && <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">{title}</h3>}

                <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col transition-all">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sortedKeys.map(monthYear => (
                            <div key={monthYear} className="p-5 space-y-3.5">
                                {/* Month Subheading */}
                                <div className="flex items-center justify-between pb-1">
                                    <h4 className="font-extrabold text-slate-700 dark:text-github-dark-text text-sm tracking-tight flex items-center gap-2">
                                        <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full"></span>
                                        {monthYear}
                                    </h4>
                                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-500 dark:text-github-dark-muted border border-slate-150 dark:border-github-dark-border/40">
                                        {groups[monthYear].length} {groups[monthYear].length === 1 ? 'Holiday' : 'Holidays'}
                                    </span>
                                </div>

                                {/* List of Holidays */}
                                <div className="space-y-2.5">
                                    {groups[monthYear].sort((a, b) => new Date(a.date) - new Date(b.date)).map(holiday => (
                                        <div key={holiday.id} className="p-3 bg-slate-50/30 dark:bg-github-dark-subtle/10 border border-slate-150 dark:border-github-dark-border rounded-xl hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all group flex items-center gap-4">
                                            {/* Date Box */}
                                            <div className="shrink-0 w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex flex-col items-center justify-center border border-indigo-100 dark:border-indigo-800/30">
                                                <span className="text-[9px] font-black uppercase leading-none opacity-60 mb-0.5">
                                                    {new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                                </span>
                                                <span className="text-lg font-black leading-tight">
                                                    {new Date(holiday.date).getDate()}
                                                </span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-col">
                                                    <h4 className="font-bold text-sm text-slate-800 dark:text-github-dark-text truncate">
                                                        {holiday.name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${holiday.type === 'Public'
                                                            ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800/50'
                                                            : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/50'
                                                            }`}>
                                                            {holiday.type}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Visible Action Buttons */}
                                            {['admin', 'hr'].includes(user?.user_type) && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        onClick={() => handleEdit(holiday)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                                                        title="Edit Holiday"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(holiday)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                        title="Delete Holiday"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // Check if we should hide side calendar: Only if Admin AND on Leave Application tab
    const isLeaveAppAdmin = activeTab === 'leave_application' && user?.user_type === 'admin';

    return (
        <DashboardLayout title="Holiday Management" noPadding={true}>
            <div className="h-[calc(100vh-64px)] p-6 space-y-6 overflow-hidden flex flex-col">

                <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">

                    {/* Left Content Area (Shared) */}
                    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl border border-slate-200 dark:border-github-dark-border p-1 transition-all duration-300">

                        {/* Tabs */}
                        <div className="flex space-x-1 bg-slate-100 dark:bg-github-dark-subtle p-1 rounded-xl w-fit mb-4 mx-4 mt-4">
                            <button
                                onClick={() => setActiveTab('holidays')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'holidays'
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                            >
                                <Calendar size={16} className={`${activeTab === 'holidays' ? 'text-indigo-500' : 'text-slate-400'} -mt-[1px]`} />
                                <span className="leading-none">Holidays List</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('leave_application')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'leave_application'
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                            >
                                <FileText size={16} className={`${activeTab === 'leave_application' ? 'text-indigo-500' : 'text-slate-400'} -mt-[1px]`} />
                                <span className="leading-none">Leave Application</span>
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4">
                            {activeTab === 'holidays' ? (
                                <div className="space-y-6">
                                    {/* Header Actions */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                                        <div className="flex items-center gap-4 w-full sm:w-auto">
                                            <div className="relative w-full">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input
                                                    type="text"
                                                    placeholder="Search holidays..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 dark:text-github-dark-text"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-3 w-full sm:w-auto">
                                            {['admin', 'hr'].includes(user?.user_type) && (
                                                <>
                                                    <button 
                                                        onClick={() => navigate('/holidays/bulk')}
                                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-github-dark-text rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                                        <Upload size={16} />
                                                        <span className="hidden sm:inline">Import</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setIsAddModalOpen(true)}
                                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors"
                                                    >
                                                        <Plus size={16} />
                                                        <span>Add</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* List */}
                                    <div className="space-y-4">
                                        {isLoading ? (
                                            <div className="py-12 text-center text-slate-500">Loading holidays...</div>
                                        ) : filteredHolidays.length === 0 ? (
                                            <div className="py-12 text-center text-slate-400">
                                                <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                                <p>No holidays found.</p>
                                            </div>
                                        ) : (
                                            <>
                                                {selectedMonthHolidays.length > 0 ? (
                                                    renderHolidayList(selectedMonthHolidays, "Selected Month")
                                                ) : (
                                                    <div className="text-center py-8 bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-github-dark-border">
                                                        <p className="text-slate-500 text-sm">No holidays in {calendarDate.toLocaleString('default', { month: 'long' })}</p>
                                                    </div>
                                                )}

                                                {upcomingHolidays.length > 0 && renderHolidayList(upcomingHolidays, "Upcoming Holidays")}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <LeaveApplication onSelectLeave={handleSelectLeave} />
                            )}
                        </div>
                    </div>

                    {/* Calendar Sidebar (Always Visible) */}
                    <div className="w-full xl:w-2/5 overflow-hidden animate-in fade-in slide-in-from-right-10 duration-500">
                        <HolidayCalendarView
                            holidays={filteredHolidays}
                            selectedLeave={selectedLeave}
                            onDelete={handleDeleteClick}
                            isAdmin={['admin', 'hr'].includes(user?.user_type)}
                            currentDate={calendarDate}
                            onDateChange={setCalendarDate}
                        />
                    </div>
                </div>

                {/* --- ADD HOLIDAY MODAL --- */}
                {isAddModalOpen && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all duration-200 animate-in fade-in">
                        <div className="w-full max-w-4xl bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center p-8 border-b border-slate-100 dark:border-white/10">
                                <h3 className="font-bold text-2xl text-slate-900 dark:text-github-dark-text tracking-tight">Add New Holiday</h3>
                                <button
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:text-github-dark-text/60 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                >
                                    <X size={28} />
                                </button>
                            </div>
                            <form onSubmit={handleAddHoliday} className="p-8 space-y-8">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Holiday Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newHoliday.name}
                                        onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
                                        placeholder="e.g. Independence Day"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="relative z-50">
                                        <DatePicker
                                            label="Date"
                                            value={newHoliday.date}
                                            onChange={(val) => setNewHoliday({ ...newHoliday, date: val })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Type</label>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsAddTypeOpen(!isAddTypeOpen)}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-left flex items-center justify-between"
                                            >
                                                <span>{newHoliday.type}</span>
                                                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isAddTypeOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            <AnimatePresence>
                                                {isAddTypeOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-[100]" onClick={() => setIsAddTypeOpen(false)} />
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -10 }}
                                                            className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg shadow-2xl overflow-hidden z-[110]"
                                                        >
                                                            <div className="py-1">
                                                                {['Public', 'Optional', 'Observance'].map((opt) => {
                                                                    const isSelected = newHoliday.type === opt;
                                                                    return (
                                                                        <button
                                                                            key={opt}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setNewHoliday({ ...newHoliday, type: opt });
                                                                                setIsAddTypeOpen(false);
                                                                            }}
                                                                            className={`w-full px-4 py-2.5 text-sm text-left font-medium transition-colors flex items-center justify-between ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                                                        >
                                                                            <span>{opt}</span>
                                                                            {isSelected && <Check size={14} className="text-indigo-500" />}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </motion.div>
                                                    </>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="flex-1 px-6 py-3.5 rounded-lg bg-slate-100 dark:bg-github-dark-subtle/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-github-dark-text border border-transparent dark:border-white/10 font-semibold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-95"
                                    >
                                        Add Holiday
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body
                )}

            </div>

            <AnimatePresence>
                {isEditModalOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsEditModalOpen(false)}
                            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
                        />

                        {/* Sidebar Drawer */}
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-full w-full max-w-[460px] z-50 bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                        <Calendar size={20} />
                                    </div>
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-github-dark-text">Edit Holiday</h3>
                                </div>
                                <button
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body */}
                            <form onSubmit={handleUpdateHoliday} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-300">Holiday Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-sm"
                                        placeholder="e.g. Independence Day"
                                    />
                                </div>

                                <div className="space-y-6">
                                    <div className="relative z-50">
                                        <DatePicker
                                            label="Date"
                                            value={editForm.date}
                                            onChange={(val) => setEditForm({ ...editForm, date: val })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-300">Type</label>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsEditTypeOpen(!isEditTypeOpen)}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-sm text-left flex items-center justify-between"
                                            >
                                                <span>{editForm.type}</span>
                                                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isEditTypeOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            <AnimatePresence>
                                                {isEditTypeOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-[100]" onClick={() => setIsEditTypeOpen(false)} />
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -10 }}
                                                            className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg shadow-2xl overflow-hidden z-[110]"
                                                        >
                                                            <div className="py-1">
                                                                {['Public', 'Optional', 'Observance'].map((opt) => {
                                                                    const isSelected = editForm.type === opt;
                                                                    return (
                                                                        <button
                                                                            key={opt}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setEditForm({ ...editForm, type: opt });
                                                                                setIsEditTypeOpen(false);
                                                                            }}
                                                                            className={`w-full px-4 py-2.5 text-sm text-left font-medium transition-colors flex items-center justify-between ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                                                        >
                                                                            <span>{opt}</span>
                                                                            {isSelected && <Check size={14} className="text-indigo-500" />}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </motion.div>
                                                    </>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="pt-6 border-t border-slate-100 dark:border-github-dark-border/50 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-github-dark-muted hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        Update Holiday
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </>
                )}

                {confirmModal.isOpen && (
                    <ConfirmationModal
                        {...confirmModal}
                        isSubmitting={isDeleting}
                        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    />
                )}
            </AnimatePresence>
        </DashboardLayout >
    );
};

export default HolidayManagement;
