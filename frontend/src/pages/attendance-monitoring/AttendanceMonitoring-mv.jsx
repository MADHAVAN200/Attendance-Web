import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    Search, Filter, Clock, UserCheck, UserX, Activity, MapPin, Calendar,
    ChevronDown, FileText, CheckCircle, XCircle, AlertCircle, X, LogIn,
    LogOut, History, PieChart as PieChartIcon, BarChart as BarChartIcon,
    RefreshCcw, MoreVertical, LayoutGrid, ArrowRight, Eye, Info,
    ChevronRight, ChevronLeft, Map, Camera
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { attendanceService } from '../../services/attendanceService';
import DatePicker from '../../components/DatePicker';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Tooltip as MapTooltip } from "react-leaflet";
import MarkerClusterGroup from 'react-leaflet-cluster';
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for Leaflet default icon issues in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MobileAttendanceMonitoring = () => {
    const { avatarTimestamp, user: currentUser } = useAuth();
    const MAIN_TABS = ['dashboard', 'requests'];
    const SUB_TABS = [
        { id: 'overview', label: 'Overview', icon: LayoutGrid },
        { id: 'analytics', label: 'Analytics', icon: BarChartIcon },
        { id: 'timeline', label: 'Timeline', icon: History },
        { id: 'map', label: 'Map View', icon: MapPin }
    ];

    // UI State
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'requests'
    const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'analytics' | 'timeline' | 'map'
    const [direction, setDirection] = useState(0); // -1 for left, 1 for right
    const [loading, setLoading] = useState(true);
    const [lastSynced, setLastSynced] = useState(new Date());
    const [activeTheme, setActiveTheme] = useState('voyager');
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

    const MAP_THEMES = {
        dark: { name: 'Night Mode', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
        light: { name: 'Light Mode', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
        voyager: { name: 'Day Mode', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' },
        satellite: { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
        streets: { name: 'Streets', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' }
    };

    // Data State
    const [attendanceData, setAttendanceData] = useState([]);
    const [stats, setStats] = useState({ present: 0, late: 0, absent: 0, active: 0 });
    const [correctionRequests, setCorrectionRequests] = useState([]);
    const [requestCount, setRequestCount] = useState(0);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState('All');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Selection/Popup State
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [requestSubTab, setRequestSubTab] = useState('PENDING');

    const DEPARTMENTS = ['All', 'Sales', 'Retail', 'Logistics', 'Operations', 'IT', 'HR'];

    const handleTabChange = (newTab) => {
        const currentIndex = MAIN_TABS.indexOf(activeTab);
        const newIndex = MAIN_TABS.indexOf(newTab);
        setDirection(newIndex > currentIndex ? 1 : -1);
        setActiveTab(newTab);
    };

    const handlePrevDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() - 1);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const handleNextDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + 1);
        const today = new Date().toISOString().split('T')[0];
        if (date.toISOString().split('T')[0] <= today) {
            setSelectedDate(date.toISOString().split('T')[0]);
        }
    };

    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    const handleDragEnd = (event, info) => {
        const swipeThreshold = 50;
        
        if (activeTab === 'dashboard') {
            const currentIndex = SUB_TABS.findIndex(t => t.id === activeSubTab);
            if (info.offset.x < -swipeThreshold && currentIndex < SUB_TABS.length - 1) {
                setActiveSubTab(SUB_TABS[currentIndex + 1].id);
            } else if (info.offset.x > swipeThreshold && currentIndex > 0) {
                setActiveSubTab(SUB_TABS[currentIndex - 1].id);
            }
        }
    };

    const slideVariants = {
        enter: (direction) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0
        }),
        center: {
            x: 0,
            opacity: 1
        },
        exit: (direction) => ({
            x: direction < 0 ? '100%' : '-100%',
            opacity: 0
        })
    };

    // --- DATA FETCHING (Feature Parity with Web) ---
    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [usersRes, attendanceRes, requestsRes] = await Promise.all([
                adminService.getAllUsers(),
                attendanceService.getRealTimeAttendance(selectedDate),
                attendanceService.getCorrectionRequests({ limit: 50 })
            ]);

            const users = (usersRes.users || []).filter(u => u.is_active && !u.is_deleted);
            const records = attendanceRes.data || [];
            const requests = requestsRes.data || [];

            // Merge Data Logic (Synchronized with Web)
            const mergedData = users.map(user => {
                const userRecords = records.filter(r => r.user_id === user.user_id);
                
                let sessions = [];
                let totalMin = 0;
                let status = 'Absent';
                let lastLocation = '-';

                if (userRecords.length > 0) {
                    sessions = userRecords.map(r => {
                        const inTime = new Date(r.time_in);
                        const formatTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        
                        let outStr = '-';
                        let isActive = true;
                        let durationMin = 0;

                        if (r.time_out) {
                            const outTime = new Date(r.time_out);
                            outStr = formatTime(outTime);
                            isActive = false;
                            durationMin = Math.max(0, (outTime - inTime) / 60000);
                            totalMin += durationMin;
                        } else {
                            durationMin = Math.max(0, (new Date() - inTime) / 60000);
                            totalMin += durationMin;
                        }

                        const sessionHours = `${(durationMin / 60).toFixed(1)} hrs`;

                        return {
                            rawIn: inTime,
                            rawOut: r.time_out ? new Date(r.time_out) : null,
                            in: formatTime(inTime),
                            out: outStr,
                            isActive,
                            inLocation: r.time_in_address || 'Unknown',
                            outLocation: r.time_out_address || null,
                            isLate: (r.late_minutes || 0) > 0,
                            lateReason: r.late_reason,
                            inImage: r.time_in_image,
                            outImage: r.time_out_image,
                            inLat: r.time_in_lat,
                            inLng: r.time_in_lng,
                            outLat: r.time_out_lat,
                            outLng: r.time_out_lng,
                            hours: sessionHours
                        };
                    });

                    const latest = userRecords[0];
                    lastLocation = latest.time_in_address || 'Unknown';
                    const isCurrentlyActive = sessions.some(s => s.isActive);

                    if (isCurrentlyActive) {
                        status = (latest.late_minutes > 0) ? 'Late Active' : 'Active';
                    } else {
                        status = userRecords.some(r => r.late_minutes > 0) ? 'Late' : 'Present';
                    }
                }

                return {
                    id: user.user_id,
                    name: user.user_name || 'Unknown',
                    role: user.desg_name || 'Employee',
                    avatar: user.profile_image_url || (user.user_name || 'U').charAt(0).toUpperCase(),
                    department: user.dept_name || 'General',
                    status,
                    sessions,
                    totalHours: totalMin > 0 ? `${(totalMin / 60).toFixed(1)} hrs` : '-',
                    location: lastLocation
                };
            });

            // Sort: Active/Present first
            mergedData.sort((a, b) => {
                const priority = { 'Active': 1, 'Late Active': 2, 'Late': 3, 'Present': 4, 'Absent': 5 };
                return (priority[a.status] || 99) - (priority[b.status] || 99);
            });

            setAttendanceData(mergedData);
            setStats({
                present: mergedData.filter(d => d.status !== 'Absent').length,
                late: mergedData.filter(d => d.status.includes('Late')).length,
                absent: mergedData.filter(d => d.status === 'Absent').length,
                active: mergedData.filter(d => d.status.includes('Active')).length
            });

            setCorrectionRequests(requests);
            setRequestCount(requests.filter(r => (r.status || '').toLowerCase() === 'pending').length);

        } catch (error) {
            console.error("Sync failed", error);
        } finally {
            if (!silent) setLoading(false);
            setLastSynced(new Date());
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => fetchData(true), 15000);
        return () => clearInterval(interval);
    }, [selectedDate]);

    // Theme Sync Effect
    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        setActiveTheme(isDark ? 'dark' : 'voyager');

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const darkActive = document.documentElement.classList.contains('dark');
                    setActiveTheme(darkActive ? 'dark' : 'voyager');
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    // --- ANALYTICS DATA PROCESSING (Ported from Web) ---
    const chartData = useMemo(() => {
        if (!attendanceData.length) return { status: [], timeline: [], departments: [], frequency: [] };

        // 1. Status Pie
        const active = attendanceData.filter(d => d.status.includes('Active')).length;
        const present = attendanceData.filter(d => d.status === 'Present').length;
        const late = attendanceData.filter(d => d.status === 'Late').length;
        const absent = attendanceData.filter(d => d.status === 'Absent').length;

        const status = [
            { name: 'Active', value: active, color: '#3b82f6' },
            { name: 'Present', value: present, color: '#10b981' },
            { name: 'Late', value: late, color: '#f59e0b' },
            { name: 'Absent', value: absent, color: '#ef4444' },
        ].filter(d => d.value > 0);

        // 2. Timeline (Hourly with Repeats)
        const hourlyData = {};
        for (let i = 0; i <= 23; i++) hourlyData[i] = { checkins: 0, repeats: 0, active: 0 };
        
        attendanceData.forEach(item => {
            item.sessions.forEach((s, idx) => {
                const h = s.rawIn.getHours();
                if (hourlyData.hasOwnProperty(h)) {
                    if (idx === 0) hourlyData[h].checkins++;
                    else hourlyData[h].repeats++;
                }
                
                const outH = s.rawOut ? s.rawOut.getHours() : 23;
                for (let j = h; j <= outH; j++) {
                    if (hourlyData.hasOwnProperty(j)) hourlyData[j].active++;
                }
            });
        });

        const timeline = Object.keys(hourlyData).map(key => {
            const h = parseInt(key);
            const label = h === 0 ? '12AM' : h === 12 ? '12PM' : h > 12 ? `${h-12}PM` : `${h}AM`;
            return {
                time: label,
                checkins: hourlyData[key].checkins,
                repeats: hourlyData[key].repeats,
                active: hourlyData[key].active
            };
        });

        // 3. Department Breakdown
        const deptStats = {};
        attendanceData.forEach(item => {
            const dept = item.department || 'General';
            if (!deptStats[dept]) deptStats[dept] = { name: dept, Present: 0, Absent: 0, Late: 0 };

            if (item.status === 'Absent') deptStats[dept].Absent++;
            else if (item.status.includes('Late')) deptStats[dept].Late++;
            else deptStats[dept].Present++;
        });
        const departments = Object.values(deptStats);

        // 4. Login Frequency
        const freq = { '1 Session': 0, '2 Sessions': 0, '3 Sessions': 0, '4+ Sessions': 0 };
        attendanceData.forEach(item => {
            if (item.status !== 'Absent') {
                const count = item.sessions.length;
                if (count === 1) freq['1 Session']++;
                else if (count === 2) freq['2 Sessions']++;
                else if (count === 3) freq['3 Sessions']++;
                else if (count >= 4) freq['4+ Sessions']++;
            }
        });
        const frequency = Object.entries(freq).map(([name, value]) => ({ name, value }));

        return { status, timeline, departments, frequency };
    }, [attendanceData]);

    // --- FILTERED DATA ---
    const filteredEmployees = attendanceData.filter(e => {
        const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDept === 'All' || e.department === selectedDept;
        return matchesSearch && matchesDept;
    });

    const activeEmployees = filteredEmployees.filter(e => e.status !== 'Absent');
    const absentEmployees = filteredEmployees.filter(e => e.status === 'Absent');

    return (
        <MobileDashboardLayout title="Live Attendance">
            <div className="min-h-screen bg-slate-50 dark:bg-github-dark-bg transition-colors duration-300 pb-24">
                
                {/* --- STANDARDIZED PILL TAB BAR --- */}
                <div className="sticky top-0 z-20 bg-white dark:bg-black px-4 py-3 border-b border-slate-100 dark:border-slate-800 transition-all duration-300">
                    <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1.5 flex rounded-2xl backdrop-blur-md mb-4">
                        {MAIN_TABS.map((tab) => {
                            const isActive = activeTab === tab;
                            const label = tab === 'dashboard' ? 'Live Dashboard' : 'Correction Requests';
                            const Icon = tab === 'dashboard' ? Activity : FileText;
                            
                            return (
                                <button
                                    key={tab}
                                    onClick={() => handleTabChange(tab)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 relative ${
                                        isActive 
                                             ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 transform scale-[1.02] shadow-sm' 
                                             : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                                     }`}
                                 >
                                     <Icon size={14} className={`${isActive ? 'text-indigo-500' : 'text-slate-400'} -mt-[1px]`} />
                                     <span className="truncate leading-none">{label}</span>
                                    {tab === 'requests' && requestCount > 0 && !isActive && (
                                        <span className="ml-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                                            {requestCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Sub-Navigation Bar (Matching Screenshot Style) */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-6 px-2 overflow-x-auto no-scrollbar border-b border-slate-50 dark:border-white/5">
                                {SUB_TABS.map((sub) => {
                                    const isActive = activeSubTab === sub.id;
                                    return (
                                        <button
                                            key={sub.id}
                                            onClick={() => setActiveSubTab(sub.id)}
                                            className={`flex items-center gap-2 py-4 relative transition-all duration-300 whitespace-nowrap ${
                                                isActive 
                                                     ? 'text-indigo-600 dark:text-indigo-400' 
                                                     : 'text-slate-400 dark:text-github-dark-muted'
                                             }`}
                                         >
                                             <sub.icon size={16} className={`${isActive ? 'text-indigo-500' : 'text-slate-400'} -mt-[0.5px]`} />
                                             <span className={`text-[11px] font-black uppercase tracking-tighter leading-none ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                                                 {sub.label}
                                             </span>
                                            {isActive && (
                                                <motion.div 
                                                    layoutId="subTabUnderline"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Date Navigation Bar */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center justify-between gap-1 p-1.5 bg-white dark:bg-github-dark-subtle/20 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                                    <button 
                                        onClick={handlePrevDay}
                                        className="p-2.5 text-slate-400 hover:text-indigo-500 active:scale-90 transition-all rounded-xl hover:bg-slate-50 dark:hover:bg-white/5"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    
                                    <div className="flex-1 min-w-0 relative">
                                        <DatePicker 
                                            value={selectedDate}
                                            onChange={setSelectedDate}
                                            maxDate={new Date().toISOString().split('T')[0]}
                                        />
                                        {isToday && (
                                            <div className="absolute -top-1 -right-1">
                                                <span className="flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        onClick={handleNextDay}
                                        disabled={isToday}
                                        className={`p-2.5 active:scale-90 transition-all rounded-xl ${
                                            isToday 
                                                ? 'text-slate-200 dark:text-white/5 cursor-not-allowed' 
                                                : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-50 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                                
                                <button
                                    onClick={() => fetchData()}
                                    className="w-12 h-12 bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-2xl flex items-center justify-center text-slate-400 shadow-sm active:scale-90 transition-all group"
                                >
                                    <RefreshCcw size={18} className={loading ? 'animate-spin text-indigo-500' : 'group-active:rotate-180 transition-transform duration-500'} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Quick Stats Banner (Closely Packed) */}
                    <div className="flex items-center justify-between pt-5 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                                {activeEmployees.slice(0, 3).map((e, i) => (
                                    <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-github-dark-subtle bg-slate-200 overflow-hidden shadow-sm">
                                        {e.avatar.length > 1 ? <img src={`${e.avatar}?t=${avatarTimestamp}`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-black">{e.avatar}</div>}
                                    </div>
                                ))}
                                {activeEmployees.length > 3 && (
                                    <div className="w-6 h-6 rounded-full border-2 border-white dark:border-github-dark-subtle bg-indigo-500 flex items-center justify-center text-[8px] text-white font-black">
                                        +{activeEmployees.length - 3}
                                    </div>
                                )}
                            </div>
                            <span className="text-[10px] font-black text-slate-500 dark:text-github-dark-muted uppercase tracking-tighter">
                                {activeEmployees.length} PRESENT TODAY
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-full text-[9px] font-black uppercase">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                            Live
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden">
                    <AnimatePresence mode="wait" custom={direction} initial={false}>
                        <motion.div
                            key={`${activeTab}-${activeSubTab}`}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            drag={activeTab === 'dashboard' ? "x" : false}
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.2}
                            onDragEnd={handleDragEnd}
                            className="px-4 py-6 space-y-6"
                        >
                             {/* --- DASHBOARD VIEW --- */}
                             {activeTab === 'dashboard' && (
                                 <div className="space-y-6">
                                     {activeSubTab === 'overview' && (
                                         <div className="space-y-6">
                                             {/* Toolbar */}
                                             <div className="flex gap-2">
                                                 <div className="relative flex-1 group">
                                                     <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                                                     <input 
                                                         type="text" 
                                                         placeholder="Search employees..."
                                                         value={searchTerm}
                                                         onChange={(e) => setSearchTerm(e.target.value)}
                                                         className="w-full pl-10 pr-4 py-3 bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-lg text-xs font-bold outline-none shadow-sm focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
                                                     />
                                                 </div>
                                                 <button className="w-12 h-12 bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-lg flex items-center justify-center text-slate-400 shadow-sm active:scale-90 transition-transform">
                                                     <Filter size={18} />
                                                 </button>
                                             </div>

                                             {/* Stats Grid */}
                                             <div className="grid grid-cols-2 gap-3">
                                                 <CompactStatCard label="Present" value={stats.present} color="emerald" icon={UserCheck} />
                                                 <CompactStatCard label="Late" value={stats.late} color="amber" icon={Clock} />
                                                 <CompactStatCard label="Active" value={stats.active} color="blue" icon={Activity} />
                                                 <CompactStatCard label="Absent" value={stats.absent} color="rose" icon={UserX} />
                                             </div>

                                             {/* List Section */}
                                             <div className="space-y-3">
                                                 {loading && !attendanceData.length ? (
                                                     [1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-dark-card animate-pulse rounded-lg" />)
                                                 ) : filteredEmployees.length > 0 ? (
                                                     <>
                                                         {activeEmployees.map(emp => (
                                                             <CompactEmployeeCard key={emp.id} employee={emp} onClick={() => setSelectedEmployee(emp)} avatarTimestamp={avatarTimestamp} />
                                                         ))}
                                                         
                                                         {absentEmployees.length > 0 && (
                                                             <div className="flex items-center gap-4 py-4">
                                                                 <div className="h-px bg-slate-200 dark:bg-white/5 flex-1" />
                                                                 <span className="text-[10px] font-black text-slate-300 dark:text-github-dark-muted uppercase tracking-widest">NOT CHECKED IN</span>
                                                                 <div className="h-px bg-slate-200 dark:bg-white/5 flex-1" />
                                                             </div>
                                                         )}

                                                         {absentEmployees.map(emp => (
                                                             <CompactEmployeeCard key={emp.id} employee={emp} onClick={() => setSelectedEmployee(emp)} avatarTimestamp={avatarTimestamp} />
                                                         ))}
                                                     </>
                                                 ) : (
                                                     <div className="text-center py-20 bg-white dark:bg-dark-card rounded-lg border-2 border-dashed border-slate-100 dark:border-github-dark-border">
                                                         <p className="text-slate-400 font-bold text-sm">No employees found</p>
                                                     </div>
                                                 )}
                                             </div>
                                         </div>
                                     )}

                                     {activeSubTab === 'timeline' && (
                                         <TimelineView 
                                             data={filteredEmployees} 
                                             loading={loading} 
                                             onSelect={(emp) => setSelectedEmployee(emp)} 
                                             avatarTimestamp={avatarTimestamp}
                                         />
                                     )}

                                     {activeSubTab === 'analytics' && (
                                         <div className="space-y-6">
                                              {/* Attendance Pie */}
                                              <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-sm border border-slate-100 dark:border-github-dark-border">
                                                  <h4 className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest mb-6 flex items-center gap-2">
                                                      <PieChartIcon size={12} className="text-indigo-500" /> Attendance Distribution
                                                  </h4>
                                                   <div className="h-48 flex items-center justify-center">
                                                       <div className="w-1/2 h-full">
                                                           <ResponsiveContainer width="100%" height="100%">
                                                               <PieChart>
                                                                   <Pie
                                                                       data={chartData.status}
                                                                       cx="50%"
                                                                       cy="50%"
                                                                       innerRadius={35}
                                                                       outerRadius={55}
                                                                       paddingAngle={5}
                                                                       dataKey="value"
                                                                   >
                                                                       {chartData.status.map((entry, i) => (
                                                                           <Cell key={i} fill={entry.color} stroke="none" />
                                                                       ))}
                                                                   </Pie>
                                                                   <Tooltip 
                                                                       contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', borderRadius: '12px', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                                                   />
                                                               </PieChart>
                                                           </ResponsiveContainer>
                                                       </div>
                                                       <div className="w-1/2 space-y-2 pl-4">
                                                           {chartData.status.map((d, i) => (
                                                               <div key={i} className="flex items-center gap-2">
                                                                   <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                                                   <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tighter">{d.name}: {d.value}</span>
                                                               </div>
                                                           ))}
                                                       </div>
                                                   </div>
                                             </div>

                                             {/* Activity Timeline */}
                                             <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-sm border border-slate-100 dark:border-github-dark-border">
                                                 <div className="flex items-center justify-between mb-6">
                                                     <h4 className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest flex items-center gap-2">
                                                         <Activity size={12} className="text-emerald-500" /> Peak Hours Velocity
                                                     </h4>
                                                     <div className="flex gap-3">
                                                         <div className="flex items-center gap-1">
                                                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                             <span className="text-[8px] font-black text-slate-400">ACTIVE</span>
                                                         </div>
                                                         <div className="flex items-center gap-1">
                                                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                             <span className="text-[8px] font-black text-slate-400">NEW</span>
                                                         </div>
                                                     </div>
                                                 </div>
                                                  <div className="h-48">
                                                      <ResponsiveContainer width="100%" height="100%">
                                                          <AreaChart data={chartData.timeline}>
                                                              <defs>
                                                                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                                                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                                                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                                  </linearGradient>
                                                                  <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                                                                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                                                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                                                  </linearGradient>
                                                              </defs>
                                                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                                                              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }} />
                                                              <YAxis hide />
                                                              <Tooltip 
                                                                  contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', borderRadius: '12px', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                                              />
                                                              <Area type="monotone" name="Active Staff" dataKey="active" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorActive)" />
                                                              <Area type="monotone" name="New Check-ins" dataKey="checkins" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorNew)" />
                                                          </AreaChart>
                                                      </ResponsiveContainer>
                                                  </div>
                                             </div>

                                             {/* Department Metrics */}
                                             <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-sm border border-slate-100 dark:border-github-dark-border">
                                                 <h4 className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest mb-6 flex items-center gap-2">
                                                     <LayoutGrid size={12} className="text-purple-500" /> Department Health
                                                 </h4>
                                                 <div className="h-56">
                                                     <ResponsiveContainer width="100%" height="100%">
                                                         <BarChart data={chartData.departments} margin={{ left: -30 }}>
                                                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                                                             <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 800 }} />
                                                             <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 800 }} />
                                                             <Tooltip 
                                                                 contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                                             />
                                                             <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                                             <Bar dataKey="Late" stackId="a" fill="#f59e0b" />
                                                             <Bar dataKey="Absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                                         </BarChart>
                                                     </ResponsiveContainer>
                                                 </div>
                                             </div>

                                             {/* Login Frequency */}
                                             <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-sm border border-slate-100 dark:border-github-dark-border">
                                                 <h4 className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest mb-6 flex items-center gap-2">
                                                     <BarChartIcon size={12} className="text-rose-500" /> Session Intensity
                                                 </h4>
                                                  <div className="h-48">
                                                      <ResponsiveContainer width="100%" height="100%">
                                                          <BarChart data={chartData.frequency} layout="vertical" margin={{ left: -10 }}>
                                                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#88888820" />
                                                              <XAxis type="number" hide />
                                                              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 800, fill: '#64748b' }} width={70} />
                                                              <Tooltip 
                                                                  contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', borderRadius: '12px', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                                              />
                                                              <Bar dataKey="value" name="Employees" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12}>
                                                                 {chartData.frequency.map((entry, index) => (
                                                                     <Cell key={`cell-${index}`} fill="url(#gradBar)" />
                                                                 ))}
                                                              </Bar>
                                                              <defs>
                                                                 <linearGradient id="gradBar" x1="0" y1="0" x2="1" y2="0">
                                                                     <stop offset="0%" stopColor="#6366f1" />
                                                                     <stop offset="100%" stopColor="#a855f7" />
                                                                 </linearGradient>
                                                              </defs>
                                                          </BarChart>
                                                      </ResponsiveContainer>
                                                  </div>
                                             </div>
                                         </div>
                                     )}

                                     {activeSubTab === 'map' && (
                                         <MapView 
                                             data={filteredEmployees}
                                             searchTerm={searchTerm}
                                             selectedDept={selectedDept}
                                             activeTheme={activeTheme}
                                             MAP_THEMES={MAP_THEMES}
                                             isThemeMenuOpen={isThemeMenuOpen}
                                             setIsThemeMenuOpen={setIsThemeMenuOpen}
                                             setActiveTheme={setActiveTheme}
                                         />
                                     )}
                                 </div>
                             )}

                            {/* --- REQUESTS VIEW --- */}
                            {activeTab === 'requests' && (
                                <div className="space-y-4">
                                    <div className="flex bg-slate-100 dark:bg-black/20 p-1 rounded-xl">
                                        {['PENDING', 'HISTORY'].map(f => (
                                            <button 
                                                key={f} 
                                                onClick={() => setRequestSubTab(f)}
                                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                                    requestSubTab === f 
                                                        ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm' 
                                                        : 'text-slate-400 dark:text-github-dark-muted'
                                                }`}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    {(() => {
                                        const filtered = correctionRequests.filter(r => {
                                            const status = (r.status || '').toUpperCase();
                                            return requestSubTab === 'PENDING' ? status === 'PENDING' : status !== 'PENDING';
                                        });

                                        return filtered.length > 0 ? (
                                            filtered.map(req => (
                                                <button 
                                                    key={req.acr_id} 
                                                    onClick={() => setSelectedRequest(req)}
                                                    className="w-full bg-white dark:bg-dark-card p-4 rounded-lg border border-slate-100 dark:border-github-dark-border shadow-sm flex items-center justify-between text-left active:scale-95 transition-all"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-black text-sm">
                                                            {req.user_name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-black text-slate-800 dark:text-white leading-none mb-1">{req.user_name}</h4>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{req.correction_type} • {new Date(req.request_date).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
                                                        (req.status || '').toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                                                    }`}>
                                                        {req.status}
                                                    </span>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="text-center py-20 bg-white dark:bg-dark-card rounded-lg border border-dashed border-slate-200 dark:border-github-dark-border">
                                                <p className="text-slate-400 font-bold text-sm">No {requestSubTab.toLowerCase()} requests</p>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* --- MODALS --- */}
                <AnimatePresence>
                    {selectedEmployee && (
                        <EmployeeDetailModal 
                            employee={selectedEmployee} 
                            onClose={() => setSelectedEmployee(null)} 
                            date={selectedDate} 
                            avatarTimestamp={avatarTimestamp} 
                        />
                    )}
                    {selectedRequest && (
                        <RequestDetailModal request={selectedRequest} onClose={() => setSelectedRequest(null)} onUpdate={fetchData} />
                    )}
                </AnimatePresence>
            </div>
        </MobileDashboardLayout>
    );
};

// --- SUB-COMPONENTS ---

const TimelineView = ({ data, loading, onSelect, avatarTimestamp }) => {
    const startHour = 0;
    const totalHours = 24;

    const timeToPct = (date) => {
        if (!date) return null;
        const h = date.getHours();
        const m = date.getMinutes();
        const totalMinutes = (h - startHour) * 60 + m;
        return Math.max(0, Math.min(100, (totalMinutes / (totalHours * 60)) * 100));
    };

    return (
        <div className="bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            <div className="overflow-x-auto custom-scrollbar">
                <div className="min-w-[1500px]">
                    {/* Timeline Header */}
                    <div className="flex bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">
                        <div className="w-[150px] shrink-0 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-r border-slate-200 dark:border-github-dark-border sticky left-0 bg-slate-50 dark:bg-github-dark-subtle z-30">
                            Employee
                        </div>
                        <div className="flex-1 flex">
                            {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                                <div key={hour} className="flex-1 py-3 text-center text-[9px] font-black text-slate-400 border-r border-slate-200 dark:border-github-dark-border/30 last:border-r-0">
                                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Timeline Rows */}
                    <div className="divide-y divide-slate-100 dark:divide-github-dark-border/50">
                        {loading && data.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-xs font-bold">Loading timeline...</div>
                        ) : data.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-xs font-bold">No employees found.</div>
                        ) : (
                            data.map((item) => (
                                <div key={item.id} className="flex hover:bg-slate-50/50 dark:hover:bg-indigo-500/5 transition-colors group cursor-pointer h-16 items-center" onClick={() => onSelect(item)}>
                                    {/* Employee Info (Sticky) */}
                                    <div className="w-[150px] shrink-0 px-4 flex items-center gap-2 border-r border-slate-200 dark:border-github-dark-border sticky left-0 bg-white dark:bg-dark-card group-hover:bg-slate-50 dark:group-hover:bg-github-dark-subtle z-20">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] overflow-hidden shrink-0 ${item.status === 'Absent' ? 'bg-slate-100 text-slate-400 dark:bg-github-dark-subtle dark:text-github-dark-muted' : 'bg-gradient-to-br from-indigo-500/10 to-purple-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20'}`}>
                                            {item.avatar.startsWith('http') ? (
                                                <img src={`${item.avatar}?t=${avatarTimestamp}`} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                item.avatar
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-black text-[10px] text-slate-800 dark:text-github-dark-text truncate leading-tight">{item.name}</p>
                                            <p className="text-[8px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-tighter truncate">
                                                {item.totalHours && item.totalHours.toLowerCase().includes('hrs') ? item.totalHours : `${item.totalHours} Hrs`}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Timeline Grid */}
                                    <div className="flex-1 relative flex h-full items-center">
                                        <div className="absolute inset-0 flex">
                                            {Array.from({ length: 24 }).map((_, i) => (
                                                <div key={i} className="flex-1 border-r border-slate-100 dark:border-github-dark-border/30 last:border-r-0"></div>
                                            ))}
                                        </div>

                                        <div className="absolute inset-x-0 h-6 z-10 px-1">
                                            {item.sessions.map((session, sIdx) => {
                                                const startPos = timeToPct(session.rawIn);
                                                const endPos = session.isActive ? timeToPct(new Date()) : timeToPct(session.rawOut);
                                                const width = endPos - startPos;
                                                if (startPos === null) return null;

                                                return (
                                                    <div
                                                        key={sIdx}
                                                        className={`absolute top-0 h-full rounded border shadow-sm transition-all ${session.isActive ? 'bg-gradient-to-r from-indigo-500 to-blue-500 border-indigo-400/50 animate-pulse' : 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400/50'}`}
                                                        style={{ left: `${startPos}%`, width: `${Math.max(width, 1)}%` }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const CompactStatCard = ({ label, value, color, icon: Icon }) => {
    const colors = {
        emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600',
        amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600',
        rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600',
        blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600',
    };
    return (
        <div className="bg-white dark:bg-dark-card p-3 rounded-lg border border-slate-100 dark:border-github-dark-border shadow-sm flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
                <Icon size={16} strokeWidth={3} />
            </div>
            <div>
                <p className="text-[9px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider leading-none mb-1">{label}</p>
                <p className="text-base font-black text-slate-800 dark:text-white leading-none">{value}</p>
            </div>
        </div>
    );
};

const CompactEmployeeCard = ({ employee, onClick, avatarTimestamp }) => {
    const isAbsent = employee.status === 'Absent';
    return (
        <div 
            onClick={onClick}
            className={`bg-white dark:bg-dark-card p-3 rounded-lg border border-slate-100 dark:border-github-dark-border shadow-sm flex items-center gap-3 active:scale-[0.98] transition-all relative overflow-hidden ${isAbsent ? 'opacity-70 grayscale-[0.5]' : ''}`}
        >
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/5 overflow-hidden border border-slate-200 dark:border-github-dark-border shrink-0">
                {employee.avatar.length > 1 ? (
                    <img src={`${employee.avatar}?t=${avatarTimestamp}`} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-indigo-500 font-black text-xs">{employee.avatar}</div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                    <h4 className="font-black text-[13px] text-slate-800 dark:text-white truncate pr-2 leading-none">{employee.name}</h4>
                    <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${
                        employee.status.includes('Active') ? 'bg-indigo-100 text-indigo-600 animate-pulse' :
                        employee.status.includes('Late') ? 'bg-amber-100 text-amber-600' :
                        employee.status === 'Present' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                        {employee.status}
                    </span>
                </div>
                <p className="text-[9px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-tighter truncate leading-none mb-2">{employee.role} • {employee.department}</p>
                
                {!isAbsent && employee.sessions.length > 0 && (
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-50 dark:border-github-dark-border/50">
                        <div className="flex items-center gap-1">
                            <Clock size={8} className="text-slate-300" />
                            <span className="text-[9px] font-black text-slate-700 dark:text-slate-300">
                                {employee.sessions[0].in} → {employee.sessions[0].out === '-' ? 'Active' : employee.sessions[0].out}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const EmployeeDetailModal = ({ employee, onClose, date, avatarTimestamp }) => {
    const [previewImage, setPreviewImage] = useState(null);

    return createPortal(
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
            <motion.div 
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                className="relative w-full bg-slate-50 dark:bg-dark-card rounded-t-xl p-6 pb-12 max-h-[90vh] overflow-y-auto border-t border-slate-200 dark:border-github-dark-border"
            >
                {/* Lightbox Preview */}
                <AnimatePresence>
                    {previewImage && (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-4"
                            onClick={() => setPreviewImage(null)}
                        >
                            <button className="absolute top-6 right-6 text-white p-2 bg-white/10 rounded-full"><X size={24} /></button>
                            <motion.img 
                                initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                                src={previewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
                                onClick={(e) => e.stopPropagation()}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="w-12 h-1 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-8" />
                
                <div className="flex items-center gap-5 mb-8">
                    <div className="w-16 h-16 rounded-lg bg-white dark:bg-dark-card border-2 border-white dark:border-github-dark-border overflow-hidden shadow-xl">
                        {employee.avatar.length > 1 ? <img src={`${employee.avatar}?t=${avatarTimestamp}`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl font-black text-indigo-500">{employee.avatar}</div>}
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white leading-none mb-2">{employee.name}</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-widest">{employee.role}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{employee.department}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex justify-between">
                        <span>Daily Activity</span>
                        <span className="text-slate-300">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </h4>

                    {employee.sessions.length > 0 ? (
                        employee.sessions.map((s, i) => (
                            <div key={i} className="bg-white dark:bg-dark-card p-5 rounded-lg border border-slate-100 dark:border-github-dark-border shadow-sm space-y-4">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-white/5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Clock size={12} /> Session #{employee.sessions.length - i}
                                    </span>
                                    {s.isActive && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 animate-pulse">Active</span>}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><LogIn size={12} /></div>
                                                <span className="text-lg font-black text-slate-800 dark:text-white">{s.in}</span>
                                            </div>
                                            <div className="flex items-start gap-1.5 px-0.5">
                                                <MapPin size={10} className="shrink-0 mt-0.5 text-emerald-500 opacity-60" />
                                                <span className="text-[9px] font-bold text-slate-400 dark:text-github-dark-muted leading-tight break-words">{s.inLocation}</span>
                                            </div>
                                        </div>
                                        {s.inImage && (
                                            <div 
                                                onClick={() => setPreviewImage(s.inImage)}
                                                className="relative aspect-video rounded-xl overflow-hidden border border-slate-100 dark:border-github-dark-border shadow-sm group active:scale-95 transition-all"
                                            >
                                                <img src={s.inImage} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Camera size={16} className="text-white" />
                                                </div>
                                                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[7px] font-black text-white uppercase tracking-tighter">Selfie In</div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><LogOut size={12} /></div>
                                                <span className="text-lg font-black text-slate-800 dark:text-white">{s.out}</span>
                                            </div>
                                            {s.outLocation && (
                                                <div className="flex items-start gap-1.5 px-0.5">
                                                    <MapPin size={10} className="shrink-0 mt-0.5 text-rose-500 opacity-60" />
                                                    <span className="text-[9px] font-bold text-slate-400 dark:text-github-dark-muted leading-tight break-words">{s.outLocation}</span>
                                                </div>
                                            )}
                                        </div>
                                        {s.outImage && (
                                            <div 
                                                onClick={() => setPreviewImage(s.outImage)}
                                                className="relative aspect-video rounded-xl overflow-hidden border border-slate-100 dark:border-github-dark-border shadow-sm group active:scale-95 transition-all"
                                            >
                                                <img src={s.outImage} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Camera size={16} className="text-white" />
                                                </div>
                                                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[7px] font-black text-white uppercase tracking-tighter">Selfie Out</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                    <div className="py-12 bg-white dark:bg-dark-card rounded-lg border-2 border-dashed border-slate-100 dark:border-github-dark-border flex flex-col items-center justify-center text-slate-300">
                            <Activity size={32} className="mb-2 opacity-20" />
                            <p className="text-sm font-bold opacity-50">No activity logged</p>
                        </div>
                    )}
                </div>

                <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 active:scale-90 transition-all">
                    <X size={24} />
                </button>
            </motion.div>
        </motion.div>,
        document.body
    );
};

const RequestDetailModal = ({ request, onClose, onUpdate }) => {
    const [comment, setComment] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAction = async (status) => {
        setIsProcessing(true);
        try {
            await attendanceService.updateCorrectionStatus(request.acr_id || request.id, status, comment);
            toast.success(`Request ${status} successfully`);
            onUpdate();
            onClose();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return createPortal(
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-end">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-lg" onClick={onClose} />
            <motion.div 
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                className="relative w-full bg-white dark:bg-dark-card rounded-t-xl p-8 pb-12 shadow-2xl border-t border-slate-200 dark:border-github-dark-border"
            >
                <div className="w-12 h-1 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-8" />
                
                <div className="mb-8">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-2 block">Correction Request</span>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{request.user_name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{request.correction_type} • Request Date: {new Date(request.request_date).toLocaleDateString()}</p>
                </div>

                <div className="space-y-6 mb-8">
                    <div className="bg-slate-50 dark:bg-github-dark-subtle p-5 rounded-2xl space-y-4">
                        <div className="flex items-center gap-3 text-slate-400">
                            <FileText size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Reason / Justification</span>
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 italic leading-relaxed">"{request.reason || 'No justification provided'}"</p>
                    </div>

                    {request.status?.toUpperCase() === 'PENDING' ? (
                        <div className="space-y-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Decision Comment</span>
                            <textarea 
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Add internal review comment..."
                                className="w-full bg-slate-50 dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
                                rows={3}
                            />
                        </div>
                    ) : (
                        <div className="bg-indigo-50 dark:bg-indigo-500/10 p-5 rounded-2xl space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Decision</span>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    request.status?.toUpperCase() === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                                }`}>
                                    {request.status}
                                </span>
                            </div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {request.admin_comment || "No comment provided."}
                            </p>
                        </div>
                    )}
                </div>

                {request.status?.toUpperCase() === 'PENDING' && (
                    <div className="flex gap-4">
                        <button 
                            onClick={() => handleAction('REJECTED')}
                            disabled={isProcessing}
                            className="flex-1 py-4 bg-white dark:bg-github-dark-subtle border-2 border-rose-100 dark:border-rose-500/20 text-rose-500 font-black rounded-xl active:scale-95 transition-all shadow-sm disabled:opacity-50"
                        >
                            Reject
                        </button>
                        <button 
                            onClick={() => handleAction('APPROVED')}
                            disabled={isProcessing}
                            className="flex-1 py-4 bg-emerald-500 text-white font-black rounded-xl active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                        >
                            Approve
                        </button>
                    </div>
                )}

                <button onClick={onClose} className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-600 active:scale-90 transition-all">
                    <X size={24} />
                </button>
            </motion.div>
        </motion.div>,
        document.body
    );
};

const ClusterDrillDownPopup = ({ data, onClose }) => {
    const [selectedUser, setSelectedUser] = useState(null);

    return (
        <div className="bg-white dark:bg-[#0d1117] rounded-xl overflow-hidden w-[280px] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-3 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20 relative">
                {selectedUser && (
                    <button 
                        onClick={() => setSelectedUser(null)}
                        className="absolute left-2 top-2.5 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400"
                    >
                        <ChevronLeft size={16} />
                    </button>
                )}
                <div className={`flex items-center justify-between mb-0.5 ${selectedUser ? 'pl-6' : ''}`}>
                    <h3 className="text-[10px] font-black text-slate-800 dark:text-github-dark-text uppercase tracking-widest">
                        {selectedUser ? 'Session Details' : 'Location Group'}
                    </h3>
                    {!selectedUser && (
                        <span className="bg-indigo-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full">{data.length} Staff</span>
                    )}
                </div>
                {!selectedUser && <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Multiple check-ins at this location</p>}
            </div>

            {/* Content Area */}
            <div className="relative overflow-hidden bg-white dark:bg-[#0d1117]" style={{ height: '280px' }}>
                <AnimatePresence initial={false} mode="wait">
                    {!selectedUser ? (
                        <motion.div 
                            key="list"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 overflow-y-auto p-2 space-y-1.5 no-scrollbar"
                        >
                            {data.map((m, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedUser(m)}
                                    className="flex items-center gap-2.5 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl cursor-pointer transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-500/20 group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xs overflow-hidden shrink-0 border border-indigo-100 dark:border-indigo-500/20">
                                        {m.user.avatar.length > 1 ? <img src={m.user.avatar} className="w-full h-full object-cover" /> : m.user.avatar}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-black text-slate-800 dark:text-github-dark-text truncate leading-tight">{m.user.name}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${m.type === 'in' ? 'bg-emerald-100 text-emerald-600' : m.type === 'out' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                {m.type === 'combined' ? 'Full' : m.type === 'in' ? 'In' : 'Out'}
                                            </span>
                                            <span className="text-[8px] text-slate-400 dark:text-github-dark-muted font-mono font-bold">
                                                {m.type === 'out' ? m.session.out : m.session.in}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight size={12} className="text-slate-300" />
                                </div>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="detail"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 20, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 overflow-y-auto p-3 no-scrollbar"
                        >
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-black text-xs overflow-hidden shrink-0 shadow-md">
                                    {selectedUser.user.avatar.length > 1 ? <img src={selectedUser.user.avatar} className="w-full h-full object-cover" /> : selectedUser.user.avatar}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-black text-slate-800 dark:text-github-dark-text text-[11px] leading-tight">{selectedUser.user.name}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{selectedUser.type === 'combined' ? 'Full Session' : selectedUser.user.role}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                {selectedUser.type === 'combined' ? (
                                    <>
                                        <div className="space-y-1.5 bg-slate-50 dark:bg-github-dark-subtle/30 p-2 rounded-xl border border-slate-100 dark:border-github-dark-border">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Login</span>
                                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">{selectedUser.session.in}</span>
                                            </div>
                                            {selectedUser.session.inImage && (
                                                <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-github-dark-border h-20 bg-slate-100 dark:bg-github-dark-subtle mt-1">
                                                    <img src={selectedUser.session.inImage} className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1.5 bg-slate-50 dark:bg-github-dark-subtle/30 p-2 rounded-xl border border-slate-100 dark:border-github-dark-border">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Logout</span>
                                                <span className="text-[9px] font-black text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded">{selectedUser.session.out}</span>
                                            </div>
                                            {selectedUser.session.outImage && (
                                                <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-github-dark-border h-20 bg-slate-100 dark:bg-github-dark-subtle mt-1">
                                                    <img src={selectedUser.session.outImage} className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between bg-slate-50 dark:bg-github-dark-subtle/30 p-2 rounded-xl border border-slate-100 dark:border-github-dark-border">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{selectedUser.type === 'in' ? 'Check In' : 'Check Out'}</span>
                                            <span className={`text-[9px] font-black ${selectedUser.type === 'in' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : 'text-rose-600 bg-rose-50 dark:bg-rose-900/30'} px-1.5 py-0.5 rounded uppercase`}>{selectedUser.type === 'in' ? selectedUser.session.in : selectedUser.session.out}</span>
                                        </div>
                                        {(selectedUser.type === 'in' ? selectedUser.session.inImage : selectedUser.session.outImage) && (
                                            <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-github-dark-border h-28 bg-slate-100 dark:bg-github-dark-subtle mt-2">
                                                <img src={selectedUser.type === 'in' ? selectedUser.session.inImage : selectedUser.session.outImage} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="flex flex-col gap-1 p-2 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-100 dark:border-github-dark-border">
                                    <div className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                        <MapPin size={10} className="text-indigo-500" /> Location Details
                                    </div>
                                    <p className="text-[9px] text-slate-600 dark:text-slate-300 leading-tight break-words mt-0.5 font-medium">
                                        {selectedUser.type === 'out' ? selectedUser.session.outLocation : selectedUser.session.inLocation}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const ClusterEvents = ({ setSelectedCluster }) => {
    const map = useMap();
    useEffect(() => {
        const handleClusterClick = (e) => {
            const markers = e.layer.getAllChildMarkers();
            if (markers.length > 3) {
                const data = markers.map(m => m.options.customSessionData).filter(Boolean);
                setSelectedCluster({
                    position: [e.latlng.lat, e.latlng.lng],
                    data: data
                });
            } else {
                e.layer.spiderfy();
            }
        };
        map.on('clusterclick', handleClusterClick);
        return () => {
            map.off('clusterclick', handleClusterClick);
        };
    }, [map]);
    return null;
};

const MapRecenter = ({ data, searchTerm, selectedDept }) => {
    const map = useMap();
    useEffect(() => {
        if (!data || data.length === 0) return;
        
        // Find bounds for all markers
        const points = [];
        data.forEach(user => {
            user.sessions.forEach(s => {
                if (s.inLat && s.inLng) points.push([Number(s.inLat), Number(s.inLng)]);
                if (s.outLat && s.outLng) points.push([Number(s.outLat), Number(s.outLng)]);
            });
        });

        if (points.length > 0) {
            map.fitBounds(points, { padding: [50, 50], maxZoom: 15 });
        }
    }, [searchTerm, selectedDept, data.length > 0, map]);
    return null;
};

const createClusterCustomIcon = (cluster) => {
    const count = cluster.getChildCount();
    let colorClass = 'bg-indigo-600';
    if (count > 10) colorClass = 'bg-rose-600';
    else if (count > 5) colorClass = 'bg-amber-600';

    return L.divIcon({
        html: `<div class="flex items-center justify-center ${colorClass} text-white rounded-full border-4 border-white dark:border-github-dark-subtle shadow-xl w-10 h-10 ring-4 ring-indigo-500/20">
                <span class="text-xs font-black">${count}</span>
               </div>`,
        className: 'custom-marker-cluster',
        iconSize: L.point(40, 40, true),
    });
};

const MapView = ({ data, searchTerm, selectedDept, activeTheme, MAP_THEMES, isThemeMenuOpen, setIsThemeMenuOpen, setActiveTheme }) => {
    const [selectedCluster, setSelectedCluster] = useState(null);
    const areCoordsSame = (lat1, lng1, lat2, lng2) => {
        if (!lat1 || !lng1 || !lat2 || !lng2) return false;
        return Math.abs(Number(lat1) - Number(lat2)) < 0.0001 && 
               Math.abs(Number(lng1) - Number(lng2)) < 0.0001;
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <style>
                {`
                .user-marker-in, .user-marker-out, .user-marker-combined {
                    z-index: 500 !important;
                }
                .marker-inner {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    transform-origin: bottom center;
                }
                .premium-tooltip {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
                .premium-tooltip::before {
                    display: none !important;
                }
                .leaflet-popup-content-wrapper {
                    padding: 0 !important;
                    overflow: hidden !important;
                    border-radius: 12px !important;
                }
                .leaflet-popup-content {
                    margin: 0 !important;
                    width: 280px !important;
                }
                `}
            </style>

            <div className="h-[500px] bg-white dark:bg-dark-card rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-sm overflow-hidden relative">
                <MapContainer
                    center={[20, 78]}
                    zoom={5}
                    className="h-full w-full z-0"
                    attributionControl={false}
                >
                    <TileLayer url={MAP_THEMES[activeTheme].url} />
                    
                    {/* Map Theme Switcher Overlay */}
                    <div className="absolute top-4 right-4 z-[1001]">
                        <div className="relative">
                            <button
                                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                                className="flex items-center gap-2 bg-white dark:bg-github-dark-subtle text-slate-800 dark:text-github-dark-text px-3 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-github-dark-border active:scale-95 transition-all"
                            >
                                <Map size={16} className="text-indigo-500" />
                                <span className="text-[10px] font-bold uppercase">{MAP_THEMES[activeTheme].name}</span>
                                <ChevronDown size={12} className={`text-slate-400 transition-transform ${isThemeMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isThemeMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsThemeMenuOpen(false)} />
                                    <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl overflow-hidden z-20">
                                        <div className="py-1">
                                            {Object.entries(MAP_THEMES).map(([id, theme]) => (
                                                <button
                                                    key={id}
                                                    onClick={() => {
                                                        setActiveTheme(id);
                                                        setIsThemeMenuOpen(false);
                                                    }}
                                                    className={`w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-bold uppercase transition-colors ${activeTheme === id
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                        }`}
                                                >
                                                    <span>{theme.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <MapRecenter data={data} searchTerm={searchTerm} selectedDept={selectedDept} />
                    <ClusterEvents setSelectedCluster={setSelectedCluster} />

                    {selectedCluster && (
                        <Popup 
                            position={selectedCluster.position} 
                            onClose={() => setSelectedCluster(null)}
                            closeButton={false}
                        >
                            <ClusterDrillDownPopup data={selectedCluster.data} onClose={() => setSelectedCluster(null)} />
                        </Popup>
                    )}

                    <MarkerClusterGroup
                        chunkedLoading
                        maxClusterRadius={50}
                        iconCreateFunction={createClusterCustomIcon}
                        showCoverageOnHover={false}
                        spiderfyOnMaxZoom={true}
                    >
                        {data.map(user => (
                            user.sessions.map((session, sIdx) => {
                            const isSameLoc = areCoordsSame(session.inLat, session.inLng, session.outLat, session.outLng);

                            if (isSameLoc) {
                                return (
                                    <Marker 
                                        key={`${user.id}-${sIdx}-combined`}
                                        position={[Number(session.inLat), Number(session.inLng)]}
                                        customSessionData={{ user, session, type: 'combined' }}
                                        icon={L.divIcon({
                                            className: 'user-marker-combined',
                                            html: `<div class="marker-inner relative">
                                                    <div class="w-10 h-10 rounded-full border-2 border-transparent bg-white dark:bg-github-dark-subtle shadow-lg overflow-hidden flex items-center justify-center" style="border-image: linear-gradient(to bottom right, #10b981 50%, #f43f5e 50%) 1;">
                                                        <div class="absolute inset-0 border-2 border-emerald-500 rounded-full" style="clip-path: polygon(0 0, 100% 0, 0 100%);"></div>
                                                        <div class="absolute inset-0 border-2 border-rose-500 rounded-full" style="clip-path: polygon(100% 0, 100% 100%, 0 100%);"></div>
                                                        ${user.avatar.length > 1
                                                            ? `<img src="${user.avatar}" class="w-full h-full object-cover rounded-full" />` 
                                                            : `<span class="text-[10px] font-black text-slate-600 dark:text-slate-300">${user.avatar}</span>`
                                                        }
                                                    </div>
                                                    <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full border-2 border-white dark:border-dark-card flex items-center justify-center shadow-sm">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                                    </div>
                                                   </div>`,
                                            iconSize: [40, 40],
                                            iconAnchor: [20, 20]
                                        })}
                                    >
                                        <Popup>
                                            <div className="bg-white dark:bg-[#0d1117] overflow-hidden">
                                                <div className="p-3 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0">
                                                        {user.avatar.length > 1 ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.avatar}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-black text-slate-800 dark:text-white text-xs leading-tight">{user.name}</p>
                                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Full Session</p>
                                                    </div>
                                                </div>
                                                 <div className="p-3 space-y-3">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center text-[10px] font-bold">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                                    <span className="text-slate-400 uppercase tracking-widest text-[8px]">In</span>
                                                                </div>
                                                                <span className="text-emerald-600">{session.in}</span>
                                                            </div>
                                                            {session.inImage && (
                                                                <div className="aspect-video rounded-lg overflow-hidden border border-slate-100 dark:border-github-dark-border">
                                                                    <img src={session.inImage} className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center text-[10px] font-bold">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                                                                    <span className="text-slate-400 uppercase tracking-widest text-[8px]">Out</span>
                                                                </div>
                                                                <span className="text-rose-600">{session.out}</span>
                                                            </div>
                                                            {session.outImage && (
                                                                <div className="aspect-video rounded-lg overflow-hidden border border-slate-100 dark:border-github-dark-border">
                                                                    <img src={session.outImage} className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 p-2 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                                        <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 uppercase mb-0.5">
                                                            <MapPin size={8} className="text-indigo-500" /> Location
                                                        </div>
                                                        <p className="text-[9px] text-slate-600 dark:text-slate-300 leading-tight break-words">{session.inLocation}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            }

                            return (
                                <React.Fragment key={`${user.id}-${sIdx}`}>
                                    {session.inLat && session.inLng && (
                                        <Marker 
                                            position={[Number(session.inLat), Number(session.inLng)]}
                                            customSessionData={{ user, session, type: 'in' }}
                                            icon={L.divIcon({
                                                className: 'user-marker-in',
                                                html: `<div class="marker-inner relative">
                                                        <div class="w-10 h-10 rounded-full border-2 border-emerald-500 bg-white dark:bg-github-dark-subtle shadow-lg overflow-hidden flex items-center justify-center">
                                                            ${user.avatar.length > 1 
                                                                ? `<img src="${user.avatar}" class="w-full h-full object-cover" />` 
                                                                : `<span class="text-[10px] font-black text-slate-600 dark:text-slate-300">${user.avatar}</span>`
                                                            }
                                                        </div>
                                                        <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-dark-card flex items-center justify-center shadow-sm">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                                                        </div>
                                                       </div>`,
                                                iconSize: [40, 40],
                                                iconAnchor: [20, 20]
                                            })}
                                        >
                                            <Popup>
                                                <div className="bg-white dark:bg-[#0d1117] overflow-hidden">
                                                    <div className="p-3">
                                                        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-github-dark-border">
                                                            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden">
                                                                {user.avatar.length > 1 ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.avatar}
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-slate-800 dark:text-white text-xs leading-tight">{user.name}</p>
                                                                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Time In: {session.in}</p>
                                                            </div>
                                                        </div>
                                                        {session.inImage && (
                                                            <div className="aspect-video rounded-xl overflow-hidden border border-slate-100 dark:border-github-dark-border mb-3">
                                                                <img src={session.inImage} className="w-full h-full object-cover" />
                                                            </div>
                                                        )}
                                                        <div className="p-2 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                                            <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 uppercase mb-0.5">
                                                                <MapPin size={8} className="text-indigo-500" /> Location
                                                            </div>
                                                            <p className="text-[9px] text-slate-600 dark:text-slate-300 leading-tight break-words">{session.inLocation}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Popup>
                                    </Marker>
                                    )}
                                    {session.outLat && session.outLng && (
                                        <Marker 
                                            position={[Number(session.outLat), Number(session.outLng)]}
                                            customSessionData={{ user, session, type: 'out' }}
                                            icon={L.divIcon({
                                                className: 'user-marker-out',
                                                html: `<div class="marker-inner relative">
                                                        <div class="w-10 h-10 rounded-full border-2 border-rose-500 bg-white dark:bg-github-dark-subtle shadow-lg overflow-hidden flex items-center justify-center">
                                                            ${user.avatar.length > 1 
                                                                ? `<img src="${user.avatar}" class="w-full h-full object-cover" />` 
                                                                : `<span class="text-[10px] font-black text-slate-600 dark:text-slate-300">${user.avatar}</span>`
                                                            }
                                                        </div>
                                                        <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white dark:border-dark-card flex items-center justify-center shadow-sm">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                                        </div>
                                                       </div>`,
                                                iconSize: [40, 40],
                                                iconAnchor: [20, 20]
                                            })}
                                        >
                                            <Popup>
                                                <div className="bg-white dark:bg-[#0d1117] overflow-hidden">
                                                    <div className="p-3">
                                                        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-github-dark-border">
                                                            <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden">
                                                                {user.avatar.length > 1 ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.avatar}
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-slate-800 dark:text-white text-xs leading-tight">{user.name}</p>
                                                                <p className="text-[9px] font-bold text-rose-600 uppercase tracking-widest">Time Out: {session.out}</p>
                                                            </div>
                                                        </div>
                                                        {session.outImage && (
                                                            <div className="aspect-video rounded-xl overflow-hidden border border-slate-100 dark:border-github-dark-border mb-3">
                                                                <img src={session.outImage} className="w-full h-full object-cover" />
                                                            </div>
                                                        )}
                                                        <div className="p-2 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                                            <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 uppercase mb-0.5">
                                                                <MapPin size={8} className="text-indigo-500" /> Location
                                                            </div>
                                                            <p className="text-[9px] text-slate-600 dark:text-slate-300 leading-tight break-words">{session.outLocation}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Popup>
                                    </Marker>
                                    )}
                                </React.Fragment>
                            );
                        })
                    ))}
                    </MarkerClusterGroup>
                </MapContainer>
            </div>
        </div>
    );
};

export default MobileAttendanceMonitoring; 
