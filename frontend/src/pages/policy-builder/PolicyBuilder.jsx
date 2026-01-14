import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import {
    Save,
    Play,
    Plus,
    X,
    Settings,
    Clock,
    MapPin,
    Calendar,
    AlertTriangle,
    CheckCircle,
    ArrowRight,
    Trash2,
    Move,
    FileText,
    Zap,
    Briefcase,
    Edit2,
    Layers
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';

const PolicyBuilder = () => {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('shifts'); // 'automation' | 'shifts'

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'shifts') {
            setActiveTab('shifts');
        } else if (tab === 'automation') {
            setActiveTab('automation');
        }
    }, [location.search]);

    // --- AUTOMATION / CANVAS STATE ---
    const [blocks, setBlocks] = useState([
        { id: 1, type: 'trigger', title: 'On Clock In', icon: Clock, x: 50, y: 50, properties: {} },
        { id: 2, type: 'condition', title: 'Is Late? (>15m)', icon: AlertTriangle, x: 50, y: 180, properties: { threshold: 15 } },
        { id: 3, type: 'action', title: 'Mark as "Late"', icon: FileText, x: 50, y: 310, properties: { status: 'Late' } },
    ]);
    const [connections, setConnections] = useState([
        { from: 1, to: 2 },
        { from: 2, to: 3 },
    ]);
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

    // --- SHIFT MANAGEMENT STATE ---
    const [shifts, setShifts] = useState([]);
    const [isLoadingShifts, setIsLoadingShifts] = useState(false);
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState(null); // null for new, object for edit
    const [isOtEnabled, setIsOtEnabled] = useState(false);
    const [shiftForm, setShiftForm] = useState({
        name: '',
        start: '09:00',
        end: '18:00',
        grace: 0,
        otThreshold: 9.0,
        reqEntrySelfie: true,
        reqEntryGeofence: true,
        reqExitSelfie: false,
        reqExitGeofence: false
    });

    useEffect(() => {
        if (isShiftModalOpen) {
            if (editingShift) {
                const rules = editingShift.policy_rules || {};
                setShiftForm({
                    name: editingShift.name,
                    start: editingShift.start,
                    end: editingShift.end,
                    grace: editingShift.grace,
                    otThreshold: editingShift.otThreshold || 8.0,
                    reqEntrySelfie: !!rules.entry_requirements?.selfie,
                    reqEntryGeofence: !!rules.entry_requirements?.geofence,
                    reqExitSelfie: !!rules.exit_requirements?.selfie,
                    reqExitGeofence: !!rules.exit_requirements?.geofence
                });
                setIsOtEnabled(!!editingShift.overtime);
            } else {
                setShiftForm({
                    name: '',
                    start: '09:00',
                    end: '18:00',
                    grace: 0,
                    otThreshold: 9.0,
                    reqEntrySelfie: true,
                    reqEntryGeofence: true,
                    reqExitSelfie: false,
                    reqExitGeofence: false
                });
                setIsOtEnabled(false);
            }
        }
    }, [isShiftModalOpen, editingShift]);

    // Auto-calculate OT Threshold based on duration
    useEffect(() => {
        if (!isShiftModalOpen) return;

        // Prevent overwriting DB value on initial Edit load
        // Prevent overwriting DB value on initial Edit load
        // Compare first 5 chars (HH:mm) to handle potential HH:mm:ss vs HH:mm differences
        if (editingShift && editingShift.start && editingShift.end &&
            shiftForm.start.substring(0, 5) === editingShift.start.substring(0, 5) &&
            shiftForm.end.substring(0, 5) === editingShift.end.substring(0, 5)) {
            return;
        }

        const { start, end } = shiftForm;
        if (!start || !end) return;

        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);

        let diffM = (endH * 60 + endM) - (startH * 60 + startM);
        if (diffM < 0) diffM += 24 * 60;

        // Calculate Float hours for duration (e.g., 8.5)
        const durationH = diffM / 60;

        // Use a fixed precision if needed, e.g. 1 decimal place
        const durationFloat = parseFloat(durationH.toFixed(2));

        setShiftForm(prev => {
            // Avoid infinite loop if value is already same (compare loosely or with epsilon if needed)
            if (prev.otThreshold === durationFloat) return prev;
            return { ...prev, otThreshold: durationFloat };
        });

    }, [shiftForm.start, shiftForm.end, isShiftModalOpen]);

    // Fetch Shifts
    useEffect(() => {
        if (activeTab === 'shifts') {
            loadShifts();
        }
    }, [activeTab]);

    const loadShifts = async () => {
        setIsLoadingShifts(true);
        try {
            const res = await adminService.getShifts();
            
            if (res.shifts) {
                // Map backend fields to frontend UI expected fields
                const mapped = res.shifts.map(s => ({
                    id: s.shift_id,
                    name: s.shift_name,
                    start: (s.start_time || "09:00").substring(0, 5),
                    end: (s.end_time || "18:00").substring(0, 5),
                    grace: s.grace_period_mins,
                    overtime: !!s.is_overtime_enabled,
                    otThreshold: parseFloat(s.overtime_threshold_hours),
                    policy_rules: typeof s.policy_rules === 'string' ? JSON.parse(s.policy_rules) : (s.policy_rules || {}),
                    color: 'blue' 
                }));
                setShifts(mapped);
            } else {
                console.warn("API returned no shifts array:", res);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load shifts");
        } finally {
            setIsLoadingShifts(false);
        }
    };

    // --- AUTOMATION HANDLERS ---
    const addBlock = (typeTemplate) => {
        const newBlock = {
            id: Date.now(),
            type: typeTemplate.type,
            title: typeTemplate.title,
            icon: typeTemplate.icon,
            x: 300,
            y: 100 + (blocks.length * 20),
            properties: {}
        };
        setBlocks([...blocks, newBlock]);
        setSelectedBlock(newBlock.id);
    };

    const deleteBlock = (id) => {
        setBlocks(blocks.filter(b => b.id !== id));
        setConnections(connections.filter(c => c.from !== id && c.to !== id));
        if (selectedBlock === id) setSelectedBlock(null);
    };

    const runTest = () => {
        setTestResult(null);
        setTimeout(() => {
            setTestResult({
                status: 'success',
                message: 'Policy Executed Successfully: User marked as "Late". Alert sent to Manager.'
            });
        }, 800);
    };

    // Helper: Convert float hours (e.g. 8.5) to "HH:MM" ("08:30")
    const floatToTime = (val) => {
        if (!val && val !== 0) return "00:00";
        const hours = Math.floor(val);
        const minutes = Math.round((val - hours) * 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    // Helper: Convert "HH:MM" ("08:30") to float hours (8.5)
    const timeToFloat = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h + (m / 60);
    };

    const handleSaveShift = async (e) => {
        e.preventDefault();
        
        // Preserve existing rules structure (accuracy etc) if editing
        let baseRules = editingShift ? (editingShift.policy_rules || {}) : {};

        const policies = {
            ...baseRules,
            // Ensure core fields are synced
            shift_timing: { start_time: shiftForm.start, end_time: shiftForm.end },
            grace_period: { minutes: parseInt(shiftForm.grace) || 0 },
            overtime: { enabled: isOtEnabled, threshold: parseFloat(shiftForm.otThreshold) || 0 },
            entry_requirements: {
                selfie: shiftForm.reqEntrySelfie,
                geofence: shiftForm.reqEntryGeofence
            },
            exit_requirements: {
                selfie: shiftForm.reqExitSelfie,
                geofence: shiftForm.reqExitGeofence
            }
        };

        const shiftData = {
            shift_name: shiftForm.name,
            policy_rules: policies
        };

        try {
            if (editingShift) {
                await adminService.updateShift(editingShift.id, shiftData);
                toast.success("Shift updated successfully");
            } else {
                await adminService.createShift(shiftData);
                toast.success("Shift created successfully");
            }
            setIsShiftModalOpen(false);
            setEditingShift(null);
            loadShifts(); // Reload data
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to save shift");
        }
    };

    const handleDeleteShift = async (id) => {
        if (!window.confirm("Are you sure you want to delete this shift?")) return;
        try {
            await adminService.deleteShift(id);
            toast.success("Shift deleted successfully");
            loadShifts();
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to delete shift");
        }
    };

    const openEditShift = (shift) => {
        setEditingShift(shift);
        setIsShiftModalOpen(true);
    }


    const calculateDuration = (start, end) => {
        if (!start || !end) return "0h 00m";
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);

        let diffM = (endH * 60 + endM) - (startH * 60 + startM);
        if (diffM < 0) diffM += 24 * 60; // Handle overnight shifts

        const hours = Math.floor(diffM / 60);
        const minutes = diffM % 60;
        return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    };

    return (
        <DashboardLayout title="Policy Engine">
            {/* Tab Navigation */}
            <div className="flex items-center gap-6 mb-6 border-b border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('shifts')}
                    className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'shifts'
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Briefcase size={18} />
                        Shift Configuration
                    </div>
                    {activeTab === 'shifts' && (
                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('automation')}
                    className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'automation'
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Zap size={18} />
                        Automation Rules
                    </div>
                    {activeTab === 'automation' && (
                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></span>
                    )}
                </button>
            </div>


            {/* ==================== AUTOMATION TAB ==================== */}
            {activeTab === 'automation' && (
                <div className="h-[calc(100vh-220px)] flex gap-6 animate-in fade-in duration-300">
                    {/* Left: Toolbox */}
                    <div className="w-64 flex-shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                <Plus size={18} /> Toolbox
                            </h3>
                        </div>
                        <div className="p-4 space-y-6 overflow-y-auto flex-1">
                            <div>
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Conditions</h4>
                                <div className="space-y-2">
                                    {blockTypes.filter(b => b.type === 'condition').map((block, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => addBlock(block)}
                                            className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer transition-colors group"
                                        >
                                            <div className="text-amber-500 dark:text-amber-400">
                                                <block.icon size={18} />
                                            </div>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{block.title}</span>
                                            <Plus size={14} className="ml-auto opacity-0 group-hover:opacity-100 text-slate-400" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Actions</h4>
                                <div className="space-y-2">
                                    {blockTypes.filter(b => b.type === 'action').map((block, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => addBlock(block)}
                                            className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer transition-colors group"
                                        >
                                            <div className="text-indigo-500 dark:text-indigo-400">
                                                <block.icon size={18} />
                                            </div>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{block.title}</span>
                                            <Plus size={14} className="ml-auto opacity-0 group-hover:opacity-100 text-slate-400" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Center: Canvas (Mock) */}
                    <div className="flex-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden flex flex-col">
                        <div className="h-14 bg-white dark:bg-dark-card border-b border-slate-200 dark:border-slate-700 px-4 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <h2 className="font-semibold text-slate-800 dark:text-white">Late Arrival Policy</h2>
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded uppercase">Active</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsTestMode(!isTestMode)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isTestMode ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                                >
                                    <Play size={16} /> {isTestMode ? 'Stop Test' : 'Test Policy'}
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-all active:scale-95">
                                    <Save size={16} /> Save
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 relative overflow-auto p-10 cursor-grab active:cursor-grabbing bg-dots-slate-200 dark:bg-dots-slate-700">
                            <div className="min-h-full min-w-full relative">
                                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
                                    <defs>
                                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                            <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" className="dark:fill-slate-600" />
                                        </marker>
                                    </defs>
                                    {connections.map((conn, idx) => {
                                        const fromBlock = blocks.find(b => b.id === conn.from);
                                        const toBlock = blocks.find(b => b.id === conn.to);
                                        if (!fromBlock || !toBlock) return null;

                                        return (
                                            <line
                                                key={idx}
                                                x1={fromBlock.x + 140} y1={fromBlock.y + 40}
                                                x2={toBlock.x + 140} y2={toBlock.y + 40}
                                                stroke="#cbd5e1"
                                                strokeWidth="2"
                                                strokeDasharray="5,5"
                                                markerEnd="url(#arrowhead)"
                                                className="dark:stroke-slate-600"
                                            />
                                        );
                                    })}
                                </svg>

                                <div className="relative z-10 w-full h-full">
                                    {blocks.map((block) => (
                                        <div
                                            key={block.id}
                                            onClick={(e) => { e.stopPropagation(); setSelectedBlock(block.id); }}
                                            style={{
                                                top: block.y,
                                                left: block.x
                                            }}
                                            className={`absolute w-72 bg-white dark:bg-dark-card rounded-xl border-2 shadow-sm transition-all cursor-pointer group ${selectedBlock === block.id
                                                ? 'border-indigo-500 ring-4 ring-indigo-500/10 z-20'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 z-10'
                                                }`}
                                        >
                                            <div className={`p-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-3 ${block.type === 'trigger' ? 'bg-indigo-50/50 dark:bg-indigo-900/10' :
                                                block.type === 'condition' ? 'bg-amber-50/50 dark:bg-amber-900/10' :
                                                    'bg-emerald-50/50 dark:bg-emerald-900/10'
                                                }`}>
                                                <div className={`p-2 rounded-lg ${block.type === 'trigger' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' :
                                                    block.type === 'condition' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                                                        'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                                    }`}>
                                                    <block.icon size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold uppercase text-slate-400">{block.type}</p>
                                                    <h4 className="font-semibold text-slate-800 dark:text-white">{block.title}</h4>
                                                </div>
                                                {selectedBlock === block.id && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                                                        className="ml-auto text-slate-400 hover:text-red-500 transition-colors p-1"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="p-4">
                                                {block.type === 'trigger' && <p className="text-sm text-slate-500">Starts when user checks in.</p>}
                                                {block.type === 'condition' && <p className="text-sm text-slate-500">Check if time &gt; 15 mins past shift start.</p>}
                                                {block.type === 'action' && <p className="text-sm text-slate-500">Set status to "Late".</p>}
                                            </div>
                                            {/* Connectors */}
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white dark:bg-dark-card border-2 border-slate-300 dark:border-slate-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                            </div>
                                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white dark:bg-dark-card border-2 border-slate-300 dark:border-slate-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Properties / Test Panel */}
                    <div className="w-80 flex-shrink-0 flex flex-col gap-6">
                        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex-1">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Settings size={18} /> {selectedBlock ? 'Block Properties' : 'Policy Settings'}
                                </h3>
                            </div>
                            <div className="p-5">
                                {selectedBlock ? (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30 mb-4">
                                            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Selected Block ID: {selectedBlock}</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Block Title</label>
                                            <input type="text" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200" defaultValue="Is Late?" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Threshold (mins)</label>
                                            <input type="number" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200" defaultValue="15" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-slate-400">
                                        <Move size={48} className="mx-auto mb-3 opacity-20" />
                                        <p className="text-sm">Select a block on the canvas to edit its properties.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isTestMode && (
                            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex-1 animate-in slide-in-from-right duration-300">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/10">
                                    <h3 className="font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                                        <Play size={18} /> Test & Simulation
                                    </h3>
                                </div>
                                <div className="p-5 space-y-4">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Simulate an attendance event to verify this policy.</p>
                                    <button
                                        onClick={runTest}
                                        className="w-full py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors"
                                    >
                                        Run Simulation
                                    </button>

                                    {testResult && (
                                        <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg animate-in fade-in zoom-in duration-200">
                                            <div className="flex gap-2">
                                                <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                                                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{testResult.message}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ==================== SHIFTS TAB ==================== */}
            {activeTab === 'shifts' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Header Actions */}
                    <div className="flex justify-between items-center bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <div>
                            <h2 className="font-semibold text-lg text-slate-800 dark:text-white">Active Shifts</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Manage work timings and grace periods</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingShift(null);
                                setIsShiftModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors"
                        >
                            <Plus size={16} />
                            Add Shift
                        </button>
                    </div>

                    {/* Loading State */}
                    {isLoadingShifts && (
                        <div className="p-12 text-center text-slate-400">
                            Loading shifts...
                        </div>
                    )}

                    {/* Shifts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {shifts.map((shift) => (
                            <div key={shift.id} className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow group">
                                <div className="p-5 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-lg bg-${shift.color}-100 dark:bg-${shift.color}-900/30 text-${shift.color}-600 dark:text-${shift.color}-400`}>
                                            <Clock size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800 dark:text-white">{shift.name}</h3>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEditShift(shift)}
                                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1"
                                            title="Edit Shift"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteShift(shift.id)}
                                            className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1"
                                            title="Delete Shift"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="p-5 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-500 dark:text-slate-400">Timing</span>
                                        <span className="text-sm font-semibold text-slate-800 dark:text-white font-mono">{shift.start} - {shift.end}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-500 dark:text-slate-400">Duration</span>
                                        <span className="text-sm font-semibold text-slate-800 dark:text-white">
                                            {calculateDuration(shift.start, shift.end)}
                                        </span>

                                    </div>
                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                            <AlertTriangle size={14} />
                                            <span className="text-xs font-medium">Grace Period</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-800 dark:text-white">{shift.grace} mins</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                            <Zap size={14} />
                                            <span className="text-xs font-medium">Overtime</span>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${shift.overtime ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                            {shift.overtime ? `On (> ${shift.otThreshold}h)` : 'Off'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add/Edit Modal */}
                    {isShiftModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <div className="bg-white dark:bg-dark-card rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-700">
                                    <h3 className="font-semibold text-lg text-slate-800 dark:text-white text-[16px]">
                                        {editingShift ? 'Edit Shift Configuration' : 'Create New Shift'}
                                    </h3>
                                    <button onClick={() => setIsShiftModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                        <X size={20} />
                                    </button>
                                </div>
                                <form onSubmit={handleSaveShift} className="p-5 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Shift Name</label>
                                        <input
                                            type="text"
                                            value={shiftForm.name}
                                            onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                                            required
                                            placeholder="e.g. Morning Shift A"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 dark:text-slate-200"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
                                            <input
                                                type="time"
                                                value={shiftForm.start}
                                                onChange={(e) => setShiftForm({ ...shiftForm, start: e.target.value })}
                                                required
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 dark:text-slate-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Time</label>
                                            <input
                                                type="time"
                                                value={shiftForm.end}
                                                onChange={(e) => setShiftForm({ ...shiftForm, end: e.target.value })}
                                                required
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 dark:text-slate-200"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Grace Period (Minutes)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={shiftForm.grace}
                                                onChange={(e) => setShiftForm({ ...shiftForm, grace: e.target.value })}
                                                required
                                                min="0"
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 dark:text-slate-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">mins</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1">Time allowed after start time before marking as "Late".</p>
                                    </div>

                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-medium text-slate-800 dark:text-white">Overtime Calculation</h4>
                                                <p className="text-[10px] text-slate-500">Enable automatic OT tracking</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={isOtEnabled}
                                                    onChange={(e) => setIsOtEnabled(e.target.checked)}
                                                />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                            </label>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Minimum Hours for OT</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={shiftForm.otThreshold}
                                                    onChange={(e) => setShiftForm({ ...shiftForm, otThreshold: e.target.value })}
                                                    disabled={!isOtEnabled}
                                                    className={`w-full pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 dark:text-slate-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${!isOtEnabled ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'bg-white dark:bg-slate-800'}`}
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Hr</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Attendance Requirements */}
                                    <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3">
                                        <h4 className="text-sm font-medium text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                                            <MapPin size={16} className="text-slate-400"/>
                                            Attendance Validation
                                        </h4>
                                        
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Check-In</p>
                                                <div className="space-y-2">
                                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 p-1 rounded -ml-1">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={shiftForm.reqEntryGeofence}
                                                            onChange={e => setShiftForm({...shiftForm, reqEntryGeofence: e.target.checked})}
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <span className="text-sm text-slate-700 dark:text-slate-300">GPS Required</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 p-1 rounded -ml-1">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={shiftForm.reqEntrySelfie}
                                                            onChange={e => setShiftForm({...shiftForm, reqEntrySelfie: e.target.checked})}
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <span className="text-sm text-slate-700 dark:text-slate-300">Selfie Required</span>
                                                    </label>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Check-Out</p>
                                                <div className="space-y-2">
                                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 p-1 rounded -ml-1">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={shiftForm.reqExitGeofence}
                                                            onChange={e => setShiftForm({...shiftForm, reqExitGeofence: e.target.checked})}
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <span className="text-sm text-slate-700 dark:text-slate-300">GPS Required</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 p-1 rounded -ml-1">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={shiftForm.reqExitSelfie}
                                                            onChange={e => setShiftForm({...shiftForm, reqExitSelfie: e.target.checked})}
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <span className="text-sm text-slate-700 dark:text-slate-300">Selfie Required</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsShiftModalOpen(false)}
                                            className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors"
                                        >
                                            Save Shift
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </DashboardLayout>
    );
};

export default PolicyBuilder;
