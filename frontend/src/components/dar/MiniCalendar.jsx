import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MiniCalendar = ({ selectedDate, endDate, onDateSelect, disableRange = false, maxDate }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

    // Helper: Get days in month
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
    };

    // Helper: Get blank days for padding start of month
    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const days = getDaysInMonth(currentMonth);
    const startPadding = Array.from({ length: getFirstDayOfMonth(currentMonth) });

    const isSameDay = (d1, d2) => {
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    const currentSelectedDate = new Date(selectedDate);

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    // State for drag selection
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const [dragEnd, setDragEnd] = useState(null);

    const formatDate = (date) => {
        const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        return offsetDate.toISOString().split('T')[0];
    };

    const handleMouseDown = (dateStr) => {
        if (disableRange) {
            // Immediate selection for single date mode
            onDateSelect({ start: dateStr, end: dateStr });
            return;
        }
        setIsDragging(true);
        setDragStart(dateStr);
        setDragEnd(dateStr);
    };

    const handleMouseEnter = (dateStr) => {
        if (isDragging && !disableRange) {
            setDragEnd(dateStr);
        }
    };

    const handleMouseUp = () => {
        if (isDragging && dragStart && dragEnd && !disableRange) {
            setIsDragging(false);

            // Determine actual start/end (user might drag backwards)
            const d1 = new Date(dragStart);
            const d2 = new Date(dragEnd);
            const start = d1 < d2 ? dragStart : dragEnd;
            const end = d1 < d2 ? dragEnd : dragStart;

            onDateSelect({ start, end });
        }
    };

    // Helper to check if date is in current drag range
    const rangeStatus = (() => {
        if (!dragStart || !dragEnd) return {};
        const d1 = new Date(dragStart);
        const d2 = new Date(dragEnd);
        const start = d1 < d2 ? dragStart : dragEnd;
        const end = d1 < d2 ? dragEnd : dragStart;
        return { start, end };
    })();

    const { start: rStart, end: rEnd } = rangeStatus;

    return (
        <div
            className="p-4 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-full max-w-[300px] select-none"
            onMouseLeave={() => {
                if (isDragging) handleMouseUp(); // Auto-finalize if leaving calendar
            }}
            onMouseUp={() => {
                if (isDragging) handleMouseUp(); // Catch-all mouseup
            }}
        >
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h4>
                <div className="flex gap-1">
                    <button onClick={prevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded text-gray-500 dark:text-slate-400">
                        <ChevronLeft size={16} />
                    </button>
                    <button onClick={nextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded text-gray-500 dark:text-slate-400">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={`${day}-${i}`} className="text-[10px] font-bold text-gray-400 dark:text-slate-500">{day}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {startPadding.map((_, i) => <div key={`pad-${i}`} />)}

                {days.map((date) => {
                    const dateStr = formatDate(date);
                    const isToday = isSameDay(date, new Date());

                    let isSelected = false;
                    let isRangeStart = false;
                    let isRangeEnd = false;
                    let isInRange = false;

                    // 1. Dragging Phase
                    if (isDragging && rStart && rEnd) {
                        const d = new Date(dateStr);
                        isRangeStart = dateStr === rStart;
                        isRangeEnd = dateStr === rEnd;
                        isInRange = d >= new Date(rStart) && d <= new Date(rEnd);
                        isSelected = isRangeStart || isRangeEnd;
                    }
                    // 2. Persistent View Phase (Props)
                    else {
                        const start = selectedDate;
                        // Use provided endDate or default to start if missing
                        const end = endDate || start;

                        const d = new Date(dateStr);
                        const dStart = new Date(start);
                        const dEnd = new Date(end);

                        // Basic range check
                        isInRange = d >= dStart && d <= dEnd;
                        isRangeStart = dateStr === start;
                        isRangeEnd = dateStr === end;
                        isSelected = isRangeStart || isRangeEnd || (start === end && isRangeStart);

                        // Edge Case: If daysToShow=1 (start==end), treat as single selection
                        if (start === end) {
                            isInRange = false;
                            isRangeStart = false;
                            isRangeEnd = false;
                            isSelected = dateStr === start;
                        }
                    }

                    const isDisabled = maxDate && dateStr > maxDate;

                    return (
                        <div
                            key={dateStr}
                            className={`relative w-8 h-8 flex items-center justify-center`}
                            onMouseDown={() => !isDisabled && handleMouseDown(dateStr)}
                            onMouseEnter={() => !isDisabled && handleMouseEnter(dateStr)}
                        >
                            {/* Range Background Connector */}
                            {isInRange && !isRangeStart && !isDisabled && (
                                <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-indigo-50 dark:bg-indigo-900/50 z-0" />
                            )}
                            {isInRange && !isRangeEnd && !isDisabled && (
                                <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-indigo-50 dark:bg-indigo-900/50 z-0" />
                            )}
                            {isInRange && !isDisabled && (
                                <div className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/50 rounded-full z-0 opacity-50" />
                            )}

                            {/* Date Circle */}
                            <button
                                disabled={isDisabled}
                                className={`
                                    relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all
                                    ${isDisabled ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' :
                                        isSelected
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none scale-105'
                                            : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'}
                                    ${!isSelected && isToday && !isDisabled ? 'bg-indigo-50 dark:bg-transparent text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800' : ''}
                                `}
                            >
                                {date.getDate()}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MiniCalendar;
