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
                const dataToCache = {
                    stats: res.stats,
                    trends: res.trends,
                    chartData: res.chartData,
                    activities: res.activities
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

    return (
        <MobileDashboardLayout title="Dashboard" hideHeader={false}>
            <div className="py-2 space-y-8 animate-fade-in">
                {/* Stats Stack */}
                <div className="space-y-4">
                    <StatCard
                        title="Present Today"
                        value={`${stats.presentToday}`}
                        total={`/ ${stats.totalEmployees}`}
                        trend={trends.present}
                        trendUp={parseFloat(trends.present) >= 0}
                        icon={<CheckCircle size={20} className="text-emerald-500" strokeWidth={2} />}
                        iconBg="border border-emerald-500/20 bg-emerald-500/10"
                        loading={isLoading}
                    />
                    <StatCard
                        title="Absent"
                        value={`${stats.absentToday} Employees`}
                        trend={trends.absent}
                        trendUp={parseFloat(trends.absent) < 0}
                        icon={<XCircle size={20} className="text-rose-500" strokeWidth={2} />}
                        iconBg="border border-rose-500/20 bg-rose-500/10"
                        loading={isLoading}
                    />
                    <StatCard
                        title="Late Check-ins"
                        value={`${stats.lateCheckins} Employees`}
                        trend={trends.late}
                        trendUp={parseFloat(trends.late) < 0}
                        icon={<Clock size={20} className="text-amber-500" strokeWidth={2} />}
                        iconBg="border border-amber-500/20 bg-amber-500/10"
                        loading={isLoading}
                    />
                    <StatCard
                        title="On Leave"
                        value={`${stats.onLeave || 0} Planned`}
                        trend=""
                        icon={<Calendar size={20} className="text-indigo-400" strokeWidth={2} />}
                        iconBg="border border-indigo-400/20 bg-indigo-400/10"
                        loading={isLoading}
                    />
                </div>

                {/* Quick Actions */}
                <div>
                    <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-3 px-1">Quick Actions</h3>
                    <div className="space-y-3">
                        <QuickLinkCard
                            onClick={() => navigate('/mobile-view/employees')}
                            icon={<UserPlus size={20} className="text-indigo-400" />}
                            iconBg="bg-indigo-500/10"
                            title="Add Employee"
                        />
                        <QuickLinkCard
                            onClick={() => navigate('/mobile-view/attendance-monitoring')}
                            icon={<AlertTriangle size={20} className="text-rose-400" />}
                            iconBg="bg-rose-500/10"
                            title="Live Monitor"
                        />
                        <QuickLinkCard
                            onClick={() => navigate('/mobile-view/shifts')}
                            icon={<Briefcase size={20} className="text-purple-400" />}
                            iconBg="bg-purple-500/10"
                            title="Manage Shifts"
                        />
                    </div>
                </div>

                {/* Analytics Segment */}
                <div>
                    <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-3 px-1">Analytics</h3>

                    <div className="bg-white dark:bg-[#1a2332] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800/60">
                        <h4 className="text-lg font-bold text-slate-800 dark:text-white">Attendance Trends</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 mt-1">Weekly Insight</p>

                        <div className="h-64 mt-4">
                            {isLoading ? (
                                <div className="w-full h-full animate-pulse bg-slate-50 dark:bg-slate-800/50 rounded-lg"></div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Legend
                                            verticalAlign="top"
                                            height={36}
                                            iconType="circle"
                                            wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', left: 0 }}
                                        />
                                        <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#1a2332' }} name="Present" />
                                        <Line type="monotone" dataKey="absent" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#1a2332' }} name="Absent" />
                                        <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#1a2332' }} name="Late" />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>

                {/* Live Activity Segment */}
                <div className="bg-white dark:bg-[#1a2332] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800/60">
                    <div className="p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Live Activity</h3>
                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                    </div>

                    <div className="p-2">
                        {isLoading ? (
                            <div className="p-4 space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-start gap-4 animate-pulse">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                        <div className="flex-1 space-y-2 py-1">
                                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                                            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : activities.length > 0 ? (
                            <div className="flex flex-col">
                                {activities.map((activity, index) => (
                                    <div key={activity.id} className={`flex items-start gap-4 p-4 ${index !== activities.length - 1 ? 'border-b border-slate-50 dark:border-[#202b3d]' : ''}`}>
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#2b2533] text-[#f43f5e] font-bold text-lg shrink-0 overflow-hidden">
                                            {activity.profile_image_url ? (
                                                <img src={`${activity.profile_image_url}?t=${avatarTimestamp}`} alt={activity.user} className="w-full h-full object-cover" />
                                            ) : (
                                                activity.user?.charAt(0) || '?'
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0 pr-2">
                                            <p className="text-[15px] font-bold text-slate-800 dark:text-white truncate">{activity.user || 'Unknown User'}</p>
                                            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{activity.role || 'Employee'} • {activity.action}</p>
                                        </div>

                                        <div className="shrink-0 bg-slate-100 dark:bg-[#151b28] px-2.5 py-1.5 rounded text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-1">
                                            {activity.time ? activity.time.split(' ')[1] + ' ' + (activity.time.split(' ')[2] || '') : 'Now'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-slate-500">
                                No activity yet today
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MobileDashboardLayout>
    );
};

const StatCard = ({ title, value, total, icon, trend, trendUp, period, loading, iconBg }) => (
    <div className="bg-white dark:bg-[#1a2332] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800/60 relative overflow-hidden">
        {loading ? (
            <div className="animate-pulse space-y-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
            </div>
        ) : (
            <>
                <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{title}</p>
                    <div className={`p-2 rounded-full ${iconBg}`}>
                        {icon}
                    </div>
                </div>

                <h4 className="text-[28px] font-bold text-slate-800 dark:text-white tracking-tight flex items-baseline gap-1">
                    {value.split(' ')[0]}
                    {value.split(' ')[1] && <span className="text-sm font-normal text-slate-800 dark:text-white"> {value.split(' ').slice(1).join(' ')}</span>}
                    {total && <span className="text-sm font-normal text-slate-400">{total}</span>}
                </h4>

                {trend !== undefined && trend !== "" && (
                    <div className="flex items-center text-[13px] mt-2 font-bold">
                        <span className={`${trendUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {trendUp && !trend.startsWith('+') && !trend.startsWith('-') ? '+' : ''}{trend}
                        </span>
                        <span className="text-slate-400 dark:text-slate-400 font-normal ml-1">vs yesterday</span>
                    </div>
                )}
            </>
        )}
    </div>
);

const QuickLinkCard = ({ icon, title, onClick, iconBg }) => (
    <div
        onClick={onClick}
        className="bg-white dark:bg-[#1a2332] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800/60 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer"
    >
        <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                {icon}
            </div>
            <h4 className="text-[15px] font-semibold text-slate-800 dark:text-slate-200 tracking-wide">{title}</h4>
        </div>
        <div className="text-slate-400 dark:text-slate-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </div>
    </div>
);

export default AdminDashboard;
