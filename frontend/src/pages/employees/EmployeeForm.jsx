import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import {
    Save,
    X,
    User,
    Mail,
    Phone,
    MapPin,
    Briefcase,
    Clock,
    Shield,
    Plus
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';

import { useAuth } from '../../context/AuthContext';

const QuickAddPopover = ({ title, onAdd, onClose, isOpen }) => {
    const [newValue, setNewValue] = useState("");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newValue.trim()) return;
        setLoading(true);
        try {
            await onAdd(newValue);
            setNewValue("");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Failed to add item");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="absolute z-50 bottom-full right-0 mb-3 w-72 p-4 bg-slate-900 rounded-2xl shadow-2xl shadow-indigo-500/20 border border-indigo-500/30 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-sm origin-bottom-right">

            {/* Pointer Arrow */}
            <div className="absolute -bottom-2 right-3 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-indigo-500/30 border-r-[8px] border-r-transparent"></div>
            <div className="absolute -bottom-[7px] right-3 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-slate-900 border-r-[8px] border-r-transparent"></div>

            <div className="flex justify-between items-start mb-3">
                <h4 className="text-sm font-medium text-white">{title}</h4>
                <button
                    onClick={onClose}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>

            <div className="flex flex-col gap-3">
                <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="e.g. Engineering"
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-slate-500"
                    autoFocus
                />
                <button
                    onClick={handleSubmit}
                    disabled={loading || !newValue.trim()}
                    className="self-end px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(99,102,241,0.4)] hover:shadow-[0_0_15px_rgba(99,102,241,0.6)] transition-all duration-200"
                >
                    {loading ? 'Adding...' : 'Add'}
                </button>
            </div>
        </div>
    );
};

const EmployeeForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user: currentUser } = useAuth();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        user_name: '',
        email: '',
        phone_no: '',
        user_password: '',
        desg_id: '',
        dept_id: '',
        shift_id: '',
        user_type: 'employee',
        // work_locations: not handled in this form API
        status: true // UI only for now, or map to user_type? 
    });

    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activePopover, setActivePopover] = useState(null); // 'dept' | 'desg' | null

    const deptContainerRef = useRef(null);
    const desgContainerRef = useRef(null);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activePopover === 'dept' && deptContainerRef.current && !deptContainerRef.current.contains(event.target)) {
                setActivePopover(null);
            }
            if (activePopover === 'desg' && desgContainerRef.current && !desgContainerRef.current.contains(event.target)) {
                setActivePopover(null);
            }
        };

        if (activePopover) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activePopover]);

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [deptRes, desgRes, shiftRes] = await Promise.all([
                    adminService.getDepartments(),
                    adminService.getDesignations(),
                    adminService.getShifts()
                ]);

                if (deptRes.success) setDepartments(deptRes.departments);
                if (desgRes.success) setDesignations(desgRes.designations);
                if (shiftRes.success) setShifts(shiftRes.shifts);

                if (isEditMode) {
                    const userRes = await adminService.getUserById(id);
                    if (userRes.success) {
                        const u = userRes.user;
                        setFormData({
                            user_name: u.user_name,
                            email: u.email,
                            phone_no: u.phone_no || '',
                            user_password: '', // Don't show password
                            desg_id: u.desg_id || '',
                            dept_id: u.dept_id || '',
                            shift_id: u.shift_id || '',
                            user_type: u.user_type,
                            status: true // Assume active
                        });
                    }
                }
            } catch (err) {
                console.error(err);
                toast.error("Failed to load data");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id, isEditMode]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSaving(true);

            // Basic validation
            if (!formData.user_name || !formData.email) {
                toast.error("Name and Email are required");
                return;
            }

            // Prepare payload
            const payload = {
                user_name: formData.user_name,
                email: formData.email,
                phone_no: formData.phone_no,
                desg_id: formData.desg_id,
                dept_id: formData.dept_id,
                shift_id: formData.shift_id,
                user_type: formData.user_type
                // status not sent
            };

            // Only send password if provided (for create or update)
            if (formData.user_password) {
                payload.user_password = formData.user_password;
            } else if (!isEditMode) {
                // If create and no password, default is set by backend? 
                // Backend line 216 says '123456' for bulk, but create API line 104 *checks* for user_password.
                // So we MUST provide a password for create.
                payload.user_password = "Password@123"; // Default initial password
                // Ideally ask user, but for now default or error if empty?
                // Let's rely on form input if user types it, else error.
            }

            if (!isEditMode && !payload.user_password) {
                toast.error("Password is required for new users");
                setIsSaving(false);
                return;
            }


            if (isEditMode) {
                await adminService.updateUser(id, payload);
                toast.success("User updated successfully");
            } else {
                await adminService.createUser(payload);
                toast.success("User created successfully");
            }
            navigate('/employees');
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Operation failed");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddDepartment = async (name) => {
        const res = await adminService.createDepartment(name);
        if (res.success) {
            toast.success("Department added");
            // Refresh list
            const deptRes = await adminService.getDepartments();
            setDepartments(deptRes.departments);
            // Select new item
            setFormData(prev => ({ ...prev, dept_id: res.dept_id }));
        }
    };

    const handleAddDesignation = async (name) => {
        const res = await adminService.createDesignation(name);
        if (res.success) {
            toast.success("Designation added");
            // Refresh list
            const desgRes = await adminService.getDesignations();
            setDesignations(desgRes.designations);
            // Select new item
            setFormData(prev => ({ ...prev, desg_id: res.desg_id }));
        }
    };

    if (isLoading) {
        return (
            <DashboardLayout title={isEditMode ? "Edit Employee" : "Add New Employee"}>
                <div className="p-8 text-center text-slate-500">Loading...</div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title={isEditMode ? "Edit Employee" : "Add New Employee"}>
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Header / Actions */}
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => navigate('/employees')}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                        <X size={20} />
                        <span className="font-medium">Cancel</span>
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all active:scale-95 disabled:opacity-70"
                    >
                        <Save size={18} />
                        <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                </div>

                {/* Main Card */}
                <div className="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

                        {/* Personal Info Section */}
                        <div className="md:col-span-2">
                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <User size={16} /> Personal Information
                            </h3>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                            <input
                                type="text"
                                name="user_name"
                                value={formData.user_name}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-white"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                            <input
                                type="password"
                                name="user_password"
                                value={formData.user_password}
                                onChange={handleChange}
                                placeholder={isEditMode ? "Leave blank to keep current" : "Enter password"}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-white"
                                required={!isEditMode}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><Mail size={14} className="text-slate-400" /> Email Address</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-white"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><Phone size={14} className="text-slate-400" /> Phone Number</label>
                            <input
                                type="tel"
                                name="phone_no"
                                value={formData.phone_no}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-white"
                            />
                        </div>

                        {/* Separator */}
                        <div className="md:col-span-2 border-t border-slate-100 dark:border-slate-700 my-2"></div>


                        {/* Work Info Section */}
                        <div className="md:col-span-2">
                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Briefcase size={16} /> Work Details
                            </h3>
                        </div>

                        <div className="space-y-1.5 relative" ref={deptContainerRef}>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setActivePopover(activePopover === 'dept' ? null : 'dept')}
                                        className={`
                                            group relative flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300
                                            ${activePopover === 'dept'
                                                ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)] scale-110'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-[0_0_10px_rgba(79,70,229,0.3)]'
                                            }
                                        `}
                                        title="Quick Add Department"
                                    >
                                        <div className={`absolute inset-0 rounded-full bg-indigo-500/20 blur-md transition-opacity duration-300 ${activePopover === 'dept' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
                                        <Plus size={14} className="relative z-10" strokeWidth={2.5} />
                                    </button>
                                    <QuickAddPopover
                                        isOpen={activePopover === 'dept'}
                                        title="New Department"
                                        onAdd={handleAddDepartment}
                                        onClose={() => setActivePopover(null)}
                                    />
                                </div>
                            </div>
                            <select
                                name="dept_id"
                                value={formData.dept_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="">Select Department</option>
                                {departments.map(d => (
                                    <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5 relative" ref={desgContainerRef}>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Designation / Role</label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setActivePopover(activePopover === 'desg' ? null : 'desg')}
                                        className={`
                                            group relative flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300
                                            ${activePopover === 'desg'
                                                ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)] scale-110'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-[0_0_10px_rgba(79,70,229,0.3)]'
                                            }
                                        `}
                                        title="Quick Add Designation"
                                    >
                                        <div className={`absolute inset-0 rounded-full bg-indigo-500/20 blur-md transition-opacity duration-300 ${activePopover === 'desg' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
                                        <Plus size={14} className="relative z-10" strokeWidth={2.5} />
                                    </button>
                                    <QuickAddPopover
                                        isOpen={activePopover === 'desg'}
                                        title="New Designation"
                                        onAdd={handleAddDesignation}
                                        onClose={() => setActivePopover(null)}
                                    />
                                </div>
                            </div>
                            <select
                                name="desg_id"
                                value={formData.desg_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="">Select Designation</option>
                                {designations.map(d => (
                                    <option key={d.desg_id} value={d.desg_id}>{d.desg_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> Shift Time</label>
                            <select
                                name="shift_id"
                                value={formData.shift_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="">Select Shift</option>
                                {shifts.map(s => (
                                    <option key={s.shift_id} value={s.shift_id}>{s.shift_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">User Type</label>
                            <select
                                name="user_type"
                                value={formData.user_type}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="employee">Employee</option>
                                {currentUser?.user_type === 'admin' && (
                                    <option value="hr">HR</option>
                                )}
                                {formData.user_type === 'admin' && (
                                    <option value="admin">Admin</option>
                                )}
                            </select>
                        </div>

                        {/* Status Toggle */}
                        {/* <div className="md:col-span-2 flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-slate-800 dark:text-white">Account Status</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Manage employee access to the system</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="status"
                                    checked={formData.status}
                                    onChange={handleChange}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                                <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300">{formData.status ? 'Active' : 'Inactive'}</span>
                            </label>
                        </div> */}
                    </div>
                </div>

            </form>
        </DashboardLayout>
    );
};

export default EmployeeForm;
