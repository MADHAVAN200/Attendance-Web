import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { 
    Plus, 
    Clock, 
    MoreVertical, 
    Zap, 
    AlertTriangle, 
    X,
    Sun,
    Moon,
    Hourglass,
    XCircle,
    CheckCircle2,
    Settings2,
    Calendar,
    ChevronRight
} from 'lucide-react';

const ShiftManagement = () => {
    // Mock Data based on screenshot
    const [shifts, setShifts] = useState([
        {
            id: 1,
            name: 'General Shift',
            type: 'Shift',
            startTime: '09:00',
            endTime: '18:00',
            gracePeriod: 5,
            overtime: false,
            color: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
            validation: {
                checkInGPS: true,
                checkInSelfie: true,
                checkOutGPS: false,
                checkOutSelfie: false
            }
        },
        {
            id: 2,
            name: 'Strict Morning',
            type: 'Shift',
            startTime: '06:00',
            endTime: '14:00',
            gracePeriod: 0,
            overtime: false,
            color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
            validation: {
                checkInGPS: true,
                checkInSelfie: true,
                checkOutGPS: true,
                checkOutSelfie: true
            }
        },
        {
            id: 3,
            name: 'Night Shiftsss',
            type: 'Shift',
            startTime: '18:00',
            endTime: '02:30',
            gracePeriod: 0,
            overtime: true,
            color: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
            validation: {
                checkInGPS: false,
                checkInSelfie: false,
                checkOutGPS: false,
                checkOutSelfie: false
            }
        }
    ]);

    // Modal States
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    // Create/Edit Shift Form State
    const [newShiftName, setNewShiftName] = useState('');
    const [newStartTime, setNewStartTime] = useState('09:00');
    const [newEndTime, setNewEndTime] = useState('18:00');
    const [newGracePeriod, setNewGracePeriod] = useState('0');
    const [newOvertime, setNewOvertime] = useState(false);
    const [newValCheckInGps, setNewValCheckInGps] = useState(true);
    const [newValCheckInSelfie, setNewValCheckInSelfie] = useState(true);
    const [newValCheckOutGps, setNewValCheckOutGps] = useState(false);
    const [newValCheckOutSelfie, setNewValCheckOutSelfie] = useState(false);

    const handleOpenViewModal = (shift) => {
        setSelectedShift(shift);
        setIsViewModalOpen(true);
    };

    const handleOpenAddModal = () => {
        setIsEditing(false);
        setNewShiftName('');
        setNewStartTime('09:00');
        setNewEndTime('18:00');
        setNewGracePeriod('0');
        setNewOvertime(false);
        setNewValCheckInGps(true);
        setNewValCheckInSelfie(true);
        setNewValCheckOutGps(false);
        setNewValCheckOutSelfie(false);
        setIsAddModalOpen(true);
    };

    const handleOpenEditModal = () => {
        if (!selectedShift) return;
        setIsEditing(true);
        setNewShiftName(selectedShift.name);
        setNewStartTime(selectedShift.startTime);
        setNewEndTime(selectedShift.endTime);
        setNewGracePeriod(selectedShift.gracePeriod.toString());
        setNewOvertime(selectedShift.overtime);
        setNewValCheckInGps(selectedShift.validation?.checkInGPS || false);
        setNewValCheckInSelfie(selectedShift.validation?.checkInSelfie || false);
        setNewValCheckOutGps(selectedShift.validation?.checkOutGPS || false);
        setNewValCheckOutSelfie(selectedShift.validation?.checkOutSelfie || false);
        
        setIsViewModalOpen(false);
        setIsAddModalOpen(true);
    };

    const handleSaveShift = () => {
        if (isEditing) {
            setShifts(prev => prev.map(s => s.id === selectedShift.id ? {
                ...s,
                name: newShiftName || 'Unnamed Shift',
                startTime: newStartTime,
                endTime: newEndTime,
                gracePeriod: parseInt(newGracePeriod) || 0,
                overtime: newOvertime,
                validation: {
                    checkInGPS: newValCheckInGps,
                    checkInSelfie: newValCheckInSelfie,
                    checkOutGPS: newValCheckOutGps,
                    checkOutSelfie: newValCheckOutSelfie
                }
            } : s));
        } else {
            const newShift = {
                id: Date.now(),
                name: newShiftName || 'Unnamed Shift',
                type: 'Shift',
                startTime: newStartTime,
                endTime: newEndTime,
                gracePeriod: parseInt(newGracePeriod) || 0,
                overtime: newOvertime,
                color: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
                validation: {
                    checkInGPS: newValCheckInGps,
                    checkInSelfie: newValCheckInSelfie,
                    checkOutGPS: newValCheckOutGps,
                    checkOutSelfie: newValCheckOutSelfie
                }
            };
            setShifts([newShift, ...shifts]);
        }
        
        setIsAddModalOpen(false);
        setIsEditing(false);
    };

    return (
        <MobileDashboardLayout title="Shift Management">
            <div className="px-2 pb-24 pt-2 space-y-4">
                {/* Header Stats / Info Card */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-github-dark-border flex justify-between items-center bg-gradient-to-br from-white to-slate-50/50 dark:from-dark-card dark:to-github-dark-subtle/30">
                    <div>
                        <h2 className="text-[15px] font-bold text-slate-800 dark:text-github-dark-text tracking-tight">Active Shifts</h2>
                        <p className="text-[11px] text-slate-500 dark:text-github-dark-muted font-medium mt-0.5">Total {shifts.length} configured shifts</p>
                    </div>
                    <button 
                        onClick={handleOpenAddModal}
                        className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 active:scale-90 transition-all"
                    >
                        <Plus size={22} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Shifts List - High Density Grid */}
                <div className="grid grid-cols-1 gap-3">
                    {shifts.map((shift) => (
                        <div 
                            key={shift.id} 
                            onClick={() => handleOpenViewModal(shift)}
                            className="group bg-white dark:bg-dark-card rounded-2xl p-3 shadow-sm border border-slate-100 dark:border-github-dark-border relative cursor-pointer active:scale-[0.98] transition-all overflow-hidden"
                        >
                            {/* Accent line */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${shift.color.split(' ')[2]} opacity-70`}></div>
                            
                            <div className="flex items-center gap-3">
                                {/* Icon/Avatar Area */}
                                <div className={`w-11 h-11 rounded-xl ${shift.color} flex items-center justify-center shrink-0 shadow-sm`}>
                                    <Clock size={20} strokeWidth={2.5} />
                                </div>

                                {/* Content Area */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-slate-800 dark:text-github-dark-text text-[14px] truncate tracking-tight">{shift.name}</h3>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-github-dark-subtle text-slate-500 dark:text-github-dark-muted border border-slate-200/50 dark:border-github-dark-border uppercase tracking-wider">{shift.type}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <div className="flex items-center gap-1">
                                            <Calendar size={10} className="text-slate-400" />
                                            <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text font-mono">{shift.startTime} - {shift.endTime}</span>
                                        </div>
                                        <div className="h-3 w-[1px] bg-slate-200 dark:bg-github-dark-border"></div>
                                        <div className="flex items-center gap-1">
                                            <AlertTriangle size={10} className="text-amber-500" />
                                            <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">{shift.gracePeriod}m</span>
                                        </div>
                                        {shift.overtime && (
                                            <>
                                                <div className="h-3 w-[1px] bg-slate-200 dark:bg-github-dark-border"></div>
                                                <div className="flex items-center gap-1">
                                                    <Zap size={10} className="text-indigo-500" />
                                                    <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-tighter">OT</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <ChevronRight size={18} className="text-slate-300 dark:text-github-dark-muted group-hover:text-indigo-500 transition-colors" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Sheet: View Shift Details */}
            {isViewModalOpen && selectedShift && createPortal(
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsViewModalOpen(false)}>
                    <div className="flex min-h-full items-end justify-center">
                        <div 
                            onClick={(e) => e.stopPropagation()}
                            className="relative bg-white dark:bg-dark-card w-full rounded-t-[2.5rem] shadow-2xl animate-in slide-in-from-bottom duration-500 border-t border-slate-200/50 dark:border-github-dark-border"
                        >
                            {/* Handle */}
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                            </div>

                            <div className="p-6 pt-2">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-2xl ${selectedShift.color} flex items-center justify-center shadow-lg shadow-indigo-500/10`}>
                                            <Clock size={24} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800 dark:text-github-dark-text tracking-tight leading-tight">{selectedShift.name}</h2>
                                            <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-[0.15em] mt-0.5">{selectedShift.type} Configuration</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={handleOpenEditModal}
                                            className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                                        >
                                            <Settings2 size={20} />
                                        </button>
                                        <button 
                                            onClick={() => setIsViewModalOpen(false)} 
                                            className="w-10 h-10 bg-slate-100 dark:bg-github-dark-subtle text-slate-500 dark:text-github-dark-muted rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    {/* Timing Section */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl p-4 border border-slate-100 dark:border-github-dark-border">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-1.5 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                                                    <Sun size={14} />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Starts</span>
                                            </div>
                                            <p className="text-xl font-black text-slate-800 dark:text-github-dark-text font-mono">{selectedShift.startTime}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl p-4 border border-slate-100 dark:border-github-dark-border">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                                    <Moon size={14} />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ends</span>
                                            </div>
                                            <p className="text-xl font-black text-slate-800 dark:text-github-dark-text font-mono">{selectedShift.endTime}</p>
                                        </div>
                                    </div>

                                    {/* Config Stats */}
                                    <div className="bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl p-4 border border-slate-100 dark:border-github-dark-border divide-y divide-slate-200/50 dark:divide-github-dark-border">
                                        <div className="flex justify-between items-center pb-3">
                                            <div className="flex items-center gap-2">
                                                <Hourglass size={16} className="text-slate-400" />
                                                <span className="text-sm font-semibold text-slate-600 dark:text-github-dark-muted">Grace Period</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-800 dark:text-github-dark-text bg-white dark:bg-github-dark-subtle px-3 py-1 rounded-full shadow-sm border border-slate-100 dark:border-github-dark-border">{selectedShift.gracePeriod} Minutes</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-3">
                                            <div className="flex items-center gap-2">
                                                <Zap size={16} className="text-indigo-500" />
                                                <span className="text-sm font-semibold text-slate-600 dark:text-github-dark-muted">Overtime Tracking</span>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${selectedShift.overtime ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-github-dark-muted'}`}>
                                                {selectedShift.overtime ? 'Active' : 'Off'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Validation Grid */}
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Validation Rules</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-bold text-slate-800 dark:text-github-dark-text">Check-In</p>
                                                <div className={`flex items-center gap-2 p-2 rounded-xl border ${selectedShift.validation?.checkInGPS ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/20' : 'bg-slate-50 border-slate-100 dark:bg-github-dark-subtle dark:border-github-dark-border opacity-60'}`}>
                                                    <CheckCircle2 size={14} className={selectedShift.validation?.checkInGPS ? 'text-emerald-500' : 'text-slate-300'} />
                                                    <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">GPS Req</span>
                                                </div>
                                                <div className={`flex items-center gap-2 p-2 rounded-xl border ${selectedShift.validation?.checkInSelfie ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/20' : 'bg-slate-50 border-slate-100 dark:bg-github-dark-subtle dark:border-github-dark-border opacity-60'}`}>
                                                    <CheckCircle2 size={14} className={selectedShift.validation?.checkInSelfie ? 'text-emerald-500' : 'text-slate-300'} />
                                                    <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">Selfie Req</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-bold text-slate-800 dark:text-github-dark-text">Check-Out</p>
                                                <div className={`flex items-center gap-2 p-2 rounded-xl border ${selectedShift.validation?.checkOutGPS ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/20' : 'bg-slate-50 border-slate-100 dark:bg-github-dark-subtle dark:border-github-dark-border opacity-60'}`}>
                                                    <CheckCircle2 size={14} className={selectedShift.validation?.checkOutGPS ? 'text-emerald-500' : 'text-slate-300'} />
                                                    <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">GPS Req</span>
                                                </div>
                                                <div className={`flex items-center gap-2 p-2 rounded-xl border ${selectedShift.validation?.checkOutSelfie ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/20' : 'bg-slate-50 border-slate-100 dark:bg-github-dark-subtle dark:border-github-dark-border opacity-60'}`}>
                                                    <CheckCircle2 size={14} className={selectedShift.validation?.checkOutSelfie ? 'text-emerald-500' : 'text-slate-300'} />
                                                    <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">Selfie Req</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                                    <button 
                                        onClick={() => setIsViewModalOpen(false)}
                                        className="w-full py-4 bg-slate-900 dark:bg-github-dark-subtle text-white dark:text-github-dark-text text-sm font-bold rounded-2xl shadow-xl active:scale-[0.98] transition-all"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Bottom Sheet: Create/Edit Shift */}
            {isAddModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsAddModalOpen(false)}>
                    <div className="flex min-h-full items-end justify-center">
                        <div 
                            onClick={(e) => e.stopPropagation()}
                            className="relative bg-white dark:bg-dark-card w-full rounded-t-[2.5rem] shadow-2xl animate-in slide-in-from-bottom duration-500 border-t border-slate-200/50 dark:border-github-dark-border max-h-[92vh] flex flex-col"
                        >
                            {/* Handle */}
                            <div className="flex justify-center pt-3 pb-2 shrink-0">
                                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 pt-2 pb-8">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800 dark:text-github-dark-text tracking-tight">{isEditing ? 'Edit Shift' : 'Create Shift'}</h2>
                                        <p className="text-xs text-slate-500 font-medium">{isEditing ? 'Modify existing configuration' : 'Configure new work timings'}</p>
                                    </div>
                                    <button 
                                        onClick={() => setIsAddModalOpen(false)} 
                                        className="w-10 h-10 bg-slate-100 dark:bg-github-dark-subtle text-slate-500 dark:text-github-dark-muted rounded-full flex items-center justify-center"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                                
                                <div className="space-y-6">
                                    {/* Name Input */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Shift Name</label>
                                        <div className="relative group">
                                            <Settings2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                            <input 
                                                type="text" 
                                                placeholder="e.g. Regular Day Shift"
                                                value={newShiftName}
                                                onChange={(e) => setNewShiftName(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-github-dark-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Time Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Start Time</label>
                                            <div className="relative group">
                                                <Sun size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                                                <input 
                                                    type="time" 
                                                    value={newStartTime}
                                                    onChange={(e) => setNewStartTime(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl pl-11 pr-4 py-3.5 text-sm font-black text-slate-800 dark:text-github-dark-text font-mono appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">End Time</label>
                                            <div className="relative group">
                                                <Moon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                <input 
                                                    type="time" 
                                                    value={newEndTime}
                                                    onChange={(e) => setNewEndTime(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl pl-11 pr-4 py-3.5 text-sm font-black text-slate-800 dark:text-github-dark-text font-mono appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grace Period Slider-style Input */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center mb-1 px-1">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Grace Period</label>
                                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{newGracePeriod} mins</span>
                                        </div>
                                        <div className="relative group">
                                            <Hourglass size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input 
                                                type="number" 
                                                value={newGracePeriod}
                                                onChange={(e) => setNewGracePeriod(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl pl-11 pr-16 py-3.5 text-sm font-bold text-slate-800 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Minutes</span>
                                        </div>
                                    </div>

                                    {/* Toggles */}
                                    <div className="bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl p-4 border border-slate-100 dark:border-github-dark-border flex justify-between items-center group active:bg-slate-100 dark:active:bg-github-dark-subtle transition-colors" onClick={() => setNewOvertime(!newOvertime)}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl transition-colors ${newOvertime ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 text-slate-400'}`}>
                                                <Zap size={18} fill={newOvertime ? 'currentColor' : 'none'} />
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-bold text-slate-800 dark:text-github-dark-text">Overtime Tracking</p>
                                                <p className="text-[10px] text-slate-500 font-medium">Automate OT calculations</p>
                                            </div>
                                        </div>
                                        <div className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 ${newOvertime ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${newOvertime ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                        </div>
                                    </div>

                                    {/* Validation Section */}
                                    <div className="space-y-4 pt-2">
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Validation Requirements</p>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Check-In Column */}
                                            <div className="space-y-3">
                                                <p className="text-[11px] font-black text-slate-800 dark:text-github-dark-text uppercase tracking-tight flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Check-In
                                                </p>
                                                <div className="space-y-2">
                                                    <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl cursor-pointer active:scale-95 transition-all">
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${newValCheckInGps ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-500/20' : 'border-slate-300 bg-white dark:bg-slate-800'}`}>
                                                            {newValCheckInGps && <CheckCircle2 size={14} className="text-white" />}
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={newValCheckInGps} onChange={() => setNewValCheckInGps(!newValCheckInGps)} />
                                                        <span className="text-[11px] font-bold text-slate-600 dark:text-github-dark-muted uppercase">GPS</span>
                                                    </label>
                                                    <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl cursor-pointer active:scale-95 transition-all">
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${newValCheckInSelfie ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-500/20' : 'border-slate-300 bg-white dark:bg-slate-800'}`}>
                                                            {newValCheckInSelfie && <CheckCircle2 size={14} className="text-white" />}
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={newValCheckInSelfie} onChange={() => setNewValCheckInSelfie(!newValCheckInSelfie)} />
                                                        <span className="text-[11px] font-bold text-slate-600 dark:text-github-dark-muted uppercase">Selfie</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Check-Out Column */}
                                            <div className="space-y-3">
                                                <p className="text-[11px] font-black text-slate-800 dark:text-github-dark-text uppercase tracking-tight flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Check-Out
                                                </p>
                                                <div className="space-y-2">
                                                    <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl cursor-pointer active:scale-95 transition-all">
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${newValCheckOutGps ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-500/20' : 'border-slate-300 bg-white dark:bg-slate-800'}`}>
                                                            {newValCheckOutGps && <CheckCircle2 size={14} className="text-white" />}
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={newValCheckOutGps} onChange={() => setNewValCheckOutGps(!newValCheckOutGps)} />
                                                        <span className="text-[11px] font-bold text-slate-600 dark:text-github-dark-muted uppercase">GPS</span>
                                                    </label>
                                                    <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl cursor-pointer active:scale-95 transition-all">
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${newValCheckOutSelfie ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-500/20' : 'border-slate-300 bg-white dark:bg-slate-800'}`}>
                                                            {newValCheckOutSelfie && <CheckCircle2 size={14} className="text-white" />}
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={newValCheckOutSelfie} onChange={() => setNewValCheckOutSelfie(!newValCheckOutSelfie)} />
                                                        <span className="text-[11px] font-bold text-slate-600 dark:text-github-dark-muted uppercase">Selfie</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-10 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
                                    <button 
                                        onClick={handleSaveShift}
                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-2xl shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 size={20} />
                                        {isEditing ? 'Update Shift Configuration' : 'Save New Shift'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </MobileDashboardLayout>
    );
};

export default ShiftManagement;

