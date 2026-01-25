import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp } from 'lucide-react';

const DatePicker = ({ label, value, onChange, placeholder = "Select date", minDate, maxDate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const containerRef = useRef(null);

    // Initialize calendar based on value prop if available
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

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const handleDayClick = (day) => {
        const selectedDate = new Date(currentYear, currentMonth, day);
        // Adjust for timezone offset to ensure "YYYY-MM-DD" is correct local date
        // Or simply construct string manually to avoid timezone shifts
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(selectedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayStr}`;

        onChange(dateStr);
        setIsOpen(false);
    };

    const clearDate = (e) => {
        e.stopPropagation();
        onChange('');
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
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const renderCalendar = () => {
        const totalDays = daysInMonth(currentMonth, currentYear);
        const startDay = firstDayOfMonth(currentMonth, currentYear);
        const days = [];

        // Empty cells for days before the 1st
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
        }

        // Days of the month
        for (let i = 1; i <= totalDays; i++) {
            days.push(
                <button
                    key={i}
                    onClick={() => handleDayClick(i)}
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-all
                        ${isSelected(i)
                            ? 'bg-indigo-600 text-white shadow-md'
                            : isToday(i)
                                ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
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

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>}

            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border ${isOpen ? 'border-indigo-500 ring-1 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700'} rounded-lg flex items-center justify-between cursor-pointer transition-all hover:bg-slate-100 dark:hover:bg-slate-900 group`}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <Calendar size={16} className={`${value ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    <span className={`text-sm ${value ? 'text-slate-800 dark:text-white font-medium' : 'text-slate-400'}`}>
                        {value ? formatDateDisplay(value) : placeholder}
                    </span>
                </div>

                {value ? (
                    <button
                        onClick={clearDate}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                        <X size={14} />
                    </button>
                ) : (
                    <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600" />
                )}
            </div>

            {isOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                    {/* Header */}
                    <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                        <button onClick={handlePrevMonth} type="button" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-500 transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {monthNames[currentMonth]} {currentYear}
                        </div>
                        <button onClick={handleNextMonth} type="button" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-500 transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Weekdays */}
                    <div className="grid grid-cols-7 gap-1 p-2 pb-0 text-center">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="text-[10px] uppercase font-bold text-slate-400">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7 gap-1 p-2">
                        {renderCalendar()}
                    </div>

                    {/* Footer */}
                    <div className="p-2 border-t border-slate-100 dark:border-slate-700 flex justify-between">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                                setIsOpen(false);
                            }}
                            type="button"
                            className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                        >
                            Clear
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const today = new Date();
                                handleDayClick(today.getDate());
                                setCurrentMonth(today.getMonth());
                                setCurrentYear(today.getFullYear());
                            }}
                            type="button"
                            className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold"
                        >
                            Today
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatePicker;
