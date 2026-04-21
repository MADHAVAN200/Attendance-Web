import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import {
    Search,
    Filter,
    Plus,
    Upload,
    MoreVertical,
    Edit2,
    Lock,
    Unlock,
    Download,
    ChevronLeft,
    ChevronRight,
    Trash2,
    UserCheck,
    UserX,
    RotateCcw,
    AlertTriangle,
    X,
    User
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import EmployeeFormContent from '../../components/employees/EmployeeFormContent';

const EmployeeList = () => {
    const navigate = useNavigate();


    const { avatarTimestamp } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Active');
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [sidebarMode, setSidebarMode] = useState('view'); // 'view' | 'edit'

    // Fetch Employees on Mount
    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const data = await adminService.getAllUsers(true); // includeWorkLocation=true
            if (data.success) {
                // Transform API data to Component state
                const formatted = data.users.map(u => ({
                    id: u.user_id,
                    name: u.user_name,
                    email: u.email,
                    // Keep raw user_type for logic checks, role for display
                    role: u.desg_name || u.user_type, 
                    user_type: u.user_type, // Ensure this field exists for logic checks
                    department: u.dept_name || '-',
                    status: u.is_deleted ? 'Deleted' : (u.is_active ? 'Active' : 'Inactive'),
                    phone: u.phone_no || '-',
                    shift: u.shift_name || '-',
                    workLocations: u.work_locations || [],
                    joinDate: '-', // Not in API
                    profile_image_url: u.profile_image_url,
                    is_active: u.is_active,
                    is_deleted: u.is_deleted
                }));
                setEmployees(formatted);
            }
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to load employees");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to move this user to trash?")) return;
        try {
            await adminService.deleteUser(id);
            toast.success("User moved to trash");
            fetchEmployees(); // Refresh to update lists
        } catch (err) {
            toast.error(err.message || "Failed to delete user");
        }
    };

    const handleForceDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("PERMANENT DELETE WARNING:\nThis will remove all user data, attendance records, and images.\nThis action CANNOT be undone.\n\nAre you sure?")) return;
        try {
            await adminService.forceDeleteUser(id);
            toast.success("User permanently deleted");
            setEmployees(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            toast.error(err.message || "Failed to delete user");
        }
    };

    const handleRestore = async (e, id) => {
        e.stopPropagation();
        try {
            await adminService.restoreUser(id);
            toast.success("User restored (Status: Inactive)");
            fetchEmployees();
        } catch (err) {
            toast.error(err.message || "Failed to restore user");
        }
    };

    const handleToggleStatus = async (e, id, currentStatus) => {
        e.stopPropagation();
        const newStatus = !currentStatus;
        const action = newStatus ? "activate" : "deactivate";
        if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;

        try {
            await adminService.toggleUserStatus(id, newStatus);
            toast.success(`User ${action}d successfully`);
            fetchEmployees();
        } catch (err) {
            toast.error(err.message || `Failed to ${action} user`);
        }
    };

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Filter and Sort Logic
    const filteredEmployees = employees
        .filter(employee => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = (employee.name || "").toLowerCase().includes(searchLower) ||
                (employee.email || "").toLowerCase().includes(searchLower);
            const matchesStatus = statusFilter === 'All' || employee.status === statusFilter;
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: 'base' }));

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
            case 'Inactive': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
            case 'Deleted': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-github-dark-muted border-slate-200 dark:border-github-dark-border';
        }
    };

    const handleOpenSidebar = (employee, mode = 'view') => {
        setSelectedEmployee(employee);
        setSidebarMode(mode);
    };

    const handleCloseSidebar = () => {
        setSelectedEmployee(null);
        setSidebarMode('view');
    };

    const handleFormSuccess = () => {
        fetchEmployees();
        handleCloseSidebar();
    };

    return (
        <DashboardLayout title="Employees">
            <div className="space-y-6">

                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-lg text-sm text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full sm:w-64 transition-all"
                            />
                        </div>
                        {/* Filter Tabs */}
                        <div className="flex bg-slate-100 dark:bg-github-dark-subtle p-1 rounded-lg">
                            {['Active', 'Inactive', 'Deleted'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                        statusFilter === status
                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                            : 'text-slate-600 dark:text-github-dark-muted hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    {status === 'Deleted' ? 'Trash' : status}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link to="/employees/bulk" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-github-dark-text bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <Upload size={18} />
                            <span className="hidden sm:inline">Bulk Upload</span>
                        </Link>
                        <Link to="/employees/add" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-indigo-900/20 transition-all active:scale-95">
                            <Plus size={18} />
                            <span>Add Employee</span>
                        </Link>
                    </div>
                </div>

                {/* Table Card */}
                <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden transition-colors duration-300">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/95 dark:bg-github-dark-subtle/95 backdrop-blur-md">
                                <tr className="text-xs uppercase tracking-wider text-slate-500 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                    <th className="px-6 py-4 w-[22%] text-left">Employee</th>
                                    <th className="px-6 py-4 w-[18%] text-left">Role & Dept</th>
                                    <th className="px-6 py-4 w-[13%] text-center">Phone</th>
                                    <th className="px-6 py-4 w-[12%] text-center">Shift</th>
                                    <th className="px-6 py-4 w-[25%] text-left">Allowed Geofences</th>
                                    <th className="px-6 py-4 text-center w-[10%]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-slate-500 dark:text-github-dark-muted">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : filteredEmployees.length > 0 ? (
                                    currentItems.map((employee) => (
                                        <tr
                                            key={employee.id}
                                            onClick={() => handleOpenSidebar(employee, 'view')}
                                            className="group cursor-pointer border-l-2 border-transparent hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 hover:shadow-[0_0_15px_rgba(99,102,241,0.15)] transition-all duration-200"
                                        >
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800/50 transition-colors overflow-hidden border-2 border-white dark:border-github-dark-border shadow-sm">
                                                        {employee.profile_image_url ? (
                                                            <img src={`${employee.profile_image_url}?t=${avatarTimestamp}`} alt={employee.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            employee.name.charAt(0)
                                                        )}
                                                    </div>
                                                    <div className="max-w-[180px] truncate">
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-github-dark-text group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors truncate" title={employee.name}>{employee.name}</p>
                                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted truncate opacity-80" title={employee.email}>{employee.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{employee.role}</span>
                                                    <span className="text-xs font-medium text-slate-500 dark:text-github-dark-muted">{employee.department}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{employee.phone}</span>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{employee.shift}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-wrap gap-2">
                                                    {employee.workLocations && employee.workLocations.filter(loc => loc.is_active).length > 0 ? (
                                                        employee.workLocations.filter(loc => loc.is_active).map((loc, i) => (
                                                            <span key={i} className="px-3 py-1.5 text-[11px] font-semibold bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-github-dark-border rounded-lg whitespace-nowrap shadow-sm">
                                                                {loc.loc_name}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">None</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center justify-center gap-2">
                                                    {employee.status === 'Deleted' ? (
                                                        <>
                                                            <button
                                                                onClick={(e) => handleRestore(e, employee.id)}
                                                                title="Restore User"
                                                                className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                            >
                                                                <RotateCcw size={18} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleForceDelete(e, employee.id)}
                                                                title="Delete Permanently"
                                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={(e) => handleToggleStatus(e, employee.id, employee.is_active)}
                                                                title={employee.is_active ? "Deactivate" : "Activate"}
                                                                disabled={employee.user_type === 'admin'}
                                                                className={`p-2 rounded-lg transition-colors ${
                                                                    employee.user_type === 'admin'
                                                                    ? 'opacity-50 cursor-not-allowed text-slate-400'
                                                                    : employee.is_active 
                                                                        ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' 
                                                                        : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                                                }`}
                                                            >
                                                                {employee.is_active ? <UserX size={18} /> : <UserCheck size={18} />}
                                                            </button>
                                                            
                                                            <Link
                                                                to={`/employees/edit/${employee.id}`}
                                                                title="Edit"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                                            >
                                                                <Edit2 size={18} />
                                                            </Link>

                                                            {/* Delete Button (Disabled for Admins) */}
                                                            <button
                                                                onClick={(e) => handleDelete(e, employee.id)}
                                                                title={employee.user_type === 'admin' ? "Cannot delete Admin" : "Move to Trash"}
                                                                disabled={employee.user_type === 'admin'}
                                                                className={`p-2 rounded-lg transition-colors ${
                                                                    employee.user_type === 'admin'
                                                                    ? 'opacity-50 cursor-not-allowed text-slate-400'
                                                                    : 'text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                                }`}
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-slate-500 dark:text-github-dark-muted">
                                            <div className="flex flex-col items-center gap-2">
                                                <Search size={32} className="text-slate-300 dark:text-slate-600" />
                                                <p>No employees found matching your filters.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {filteredEmployees.length > 0 && (
                        <div className="px-6 py-4 border-t border-slate-200 dark:border-github-dark-border flex flex-col sm:flex-row items-center justify-between gap-4">
                            <span className="text-sm text-slate-500 dark:text-github-dark-muted">
                                Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredEmployees.length)} of {filteredEmployees.length} results
                            </span>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 text-slate-500 hover:text-indigo-600 dark:text-github-dark-muted dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                <div className="flex items-center gap-1">
                                    {(() => {
                                        const pages = [];
                                        const maxButtons = 5;
                                        let startPage = Math.max(1, currentPage - 2);
                                        let endPage = Math.min(totalPages, startPage + maxButtons - 1);

                                        if (endPage - startPage + 1 < maxButtons) {
                                            startPage = Math.max(1, endPage - maxButtons + 1);
                                        }

                                        for (let i = startPage; i <= endPage; i++) {
                                            pages.push(i);
                                        }

                                        return pages.map(pageNum => (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors
                                                    ${currentPage === pageNum
                                                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                            >
                                                {pageNum}
                                            </button>
                                        ));
                                    })()}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 text-slate-500 hover:text-indigo-600 dark:text-github-dark-muted dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Employee Details/Edit Sidebar */}
            <AnimatePresence>
                {selectedEmployee && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleCloseSidebar}
                            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
                        />

                        {/* Sidebar Drawer */}
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-full w-full max-w-[480px] z-50 bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col overflow-hidden"
                        >
                            {sidebarMode === 'view' ? (
                                <>
                                    {/* View Mode Header */}
                                    <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                                <User size={20} />
                                            </div>
                                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-github-dark-text">Profile Details</h3>
                                        </div>
                                        <button
                                            onClick={handleCloseSidebar}
                                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {/* View Mode Body */}
                                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
                                        {/* Profile Card */}
                                        <div className="flex flex-col items-center gap-4 text-center">
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-10 rounded-full"></div>
                                                <div className="relative w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-3xl overflow-hidden border-4 border-white dark:border-github-dark-border shadow-lg">
                                                    {selectedEmployee.profile_image_url ? (
                                                        <img src={`${selectedEmployee.profile_image_url}?t=${avatarTimestamp}`} alt={selectedEmployee.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        selectedEmployee.name.charAt(0)
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-black text-slate-900 dark:text-github-dark-text tracking-tight">{selectedEmployee.name}</h4>
                                                <p className="text-sm font-medium text-slate-500 dark:text-github-dark-muted">{selectedEmployee.email}</p>
                                                <div className={`mt-3 inline-flex items-center px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${getStatusColor(selectedEmployee.status)} shadow-sm`}>
                                                    {selectedEmployee.status}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Details Grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-4 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 group hover:border-indigo-500/30 transition-colors">
                                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-60">Role</span>
                                                <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">{selectedEmployee.role}</span>
                                            </div>
                                            <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-4 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 group hover:border-indigo-500/30 transition-colors">
                                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-60">Department</span>
                                                <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">{selectedEmployee.department}</span>
                                            </div>
                                            <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-4 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 group hover:border-indigo-500/30 transition-colors">
                                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-60">Phone</span>
                                                <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">{selectedEmployee.phone}</span>
                                            </div>
                                            <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-4 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 group hover:border-indigo-500/30 transition-colors">
                                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-60">Shift</span>
                                                <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">{selectedEmployee.shift}</span>
                                            </div>
                                        </div>

                                        {/* Geofences Section */}
                                        <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50">
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 opacity-60">Allowed Geofences</span>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedEmployee.workLocations && selectedEmployee.workLocations.filter(loc => loc.is_active).length > 0 ? (
                                                    selectedEmployee.workLocations.filter(loc => loc.is_active).map((loc, i) => (
                                                        <span key={i} className="px-3 py-2 text-[11px] font-bold bg-white dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50 rounded-xl shadow-sm">
                                                            {loc.loc_name}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-slate-400 font-medium italic py-2">No assigned geofences</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* View Mode Footer Actions */}
                                    <div className="p-5 border-t border-slate-100 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20 flex gap-3">
                                        <button
                                            onClick={handleCloseSidebar}
                                            className="flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-github-dark-muted hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
                                        >
                                            Dismiss
                                        </button>
                                        <button
                                            onClick={() => setSidebarMode('edit')}
                                            className="flex-[2] px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 active:scale-95"
                                        >
                                            <Edit2 size={16} />
                                            Update Profile
                                        </button>
                                    </div>
                                </>
                            ) : (
                                /* Edit Mode: Render the Form Content */
                                <EmployeeFormContent
                                    userId={selectedEmployee.id}
                                    isSidebarMode={true}
                                    onSuccess={handleFormSuccess}
                                    onCancel={() => setSidebarMode('view')}
                                />
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
};

export default EmployeeList;
