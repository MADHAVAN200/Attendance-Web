import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const HolidayCalendarView = ({ holidays, leaves = [], selectedLeave = null, onDelete, isAdmin, currentDate, onDateChange }) => {
    const displayDate = currentDate || new Date();
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();

    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1);

    const days = [];
    for (let i = 0; i < firstDay; i++) {
        days.push({ day: prevMonthDays - firstDay + i + 1, type: 'prev' });
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ day: i, type: 'current' });
    }
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
        days.push({ day: i, type: 'next' });
    }

    const prevMonth = () => onDateChange(new Date(year, month - 1, 1));
    const nextMonth = () => onDateChange(new Date(year, month + 1, 1));
    const goToToday = () => onDateChange(new Date());

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

    const getLeavesForDate = (day, type) => {
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
        return leaves.filter(l => {
            const start = l.start_date ? l.start_date.split('T')[0] : '';
            const end = l.end_date ? l.end_date.split('T')[0] : '';
            return start <= dateStr && end >= dateStr;
        });
    };

    const getSelectedLeaveState = (day, type) => {
        if (!selectedLeave || !selectedLeave.start_date || !selectedLeave.end_date) return null;
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
        const start = selectedLeave.start_date.split('T')[0];
        const end = selectedLeave.end_date.split('T')[0];
        if (dateStr >= start && dateStr <= end) {
            return {
                isStart: dateStr === start,
                isEnd: dateStr === end,
                isInBetween: dateStr > start && dateStr < end
            };
        }
        return null;
    };

    return (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col shadow-sm">
            {/* Header: Title Left, Nav Right */}
            <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-github-dark-border">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-github-dark-text leading-none">
                    {displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                
                <div className="flex items-center bg-slate-100/50 dark:bg-github-dark-subtle/50 rounded-xl p-1 border border-slate-200/50 dark:border-github-dark-border shadow-inner">
                    <button 
                        onClick={prevMonth} 
                        className="p-2 hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-github-dark-muted rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                    >
                        <ChevronLeft size={16} strokeWidth={3} />
                    </button>
                    <button 
                        onClick={goToToday} 
                        className="px-4 py-1.5 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all border-x border-slate-200 dark:border-github-dark-border mx-0.5"
                    >
                        Today
                    </button>
                    <button 
                        onClick={nextMonth} 
                        className="p-2 hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-github-dark-muted rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                    >
                        <ChevronRight size={16} strokeWidth={3} />
                    </button>
                </div>
            </div>

            {/* Weekday Labels */}
            <div className="grid grid-cols-7 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/30 px-2">
                {daysOfWeek.map(day => (
                    <div key={day} className="py-4 text-center text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider leading-none">
                        {day}
                    </div>
                ))}
            </div>

            {/* Day Grid */}
            <div className="grid grid-cols-7 p-2 gap-y-1 bg-white dark:bg-dark-card">
                {days.map((dayObj, index) => {
                    const isCurrentMonth = dayObj.type === 'current';
                    const dayHolidays = getHolidaysForDate(dayObj.day, dayObj.type);
                    const dayLeaves = getLeavesForDate(dayObj.day, dayObj.type);
                    const isToday = isCurrentMonth &&
                        dayObj.day === new Date().getDate() &&
                        month === new Date().getMonth() &&
                        year === new Date().getFullYear();

                    const leaveState = getSelectedLeaveState(dayObj.day, dayObj.type);

                    return (
                        <div
                            key={index}
                            className={`
                                aspect-square relative flex flex-col items-center justify-center transition-all group cursor-pointer rounded-xl
                                ${!isCurrentMonth ? 'opacity-30' : ''}
                                ${!leaveState ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}
                            `}
                        >
                            {/* Range Track Background */}
                            {leaveState && (
                                <div className={`absolute top-1/2 -translate-y-1/2 h-8 bg-indigo-100/80 dark:bg-indigo-600/30 z-0
                                    ${leaveState.isStart && leaveState.isEnd ? 'rounded-full left-1 right-1' : ''}
                                    ${leaveState.isStart && !leaveState.isEnd ? 'rounded-l-full left-1 right-0' : ''}
                                    ${leaveState.isEnd && !leaveState.isStart ? 'rounded-r-full left-0 right-1' : ''}
                                    ${leaveState.isInBetween ? 'left-0 right-0' : ''}
                                `} />
                            )}

                            {/* Date Number Circle */}
                            <span className={`
                                w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold transition-all relative z-10
                                ${isToday 
                                    ? 'bg-indigo-600 text-white font-black shadow-lg shadow-indigo-500/30 scale-105' 
                                    : leaveState && (leaveState.isStart || leaveState.isEnd)
                                        ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-500/20 scale-105'
                                        : leaveState && leaveState.isInBetween
                                            ? 'text-indigo-600 dark:text-indigo-400 font-extrabold'
                                            : 'text-slate-700 dark:text-github-dark-text'}
                            `}>
                                {dayObj.day}
                            </span>

                            {/* Indicators: Holidays & Leaves */}
                            <div className="absolute bottom-1.5 flex gap-0.5 justify-center z-20">
                                {dayHolidays.map(holiday => (
                                    <span
                                        key={holiday.id}
                                        className={`w-1 h-1 rounded-full ${holiday.type === 'Public' ? 'bg-purple-500 shadow-purple-500/30' : 'bg-amber-500 shadow-amber-400/30'}`}
                                        title={`Holiday: ${holiday.name}`}
                                    />
                                ))}
                                {dayLeaves.map(leave => (
                                    <span
                                        key={leave.lr_id}
                                        className={`w-1 h-1 rounded-full ${leave.status === 'approved' ? 'bg-indigo-400' : leave.status === 'rejected' ? 'bg-red-400' : 'bg-amber-300'}`}
                                        title={`Leave: ${leave.user_name} (${leave.status})`}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Comprehensive Legend */}
            <div className="p-4 bg-slate-50/50 dark:bg-github-dark-subtle/20 border-t border-slate-100 dark:border-github-dark-border space-y-3">
                <div className="flex justify-center flex-wrap gap-x-6 gap-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm" />
                        <span className="text-[10px] font-black text-slate-500 dark:text-github-dark-muted uppercase tracking-widest">Public</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-sm" />
                        <span className="text-[10px] font-black text-slate-500 dark:text-github-dark-muted uppercase tracking-widest">Optional</span>
                    </div>
                </div>
                {leaves.length > 0 && (
                    <div className="flex justify-center flex-wrap gap-x-6 gap-y-2 pt-2 border-t border-slate-200/40 dark:border-github-dark-border/40">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-sm" />
                            <span className="text-[10px] font-black text-slate-500 dark:text-github-dark-muted uppercase tracking-widest">Approved Leave</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-300 shadow-sm" />
                            <span className="text-[10px] font-black text-slate-500 dark:text-github-dark-muted uppercase tracking-widest">Pending</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HolidayCalendarView;
