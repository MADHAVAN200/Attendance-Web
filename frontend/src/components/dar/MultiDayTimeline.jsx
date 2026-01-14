import React, { useMemo, useRef } from 'react';

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
    const PIXELS_PER_HOUR = 100; // Width of one hour block
    // We increase row height slightly to accommodate stacking "2 row thingy" beautifully
    const ROW_MIN_HEIGHT = 110;

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

    // Helper: Parse time "H:MM" or "HH:MM" to total minutes from midnight
    // e.g., "9:30" -> 570, "13:00" -> 780
    const getMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    // Helper: Convert time "HH:MM" to pixel offset based on START_HOUR
    const getPositionFromTime = (timeStr) => {
        const totalMinutes = getMinutes(timeStr);
        const startMinutes = START_HOUR * 60;
        // If before start time, clamp to 0 (or handle otherwise if needed)
        const offsetMinutes = Math.max(0, totalMinutes - startMinutes);
        return (offsetMinutes / 60) * PIXELS_PER_HOUR;
    };

    // Helper: Get width from duration
    const getWidthFromDuration = (startStr, endStr) => {
        const startMin = getMinutes(startStr);
        const endMin = getMinutes(endStr);
        const durationMin = endMin - startMin;

        // Convert to pixels
        const width = (durationMin / 60) * PIXELS_PER_HOUR;
        return Math.max(width, 20); // Min width 20px
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

    /**
     * Algorithm to arrange tasks into vertical "lanes" to avoid overlap.
     * Returns list of tasks with { ...task, laneIndex, totalLanes }
     */
    const arrangeTasks = (dayTasks) => {
        if (!dayTasks || dayTasks.length === 0) return { tasks: [], maxLanes: 1 };

        // 1. Sort by Start Time (earliest first), then by Duration (longest first)
        const sorted = [...dayTasks].sort((a, b) => {
            const startA = getMinutes(a.startTime);
            const startB = getMinutes(b.startTime);
            if (startA !== startB) return startA - startB; // Earliest start time first

            const durA = getMinutes(a.endTime) - startA;
            const durB = getMinutes(b.endTime) - startB;
            return durB - durA; // Longest duration first
        });

        // 2. Assign Lanes
        // Lanes array stores the 'end position' (in minutes) of the last task placed in that lane
        const lanes = [];

        const arranged = sorted.map(task => {
            const startMin = getMinutes(task.startTime);
            const endMin = getMinutes(task.endTime);

            let placed = false;
            let laneIdx = 0;

            // Try to fit in existing lanes
            for (let i = 0; i < lanes.length; i++) {
                // If lane is free (lane's last task end time <= current task start time)
                if (lanes[i] <= startMin) {
                    lanes[i] = endMin;
                    laneIdx = i;
                    placed = true;
                    break;
                }
            }

            // If not placed, create new lane
            if (!placed) {
                lanes.push(endMin);
                laneIdx = lanes.length - 1;
            }

            return { ...task, laneIndex: laneIdx };
        });

        const maxLanes = lanes.length;

        return {
            tasks: arranged.map(t => ({ ...t, totalLanes: maxLanes })),
            maxLanes
        };
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">

            {/* Header (Hours) */}
            <div className="flex border-b border-gray-200 bg-gray-50/80 backdrop-blur z-10">
                <div className="flex overflow-hidden relative" style={{ width: `${TOTAL_HOURS * PIXELS_PER_HOUR}px` }}>
                    {/* Header logic handled inside main scroll for alignment */}
                </div>
            </div>

            {/* Main Scroll Area */}
            <div className="flex-1 overflow-auto custom-scrollbar relative" ref={scrollContainerRef}>

                {/* Dimensions Wrapper */}
                <div style={{ width: `${TOTAL_HOURS * PIXELS_PER_HOUR + 96}px`, minWidth: '100%' }}>

                    {/* STICKY HEADER ROW (Time Labels) */}
                    <div className="flex sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm h-10">
                        {/* Corner Box */}
                        <div className="w-24 shrink-0 bg-white border-r border-gray-200 sticky left-0 z-40 shadow-[1px_0_5px_rgba(0,0,0,0.05)]"></div>

                        {/* Hours */}
                        <div className="flex relative h-full items-center">
                            {hourMarkers.map((hour) => (
                                <div
                                    key={hour}
                                    className="absolute text-[10px] text-gray-400 font-medium pl-1 border-l border-gray-100 h-full flex items-end pb-2"
                                    style={{ left: `${(hour - START_HOUR) * PIXELS_PER_HOUR}px`, width: `${PIXELS_PER_HOUR}px` }}
                                >
                                    {hour > 12 ? hour - 12 + ' PM' : hour + ' AM'}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* BODY ROWS */}
                    <div className="relative">
                        {/* Vertical Grid Lines (Background) */}
                        <div className="absolute top-0 bottom-0 left-24 right-0 pointer-events-none z-0">
                            {hourMarkers.map((hour) => (
                                <div
                                    key={`grid-${hour}`}
                                    className="absolute top-0 bottom-0 border-r border-gray-100 dark:border-gray-800"
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
                            >
                                <div className="hidden h-full flex items-center justify-center">
                                    <span className="text-[10px] text-gray-300 font-medium -rotate-90">LUNCH</span>
                                </div>
                            </div>
                        </div>

                        {/* Date Rows */}
                        {dates.map((dateStr) => {
                            const dateObj = new Date(dateStr);
                            const isToday = nowIndicator?.date === dateStr;
                            const att = attendanceData[dateStr];

                            // Prep Tasks
                            const rawTasks = tasks.filter(t => t.date === dateStr);
                            const { tasks: rowTasks, maxLanes } = arrangeTasks(rawTasks);

                            return (
                                <div key={dateStr}
                                    className="flex relative border-b border-gray-100 transition-colors group/row"
                                    style={{ height: `${ROW_MIN_HEIGHT}px` }}
                                >

                                    {/* Sticky Date Label */}
                                    <div className="w-24 shrink-0 bg-white border-r border-gray-200 sticky left-0 z-20 flex flex-col justify-center items-center p-2 group shadow-[1px_0_5px_rgba(0,0,0,0.05)]">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>
                                            {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </span>
                                        <div className={`w-9 h-9 flex items-center justify-center rounded-full text-lg ${isToday ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 hover:scale-105 transition-transform' : 'text-gray-700 font-light'}`}>
                                            {dateObj.getDate()}
                                        </div>
                                    </div>

                                    {/* Content Area */}
                                    <div className="relative flex-1 h-full">

                                        {/* Row Hover Highlight (Background) */}
                                        <div className="absolute inset-0 bg-gray-50/0 group-hover/row:bg-gray-50/30 transition-colors pointer-events-none" />

                                        {/* Time-In Marker */}
                                        {att?.hasTimedIn && att.timeIn && (
                                            <div
                                                className="absolute top-0 bottom-0 border-l-2 border-emerald-500 z-10"
                                                style={{ left: `${getPositionFromTime(att.timeIn)}px` }}
                                            >
                                                <div className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-r absolute top-0 shadow-sm opacity-0 group-hover/row:opacity-100 transition-opacity whitespace-nowrap z-30">
                                                    IN {att.timeIn}
                                                </div>
                                            </div>
                                        )}

                                        {/* Current Time Line */}
                                        {isToday && nowIndicator && (
                                            <div
                                                className="absolute top-0 bottom-0 border-l-2 border-red-500 z-20 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                                style={{ left: `${nowIndicator.pos}px` }}
                                            >
                                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full absolute -top-1.5 -left-[5px] ring-2 ring-white" />
                                            </div>
                                        )}

                                        {/* Task Blocks */}
                                        {rowTasks.map(task => {
                                            const left = getPositionFromTime(task.startTime);
                                            const width = getWidthFromDuration(task.startTime, task.endTime);

                                            // Stacking Logic:
                                            const totalHeight = ROW_MIN_HEIGHT - 8; // 8px total vertical padding in row
                                            const itemHeight = totalHeight / maxLanes;
                                            const topPos = 4 + (task.laneIndex * itemHeight);

                                            let bgClass = "bg-blue-100/90 border-blue-200 text-blue-700 hover:bg-blue-100";
                                            if (task.type === 'meeting') bgClass = "bg-purple-100/90 border-purple-200 text-purple-700 hover:bg-purple-100";
                                            if (task.type === 'break') bgClass = "bg-amber-100/90 border-amber-200 text-amber-700 hover:bg-amber-100";

                                            return (
                                                <div
                                                    key={task.id}
                                                    onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                                    className={`absolute rounded-md border shadow-sm px-2 py-1.5 text-xs cursor-pointer z-10 hover:z-20 hover:shadow-md transition-all overflow-hidden flex flex-col group/task ${bgClass}`}
                                                    style={{
                                                        left: `${left}px`,
                                                        width: `${width}px`,
                                                        top: `${topPos}px`,
                                                        height: `${itemHeight - 2}px` // -2 for slight gap between stacked items
                                                    }}
                                                    title={`${task.title} (${task.startTime} - ${task.endTime})`}
                                                >
                                                    {/* Title (Dynamic Size) */}
                                                    <div className={`font-bold leading-tight truncate ${maxLanes > 1 || width < 60 ? 'text-[10px]' : 'text-sm'}`}>
                                                        {task.title || "(No Title)"}
                                                    </div>

                                                    {/* Time (Hide if narrow) */}
                                                    {itemHeight > 35 && width > 60 && (
                                                        <div className={`opacity-80 mt-1.5 font-medium flex items-center gap-1 ${maxLanes > 1 ? 'text-[9px]' : 'text-[10px]'}`}>
                                                            <span>{task.startTime} - {task.endTime}</span>
                                                        </div>
                                                    )}

                                                    {/* Description (Hide if narrow OR Stacked) */}
                                                    {itemHeight > 50 && width > 60 && maxLanes === 1 && task.description && (
                                                        <div className={`opacity-75 mt-1 leading-normal line-clamp-3 text-[10px]`}>
                                                            {task.description}
                                                        </div>
                                                    )}
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
