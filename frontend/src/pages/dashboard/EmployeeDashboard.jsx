import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import {
    Calendar,
    Clock,
    MapPin,
    Coffee,
    CheckCircle,
    AlertCircle
} from 'lucide-react';

const EmployeeDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Mock data for quick stats - in a real app, fetch this from API
    const stats = {
        presentDays: 12,
        absentDays: 1,
        lateDays: 0,
        leaveBalance: 8
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <DashboardLayout title="Employee Dashboard">
            <div className="space-y-8 animate-fade-in-up">
                {/* Welcome Section */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-10 -mb-10 blur-xl"></div>

                    <div className="relative z-10">
                        <h1 className="text-3xl font-bold mb-2">
                            {getGreeting()}, {user?.user_name?.split(' ')[0] || 'Employee'}!
                        </h1>
                        <p className="text-indigo-100 max-w-xl">
                            Welcome to your dashboard. You can check your daily attendance, apply for leave, and view holidays from here.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-4">
                            <button
                                onClick={() => navigate('/attendance')}
                                className="px-6 py-2.5 bg-white text-indigo-600 font-semibold rounded-xl shadow-md hover:bg-indigo-50 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-2"
                            >
                                <Calendar size={18} />
                                My Attendance
                            </button>
                            <button
                                onClick={() => navigate('/holidays')}
                                className="px-6 py-2.5 bg-indigo-500/40 border border-indigo-300/30 text-white font-semibold rounded-xl hover:bg-indigo-500/60 transition-all flex items-center gap-2 backdrop-blur-sm"
                            >
                                <Coffee size={18} />
                                Holiday List
                            </button>
                        </div>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400">This Month</span>
                        </div>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white mb-1">{stats.presentDays}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Present Days</p>
                    </div>

                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400">This Month</span>
                        </div>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white mb-1">{stats.absentDays}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Absent Days</p>
                    </div>

                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                                <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400">This Month</span>
                        </div>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white mb-1">{stats.lateDays}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Late Arrivals</p>
                    </div>

                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                <Coffee className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400">Yearly</span>
                        </div>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white mb-1">{stats.leaveBalance}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Leave Balance</p>
                    </div>
                </div>

                {/* Recent Activity or Info Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <MapPin size={20} className="text-indigo-500" />
                            Your Work Location
                        </h3>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                You are currently assigned to standard work locations. Please ensure you are within the geofenced area when marking attendance.
                            </p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <AlertCircle size={20} className="text-indigo-500" />
                            Policies & Reminders
                        </h3>
                        <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                            <li className="flex items-start gap-2">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
                                Mark your attendance before 09:30 AM to avoid late remarks.
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
                                Apply for leave at least 2 days in advance.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default EmployeeDashboard;
