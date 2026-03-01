
import React, { useState, useEffect } from 'react';
import {
    Activity, Settings, Database, FileText
} from 'lucide-react';
import api from '../../services/api';
import DashboardInsights from '../../components/dar/admin/DashboardInsights';
import RequestManager from '../../components/dar/admin/RequestManager';
import MasterDataView from '../../components/dar/admin/MasterDataView';
import AdminConfigurations from '../../components/dar/admin/AdminConfigurations';

const DARAdmin = ({ embedded = false }) => {
    const [activeTab, setActiveTab] = useState('insights'); // 'insights' | 'settings' | 'data' | 'requests'

    // --- SHARED DATA STATE ---
    const [departments, setDepartments] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [allUsers, setAllUsers] = useState([]); // Store full user list

    useEffect(() => {
        // Fetch total employees count & list
        const fetchUsers = async () => {
            try {
                const res = await api.get('/admin/users');
                if (res.data.success) {
                    setAllUsers(res.data.users.map(u => ({
                        userId: u.user_id,
                        name: u.user_name,
                        dept: u.dept_name,
                        shift: u.shift_name,
                        role: u.user_type
                    })));
                }
            } catch (e) {
                console.error("Failed to fetch users", e);
            }
        };

        // Fetch Departments & Shifts
        const fetchDeptsAndShifts = async () => {
            // 1. Departments
            try {
                const res = await api.get('/admin/departments');
                if (res.data.success) {
                    // Ensure uniqueness to prevent duplicate keys
                    const uniqueDepts = [...new Set(res.data.departments.map(d => d.dept_name))];
                    setDepartments(uniqueDepts);
                }
            } catch (e) {
                console.error("Failed to fetch departments", e);
            }

            // 2. Shifts
            try {
                const res = await api.get('/admin/shifts');
                if (res.data.success) {
                    setShifts(res.data.shifts);
                }
            } catch (e) {
                console.error("Failed to fetch shifts", e);
            }
        };

        fetchUsers();
        fetchDeptsAndShifts();
    }, []);

    return (
        <div className={`flex flex-col h-full bg-slate-50 dark:bg-dark-bg transition-colors ${embedded ? '' : 'p-6'}`}>

            {/* Header (Only if not embedded, or simplified) */}
            {!embedded && (
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">DAR Admin</h1>
                        <p className="text-slate-500 text-sm">Monitor daily activity reports and analytics</p>
                    </div>
                </div>
            )}

            {/* Navigation Tabs (Pill Style) */}
            <div className="flex gap-2 mb-6 bg-white dark:bg-dark-card p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-fit shadow-sm">
                <button
                    onClick={() => setActiveTab('insights')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'insights'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <Activity size={16} />
                    Insights
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'requests'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <FileText size={16} />
                    Requests
                </button>
                <button
                    onClick={() => setActiveTab('data')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'data'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <Database size={16} />
                    Master Data
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'settings'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <Settings size={16} />
                    Configurations
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">

                {/* --- CONFIGURATIONS TAB --- */}
                {activeTab === 'settings' && (
                    <AdminConfigurations />
                )}

                {/* --- MASTER DATA TAB (TIMELINE VIEW) --- */}
                {activeTab === 'data' && (
                    <MasterDataView
                        departments={departments}
                        shifts={shifts}
                        allUsers={allUsers}
                    />
                )}

                {/* --- REQUESTS TAB --- */}
                {activeTab === 'requests' && (
                    <RequestManager />
                )}

                {/* --- INSIGHTS DASHBOARD --- */}
                {activeTab === 'insights' && ( // DashboardInsights expects departments and allUsers
                    <DashboardInsights
                        departments={departments}
                        allUsers={allUsers}
                    />
                )}
            </div>
        </div>
    );
};

export default DARAdmin;
