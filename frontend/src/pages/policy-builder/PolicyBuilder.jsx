import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import {
    Save, Play, Plus, X, Settings, Clock, MapPin, Calendar, AlertTriangle,
    CheckCircle, Trash2, Move, FileText, Zap, Briefcase, Edit2, Layers,
    Search, Users, Check, ArrowRight
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const PolicyBuilder = () => {
    const location = useLocation();
    const { avatarTimestamp } = useAuth();
    const [activeTab, setActiveTab] = useState('shifts');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'shifts') setActiveTab('shifts');
        else if (tab === 'automation') setActiveTab('automation');
    }, [location.search]);

    // ── AUTOMATION STATE (kept for future) ──────────────────────────────────
    const [blocks, setBlocks] = useState([
        { id: 1, type: 'trigger', title: 'On Clock In', icon: Clock, x: 50, y: 50, properties: {} },
        { id: 2, type: 'condition', title: 'Is Late? (>15m)', icon: AlertTriangle, x: 50, y: 180, properties: { threshold: 15 } },
        { id: 3, type: 'action', title: 'Mark as "Late"', icon: FileText, x: 50, y: 310, properties: { status: 'Late' } },
    ]);
    const [connections] = useState([{ from: 1, to: 2 }, { from: 2, to: 3 }]);
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [isTestMode, setIsTestMode] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const blockTypes = [
        { type: 'condition', title: 'Location Check', icon: MapPin },
        { type: 'condition', title: 'Time Check', icon: Clock },
        { type: 'condition', title: 'Date Check', icon: Calendar },
        { type: 'action', title: 'Mark Status', icon: FileText },
        { type: 'action', title: 'Send Alert', icon: Zap },
        { type: 'action', title: 'Deduct Pay', icon: AlertTriangle },
    ];
    const deleteBlock = (id) => { setBlocks(blocks.filter(b => b.id !== id)); if (selectedBlock === id) setSelectedBlock(null); };
    const addBlock = (t) => { const b = { id: Date.now(), ...t, x: 300, y: 100 + blocks.length * 20, properties: {} }; setBlocks([...blocks, b]); setSelectedBlock(b.id); };
    const runTest = () => { setTestResult(null); setTimeout(() => setTestResult({ status: 'success', message: 'Policy Executed: User marked as "Late". Alert sent.' }), 800); };

    // ── SHIFT STATE ─────────────────────────────────────────────────────────
    const [shifts, setShifts] = useState([]);
    const [selectedShift, setSelectedShift] = useState(null);
    const [isLoadingShifts, setIsLoadingShifts] = useState(false);
    const [shiftSearch, setShiftSearch] = useState('');

    const [showShiftForm, setShowShiftForm] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [isOtEnabled, setIsOtEnabled] = useState(false);
    const [shiftForm, setShiftForm] = useState({
        name: '', start: '09:00', end: '18:00', grace: 0,
        otThreshold: 9.0, reqEntrySelfie: true, reqEntryGeofence: true,
        reqExitSelfie: false, reqExitGeofence: false
    });

    // ── USER STATE ───────────────────────────────────────────────────────────
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userSearch, setUserSearch] = useState('');

    // ── HELPERS ─────────────────────────────────────────────────────────────
    const calculateDuration = (start, end) => {
        if (!start || !end) return '0h 00m';
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        let d = (eh * 60 + em) - (sh * 60 + sm);
        if (d < 0) d += 24 * 60;
        return `${Math.floor(d / 60)}h ${String(d % 60).padStart(2, '0')}m`;
    };

    const shiftColors = ['indigo', 'violet', 'sky', 'teal', 'amber', 'rose'];
    const getShiftColor = (idx) => shiftColors[idx % shiftColors.length];

    // ── LOAD DATA ────────────────────────────────────────────────────────────
    const loadShifts = useCallback(async () => {
        setIsLoadingShifts(true);
        try {
            const res = await adminService.getShifts();
            if (res.shifts) {
                const mapped = res.shifts.map((s, idx) => ({
                    id: s.shift_id, name: s.shift_name,
                    start: (s.start_time || '09:00').substring(0, 5),
                    end: (s.end_time || '18:00').substring(0, 5),
                    grace: s.grace_period_mins,
                    overtime: !!s.is_overtime_enabled,
                    otThreshold: parseFloat(s.overtime_threshold_hours),
                    policy_rules: s.policy_rules || {},
                    color: getShiftColor(idx)
                }));
                setShifts(mapped);
                if (!selectedShift) setSelectedShift(mapped[0] || null);
                else setSelectedShift(prev => mapped.find(s => s.id === prev?.id) || mapped[0] || null);
            }
        } catch (e) { console.error(e); toast.error('Failed to load shifts'); }
        finally { setIsLoadingShifts(false); }
    }, []);

    const loadUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const res = await adminService.getShiftUsers();
            if (res.ok) setUsers(res.users);
        } catch (e) { console.error(e); toast.error('Failed to load users'); }
        finally { setLoadingUsers(false); }
    }, []);

    useEffect(() => {
        if (activeTab === 'shifts') {
            loadShifts();
            loadUsers();
        }
    }, [activeTab]);

    // Auto-calc OT threshold
    useEffect(() => {
        if (!showShiftForm) return;
        if (editingShift && editingShift.start?.substring(0, 5) === shiftForm.start?.substring(0, 5) && editingShift.end?.substring(0, 5) === shiftForm.end?.substring(0, 5)) return;
        const { start, end } = shiftForm;
        if (!start || !end) return;
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        let d = (eh * 60 + em) - (sh * 60 + sm);
        if (d < 0) d += 24 * 60;
        const h = parseFloat((d / 60).toFixed(2));
        setShiftForm(prev => prev.otThreshold === h ? prev : { ...prev, otThreshold: h });
    }, [shiftForm.start, shiftForm.end, showShiftForm]);

    // Populate form when editing
    useEffect(() => {
        if (showShiftForm && editingShift) {
            const rules = editingShift.policy_rules || {};
            setShiftForm({
                name: editingShift.name, start: editingShift.start, end: editingShift.end,
                grace: editingShift.grace, otThreshold: editingShift.otThreshold || 8.0,
                reqEntrySelfie: !!rules.entry_requirements?.selfie,
                reqEntryGeofence: !!rules.entry_requirements?.geofence,
                reqExitSelfie: !!rules.exit_requirements?.selfie,
                reqExitGeofence: !!rules.exit_requirements?.geofence,
            });
            setIsOtEnabled(!!editingShift.overtime);
        } else if (showShiftForm && !editingShift) {
            setShiftForm({ name: '', start: '09:00', end: '18:00', grace: 0, otThreshold: 9.0, reqEntrySelfie: true, reqEntryGeofence: true, reqExitSelfie: false, reqExitGeofence: false });
            setIsOtEnabled(false);
        }
    }, [showShiftForm, editingShift]);

    // ── HANDLERS ─────────────────────────────────────────────────────────────
    const handleSaveShift = async (e) => {
        e.preventDefault();
        const baseRules = editingShift ? (editingShift.policy_rules || {}) : {};
        const policies = {
            ...baseRules,
            shift_timing: { start_time: shiftForm.start, end_time: shiftForm.end },
            grace_period: { minutes: parseInt(shiftForm.grace) || 0 },
            overtime: { enabled: isOtEnabled, threshold: parseFloat(shiftForm.otThreshold) || 0 },
            entry_requirements: { selfie: shiftForm.reqEntrySelfie, geofence: shiftForm.reqEntryGeofence },
            exit_requirements: { selfie: shiftForm.reqExitSelfie, geofence: shiftForm.reqExitGeofence }
        };
        try {
            if (editingShift) {
                await adminService.updateShift(editingShift.id, { shift_name: shiftForm.name, policy_rules: policies });
                toast.success('Shift updated');
            } else {
                await adminService.createShift({ shift_name: shiftForm.name, policy_rules: policies });
                toast.success('Shift created');
            }
            setShowShiftForm(false); setEditingShift(null);
            loadShifts();
        } catch (err) { toast.error(err.message || 'Failed to save shift'); }
    };

    const handleDeleteShift = async (id) => {
        if (!window.confirm('Are you sure you want to delete this shift?')) return;
        try {
            await adminService.deleteShift(id);
            toast.success('Shift deleted');
            if (selectedShift?.id === id) setSelectedShift(null);
            loadShifts();
        } catch (err) { toast.error(err.message || 'Failed to delete shift'); }
    };

    const handleToggleUserShift = async (userId, isAssigned) => {
        if (!selectedShift) return;
        const newShiftId = isAssigned ? null : selectedShift.id;
        // Optimistic update
        setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, shift_id: newShiftId } : u));
        try {
            await adminService.assignUserShift(userId, newShiftId);
        } catch (err) {
            toast.error(err.message || 'Failed to update assignment');
            loadUsers(); // rollback
        }
    };

    const filteredShifts = shifts.filter(s => s.name.toLowerCase().includes(shiftSearch.toLowerCase()));
    const filteredUsers = users.filter(u =>
        u.user_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.desg_name?.toLowerCase().includes(userSearch.toLowerCase())
    );

    const Toggle = ({ label, subLabel, checked, onChange }) => (
        <div className="flex items-center justify-between py-2">
            <div>
                <p className="text-sm font-medium text-slate-800 dark:text-white">{label}</p>
                {subLabel && <p className="text-[11px] text-slate-500">{subLabel}</p>}
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
        </div>
    );

    const Checkbox = ({ label, checked, onChange }) => (
        <label className="flex items-center gap-2.5 cursor-pointer py-1.5 group">
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'}`}
                onClick={onChange}>
                {checked && <Check size={10} className="text-white" strokeWidth={3} />}
            </div>
            <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
        </label>
    );

    return (
        <DashboardLayout title="Policy Engine">
            {/* ── Tab Navigation ── */}
            <div className="flex items-center gap-6 mb-5 border-b border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('shifts')}
                    className={`pb-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${activeTab === 'shifts' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                >
                    <Briefcase size={16} /> Shift Configuration
                    {activeTab === 'shifts' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full" />}
                </button>
                {/* Disabled Automation Tab */}
                <div className="relative group">
                    <button
                        className="pb-3 text-sm font-medium flex items-center gap-2 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                        disabled
                    >
                        <Zap size={16} /> Automation Rules
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 ml-1">Soon</span>
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50">
                        Not available yet — coming soon
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                    </div>
                </div>
            </div>

            {/* ── SHIFTS TAB — 3-Panel Layout ── */}
            {activeTab === 'shifts' && (
                <div className="flex h-[calc(100vh-185px)] gap-5 animate-in fade-in duration-300">

                    {/* LEFT: Shift List */}
                    <div className="w-80 flex-shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-slate-800 dark:text-white">Shifts</h3>
                                <button
                                    onClick={() => { setEditingShift(null); setShowShiftForm(true); }}
                                    className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                    title="Create new shift"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search shifts..."
                                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-white"
                                    value={shiftSearch}
                                    onChange={e => setShiftSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                            {isLoadingShifts && (
                                <div className="py-10 text-center text-slate-400 text-sm">Loading shifts...</div>
                            )}
                            {!isLoadingShifts && filteredShifts.length === 0 && (
                                <div className="py-10 text-center space-y-2">
                                    <Briefcase size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                                    <p className="text-sm text-slate-400">No shifts found</p>
                                    <button
                                        onClick={() => { setEditingShift(null); setShowShiftForm(true); }}
                                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                    >+ Create first shift</button>
                                </div>
                            )}
                            {filteredShifts.map(shift => (
                                <div
                                    key={shift.id}
                                    onClick={() => { setSelectedShift(shift); setShowShiftForm(false); }}
                                    className={`p-3 rounded-lg border transition-all cursor-pointer group ${selectedShift?.id === shift.id
                                        ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/50 shadow-sm'
                                        : 'bg-white dark:bg-dark-card border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full bg-${shift.color}-500`} />
                                            <h4 className={`font-semibold text-sm ${selectedShift?.id === shift.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                                {shift.name}
                                            </h4>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-2">
                                        {shift.start} → {shift.end}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                                        <span className="flex items-center gap-1"><Clock size={10} />{calculateDuration(shift.start, shift.end)}</span>
                                        <span className="flex items-center gap-1"><Users size={10} />{users.filter(u => u.shift_id === shift.id).length} Staff</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CENTER: Shift Details / Edit Form */}
                    <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                        {!selectedShift && !showShiftForm ? (
                            <div className="flex-1 flex items-center justify-center flex-col gap-4 text-slate-400">
                                <Briefcase size={48} className="opacity-20" />
                                <p className="text-sm">Select a shift to view details</p>
                                <button
                                    onClick={() => { setEditingShift(null); setShowShiftForm(true); }}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                                >
                                    <Plus size={16} /> New Shift
                                </button>
                            </div>
                        ) : showShiftForm ? (
                            /* ── Shift Form ── */
                            <>
                                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                                    <h3 className="font-semibold text-slate-800 dark:text-white">
                                        {editingShift ? 'Edit Shift' : 'Create New Shift'}
                                    </h3>
                                    <button onClick={() => { setShowShiftForm(false); setEditingShift(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded">
                                        <X size={20} />
                                    </button>
                                </div>
                                <form onSubmit={handleSaveShift} className="flex-1 overflow-y-auto p-5 space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Shift Name</label>
                                        <input
                                            type="text" required value={shiftForm.name}
                                            onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })}
                                            placeholder="e.g. Morning Shift A"
                                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-white"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Start Time</label>
                                            <input type="time" required value={shiftForm.start}
                                                onChange={e => setShiftForm({ ...shiftForm, start: e.target.value })}
                                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">End Time</label>
                                            <input type="time" required value={shiftForm.end}
                                                onChange={e => setShiftForm({ ...shiftForm, end: e.target.value })}
                                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Grace Period</label>
                                        <div className="relative">
                                            <input type="number" required min="0" value={shiftForm.grace}
                                                onChange={e => setShiftForm({ ...shiftForm, grace: e.target.value })}
                                                className="w-full pl-3 pr-14 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">minutes</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1">Time allowed after shift start before marking as "Late".</p>
                                    </div>

                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 divide-y divide-slate-100 dark:divide-slate-700/50">
                                        <Toggle
                                            label="Overtime Calculation" subLabel="Enable automatic OT tracking"
                                            checked={isOtEnabled} onChange={e => setIsOtEnabled(e.target.checked)}
                                        />
                                        {isOtEnabled && (
                                            <div className="pt-3">
                                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Minimum Hours for OT</label>
                                                <div className="relative">
                                                    <input type="number" step="0.1" value={shiftForm.otThreshold}
                                                        onChange={e => setShiftForm({ ...shiftForm, otThreshold: e.target.value })}
                                                        className="w-full pl-3 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">hr</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                        <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                                            <MapPin size={15} className="text-slate-400" /> Attendance Validation
                                        </h4>
                                        <div className="grid grid-cols-2 gap-x-6">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Check-In</p>
                                                <Checkbox label="GPS Required" checked={shiftForm.reqEntryGeofence} onChange={() => setShiftForm(p => ({ ...p, reqEntryGeofence: !p.reqEntryGeofence }))} />
                                                <Checkbox label="Selfie Required" checked={shiftForm.reqEntrySelfie} onChange={() => setShiftForm(p => ({ ...p, reqEntrySelfie: !p.reqEntrySelfie }))} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Check-Out</p>
                                                <Checkbox label="GPS Required" checked={shiftForm.reqExitGeofence} onChange={() => setShiftForm(p => ({ ...p, reqExitGeofence: !p.reqExitGeofence }))} />
                                                <Checkbox label="Selfie Required" checked={shiftForm.reqExitSelfie} onChange={() => setShiftForm(p => ({ ...p, reqExitSelfie: !p.reqExitSelfie }))} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={() => { setShowShiftForm(false); setEditingShift(null); }}
                                            className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                            Cancel
                                        </button>
                                        <button type="submit"
                                            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors flex items-center justify-center gap-2">
                                            <Save size={15} /> Save Shift
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            /* ── Shift Detail View ── */
                            <>
                                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl bg-${selectedShift.color}-100 dark:bg-${selectedShift.color}-900/30 text-${selectedShift.color}-600 dark:text-${selectedShift.color}-400`}>
                                            <Clock size={20} />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-lg text-slate-900 dark:text-white">{selectedShift.name}</h2>
                                            <p className="text-xs text-slate-500 font-mono">{selectedShift.start} → {selectedShift.end} • {calculateDuration(selectedShift.start, selectedShift.end)}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setEditingShift(selectedShift); setShowShiftForm(true); }}
                                            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
                                        ><Edit2 size={15} /> Edit</button>
                                        <button
                                            onClick={() => handleDeleteShift(selectedShift.id)}
                                            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
                                        ><Trash2 size={15} /> Delete</button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-3 gap-4">
                                        {[
                                            { label: 'Start Time', value: selectedShift.start, icon: <ArrowRight size={14} className="text-indigo-500" />, bg: 'indigo' },
                                            { label: 'Grace Period', value: `${selectedShift.grace || 0} min`, icon: <AlertTriangle size={14} className="text-amber-500" />, bg: 'amber' },
                                            { label: 'Duration', value: calculateDuration(selectedShift.start, selectedShift.end), icon: <Clock size={14} className="text-teal-500" />, bg: 'teal' },
                                        ].map(card => (
                                            <div key={card.label} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-xl p-4">
                                                <div className="flex items-center gap-1.5 mb-1">{card.icon}<p className="text-xs text-slate-500">{card.label}</p></div>
                                                <p className="text-base font-bold text-slate-800 dark:text-white font-mono">{card.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Policy Rules */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
                                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                            <Settings size={15} className="text-slate-400" /> Attendance Policies
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Check-In Requirements</p>
                                                {[
                                                    { label: 'GPS Required', val: selectedShift.policy_rules?.entry_requirements?.geofence },
                                                    { label: 'Selfie Required', val: selectedShift.policy_rules?.entry_requirements?.selfie },
                                                ].map(r => (
                                                    <div key={r.label} className="flex items-center gap-2 py-1">
                                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${r.val ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                                            {r.val ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                                                        </div>
                                                        <span className="text-sm text-slate-600 dark:text-slate-400">{r.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Check-Out Requirements</p>
                                                {[
                                                    { label: 'GPS Required', val: selectedShift.policy_rules?.exit_requirements?.geofence },
                                                    { label: 'Selfie Required', val: selectedShift.policy_rules?.exit_requirements?.selfie },
                                                ].map(r => (
                                                    <div key={r.label} className="flex items-center gap-2 py-1">
                                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${r.val ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                                            {r.val ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                                                        </div>
                                                        <span className="text-sm text-slate-600 dark:text-slate-400">{r.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {selectedShift.overtime && (
                                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700/50 flex items-center gap-2">
                                                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600"><Zap size={13} /></div>
                                                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Overtime enabled after {selectedShift.otThreshold}h</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* RIGHT: User Assignment */}
                    <div className="w-80 flex-shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                            <div className="flex items-center gap-2">
                                <Users size={16} className="text-slate-500" />
                                <h3 className="font-semibold text-slate-800 dark:text-white">Assigned Staff</h3>
                                {selectedShift && (
                                    <span className="ml-auto text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                        {users.filter(u => u.shift_id === selectedShift.id).length}
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text" placeholder="Search staff..."
                                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-white"
                                    value={userSearch}
                                    onChange={e => setUserSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                            {loadingUsers && <p className="text-sm text-slate-400 px-3 py-4 text-center">Loading users...</p>}
                            {!loadingUsers && filteredUsers.map(user => {
                                const isAssigned = selectedShift && user.shift_id === selectedShift.id;
                                const hasOtherShift = user.shift_id && (!selectedShift || user.shift_id !== selectedShift.id);
                                const otherShift = hasOtherShift ? shifts.find(s => s.id === user.shift_id) : null;
                                return (
                                    <div key={user.user_id} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors group">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-400 overflow-hidden flex-shrink-0">
                                                {user.profile_image_url ? (
                                                    <img src={`${user.profile_image_url}?t=${avatarTimestamp}`} alt={user.user_name} className="w-full h-full object-cover" />
                                                ) : user.user_name?.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{user.user_name}</p>
                                                <p className="text-[11px] text-slate-400 truncate">
                                                    {otherShift ? <span className="text-amber-500">{otherShift.name}</span> : user.desg_name}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => selectedShift && handleToggleUserShift(user.user_id, isAssigned)}
                                            disabled={!selectedShift}
                                            title={!selectedShift ? 'Select a shift first' : isAssigned ? 'Remove from shift' : 'Assign to shift'}
                                            className={`p-1.5 rounded-md transition-all flex-shrink-0 ${!selectedShift ? 'cursor-not-allowed opacity-30' : isAssigned
                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                                                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600'
                                                }`}
                                        >
                                            {isAssigned ? <Check size={16} /> : <Plus size={16} />}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── AUTOMATION TAB (disabled / future) ── */}
            {activeTab === 'automation' && (
                <div className="h-[calc(100vh-220px)] flex gap-6 animate-in fade-in duration-300 relative">
                    <div className="absolute inset-0 z-20 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <div className="text-center space-y-3">
                            <Zap size={40} className="mx-auto text-slate-300 dark:text-slate-600" />
                            <h3 className="font-semibold text-slate-600 dark:text-slate-400">Automation Rules — Coming Soon</h3>
                            <p className="text-sm text-slate-400">This feature is not yet integrated.</p>
                        </div>
                    </div>
                    {/* Ghost content behind blur */}
                    <div className="w-64 flex-shrink-0 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700 pointer-events-none" />
                    <div className="flex-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 pointer-events-none" />
                    <div className="w-80 flex-shrink-0 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700 pointer-events-none" />
                </div>
            )}
        </DashboardLayout>
    );
};

export default PolicyBuilder;
