import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { User, Mail, Phone, Briefcase, Shield, Camera, Loader2, X, RefreshCw, Edit, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { toast } from 'react-toastify';

const Profile = () => {
    const { user: authUser, fetchUser } = useAuth();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // Fetch full profile data on mount
    useEffect(() => {
        const getProfile = async () => {
            try {
                const res = await api.get('/profile/me');
                if (res.data.ok) {
                    setProfileData(res.data.user);
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
            }
        };
        getProfile();
    }, []);

    const user = {
        name: profileData?.user_name || authUser?.user_name || 'User',
        role: profileData?.user_type || authUser?.user_type || 'Staff',
        email: profileData?.email || authUser?.email || '',
        phone: profileData?.phone_no || authUser?.phone_no || 'Not provided',
        department: profileData?.dept_name || 'Not assigned',
        employeeCode: profileData?.user_code || authUser?.user_code || '...',
        avatar: profileData?.avatar_url || authUser?.avatar_url || authUser?.profile_image_url
    };

    const handleAvatarClick = () => {
        if (user.avatar && user.avatar.startsWith('http')) {
            setShowPreview(true);
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleEditClick = (e) => {
        e.stopPropagation();
        setShowPreview(false);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size must be less than 5MB');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        setUploading(true);
        try {
            const res = await api.post('/profile', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data.ok) {
                toast.success('Profile picture updated!');
                await fetchUser(); // Refresh global user state
                // Also update local profile data
                setProfileData(prev => ({
                    ...prev,
                    avatar_url: res.data.avatar_url,
                    profile_image_url: res.data.avatar_url
                }));
            }
        } catch (error) {
            console.error('Upload Error:', error);
            toast.error(error.response?.data?.message || 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout title="My Profile">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-indigo-600" size={48} />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="My Profile">
            <div className="w-full space-y-6">

                {/* Profile Header Card */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center md:items-center gap-8 transition-colors">
                    <div className="relative group">
                        <div
                            onClick={handleAvatarClick}
                            className="w-32 h-32 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-4xl font-bold border-4 border-white dark:border-slate-800 shadow-lg shrink-0 overflow-hidden cursor-pointer"
                        >
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                user.name.charAt(0).toUpperCase()
                            )}


                        </div>

                        {/* Camera Icon Badge */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-0 right-0 w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-lg transition-all active:scale-95"
                            title="Change Profile Picture"
                        >
                            {uploading ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <Camera size={18} />
                            )}
                        </button>

                        {/* Hidden Input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>

                    <div className="flex-1 text-center md:text-left space-y-2">
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-white capitalize">{user.name}</h2>
                        <div className="flex items-center justify-center md:justify-start gap-2 text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-900/10 px-3 py-1 rounded-full w-fit mx-auto md:mx-0 capitalize">
                            <Shield size={16} />
                            <span>{user.role}</span>
                        </div>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personal Info */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-4">
                            Contact Information
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 shrink-0">
                                    <Mail size={22} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-0.5">Email Address</p>
                                    <p className="text-slate-800 dark:text-white font-medium truncate">{user.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 shrink-0">
                                    <Phone size={22} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-0.5">Phone Number</p>
                                    <p className="text-slate-800 dark:text-white font-medium truncate">{user.phone}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Employment Info */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-4">
                            Employment Details
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 shrink-0">
                                    <Briefcase size={22} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-0.5">Department</p>
                                    <p className="text-slate-800 dark:text-white font-medium truncate">{user.department}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 shrink-0">
                                    <User size={22} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-0.5">Employee Code</p>
                                    <p className="text-slate-800 dark:text-white font-medium truncate">{user.employeeCode}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* --- IMAGE PREVIEW MODAL --- */}
            {showPreview && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4 transition-all duration-200"
                    onClick={() => setShowPreview(false)}
                >
                    <div
                        className="w-full max-w-4xl space-y-6 animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center px-4">
                            <h3 className="text-2xl font-bold text-white tracking-tight">
                                Profile Picture
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleEditClick}
                                    className="p-2.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-all backdrop-blur-md flex items-center gap-2 px-4"
                                >
                                    <Edit size={20} />
                                    <span className="text-sm font-bold">Edit</span>
                                </button>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="p-2.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-all backdrop-blur-md"
                                >
                                    <X size={28} />
                                </button>
                            </div>
                        </div>

                        <div className="relative bg-black rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/10 flex items-center justify-center min-h-[50vh]">
                            <img
                                src={user.avatar}
                                alt="Profile Preview"
                                className="w-full h-full object-contain max-h-[80vh]"
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </DashboardLayout>
    );
};

export default Profile;
