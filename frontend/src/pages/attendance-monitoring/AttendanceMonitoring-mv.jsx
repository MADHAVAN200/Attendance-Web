import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    Search, Filter, Clock, UserCheck, UserX, Activity, MapPin, Calendar,
    ChevronDown, FileText, CheckCircle, XCircle, AlertCircle, X, LogIn,
    LogOut, History, PieChart as PieChartIcon, BarChart as BarChartIcon,
    RefreshCcw, MoreVertical, LayoutGrid, ArrowRight, Eye, Info,
    ChevronRight, Map, Camera
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { attendanceService } from '../../services/attendanceService';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

const MobileAttendanceMonitoring = () => {
    const { avatarTimestamp, user: currentUser } = useAuth();
    const TABS = ['dashboard', 'analytics', 'requests'];

    // UI State
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'analytics' | 'requests'
    const [direction, setDirection] = useState(0); // -1 for left, 1 for right
    const [loading, setLoading] = useState(true);
    const [lastSynced, setLastSynced] = useState(new Date());

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
        const currentIndex = TABS.indexOf(activeTab);
        const newIndex = TABS.indexOf(newTab);
        setDirection(newIndex > currentIndex ? 1 : -1);
        setActiveTab(newTab);
    };

    const handleDragEnd = (event, info) => {
        const swipeThreshold = 50;
        const currentIndex = TABS.indexOf(activeTab);

        if (info.offset.x < -swipeThreshold && currentIndex < TABS.length - 1) {
            // Swipe Left -> Next Tab
            handleTabChange(TABS[currentIndex + 1]);
        } else if (info.offset.x > swipeThreshold && currentIndex > 0) {
            // Swipe Right -> Prev Tab
            handleTabChange(TABS[currentIndex - 1]);
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

                        if (r.time_out) {
                            const outTime = new Date(r.time_out);
                            outStr = formatTime(outTime);
                            isActive = false;
                            totalMin += Math.max(0, (outTime - inTime) / 60000);
                        } else {
                            totalMin += Math.max(0, (new Date() - inTime) / 60000);
                        }

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
                            outImage: r.time_out_image
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
        for (let i = 8; i <= 20; i++) hourlyData[i] = { checkins: 0, repeats: 0, active: 0 };
        
        attendanceData.forEach(item => {
            item.sessions.forEach((s, idx) => {
                const h = s.rawIn.getHours();
                if (hourlyData[h]) {
                    if (idx === 0) hourlyData[h].checkins++;
                    else hourlyData[h].repeats++;
                }
                
                const outH = s.rawOut ? s.rawOut.getHours() : 20;
                for (let j = h; j <= outH; j++) {
                    if (hourlyData[j]) hourlyData[j].active++;
                }
            });
        });

        const timeline = Object.keys(hourlyData).map(h => ({
            time: h > 12 ? `${h-12}PM` : `${h}AM`,
            checkins: hourlyData[h].checkins,
            repeats: hourlyData[h].repeats,
            active: hourlyData[h].active
        }));

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
        <MobileDashboardLayout title="Live Monitoring">
            <div className="min-h-screen bg-slate-50 dark:bg-github-dark-bg transition-colors duration-300 pb-24">
                
                {/* --- PREMIUM HEADER & TABS --- */}
                <div className="sticky top-0 z-20 bg-white/80 dark:bg-github-dark-subtle/80 backdrop-blur-xl border-b border-slate-100 dark:border-white/5 px-4 pt-4">
                    <div className="flex bg-slate-100 dark:bg-black/20 p-1 rounded-xl mb-4">
                        {TABS.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => handleTabChange(tab)}
                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 relative ${
                                    activeTab === tab 
                                        ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm' 
                                        : 'text-slate-400 dark:text-github-dark-muted hover:text-slate-600'
                                }`}
                            >
                                {tab === 'requests' && requestCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-full border-2 border-white dark:border-github-dark-subtle">
                                        {requestCount}
                                    </span>
                                )}
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Quick Stats Banner (Closely Packed) */}
                    <div className="flex items-center justify-between pb-4">
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
                            key={activeTab}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.2}
                            onDragEnd={handleDragEnd}
                            className="px-4 py-6 space-y-6"
                        >
                            {/* --- DASHBOARD VIEW --- */}
                            {activeTab === 'dashboard' && (
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
                                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold outline-none shadow-sm focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
                                            />
                                        </div>
                                        <button className="w-12 h-12 bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl flex items-center justify-center text-slate-400 shadow-sm active:scale-90 transition-transform">
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
                                            [1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-github-dark-subtle animate-pulse rounded-3xl" />)
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
                                            <div className="text-center py-20 bg-white dark:bg-github-dark-subtle rounded-3xl border-2 border-dashed border-slate-100 dark:border-white/5">
                                                <p className="text-slate-400 font-bold text-sm">No employees found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* --- ANALYTICS VIEW --- */}
                            {activeTab === 'analytics' && (
                                <div className="space-y-6">
                                    {/* Attendance Pie */}
                                    <div className="bg-white dark:bg-github-dark-subtle p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
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
                                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '10px' }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div className="w-1/2 space-y-2 pl-4">
                                                {chartData.status.map((d, i) => (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{d.name}: {d.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Activity Timeline */}
                                    <div className="bg-white dark:bg-github-dark-subtle p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
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
                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                        </linearGradient>
                                                        <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
                                                    <YAxis hide />
                                                    <Tooltip 
                                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                                    />
                                                    <Area type="monotone" name="Active Staff" dataKey="active" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorActive)" />
                                                    <Area type="monotone" name="New Check-ins" dataKey="checkins" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorNew)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Department Metrics */}
                                    <div className="bg-white dark:bg-github-dark-subtle p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
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
                                    <div className="bg-white dark:bg-github-dark-subtle p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
                                        <h4 className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <BarChartIcon size={12} className="text-rose-500" /> Session Intensity
                                        </h4>
                                        <div className="h-48">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartData.frequency} layout="vertical" margin={{ left: -10 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#88888820" />
                                                    <XAxis type="number" hide />
                                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 800 }} width={70} />
                                                    <Tooltip 
                                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                                    />
                                                    <Bar dataKey="value" name="Employees" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
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
                                                    className="w-full bg-white dark:bg-github-dark-subtle p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between text-left active:scale-95 transition-all"
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
                                            <div className="text-center py-20 bg-white dark:bg-github-dark-subtle rounded-2xl border border-dashed border-slate-200 dark:border-white/5">
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
                        <EmployeeDetailModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} date={selectedDate} />
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

const CompactStatCard = ({ label, value, color, icon: Icon }) => {
    const colors = {
        emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600',
        amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600',
        rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600',
        blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600',
    };
    return (
        <div className="bg-white dark:bg-github-dark-subtle p-4 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
                <Icon size={18} strokeWidth={2.5} />
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                <p className="text-lg font-black text-slate-800 dark:text-white leading-none">{value}</p>
            </div>
        </div>
    );
};

const CompactEmployeeCard = ({ employee, onClick, avatarTimestamp }) => {
    const isAbsent = employee.status === 'Absent';
    return (
        <div 
            onClick={onClick}
            className={`bg-white dark:bg-github-dark-subtle p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center gap-4 active:scale-95 transition-all relative overflow-hidden ${isAbsent ? 'opacity-70 grayscale-[0.5]' : ''}`}
        >
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 overflow-hidden border border-slate-200 dark:border-white/10 shrink-0">
                {employee.avatar.length > 1 ? (
                    <img src={`${employee.avatar}?t=${avatarTimestamp}`} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-indigo-500 font-black">{employee.avatar}</div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                    <h4 className="font-black text-sm text-slate-800 dark:text-white truncate pr-2 leading-none">{employee.name}</h4>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        employee.status.includes('Active') ? 'bg-indigo-100 text-indigo-600 animate-pulse' :
                        employee.status.includes('Late') ? 'bg-amber-100 text-amber-600' :
                        employee.status === 'Present' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                        {employee.status}
                    </span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-tighter truncate">{employee.role} • {employee.department}</p>
                
                {!isAbsent && employee.sessions.length > 0 && (
                    <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-slate-50 dark:border-white/5">
                        <div className="flex items-center gap-1">
                            <Clock size={10} className="text-slate-300" />
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">
                                {employee.sessions[0].in} → {employee.sessions[0].out === '-' ? 'Active' : employee.sessions[0].out}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 truncate flex-1">
                            <MapPin size={10} className="text-indigo-400 shrink-0" />
                            <span className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted truncate">{employee.location}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const EmployeeDetailModal = ({ employee, onClose, date }) => {
    return createPortal(
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
            <motion.div 
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                className="relative w-full bg-slate-50 dark:bg-github-dark-bg rounded-t-2xl p-6 pb-12 max-h-[90vh] overflow-y-auto"
            >
                <div className="w-12 h-1 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-8" />
                
                <div className="flex items-center gap-5 mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-github-dark-subtle border-2 border-white dark:border-white/10 overflow-hidden shadow-xl">
                        {employee.avatar.length > 1 ? <img src={employee.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl font-black text-indigo-500">{employee.avatar}</div>}
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
                            <div key={i} className="bg-white dark:bg-github-dark-subtle p-5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm space-y-4">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-white/5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Clock size={12} /> Session #{employee.sessions.length - i}
                                    </span>
                                    {s.isActive && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 animate-pulse">Active</span>}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><LogIn size={12} /></div>
                                            <span className="text-lg font-black text-slate-800 dark:text-white">{s.in}</span>
                                        </div>
                                        <div className="flex items-start gap-1.5 p-2 bg-slate-50 dark:bg-black/20 rounded-xl">
                                            <MapPin size={10} className="text-indigo-400 mt-0.5 shrink-0" />
                                            <span className="text-[9px] font-bold text-slate-500 dark:text-github-dark-muted leading-tight">{s.inLocation}</span>
                                        </div>
                                        {s.inImage && (
                                            <div className="aspect-square rounded-2xl overflow-hidden border border-slate-100 dark:border-white/10">
                                                <img src={s.inImage} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><LogOut size={12} /></div>
                                            <span className="text-lg font-black text-slate-800 dark:text-white">{s.out}</span>
                                        </div>
                                        {s.outLocation && (
                                            <div className="flex items-start gap-1.5 p-2 bg-slate-50 dark:bg-black/20 rounded-xl">
                                                <MapPin size={10} className="text-indigo-400 mt-0.5 shrink-0" />
                                                <span className="text-[9px] font-bold text-slate-500 dark:text-github-dark-muted leading-tight">{s.outLocation}</span>
                                            </div>
                                        )}
                                        {s.outImage && (
                                            <div className="aspect-square rounded-2xl overflow-hidden border border-slate-100 dark:border-white/10">
                                                <img src={s.outImage} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-12 bg-white dark:bg-github-dark-subtle rounded-2xl border-2 border-dashed border-slate-100 dark:border-white/5 flex flex-col items-center justify-center text-slate-300">
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
                className="relative w-full bg-white dark:bg-github-dark-bg rounded-t-2xl p-8 pb-12 shadow-2xl"
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

export default MobileAttendanceMonitoring;
