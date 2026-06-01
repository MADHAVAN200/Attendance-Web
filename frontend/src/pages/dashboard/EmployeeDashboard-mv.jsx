import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { useAuth } from '../../context/AuthContext';
import {
    Clock,
    Calendar,
    Briefcase,
    AlertCircle,
    CheckCircle,
    XCircle,
    TrendingUp,
    ChevronRight,
    Coffee,
    Activity
} from 'lucide-react';
import { attendanceService } from '../../services/attendanceService';
import { toast } from 'react-toastify';

const EmployeeDashboard = () => {
    const { user, avatarTimestamp } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        daysPresent: 0,
        daysAbsent: 0,
        lateDays: 0,
        avgHours: 0
    });
    const [todayStatus, setTodayStatus] = useState(null);
    const [upcomingHolidays, setUpcomingHolidays] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [missedPunchWarning, setMissedPunchWarning] = useState(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [statsRes, todayRes, holidaysRes, activityRes] = await Promise.all([
                attendanceService.getMyStats(),
                attendanceService.getTodayStatus(),
                attendanceService.getUpcomingHolidays(),
                attendanceService.getRecentActivity()
            ]);

            if (statsRes.success) setStats(statsRes.data);
            if (todayRes.success) setTodayStatus(todayRes.data);
            if (holidaysRes.success) setUpcomingHolidays(holidaysRes.data);
            if (activityRes.success) setRecentActivity(activityRes.data);

            // Fetch recent records to detect missed punches
            const recentRes = await attendanceService.getMyRecords();
            if (recentRes && recentRes.data && recentRes.data.length > 0) {
                const today = new Date();
                const todayDateStr = today.toISOString().split('T')[0];
                
                const todayMidnight = new Date(today);
                todayMidnight.setHours(0, 0, 0, 0);

                const missedDates = [];

                for (const session of recentRes.data) {
                    if (!session.time_out) {
                        const sessionDate = new Date(session.time_in);
                        const sessionDateStr = sessionDate.toISOString().split('T')[0];

                        if (sessionDateStr < todayDateStr) {
                            const diffTime = todayMidnight - new Date(sessionDate).setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            const isNotProcessed = !['ABSENT', 'REJECTED'].includes(session.status);
                            if (isNotProcessed && diffDays <= 7) {
                                missedDates.push(sessionDateStr);
                            }
                        }
                    }
                }
                setMissedPunchWarning(missedDates.length > 0 ? { dates: [...new Set(missedDates)] } : null);
            }
        } catch (error) {
            console.error("Dashboard Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <MobileDashboardLayout title="Employee Dashboard" hideHeader={false}>
            <div className="space-y-6">
                {/* 1. Welcome Section */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12 blur-xl"></div>

                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full border-2 border-white/30 bg-white/10 backdrop-blur-sm flex items-center justify-center text-2xl font-bold overflow-hidden shadow-inner">
                            {user?.profile_image_url ? (
                                <img
                                    src={`${user.profile_image_url}?t=${avatarTimestamp}`}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                user?.name?.charAt(0) || 'U'
                            )}
                        </div>
                        <div>
                            <p className="text-indigo-100 text-sm font-medium opacity-90">{getGreeting()},</p>
                            <h2 className="text-2xl font-bold tracking-tight">{user?.name?.split(' ')[0]}</h2>
                            <p className="text-xs text-indigo-200 mt-1 flex items-center gap-1">
                                <Briefcase size={12} />
                                {user?.designation || 'Employee'}
                            </p>
                        </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="mt-6 flex gap-3 relative z-10">
                        <button
                            onClick={() => navigate('/attendance')}
                            className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/10 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Clock size={16} /> My Attendance
                        </button>
                        <button
                            onClick={() => navigate('/apply-leave')}
                            className="flex-1 bg-white text-indigo-600 hover:bg-indigo-50 py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Coffee size={16} /> Apply Leave
                        </button>
                    </div>
                </div>

                {/* Missed Time Out Banner */}
                {missedPunchWarning && (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 rounded-2xl flex flex-col gap-3 justify-between animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-xl relative mt-0.5 shrink-0">
                                <AlertCircle size={20} />
                                {missedPunchWarning.dates.length > 1 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                                        {missedPunchWarning.dates.length}
                                    </span>
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-amber-800 dark:text-amber-500">Missed Time Out</p>
                                <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-1 leading-relaxed font-medium">
                                    You forgot to time out on {missedPunchWarning.dates.join(', ')}. Please submit a correction request or it will be marked absent.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/attendance?tab=my_attendance&subTab=correction')}
                            className="w-full py-3 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-md text-center"
                        >
                            Fix Now
                        </button>
                    </div>
                )}

                {/* 2. Today's Status Card */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-github-dark-border">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Clock size={14} /> Today's Status
                    </h3>
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-400 font-medium uppercase">Check In</span>
                            <span className={`text-xl font-bold font-mono ${todayStatus?.time_in ? 'text-slate-800 dark:text-github-dark-text' : 'text-slate-300 dark:text-slate-600'}`}>
                                {todayStatus?.time_in || '--:--'}
                            </span>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-400 font-medium uppercase">Check Out</span>
                            <span className={`text-xl font-bold font-mono ${todayStatus?.time_out ? 'text-slate-800 dark:text-github-dark-text' : 'text-slate-300 dark:text-slate-600'}`}>
                                {todayStatus?.time_out || '--:--'}
                            </span>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-400 font-medium uppercase">Duration</span>
                            <span className={`text-xl font-bold font-mono ${todayStatus?.duration ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                {todayStatus?.duration || '0h'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Monthly Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-github-dark-border flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                            <CheckCircle size={18} />
                        </div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-github-dark-text">{stats.daysPresent}</span>
                        <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Present Days</span>
                    </div>

                    <div className="bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-github-dark-border flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
                            <AlertCircle size={18} />
                        </div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-github-dark-text">{stats.lateDays}</span>
                        <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Late Check-ins</span>
                    </div>

                    <div className="bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-github-dark-border flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center mb-2">
                            <XCircle size={18} />
                        </div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-github-dark-text">{stats.daysAbsent}</span>
                        <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Absents</span>
                    </div>

                    <div className="bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-github-dark-border flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                            <TrendingUp size={18} />
                        </div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-github-dark-text">{stats.avgHours}h</span>
                        <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Avg Hours</span>
                    </div>
                </div>

                {/* 4. Recent Activity */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-github-dark-border">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-2 mb-4">
                        <Activity size={16} className="text-emerald-500" /> Recent Activity
                    </h3>
                    <div className="space-y-4">
                        {recentActivity.length > 0 ? (
                            recentActivity.slice(0, 5).map((activity, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                        activity.action.toLowerCase().includes('in') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                    }`}>
                                        <Clock size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-github-dark-text truncate">{activity.action}</p>
                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted">{activity.time || activity.date}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-4 text-sm text-slate-400 italic">No recent activity</div>
                        )}
                    </div>
                </div>

                {/* 5. Upcoming Holidays */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-github-dark-border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                            <Calendar size={14} className="text-indigo-500" /> Upcoming Holidays
                        </h3>
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer hover:underline" onClick={() => navigate('/holidays')}>View All</span>
                    </div>

                    <div className="space-y-3">
                        {upcomingHolidays.length > 0 ? (
                            upcomingHolidays.slice(0, 3).map((holiday, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-100 dark:border-github-dark-border">
                                    <div className="flex flex-col items-center justify-center w-10 h-10 bg-white dark:bg-slate-700 rounded-lg shadow-sm text-center border border-slate-200 dark:border-github-dark-border">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">{new Date(holiday.date).toLocaleString('default', { month: 'short' })}</span>
                                        <span className="text-sm font-bold text-slate-800 dark:text-github-dark-text">{new Date(holiday.date).getDate()}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">{holiday.name}</h4>
                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted">{new Date(holiday.date).toLocaleDateString(undefined, { weekday: 'long' })}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-4 text-sm text-slate-400 italic">No upcoming holidays</div>
                        )}
                    </div>
                </div>

            </div>
        </MobileDashboardLayout>
    );
};

export default EmployeeDashboard;
