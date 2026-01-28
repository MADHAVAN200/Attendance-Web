import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Legend
} from 'recharts';
import { Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react';

const AttendanceCharts = ({ sessions = [], date }) => {

    // Process Data for Visuals
    const stats = useMemo(() => {
        let totalDays = sessions.length;
        let onTime = 0;
        let late = 0;
        let totalHours = 0;

        sessions.forEach(session => {
            if (session.late_status) late++;
            else onTime++;

            if (session.total_hours) {
                totalHours += parseFloat(session.total_hours);
            }
        });

        const avgHours = totalDays > 0 ? (totalHours / totalDays).toFixed(1) : 0;

        return { totalDays, onTime, late, avgHours };
    }, [sessions]);

    const dailyData = useMemo(() => {
        // Group by day of month (1-31)
        // Assume sessions are typically one per day, but handle duplicates if any
        // Map to format suitable for BarChart
        const daysInMonth = new Date(new Date(date).getFullYear(), new Date(date).getMonth() + 1, 0).getDate();
        const data = Array.from({ length: daysInMonth }, (_, i) => ({
            day: i + 1,
            hours: 0,
            status: 'Absent'
        }));

        sessions.forEach(session => {
            const d = new Date(session.created_at);
            const dayIndex = d.getDate() - 1;
            if (data[dayIndex]) {
                data[dayIndex].hours = parseFloat(session.total_hours || 0);
                data[dayIndex].status = session.late_status ? 'Late' : 'Present';
            }
        });

        return data;
    }, [sessions, date]);

    const statusData = useMemo(() => {
        return [
            { name: 'On Time', value: stats.onTime },
            { name: 'Late', value: stats.late },
            // Can add 'Leaves' if we passed that data
        ].filter(item => item.value > 0);
    }, [stats]);


    const topLongestDays = useMemo(() => {
        return [...sessions]
            .sort((a, b) => parseFloat(b.total_hours || 0) - parseFloat(a.total_hours || 0))
            .slice(0, 5);
    }, [sessions]);

    // Colors
    const COLORS = ['#6366f1', '#f43f5e', '#fbbf24', '#10b981']; // Indigo, Rose, Amber, Emerald

    const formatXAxis = (tickItem) => {
        return tickItem; // Just the day number
    };

    return (
        <div className="space-y-6">
            {/* 1. Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Total Days</p>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.totalDays}</h3>
                    </div>
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                        <Calendar size={24} />
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">On Time</p>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.onTime}</h3>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                        <CheckCircle size={24} />
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Late Arrivals</p>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.late}</h3>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600 dark:text-amber-400">
                        <AlertCircle size={24} />
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Avg Hours</p>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.avgHours}</h3>
                    </div>
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400">
                        <Clock size={24} />
                    </div>
                </div>
            </div>

            {/* 2. Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Bar Chart: Monthly Trend */}
                <div className="lg:col-span-2 bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Attendance Trend</h3>
                        <div className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">
                            Hours per Day
                        </div>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                                <XAxis
                                    dataKey="day"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                                    dy={10}
                                    interval={2} // Show every 3rd day
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar
                                    dataKey="hours"
                                    fill="#6366f1"
                                    radius={[4, 4, 0, 0]}
                                    barSize={12}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut Chart: Status Breakdown */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Attendance Status</h3>
                    <div className="flex-1 min-h-[200px] relative">
                        {/* Centered Total */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-slate-800 dark:text-white">{stats.totalDays}</span>
                            <span className="text-xs text-slate-500 uppercase tracking-wider">Days</span>
                        </div>

                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-4">
                        {statusData.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                <span className="text-xs text-slate-600 dark:text-slate-400">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. Top Attendant Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Top 5 Longest Days</h3>
                    <div className="space-y-4">
                        {topLongestDays.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-4">No data available</p>
                        ) : (
                            topLongestDays.map((session, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                {new Date(session.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-sm font-mono font-bold text-slate-600 dark:text-slate-400">
                                        {session.total_hours} Hrs
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Placeholder for more charts if needed */}
                <div className="lg:col-span-2 bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Arrival Time Consistency</h3>
                    <div className="h-64 w-full flex items-center justify-center text-slate-400">
                        {/* Could be an AreaChart relative to 9:00 AM */}
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyData.filter(d => d.hours > 0)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                <YAxis hide />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                <Tooltip />
                                <Area type="monotone" dataKey="hours" stroke="#8884d8" fillOpacity={1} fill="url(#colorHours)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttendanceCharts;
