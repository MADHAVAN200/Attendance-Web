import React, { useState, useEffect } from 'react';
import { X, Plus, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

const TaskCreationPanel = ({ onClose, onUpdate, initialTimeIn = "09:30" }) => {
    // Helper to add minutes to HH:MM time
    const addMinutes = (timeStr, minutes) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m + minutes);
        return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    };

    // Helper: check if t1 < t2
    const isBefore = (t1, t2) => {
        if (!t1 || !t2) return false;
        return t1.localeCompare(t2) < 0;
    };

    const [inputs, setInputs] = useState([]);

    // Initialize defaults on mount
    useEffect(() => {
        // Defined durations in minutes
        const durations = [60, 60, 120, 60, 120, 60];
        let currentTime = initialTimeIn;

        const initialTasks = Array.from({ length: 6 }, (_, i) => {
            const start = currentTime;
            const end = addMinutes(start, durations[i]);
            currentTime = end;

            return {
                id: `new-${i}`,
                title: '',
                startTime: start,
                endTime: end,
                duration: durations[i],
                isValid: true,
                error: null
            };
        });
        setInputs(initialTasks);

        // IMMEDIATE PREVIEW: Emit all initial tasks to the parent instantly
        initialTasks.forEach(task => {
            onUpdate({
                id: task.id,
                title: task.title,
                startTime: task.startTime,
                endTime: task.endTime,
                type: 'task',
                date: new Date().toISOString().split('T')[0]
            });
        });

    }, [initialTimeIn]); // Only re-run if Time In changes drastically on mount


    const handleInputChange = (index, field, value) => {
        const newInputs = [...inputs];
        let task = { ...newInputs[index], [field]: value };

        // Validation: Start time cannot be before Time In
        if (field === 'startTime') {
            if (isBefore(value, initialTimeIn)) {
                task.error = "Cannot start before Time In";
            } else {
                task.error = null;
            }
        }

        newInputs[index] = task;
        setInputs(newInputs);

        // Update Parent (even if title is empty, to update times)
        if (task.startTime && !task.error) {
            onUpdate({
                id: task.id,
                title: task.title,
                startTime: task.startTime,
                endTime: task.endTime,
                type: 'task',
                date: new Date().toISOString().split('T')[0]
            });
        }
    };

    const handleAddAnother = () => {
        const lastTask = inputs[inputs.length - 1];
        let nextStart = lastTask ? lastTask.endTime : initialTimeIn;
        // Default 1 hour for new tasks
        let nextEnd = addMinutes(nextStart, 60);

        const newTask = {
            id: `new-${inputs.length + Math.random().toString(36).substr(2, 5)}`, // Unique ID for additions
            title: '',
            startTime: nextStart,
            endTime: nextEnd,
            isValid: true,
            error: null
        };

        setInputs([...inputs, newTask]);

        // Emit new task immediately
        onUpdate({
            id: newTask.id,
            title: newTask.title,
            startTime: newTask.startTime,
            endTime: newTask.endTime,
            type: 'task',
            date: new Date().toISOString().split('T')[0]
        });
    };

    const handleDelete = (index) => {
        const taskToDelete = inputs[index];
        // Remove from local state
        const newInputs = inputs.filter((_, i) => i !== index);
        setInputs(newInputs);

        // Remove from Parent
        onUpdate({
            id: taskToDelete.id,
            deleted: true
        });
    };

    return (
        <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full h-full bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col overflow-hidden"
        >

            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-white z-10">
                <div>
                    <h3 className="text-xl font-bold text-gray-800 tracking-tight">Daily Tasks</h3>
                    <p className="text-sm text-gray-400 mt-1">Plan your day effectively</p>

                    <div className="flex items-center gap-2 mt-3 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full w-fit border border-emerald-100">
                        <Clock size={14} />
                        <span>Time In: {initialTimeIn}</span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Task List Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                {inputs.map((task, i) => (
                    <div key={task.id} className={`group relative bg-white rounded-xl border transition-all p-3 flex flex-col gap-3 ${task.error ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100 hover:border-indigo-100 hover:shadow-sm'}`}>
                        {/* Indicator Line */}
                        <div className={`absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full transition-colors ${task.error ? 'bg-red-400' : 'bg-gray-200 group-hover:bg-indigo-500'}`}></div>

                        {/* Top Row: Label & Hidden Delete */}
                        <div className="flex items-center justify-between relative">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Task {i + 1 < 10 ? `0${i + 1}` : i + 1}
                            </span>

                            {/* Hidden Delete Button (Top Right) */}
                            <button
                                onClick={() => handleDelete(i)}
                                className="absolute -top-1 -right-1 p-1.5 bg-red-50 text-red-400 rounded-full hover:bg-red-100 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                title="Remove Task"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Add description"
                                value={task.title}
                                onChange={(e) => handleInputChange(i, 'title', e.target.value)}
                                className="w-full text-sm font-medium text-gray-700 placeholder:text-gray-400 placeholder:font-normal bg-transparent border-none p-0 focus:ring-0"
                            />

                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-3 pt-2 border-t border-dashed border-gray-100">
                                    <div className={`flex-1 bg-gray-50 rounded-lg px-2 py-1.5 focus-within:bg-white focus-within:ring-2 transition-all flex items-center gap-2 ${task.error ? 'focus-within:ring-red-500/20' : 'focus-within:ring-indigo-500/20'}`}>
                                        <Clock size={14} className={task.error ? "text-red-400" : "text-gray-400"} />
                                        <input
                                            type="time"
                                            value={task.startTime}
                                            onChange={(e) => handleInputChange(i, 'startTime', e.target.value)}
                                            className={`w-full bg-transparent border-none p-0 text-xs font-medium focus:ring-0 ${task.error ? 'text-red-600' : 'text-gray-600'}`}
                                        />
                                    </div>
                                    <span className="text-gray-300">to</span>
                                    <div className="flex-1 bg-gray-50 rounded-lg px-2 py-1.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all flex items-center gap-2">
                                        <input
                                            type="time"
                                            value={task.endTime}
                                            onChange={(e) => handleInputChange(i, 'endTime', e.target.value)}
                                            className="w-full bg-transparent border-none p-0 text-xs font-medium text-gray-600 focus:ring-0 text-right"
                                        />
                                    </div>
                                </div>
                                {task.error && (
                                    <span className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                                        <AlertCircle size={10} /> {task.error}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Unavailable Slot Placeholder */}
                <div className="p-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 flex items-center justify-between opacity-70">
                    <span className="text-xs font-bold text-gray-400 uppercase">
                        Task {inputs.length + 1 < 10 ? `0${inputs.length + 1}` : inputs.length + 1}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-orange-500 font-medium">
                        <AlertCircle size={14} />
                        <span>Unavailable</span>
                    </div>
                </div>

                {/* Add New */}
                <button
                    onClick={handleAddAnother}
                    className="w-full py-4 border border-dashed border-indigo-200 bg-indigo-50/30 rounded-xl flex items-center justify-center gap-2 text-indigo-500 hover:bg-indigo-50 transition-all text-sm font-bold"
                >
                    <Plus size={16} />
                    Add Another Task
                </button>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50">
                <button
                    className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-lg shadow-gray-200 transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2"
                    onClick={onClose}
                >
                    Save & Continue
                </button>
            </div>

        </motion.div>
    );
};

export default TaskCreationPanel;
