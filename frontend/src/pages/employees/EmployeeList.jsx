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
    Trash2
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';

const EmployeeList = () => {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

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
                    role: u.desg_name || u.user_type,
                    department: u.dept_name || '-',
                    status: 'Active', // Defaulting since backend doesn't provide status yet
                    phone: u.phone_no || '-',
                    shift: u.shift_name || '-',
                    workLocations: u.work_locations || [],
                    joinDate: '-', // Not in API
                    profile_image_url: u.profile_image_url
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
        if (!window.confirm("Are you sure you want to delete this user?")) return;
        try {
            await adminService.deleteUser(id);
            toast.success("User deleted successfully");
            setEmployees(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            toast.error(err.message || "Failed to delete user");
        }
    };

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Filter Logic
    const filteredEmployees = employees.filter(employee => {
        const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || employee.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

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
            case 'On Notice': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
            case 'Exited': return 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-400 border-slate-200 dark:border-slate-600';
            default: return 'bg-slate-100 text-slate-700';
        }
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
                                className="pl-10 pr-4 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full sm:w-64 transition-all"
                            />
                        </div>
                        {/* Filter */}
                        {/* <div className="relative">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="appearance-none pl-3 pr-8 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                            >
                                <option value="All">All Status</option>
                                <option value="Active">Active</option>
                                <option value="On Notice">On Notice</option>
                                <option value="Exited">Exited</option>
                            </select>
                            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div> */}
                    </div>

                    <div className="flex items-center gap-3">
                        <Link to="/employees/bulk" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
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
                <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                                    <th className="px-6 py-4 w-[25%]">Employee</th>
                                    <th className="px-6 py-4 w-[15%]">Role & Dept</th>
                                    <th className="px-6 py-4 w-[15%]">Phone</th>
                                    <th className="px-6 py-4 w-[10%]">Shift</th>
                                    <th className="px-6 py-4 w-[25%]">Allowed Geofences</th>
                                    <th className="px-6 py-4 text-right w-[10%]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : filteredEmployees.length > 0 ? (
                                    filteredEmployees.map((employee) => (
                                        <tr
                                            key={employee.id}
                                            onClick={() => navigate(`/employees/edit/${employee.id}`)}
                                            className="group cursor-pointer border-l-2 border-transparent hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 hover:shadow-[0_0_15px_rgba(99,102,241,0.15)] transition-all duration-200"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800/50 transition-colors overflow-hidden">
                                                        {employee.profile_image_url ? (
                                                            <img src={employee.profile_image_url} alt={employee.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            employee.name.charAt(0)
                                                        )}
                                                    </div>
                                                    <div className="max-w-[150px] truncate">
                                                        <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors truncate" title={employee.name}>{employee.name}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={employee.email}>{employee.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-slate-700 dark:text-slate-300">{employee.role}</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-500">{employee.department}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-slate-600 dark:text-slate-400">{employee.phone}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-slate-600 dark:text-slate-400">{employee.shift}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {employee.workLocations && employee.workLocations.filter(loc => loc.is_active).length > 0 ? (
                                                        employee.workLocations.filter(loc => loc.is_active).map((loc, i) => (
                                                            <span key={i} className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-lg whitespace-nowrap">
                                                                {loc.loc_name}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">None</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Link
                                                        to={`/employees/edit/${employee.id}`}
                                                        title="Edit"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                                    >
                                                        <Edit2 size={16} />
                                                    </Link>
                                                    <button
                                                        onClick={(e) => handleDelete(e, employee.id)}
                                                        title="Delete"
                                                        className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
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
                        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredEmployees.length)} of {filteredEmployees.length} results
                            </span>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                        // Simple logic to show first 5 pages or sliding window could be added
                                        // For now, let's keep it simple: Show pages around current
                                        let pageNum = i + 1;
                                        if (totalPages > 5) {
                                            if (currentPage > 3) pageNum = currentPage - 2 + i;
                                            if (pageNum > totalPages) pageNum = pageNum - (pageNum - totalPages);
                                            // Ensure we don't go out of bounds if at end (simplified logic)
                                            // A better full pagination logic might be needed if pages > 100
                                            // For tabination like 10 users, standard pages are fine.
                                        }

                                        // Simplified: Just show all pages if < 7, else simple range
                                        // Let's stick to simple Prev/Next + Current/Total text if complex, 
                                        // or just render page numbers if totalPages is small.
                                        // Given user request "tabination", let's do: [1] [2] ... 

                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors
                                                    ${currentPage === pageNum
                                                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </DashboardLayout>
    );
};

export default EmployeeList;
