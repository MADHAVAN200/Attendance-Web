import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react';

const MobileDatePicker = ({ label, value, onChange, placeholder = "Select date" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const containerRef = useRef(null);

    // Initialize based on value (YYYY-MM-DD)
    useEffect(() => {
        if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                setCurrentMonth(date.getMonth());
                setCurrentYear(date.getFullYear());
            }
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

    const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

    const monthNames = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];

    const handleDayClick = (day) => {
        const monthStr = String(currentMonth + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
        onChange(dateStr);
        setIsOpen(false);
    };

    const isToday = (day) => {
        const today = new Date();
        return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
    };

    const isSelected = (day) => {
        if (!value) return false;
        const selected = new Date(value);
        return day === selected.getDate() && currentMonth === selected.getMonth() && currentYear === selected.getFullYear();
    };

    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const renderCalendar = () => {
        const totalDays = daysInMonth(currentMonth, currentYear);
        const startDay = firstDayOfMonth(currentMonth, currentYear);
        const days = [];

        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
        }

        for (let i = 1; i <= totalDays; i++) {
            days.push(
                <button
                    key={i}
                    onClick={() => handleDayClick(i)}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-all
                        ${isSelected(i)
                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                            : isToday(i)
                                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20'
                                : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                        }
                    `}
                    type="button"
                >
                    {i}
                </button>
            );
        }

        return days;
    };

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1.5">{label}</label>}

            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full h-11 px-4 bg-slate-50 dark:bg-black border ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-100 dark:border-slate-800'} rounded-2xl flex items-center justify-between cursor-pointer transition-all dark:text-white`}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <Calendar size={16} className="text-indigo-500" />
                    <span className={`text-sm font-semibold ${value ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
                        {value ? formatDateDisplay(value) : placeholder}
                    </span>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute left-0 right-0 mt-2 min-w-[260px] bg-white dark:bg-black rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-[100] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                    {/* Header */}
                    <div className="p-2 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-black/20">
                        <button 
                            onClick={() => {
                                if (currentMonth === 0) {
                                    setCurrentMonth(11);
                                    setCurrentYear(currentYear - 1);
                                } else {
                                    setCurrentMonth(currentMonth - 1);
                                }
                            }} 
                            type="button" 
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 transition-colors"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <div className="text-[9px] font-black text-slate-800 dark:text-white uppercase tracking-widest text-center">
                            {monthNames[currentMonth]} {currentYear}
                        </div>
                        <button 
                            onClick={() => {
                                if (currentMonth === 11) {
                                    setCurrentMonth(0);
                                    setCurrentYear(currentYear + 1);
                                } else {
                                    setCurrentMonth(currentMonth + 1);
                                }
                            }} 
                            type="button" 
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 transition-colors"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    {/* Weekdays */}
                    <div className="grid grid-cols-7 gap-0.5 px-3 pt-3 text-center">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="text-[8px] uppercase font-black text-slate-400 tracking-tighter">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-0.5 p-3 pt-1">
                        {renderCalendar()}
                    </div>

                    {/* Footer */}
                    <div className="p-2 border-t border-slate-50 dark:border-slate-800 flex justify-between bg-slate-50/30 dark:bg-black/10">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const today = new Date();
                                const year = today.getFullYear();
                                const month = String(today.getMonth() + 1).padStart(2, '0');
                                const day = String(today.getDate()).padStart(2, '0');
                                onChange(`${year}-${month}-${day}`);
                                setIsOpen(false);
                            }}
                            type="button"
                            className="text-[9px] font-black text-indigo-500 uppercase tracking-widest px-2 py-1"
                        >
                            Today
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                            }}
                            type="button"
                            className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-1"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileDatePicker;
