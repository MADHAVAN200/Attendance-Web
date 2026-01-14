import React, { useMemo } from 'react';
import { Clock, Plus } from 'lucide-react';

const Timeline = ({
    tasks,
    date,
    attendance,
    onAddTask,
    onEditTask
}) => {
    // Config
    const START_HOUR = 8; // 8 AM
    const END_HOUR = 20;  // 8 PM
    const TOTAL_HOURS = END_HOUR - START_HOUR;
    const PIXELS_PER_HOUR = 120; // Width of one hour block

    // 1-2 PM Lunch Block
    const LUNCH_START = 13;
    const LUNCH_END = 14;

    const hours = useMemo(() => {
        return Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);
    }, []);

    // Helper to convert time "HH:MM" to pixel offset
    const getPositionFromTime = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        const totalMinutes = (h - START_HOUR) * 60 + m;
        return (totalMinutes / 60) * PIXELS_PER_HOUR;
    };

    // Helper to get width from duration
    const getWidthFromDuration = (startStr, endStr) => {
        const startX = getPositionFromTime(startStr);
        const endX = getPositionFromTime(endStr);
        return Math.max(endX - startX, 20); // Min width 20px
    };

    // Current Time Line (if today)
    const currentTimePosition = useMemo(() => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        if (date !== today) return null;

        // Only show if within bounds
        const currentH = now.getHours();
        const currentM = now.getMinutes();
        if (currentH < START_HOUR || currentH > END_HOUR) return null;

        return getPositionFromTime(`${currentH}:${currentM}`);
    }, [date]);

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Header / Controls */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    <Clock size={18} /> Daily Timeline
                </h3>
                <div className="text-sm text-gray-500">
                    Showing 8:00 AM - 8:00 PM
                </div>
            </div>

            {/* Scrollable Timeline Area */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden relative group custom-scrollbar">

                {/* Container with fixed width based on hours */}
                <div
                    className="relative h-full"
                    style={{ width: `${TOTAL_HOURS * PIXELS_PER_HOUR}px`, minWidth: '100%' }}
                >
                    {/* 1. Grid Background (Hours) */}
                    <div className="absolute inset-0 flex h-full pointer-events-none">
                        {hours.map((hour) => (
                            <div
                                key={hour}
                                className="h-full border-r border-gray-100 text-gray-400 text-xs p-1"
                                style={{ width: `${PIXELS_PER_HOUR}px` }}
                            >
                                {hour > 12 ? hour - 12 + ' PM' : hour + ' AM'}
                            </div>
                        ))}
                    </div>

                    {/* 2. Zones (Lunch, Shift, Time-In) */}

                    {/* Lunch Zone (1-2 PM) - Fixed */}
                    <div
                        className="absolute top-0 bottom-0 bg-gray-100/50 flex items-center justify-center border-x border-dashed border-gray-300 z-0"
                        style={{
                            left: `${getPositionFromTime("13:00")}px`,
                            width: `${PIXELS_PER_HOUR}px`
                        }}
                    >
                        <span className="text-gray-400 text-xs font-medium rotate-0 tracking-widest uppercase">Lunch Time</span>
                    </div>

                    {/* Time-In Marker (Start Boundary) */}
                    {attendance?.hasTimedIn && attendance.timeIn && (
                        <div
                            className="absolute top-0 bottom-0 border-l-2 border-green-500 z-10"
                            style={{ left: `${getPositionFromTime(attendance.timeIn)}px` }}
                        >
                            <div className="bg-green-500 text-white text-[10px] px-1 py-0.5 rounded-r absolute top-0">
                                IN: {attendance.timeIn}
                            </div>
                            {/* Overlay for time before Time-In (Restricted Area) */}
                            <div
                                className="absolute top-0 bottom-0 right-0 h-full bg-stripes-gray opacity-10 pointer-events-none"
                                style={{
                                    width: `${getPositionFromTime(attendance.timeIn)}px`,
                                    transform: 'translateX(-100%)'
                                }}
                            />
                        </div>
                    )}

                    {/* Current Time Indicator */}
                    {currentTimePosition !== null && (
                        <div
                            className="absolute top-8 bottom-0 border-l-2 border-red-400 z-20 pointer-events-none"
                            style={{ left: `${currentTimePosition}px` }}
                        >
                            <div className="w-2 h-2 bg-red-400 rounded-full absolute -top-1 -left-[5px]" />
                        </div>
                    )}


                    {/* 3. Tasks Blocks */}
                    <div className="absolute top-12 left-0 right-0 bottom-4 px-0 py-2">
                        {tasks.map((task) => {
                            const left = getPositionFromTime(task.startTime);
                            const width = getWidthFromDuration(task.startTime, task.endTime);

                            let bgClass = "bg-blue-100 border-blue-300 text-blue-700";
                            if (task.type === 'meeting') bgClass = "bg-purple-100 border-purple-300 text-purple-700";
                            if (task.type === 'break') bgClass = "bg-amber-100 border-amber-300 text-amber-700";

                            return (
                                <div
                                    key={task.id}
                                    onClick={() => onEditTask(task)}
                                    className={`absolute top-4 h-24 rounded-md border shadow-sm p-2 cursor-pointer hover:shadow-md transition-all z-10 group/task overflow-hidden ${bgClass}`}
                                    style={{ left: `${left}px`, width: `${width}px` }}
                                >
                                    <div className="font-semibold text-xs truncate">{task.title}</div>
                                    <div className="text-[10px] opacity-80">{task.startTime} - {task.endTime}</div>
                                    <div className="text-[10px] mt-1 leading-tight line-clamp-2 opacity-70">
                                        {task.description}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                </div>
            </div>

            {/* Legend / Info */}
            <div className="p-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex gap-4 px-4">
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div> Task</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded"></div> Meeting</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-100 border-dashed border-gray-300"></div> Lunch</span>
            </div>
        </div>
    );
};

export default Timeline;
