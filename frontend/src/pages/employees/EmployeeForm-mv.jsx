import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    Save,
    X,
    User,
    Mail,
    Phone,
    Briefcase,
    Clock,
    Plus,
    ChevronDown
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';

const EmployeeForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
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
        status: true
    });

    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

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
                            user_password: '',
                            desg_id: u.desg_id || '',
                            dept_id: u.dept_id || '',
                            shift_id: u.shift_id || '',
                            user_type: u.user_type,
                            status: true
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

            if (!formData.user_name || !formData.email) {
                toast.error("Name and Email are required");
                return;
            }

            const payload = {
                user_name: formData.user_name,
                email: formData.email,
                phone_no: formData.phone_no,
                desg_id: formData.desg_id,
                dept_id: formData.dept_id,
                shift_id: formData.shift_id,
                user_type: formData.user_type
            };

            if (formData.user_password) {
                payload.user_password = formData.user_password;
            } else if (!isEditMode) {
                payload.user_password = "Password@123";
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
            navigate('/mobile-view/employees');
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Operation failed");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <MobileDashboardLayout title={isEditMode ? "Edit Employee" : "Add Employee"}>
                <div className="p-8 text-center text-slate-500">Loading...</div>
            </MobileDashboardLayout>
        );
    }

    return (
        <MobileDashboardLayout title={isEditMode ? "Edit Employee" : "Add Employee"} hideSidebar={true}>
            <form onSubmit={handleSubmit} className="space-y-6 pb-20 relative min-h-screen bg-slate-50 dark:bg-slate-900 p-4">

                {/* Header Actions */}
                <div className="flex items-center justify-between mb-2">
                    <button
                        type="button"
                        onClick={() => navigate('/mobile-view/employees')}
                        className="flex items-center gap-2 text-slate-800 dark:text-white transition-colors"
                    >
                        <X size={24} />
                        <span className="font-medium">Cancel</span>
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 transition-all active:scale-95 disabled:opacity-70"
                    >
                        {isSaving ? (
                            <span>Saving...</span>
                        ) : (
                            <>
                                <Save size={18} />
                                <span>Save Changes</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Form Card */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">

                    {/* PERSONAL INFORMATION */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <User size={14} /> Personal Information
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Full Name */}
                            <div className="space-y-1.5 col-span-1">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                                <input
                                    type="text"
                                    name="user_name"
                                    placeholder="Enter full name"
                                    value={formData.user_name}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                    required
                                />
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5 col-span-1">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Password</label>
                                <input
                                    type="password"
                                    name="user_password"
                                    placeholder="Enter password"
                                    value={formData.user_password}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                />
                            </div>

                            {/* Email */}
                            <div className="space-y-1.5 col-span-1">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Enter email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                    required
                                />
                            </div>

                            {/* Phone */}
                            <div className="space-y-1.5 col-span-1">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
                                <input
                                    type="tel"
                                    name="phone_no"
                                    placeholder="Enter phone number"
                                    value={formData.phone_no}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* WORK DETAILS */}
                    <div className="mb-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Briefcase size={14} /> Work Details
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Department */}
                            <div className="space-y-1.5 col-span-1">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Department</label>
                                <div className="relative">
                                    <select
                                        name="dept_id"
                                        value={formData.dept_id}
                                        onChange={handleChange}
                                        className="w-full pl-3 pr-8 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm appearance-none"
                                    >
                                        <option value="">Select</option>
                                        {departments.map(d => (
                                            <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Designation */}
                            <div className="space-y-1.5 col-span-1">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Designation / Role</label>
                                <div className="relative">
                                    <select
                                        name="desg_id"
                                        value={formData.desg_id}
                                        onChange={handleChange}
                                        className="w-full pl-3 pr-8 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm appearance-none"
                                    >
                                        <option value="">Select</option>
                                        {designations.map(d => (
                                            <option key={d.desg_id} value={d.desg_id}>{d.desg_name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Shift Time */}
                            <div className="space-y-1.5 col-span-1">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Shift Time</label>
                                <div className="relative">
                                    <select
                                        name="shift_id"
                                        value={formData.shift_id}
                                        onChange={handleChange}
                                        className="w-full pl-3 pr-8 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm appearance-none"
                                    >
                                        <option value="">Select</option>
                                        {shifts.map(s => (
                                            <option key={s.shift_id} value={s.shift_id}>{s.shift_name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* User Type */}
                            <div className="space-y-1.5 col-span-1">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">User Type</label>
                                <div className="relative">
                                    <select
                                        name="user_type"
                                        value={formData.user_type}
                                        onChange={handleChange}
                                        className="w-full pl-3 pr-8 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm appearance-none"
                                    >
                                        <option value="employee">Employee</option>
                                        <option value="admin">Admin</option>
                                        <option value="HR">HR</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                        </div>
                    </div>

                </div>

            </form>
        </MobileDashboardLayout>
    );
};

export default EmployeeForm;
