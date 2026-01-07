import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import {
    Search,
    Filter,
    Clock,
    UserCheck,
    UserX,
    AlertTriangle,
    MoreVertical,
    Download,
    FileText,
    CheckCircle,
    XCircle,
    Calendar,
    ChevronRight,
    MessageSquare,
    Activity,
    LogOut,
    LayoutGrid,
    PieChart as PieChartIcon,
    BarChart as BarChartIcon,
    RefreshCcw,
    MapPin
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { attendanceService } from '../../services/attendanceService';
import { toast } from 'react-toastify';
import {
    PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';

const AttendanceMonitoring = () => {
    const [activeTab, setActiveTab] = useState('live'); // 'live' | 'requests'
    const [activeView, setActiveView] = useState('cards'); // 'cards' | 'graph'
    const [selectedRequest, setSelectedRequest] = useState(1); // For Detail View

    const [loading, setLoading] = useState(true);
    const [attendanceData, setAttendanceData] = useState([]);
    const [stats, setStats] = useState({
        present: 0,
        late: 0,
        absent: 0,
        active: 0
    });

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split("T")[0]);
    const [lastSynced, setLastSynced] = React.useState(new Date());

    // Data Fetching
    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            // 1. Fetch Users and Attendance Records in Parallel
            const [usersRes, attendanceRes] = await Promise.all([
                adminService.getAllUsers(),
                attendanceService.getRealTimeAttendance(selectedDate)
            ]);

            const users = usersRes.users || [];
            const records = attendanceRes.data || [];

            // 2. Merge Data
            const mergedData = users.map(user => {
                const userRecords = records.filter(r => r.user_id === user.user_id);

                let sessions = [];
                let totalMin = 0;
                let status = 'Absent';
                let lastLocation = '-';

                if (userRecords.length > 0) {
                    // Process all sessions
                    sessions = userRecords.map(r => {
                        const inTime = new Date(r.time_in);
                        const outTime = r.time_out ? new Date(r.time_out) : null;

                        let sessionHours = '-';
                        if (outTime) {
                            const diff = (outTime - inTime) / (1000 * 60);
                            totalMin += diff;
                            sessionHours = `${(diff / 60).toFixed(1)}h`;
                        }

                        return {
                            id: r.attendance_id,
                            in: inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            out: outTime ? outTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active',
                            hours: sessionHours,
                            isLate: r.late_minutes > 0,
                            isActive: !r.time_out,
                            rawIn: inTime,
                            rawOut: outTime,
                            inLocation: r.time_in_address || (r.time_in_lat ? `${r.time_in_lat}, ${r.time_in_lng}` : 'Location unknown'),
                            outLocation: r.time_out_address || (r.time_out_lat ? `${r.time_out_lat}, ${r.time_out_lng}` : (r.time_out ? 'Location unknown' : null))
                        };
                    });

                    // Determine overall status
                    const latest = userRecords[0]; // records is sorted desc by time
                    lastLocation = latest.time_in_address || (latest.time_in_lat ? `${latest.time_in_lat}, ${latest.time_in_lng}` : '-');

                    if (sessions.some(s => s.isActive)) {
                        status = latest.late_minutes > 0 ? 'Late Active' : 'Active';
                    } else {
                        status = userRecords.some(r => r.late_minutes > 0) ? 'Late' : 'Present';
                    }
                }

                return {
                    id: user.user_id,
                    name: user.user_name || 'Unknown',
                    role: user.desg_name || user.designation_title || 'Employee',
                    avatar: (user.user_name || 'U').charAt(0).toUpperCase(),
                    department: user.dept_name || user.department_title || 'General',
                    sessions,
                    status,
                    totalHours: totalMin > 0 ? `${(totalMin / 60).toFixed(1)} hrs` : '-',
                    location: lastLocation,
                };
            });

            // 3. Sort: Active/Present/Late first, then Absent
            mergedData.sort((a, b) => {
                const isAbsentA = a.status === 'Absent';
                const isAbsentB = b.status === 'Absent';
                if (isAbsentA === isAbsentB) return 0;
                return isAbsentA ? 1 : -1;
            });

            setAttendanceData(mergedData);

            // 4. Calculate Stats precisely from merged data for consistency
            setStats({
                present: mergedData.filter(d => d.status !== 'Absent').length,
                late: mergedData.filter(d => d.status.includes('Late')).length,
                absent: mergedData.filter(d => d.status === 'Absent').length,
                active: mergedData.filter(d => d.status.includes('Active')).length
            });

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            if (!silent) setLoading(false);
            setLastSynced(new Date());
        }
    };

    useEffect(() => {
        if (activeTab === 'live') {
            fetchData();
            // Auto refresh every 15 seconds (Live Monitoring)
            const interval = setInterval(() => fetchData(true), 15000);
            return () => clearInterval(interval);
        }
    }, [activeTab, selectedDate]);


    // Mock Data - Correction Requests (Keeping as is per instruction)
    const [requests, setRequests] = useState([
        {
            id: 1,
            name: 'Rahul Verma',
            role: 'Inventory Specialist',
            avatar: 'R',
            type: 'Missed Punch',
            date: '18 Dec 2023',
            requestedTime: '09:00 AM',
            systemTime: '-',
            reason: 'Forgot to punch in due to urgent delivery handling.',
            status: 'Pending',
            timeline: [
                { status: 'Request Submitted', time: '18 Dec, 10:15 AM', by: 'Rahul Verma' },
                { status: 'Under Review', time: '19 Dec, 09:00 AM', by: 'System' }
            ]
        },
        {
            id: 2,
            name: 'Sneha Patil',
            role: 'Sales Executive',
            avatar: 'S',
            type: 'Correction',
            date: '17 Dec 2023',
            requestedTime: '09:15 AM',
            systemTime: '10:45 AM',
            reason: 'Biometric issue, scanner was not working.',
            status: 'Pending',
            timeline: [
                { status: 'Request Submitted', time: '17 Dec, 11:30 AM', by: 'Sneha Patil' }
            ]
        },
        {
            id: 3,
            name: 'Arjun Mehta',
            role: 'Sales Executive',
            avatar: 'A',
            type: 'Overtime',
            date: '16 Dec 2023',
            requestedTime: '08:30 PM',
            systemTime: '06:30 PM',
            reason: 'Stayed late for year-end inventory audit.',
            status: 'Approved',
            timeline: [
                { status: 'Request Submitted', time: '16 Dec, 09:00 PM', by: 'Arjun Mehta' },
                { status: 'Approved', time: '17 Dec, 10:00 AM', by: 'Manager' }
            ]
        }
    ]);


    // Stats Cards Data
    const statCards = [
        { label: 'Total Present', value: stats.present, icon: <UserCheck size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
        { label: 'Late Arrivals', value: stats.late, icon: <Clock size={20} />, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
        { label: 'Absent', value: stats.absent, icon: <UserX size={20} />, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
        { label: 'Currently Active', value: stats.active, icon: <Activity size={20} />, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    ];

    // Filter Logic for Live Tab
    const filteredData = attendanceData.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = departmentFilter === 'All' || item.department === departmentFilter;
        return matchesSearch && matchesDept;
    });

    const getStatusStyle = (status) => {
        if (String(status).includes('Late')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        switch (status) {
            case 'Present': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'Active': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse';
            case 'Absent': return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
            case 'Half Day': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        }
    };

    const getRequestTypeStyle = (type) => {
        switch (type) {
            case 'Missed Punch': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
            case 'Correction': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
            case 'Overtime': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20';
            default: return 'text-slate-600 bg-slate-50';
        }
    };

    const handleApprove = (id) => {
        // Mock API call
        alert(`Request ${id} Approved`);
    };

    const handleReject = (id) => {
        // Mock API call
        alert(`Request ${id} Rejected`);
    };

    const selectedRequestData = requests.find(r => r.id === selectedRequest);

    const getStatusData = () => {
        // Create disjoint sets that sum to total headcount for a valid Pie Chart
        const active = attendanceData.filter(d => d.status === 'Active').length;
        const present = attendanceData.filter(d => d.status === 'Present').length;
        const late = attendanceData.filter(d => d.status.includes('Late')).length;
        const absent = attendanceData.filter(d => d.status === 'Absent').length;

        return [
            { name: 'Present', value: present, color: '#10b981' },
            { name: 'Late', value: late, color: '#f59e0b' },
            { name: 'Absent', value: absent, color: '#ef4444' },
            { name: 'Active', value: active, color: '#3b82f6' },
        ].filter(item => item.value > 0);
    };

    const getDepartmentData = () => {
        const deptStats = {};
        attendanceData.forEach(item => {
            const dept = item.department || 'Unknown';
            if (!deptStats[dept]) deptStats[dept] = { name: dept, Present: 0, Absent: 0, Late: 0 };

            if (item.status === 'Absent') deptStats[dept].Absent++;
            else if (item.status.includes('Late')) deptStats[dept].Late++;
            else deptStats[dept].Present++;
        });
        return Object.values(deptStats);
    };

    const getTimelineData = () => {
        const hourlyData = {};
        // Initialize hours from 6 AM to 10 PM
        for (let i = 6; i <= 22; i++) {
            hourlyData[i] = { checkins: 0, repeats: 0, active: 0 };
        }

        attendanceData.forEach(item => {
            item.sessions.forEach((session, index) => {
                const inTime = session.rawIn;
                const inHour = inTime.getHours();

                if (hourlyData.hasOwnProperty(inHour)) {
                    if (index === 0) {
                        hourlyData[inHour].checkins++; // First login of the day
                    } else {
                        hourlyData[inHour].repeats++; // Subsequent login
                    }
                }

                const outTime = session.rawOut;
                for (let h = 6; h <= 22; h++) {
                    const hourStart = h;
                    if (inHour <= hourStart) {
                        if (!outTime || outTime.getHours() > hourStart) {
                            hourlyData[h].active++;
                        }
                    }
                }
            });
        });

        return Object.keys(hourlyData).map(hour => {
            const h = parseInt(hour);
            const label = h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
            return {
                time: label,
                checkins: hourlyData[hour].checkins,
                repeats: hourlyData[hour].repeats,
                active: hourlyData[hour].active
            };
        });
    };

    const getLoginFrequencyData = () => {
        const frequency = {
            '1 Session': 0,
            '2 Sessions': 0,
            '3 Sessions': 0,
            '4+ Sessions': 0
        };

        attendanceData.forEach(item => {
            if (item.status !== 'Absent') {
                const count = item.sessions.length;
                if (count === 1) frequency['1 Session']++;
                else if (count === 2) frequency['2 Sessions']++;
                else if (count === 3) frequency['3 Sessions']++;
                else if (count >= 4) frequency['4+ Sessions']++;
            }
        });

        return Object.entries(frequency).map(([name, value]) => ({ name, value }));
    };

    return (
        <DashboardLayout title="Live Attendance">
            <div className="space-y-6">

                {/* Tabs */}
                <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('live')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'live' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Live Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${activeTab === 'requests' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Correction Requests
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">3</span>
                    </button>
                </div>

                {activeTab === 'live' ? (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {statCards.map((stat, index) => (
                                <div key={index} className="bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors duration-300">
                                    <div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                                        <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{stat.value}</p>
                                    </div>
                                    <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                                        {stat.icon}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Main Content */}
                        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">

                            {/* Toolbar */}
                            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Real-time Monitoring</h2>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        Live
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="relative flex-1 sm:flex-none">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Search employee..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full sm:w-64 transition-all"
                                        />
                                    </div>

                                    <div className="relative">
                                        <select
                                            value={departmentFilter}
                                            onChange={(e) => setDepartmentFilter(e.target.value)}
                                            className="appearance-none pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                                        >
                                            <option value="All">All Depts</option>
                                            <option value="Sales">Sales</option>
                                            <option value="Retail">Retail</option>
                                            <option value="Logistics">Logistics</option>
                                            <option value="Operations">Operations</option>
                                            <option value="IT">IT</option>
                                            <option value="HR">HR</option>
                                        </select>
                                        <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                    </div>


                                    <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex items-center gap-1">
                                        <button
                                            onClick={() => setActiveView('cards')}
                                            className={`p-1.5 rounded-md transition-all ${activeView === 'cards' ? 'bg-white dark:bg-slate-600 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            title="Card View"
                                        >
                                            <LayoutGrid size={18} />
                                        </button>
                                        <button
                                            onClick={() => setActiveView('graph')}
                                            className={`p-1.5 rounded-md transition-all ${activeView === 'graph' ? 'bg-white dark:bg-slate-600 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            title="Graph View"
                                        >
                                            <PieChartIcon size={18} />
                                        </button>
                                    </div>

                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    />

                                    <button
                                        onClick={fetchData}
                                        className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        title={`Refresh (Last sync: ${lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}
                                    >
                                        <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
                                    </button>
                                </div>
                            </div>

                            {/* Visualization Content */}
                            <div className="p-6 bg-slate-50/50 dark:bg-slate-800/10 min-h-[500px]">
                                {activeView === 'cards' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {loading && attendanceData.length === 0 ? (
                                            <div className="col-span-full text-center py-20 text-slate-500 dark:text-slate-400">
                                                <p>Loading live attendance data...</p>
                                            </div>
                                        ) : filteredData.length > 0 ? (
                                            filteredData.map((item, index) => {
                                                const showDivider = item.status === 'Absent' && index > 0 && filteredData[index - 1].status !== 'Absent';

                                                return (
                                                    <React.Fragment key={item.id}>
                                                        {showDivider && (
                                                            <div className="col-span-full py-6 flex items-center gap-4">
                                                                <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Not Checked In</span>
                                                                <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                                                            </div>
                                                        )}
                                                        <div className={`bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-300 overflow-hidden group flex flex-col ${item.status === 'Absent' ? 'opacity-70 grayscale-[0.3]' : ''}`}>
                                                            {/* Card Header */}
                                                            <div className="p-5 flex items-start justify-between">
                                                                <div className="flex gap-4">
                                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm ${item.status === 'Absent' ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'}`}>
                                                                        {item.avatar}
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="font-bold text-slate-800 dark:text-white line-clamp-1" title={item.name}>{item.name}</h3>
                                                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{item.role}</p>
                                                                    </div>
                                                                </div>
                                                                <button className="text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                                                    <MoreVertical size={18} />
                                                                </button>
                                                            </div>

                                                            {/* Status Badge Line */}
                                                            <div className="px-5 pb-4">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getStatusStyle(item.status).replace('bg-', 'bg-opacity-10 border-').replace('text-', 'text-')}`}>
                                                                    <div className={`w-1.5 h-1.5 rounded-full mr-2 ${item.status === 'Active' ? 'animate-pulse bg-current' : 'bg-current'}`}></div>
                                                                    {item.status}
                                                                </span>
                                                            </div>

                                                            {/* Divider */}
                                                            <div className="h-px bg-slate-100 dark:bg-slate-800 mx-5"></div>

                                                            {/* Card Body - Sessions */}
                                                            <div className="p-5 flex-1 overflow-hidden">
                                                                {item.status === 'Absent' ? (
                                                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-4 italic">
                                                                        <Clock size={20} className="mb-2 opacity-30" />
                                                                        <span className="text-xs">No activity yet</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-4">
                                                                        {item.sessions.map((session, sIdx) => (
                                                                            <div key={session.id} className={`relative pl-4 border-l-2 ${session.isActive ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'}`}>
                                                                                {/* Session Indicator Dot */}
                                                                                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-dark-card shadow-sm ${session.isActive ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></div>

                                                                                <div className="flex items-center justify-between mb-2">
                                                                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                                                        Session {item.sessions.length - sIdx}
                                                                                    </span>
                                                                                    {session.isActive && (
                                                                                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold uppercase animate-pulse">
                                                                                            Active
                                                                                        </span>
                                                                                    )}
                                                                                </div>

                                                                                <div className="grid grid-cols-2 gap-4">
                                                                                    <div className="space-y-1">
                                                                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
                                                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                                                            In {session.in}
                                                                                        </div>
                                                                                        <div className="flex items-start gap-1 text-[9px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                                                                            <MapPin size={10} className="shrink-0 mt-0.5 text-indigo-400" />
                                                                                            <span className="line-clamp-2" title={session.inLocation}>{session.inLocation}</span>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="space-y-1">
                                                                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
                                                                                            <div className={`w-1.5 h-1.5 rounded-full ${session.isActive ? 'bg-slate-300 dark:bg-slate-600' : 'bg-red-500'}`}></div>
                                                                                            Out {session.out}
                                                                                        </div>
                                                                                        {session.outLocation ? (
                                                                                            <div className="flex items-start gap-1 text-[9px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                                                                                <MapPin size={10} className="shrink-0 mt-0.5 text-rose-400" />
                                                                                                <span className="line-clamp-2" title={session.outLocation}>{session.outLocation}</span>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="h-full flex items-center p-1.5">
                                                                                                <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">Ongoing...</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Card Footer (Duration) */}
                                                            {item.status !== 'Absent' && (
                                                                <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Daily Time</span>
                                                                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                                                            {item.totalHours}
                                                                        </span>
                                                                    </div>
                                                                    {item.sessions.length > 1 && (
                                                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                                                                            <Activity size={12} className="text-indigo-500" />
                                                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{item.sessions.length} Sessions</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </React.Fragment>
                                                );
                                            })
                                        ) : (
                                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                                                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
                                                    <Search size={32} />
                                                </div>
                                                <p className="text-lg font-medium text-slate-600 dark:text-slate-300">No employees found</p>
                                                <p className="text-sm">Try adjusting your filters or search terms</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Graph View Layout */
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Status Distribution */}
                                            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Attendance Status</h3>
                                                <div className="h-[300px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={getStatusData()}
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius={60}
                                                                outerRadius={100}
                                                                paddingAngle={5}
                                                                dataKey="value"
                                                            >
                                                                {getStatusData().map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip
                                                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                                                itemStyle={{ color: '#fff' }}
                                                            />
                                                            <Legend verticalAlign="bottom" height={36} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            {/* Department Breakdown */}
                                            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Department Metrics</h3>
                                                <div className="h-[300px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={getDepartmentData()}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                                                            <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                                            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                                            <Tooltip
                                                                cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
                                                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                                                            />
                                                            <Legend />
                                                            <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                                            <Bar dataKey="Late" stackId="a" fill="#f59e0b" />
                                                            <Bar dataKey="Absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Check-in Activity */}
                                            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Peak Check-in Hours</h3>
                                                    <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-wider">
                                                        <div className="flex items-center gap-1.5 text-indigo-600">
                                                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                            New
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-purple-600">
                                                            <div className="w-2 h-2 rounded-full bg-purple-500 border-2 border-dashed border-purple-200"></div>
                                                            Repeat
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="h-[300px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <AreaChart data={getTimelineData()}>
                                                            <defs>
                                                                <linearGradient id="colorCheckins" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                                </linearGradient>
                                                                <linearGradient id="colorRepeats" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                                                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                                                </linearGradient>
                                                                <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                                                            <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} interval={1} />
                                                            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                                            <Tooltip
                                                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                                                itemStyle={{ fontSize: '12px' }}
                                                            />
                                                            <Legend verticalAlign="top" height={36} iconType="circle" />
                                                            <Area name="Active Staff" type="monotone" dataKey="active" stroke="#10b981" fillOpacity={1} fill="url(#colorActive)" strokeWidth={3} />
                                                            <Area name="New Check-ins" type="monotone" dataKey="checkins" stroke="#6366f1" fillOpacity={1} fill="url(#colorCheckins)" strokeWidth={2} />
                                                            <Area name="Repeat Check-ins" type="monotone" dataKey="repeats" stroke="#a855f7" fillOpacity={1} fill="url(#colorRepeats)" strokeWidth={2} strokeDasharray="5 5" />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            {/* Login Frequency */}
                                            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Login Frequency</h3>
                                                <div className="h-[300px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={getLoginFrequencyData()} layout="vertical">
                                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" opacity={0.5} />
                                                            <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                                            <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={80} />
                                                            <Tooltip
                                                                cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
                                                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                                                            />
                                                            <Bar dataKey="value" name="Employees" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    // Approvals Tab Content
                    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-14rem)]">

                        {/* List Panel */}
                        <div className="w-full lg:w-1/3 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                                <h3 className="font-semibold text-slate-800 dark:text-white">Requests</h3>
                                <div className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-2 py-1 rounded border border-slate-200 dark:border-slate-600">
                                    {requests.length} Total
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-700">
                                {requests.map(request => (
                                    <div
                                        key={request.id}
                                        onClick={() => setSelectedRequest(request.id)}
                                        className={`p-4 cursor-pointer transition-colors ${selectedRequest === request.id ? 'bg-indigo-50 dark:bg-indigo-900/10 border-l-4 border-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-l-4 border-transparent'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300">
                                                    {request.avatar}
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-semibold ${selectedRequest === request.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-white'}`}>{request.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{request.role}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getRequestTypeStyle(request.type)}`}>
                                                {request.type}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mt-3">
                                            <div className="flex items-center gap-1">
                                                <Calendar size={12} />
                                                {request.date}
                                            </div>
                                            <div className={`flex items-center gap-1 font-medium ${request.status === 'Pending' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                {request.status}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Detail Panel */}
                        <div className="w-full lg:w-2/3 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                            {selectedRequestData ? (
                                <>
                                    <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Request #{selectedRequestData.id}</h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                                Submitted on {selectedRequestData.timeline[0]?.time}
                                            </p>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => handleReject(selectedRequestData.id)}
                                                className="px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                            >
                                                <XCircle size={16} /> Reject
                                            </button>
                                            <button
                                                onClick={() => handleApprove(selectedRequestData.id)}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-md transition-colors flex items-center gap-2"
                                            >
                                                <CheckCircle size={16} /> Approve
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6">

                                        {/* Grid Layout for details */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                            <div>
                                                <h4 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-3">Correction Details</h4>
                                                <div className="space-y-4">
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                                                        <span className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Request Type</span>
                                                        <span className="font-semibold text-slate-800 dark:text-white">{selectedRequestData.type}</span>
                                                    </div>
                                                    <div className="flex gap-4">
                                                        <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                                                            <span className="text-sm text-slate-500 dark:text-slate-400 block mb-1">System Time</span>
                                                            <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">{selectedRequestData.systemTime}</span>
                                                        </div>
                                                        <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                                            <span className="text-sm text-indigo-600 dark:text-indigo-400 block mb-1">Requested Time</span>
                                                            <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">{selectedRequestData.requestedTime}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-3">Justification</h4>
                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700 h-full">
                                                    <div className="flex items-start gap-3">
                                                        <MessageSquare size={18} className="text-slate-400 mt-1" />
                                                        <div>
                                                            <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{selectedRequestData.reason}"</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Audit Trail */}
                                        <div>
                                            <h4 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-4 flex items-center gap-2">
                                                <Activity size={14} /> Audit Trail
                                            </h4>
                                            <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-6">
                                                {selectedRequestData.timeline.map((event, idx) => (
                                                    <div key={idx} className="relative">
                                                        <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-dark-card ring-1 ring-slate-100 dark:ring-slate-800"></div>
                                                        <p className="text-sm font-medium text-slate-800 dark:text-white">{event.status}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{event.time} • by {event.by}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                    <FileText size={48} className="mb-4 opacity-50" />
                                    <p>Select a request to view details</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </DashboardLayout >
    );
};

export default AttendanceMonitoring;
