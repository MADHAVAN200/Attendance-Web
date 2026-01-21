import React, { useState, useEffect } from 'react';
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
    X
} from 'lucide-react';
import LeaveApplication from './LeaveApplication';

const HolidayManagement = () => {
    const { user } = useAuth();
    const [holidays, setHolidays] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('holidays'); // 'holidays' | 'leave_application'

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newHoliday, setNewHoliday] = useState({
        name: '',
        date: '',
        type: 'Public',
    });

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

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this holiday?')) {
            try {
                await holidayService.deleteHolidays([id]);
                toast.success("Holiday deleted");
                setHolidays(holidays.filter(h => h.id !== id));
            } catch (error) {
                console.error("Delete error", error);
                toast.error("Failed to delete holiday");
            }
        }
    };

    // Filter holidays based on search term
    const filteredHolidays = holidays.filter(holiday =>
        holiday.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout title="Holiday Management">
            <div className="space-y-6">


                {/* Tabs */}
                <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('holidays')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'holidays' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Holidays List
                    </button>
                    <button
                        onClick={() => setActiveTab('leave_application')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'leave_application' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Leave Application
                    </button>
                </div>

                {activeTab === 'holidays' ? (
                    <>
                        {/* Header Actions */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search holidays..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 dark:text-slate-200"
                                />
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                {user?.user_type === 'admin' && (
                                    <>
                                        <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                            <Upload size={16} />
                                            <span className="hidden sm:inline">Import CSV</span>
                                            <span className="sm:hidden">Import</span>
                                        </button>
                                        <button
                                            onClick={() => setIsAddModalOpen(true)}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors"
                                        >
                                            <Plus size={16} />
                                            <span>Add Holiday</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                                            <th className="px-6 py-4">Holiday Name</th>
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Type</th>
                                            {user?.user_type === 'admin' && <th className="px-6 py-4 text-right">Actions</th>}
                                        </tr>

                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={user?.user_type === 'admin' ? "4" : "3"} className="px-6 py-8 text-center text-slate-500">Loading holidays...</td>
                                            </tr>
                                        ) : filteredHolidays.length === 0 ? (
                                            <tr>
                                                <td colSpan={user?.user_type === 'admin' ? "4" : "3"} className="px-6 py-12 text-center text-slate-400">
                                                    <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                                    <p>No holidays found.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredHolidays.map((holiday) => (
                                                <tr key={holiday.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="font-medium text-slate-800 dark:text-white">{holiday.name}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar size={14} className="text-slate-400" />
                                                            {new Date(holiday.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' })}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${holiday.type === 'Public'
                                                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
                                                            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                                                            }`}>
                                                            {holiday.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {user?.user_type === 'admin' && (
                                                            <button
                                                                onClick={() => handleDelete(holiday.id)}
                                                                className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <LeaveApplication />
                )}

                {/* --- ADD HOLIDAY MODAL --- */}
                {isAddModalOpen && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all duration-200 animate-in fade-in">
                        <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center p-8 border-b border-slate-100 dark:border-white/10">
                                <h3 className="font-bold text-2xl text-slate-900 dark:text-white tracking-tight">Add New Holiday</h3>
                                <button
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:text-white/60 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
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
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
                                        placeholder="e.g. Independence Day"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={newHoliday.date}
                                            onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium calendar-picker-indicator-dark"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Type</label>
                                        <div className="relative">
                                            <select
                                                value={newHoliday.type}
                                                onChange={(e) => setNewHoliday({ ...newHoliday, type: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium appearance-none cursor-pointer"
                                            >
                                                <option value="Public" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-300">Public</option>
                                                <option value="Optional" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-300">Optional</option>
                                                <option value="Observance" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-300">Observance</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="flex-1 px-6 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-white border border-transparent dark:border-white/10 font-semibold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-95"
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
        </DashboardLayout >
    );
};

export default HolidayManagement;
