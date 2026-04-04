
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Activity, Settings, Database, FileText
} from 'lucide-react';
import api from '../../services/api';
import DashboardInsights from '../../components/dar/admin/DashboardInsights';
import RequestManager from '../../components/dar/admin/RequestManager';
import MasterDataView from '../../components/dar/admin/MasterDataView';
import AdminConfigurations from '../../components/dar/admin/AdminConfigurations';

const DARAdmin = ({ embedded = false }) => {
    const [activeTab, setActiveTab] = useState('insights'); // 'insights' | 'requests' | 'data'
    const [isConfigOpen, setIsConfigOpen] = useState(false);

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
        <div className={`dar-context flex flex-col h-full bg-slate-50 dark:bg-dark-bg transition-colors ${embedded ? '' : 'p-5'}`}>

            {/* Header (Only if not embedded, or simplified) */}
            {!embedded && (
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-github-dark-text">DAR Admin</h1>
                        <p className="text-slate-500 text-sm">Monitor daily activity reports and analytics</p>
                    </div>
                </div>
            )}

            {/* Navigation Tabs (Pill Style) */}
            <div className="flex gap-2 mb-6 bg-white dark:bg-dark-card p-1.5 rounded-xl border border-slate-200 dark:border-github-dark-border w-fit shadow-sm">
                <button
                    onClick={() => setActiveTab('insights')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'insights'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <Activity size={16} />
                    Insights
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'requests'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <FileText size={16} />
                    Requests
                </button>
                <button
                    onClick={() => setActiveTab('data')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'data'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <Database size={16} />
                    Master Data
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">


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
                        onOpenConfig={() => setIsConfigOpen(true)}
                    />
                )}

            </div>

            {/* --- CONFIGURATION SIDEBAR (RIGHT SLIDE) --- */}
            <AnimatePresence>
                {isConfigOpen && (
                    <Portal>
                        <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsConfigOpen(false)}
                                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                            />

                            {/* Sidebar Container */}
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="relative w-full max-w-[500px] h-full bg-white dark:bg-github-dark-subtle shadow-2xl flex flex-col dar-context"
                            >
                                <AdminConfigurations onClose={() => setIsConfigOpen(false)} />
                            </motion.div>
                        </div>
                    </Portal>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- PORTAL HELPER ---
const Portal = ({ children }) => {
    return ReactDOM.createPortal(children, document.body);
};

export default DARAdmin;
