import React, { useState, useEffect, useRef } from 'react';
import { Save, X, User, Mail, Phone, Briefcase, Clock, Camera, Plus } from 'lucide-react';
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
        <div className="absolute z-50 bottom-full right-0 mb-3 w-72 p-4 bg-slate-900 rounded-2xl shadow-2xl shadow-indigo-500/20 border border-indigo-500/30 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-sm origin-bottom-right font-sans">
            <div className="absolute -bottom-2 right-3 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-indigo-500/30 border-r-[8px] border-r-transparent"></div>
            <div className="absolute -bottom-[7px] right-3 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-slate-900 border-r-[8px] border-r-transparent"></div>

            <div className="flex justify-between items-start mb-3">
                <h4 className="text-sm font-medium text-white">{title}</h4>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
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

const EmployeeFormContent = ({ userId, onSuccess, onCancel, isSidebarMode = false }) => {
    const { user: currentUser } = useAuth();
    const isEditMode = !!userId;

    const [formData, setFormData] = useState({
        user_name: '',
        email: '',
        phone_no: '',
        user_password: '',
        desg_id: '',
        dept_id: '',
        shift_id: '',
        user_type: 'employee',
        status: true,
        profile_image: null
    });

    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activePopover, setActivePopover] = useState(null);

    const deptContainerRef = useRef(null);
    const desgContainerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activePopover === 'dept' && deptContainerRef.current && !deptContainerRef.current.contains(event.target)) setActivePopover(null);
            if (activePopover === 'desg' && desgContainerRef.current && !desgContainerRef.current.contains(event.target)) setActivePopover(null);
        };
        if (activePopover) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activePopover]);

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
                    const userRes = await adminService.getUserById(userId);
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
                            status: true,
                            profile_image: u.profile_image_url || null
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
    }, [userId, isEditMode]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({
                    ...prev,
                    profile_image: reader.result,
                    profile_image_file: file
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            if (!formData.user_name || (!formData.email && !formData.phone_no)) {
                toast.error("Name and either Email or Phone are required");
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
                await adminService.updateUser(userId, payload, formData.profile_image_file || null);
                toast.success("User updated successfully");
            } else {
                await adminService.createUser(payload, formData.profile_image_file || null);
                toast.success("User created successfully");
            }
            if (onSuccess) onSuccess();
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
            const deptRes = await adminService.getDepartments();
            setDepartments(deptRes.departments);
            setFormData(prev => ({ ...prev, dept_id: res.dept_id }));
        }
    };

    const handleAddDesignation = async (name) => {
        const res = await adminService.createDesignation(name);
        if (res.success) {
            toast.success("Designation added");
            const desgRes = await adminService.getDesignations();
            setDesignations(desgRes.designations);
            setFormData(prev => ({ ...prev, desg_id: res.desg_id }));
        }
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500 text-sm italic">Loading...</div>;

    return (
        <form onSubmit={handleSubmit} className={`flex flex-col h-full bg-white dark:bg-dark-card ${isSidebarMode ? '' : 'space-y-6'}`}>
            {/* Header Actions */}
            <div className={`flex items-center justify-between ${isSidebarMode ? 'p-5 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20 sticky top-0 z-10' : 'mb-6'}`}>
                <button type="button" onClick={onCancel} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-github-dark-muted dark:hover:text-slate-300 transition-colors">
                    <X size={18} />
                    <span className="text-sm font-bold uppercase tracking-wider">Cancel</span>
                </button>
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-70 uppercase tracking-widest"
                >
                    <Save size={16} />
                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
            </div>

            <div className={`flex-1 overflow-y-auto ${isSidebarMode ? 'p-5' : ''} custom-scrollbar`}>
                <div className={`flex flex-col ${isSidebarMode ? 'gap-6' : 'md:flex-row-reverse gap-8 xl:gap-12'}`}>
                    
                    {/* Profile Picture */}
                    <div className={`${isSidebarMode ? 'flex flex-col items-center mb-4' : 'w-full md:w-1/3 flex flex-col items-end pt-8'}`}>
                        <div className="relative group">
                            <div className={`absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-400 to-purple-400 blur-2xl opacity-20 pointer-events-none ${isSidebarMode ? 'w-32 h-32' : 'w-48 h-48 md:w-64 md:h-64'}`}></div>
                            <div className={`relative rounded-full border-4 border-white dark:border-github-dark-border shadow-xl overflow-hidden bg-slate-100 dark:bg-github-dark-subtle flex items-center justify-center text-slate-400 z-10 ${isSidebarMode ? 'w-24 h-24' : 'w-48 h-48 md:w-56 md:h-56'}`}>
                                {formData.profile_image ? (
                                    <img src={formData.profile_image} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={isSidebarMode ? 40 : 80} className="opacity-50" />
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 z-20 w-8 h-8 bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center cursor-pointer shadow-lg border border-slate-100 dark:border-github-dark-border hover:scale-110 transition-transform">
                                <Camera size={16} />
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className={`${isSidebarMode ? 'space-y-6' : 'w-full md:w-2/3 space-y-6'}`}>
                        {/* Section 1: Personal Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-1 bg-indigo-500 rounded-full"></div>
                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Personal Info</h4>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
                                    <input
                                        type="text"
                                        name="user_name"
                                        value={formData.user_name}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-100 dark:border-github-dark-border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-github-dark-text"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
                                    <input
                                        type="password"
                                        name="user_password"
                                        value={formData.user_password}
                                        onChange={handleChange}
                                        placeholder={isEditMode ? "Leave blank to keep" : "Enter password"}
                                        className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-100 dark:border-github-dark-border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-github-dark-text"
                                        required={!isEditMode}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-100 dark:border-github-dark-border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-github-dark-text"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Phone</label>
                                    <input
                                        type="tel"
                                        name="phone_no"
                                        value={formData.phone_no}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-100 dark:border-github-dark-border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-github-dark-text"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Work Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-1 bg-indigo-500 rounded-full"></div>
                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Work Details</h4>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1 relative" ref={deptContainerRef}>
                                    <div className="flex items-center justify-between mb-1 px-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Department</label>
                                        <button
                                            type="button"
                                            onClick={() => setActivePopover(activePopover === 'dept' ? null : 'dept')}
                                            className="text-indigo-500 hover:text-indigo-600"
                                        >
                                            <Plus size={14} />
                                        </button>
                                        <QuickAddPopover
                                            isOpen={activePopover === 'dept'}
                                            title="New Department"
                                            onAdd={handleAddDepartment}
                                            onClose={() => setActivePopover(null)}
                                        />
                                    </div>
                                    <select
                                        name="dept_id"
                                        value={formData.dept_id}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-100 dark:border-github-dark-border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer text-slate-800 dark:text-github-dark-text"
                                    >
                                        <option value="">Select Dept</option>
                                        {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1 relative" ref={desgContainerRef}>
                                    <div className="flex items-center justify-between mb-1 px-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Designation</label>
                                        <button
                                            type="button"
                                            onClick={() => setActivePopover(activePopover === 'desg' ? null : 'desg')}
                                            className="text-indigo-500 hover:text-indigo-600"
                                        >
                                            <Plus size={14} />
                                        </button>
                                        <QuickAddPopover
                                            isOpen={activePopover === 'desg'}
                                            title="New Designation"
                                            onAdd={handleAddDesignation}
                                            onClose={() => setActivePopover(null)}
                                        />
                                    </div>
                                    <select
                                        name="desg_id"
                                        value={formData.desg_id}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-100 dark:border-github-dark-border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer text-slate-800 dark:text-github-dark-text"
                                    >
                                        <option value="">Select Role</option>
                                        {designations.map(d => <option key={d.desg_id} value={d.desg_id}>{d.desg_name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">User Type</label>
                                    <select
                                        name="user_type"
                                        value={formData.user_type}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-100 dark:border-github-dark-border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer text-slate-800 dark:text-github-dark-text"
                                    >
                                        <option value="employee">Employee</option>
                                        {currentUser?.user_type === 'admin' && <option value="hr">HR</option>}
                                        {formData.user_type === 'admin' && <option value="admin">Admin</option>}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
};

export default EmployeeFormContent;
