import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CustomCalendar = ({ selectedDate, onChange, onClose, events = {} }) => {
    // Parse the initial date or default to today
    const initialDate = selectedDate ? new Date(selectedDate) : new Date();

    // State for the currently viewed month/year
    const [currentDate, setCurrentDate] = useState(initialDate);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Days of week headers
    const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // Helper to get days in month
    const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

    // Helper to get day of week for the 1st of the month
    const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    // Previous month (for padding)
    const prevMonthDays = getDaysInMonth(year, month - 1);

    // Generate grid cells
    const days = [];

    // Padding for previous month
    for (let i = 0; i < firstDay; i++) {
        days.push({ day: prevMonthDays - firstDay + i + 1, type: 'prev' });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ day: i, type: 'current' });
    }

    // Padding for next month (to complete the grid of 35 or 42 cells)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
        days.push({ day: i, type: 'next' });
    }

    // Navigation Handlers
    const prevMonth = (e) => {
        e.stopPropagation();
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const nextMonth = (e) => {
        e.stopPropagation();
        setCurrentDate(new Date(year, month + 1, 1));
    };

    // YYYY-MM-DD formatter
    const formatDate = (y, m, d) => {
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };

    const handleDateClick = (dayObj) => {
        let newDate;
        if (dayObj.type === 'prev') {
            newDate = new Date(year, month - 1, dayObj.day);
        } else if (dayObj.type === 'next') {
            newDate = new Date(year, month + 1, dayObj.day);
        } else {
            newDate = new Date(year, month, dayObj.day);
        }

        // Format to YYYY-MM-DD
        const dateStr = formatDate(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
        onChange(dateStr);
        onClose(); // Close picker after selection
    };

    // Check if a day is the selected date
    const isSelected = (dayObj) => {
        if (dayObj.type !== 'current') return false;
        const dateStr = formatDate(year, month, dayObj.day);
        return dateStr === selectedDate;
    };

    // Check if today
    const isToday = (dayObj) => {
        if (dayObj.type !== 'current') return false;
        const today = new Date();
        return dayObj.day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    };


    return (
        <div
            className="absolute top-full right-0 mt-2 z-50 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 w-[320px] animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={prevMonth}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <div className="font-bold text-slate-800 dark:text-white">
                    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
                <button
                    onClick={nextMonth}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 mb-2">
                {daysOfWeek.map((d) => (
                    <div key={d} className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((dayObj, index) => {
                    const isCurrentMonth = dayObj.type === 'current';
                    // Construct date key for event lookup
                    const dateKey = isCurrentMonth ? formatDate(year, month, dayObj.day) : null;
                    const eventType = isCurrentMonth && events[dateKey] ? events[dateKey].type : null;

                    const selected = isSelected(dayObj);
                    const today = isToday(dayObj);

                    let bgClass = "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700";

                    if (!isCurrentMonth) {
                        bgClass = "text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800";
                    } else if (selected) {
                        bgClass = "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/30";
                    } else if (today) {
                        bgClass = "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
                    } else if (eventType === 'absent') {
                        bgClass = "bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50";
                    } else if (eventType === 'holiday') {
                        bgClass = "bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50";
                    }

                    return (
                        <button
                            key={index}
                            onClick={() => handleDateClick(dayObj)}
                            className={`
                                h-9 w-9 rounded-lg flex items-center justify-center text-sm font-medium transition-all relative
                                ${bgClass}
                            `}
                        >
                            {dayObj.day}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[10px] text-slate-500">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Today</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400"></div>Absent</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div>Holiday</div>
            </div>
        </div>
    );
};

export default CustomCalendar;
