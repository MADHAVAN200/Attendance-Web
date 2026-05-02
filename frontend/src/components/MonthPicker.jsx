import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react';

const MonthPicker = ({ label, value, onChange, placeholder = "Select month" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const containerRef = useRef(null);

    // Initialize based on value (YYYY-MM)
    useEffect(() => {
        if (value) {
            const [y] = value.split('-');
            if (y) setCurrentYear(parseInt(y));
        }
    }, [value, isOpen]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const handleMonthClick = (monthIdx) => {
        const monthStr = String(monthIdx + 1).padStart(2, '0');
        const newValue = `${currentYear}-${monthStr}`;
        onChange(newValue);
        setIsOpen(false);
    };

    const isSelected = (monthIdx) => {
        if (!value) return false;
        const [y, m] = value.split('-');
        return parseInt(y) === currentYear && parseInt(m) === (monthIdx + 1);
    };

    const isCurrentMonth = (monthIdx) => {
        const today = new Date();
        return monthIdx === today.getMonth() && currentYear === today.getFullYear();
    };

    const formatDateDisplay = (val) => {
        if (!val) return '';
        const [y, m] = val.split('-');
        const monthName = months[parseInt(m) - 1];
        return `${monthName}, ${y}`;
    };

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1.5">{label}</label>}

            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full h-10 px-3 bg-slate-50 dark:bg-black/20 border ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-100 dark:border-white/5'} rounded-xl flex items-center justify-between cursor-pointer transition-all dark:text-white`}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <Calendar size={14} className="text-indigo-500" />
                    <span className={`text-xs font-bold ${value ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
                        {value ? formatDateDisplay(value) : placeholder}
                    </span>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute left-0 mt-2 w-full min-w-[240px] bg-white dark:bg-github-dark-subtle rounded-2xl shadow-2xl border border-slate-100 dark:border-white/10 z-[100] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-50 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-black/20">
                        <button onClick={() => setCurrentYear(currentYear - 1)} type="button" className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-500 transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        <div className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">
                            {currentYear}
                        </div>
                        <button onClick={() => setCurrentYear(currentYear + 1)} type="button" className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-500 transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Months Grid */}
                    <div className="grid grid-cols-3 gap-2 p-4">
                        {months.map((month, idx) => (
                            <button
                                key={month}
                                onClick={() => handleMonthClick(idx)}
                                className={`py-3 rounded-xl text-xs font-black uppercase transition-all ${
                                    isSelected(idx)
                                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                        : isCurrentMonth(idx)
                                            ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                                }`}
                                type="button"
                            >
                                {month}
                            </button>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-slate-50 dark:border-white/5 flex justify-between bg-slate-50/30 dark:bg-black/10">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const today = new Date();
                                const val = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                                onChange(val);
                                setIsOpen(false);
                            }}
                            type="button"
                            className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-3 py-1.5"
                        >
                            This month
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                            }}
                            type="button"
                            className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-1.5"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonthPicker;
