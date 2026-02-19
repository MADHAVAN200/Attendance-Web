import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { Mail, Phone, Briefcase, Shield, Camera, Loader2, Edit, Trash2, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { toast } from 'react-toastify';

const Profile = () => {
    const { user: authUser, fetchUser, logout } = useAuth();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [imageTimestamp, setImageTimestamp] = useState(Date.now());

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

    // Add cache-busting timestamp to avatar URL to force reload on update
    const getAvatarUrl = () => {
        const baseUrl = profileData?.profile_image_url || authUser?.profile_image_url;
        if (!baseUrl) return null;
        return `${baseUrl}?t=${imageTimestamp}`;
    };

    const user = {
        name: profileData?.user_name || authUser?.user_name || 'User',
        role: profileData?.user_type || authUser?.user_type || 'Staff',
        email: profileData?.email || authUser?.email || '',
        phone: profileData?.phone_no || authUser?.phone_no || 'Not provided',
        department: profileData?.dept_name || 'Not assigned',
        employeeCode: profileData?.user_code || authUser?.user_code || '...',
        avatar: getAvatarUrl()
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
                setImageTimestamp(Date.now());
                await fetchUser(); // Refresh global user state
                setProfileData(prev => ({
                    ...prev,
                    profile_image_url: res.data.profile_image_url
                }));
            }
        } catch (error) {
            console.error('Upload Error:', error);
            toast.error(error.response?.data?.message || 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteAvatar = async () => {
        if (!window.confirm('Are you sure you want to remove your profile picture?')) return;

        try {
            const res = await api.delete('/profile');
            if (res.data.ok) {
                toast.success('Profile picture removed!');
                setProfileData(prev => ({
                    ...prev,
                    profile_image_url: null
                }));
                await fetchUser();
                setShowPreview(false);
                setImageTimestamp(Date.now());
            }
        } catch (error) {
            console.error('Delete Error:', error);
            toast.error(error.response?.data?.message || 'Failed to remove image');
        }
    };

    if (loading) {
        return (
            <MobileDashboardLayout title="My Profile">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-indigo-600" size={48} />
                </div>
            </MobileDashboardLayout>
        );
    }

    return (
        <MobileDashboardLayout title="My Profile">
            <div className="w-full space-y-6 pb-6">

                {/* Profile Header Card */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-4 text-center">
                    <div className="relative group">
                        <div
                            onClick={handleAvatarClick}
                            className="w-28 h-28 rounded-full bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-3xl font-bold border-4 border-white dark:border-slate-800 shadow-xl shrink-0 overflow-hidden cursor-pointer"
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
                            className="absolute bottom-1 right-1 w-9 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-lg active:scale-95 transition-transform"
                            title="Change Profile Picture"
                        >
                            {uploading ? (
                                <Loader2 className="animate-spin" size={16} />
                            ) : (
                                <Camera size={16} />
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

                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white capitalize tracking-tight">{user.name}</h2>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wide">
                            <Shield size={12} />
                            <span>{user.role}</span>
                        </div>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="space-y-4">
                    {/* Contact Info */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Contact Information</h3>

                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                                <Mail size={20} />
                            </div>
                            <div className="min-w-0 pt-1">
                                <p className="text-xs text-slate-400 mb-0.5">Email Address</p>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{user.email}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                                <Phone size={20} />
                            </div>
                            <div className="min-w-0 pt-1">
                                <p className="text-xs text-slate-400 mb-0.5">Phone Number</p>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{user.phone}</p>
                            </div>
                        </div>
                    </div>

                    {/* Employment Info */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Employment Details</h3>

                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                                <Briefcase size={20} />
                            </div>
                            <div className="min-w-0 pt-1">
                                <p className="text-xs text-slate-400 mb-0.5">Department</p>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{user.department}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                                <Briefcase size={20} />
                            </div>
                            <div className="min-w-0 pt-1">
                                <p className="text-xs text-slate-400 mb-0.5">Designation</p>
                                {/* Assuming 'role' or similar is designation, or defaulting since it wasn't in original profileData explicitly mapping to 'Designation' */}
                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{user.role}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Logout Button */}
                <button
                    onClick={logout}
                    className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 dark:shadow-red-900/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    <LogOut size={20} />
                    Log Out
                </button>
            </div>

            {/* --- IMAGE PREVIEW MODAL --- */}
            {showPreview && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 transition-all duration-200"
                    onClick={() => setShowPreview(false)}
                >
                    <div
                        className="w-full max-w-sm space-y-6 animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative bg-transparent rounded-lg overflow-hidden flex items-center justify-center">
                            <img
                                src={user.avatar}
                                alt="Profile Preview"
                                className="w-full max-h-[70vh] object-contain rounded-2xl"
                            />
                        </div>

                        <div className="flex justify-center gap-4">
                            <button
                                onClick={handleEditClick}
                                className="flex-1 py-3 bg-white/10 backdrop-blur text-white font-bold rounded-xl flex items-center justify-center gap-2"
                            >
                                <Edit size={18} /> Edit
                            </button>
                            <button
                                onClick={handleDeleteAvatar}
                                className="flex-1 py-3 bg-red-500/80 backdrop-blur text-white font-bold rounded-xl flex items-center justify-center gap-2"
                            >
                                <Trash2 size={18} /> Remove
                            </button>
                        </div>
                        <button onClick={() => setShowPreview(false)} className="w-full py-3 text-white/50 font-bold">Close</button>
                    </div>
                </div>,
                document.body
            )}
        </MobileDashboardLayout>
    );
};

export default Profile;
