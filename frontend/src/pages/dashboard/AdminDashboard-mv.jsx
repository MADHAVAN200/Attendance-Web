import React from 'react';
import { useNavigate } from 'react-router-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { useAuth } from '../../context/AuthContext';
import {
    Users,
    TrendingUp,
    AlertTriangle,
    Clock,
    CheckCircle,
    XCircle,
    Calendar,
    FileText,
    UserPlus,
    UserCheck,
    Briefcase,
    RefreshCw,
    Activity
} from 'lucide-react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { adminService } from '../../services/adminService';
import { attendanceService } from '../../services/attendanceService';
import { toast } from 'react-toastify';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { user, avatarTimestamp } = useAuth();
    const [stats, setStats] = React.useState({
        presentToday: 0,
        totalEmployees: 0,
        absentToday: 0,
        lateCheckins: 0
    });
    const [trends, setTrends] = React.useState({
        present: '0%',
        absent: '0%',
        late: '0%'
    });
    const [chartData, setChartData] = React.useState([]);
    const [activities, setActivities] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [activeRange, setActiveRange] = React.useState('weekly');
    const [viewMode, setViewMode] = React.useState('range'); // 'range' or 'calendar'
    const [selectedMonth, setSelectedMonth] = React.useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
    const [isFeedExpanded, setIsFeedExpanded] = React.useState(false);

    // Cache for dashboard data
    const dataCache = React.useRef({});

    React.useEffect(() => {
        if (viewMode === 'range') {
            fetchDashboardData(activeRange);
        } else {
            fetchDashboardData('custom', selectedMonth, selectedYear);
        }
    }, [activeRange, viewMode, selectedMonth, selectedYear]);

    const fetchDashboardData = async (range, month = null, year = null, forceRefresh = false) => {
        const cacheKey = `${range}_${month || 'now'}_${year || 'now'}`;

        if (!forceRefresh && dataCache.current[cacheKey]) {
            const cachedData = dataCache.current[cacheKey];
            setStats(cachedData.stats);
            setTrends(cachedData.trends);
            setChartData(cachedData.chartData);
            setActivities(cachedData.activities);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const res = await adminService.getDashboardStats(range, month, year);
            if (res.success) {
                let finalActivities = res.activities || [];
                
                // Fallback: If no activities are returned from the main stats, 
                // fetch real-time attendance to populate the feed
                if (finalActivities.length === 0) {
                    try {
                        const attendanceRes = await attendanceService.getRealTimeAttendance();
                        if (attendanceRes.data) {
                            finalActivities = attendanceRes.data.map(record => ({
                                id: `att-${record.acr_id}`,
                                user: record.user_name,
                                action: record.time_out ? 'Checked Out' : 'Checked In',
                                time: record.time_out || record.time_in,
                                profile_image_url: record.profile_image_url,
                                role: record.designation || 'Staff'
                            })).slice(0, 10);
                        }
                    } catch (attError) {
                        console.error("Failed to fetch fallback activities", attError);
                    }
                }

                const dataToCache = {
                    stats: res.stats,
                    trends: res.trends,
                    chartData: res.chartData,
                    activities: finalActivities
                };
                setStats(dataToCache.stats);
                setTrends(dataToCache.trends);
                setChartData(dataToCache.chartData);
                setActivities(dataToCache.activities);
                dataCache.current[cacheKey] = dataToCache;
            }
        } catch (error) {
            console.error("Dashboard error:", error);
            toast.error("Failed to load dashboard statistics");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = () => {
        if (viewMode === 'range') {
            fetchDashboardData(activeRange, null, null, true);
        } else {
            fetchDashboardData('custom', selectedMonth, selectedYear, true);
        }
    };

    const alerts = [
        { id: 1, type: 'warning', message: 'High absence rate in Sales Dept.' },
        { id: 2, type: 'error', message: '3 Unapproved Overtime requests.' },
    ];

    const refreshButton = (
        <button
            onClick={handleRefresh}
            className="text-slate-500 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
        >
            <RefreshCw size={16} className={`${isLoading ? 'animate-spin' : ''}`} />
        </button>
    );

    return (
        <MobileDashboardLayout title="Dashboard" hideHeader={false} headerAction={refreshButton}>
            <div className="pb-24 space-y-6 animate-fade-in px-1">

                {/* Compact 2x2 Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <StatCard
                        title="Present"
                        value={`${stats.presentToday}`}
                        total={`/ ${stats.totalEmployees}`}
                        trend={trends.present}
                        trendUp={parseFloat(trends.present) >= 0}
                        icon={<CheckCircle size={16} />}
                        color="emerald"
                        loading={isLoading}
                    />
                    <StatCard
                        title="Absent"
                        value={`${stats.absentToday}`}
                        trend={trends.absent}
                        trendUp={parseFloat(trends.absent) < 0}
                        icon={<XCircle size={16} />}
                        color="rose"
                        loading={isLoading}
                    />
                    <StatCard
                        title="Late"
                        value={`${stats.lateCheckins}`}
                        trend={trends.late}
                        trendUp={parseFloat(trends.late) < 0}
                        icon={<Clock size={16} />}
                        color="amber"
                        loading={isLoading}
                    />
                    <StatCard
                        title="Leave"
                        value={`${stats.onLeave || 0}`}
                        icon={<Calendar size={16} />}
                        color="indigo"
                        loading={isLoading}
                    />
                </div>

                {/* Quick Actions Grid - Horizontal & Compact */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Management</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <QuickAction
                            onClick={() => navigate('/employees')}
                            icon={<UserPlus size={16} />}
                            label="Add Staff"
                            color="indigo"
                        />
                        <QuickAction
                            onClick={() => navigate('/attendance-monitoring')}
                            icon={<Activity size={16} />}
                            label="Monitor"
                            color="rose"
                        />
                        <QuickAction
                            onClick={() => navigate('/shifts')}
                            icon={<Briefcase size={16} />}
                            label="Shifts"
                            color="purple"
                        />
                    </div>
                </div>

                {/* Analytics Segment - Glassmorphism */}
                <div className="bg-white/60 dark:bg-[#0d1117]/60 backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Analytics</h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">Weekly Trends</p>
                        </div>
                        <TrendingUp size={14} className="text-indigo-500" />
                    </div>

                    <div className="h-48">
                        {isLoading ? (
                            <div className="w-full h-full animate-pulse bg-slate-100 dark:bg-white/5 rounded-xl"></div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '10px' }}
                                    />
                                    <Area type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPresent)" name="Present" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Live Activity - Compact List */}
                <div className="bg-white/60 dark:bg-[#0d1117]/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between border-b border-slate-50 dark:border-white/5">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Recent Activity</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live</span>
                        </div>
                    </div>

                    <div className="divide-y divide-slate-50 dark:divide-white/5 max-h-[320px] overflow-y-auto no-scrollbar">
                        {isLoading ? (
                            <div className="p-4 space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center gap-3 animate-pulse">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5"></div>
                                        <div className="flex-1 space-y-2">
                                            <div className="h-2.5 bg-slate-100 dark:bg-white/5 rounded w-1/3"></div>
                                            <div className="h-2 bg-slate-100 dark:bg-white/5 rounded w-1/2"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (activities && activities.length > 0) ? (
                            activities.map((activity) => (
                                <div key={activity.id} className="flex items-center gap-3 p-3.5 active:bg-slate-50 dark:active:bg-white/5 transition-colors">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-[#1a1f2e] text-indigo-500 font-black text-sm shrink-0 overflow-hidden shadow-sm border border-white dark:border-white/5">
                                        {activity.profile_image_url ? (
                                            <img src={`${activity.profile_image_url}?t=${avatarTimestamp}`} alt={activity.user} className="w-full h-full object-cover" />
                                        ) : (
                                            activity.user?.charAt(0) || '?'
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">{activity.user || 'Unknown User'}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-tighter truncate">{activity.role || 'Staff'}</span>
                                            <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full"></span>
                                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter truncate">{activity.action}</span>
                                        </div>
                                    </div>

                                    <div className="shrink-0 text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tabular-nums">
                                        {activity.time ? activity.time.split(' ')[1] : 'Now'}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                No activity recorded
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MobileDashboardLayout>
    );
};

const StatCard = ({ title, value, total, icon, trend, trendUp, color, loading }) => {
    const colors = {
        emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/10',
        rose: 'text-rose-500 bg-rose-500/10 border-rose-500/10',
        amber: 'text-amber-500 bg-amber-500/10 border-amber-500/10',
        indigo: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/10'
    };

    return (
        <div className="bg-white dark:bg-[#0d1117] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 relative overflow-hidden group">
            {loading ? (
                <div className="animate-pulse space-y-3">
                    <div className="h-2.5 bg-slate-100 dark:bg-white/5 rounded w-1/2"></div>
                    <div className="h-6 bg-slate-100 dark:bg-white/5 rounded w-2/3"></div>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg border ${colors[color]}`}>
                            {icon}
                        </div>
                        <p className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">{title}</p>
                    </div>

                    <div className="flex items-baseline gap-1">
                        <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                            {value}
                        </h4>
                        {total && <span className="text-[10px] font-bold text-slate-400 tracking-tighter">{total}</span>}
                    </div>

                    {trend && (
                        <div className={`text-[9px] mt-1.5 font-black uppercase tracking-tighter flex items-center gap-1 ${trendUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {trendUp ? '↑' : '↓'} {trend}
                            <span className="text-slate-400 dark:text-slate-600">vs prev</span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const QuickAction = ({ icon, label, onClick, color }) => {
    const colors = {
        indigo: 'text-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 border-indigo-500/10',
        rose: 'text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/10',
        purple: 'text-purple-500 bg-purple-500/5 hover:bg-purple-500/10 border-purple-500/10'
    };

    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 space-y-2 ${colors[color]}`}
        >
            <div className="p-2 rounded-xl bg-white dark:bg-[#0d1117] shadow-sm">
                {icon}
            </div>
            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-700 dark:text-slate-300">{label}</span>
        </button>
    );
};

export default AdminDashboard;
