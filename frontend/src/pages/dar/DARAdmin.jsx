import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../../components/DashboardLayout';
import {
    Settings,
    BarChart3,
    FileText,
    Download,
    Plus,
    Trash2,
    Save,
    Search,
    Calendar,
    Users,
    X
} from 'lucide-react';
import {
    PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, CartesianGrid
} from 'recharts';
import RequestReviewModal from '../../components/dar/RequestReviewModal';
import MiniCalendar from '../../components/dar/MiniCalendar';

const DARAdmin = () => {
    const [activeTab, setActiveTab] = useState('insights'); // 'insights' | 'settings' | 'data'

    // --- MOCK DATA ---
    const [categories, setCategories] = useState([
        "Site Visit", "Inspection", "Material Management", "Client Meeting", "Documentation", "Safety Check"
    ]);
    const [newCat, setNewCat] = useState("");
    const [bufferTime, setBufferTime] = useState(30);

    // --- CHART DATA ---
    const categoryData = [
        { name: 'Site Visit', value: 45, color: '#6366f1' }, // Indigo 500
        { name: 'Inspection', value: 25, color: '#10b981' }, // Emerald 500
        { name: 'Documentation', value: 20, color: '#f59e0b' }, // Amber 500
        { name: 'Meetings', value: 10, color: '#ef4444' }, // Red 500
    ];

    const complianceData = [
        { day: 'Mon', submitted: 18, pending: 2 },
        { day: 'Tue', submitted: 19, pending: 1 },
        { day: 'Wed', submitted: 17, pending: 3 },
        { day: 'Thu', submitted: 20, pending: 0 },
        { day: 'Fri', submitted: 18, pending: 2 },
        { day: 'Sat', submitted: 15, pending: 5 },
        { day: 'Sun', submitted: 12, pending: 8 },
    ];

    const topContributors = [
        { name: 'John Civil', hours: 42 },
        { name: 'Sarah Engineer', hours: 38 },
        { name: 'Mike Foreman', hours: 35 },
        { name: 'Alex Field', hours: 30 },
        { name: 'David Site', hours: 28 },
    ];

    // Filters
    const [selectedShift, setSelectedShift] = useState('General'); // General, Morning, Night
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedRequest, setSelectedRequest] = useState(null);
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

    const [selectedCategory, setSelectedCategory] = useState("All Categories");
    const [selectedEmployee, setSelectedEmployee] = useState("All Employees");

    // Mock Users & Activities Map
    const allTimelineData = [
        {
            id: 101, name: "John Civil", role: "Site Engineer", activities: [
                { id: 1, start: 9, end: 10.5, category: "Site Visit", title: "Site A Inspection" },
                { id: 4, start: 16.5, end: 17.5, category: "Documentation", title: "Daily Report" }
            ]
        },
        {
            id: 102, name: "Sarah Engineer", role: "Project Manager", activities: [
                { id: 2, start: 11, end: 12, category: "Meeting", title: "Client Update" },
                { id: 5, start: 13, end: 15, category: "Inspection", title: "Quality Check" }
            ]
        },
        {
            id: 103, name: "Mike Foreman", role: "Foreman", activities: [
                { id: 3, start: 14, end: 16, category: "Material", title: "Cement Unloading" }
            ]
        },
        {
            id: 104, name: "Alex Field", role: "Surveyor", activities: [] // No activities
        }
    ];

    // Filter Logic
    const filteredTimelineData = allTimelineData.filter(user => {
        // 1. Filter by Employee
        if (selectedEmployee !== "All Employees" && user.name !== selectedEmployee) return false;
        return true;
    }).map(user => {
        // 2. Filter Activities by Category
        const filteredActivities = user.activities.filter(act => {
            if (selectedCategory !== "All Categories" && act.category !== selectedCategory) return false;
            return true;
        });
        return { ...user, activities: filteredActivities };
    });

    // Mock employees list based on data
    const employees = ["All Employees", ...allTimelineData.map(u => u.name)];

    // Shift Logic
    const SHIFTS = {
        'Morning': { start: 6, end: 14, label: "Morning (6 AM - 2 PM)" },
        'General': { start: 9, end: 18, label: "General (9 AM - 6 PM)" },
        'Night': { start: 18, end: 26, label: "Night (6 PM - 2 AM)" }, // 26 = 2 AM next day
    };

    const currentShift = SHIFTS[selectedShift];
    const timeSlots = [];
    for (let i = currentShift.start; i <= currentShift.end; i++) {
        timeSlots.push(i);
    }

    // --- HANDLERS ---
    const handleAddCategory = () => {
        if (newCat.trim()) {
            setCategories([...categories, newCat.trim()]);
            setNewCat("");
        }
    };

    const handleRemoveCategory = (cat) => {
        setCategories(categories.filter(c => c !== cat));
    };

    const formatTime = (val) => {
        const normalized = val >= 24 ? val - 24 : val;
        const h = Math.floor(normalized);
        const m = (normalized - h) * 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}${m > 0 ? ':' + m : ''} ${ampm}`;
    };

    return (
        <DashboardLayout title="DAR Admin Panel">
            <div className="flex flex-col h-[calc(100vh-140px)] gap-6">

                {/* Tabs Header */}
                <div className="flex items-center gap-1 bg-white dark:bg-dark-card p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-fit">
                    {[
                        { id: 'insights', icon: <BarChart3 size={16} />, label: 'Insights' },
                        { id: 'data', icon: <FileText size={16} />, label: 'Master Data' },
                        { id: 'settings', icon: <Settings size={16} />, label: 'Configuration' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden">

                    {/* --- CONFIGURATION TAB --- */}
                    {activeTab === 'settings' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full overflow-y-auto pb-10">
                            {/* Category Manager */}
                            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Activity Categories</h3>
                                <p className="text-sm text-slate-500 mb-6">Define the list of activities users can select. This will appear in their dropdown.</p>

                                <div className="flex gap-2 mb-6">
                                    <input
                                        type="text"
                                        value={newCat}
                                        onChange={(e) => setNewCat(e.target.value)}
                                        placeholder="Enter new category (e.g. 'Safety Check')"
                                        className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                                    />
                                    <button
                                        onClick={handleAddCategory}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                    {categories.map((cat, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl group hover:border-indigo-100 transition-colors">
                                            <span className="font-semibold text-slate-700 dark:text-slate-200">{cat}</span>
                                            <button
                                                onClick={() => handleRemoveCategory(cat)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* General Settings */}
                            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 h-fit">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">General Configuration</h3>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                            DAR Buffer Time (Minutes)
                                        </label>
                                        <p className="text-xs text-slate-500 mb-3">
                                            Grace period allowing users to log tasks into the near future.
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={bufferTime}
                                                onChange={(e) => setBufferTime(e.target.value)}
                                                className="w-24 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-center"
                                            />
                                            <span className="text-sm font-medium text-slate-500">minutes</span>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                                        <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold shadow-lg shadow-slate-200 dark:shadow-none hover:translate-y-[-2px] transition-transform">
                                            <Save size={18} />
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- MASTER DATA TAB (TIMELINE VIEW) --- */}
                    {activeTab === 'data' && (
                        <div className="flex flex-col h-full bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">

                            {/* Toolbar */}
                            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap gap-4 items-center justify-between bg-white dark:bg-dark-card z-20">
                                <div className="flex items-center gap-3">
                                    {/* Shift Selector */}
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                        {Object.keys(SHIFTS).map(shift => (
                                            <button
                                                key={shift}
                                                onClick={() => setSelectedShift(shift)}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${selectedShift === shift ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                            >
                                                {shift}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>

                                    {/* Date Picker using MiniCalendar (Portal) */}
                                    <div className="relative">
                                        <button
                                            ref={buttonRef}
                                            onClick={toggleCalendar}
                                            className="flex items-center gap-2 pl-3 pr-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                        >
                                            <Calendar size={16} className="text-indigo-500" />
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                {new Date(selectedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                                                        maxWidth: '350px'
                                                    }}
                                                >
                                                    <MiniCalendar
                                                        selectedDate={selectedDate}
                                                        onDateSelect={(range) => {
                                                            setSelectedDate(range.start);
                                                            setShowCalendar(false);
                                                        }}
                                                    />
                                                </div>
                                            </div>,
                                            document.body
                                        )}
                                    </div>

                                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>

                                    {/* Filters */}
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <select
                                                className="pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-bold border-none outline-none appearance-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors w-32"
                                                value={selectedCategory}
                                                onChange={(e) => setSelectedCategory(e.target.value)}
                                            >
                                                <option>All Categories</option>
                                                {categories.map(c => <option key={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="relative">
                                            <Users size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <select
                                                className="pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-bold border-none outline-none appearance-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors w-32"
                                                value={selectedEmployee}
                                                onChange={(e) => setSelectedEmployee(e.target.value)}
                                            >
                                                {employees.map(e => <option key={e}>{e}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 mr-4">
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded bg-indigo-200 dark:bg-indigo-900/50"></div>
                                            <span className="text-xs text-slate-500">Task Logged</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-dashed"></div>
                                            <span className="text-xs text-slate-500">Empty</span>
                                        </div>
                                    </div>
                                    <button className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors">
                                        <Download size={16} /> Export
                                    </button>
                                </div>
                            </div>

                            {/* Timeline Grid */}
                            <div className="flex-1 overflow-auto relative custom-scrollbar">
                                <div className="min-w-[800px]">
                                    {/* Table Header (Time Slots) */}
                                    <div className="flex border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                                        <div className="w-48 p-3 text-xs font-bold text-slate-500 uppercase flex-shrink-0 sticky left-0 bg-slate-50 dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 z-20">
                                            Employee
                                        </div>
                                        <div className="flex-1 flex">
                                            {timeSlots.map(hour => (
                                                <div key={hour} className="flex-1 min-w-[60px] p-3 text-center border-r border-dashed border-slate-200 dark:border-slate-700/50 last:border-none">
                                                    <span className="text-[10px] font-bold text-slate-500">{formatTime(hour)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Rows */}
                                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {filteredTimelineData.map(user => (
                                            <div key={user.id} className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                                {/* User Info Column */}
                                                <div className="w-48 p-4 flex flex-col justify-center border-r border-slate-100 dark:border-slate-700 flex-shrink-0 sticky left-0 bg-white dark:bg-dark-card group-hover:bg-slate-50 dark:group-hover:bg-slate-800 z-10">
                                                    <span className="text-sm font-bold text-slate-800 dark:text-white truncate">{user.name}</span>
                                                    <span className="text-xs text-slate-400 truncate">{user.role}</span>
                                                    {user.activities.length === 0 && (
                                                        <span className="text-[10px] text-red-400 font-medium mt-1 flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> No DAR
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Time Slots & Bars */}
                                                <div className="flex-1 flex relative py-2">
                                                    {/* Background Grid Lines */}
                                                    {timeSlots.map(hour => (
                                                        <div key={hour} className="flex-1 min-w-[60px] border-r border-dashed border-slate-100 dark:border-slate-700/30 h-full absolute" style={{
                                                            left: `${((hour - currentShift.start) / (currentShift.end - currentShift.start + 1)) * 100}%`,
                                                            width: `${(1 / (currentShift.end - currentShift.start + 1)) * 100}%`
                                                        }}></div>
                                                    ))}

                                                    {/* Activities Bars */}
                                                    <div className="relative w-full h-full min-h-[50px]">
                                                        {user.activities.map(act => {
                                                            // Calculate positioning
                                                            const totalHours = currentShift.end - currentShift.start + 1;
                                                            const offset = act.start - currentShift.start;
                                                            const duration = act.end - act.start;

                                                            // Only render if within view
                                                            if (act.end <= currentShift.start || act.start >= currentShift.end + 1) return null;

                                                            const leftPct = (offset / totalHours) * 100;
                                                            const widthPct = (duration / totalHours) * 100;

                                                            return (
                                                                <div
                                                                    key={act.id}
                                                                    className="absolute top-1/2 -translate-y-1/2 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700/50 flex items-center px-2 overflow-hidden hover:z-10 hover:scale-[1.02] transition-all cursor-pointer shadow-sm"
                                                                    style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.min(100, widthPct)}%` }}
                                                                    title={`${act.title} (${act.category})\n${formatTime(act.start)} - ${formatTime(act.end)}`}
                                                                >
                                                                    <div className="flex flex-col overflow-hidden">
                                                                        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 truncate leading-tight">{act.title}</span>
                                                                        <span className="text-[9px] text-indigo-500 dark:text-indigo-400 truncate uppercase tracking-wider">{act.category}</span>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}


                    {/* --- INSIGHTS TAB --- */}
                    {/* --- INSIGHTS TAB --- */}
                    {activeTab === 'insights' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-y-auto pb-10 custom-scrollbar">

                            {/* Row 1: Key Metrics (Condensed) */}
                            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <div>
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">Submission Rate</div>
                                        <div className="text-3xl font-black text-slate-800 dark:text-white">92%</div>
                                        <div className="text-xs text-emerald-500 font-bold mt-1">18/20 Employees</div>
                                    </div>
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-full">
                                        <FileText size={24} className="text-emerald-500" />
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <div>
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">Top Activity</div>
                                        <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 truncate">Site Visit</div>
                                        <div className="text-xs text-slate-400 font-bold mt-1">45% of total time</div>
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-full">
                                        <BarChart3 size={24} className="text-indigo-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Chart 1: Hours by Category (Donut) */}
                            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                                    <PieChart size={20} className="text-indigo-500" /> Hours by Category
                                </h3>
                                <div className="flex-1 w-full min-h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={categoryData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {categoryData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Chart 2: Daily Submission Compliance (Bar) */}
                            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                                    <Users size={20} className="text-emerald-500" /> Submission Compliance
                                </h3>
                                <div className="flex-1 w-full min-h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={complianceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                                            <Tooltip
                                                cursor={{ fill: '#F1F5F9' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" height={36} iconType="circle" />
                                            <Bar dataKey="submitted" name="Submitted" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} barSize={30} />
                                            <Bar dataKey="pending" name="Pending" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={30} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Chart 3: Pending DAR Edit Requests */}
                            <div className="lg:col-span-2 bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                                    <FileText size={20} className="text-amber-500" /> Pending Edit Requests
                                </h3>

                                <div className="flex-1 w-full flex flex-col gap-3">
                                    {/* Mock Requests */}
                                    {[{
                                        id: 101,
                                        user: "John Civil",
                                        date: "2024-01-19",
                                        changes: 2,
                                        employeeName: "John Civil",
                                        originalTasks: [
                                            { id: 1, title: "Site A Inspection", startTime: "09:00", endTime: "11:00", type: "SITE_VISIT" },
                                            { id: 2, title: "Cement Unloading", startTime: "11:30", endTime: "13:00", type: "LOGISTICS" },
                                            { id: 3, title: "Client Meeting", startTime: "14:00", endTime: "15:00", type: "MEETING" },
                                        ],
                                        proposedTasks: [
                                            { id: 1, title: "Site A Inspection", startTime: "09:00", endTime: "11:30", type: "SITE_VISIT" }, // Extended
                                            { id: 3, title: "Client Meeting", startTime: "15:00", endTime: "16:00", type: "MEETING" }, // Moved
                                            { id: 4, title: "Material Check", startTime: "11:30", endTime: "12:30", type: "LOGISTICS" }, // New
                                        ]
                                    }, {
                                        id: 102,
                                        user: "Sarah Engineer",
                                        date: "2024-01-18",
                                        changes: 1,
                                        employeeName: "Sarah Engineer",
                                        originalTasks: [
                                            { id: 10, title: "Safety Briefing", startTime: "08:00", endTime: "09:00", type: "MEETING" },
                                            { id: 11, title: "Equipment Check", startTime: "09:00", endTime: "10:00", type: "LOGISTICS" }
                                        ],
                                        proposedTasks: [
                                            { id: 10, title: "Safety Briefing", startTime: "08:30", endTime: "09:30", type: "MEETING" }, // Shifted
                                            { id: 11, title: "Equipment Check", startTime: "09:30", endTime: "10:30", type: "LOGISTICS" }
                                        ]
                                    }].map(req => (
                                        <div key={req.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 dark:text-white">{req.user}</span>
                                                <span className="text-xs text-slate-500">Requested for <span className="font-mono">{req.date}</span> • {req.changes} changes</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    // Trigger Modal (Pass full req object)
                                                    setSelectedRequest(req);
                                                }}
                                                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition"
                                            >
                                                Review Changes
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}

                    {/* Diff Modal */}
                    {/* Premium Diff Review Modal */}
                    <RequestReviewModal
                        isOpen={!!selectedRequest}
                        onClose={() => setSelectedRequest(null)}
                        request={selectedRequest}
                    />

                </div >
            </div >
        </DashboardLayout >
    );
};

export default DARAdmin;
