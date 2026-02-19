import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    Search,
    Plus,
    Filter,
    Edit2,
    Trash2,
    Phone,
    MapPin,
    Briefcase,
    MoreVertical,
    Download,
    Upload,
    X,
    Mail
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const EmployeeDetailModal = ({ user, onClose, avatarTimestamp }) => {
    if (!user) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                    <X size={20} />
                </button>

                <div className="flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-3xl font-bold mb-4 overflow-hidden border-4 border-white dark:border-slate-700 shadow-sm">
                        {user.profile_image_url ? (
                            <img src={`${user.profile_image_url}?t=${avatarTimestamp}`} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            user.name.charAt(0)
                        )}
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white text-center">{user.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6">{user.role}</p>

                    <div className="w-full space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-sm text-slate-400 font-medium">Email</span>
                            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium text-right max-w-[200px] truncate">{user.email}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-sm text-slate-400 font-medium">Phone</span>
                            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{user.phone}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-sm text-slate-400 font-medium">Dept</span>
                            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{user.department}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-sm text-slate-400 font-medium">Shift</span>
                            {/* Assuming shift is available in user object or defaulted */}
                            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">General Shift</span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full mt-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 active:scale-95 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const EmployeeList = () => {
    const navigate = useNavigate();
    const { avatarTimestamp } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const data = await adminService.getAllUsers(true);
            if (data.success) {
                const formatted = data.users.map(u => ({
                    id: u.user_id,
                    name: u.user_name,
                    email: u.email,
                    role: u.desg_name || u.user_type,
                    department: u.dept_name || '-',
                    phone: u.phone_no || '-',
                    profile_image_url: u.profile_image_url,
                    count: u.user_id // using ID as placeholder
                }));
                // Sort by ID desc to show newest first? Or just as is.
                setEmployees(formatted);
            }
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to load employees");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (e, id) => {
        e.stopPropagation();
        navigate(`/mobile-view/employees/edit/${id}`);
    };

    const filteredEmployees = employees.filter(employee =>
        employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <MobileDashboardLayout title="Employees">
            <div className="space-y-4 pb-24 bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors duration-300">
                {/* Search & Actions */}
                <div className="sticky top-[72px] z-10 px-4 pt-2 pb-2">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button className="w-11 h-11 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-slate-600 dark:text-slate-300 active:scale-95 transition-transform">
                                <Download size={20} />
                            </button>
                            <button className="w-11 h-11 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-slate-600 dark:text-slate-300 active:scale-95 transition-transform">
                                <Upload size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="space-y-3 px-4">
                    {loading ? (
                        <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-sm">Loading employees...</div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-sm">No employees found.</div>
                    ) : (
                        filteredEmployees.map(employee => (
                            <div
                                key={employee.id}
                                onClick={() => setSelectedUser(employee)}
                                className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm active:scale-[0.98] transition-all flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg overflow-hidden shrink-0 border border-indigo-100 dark:border-indigo-500/10">
                                        {employee.profile_image_url ? (
                                            <img src={`${employee.profile_image_url}?t=${avatarTimestamp}`} alt={employee.name} className="w-full h-full object-cover" />
                                        ) : (
                                            employee.name.charAt(0)
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm">{employee.name}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{employee.role}</p>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wide">ID: {employee.count}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => handleEdit(e, employee.id)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    aria-label="Edit employee"
                                >
                                    <MoreVertical size={20} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* FAB */}
                <Link
                    to="/mobile-view/employees/add"
                    className="fixed bottom-24 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-500/30 flex items-center justify-center active:scale-90 transition-all z-20"
                >
                    <Plus size={28} />
                </Link>

                {/* Modal */}
                {selectedUser && (
                    <EmployeeDetailModal
                        user={selectedUser}
                        onClose={() => setSelectedUser(null)}
                        avatarTimestamp={avatarTimestamp}
                    />
                )}
            </div>
        </MobileDashboardLayout>
    );
};

export default EmployeeList;
