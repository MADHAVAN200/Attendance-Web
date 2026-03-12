import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Building, Plus, Loader2, Save, X, Search, Calendar, Shield, Activity, Clock, Users } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

const OrganizationList = () => {
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    
    // Admins State for the selected org
    const [orgAdmins, setOrgAdmins] = useState([]);
    const [loadingAdmins, setLoadingAdmins] = useState(false);
    const [editingAdminId, setEditingAdminId] = useState(null);
    const [adminFormData, setAdminFormData] = useState({});
    
    // Form State
    const [formData, setFormData] = useState({
        org_name: '', org_code: '', status: 'active', subscription_plan: 'Trial', subscription_expiry: '', grace_period_days: 0, max_users: 50,
        contact_name: '', contact_email: '', contact_phone: '',
        admin_name: '', admin_email: '', admin_phone: '', admin_password: ''
    });
    const [formLoading, setFormLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchOrganizations();
    }, []);

    const fetchOrganizations = async () => {
        setLoading(true);
        try {
            const res = await api.get('/organizations');
            setOrganizations(res.data.data);
            if (res.data.data.length > 0 && !selectedOrg && !isEditing) {
                handleSelectOrg(res.data.data[0]);
            }
        } catch (error) {
            toast.error('Failed to fetch organizations');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOrg = async (org) => {
        setSelectedOrg(org);
        setFormData({
            ...org,
            subscription_expiry: org.subscription_expiry ? new Date(org.subscription_expiry).toISOString().split('T')[0] : ''
        });
        setIsEditing(false); // Mode: View existing
        fetchOrgAdmins(org.org_id);
    };

    const fetchOrgAdmins = async (orgId) => {
        setLoadingAdmins(true);
        try {
            const res = await api.get(`/organizations/${orgId}/admins`);
            setOrgAdmins(res.data.data);
            setEditingAdminId(null);
        } catch (error) {
            toast.error('Failed to fetch org admins');
        } finally {
            setLoadingAdmins(false);
        }
    };

    const handleEditAdmin = (admin) => {
        setEditingAdminId(admin.user_id);
        setAdminFormData({
            user_name: admin.user_name || '',
            email: admin.email || '',
            phone_no: admin.phone_no || '',
            is_active: admin.is_active ? true : false,
            password: '' // empty unless changing
        });
    };

    const handleSaveAdmin = async (adminId) => {
        try {
            await api.put(`/organizations/${selectedOrg.org_id}/admins/${adminId}`, adminFormData);
            toast.success("Admin updated successfully");
            fetchOrgAdmins(selectedOrg.org_id);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update admin');
        }
    };

    const handleAddNew = () => {
        setSelectedOrg(null);
        setFormData({
            org_name: '', org_code: '', status: 'active', subscription_plan: 'Trial', subscription_expiry: '', grace_period_days: 0, max_users: 50,
            contact_name: '', contact_email: '', contact_phone: '',
            admin_name: '', admin_email: '', admin_phone: '', admin_password: ''
        });
        setIsEditing(true); // Mode: Create new
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            if (!selectedOrg) {
                // Create
                const res = await api.post('/organizations', formData);
                toast.success('Organization created successfully');
                await fetchOrganizations();
                // Select the newly created one (assuming backend returns org_id, but fetch gets the list anyway)
                setIsEditing(false);
            } else {
                // Update
                await api.put(`/organizations/${selectedOrg.org_id}`, formData);
                toast.success('Organization updated successfully');
                
                // Update local state to avoid full refetch if you want, but fetch is safer
                const updatedOrg = { ...selectedOrg, ...formData };
                setOrganizations(organizations.map(o => o.org_id === updatedOrg.org_id ? updatedOrg : o));
                setSelectedOrg(updatedOrg);
                setIsEditing(false);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeactivate = async () => {
        if (window.confirm("Are you sure you want to suspend this organization? This disables access for all of its users.")) {
            try {
                await api.put(`/organizations/${selectedOrg.org_id}`, { status: 'suspended' });
                toast.success('Organization deactivated successfully');
                await fetchOrganizations();
                const updatedOrg = { ...selectedOrg, status: 'suspended' };
                setSelectedOrg(updatedOrg);
                setFormData(updatedOrg);
            } catch (error) {
                toast.error(error.response?.data?.message || 'Deactivation failed');
            }
        }
    };

    const handleReactivate = async () => {
        try {
            await api.put(`/organizations/${selectedOrg.org_id}`, { status: 'active' });
            toast.success('Organization reactivated successfully');
            await fetchOrganizations();
            const updatedOrg = { ...selectedOrg, status: 'active' };
            setSelectedOrg(updatedOrg);
            setFormData(updatedOrg);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Reactivation failed');
        }
    };

    const filteredOrgs = organizations.filter(org => 
        org.org_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        org.org_code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DashboardLayout title="Organization Management">
            <div className="flex flex-col h-[calc(100vh-120px)] space-y-4">
                {/* Header Section */}
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Building size={28} className="text-indigo-600 dark:text-indigo-400" />
                            Organizations
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage platform tenants, subscriptions, and access.</p>
                    </div>
                </div>

                {/* Main Content: Split View */}
                <div className="flex flex-1 gap-6 overflow-hidden">
                    
                    {/* Left Pane: Scrollable List */}
                    <div className="w-1/3 flex flex-col bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                        {/* Search and Action */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
                            <button 
                                onClick={handleAddNew} 
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex justify-center items-center gap-2 font-medium shadow-sm"
                            >
                                <Plus size={18} /> New Organization
                            </button>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search organizations..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {loading ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
                            ) : filteredOrgs.length === 0 ? (
                                <div className="text-center p-8 text-slate-500 text-sm">No organizations found.</div>
                            ) : (
                                filteredOrgs.map((org) => (
                                    <div 
                                        key={org.org_id}
                                        onClick={() => handleSelectOrg(org)}
                                        className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                                            selectedOrg?.org_id === org.org_id 
                                            ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-500/30' 
                                            : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className={`font-semibold text-sm ${selectedOrg?.org_id === org.org_id ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                                {org.org_name}
                                            </h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                org.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            }`}>
                                                {org.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                                            <span>Code: <span className="font-mono">{org.org_code}</span></span>
                                            <span className="flex items-center gap-1"><Shield size={12}/> {org.subscription_plan}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Pane: Details / Edit Form */}
                    <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                        {(!selectedOrg && !isEditing) ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                                <Building size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
                                <p>Select an organization to view details or create a new one.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSave} className="flex flex-col h-full">
                                {/* Details Header */}
                                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-800/20">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-lg text-indigo-600 dark:text-indigo-400">
                                                <Building size={24} />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                                    {isEditing ? (selectedOrg ? 'Edit Organization' : 'Create New Organization') : selectedOrg.org_name}
                                                </h2>
                                                {!isEditing && <p className="text-sm font-mono text-slate-500">Code: {selectedOrg.org_code}</p>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {!isEditing ? (
                                            <button 
                                                type="button" 
                                                onClick={() => setIsEditing(true)}
                                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                                            >
                                                Edit Details
                                            </button>
                                        ) : (
                                            <>
                                                {selectedOrg && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            setIsEditing(false);
                                                            handleSelectOrg(selectedOrg); // reset form
                                                        }}
                                                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors text-sm"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                                <button 
                                                    type="submit" 
                                                    disabled={formLoading}
                                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-70 text-sm shadow-md shadow-indigo-500/20"
                                                >
                                                    {formLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                                    Save Changes
                                                </button>
                                            </>
                                        )}
                                        {/* Deactivate Button outside edit mode */}
                                        {!isEditing && selectedOrg && selectedOrg.status !== 'suspended' && (
                                            <button 
                                                type="button" 
                                                onClick={handleDeactivate}
                                                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:hover:bg-red-900/60 dark:text-red-400 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ml-2"
                                            >
                                                Deactivate 
                                            </button>
                                        )}
                                        {!isEditing && selectedOrg && selectedOrg.status === 'suspended' && (
                                            <button 
                                                type="button" 
                                                onClick={handleReactivate}
                                                className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 dark:text-emerald-400 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ml-2"
                                            >
                                                Reactivate 
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Details / Form Body */}
                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                    <div className="max-w-3xl space-y-8">
                                        
                                        {/* General Info Section */}
                                        <section>
                                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">General Information</h3>
                                            <div className="grid grid-cols-2 gap-6 relative">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400 relative z-10">Organization Name</label>
                                                    {isEditing ? (
                                                        <input required value={formData.org_name} onChange={(e) => setFormData({...formData, org_name: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="e.g. Acme Corp" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-transparent text-slate-800 dark:text-slate-200 font-medium">{selectedOrg.org_name}</div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400 relative z-10">Organization Code</label>
                                                    {isEditing ? (
                                                        <input required disabled={!!selectedOrg} value={formData.org_code} onChange={(e) => setFormData({...formData, org_code: e.target.value.toUpperCase()})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-900 font-mono" placeholder="e.g. ACM01" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-transparent text-slate-800 dark:text-slate-200 font-mono">{selectedOrg.org_code}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>

                                        {/* Contact Section */}
                                        <section>
                                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">Organization Contact Details</h3>
                                            <div className="grid grid-cols-2 gap-6 relative">
                                                <div className="space-y-1.5 col-span-2">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400 relative z-10">Contact Person Name</label>
                                                    {isEditing ? (
                                                        <input value={formData.contact_name} onChange={(e) => setFormData({...formData, contact_name: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="e.g. John Doe" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-transparent text-slate-800 dark:text-slate-200">{selectedOrg.contact_name || 'N/A'}</div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400 relative z-10">Contact Email Address</label>
                                                    {isEditing ? (
                                                        <input type="email" value={formData.contact_email} onChange={(e) => setFormData({...formData, contact_email: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="contact@example.com" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-transparent text-slate-800 dark:text-slate-200">{selectedOrg.contact_email || 'N/A'}</div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400 relative z-10">Contact Phone Number</label>
                                                    {isEditing ? (
                                                        <input type="tel" value={formData.contact_phone} onChange={(e) => setFormData({...formData, contact_phone: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="+1 234 567 8900" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-transparent text-slate-800 dark:text-slate-200 font-mono">{selectedOrg.contact_phone || 'N/A'}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>

                                        {/* Admin Section (Only on create) */}
                                        {isEditing && !selectedOrg && (
                                            <section>
                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">Initial Admin Setup</h3>
                                                <div className="grid grid-cols-2 gap-6 relative p-5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                                                    <div className="space-y-1.5 col-span-2">
                                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400 relative z-10">Admin Name</label>
                                                        <input value={formData.admin_name} onChange={(e) => setFormData({...formData, admin_name: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="e.g. Admin Supervisor" />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400 relative z-10">Admin Email Address <span className="text-red-500">*</span></label>
                                                        <input type="email" required value={formData.admin_email} onChange={(e) => setFormData({...formData, admin_email: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="admin@example.com" />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400 relative z-10">Admin Phone Number</label>
                                                        <input type="tel" value={formData.admin_phone} onChange={(e) => setFormData({...formData, admin_phone: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="+1 234 567 8900" />
                                                    </div>

                                                    <div className="space-y-1.5 col-span-2">
                                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400 relative z-10">Initial Admin Password <span className="text-red-500">*</span></label>
                                                        <input type="text" required value={formData.admin_password} onChange={(e) => setFormData({...formData, admin_password: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono" placeholder="Set a secure password for the first admin login" />
                                                        <p className="text-xs text-slate-500 mt-1">This generated user will be an organizational admin with full local access.</p>
                                                    </div>
                                                </div>
                                            </section>
                                        )}

                                        {/* Subscription & Status Section */}
                                        <section>
                                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">Status & Subscription</h3>
                                            <div className="grid grid-cols-2 gap-6 relative">
                                                <div className="space-y-1.5 relative z-10">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Activity size={14}/> Account Status</label>
                                                    {isEditing ? (
                                                        <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors appearance-none">
                                                            <option value="active">Active</option>
                                                            <option value="inactive">Inactive</option>
                                                            <option value="suspended">Suspended</option>
                                                        </select>
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-transparent flex items-center">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                                                                selectedOrg.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                            }`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${selectedOrg.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                                                {selectedOrg.status}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5 relative z-10">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Shield size={14}/> Subscription Plan</label>
                                                    {isEditing ? (
                                                        <select value={formData.subscription_plan} onChange={(e) => setFormData({...formData, subscription_plan: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors appearance-none">
                                                            <option value="Trial">Trial</option>
                                                            <option value="Basic">Basic</option>
                                                            <option value="Premium">Premium</option>
                                                        </select>
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-transparent font-medium text-indigo-700 dark:text-indigo-400">
                                                            {selectedOrg.subscription_plan}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Calendar size={14}/> Expiry Date</label>
                                                    {isEditing ? (
                                                        <input type="date" value={formData.subscription_expiry} onChange={(e) => setFormData({...formData, subscription_expiry: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-transparent text-slate-800 dark:text-slate-200">
                                                            {selectedOrg.subscription_expiry ? new Date(selectedOrg.subscription_expiry).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Lifetime / Processing'}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Clock size={14}/> Grace Period (Days)</label>
                                                    {isEditing ? (
                                                        <input type="number" min="0" value={formData.grace_period_days} onChange={(e) => setFormData({...formData, grace_period_days: parseInt(e.target.value) || 0})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-transparent text-slate-800 dark:text-slate-200 font-mono">
                                                            {selectedOrg.grace_period_days} Days
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>

                                        {/* User Metrics Section */}
                                        <section>
                                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">Usage & Capacity</h3>
                                            <div className="grid grid-cols-2 gap-6 relative">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Users size={14}/> Max Users Allowed</label>
                                                    {isEditing ? (
                                                        <input type="number" min="0" value={formData.max_users} onChange={(e) => setFormData({...formData, max_users: parseInt(e.target.value) || 0})} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-transparent text-slate-800 dark:text-slate-200 font-mono">
                                                            {selectedOrg.max_users} Users
                                                        </div>
                                                    )}
                                                </div>

                                                {!isEditing && (
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Activity size={14}/> Current Usage Stats</label>
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-transparent flex gap-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Total User Accounts</span>
                                                                <span className="font-mono font-medium text-slate-900 dark:text-white">{selectedOrg.total_users || 0}</span>
                                                            </div>
                                                            <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Active Logins</span>
                                                                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{selectedOrg.active_users || 0}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </section>

                                        {/* Admins Table Section (View Mode Only) */}
                                        {!isEditing && selectedOrg && (
                                            <section>
                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-slate-700 pb-2 flex justify-between items-center">
                                                    <span>Organization Admins</span>
                                                    <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-full">{orgAdmins.length}</span>
                                                </h3>
                                                <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                                                    {loadingAdmins ? (
                                                        <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
                                                    ) : orgAdmins.length === 0 ? (
                                                        <div className="p-8 text-center text-slate-500 text-sm">No admin users found.</div>
                                                    ) : (
                                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                                            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                                                                <tr>
                                                                    <th className="px-4 py-3 font-medium">Name</th>
                                                                    <th className="px-4 py-3 font-medium">Email</th>
                                                                    <th className="px-4 py-3 font-medium">Phone</th>
                                                                    <th className="px-4 py-3 font-medium">Status / Password</th>
                                                                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-800 dark:text-slate-200">
                                                                {orgAdmins.map(admin => (
                                                                    <tr key={admin.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                                        {editingAdminId === admin.user_id ? (
                                                                            <>
                                                                                <td className="px-4 py-2">
                                                                                    <input className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-xs" value={adminFormData.user_name} onChange={e => setAdminFormData({...adminFormData, user_name: e.target.value})} placeholder="Name" />
                                                                                </td>
                                                                                <td className="px-4 py-2">
                                                                                    <input type="email" className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-xs" value={adminFormData.email} onChange={e => setAdminFormData({...adminFormData, email: e.target.value})} placeholder="Email" />
                                                                                </td>
                                                                                <td className="px-4 py-2">
                                                                                    <input type="tel" className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-xs" value={adminFormData.phone_no} onChange={e => setAdminFormData({...adminFormData, phone_no: e.target.value})} placeholder="Phone" />
                                                                                </td>
                                                                                <td className="px-4 py-2 flex gap-2">
                                                                                    <select className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-xs appearance-none" value={adminFormData.is_active ? '1' : '0'} onChange={e => setAdminFormData({...adminFormData, is_active: e.target.value === '1'})}>
                                                                                        <option value="1">Active</option>
                                                                                        <option value="0">Disabled</option>
                                                                                    </select>
                                                                                    <input type="text" className="w-24 px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-xs" value={adminFormData.password} onChange={e => setAdminFormData({...adminFormData, password: e.target.value})} placeholder="New Pwd?" />
                                                                                </td>
                                                                                <td className="px-4 py-2 text-right">
                                                                                    <div className="flex items-center justify-end gap-2">
                                                                                        <button type="button" onClick={() => handleSaveAdmin(admin.user_id)} className="text-emerald-600 hover:text-emerald-700 font-medium text-xs">Save</button>
                                                                                        <button type="button" onClick={() => setEditingAdminId(null)} className="text-slate-500 hover:text-slate-700 text-xs text-xs">Cancel</button>
                                                                                    </div>
                                                                                </td>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <td className="px-4 py-3 font-medium">{admin.user_name} <span className="text-[10px] text-slate-400 font-mono ml-1">{admin.user_code}</span></td>
                                                                                <td className="px-4 py-3">{admin.email}</td>
                                                                                <td className="px-4 py-3 font-mono text-xs">{admin.phone_no || '-'}</td>
                                                                                <td className="px-4 py-3">
                                                                                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase font-bold ${admin.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                                                        {admin.is_active ? 'Active' : 'Disabled'}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-right">
                                                                                    <button type="button" onClick={() => handleEditAdmin(admin)} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium text-xs transition-colors">
                                                                                        Edit
                                                                                    </button>
                                                                                </td>
                                                                            </>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                            </section>
                                        )}
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default OrganizationList;
