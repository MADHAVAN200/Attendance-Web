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
    CheckCircle2
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
            color: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
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
            overtime: false,
            color: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
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
    
    // Create Shift Form State
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

    const handleSaveShift = () => {
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
        setIsAddModalOpen(false);
        // Reset form
        setNewShiftName('');
        setNewStartTime('09:00');
        setNewEndTime('18:00');
        setNewGracePeriod('0');
        setNewOvertime(false);
        setNewValCheckInGps(true);
        setNewValCheckInSelfie(true);
        setNewValCheckOutGps(false);
        setNewValCheckOutSelfie(false);
    };

    return (
        <MobileDashboardLayout title="Shift Management">
            <div className="px-2 pb-6 pt-2 space-y-3">
                {/* Top Card */}
                <div className="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800 dark:text-white">Active Shifts</h2>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[150px] mt-0.5">Manage work timings & grace</p>
                    </div>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-1 px-3 py-2 bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-500/20 hover:bg-indigo-600 active:scale-95 transition-all"
                    >
                        <Plus size={14} />
                        Add Shift
                    </button>
                </div>

                {/* Shifts List */}
                <div className="space-y-3">
                    {shifts.map((shift) => (
                        <div 
                            key={shift.id} 
                            onClick={() => handleOpenViewModal(shift)}
                            className="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700/50 relative cursor-pointer active:scale-[0.98] transition-all"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-lg ${shift.color} flex items-center justify-center`}>
                                        <Clock size={16} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-white text-[13px]">{shift.name}</h3>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{shift.type}</p>
                                    </div>
                                </div>
                                <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full" onClick={(e) => e.stopPropagation()}>
                                    <MoreVertical size={14} />
                                </button>
                            </div>

                            <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-500 dark:text-slate-400">Timing</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200 font-mono tracking-wide">{shift.startTime.substring(0,5)} - {shift.endTime.substring(0,5)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 min-w-0"><AlertTriangle size={10} className="text-amber-500" /> Grace Period</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{shift.gracePeriod} Mins</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 min-w-0"><Zap size={10} className="text-indigo-500 dark:text-indigo-400" /> Overtime</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">
                                        {shift.overtime ? `On` : 'Off'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* View Shift Modal Overlay */}
            {isViewModalOpen && selectedShift && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200 px-4">
                    <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto shadow-xl">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-sm font-bold text-slate-800 dark:text-white truncate pr-2">{selectedShift.name}</h2>
                            <button onClick={() => setIsViewModalOpen(false)} className="p-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-full transition-colors flex-shrink-0">
                                <X size={14} />
                            </button>
                        </div>
                        
                        <p className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-3">Shift Details</p>

                        <div className="space-y-3">
                            {/* Timing & Schedule */}
                            <div>
                                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Timing & Schedule</p>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div className="bg-slate-50 dark:bg-slate-800/80 rounded-lg p-2.5 flex items-center gap-2 border border-slate-100 dark:border-slate-700/50">
                                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md">
                                            <Sun size={12} />
                                        </div>
                                        <div>
                                            <p className="text-[8px] uppercase font-bold text-slate-500 dark:text-slate-400">Start Time</p>
                                            <p className="text-[11px] font-bold text-slate-800 dark:text-white mt-0.5">{selectedShift.startTime.substring(0,5)}</p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/80 rounded-lg p-2.5 flex items-center gap-2 border border-slate-100 dark:border-slate-700/50">
                                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md">
                                            <Moon size={12} />
                                        </div>
                                        <div>
                                            <p className="text-[8px] uppercase font-bold text-slate-500 dark:text-slate-400">End Time</p>
                                            <p className="text-[11px] font-bold text-slate-800 dark:text-white mt-0.5">{selectedShift.endTime.substring(0,5)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-lg p-2.5 flex items-center gap-2 border border-slate-100 dark:border-slate-700/50">
                                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md">
                                        <Hourglass size={12} />
                                    </div>
                                    <div>
                                        <p className="text-[8px] uppercase font-bold text-slate-500 dark:text-slate-400">Grace Period</p>
                                        <p className="text-[11px] font-bold text-slate-800 dark:text-white mt-0.5">{selectedShift.gracePeriod} Minutes</p>
                                    </div>
                                </div>
                            </div>

                            {/* Overtime Configuration */}
                            <div>
                                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Overtime Config</p>
                                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-lg p-2.5 flex items-center gap-2 border border-slate-100 dark:border-slate-700/50">
                                    <div className="p-1 bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 rounded-md">
                                        {selectedShift.overtime ? <CheckCircle2 size={12} className="text-emerald-500 dark:text-emerald-400"/> : <XCircle size={12} />}
                                    </div>
                                    <div>
                                        <p className="text-[8px] uppercase font-bold text-slate-500 dark:text-slate-400">Status</p>
                                        <p className="text-[11px] font-bold text-slate-800 dark:text-white mt-0.5">{selectedShift.overtime ? 'Enabled' : 'Disabled'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Attendance Validation */}
                            <div>
                                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Validation</p>
                                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50 grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Check-In</p>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-1.5">
                                                {selectedShift.validation?.checkInGPS ? <CheckCircle2 size={12} className="text-emerald-500 dark:text-emerald-400" /> : <XCircle size={12} className="text-slate-400 dark:text-slate-500" />}
                                                <span className={`text-[10px] font-bold ${selectedShift.validation?.checkInGPS ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>GPS {selectedShift.validation?.checkInGPS ? 'Req' : 'Opt'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {selectedShift.validation?.checkInSelfie ? <CheckCircle2 size={12} className="text-emerald-500 dark:text-emerald-400" /> : <XCircle size={12} className="text-slate-400 dark:text-slate-500" />}
                                                <span className={`text-[10px] font-bold ${selectedShift.validation?.checkInSelfie ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>Selfie {selectedShift.validation?.checkInSelfie ? 'Req' : 'Opt'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Check-Out</p>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-1.5">
                                                {selectedShift.validation?.checkOutGPS ? <CheckCircle2 size={12} className="text-emerald-500 dark:text-emerald-400" /> : <XCircle size={12} className="text-slate-400 dark:text-slate-500" />}
                                                <span className={`text-[10px] font-bold ${selectedShift.validation?.checkOutGPS ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>GPS {selectedShift.validation?.checkOutGPS ? 'Req' : 'Opt'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {selectedShift.validation?.checkOutSelfie ? <CheckCircle2 size={12} className="text-emerald-500 dark:text-emerald-400" /> : <XCircle size={12} className="text-slate-400 dark:text-slate-500" />}
                                                <span className={`text-[10px] font-bold ${selectedShift.validation?.checkOutSelfie ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>Selfie {selectedShift.validation?.checkOutSelfie ? 'Req' : 'Opt'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsViewModalOpen(false)}
                            className="w-full mt-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-[0.98]"
                        >
                            Close
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* Create New Shift Modal Overlay */}
            {isAddModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200 px-4">
                    <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto shadow-xl">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700/50 mb-3">
                            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Create Shift</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="p-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-full transition-colors flex-shrink-0">
                                <X size={14} />
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-1">Shift Name</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Morning Shift"
                                    value={newShiftName}
                                    onChange={(e) => setNewShiftName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600/50 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-1">Start Time</label>
                                    <div className="relative">
                                        <input 
                                            type="time" 
                                            value={newStartTime}
                                            onChange={(e) => setNewStartTime(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600/50 rounded-lg pl-2.5 pr-6 py-1.5 text-[11px] text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500/50 appearance-none"
                                        />
                                        <Clock size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-1">End Time</label>
                                    <div className="relative">
                                        <input 
                                            type="time" 
                                            value={newEndTime}
                                            onChange={(e) => setNewEndTime(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600/50 rounded-lg pl-2.5 pr-6 py-1.5 text-[11px] text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500/50 appearance-none"
                                        />
                                        <Clock size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-1">Grace Period (Mins)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={newGracePeriod}
                                        onChange={(e) => setNewGracePeriod(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600/50 rounded-lg pl-2.5 pr-9 py-1.5 text-[11px] text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500/50"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">mins</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center py-1.5 border-b border-t border-slate-100 dark:border-slate-700/50">
                                <div>
                                    <p className="text-[11px] font-bold text-slate-800 dark:text-white">Overtime Calc</p>
                                    <p className="text-[8px] text-slate-500 dark:text-slate-400 mt-0.5">Enable auto OT tracking</p>
                                </div>
                                <div 
                                    className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${newOvertime ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                    onClick={() => setNewOvertime(!newOvertime)}
                                >
                                    <div className={`w-3 h-3 rounded-full bg-white transition-transform ${newOvertime ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-lg p-3 border border-slate-200 dark:border-slate-600/30">
                                <div className="flex items-center gap-1.5 mb-3">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                        <circle cx="12" cy="10" r="3"></circle>
                                    </svg>
                                    <p className="text-[11px] font-bold text-slate-800 dark:text-white">Attendance Validation</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Check-In</p>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <div className={`w-3 h-3 rounded flex items-center justify-center border ${newValCheckInGps ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-transparent'}`}>
                                                    {newValCheckInGps && <CheckCircle2 size={10} className="text-white bg-indigo-500 rounded-full"/>}
                                                </div>
                                                <input type="checkbox" className="hidden" checked={newValCheckInGps} onChange={() => setNewValCheckInGps(!newValCheckInGps)} />
                                                <span className="text-[10px] text-slate-600 dark:text-slate-300">GPS Req</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <div className={`w-3 h-3 rounded flex items-center justify-center border ${newValCheckInSelfie ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-transparent'}`}>
                                                    {newValCheckInSelfie && <CheckCircle2 size={10} className="text-white bg-indigo-500 rounded-full"/>}
                                                </div>
                                                <input type="checkbox" className="hidden" checked={newValCheckInSelfie} onChange={() => setNewValCheckInSelfie(!newValCheckInSelfie)} />
                                                <span className="text-[10px] text-slate-600 dark:text-slate-300">Selfie Req</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Check-Out</p>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <div className={`w-3 h-3 rounded flex items-center justify-center border ${newValCheckOutGps ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-transparent'}`}>
                                                    {newValCheckOutGps && <CheckCircle2 size={10} className="text-white bg-indigo-500 rounded-full"/>}
                                                </div>
                                                <input type="checkbox" className="hidden" checked={newValCheckOutGps} onChange={() => setNewValCheckOutGps(!newValCheckOutGps)} />
                                                <span className="text-[10px] text-slate-600 dark:text-slate-300">GPS Req</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <div className={`w-3 h-3 rounded flex items-center justify-center border ${newValCheckOutSelfie ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-transparent'}`}>
                                                    {newValCheckOutSelfie && <CheckCircle2 size={10} className="text-white bg-indigo-500 rounded-full"/>}
                                                </div>
                                                <input type="checkbox" className="hidden" checked={newValCheckOutSelfie} onChange={() => setNewValCheckOutSelfie(!newValCheckOutSelfie)} />
                                                <span className="text-[10px] text-slate-600 dark:text-slate-300">Selfie Req</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-4">
                            <button 
                                onClick={() => setIsAddModalOpen(false)}
                                className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-[11px] font-bold rounded-lg transition-all active:scale-[0.98]"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveShift}
                                className="w-full py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all active:scale-[0.98]"
                            >
                                Save Shift
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </MobileDashboardLayout>
    );
};

export default ShiftManagement;
