import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Building, Plus, Loader2, Save, X, Search, Calendar, Shield, Activity, Clock, Users, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
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
    const [deleteConfirmOrg, setDeleteConfirmOrg] = useState(null); // org object to confirm deletion
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [listTab, setListTab] = useState('active'); // 'active' | 'deleted'

    useEffect(() => {
        fetchOrganizations();
    }, []);

    const fetchOrganizations = async () => {
        setLoading(true);
        try {
            const res = await api.get('/organizations');
            const data = res.data.data;
            // Debug: log all statuses to verify what the backend returns
            console.log('[Orgs] statuses:', data.map(o => `${o.org_code}=${o.status}`));
            setOrganizations(data);
            if (data.length > 0 && !selectedOrg && !isEditing) {
                // Only auto-select an active/non-deleted org on first load
                const firstActive = data.find(o => o.status !== 'pending_deletion');
                if (firstActive) handleSelectOrg(firstActive);
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

    const handleDeleteOrg = async () => {
        if (!deleteConfirmOrg) return;
        setDeleteLoading(true);
        try {
            const res = await api.delete(`/organizations/${deleteConfirmOrg.org_id}`);
            toast.success(res.data.message || 'Organization scheduled for deletion.');
            setDeleteConfirmOrg(null);
            if (selectedOrg?.org_id === deleteConfirmOrg.org_id) {
                setSelectedOrg(null);
                setIsEditing(false);
            }
            await fetchOrganizations();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to schedule deletion.');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleCancelDeletion = async () => {
        try {
            const res = await api.post(`/organizations/${selectedOrg.org_id}/cancel-deletion`);
            toast.success(res.data.message || 'Deletion cancelled.');
            await fetchOrganizations();
            const updatedOrg = { ...selectedOrg, status: 'active', deletion_scheduled_at: null, deletion_requested_at: null };
            setSelectedOrg(updatedOrg);
            setFormData(updatedOrg);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel deletion.');
        }
    };

    // Use deletion_scheduled_at as the source of truth for pending-deletion orgs.
    // The status ENUM column silently stores '' for unknown values (like 'pending_deletion'),
    // so we rely on the timestamp field which is always correctly set by the backend.
    const isPendingDeletion = (o) => o.deletion_scheduled_at !== null && o.deletion_scheduled_at !== undefined;
    const matchesSearch    = (o) =>
        o.org_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.org_code.toLowerCase().includes(searchQuery.toLowerCase());

    const activeOrgs  = organizations.filter(o => !isPendingDeletion(o) && matchesSearch(o));
    const pendingOrgs = organizations.filter(o =>  isPendingDeletion(o) && matchesSearch(o));
    const displayedOrgs = listTab === 'active' ? activeOrgs : pendingOrgs;

    return (
        <DashboardLayout title="Organization Management">
            <div className="flex flex-col flex-1 space-y-4 min-h-0">

                {/* Main Content: Split View */}
                <div className="flex flex-1 gap-6 overflow-hidden">

                    {/* Left Pane: Scrollable List */}
                    <div className="w-1/3 flex flex-col bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden shrink-0">
                        {/* Search and Action */}
                        <div className="p-4 border-b border-slate-100 dark:border-github-dark-border space-y-4">
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
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-sm text-slate-900 dark:text-github-dark-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-100 dark:border-github-dark-border">
                            <button
                                type="button"
                                onClick={() => { setListTab('active'); setSelectedOrg(null); setIsEditing(false); }}
                                className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors ${listTab === 'active'
                                        ? 'text-indigo-600 border-b-2 border-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted dark:hover:text-github-dark-text'
                                    }`}
                            >
                                Organizations
                                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${listTab === 'active' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>{activeOrgs.length}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setListTab('deleted'); setSelectedOrg(null); setIsEditing(false); }}
                                className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors ${listTab === 'deleted'
                                        ? 'text-amber-600 border-b-2 border-amber-500 dark:text-amber-400 dark:border-amber-400'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted dark:hover:text-github-dark-text'
                                    }`}
                            >
                                Deleted
                                {pendingOrgs.length > 0 && (
                                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${listTab === 'deleted' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-500'
                                        }`}>{pendingOrgs.length}</span>
                                )}
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {loading ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
                            ) : displayedOrgs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 text-slate-400 dark:text-github-dark-muted gap-2">
                                    {listTab === 'deleted'
                                        ? <><AlertTriangle size={28} className="text-amber-300" /><span className="text-sm">No deleted organizations.</span></>
                                        : <><Building size={28} className="text-slate-300" /><span className="text-sm">No organizations found.</span></>
                                    }
                                </div>
                            ) : listTab === 'active' ? (
                                displayedOrgs.map((org) => (
                                    <div
                                        key={org.org_id}
                                        onClick={() => handleSelectOrg(org)}
                                        className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${selectedOrg?.org_id === org.org_id
                                                ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-500/30'
                                                : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className={`font-semibold text-sm ${selectedOrg?.org_id === org.org_id ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                {org.org_name}
                                            </h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${org.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                }`}>
                                                {org.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-github-dark-muted">
                                            <span>Code: <span className="font-mono">{org.org_code}</span></span>
                                            <span className="flex items-center gap-1"><Shield size={12} /> {org.subscription_plan}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                displayedOrgs.map((org) => (
                                    <div
                                        key={org.org_id}
                                        onClick={() => handleSelectOrg(org)}
                                        className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${selectedOrg?.org_id === org.org_id
                                                ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-500/30'
                                                : 'border-transparent hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className={`font-semibold text-sm line-through opacity-60 ${selectedOrg?.org_id === org.org_id ? 'text-amber-900 dark:text-amber-300' : 'text-slate-700 dark:text-github-dark-text'
                                                }`}>
                                                {org.org_name}
                                            </h3>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                Deleting
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-github-dark-muted">
                                            <span className="font-mono">{org.org_code}</span>
                                            {org.deletion_scheduled_at && (
                                                <span className="text-amber-500 dark:text-amber-400 flex items-center gap-1">
                                                    <Trash2 size={10} /> {new Date(org.deletion_scheduled_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Pane: Details / Edit Form */}
                    <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col">
                        {(!selectedOrg && !isEditing) ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-github-dark-muted">
                                <Building size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
                                <p>Select an organization to view details or create a new one.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSave} className="flex flex-col h-full">
                                {/* Details Header */}
                                <div className="px-8 py-6 border-b border-slate-100 dark:border-github-dark-border flex justify-between items-start bg-slate-50/50 dark:bg-github-dark-subtle/20">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-lg text-indigo-600 dark:text-indigo-400">
                                                <Building size={24} />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-slate-900 dark:text-github-dark-text">
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
                                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-github-dark-subtle dark:hover:bg-slate-700 text-slate-700 dark:text-github-dark-text rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
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
                                                        className="px-4 py-2 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors text-sm"
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
                                        {/* Status action buttons — view mode only */}
                                        {!isEditing && selectedOrg && selectedOrg.status === 'pending_deletion' && (
                                            <button
                                                type="button"
                                                onClick={handleCancelDeletion}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ml-2 shadow-sm"
                                            >
                                                <RotateCcw size={14} /> Recover Organization
                                            </button>
                                        )}
                                        {!isEditing && selectedOrg && selectedOrg.status !== 'suspended' && selectedOrg.status !== 'pending_deletion' && (
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
                                        {!isEditing && selectedOrg && selectedOrg.status !== 'pending_deletion' && (
                                            <button
                                                type="button"
                                                onClick={() => setDeleteConfirmOrg(selectedOrg)}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ml-2 shadow-sm"
                                            >
                                                <Trash2 size={14} /> Delete Org
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Details / Form Body */}
                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                    <div className="max-w-3xl space-y-8">

                                        {/* Pending Deletion Warning Banner */}
                                        {selectedOrg?.status === 'pending_deletion' && (
                                            <div className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl">
                                                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Organization Scheduled for Deletion</p>
                                                    <p className="text-amber-700 dark:text-amber-400 text-sm mt-0.5">
                                                        This organization and all its data will be <strong>permanently deleted</strong> on{' '}
                                                        <strong>
                                                            {selectedOrg.deletion_scheduled_at
                                                                ? new Date(selectedOrg.deletion_scheduled_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                                                                : 'the scheduled date'}
                                                        </strong>.
                                                        Use <em>Cancel Deletion</em> above to reverse this action before that date.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* General Info Section */}
                                        <section>
                                            <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-github-dark-border pb-2">General Information</h3>
                                            <div className="grid grid-cols-2 gap-6 relative">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted relative z-10">Organization Name</label>
                                                    {isEditing ? (
                                                        <input required value={formData.org_name} onChange={(e) => setFormData({ ...formData, org_name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="e.g. Acme Corp" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-lg border border-transparent text-slate-800 dark:text-github-dark-text font-medium">{selectedOrg.org_name}</div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted relative z-10">Organization Code</label>
                                                    {isEditing ? (
                                                        <input required disabled={!!selectedOrg} value={formData.org_code} onChange={(e) => setFormData({ ...formData, org_code: e.target.value.toUpperCase() })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-900 font-mono" placeholder="e.g. ACM01" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-lg border border-transparent text-slate-800 dark:text-github-dark-text font-mono">{selectedOrg.org_code}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>

                                        {/* Contact Section */}
                                        <section>
                                            <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-github-dark-border pb-2">Organization Contact Details</h3>
                                            <div className="grid grid-cols-2 gap-6 relative">
                                                <div className="space-y-1.5 col-span-2">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted relative z-10">Contact Person Name</label>
                                                    {isEditing ? (
                                                        <input value={formData.contact_name} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="e.g. John Doe" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-lg border border-transparent text-slate-800 dark:text-github-dark-text">{selectedOrg.contact_name || 'N/A'}</div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted relative z-10">Contact Email Address</label>
                                                    {isEditing ? (
                                                        <input type="email" value={formData.contact_email} onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="contact@example.com" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-lg border border-transparent text-slate-800 dark:text-github-dark-text">{selectedOrg.contact_email || 'N/A'}</div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted relative z-10">Contact Phone Number</label>
                                                    {isEditing ? (
                                                        <input type="tel" value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="+1 234 567 8900" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-lg border border-transparent text-slate-800 dark:text-github-dark-text font-mono">{selectedOrg.contact_phone || 'N/A'}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>

                                        {/* Admin Section (Only on create) */}
                                        {isEditing && !selectedOrg && (
                                            <section>
                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-github-dark-border pb-2">Initial Admin Setup</h3>
                                                <div className="grid grid-cols-2 gap-6 relative p-5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                                                    <div className="space-y-1.5 col-span-2">
                                                        <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted relative z-10">Admin Name</label>
                                                        <input value={formData.admin_name} onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="e.g. Admin Supervisor" />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted relative z-10">Admin Email Address <span className="text-red-500">*</span></label>
                                                        <input type="email" required value={formData.admin_email} onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="admin@example.com" />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted relative z-10">Admin Phone Number</label>
                                                        <input type="tel" value={formData.admin_phone} onChange={(e) => setFormData({ ...formData, admin_phone: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="+1 234 567 8900" />
                                                    </div>

                                                    <div className="space-y-1.5 col-span-2">
                                                        <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted relative z-10">Initial Admin Password <span className="text-red-500">*</span></label>
                                                        <input type="text" required value={formData.admin_password} onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono" placeholder="Set a secure password for the first admin login" />
                                                        <p className="text-xs text-slate-500 mt-1">This generated user will be an organizational admin with full local access.</p>
                                                    </div>
                                                </div>
                                            </section>
                                        )}

                                        {/* Subscription & Status Section */}
                                        <section>
                                            <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-github-dark-border pb-2">Status & Subscription</h3>
                                            <div className="grid grid-cols-2 gap-6 relative">
                                                <div className="space-y-1.5 relative z-10">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted flex items-center gap-1.5"><Activity size={14} /> Account Status</label>
                                                    {isEditing ? (
                                                        <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors appearance-none">
                                                            <option value="active">Active</option>
                                                            <option value="inactive">Inactive</option>
                                                            <option value="suspended">Suspended</option>
                                                        </select>
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-lg border border-transparent flex items-center">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${selectedOrg.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                                }`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${selectedOrg.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                                                {selectedOrg.status}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5 relative z-10">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted flex items-center gap-1.5"><Shield size={14} /> Subscription Plan</label>
                                                    {isEditing ? (
                                                        <select value={formData.subscription_plan} onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors appearance-none">
                                                            <option value="Trial">Trial</option>
                                                            <option value="Basic">Basic</option>
                                                            <option value="Premium">Premium</option>
                                                        </select>
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-lg border border-transparent font-medium text-indigo-700 dark:text-indigo-400">
                                                            {selectedOrg.subscription_plan}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted flex items-center gap-1.5"><Calendar size={14} /> Expiry Date</label>
                                                    {isEditing ? (
                                                        <input type="date" value={formData.subscription_expiry} onChange={(e) => setFormData({ ...formData, subscription_expiry: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-lg border border-transparent text-slate-800 dark:text-github-dark-text">
                                                            {selectedOrg.subscription_expiry ? new Date(selectedOrg.subscription_expiry).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Lifetime / Processing'}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted flex items-center gap-1.5"><Clock size={14} /> Grace Period (Days)</label>
                                                    {isEditing ? (
                                                        <input type="number" min="0" value={formData.grace_period_days} onChange={(e) => setFormData({ ...formData, grace_period_days: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-lg border border-transparent text-slate-800 dark:text-github-dark-text font-mono">
                                                            {selectedOrg.grace_period_days} Days
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>

                                        {/* User Metrics Section */}
                                        <section>
                                            <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-github-dark-border pb-2">Usage & Capacity</h3>
                                            <div className="grid grid-cols-2 gap-6 relative">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted flex items-center gap-1.5"><Users size={14} /> Max Users Allowed</label>
                                                    {isEditing ? (
                                                        <input type="number" min="0" value={formData.max_users} onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 border border-slate-300 dark:border-github-dark-border rounded-lg dark:bg-github-dark-subtle text-slate-900 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
                                                    ) : (
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-lg border border-transparent text-slate-800 dark:text-github-dark-text font-mono">
                                                            {selectedOrg.max_users} Users
                                                        </div>
                                                    )}
                                                </div>

                                                {!isEditing && (
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-600 dark:text-github-dark-muted flex items-center gap-1.5"><Activity size={14} /> Current Usage Stats</label>
                                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-github-dark-subtle/30 rounded-lg border border-transparent flex gap-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs text-slate-500 dark:text-github-dark-muted uppercase">Total User Accounts</span>
                                                                <span className="font-mono font-medium text-slate-900 dark:text-github-dark-text">{selectedOrg.total_users || 0}</span>
                                                            </div>
                                                            <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs text-slate-500 dark:text-github-dark-muted uppercase">Active Logins</span>
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
                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-github-dark-border pb-2 flex justify-between items-center">
                                                    <span>Organization Admins</span>
                                                    <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-full">{orgAdmins.length}</span>
                                                </h3>
                                                <div className="bg-white dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border overflow-hidden shadow-sm">
                                                    {loadingAdmins ? (
                                                        <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
                                                    ) : orgAdmins.length === 0 ? (
                                                        <div className="p-8 text-center text-slate-500 text-sm">No admin users found.</div>
                                                    ) : (
                                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                                            <thead className="bg-slate-50 dark:bg-github-dark-subtle/80 border-b border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-github-dark-muted">
                                                                <tr>
                                                                    <th className="px-4 py-3 font-medium">Name</th>
                                                                    <th className="px-4 py-3 font-medium">Email</th>
                                                                    <th className="px-4 py-3 font-medium">Phone</th>
                                                                    <th className="px-4 py-3 font-medium">Status / Password</th>
                                                                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-800 dark:text-github-dark-text">
                                                                {orgAdmins.map(admin => (
                                                                    <tr key={admin.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                                        {editingAdminId === admin.user_id ? (
                                                                            <>
                                                                                <td className="px-4 py-2">
                                                                                    <input className="w-full px-2 py-1.5 border border-slate-300 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs" value={adminFormData.user_name} onChange={e => setAdminFormData({ ...adminFormData, user_name: e.target.value })} placeholder="Name" />
                                                                                </td>
                                                                                <td className="px-4 py-2">
                                                                                    <input type="email" className="w-full px-2 py-1.5 border border-slate-300 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs" value={adminFormData.email} onChange={e => setAdminFormData({ ...adminFormData, email: e.target.value })} placeholder="Email" />
                                                                                </td>
                                                                                <td className="px-4 py-2">
                                                                                    <input type="tel" className="w-full px-2 py-1.5 border border-slate-300 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs" value={adminFormData.phone_no} onChange={e => setAdminFormData({ ...adminFormData, phone_no: e.target.value })} placeholder="Phone" />
                                                                                </td>
                                                                                <td className="px-4 py-2 flex gap-2">
                                                                                    <select className="px-2 py-1.5 border border-slate-300 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs appearance-none" value={adminFormData.is_active ? '1' : '0'} onChange={e => setAdminFormData({ ...adminFormData, is_active: e.target.value === '1' })}>
                                                                                        <option value="1">Active</option>
                                                                                        <option value="0">Disabled</option>
                                                                                    </select>
                                                                                    <input type="text" className="w-24 px-2 py-1.5 border border-slate-300 dark:border-github-dark-border rounded bg-white dark:bg-github-dark-subtle text-xs" value={adminFormData.password} onChange={e => setAdminFormData({ ...adminFormData, password: e.target.value })} placeholder="New Pwd?" />
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

            {/* Delete Confirmation Modal */}
            {deleteConfirmOrg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl border border-slate-200 dark:border-github-dark-border w-full max-w-md mx-4 overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-github-dark-border flex items-center gap-3">
                            <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                <Trash2 size={20} className="text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-github-dark-text">Schedule Organization Deletion</h3>
                                <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-0.5">This action marks the organization for permanent removal</p>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-5 space-y-4">
                            <p className="text-sm text-slate-700 dark:text-github-dark-text">
                                You are about to schedule <strong className="text-slate-900 dark:text-white">{deleteConfirmOrg.org_name}</strong> (<span className="font-mono">{deleteConfirmOrg.org_code}</span>) for deletion.
                            </p>
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-3 space-y-1.5">
                                <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide flex items-center gap-1.5"><AlertTriangle size={12} /> What will be deleted after ~75 days:</p>
                                <ul className="text-xs text-red-700 dark:text-red-400 list-disc list-inside space-y-0.5">
                                    <li>All user accounts in this organization</li>
                                    <li>All attendance records</li>
                                    <li>All session tokens and auth data</li>
                                    <li>The organization record itself</li>
                                </ul>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-github-dark-muted">
                                You can cancel this deletion at any time before the scheduled date using the <strong>Cancel Deletion</strong> button.
                            </p>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-github-dark-subtle/30 border-t border-slate-100 dark:border-github-dark-border flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmOrg(null)}
                                disabled={deleteLoading}
                                className="px-4 py-2 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteOrg}
                                disabled={deleteLoading}
                                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
                            >
                                {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Yes, Schedule Deletion
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default OrganizationList;
