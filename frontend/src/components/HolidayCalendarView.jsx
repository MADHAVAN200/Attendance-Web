import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

const HolidayCalendarView = ({ holidays, onDelete, isAdmin, currentDate, onDateChange }) => {
    // Determine the date to display (controlled or fallback to today)
    // Note: It is expected that the parent controls this now.
    const displayDate = currentDate || new Date();

    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1);

    const days = [];

    // Padding for previous month
    for (let i = 0; i < firstDay; i++) {
        days.push({ day: prevMonthDays - firstDay + i + 1, type: 'prev' });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ day: i, type: 'current' });
    }

    // Padding for next month
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
        days.push({ day: i, type: 'next' });
    }

    const prevMonth = () => onDateChange(new Date(year, month - 1, 1));
    const nextMonth = () => onDateChange(new Date(year, month + 1, 1));
    const goToToday = () => onDateChange(new Date());

    // Filter holidays for this view
    const getHolidaysForDate = (day, type) => {
        let targetMonth = month;
        let targetYear = year;

        if (type === 'prev') {
            targetMonth = month - 1;
            if (targetMonth < 0) { targetMonth = 11; targetYear--; }
        } else if (type === 'next') {
            targetMonth = month + 1;
            if (targetMonth > 11) { targetMonth = 0; targetYear++; }
        }

        const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        return holidays.filter(h => h.date === dateStr);
    };

    return (
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                        {displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button onClick={prevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors text-slate-500 dark:text-slate-400">
                            <ChevronLeft size={20} />
                        </button>
                        <button onClick={goToToday} className="px-4 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors">
                            Today
                        </button>
                        <button onClick={nextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors text-slate-500 dark:text-slate-400">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                {daysOfWeek.map(day => (
                    <div key={day} className="py-3 text-center text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-fr bg-slate-200 dark:bg-slate-700 gap-[1px]">
                {days.map((dayObj, index) => {
                    const isCurrentMonth = dayObj.type === 'current';
                    const dayHolidays = getHolidaysForDate(dayObj.day, dayObj.type);
                    const isToday = dayObj.type === 'current' &&
                        dayObj.day === new Date().getDate() &&
                        month === new Date().getMonth() &&
                        year === new Date().getFullYear();

                    return (
                        <div
                            key={index}
                            className={`min-h-[80px] bg-white dark:bg-dark-card p-1 transition-colors relative group
                                ${!isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}
                                ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}
                            `}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`
                                    w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium
                                    ${isToday
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : isCurrentMonth ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600'}
                                `}>
                                    {dayObj.day}
                                </span>
                            </div>

                            <div className="space-y-1">
                                {dayHolidays.map(holiday => (
                                    <div
                                        key={holiday.id}
                                        className={`
                                            text-[10px] p-1 rounded-md border shadow-sm truncate relative group/event cursor-default
                                            ${holiday.type === 'Public'
                                                ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-800/50'
                                                : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800/50'}
                                        `}
                                        title={holiday.name}
                                    >
                                        <span className="font-semibold block truncate">{holiday.name}</span>
                                        {isAdmin && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(holiday.id);
                                                }}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/event:opacity-100 p-0.5 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 transition-opacity"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HolidayCalendarView;
