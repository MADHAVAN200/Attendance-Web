import React, { useMemo, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

const MultiDayTimeline = ({
    tasks,
    startDate, // The starting date for the view
    daysToShow = 7, // Number of rows to show
    attendanceData = {}, // Map of date -> attendance status
    onEditTask
}) => {
    // Config
    const START_HOUR = 8; // 8 AM
    const END_HOUR = 19;  // 7 PM
    const TOTAL_HOURS = END_HOUR - START_HOUR;
    const PIXELS_PER_HOUR = 100; // Width of one hour block (reduced for multi-day density)
    const ROW_HEIGHT = 80;

    const scrollContainerRef = useRef(null);

    const hourMarkers = useMemo(() => {
        return Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);
    }, []);

    // Generate array of dates to show [startDate, startDate+1, ...]
    const dates = useMemo(() => {
        const list = [];
        const start = new Date(startDate);
        for (let i = 0; i < daysToShow; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            list.push(d.toISOString().split('T')[0]);
        }
        return list;
    }, [startDate, daysToShow]);

    // Helper: Convert time "HH:MM" to pixel offset
    const getPositionFromTime = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        const totalMinutes = (h - START_HOUR) * 60 + m;
        return (totalMinutes / 60) * PIXELS_PER_HOUR;
    };

    // Helper: Get width from duration
    const getWidthFromDuration = (startStr, endStr) => {
        const startX = getPositionFromTime(startStr);
        const endX = getPositionFromTime(endStr);
        return Math.max(endX - startX, 20);
    };

    // Helper: Get Current Time details
    const getCurrentTimeIndicator = () => {
        const now = new Date();
        const currentH = now.getHours();
        const currentM = now.getMinutes();

        if (currentH < START_HOUR || currentH > END_HOUR) return null;

        const pos = ((currentH - START_HOUR) * 60 + currentM) / 60 * PIXELS_PER_HOUR;
        return { pos, date: now.toISOString().split('T')[0] };
    }

    const nowIndicator = getCurrentTimeIndicator();

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">

            {/* 1. Header (Hours) */}
            <div className="flex border-b border-gray-200 bg-gray-50/80 backdrop-blur z-10">

                <div className="flex overflow-hidden relative" style={{ width: `${TOTAL_HOURS * PIXELS_PER_HOUR}px` }}> {/* Header width matches body */}
                    {/* We need the header to scroll with the body, so usually we just sync scroll or put it in same container. 
                For simplicity in this tailored implementation, we'll put the header INSIDE scrolling container for X-Axis, 
                and sticky the left column for Y-Axis. 
             */}
                    {/* Wait, standard pattern: 
                - Left Col (Dates) sticky left.
                - Top Row (Hours) sticky top.
             */}
                </div>
            </div>

            {/* Simplified Layout: Main Scroll Area handling both axises */}
            <div className="flex-1 overflow-auto custom-scrollbar relative" ref={scrollContainerRef}>

                {/* Dimensions Wrapper */}
                <div style={{ width: `${TOTAL_HOURS * PIXELS_PER_HOUR + 96}px`, minWidth: '100%' }}>

                    {/* STICKY HEADER ROW (Time Labels) */}
                    <div className="flex sticky top-0 z-30 bg-white border-b border-gray-200">
                        {/* Corner Box */}
                        <div className="w-24 shrink-0 bg-white border-r border-gray-200 sticky left-0 z-40"></div>

                        {/* Hours */}
                        <div className="flex relative h-10 items-center">
                            {hourMarkers.map((hour) => (
                                <div
                                    key={hour}
                                    className="absolute text-[10px] text-gray-400 font-medium pl-1 border-l border-gray-100 h-full flex items-end pb-1"
                                    style={{ left: `${(hour - START_HOUR) * PIXELS_PER_HOUR}px`, width: `${PIXELS_PER_HOUR}px` }}
                                >
                                    {hour > 12 ? hour - 12 + ' PM' : hour + ' AM'}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* BODY ROWS */}
                    <div>
                        {/* Vertical Grid Lines (Background) */}
                        <div className="absolute top-10 bottom-0 left-24 right-0 pointer-events-none z-0">
                            {hourMarkers.map((hour) => (
                                <div
                                    key={`grid-${hour}`}
                                    className="absolute top-0 bottom-0 border-r border-gray-100"
                                    style={{ left: `${(hour - START_HOUR) * PIXELS_PER_HOUR}px` }}
                                />
                            ))}
                            {/* Fixed Lunch Zone (1-2 PM) */}
                            <div
                                className="absolute top-0 bottom-0 bg-gray-50/50 border-x border-gray-100 border-dashed"
                                style={{
                                    left: `${(13 - START_HOUR) * PIXELS_PER_HOUR}px`,
                                    width: `${PIXELS_PER_HOUR}px`
                                }}
                            />
                        </div>

                        {/* Date Rows */}
                        {dates.map((dateStr) => {
                            const dateObj = new Date(dateStr);
                            const isToday = nowIndicator?.date === dateStr;
                            const rowTasks = tasks.filter(t => t.date === dateStr);
                            const att = attendanceData[dateStr];

                            return (
                                <div key={dateStr} className="flex relative border-b border-gray-100 h-24 hover:bg-gray-50/30 transition-colors">

                                    {/* Sticky Date Label */}
                                    <div className="w-24 shrink-0 bg-white border-r border-gray-200 sticky left-0 z-20 flex flex-col justify-center items-center p-2 group">
                                        <span className={`text-[10px] font-bold uppercase ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>
                                            {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </span>
                                        <span className={`text-xl font-light ${isToday ? 'text-indigo-600 bg-indigo-50 w-8 h-8 flex items-center justify-center rounded-full' : 'text-gray-700'}`}>
                                            {dateObj.getDate()}
                                        </span>
                                    </div>

                                    {/* Content Area */}
                                    <div className="relative flex-1 h-full">

                                        {/* Time-In Marker (If exists) */}
                                        {att?.hasTimedIn && att.timeIn && (
                                            <div
                                                className="absolute top-0 bottom-0 border-l-2 border-green-500 z-10"
                                                style={{ left: `${getPositionFromTime(att.timeIn)}px` }}
                                            >
                                                {/* Only show label on hover to reduce clutter in multi-row */}
                                                <div className="bg-green-500 text-white text-[9px] px-1 rounded-r absolute top-0 hidden group-hover:block">
                                                    {att.timeIn}
                                                </div>
                                                {/* Block out previous time if strict */}
                                                {/* <div className="absolute w-[2000px] right-full top-0 bottom-0 bg-gray-100/50 -mr-[1px]" /> */}
                                            </div>
                                        )}

                                        {/* Current Time Line (Vertical red line across specific row?) 
                                    Usually Google Calendar does a vertical line across ALL rows for the current time column,
                                    but here we have dates as rows. So the current time is only relevant on the "Today" row.
                                */}
                                        {isToday && nowIndicator && (
                                            <div
                                                className="absolute top-0 bottom-0 border-l-2 border-red-500 z-20 pointer-events-none"
                                                style={{ left: `${nowIndicator.pos}px` }}
                                            >
                                                <div className="w-2 h-2 bg-red-500 rounded-full absolute -top-1 -left-[5px]" />
                                            </div>
                                        )}

                                        {/* Task Blocks */}
                                        {rowTasks.map(task => {
                                            const left = getPositionFromTime(task.startTime);
                                            const width = getWidthFromDuration(task.startTime, task.endTime);

                                            let bgClass = "bg-blue-100 border-blue-200 text-blue-700";
                                            if (task.type === 'meeting') bgClass = "bg-purple-100 border-purple-200 text-purple-700";

                                            return (
                                                <div
                                                    key={task.id}
                                                    onClick={() => onEditTask(task)}
                                                    className={`absolute top-2 bottom-2 rounded border shadow-sm px-2 py-1 text-xs cursor-pointer z-10 hover:z-20 hover:shadow-md transition-all overflow-hidden ${bgClass}`}
                                                    style={{ left: `${left}px`, width: `${width}px` }}
                                                    title={`${task.title} (${task.startTime} - ${task.endTime})`}
                                                >
                                                    <div className="font-semibold truncate leading-tight">{task.title}</div>
                                                    <div className="text-[9px] opacity-80 hidden group-hover/block:block">{task.startTime} - {task.endTime}</div>
                                                </div>
                                            )
                                        })}

                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MultiDayTimeline;
