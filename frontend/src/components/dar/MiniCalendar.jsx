import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MiniCalendar = ({ selectedDate, onDateSelect }) => {
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
        return d1.toISOString().split('T')[0] === d2.toISOString().split('T')[0];
    };

    const currentSelectedDate = new Date(selectedDate);

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    return (
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 w-full max-w-[280px]">
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-700 text-sm">
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h4>
                <div className="flex gap-1">
                    <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                        <ChevronLeft size={16} />
                    </button>
                    <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                    <div key={day} className="text-[10px] font-bold text-gray-400">{day}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {startPadding.map((_, i) => <div key={`pad-${i}`} />)}

                {days.map((date) => {
                    const isSelected = isSameDay(date, currentSelectedDate);
                    const isToday = isSameDay(date, new Date());

                    return (
                        <button
                            key={date.toISOString()}
                            onClick={() => onDateSelect(date.toISOString().split('T')[0])}
                            className={`
                h-8 w-8 rounded-full flex items-center justify-center text-xs transition-all
                ${isSelected
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                    : 'text-gray-700 hover:bg-gray-100'}
                ${isToday && !isSelected ? 'bg-indigo-50 text-indigo-600 font-bold' : ''}
              `}
                        >
                            {date.getDate()}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default MiniCalendar;
