import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import MinimalSelect from '../../components/MinimalSelect';
import { useAuth } from '../../context/AuthContext';
import {
    Users,
    TrendingUp,
    Clock,
    CheckCircle,
    XCircle,
    Calendar,
    FileText,
    UserPlus,
    Briefcase,
    RefreshCw
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
import { toast } from 'react-toastify';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { avatarTimestamp, user } = useAuth();
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

    // Cache for dashboard data
    const dataCache = React.useRef({});


    React.useEffect(() => {
        if (!user || !['admin', 'hr'].includes(user.user_type)) {
            setIsLoading(false);
            return;
        }

        if (viewMode === 'range') {
            fetchDashboardData(activeRange);
        } else {
            fetchDashboardData('custom', selectedMonth, selectedYear);
        }
    }, [activeRange, viewMode, selectedMonth, selectedYear, user]);

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
                const dataToCache = {
                    stats: res.stats,
                    trends: res.trends,
                    chartData: res.chartData,
                    activities: res.activities,
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


    return (
        <DashboardLayout title="Dashboard">
            <div className="space-y-6 sm:space-y-8">
                {/* Stats and Charts - Only for Admin and HR */}
                {['admin', 'hr'].includes(useAuth().user?.user_type) ? (
                    <>
                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                            <StatCard
                                title="Present Today"
                                value={stats.presentToday}
                                total={`/ ${stats.totalEmployees}`}
                                icon={<CheckCircle className="text-emerald-500" size={24} />}
                                trend={trends.present}
                                trendUp={trends.present?.startsWith('+')}
                                loading={isLoading}
                                period={viewMode === 'calendar' ? `${new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'short' })} ${selectedYear}` : activeRange}
                            />
                            <StatCard
                                title="Absent"
                                value={stats.absentToday}
                                total="Employees"
                                icon={<XCircle className="text-red-500" size={24} />}
                                trend={trends.absent}
                                trendUp={trends.absent?.startsWith('-')}
                                loading={isLoading}
                                period={viewMode === 'calendar' ? `${new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'short' })} ${selectedYear}` : activeRange}
                            />
                            <StatCard
                                title="Late Check-ins"
                                value={stats.lateCheckins}
                                total="Employees"
                                icon={<Clock className="text-amber-500" size={24} />}
                                trend={trends.late}
                                trendUp={trends.late?.startsWith('-')}
                                loading={isLoading}
                                period={viewMode === 'calendar' ? `${new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'short' })} ${selectedYear}` : activeRange}
                            />
                            <StatCard
                                title="On Leave"
                                value="4"
                                total="Planned"
                                icon={<Calendar className="text-indigo-500" size={24} />}
                                period="Monthly"
                                loading={isLoading}
                            />
                        </div>

                        {/* Quick Links - Only for Admin and HR */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-3">
                                <h3 className="text-sm font-medium text-slate-500 dark:text-github-dark-muted uppercase tracking-wider mb-3">Quick Actions</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <QuickLinkCard onClick={() => navigate('/employees')} icon={<UserPlus size={20} />} title="Add Employee" desc="Create new user profile" />
                                    <QuickLinkCard onClick={() => navigate('/reports')} icon={<FileText size={20} />} title="Generate Report" desc="Download monthly stats" />
                                    <QuickLinkCard onClick={() => navigate('/shift-management')} icon={<Briefcase size={20} />} title="Manage Shifts" desc="Update work schedules" />
                                </div>
                            </div>
                        </div>

                        {/* Content Grid - Structured for parallel heights */}
                        <div className="space-y-8">
                            {/* 1. Overall Attendance Trends (Full Width) */}
                            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border p-6 transition-colors duration-300">
                                <div className="flex items-center justify-between mb-6 gap-2">
                                        <div className="flex-shrink-0">
                                            <h3 className="font-semibold text-base sm:text-lg text-slate-800 dark:text-github-dark-text truncate max-w-[150px] sm:max-w-none">Overall Trends</h3>
                                        </div>

                                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                                            {/* Main Mode Toggle (Pill Style) */}
                                            <div className="flex p-0.5 bg-slate-100 dark:bg-github-dark-subtle/50 rounded-lg border border-slate-200 dark:border-github-dark-border/50 flex-shrink-0">
                                                <button
                                                    onClick={() => setViewMode('range')}
                                                    className={`px-3 py-1 rounded-md text-[10px] sm:text-xs font-bold transition-all duration-200 ${viewMode === 'range'
                                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                        : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700'}`}
                                                >
                                                    Quick
                                                </button>
                                                <button
                                                    onClick={() => setViewMode('calendar')}
                                                    className={`px-3 py-1 rounded-md text-[10px] sm:text-xs font-bold transition-all duration-200 ${viewMode === 'calendar'
                                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                        : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700'}`}
                                                >
                                                    Calendar
                                                </button>
                                            </div>

                                            {/* Sub-selectors and Sync - Compact Wrapper */}
                                            <div className="flex items-center gap-1.5 h-8 px-1.5 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-lg border border-slate-200 dark:border-github-dark-border/50 flex-shrink-0">
                                                {viewMode === 'range' ? (
                                                    <div className="flex items-center">
                                                        {['daily', 'weekly', 'monthly'].map((r) => (
                                                            <button
                                                                key={r}
                                                                onClick={() => setActiveRange(r)}
                                                                className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold transition-all ${activeRange === r
                                                                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                                                                    : 'text-slate-400 dark:text-github-dark-muted'
                                                                    }`}
                                                            >
                                                                {r.charAt(0).toUpperCase()}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <MinimalSelect
                                                            size="sm"
                                                            menuWidth={100}
                                                            triggerClassName="!bg-transparent !border-0 !p-0 !h-auto !w-auto text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                                                            value={new Date(0, selectedMonth - 1).toLocaleString('default', { month: 'short' })}
                                                            options={Array.from({ length: 12 }, (_, i) => new Date(0, i).toLocaleString('default', { month: 'short' }))}
                                                            onChange={(val) => {
                                                                const monthMap = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
                                                                setSelectedMonth(monthMap[val]);
                                                            }}
                                                        />
                                                        <div className="w-px h-3 bg-slate-300 dark:bg-slate-600 mx-1" />
                                                        <MinimalSelect
                                                            size="sm"
                                                            menuWidth={80}
                                                            triggerClassName="!bg-transparent !border-0 !p-0 !h-auto !w-auto text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                                                            value={String(selectedYear)}
                                                            options={Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i))}
                                                            onChange={(val) => setSelectedYear(parseInt(val))}
                                                        />
                                                    </div>
                                                )}

                                                <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />

                                                <button
                                                    onClick={handleRefresh}
                                                    disabled={isLoading}
                                                    className={`p-1 rounded-md text-slate-400 hover:text-indigo-600 transition-all ${isLoading ? 'opacity-50' : ''}`}
                                                    title="Sync Data"
                                                >
                                                    <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-72">
                                        {isLoading ? (
                                            <div className="w-full h-full animate-pulse bg-slate-50 dark:bg-slate-700/20 rounded-lg flex items-center justify-center">
                                                <div className="h-40 w-full mx-8 flex items-end gap-4">
                                                    {[1, 2, 3, 4, 5].map(i => (
                                                        <div key={i} className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-t" style={{ height: `${20 * i}%` }}></div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-10" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: 'transparent' }} />
                                                    <Bar dataKey="present" fill="#10b981" radius={[4, 4, 0, 0]} name="Present" />
                                                    <Bar dataKey="absent" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Absent" />
                                                    <Bar dataKey="late" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Late" />
                                                    <Legend verticalAlign="top" height={36} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                            </div>
                        </div>

                        {/* Bottom Row: Present vs Absent, Present vs Late, and Live Feed (Equal Parallel Height) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* 2. Present vs Absent (Area Chart) */}
                            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border p-6 transition-colors duration-300 flex flex-col h-[480px]">
                                <h3 className="font-semibold text-base text-slate-800 dark:text-github-dark-text mb-4">Present vs Absent</h3>
                                <div className="flex-1 min-h-0">
                                    {isLoading ? (
                                        <div className="w-full h-full animate-pulse bg-slate-50 dark:bg-slate-700/20 rounded-lg" />
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData}>
                                                <defs>
                                                    <linearGradient id="colorPresent2" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorAbsent2" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-10" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: 12 }} />
                                                <Area type="monotone" dataKey="present" stroke="#6366f1" fillOpacity={1} fill="url(#colorPresent2)" name="Present" />
                                                <Area type="monotone" dataKey="absent" stroke="#f43f5e" fillOpacity={1} fill="url(#colorAbsent2)" name="Absent" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* 3. Present vs Late (Line Chart) */}
                            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border p-6 transition-colors duration-300 flex flex-col h-[480px]">
                                <h3 className="font-semibold text-base text-slate-800 dark:text-github-dark-text mb-4">Present vs Late</h3>
                                <div className="flex-1 min-h-0">
                                    {isLoading ? (
                                        <div className="w-full h-full animate-pulse bg-slate-50 dark:bg-slate-700/20 rounded-lg" />
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-10" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: 12 }} />
                                                <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Present" />
                                                <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Late" />
                                                <Legend verticalAlign="top" height={36} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Live Activity Feed (Now parallel with charts) */}
                            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border p-6 transition-colors duration-300 flex flex-col h-[480px]">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-800 dark:text-github-dark-text">Active Feed</h3>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                        </span>
                                        Live
                                    </div>
                                </div>
                                <div className="space-y-5 px-1 transition-all duration-300 overflow-y-auto custom-scrollbar flex-1">
                                    {isLoading ? (
                                        [1, 2, 3, 4].map(i => (
                                            <div key={i} className="flex items-start gap-4 pb-4 border-b border-slate-50 dark:border-github-dark-border/50 last:border-0 last:pb-0 animate-pulse">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0"></div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                                                    <div className="h-2 bg-slate-100 dark:bg-github-dark-subtle rounded w-1/2"></div>
                                                </div>
                                            </div>
                                        ))
                                    ) : activities.length > 0 ? (
                                        activities.map((activity) => (
                                            <div key={activity.id} className="flex items-start gap-3 pb-4 border-b border-slate-50/50 dark:border-github-dark-border/40 last:border-0 last:pb-0 group/feed relative">
                                                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 text-xs font-black text-indigo-600 dark:text-indigo-400 overflow-hidden border border-indigo-100/50 dark:border-indigo-800/50">
                                                    {activity.profile_image_url ? (
                                                        <img src={`${activity.profile_image_url}?t=${avatarTimestamp}`} alt={activity.user} className="w-full h-full object-cover" />
                                                    ) : (
                                                        activity.user?.charAt(0) || '?'
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-bold text-slate-800 dark:text-github-dark-text truncate group-hover/feed:text-indigo-600 dark:group-hover/feed:text-indigo-400 transition-colors">{activity.user || 'Unknown User'}</p>
                                                    <p className="text-[10px] text-slate-500 dark:text-github-dark-muted mt-0.5 leading-tight">{activity.action}</p>
                                                </div>
                                                <div className="text-right flex flex-col items-end gap-1">
                                                    <span className="text-[9px] font-black uppercase text-slate-400 dark:text-github-dark-muted tracking-tighter">
                                                        {activity.time}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-8 text-center">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No activity mapped</p>
                                        </div>
                                    )}
                                </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
                            <Users size={32} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-github-dark-text mb-2">Welcome Back!</h2>
                        <p className="text-slate-500 dark:text-github-dark-muted">Manage your attendance, holidays and profile from the sidebar.</p>
                        <button
                            onClick={() => navigate('/attendance')}
                            className="mt-6 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                        >
                            Go to My Attendance
                        </button>
                    </div>
                )}
            </div>
        </DashboardLayout >
    );
};

const StatCard = ({ title, value, total, icon, trend, trendUp, period, loading }) => (
    <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
        {loading ? (
            <div className="animate-pulse space-y-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-2 w-full">
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                    </div>
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                </div>
                <div className="h-4 bg-slate-100 dark:bg-github-dark-subtle rounded w-2/3"></div>
            </div>
        ) : (
            <>
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-github-dark-muted">{title}</p>
                        <h4 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1 tracking-tight">{value} <span className="text-sm font-normal text-slate-400 dark:text-github-dark-muted">{total}</span></h4>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-github-dark-border">
                        {icon}
                    </div>
                </div>
                <div className="flex items-center text-sm">
                    {trend && (
                        <span className={`font-semibold ${trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'} flex items-center bg-opacity-10 px-1.5 py-0.5 rounded`}>
                            {trendUp ? '↑' : '↓'} {trend}
                        </span>
                    )}
                    {trend && (
                        <span className="text-slate-400 dark:text-github-dark-muted ml-2">
                            vs {period === 'daily' ? 'yesterday' : period === 'weekly' ? 'last week' : 'last month'}
                        </span>
                    )}
                    {!trend && period && <span className="text-slate-400 dark:text-github-dark-muted bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded">{period}</span>}
                </div>
            </>
        )}
    </div>
);

const QuickLinkCard = ({ icon, title, desc, onClick }) => (
    <div
        onClick={onClick}
        className="bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all cursor-pointer group"
    >
        <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:bg-indigo-600 dark:group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                {icon}
            </div>
            <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">{title}</h4>
                <p className="text-xs text-slate-500 dark:text-github-dark-muted">{desc}</p>
            </div>
        </div>
    </div>
);

export default AdminDashboard;
