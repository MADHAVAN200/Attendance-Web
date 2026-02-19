import React, { useState } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { Plus, Clock, MoreVertical, Zap, AlertTriangle } from 'lucide-react';

const ShiftManagement = () => {
    // Mock Data based on screenshot
    const [shifts, setShifts] = useState([
        {
            id: 1,
            name: 'General Shift',
            type: 'Shift',
            startTime: '09:00',
            endTime: '18:00',
            gracePeriod: 600,
            overtime: false,
            color: 'bg-indigo-100 text-indigo-600'
        },
        {
            id: 2,
            name: 'Strict Morning',
            type: 'Shift',
            startTime: '06:00:00',
            endTime: '14:00:00',
            gracePeriod: 0,
            overtime: true,
            overtimeThreshold: 8.0,
            color: 'bg-indigo-100 text-indigo-600'
        },
        {
            id: 3,
            name: 'Night Shiftsss',
            type: 'Shift',
            startTime: '18:00',
            endTime: '02:30',
            gracePeriod: 0,
            overtime: false,
            color: 'bg-indigo-100 text-indigo-600'
        }
    ]);

    return (
        <MobileDashboardLayout title="Shift Management">
            {/* Top Card */}
            <div className="bg-white dark:bg-dark-card rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Active Shifts</h2>
                    <p className="text-xs text-slate-500 max-w-[150px]">Manage work timings and grace periods</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all">
                    <Plus size={18} />
                    Add Shift
                </button>
            </div>

            {/* Shifts List */}
            <div className="space-y-4">
                {shifts.map((shift) => (
                    <div key={shift.id} className="bg-white dark:bg-dark-card rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 relative">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl ${shift.color} flex items-center justify-center`}>
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">{shift.name}</h3>
                                    <p className="text-xs text-slate-500 font-medium">{shift.type}</p>
                                </div>
                            </div>
                            <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-full">
                                <MoreVertical size={20} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Timing</span>
                                <span className="font-bold text-slate-800 dark:text-white font-mono">{shift.startTime} - {shift.endTime}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 flex items-center gap-1"><AlertTriangle size={14} className="text-amber-500" /> Grace Period</span>
                                <span className="font-bold text-slate-800 dark:text-white">{shift.gracePeriod} Mins</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 flex items-center gap-1"><Zap size={14} className="text-indigo-500" /> Overtime</span>
                                <span className="font-bold text-slate-800 dark:text-white">
                                    {shift.overtime ? `On (> ${shift.overtimeThreshold}h)` : 'Off'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </MobileDashboardLayout>
    );
};

export default ShiftManagement;
