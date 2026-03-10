
import React, { useState, useEffect } from 'react';
import {
    BarChart3, Filter, UserCheck, Clock, CheckCircle, TrendingUp, TrendingDown,
    Activity, PieChart as PieChartIcon, RefreshCw, Users, Building, FileText
} from 'lucide-react';
import {
    PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, CartesianGrid
} from 'recharts';
import api from '../../../services/api';
import { toast } from 'react-toastify';

const DashboardInsights = ({ departments, allUsers }) => {
    // --- ENHANCED FILTER STATE ---
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 6)).toISOString().split('T')[0], // Last 7 days
        endDate: new Date().toISOString().split('T')[0],
        dept: 'All',
        search: ''
    });

    const [loadingData, setLoadingData] = useState(false);

    // --- CHART DATA STATE ---
    const [categoryData, setCategoryData] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [chartKeys, setChartKeys] = useState([]);
    const [deptData, setDeptData] = useState([]);
    const [consistencyData, setConsistencyData] = useState([]);
    const [complianceData, setComplianceData] = useState([]);
    const [stats, setStats] = useState({
        submissionRate: 0,
        submittedCount: 0,
        totalEmployees: 0,
        topActivity: '-',
        topActivityPercent: 0,
        avgHours: 0,
        avgDiff: 0,
        avgTrend: 'neutral',
        avgIdle: 0
    });

    const formatDuration = (val) => {
        if (!val) return '0h';
        const hrs = Math.floor(val);
        const mins = Math.round((val - hrs) * 60);
        return `${hrs}h ${mins}m`;
    };

    // Helper: Reset to presets
    const applyPreset = (days) => {
        const end = new Date();
        const start = new Date();
        if (days === 0) {
            // Today
        } else {
            start.setDate(end.getDate() - days);
        }
        setFilters(prev => ({
            ...prev,
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0]
        }));
    };

    // Helper for Average Calculation
    // Helper for Average Calculation (Daily Average per User)
    const calculateAvgWorkHours = (acts) => {
        let totalH = 0;
        const userDayKeys = new Set();
        acts.forEach(a => {
            if (a.status === 'COMPLETED') userDayKeys.add(`${a.user_id}_${a.activity_date.split('T')[0]}`);
            if (!a.start_time || !a.end_time) return;
            const parts = a.start_time.split(':');
            const startM = (parseInt(parts[0]) * 60) + (parseInt(parts[1]) || 0);
            const partsEnd = a.end_time.split(':');
            let endM = (parseInt(partsEnd[0]) * 60) + (parseInt(partsEnd[1]) || 0);
            if (endM < startM) endM += (24 * 60);
            totalH += Math.max(0, (endM - startM) / 60);
        });
        return userDayKeys.size > 0 ? (totalH / userDayKeys.size) : 0;
    };

    // Helper for Submission Rate Calculation (Daily Average)
    const calculateSubmissionRate = (acts, totalEmps) => {
        if (totalEmps === 0) return { rate: 0, count: 0 };

        // 1. Group by Date
        const dateMap = {};
        acts.forEach(a => {
            const d = a.activity_date.split('T')[0];
            if (!dateMap[d]) dateMap[d] = new Set();
            if (a.status === 'COMPLETED') dateMap[d].add(a.user_id);
        });

        // 2. Average Count Calculation
        let totalCount = 0;
        Object.values(dateMap).forEach(usersSet => {
            totalCount += usersSet.size;
        });

        const start = new Date(filters.startDate);
        const end = new Date(filters.endDate);
        const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        if (duration <= 0) return { rate: 0, count: 0 };

        const avgCount = totalCount / duration;
        const rate = Math.round((avgCount / totalEmps) * 100);

        return { rate, count: avgCount };
    };

    // Helper for Idle Time Calculation
    const calculateIdleTime = (acts) => {
        const userDayMap = {};
        acts.forEach(a => {
            if (!a.start_time || !a.end_time) return;
            const key = `${a.user_id}_${a.activity_date.split('T')[0]}`;
            if (!userDayMap[key]) userDayMap[key] = [];

            const parts = a.start_time.split(':');
            const startM = (parseInt(parts[0]) * 60) + (parseInt(parts[1]) || 0);
            const partsEnd = a.end_time.split(':');
            let endM = (parseInt(partsEnd[0]) * 60) + (parseInt(partsEnd[1]) || 0);
            if (endM < startM) endM += (24 * 60);

            userDayMap[key].push({ start: startM, end: endM });
        });

        let totalIdleM = 0;
        let dayCount = 0;

        Object.values(userDayMap).forEach(dayActs => {
            dayCount++;
            dayActs.sort((a, b) => a.start - b.start);
            for (let i = 0; i < dayActs.length - 1; i++) {
                const gap = dayActs[i + 1].start - dayActs[i].end;
                if (gap > 0) totalIdleM += gap;
            }
        });

        return dayCount > 0 ? Math.round(totalIdleM / dayCount) : 0;
    };


    const processInsights = (activities, prevAvg = 0, holidaySet = new Set(), totalEmpCount) => {
        let totalH = 0;
        let activeUsers = new Set();
        let userDayKeys = new Set(); // Track unique User-Days
        const deptHours = {};
        const activityHours = {};
        const activityFrequency = {};
        const trendMap = {};
        const foundCategories = new Set();
        const deptMap = {};

        // Initialize trend map
        let d = new Date(filters.startDate);
        const e = new Date(filters.endDate);
        while (d <= e) {
            const dateStr = d.toISOString().split('T')[0];
            trendMap[dateStr] = { date: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }) };
            d.setDate(d.getDate() + 1);
        }

        const parseMinutes = (t) => {
            if (!t) return 0;
            const parts = t.split(':');
            return (parseInt(parts[0]) * 60) + (parseInt(parts[1]) || 0);
        };

        activities.forEach(a => {
            if (a.status === 'COMPLETED') {
                activeUsers.add(a.user_id);
                userDayKeys.add(`${a.user_id}_${a.activity_date.split('T')[0]}`);
            }

            if (!a.start_time || !a.end_time) return;

            let startM = parseMinutes(a.start_time);
            let endM = parseMinutes(a.end_time);
            if (endM < startM) endM += (24 * 60);

            const hours = Math.max(0, (endM - startM) / 60);
            totalH += hours;

            const type = a.activity_type || "Uncategorized";
            activityHours[type] = (activityHours[type] || 0) + hours;
            activityFrequency[type] = (activityFrequency[type] || 0) + 1;

            const dept = a.user_dept || "Unknown";
            deptHours[dept] = (deptHours[dept] || 0) + hours;

            const dateStr = a.activity_date.split('T')[0];
            if (trendMap[dateStr]) {
                trendMap[dateStr][type] = (trendMap[dateStr][type] || 0) + hours;
                foundCategories.add(type);
            }

            if (!deptMap[dept]) deptMap[dept] = { name: dept, total: 0 };
            deptMap[dept][type] = (deptMap[dept][type] || 0) + hours;
            deptMap[dept].total += hours;
        });

        // Trend Data
        const sortedTrendData = Object.keys(trendMap).map(key => {
            const item = trendMap[key];
            Object.keys(item).forEach(k => {
                if (typeof item[k] === 'number') {
                    item[k] = Math.round(item[k] * 10) / 10;
                }
            });
            return item;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));

        setTrendData(sortedTrendData);
        setChartKeys(Array.from(foundCategories));

        // Dept Data
        const sortedDeptData = Object.values(deptMap).map(d => {
            Object.keys(d).forEach(k => {
                if (typeof d[k] === 'number') {
                    d[k] = Math.round(d[k] * 10) / 10;
                }
            });
            return d;
        }).sort((a, b) => b.total - a.total);
        setDeptData(sortedDeptData);

        // Top Activity
        let topAct = '-';
        let maxFreq = 0;
        Object.entries(activityFrequency).forEach(([act, freq]) => {
            if (freq > maxFreq) {
                topAct = act;
                maxFreq = freq;
            }
        });
        const topActHours = activityHours[topAct] || 0;
        const topActPercent = totalH > 0 ? Math.round((topActHours / totalH) * 100) : 0;

        // Active Dept
        let topDept = '-';
        let topDeptVal = 0;
        Object.entries(deptHours).forEach(([d, val]) => {
            if (val > topDeptVal) {
                topDept = d;
                topDeptVal = val;
            }
        });

        // Employee Consistency
        let dynamicTotalEmp = totalEmpCount;
        let relevantUsers = allUsers;
        if (filters.dept !== 'All') {
            relevantUsers = allUsers.filter(u => u.dept === filters.dept);
            dynamicTotalEmp = relevantUsers.length;
        }

        let targetDays = 0;
        let loopDate = new Date(filters.startDate);
        const loopEnd = new Date(filters.endDate);
        while (loopDate <= loopEnd) {
            const dateStr = loopDate.toISOString().split('T')[0];
            const isSunday = loopDate.getDay() === 0;
            const isHoliday = holidaySet.has(dateStr);
            if (!isSunday && !isHoliday) targetDays++;
            loopDate.setDate(loopDate.getDate() + 1);
        }
        if (targetDays === 0) targetDays = 1;

        const consistencyList = relevantUsers.map(user => {
            const userActivities = activities.filter(a => a.user_id === user.userId && a.status === 'COMPLETED');
            const uniqueDays = new Set(userActivities.map(a => a.activity_date.split('T')[0])).size;
            return {
                id: user.userId,
                name: user.name,
                role: user.role,
                dept: user.dept,
                dars: uniqueDays,
                target: targetDays,
                pct: (uniqueDays / targetDays) * 100
            };
        });
        consistencyList.sort((a, b) => a.pct - b.pct);
        setConsistencyData(consistencyList);

        // Compliance Data
        const deptCompMap = {};
        consistencyList.forEach(user => {
            if (!deptCompMap[user.dept]) deptCompMap[user.dept] = { name: user.dept, actual: 0, target: 0 };
            deptCompMap[user.dept].actual += user.dars;
            deptCompMap[user.dept].target += user.target;
        });
        const complianceChartData = Object.values(deptCompMap).map(d => ({
            name: d.name,
            value: d.target > 0 ? Math.round((d.actual / d.target) * 100) : 0
        })).sort((a, b) => b.value - a.value);
        setComplianceData(complianceChartData);

        // Stats
        const { rate: subRate, count: subCount } = calculateSubmissionRate(activities, dynamicTotalEmp);
        // Calculate Average Daily Hours (Total Hours / User-Days)
        const avgHrs = userDayKeys.size > 0 ? Math.round((totalH / userDayKeys.size) * 10) / 10 : 0;
        let avgDiff = 0;
        let avgTrend = 'neutral';
        if (prevAvg > 0) {
            avgDiff = Math.round(((avgHrs - prevAvg) / prevAvg) * 100);
            if (avgDiff > 0) avgTrend = 'up';
            else if (avgDiff < 0) avgTrend = 'down';
        } else if (avgHrs > 0) {
            avgDiff = 100;
            avgTrend = 'up';
        }
        const avgIdleM = calculateIdleTime(activities);
        const avgIdleH = Math.round((avgIdleM / 60) * 10) / 10;

        // Helper to format minutes into "Xh Ym"
        const formatDuration = (totalMinutes) => {
            if (!totalMinutes) return "0h 0m";
            const h = Math.floor(totalMinutes / 60);
            const m = Math.round(totalMinutes % 60);
            return `${h}h ${m}m`;
        };

        setStats({
            submissionRate: subRate,
            submittedCount: subCount,
            totalEmployees: dynamicTotalEmp,
            topActivity: topAct,
            topActivityPercent: topActPercent,
            avgHours: formatDuration(avgHrs * 60), // Convert decimal hours back to minutes for formatting
            avgDiff: Math.abs(avgDiff),
            avgTrend: avgTrend,
            avgIdle: formatDuration(avgIdleM), // avgIdleM is already in minutes
            activeDepartment: topDept
        });

        // Category Chart
        const catChart = Object.entries(activityHours).map(([name, value], i) => ({
            name,
            value: Math.round(value * 10) / 10,
            color: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 6]
        })).sort((a, b) => b.value - a.value);
        setCategoryData(catChart);
    };

    const fetchInsights = async () => {
        setLoadingData(true);
        try {
            const start = new Date(filters.startDate);
            const end = new Date(filters.endDate);
            const dayDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const prevEnd = new Date(start);
            prevEnd.setDate(prevEnd.getDate() - 1);
            const prevStart = new Date(prevEnd);
            prevStart.setDate(prevStart.getDate() - (dayDiff - 1));

            const [res, prevRes, holRes] = await Promise.all([
                api.get(`/dar/activities/admin/all?startDate=${filters.startDate}&endDate=${filters.endDate}`),
                api.get(`/dar/activities/admin/all?startDate=${prevStart.toISOString().split('T')[0]}&endDate=${prevEnd.toISOString().split('T')[0]}`),
                api.get('/holiday')
            ]);

            if (res.data.ok) {
                let rawData = res.data.data;
                let prevData = prevRes.data.ok ? prevRes.data.data : [];
                const holidaySet = new Set();
                if (holRes.data?.holidays) {
                    holRes.data.holidays.forEach(h => holidaySet.add(h.holiday_date));
                }

                if (filters.dept !== 'All') {
                    rawData = rawData.filter(a => a.user_dept === filters.dept);
                    prevData = prevData.filter(a => a.user_dept === filters.dept);
                }
                if (filters.search.trim()) {
                    const q = filters.search.toLowerCase();
                    rawData = rawData.filter(a => a.user_name?.toLowerCase().includes(q));
                    prevData = prevData.filter(a => a.user_name?.toLowerCase().includes(q));
                }

                const prevAvg = calculateAvgWorkHours(prevData);
                processInsights(rawData, prevAvg, holidaySet, allUsers.length);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load insights");
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchInsights();
        }, 500);
        return () => clearTimeout(timer);
    }, [filters, allUsers]);

    return (
        <div className="flex flex-col gap-6 h-full overflow-y-auto pb-10 custom-scrollbar pr-2">

            {/* --- Enhanced Filter Bar (Real-time Monitoring Card) --- */}
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 sticky top-0 z-30">
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
                        <div className="relative">
                            <select
                                value={filters.dept}
                                onChange={(e) => setFilters(prev => ({ ...prev, dept: e.target.value }))}
                                className="appearance-none pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                            >
                                <option value="All">All Depts</option>
                                {departments.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                        </div>

                        {/* Preserved Controls */}
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 hidden md:flex">
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                className="bg-transparent text-xs font-bold text-slate-600 dark:text-slate-300 outline-none w-[90px]"
                            />
                            <span className="text-slate-400 font-bold">-</span>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                className="bg-transparent text-xs font-bold text-slate-600 dark:text-slate-300 outline-none w-[90px]"
                            />
                        </div>
                        <button
                            onClick={fetchInsights}
                            className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all shadow-sm active:scale-95"
                            title="Refresh Data"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">Submission Rate</div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white">{stats.submissionRate}%</div>
                        <div className="text-[10px] text-emerald-500 font-bold mt-1">
                            {Math.round(stats.submittedCount)}/{stats.totalEmployees} Employees
                        </div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2.5 rounded-full">
                        <FileText size={20} className="text-emerald-500" />
                    </div>
                </div>
                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-3">
                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">Top Activity</div>
                        <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 truncate" title={stats.topActivity}>{stats.topActivity}</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-1 truncate">{stats.topActivityPercent}% of total time</div>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2.5 rounded-full flex-shrink-0">
                        <BarChart3 size={20} className="text-indigo-500" />
                    </div>
                </div>
                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">Average Work Hours</div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{stats.avgHours || "0h 0m"}</div>
                            <div className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded ${stats.avgTrend === 'up' ? 'bg-emerald-50 text-emerald-600' : stats.avgTrend === 'down' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'
                                }`}>
                                {stats.avgTrend === 'up' ? <TrendingUp size={12} className="mr-1" /> : stats.avgTrend === 'down' ? <TrendingDown size={12} className="mr-1" /> : null}
                                {stats.avgDiff}%
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">Per active employee</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2.5 rounded-full">
                        <Clock size={20} className="text-purple-500" />
                    </div>
                </div>
                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">Average Idle Time</div>
                        <div className="text-2xl font-black text-orange-500 dark:text-orange-400">{stats.avgIdle}</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-1">Unaccounted gaps between shift</div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-2.5 rounded-full">
                        <Clock size={20} className="text-orange-500" />
                    </div>
                </div>
            </div>

            {/* Row 2: Workload Trend (Area Chart) */}
            <div className="lg:col-span-2 bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <BarChart3 size={20} className="text-indigo-500" />
                        Workload Distribution
                    </h3>
                </div>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} minTickGap={30} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}
                                labelStyle={{ color: '#64748b', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}
                                formatter={(value, name) => [formatDuration(value), name]}
                            />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                            {chartKeys.map((key, index) => (
                                <Area
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    stackId="1"
                                    stroke={['#6366f1', '#10b981', '#f59e0b', '#ec4899'][index % 4]}
                                    fill={['#6366f1', '#10b981', '#f59e0b', '#ec4899'][index % 4]}
                                    fillOpacity={0.6}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Row 3: Department Breakdown & Capacity Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Department Activity Stacked Bar */}
                <div className="lg:col-span-2 bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Building size={20} className="text-orange-500" /> Department Focus
                    </h3>
                    <div className="flex-1 w-full min-h-[300px] max-h-[400px] overflow-y-auto custom-scrollbar">
                        <div style={{ height: Math.max(300, deptData.length * 60) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={deptData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 600, fill: '#475569' }} width={100} />
                                    <Tooltip
                                        cursor={{ fill: '#F8FAFC' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value, name) => [formatDuration(value), name]}
                                    />
                                    {chartKeys.map((key, i) => (
                                        <Bar
                                            key={key}

                                            dataKey={key}
                                            stackId="a"
                                            fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 6]}
                                            radius={[0, 4, 4, 0]}
                                            barSize={20}
                                        />
                                    ))}
                                    {deptData.length === 0 && (
                                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" fontSize="14">
                                            No department data
                                        </text>
                                    )}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>


                {/* Employee Consistency */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <FileText size={20} className="text-indigo-500" /> Employee Consistency
                        </h3>
                        <div className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600">
                            Target: {consistencyData[0]?.target || 0} Reports
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar max-h-[300px]">
                        {consistencyData.map((user, i) => {
                            const pct = user.pct;
                            let barColor = 'bg-emerald-500';
                            if (pct < 50) barColor = 'bg-red-500';
                            else if (pct < 80) barColor = 'bg-amber-400';

                            return (
                                <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex-1 min-w-0 mr-4">
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{user.name}</div>
                                            <div className="text-[10px] font-bold text-slate-400">{user.dars}/{user.target} Reports</div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                            <div className={`h-full ${barColor} rounded-full`} style={{ width: `${Math.min(100, pct)}%` }}></div>
                                        </div>
                                    </div>
                                    <div className={`text-xs font-black px-2 py-1 rounded-lg ${pct < 50 ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : pct < 80 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                                        {Math.round(pct)}%
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Row 4: Category Pie & Compliance Bar (Existing, just moved down) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chart 3: Time Investment (Donut) */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                        <PieChartIcon size={20} className="text-purple-500" /> Time Investment
                    </h3>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Left: Chart */}
                        <div className="w-full md:w-1/2 h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value) => [formatDuration(value), 'Time']}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Right: Legend with Time */}
                        <div className="w-full md:w-1/2 flex flex-col gap-3 overflow-y-auto max-h-[200px] custom-scrollbar pr-2">
                            {categoryData.map((item, index) => (
                                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={item.name}>{item.name}</span>
                                    </div>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap ml-2">
                                        {formatDuration(item.value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Chart 4: Daily Submission Compliance (Bar) */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Users size={20} className="text-emerald-500" /> Submission Compliance
                    </h3>
                    <div className="flex-1 w-full min-h-[250px] overflow-x-auto custom-scrollbar pb-2">
                        <div style={{ width: `${Math.max(100, complianceData.length * 150)}px`, height: '100%', minWidth: '100%' }}>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={complianceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontWeight: 'bold' }} dy={10} interval={0} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B', fontWeight: 'bold' }} domain={[0, 100]} />
                                    <Tooltip
                                        cursor={{ fill: '#F1F5F9' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value) => [`${value}%`, 'Compliance']}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                                        {complianceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.value < 50 ? '#ef4444' : entry.value < 80 ? '#f59e0b' : '#10b981'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

        </div >
    );
};

export default DashboardInsights;
