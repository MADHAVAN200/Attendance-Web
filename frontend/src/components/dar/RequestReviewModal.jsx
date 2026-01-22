import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ArrowRight, Clock, FileText, Activity, AlertCircle, Calendar } from 'lucide-react';

const RequestReviewModal = ({ isOpen, onClose, request }) => {
    // Mock Data if no request is passed (for development/preview)
    const mockRequest = {
        employeeName: "John Civil",
        date: "Jan 19, 2024",
        originalTasks: [
            { id: 1, title: "Site A Inspection", startTime: "09:00", endTime: "11:00", type: "SITE_VISIT" },
            { id: 2, title: "Cement Unloading", startTime: "11:30", endTime: "13:00", type: "LOGISTICS" }, // Deleted in proposed
            { id: 3, title: "Client Meeting", startTime: "14:00", endTime: "15:00", type: "MEETING" },
        ],
        proposedTasks: [
            { id: 1, title: "Site A Inspection", startTime: "09:00", endTime: "11:30", type: "SITE_VISIT" }, // Extended time
            { id: 3, title: "Client Meeting", startTime: "15:00", endTime: "16:00", type: "MEETING" }, // Moved time
            { id: 4, title: "Material Check", startTime: "11:30", endTime: "12:30", type: "LOGISTICS" }, // New
        ]
    };

    const data = request || mockRequest;

    // Dynamic Range Calculation
    const timeRange = useMemo(() => {
        const originalTasks = data.originalTasks || [];
        const proposedTasks = data.proposedTasks || [];
        const allTasks = [...originalTasks, ...proposedTasks];

        if (allTasks.length === 0) return { start: 9, end: 18, span: 9 };

        const getMinutes = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };

        let minMin = Math.min(...allTasks.map(t => getMinutes(t.startTime)));
        let maxMin = Math.max(...allTasks.map(t => getMinutes(t.endTime)));

        // Add 1 hour buffer
        let startHour = Math.floor((minMin - 60) / 60);
        let endHour = Math.ceil((maxMin + 60) / 60);

        // Clamp to 00:00 - 24:00
        startHour = Math.max(0, startHour);
        endHour = Math.min(24, endHour);

        return { start: startHour, end: endHour, span: endHour - startHour };
    }, [data]);

    const timeToPos = (time) => {
        const [h, m] = time.split(':').map(Number);
        const totalMinutes = h * 60 + m;
        const startMinutes = timeRange.start * 60;
        const totalSpanMinutes = timeRange.span * 60;
        return ((totalMinutes - startMinutes) / totalSpanMinutes) * 100;
    };

    const getDurationPct = (start, end) => {
        return timeToPos(end) - timeToPos(start);
    };

    // Identify Changes for Diff List
    const changes = useMemo(() => {
        const changesList = [];
        const originalTasks = data.originalTasks || [];
        const proposedTasks = data.proposedTasks || [];

        const proposedIds = new Set(proposedTasks.map(t => t.id));
        const originalIds = new Set(originalTasks.map(t => t.id));

        // Modified & Deleted
        originalTasks.forEach(orig => {
            const prop = proposedTasks.find(p => p.id === orig.id);
            if (!prop) {
                changesList.push({ type: 'DELETE', task: orig, reason: 'Task removed' });
            } else {
                // Check for modifications
                if (orig.startTime !== prop.startTime || orig.endTime !== prop.endTime) {
                    changesList.push({
                        type: 'MODIFY',
                        task: prop,
                        original: orig,
                        reason: `Time changed: ${orig.startTime}-${orig.endTime} → ${prop.startTime}-${prop.endTime}`
                    });
                }
            }
        });

        // Added
        proposedTasks.forEach(prop => {
            if (!originalIds.has(prop.id)) {
                changesList.push({ type: 'ADD', task: prop, reason: 'New task added' });
            }
        });

        return changesList;
    }, [data]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-5xl bg-white dark:bg-[#0f111a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Activity className="text-violet-500" size={24} />
                            Review Schedule Changes
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                            Reviewing request from <span className="font-semibold text-slate-700 dark:text-slate-300">{data.employeeName}</span> for <span className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-xs"><Calendar size={12} /> {data.date}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="text-slate-500 hover:text-red-500" size={24} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* VISUAL TIMELINE SECTION */}
                    <div className="relative p-8 pt-12 pb-8 bg-slate-50 dark:bg-[#13151f] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">

                        <div className="absolute top-4 left-6 z-10">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-[#13151f] pr-4">Visual Sync Timeline</h3>
                        </div>

                        {/* Timeline Container */}
                        <div className="relative mt-2">
                            {/* Timeline Scale */}
                            <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none">
                                {Array.from({ length: timeRange.span + 1 }, (_, i) => timeRange.start + i).map((h, i) => (
                                    <div key={h} className="absolute top-0 bottom-0 border-r border-slate-300 dark:border-slate-700/50 dashed" style={{ left: `${(i / timeRange.span) * 100}%` }}>
                                        <span className="absolute -top-6 -right-3 text-[10px] text-slate-400 font-mono">{h}:00</span>
                                    </div>
                                ))}
                            </div>

                            <div className="relative space-y-12 pt-8 z-10">
                                {/* Original Timeline */}
                                <div className="relative h-14 w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                                    {(data.originalTasks || []).map(task => (
                                        <div
                                            key={`orig-${task.id}`}
                                            className="absolute top-2 bottom-2 rounded-md bg-slate-400/20 border border-slate-400/30 flex items-center px-2 text-[10px] text-slate-500 whitespace-nowrap overflow-hidden transition-all hover:bg-slate-400/40 cursor-help"
                                            style={{
                                                left: `${timeToPos(task.startTime)}%`,
                                                width: `${getDurationPct(task.startTime, task.endTime)}%`
                                            }}
                                            title={`${task.title} (${task.startTime} - ${task.endTime})`}
                                        >
                                            {task.title}
                                        </div>
                                    ))}
                                </div>

                                {/* SVG Connections Layer */}
                                <div className="absolute inset-x-0 top-14 h-12 pointer-events-none z-0">
                                    <svg className="w-full h-full overflow-visible">
                                        <defs>
                                            <linearGradient id="gradDiff" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.2" />
                                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4" />
                                            </linearGradient>
                                        </defs>
                                        {(data.originalTasks || []).map(orig => {
                                            const prop = (data.proposedTasks || []).find(p => p.id === orig.id);
                                            if (!prop) return null;

                                            const x1 = timeToPos(orig.startTime) + (getDurationPct(orig.startTime, orig.endTime) / 2);
                                            const x2 = timeToPos(prop.startTime) + (getDurationPct(prop.startTime, prop.endTime) / 2);

                                            if (Math.abs(x1 - x2) < 0.5 && orig.startTime === prop.startTime && orig.endTime === prop.endTime) return null;

                                            return (
                                                <path
                                                    key={`conn-${orig.id}`}
                                                    d={`M ${x1}% 0 C ${x1}% 50, ${x2}% 50, ${x2}% 100`}
                                                    fill="none"
                                                    stroke="url(#gradDiff)"
                                                    strokeWidth="2"
                                                    strokeDasharray="4 2"
                                                    className="opacity-50"
                                                />
                                            );
                                        })}
                                    </svg>
                                </div>

                                {/* Proposed Timeline */}
                                <div className="relative h-14 w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                                    {(data.proposedTasks || []).map(task => {
                                        const isNew = !(data.originalTasks || []).find(o => o.id === task.id);
                                        const isChanged = (data.originalTasks || []).find(o => o.id === task.id && (o.startTime !== task.startTime || o.endTime !== task.endTime));

                                        let baseClasses = "absolute top-2 bottom-2 rounded-md flex items-center px-2 text-[10px] font-medium whitespace-nowrap overflow-hidden transition-all shadow-sm";
                                        let colorClasses = isNew
                                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                            : isChanged
                                                ? "bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400"
                                                : "bg-slate-300 dark:bg-slate-700 border border-slate-400/30 text-slate-600 dark:text-slate-300";

                                        return (
                                            <div
                                                key={`prop-${task.id}`}
                                                className={`${baseClasses} ${colorClasses}`}
                                                style={{
                                                    left: `${timeToPos(task.startTime)}%`,
                                                    width: `${getDurationPct(task.startTime, task.endTime)}%`
                                                }}
                                            >
                                                {isNew && <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
                                                {task.title}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CHANGES LIST SECTION */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                Diff Changelog <span className="bg-slate-200 dark:bg-slate-800 text-xs px-2 py-0.5 rounded-full">{changes.length} Changes</span>
                            </h3>
                            <div className="space-y-3">
                                {changes.map((change, idx) => (
                                    <div key={idx} className="bg-white dark:bg-[#13151f] p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-start gap-3">
                                        {change.type === 'ADD' && <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600"><Check size={16} /></div>}
                                        {change.type === 'DELETE' && <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600"><X size={16} /></div>}
                                        {change.type === 'MODIFY' && <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600"><Clock size={16} /></div>}

                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{change.task.title}</h4>
                                            <p className="text-xs text-slate-500 mt-1">{change.reason}</p>
                                            {change.type === 'MODIFY' && (
                                                <div className="flex items-center gap-2 text-xs mt-2 font-mono bg-slate-100 dark:bg-slate-900 p-1.5 rounded">
                                                    <span className="text-slate-400 line-through">{change.original.startTime}-{change.original.endTime}</span>
                                                    <ArrowRight size={12} className="text-slate-400" />
                                                    <span className="text-amber-500 font-bold">{change.task.startTime}-{change.task.endTime}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {changes.length === 0 && (
                                    <div className="text-center py-8 text-slate-400 text-sm italic">No significant changes detected.</div>
                                )}
                            </div>
                        </div>

                        {/* META/NOTES SECTION */}
                        <div className="bg-slate-50 dark:bg-[#1e202e] p-5 rounded-xl border border-slate-200 dark:border-slate-800 h-fit">
                            <h3 className="text-sm font-semibold mb-4 text-slate-700 dark:text-slate-300">Request Reason</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                                "I accidentally logged the wrong times for the site inspection because the client arrived late. Also forgot to add the material check."
                            </p>
                            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center text-xs text-slate-500 mb-2">
                                    <span>Original Log Time</span>
                                    <span>Yesterday, 18:30</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f111a] flex justify-end gap-3">
                    <button
                        onClick={() => { alert('Rejected'); onClose(); }}
                        className="px-5 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Reject Request
                    </button>
                    <button
                        onClick={() => { alert('Approved'); onClose(); }}
                        className="px-5 py-2.5 rounded-xl font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/25 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Check size={18} />
                        Approve Changes
                    </button>
                </div>
            </motion.div >
        </div >
    );
};

export default RequestReviewModal;
