
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Calendar, Download, Users, Building, Clock
} from 'lucide-react';
import MinimalSelect from "../../MinimalSelect"; // Ensure path is correct relative to new location
import MiniCalendar from '../MiniCalendar'; // Ensure path is correct relative to new location
import api from '../../../services/api'; // Ensure path is correct relative to new location
import { toast } from 'react-toastify';

const MasterDataView = ({ departments, shifts, allUsers }) => {
    // Helper to get local YYYY-MM-DD
    const getLocalToday = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // General Helper for any date
    const getLocalDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [dateRange, setDateRange] = useState({ start: getLocalToday(), end: getLocalToday() });
    const [loadingData, setLoadingData] = useState(false);
    const [timelineData, setTimelineData] = useState([]);
    const [selectedShift, setSelectedShift] = useState(''); // Name of shift
    const [currentShift, setCurrentShift] = useState({ start: 8, end: 18 }); // Default View Range

    // Filters
    const [selectedDepartment, setSelectedDepartment] = useState("All Departments");
    const [selectedEmployee, setSelectedEmployee] = useState("All Employees");
    const [employeesList, setEmployeesList] = useState([]);

    // Calendar Popup State
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarPos, setCalendarPos] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);

    const toggleCalendar = () => {
        if (!showCalendar && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setCalendarPos({
                top: rect.bottom + 8,
                left: rect.left
            });
        }
        setShowCalendar(!showCalendar);
    };

    // Set default when shifts load
    useEffect(() => {
        if (!selectedShift && shifts.length > 0) {
            setSelectedShift(shifts[0].shift_name);
        }
    }, [shifts, selectedShift]);

    // Update Timeline Range when Shift Changes
    useEffect(() => {
        if (!selectedShift || shifts.length === 0) return;

        let targetShift = shifts.find(s => s.shift_name === selectedShift);
        if (!targetShift) targetShift = shifts[0]; // Fallback

        if (targetShift) {
            try {
                // Parse policy_rules
                const rules = typeof targetShift.policy_rules === 'string'
                    ? JSON.parse(targetShift.policy_rules)
                    : targetShift.policy_rules;

                const startStr = rules?.shift_timing?.start_time || "09:00";
                const endStr = rules?.shift_timing?.end_time || "18:00";

                let startH = parseInt(startStr.split(':')[0]);
                let endH = parseInt(endStr.split(':')[0]);

                // Handle Overnight Shifts (e.g. 18:00 to 02:00)
                if (endH < startH) {
                    endH += 24;
                }

                // Set timeline to -1hr start and +1hr end
                setCurrentShift({
                    start: Math.max(0, startH - 1),
                    end: endH + 1
                });

            } catch (e) {
                console.error("Error parsing shift rules", e);
                setCurrentShift({ start: 8, end: 18 });
            }
        }
    }, [selectedShift, shifts]);

    // Dynamic Employee List based on Selected Dept & Shift
    useEffect(() => {
        let filtered = allUsers;

        // 1. Filter by Department
        if (selectedDepartment !== "All Departments") {
            filtered = filtered.filter(u => u.dept === selectedDepartment);
        }

        // 2. Filter by Shift
        if (selectedShift) {
            filtered = filtered.filter(u => u.shift === selectedShift);
        }

        setEmployeesList(filtered.map(u => u.name));
    }, [selectedDepartment, selectedShift, allUsers]);

    const fetchMasterData = async () => {
        setLoadingData(true);
        try {
            // Parallel Fetch: Activities, Attendance, Holidays, Events
            const [res, attRes, holRes, eventsRes] = await Promise.all([
                api.get(`/dar/activities/admin/all?startDate=${dateRange.start}&endDate=${dateRange.end}`),
                api.get(`/attendance/records/admin`, { params: { date_from: dateRange.start, date_to: dateRange.end, limit: 1000 } }),
                api.get('/holiday'),
                api.get('/dar/events/list', { params: { date_from: dateRange.start, date_to: dateRange.end } })
            ]);

            if (res.data.ok) {
                // Process Holidays
                const holidayMap = {}; // date -> name
                if (holRes.data?.holidays) {
                    holRes.data.holidays.forEach(h => {
                        holidayMap[h.holiday_date] = h.holiday_name;
                    });
                }

                const todayStr = getLocalDate(new Date());

                // Process Attendance efficiently
                const attendanceMap = {};
                if (attRes.data?.data) {
                    attRes.data.data.forEach(att => {
                        if (!att.time_in) return;
                        const cleanTime = att.time_in.replace('T', ' ');
                        const [datePart, timePart] = cleanTime.split(' ');
                        if (!datePart || !timePart) return;

                        const [h, m] = timePart.split(':').map(Number);
                        const dec = h + (m / 60);

                        attendanceMap[`${att.user_id}-${datePart}`] = {
                            hasTimedIn: true,
                            timeInDecimal: dec,
                            timeInStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                        };
                    });
                }

                // Group activities
                const grouped = {};

                // Helper inside fetchMasterData scope
                const parseTimeHelper = (t) => {
                    const [h, m] = t.split(':').map(Number);
                    return h + (m / 60);
                };

                res.data.data.forEach(a => {
                    const localDate = getLocalDate(new Date(a.activity_date));
                    const key = `${a.user_id}-${localDate}`;

                    if (!grouped[key]) {
                        grouped[key] = {
                            id: key,
                            userId: a.user_id,
                            name: a.user_name,
                            role: a.user_role || 'Employee',
                            date: localDate,
                            dept: a.user_dept,
                            shift: a.user_shift_name,
                            activities: [],
                            isHoliday: !!holidayMap[localDate],
                            holidayName: holidayMap[localDate],
                            isAbsent: false,
                            attendance: attendanceMap[`${a.user_id}-${localDate}`]
                        };
                    }

                    grouped[key].activities.push({
                        id: a.id,
                        start: parseTimeHelper(a.start_time),
                        end: parseTimeHelper(a.end_time),
                        category: a.activity_type,
                        title: a.title || 'Task'
                    });
                });

                // Process Events
                const userMap = {};
                allUsers.forEach(u => userMap[u.userId] = u);

                if (eventsRes.data?.data) {
                    eventsRes.data.data.forEach(e => {
                        const key = `${e.user_id}-${e.event_date}`;

                        if (!grouped[key]) {
                            const u = userMap[e.user_id];
                            if (u) {
                                grouped[key] = {
                                    id: key,
                                    userId: u.userId,
                                    name: u.name,
                                    role: u.role || 'Employee',
                                    date: e.event_date,
                                    dept: u.dept,
                                    shift: u.shift,
                                    activities: [],
                                    isHoliday: !!holidayMap[e.event_date],
                                    holidayName: holidayMap[e.event_date],
                                    isAbsent: (e.event_date < todayStr) && !holidayMap[e.event_date] && !attendanceMap[`${e.user_id}-${e.event_date}`],
                                    attendance: attendanceMap[`${e.user_id}-${e.event_date}`]
                                };
                            }
                        }

                        if (grouped[key]) {
                            const parseTime = (t) => {
                                if (!t) return 0;
                                const [h, m] = t.split(':').map(Number);
                                return h + (m / 60);
                            };

                            grouped[key].activities.push({
                                id: `evt-${e.event_id}`,
                                start: parseTime(e.start_time),
                                end: parseTime(e.end_time),
                                category: (e.type || '').toUpperCase(),
                                title: e.title,
                                isEvent: true,
                                location: e.location
                            });
                        }
                    });
                }

                // Backfill Gaps
                const dates = [];
                let d = new Date(dateRange.start);
                const e = new Date(dateRange.end);
                while (d <= e) {
                    dates.push(getLocalDate(d));
                    d.setDate(d.getDate() + 1);
                }

                allUsers.forEach(u => {
                    dates.forEach(dateStr => {
                        const key = `${u.userId}-${dateStr}`;
                        const isHol = !!holidayMap[dateStr];
                        const attData = attendanceMap[`${u.userId}-${dateStr}`];
                        const hasAtt = !!attData;
                        const isPast = dateStr < todayStr;
                        const isAbsent = isPast && !isHol && !hasAtt;

                        if (!grouped[key]) {
                            grouped[key] = {
                                id: key,
                                userId: u.userId,
                                name: u.name,
                                role: u.role || 'Employee',
                                date: dateStr,
                                dept: u.dept,
                                shift: u.shift,
                                activities: [],
                                isHoliday: isHol,
                                holidayName: holidayMap[dateStr],
                                isAbsent: isAbsent,
                                attendance: attData
                            };
                        } else {
                            grouped[key].isHoliday = isHol;
                            grouped[key].holidayName = holidayMap[dateStr];
                            grouped[key].isAbsent = isAbsent;
                            if (!grouped[key].attendance) grouped[key].attendance = attData;
                        }
                    });
                });

                const sorted = Object.values(grouped).sort((a, b) => {
                    if (a.name === b.name) return new Date(b.date) - new Date(a.date);
                    return a.name.localeCompare(b.name);
                });
                setTimelineData(sorted);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load timeline data");
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchMasterData();
    }, [dateRange, allUsers]);

    const filteredTimelineData = timelineData.filter(user => {
        if (selectedDepartment !== "All Departments" && user.dept !== selectedDepartment) return false;
        if (selectedShift && user.shift !== selectedShift) return false;
        if (selectedEmployee !== "All Employees" && user.name !== selectedEmployee) return false;
        return true;
    });

    const timeSlots = [];
    for (let i = currentShift.start; i <= currentShift.end; i++) {
        timeSlots.push(i);
    }

    const formatTime = (val) => {
        const normalized = val >= 24 ? val - 24 : val;
        const h = Math.floor(normalized);
        const m = (normalized - h) * 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}${m > 0 ? ':' + m : ''} ${ampm}`;
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">

            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap gap-4 items-center justify-between bg-white dark:bg-dark-card z-20">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <MinimalSelect
                            icon={Clock}
                            placeholder="Shift"
                            options={shifts.map(s => s.shift_name)}
                            value={selectedShift}
                            onChange={(val) => setSelectedShift(val)}
                        />
                    </div>
                </div>

                <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>

                {/* Date Picker using MiniCalendar (Portal) */}
                <div className="relative">
                    <button
                        ref={buttonRef}
                        onClick={toggleCalendar}
                        className="flex items-center gap-2 pl-3 pr-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                    >
                        <Calendar size={16} className="text-indigo-500" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {dateRange.start === dateRange.end
                                ? new Date(dateRange.start).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                                : `${new Date(dateRange.start).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} - ${new Date(dateRange.end).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`
                            }
                        </span>
                    </button>

                    {showCalendar && createPortal(
                        <div className="fixed inset-0 z-[9999] isolate">
                            <div
                                className="fixed inset-0 bg-transparent"
                                onClick={() => setShowCalendar(false)}
                            />
                            <div
                                className="fixed z-[10000] drop-shadow-2xl"
                                style={{
                                    top: calendarPos.top,
                                    left: calendarPos.left,
                                    maxWidth: '350px'
                                }}
                            >
                                <MiniCalendar
                                    selectedDate={dateRange.start}
                                    startDate={dateRange.start}
                                    endDate={dateRange.end}
                                    maxDate={new Date().toISOString().split('T')[0]}
                                    onDateSelect={(range) => {
                                        setDateRange({ start: range.start, end: range.end });
                                        setShowCalendar(false);
                                    }}
                                />
                            </div>
                        </div>,
                        document.body
                    )}
                </div>

                <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                    <MinimalSelect
                        icon={Building}
                        placeholder="Department"
                        options={["All Departments", ...departments]}
                        value={selectedDepartment}
                        onChange={setSelectedDepartment}
                        searchable
                    />
                    <MinimalSelect
                        icon={Users}
                        placeholder="Employee"
                        options={["All Employees", ...employeesList]}
                        value={selectedEmployee}
                        onChange={setSelectedEmployee}
                        searchable
                    />
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 mr-4">
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-indigo-200 dark:bg-indigo-900/50"></div>
                            <span className="text-xs text-slate-500">Task Logged</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-dashed"></div>
                            <span className="text-xs text-slate-500">Empty</span>
                        </div>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors">
                        <Download size={16} /> Export
                    </button>
                </div>
            </div>

            {/* Timeline Grid */}
            <div className="flex-1 overflow-auto relative custom-scrollbar">
                <div className="min-w-[800px]">
                    {/* Table Header (Time Slots) */}
                    <div className="flex border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                        <div className="w-48 p-3 text-xs font-bold text-slate-500 uppercase flex-shrink-0 sticky left-0 bg-slate-50 dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 z-20">
                            Employee
                        </div>
                        <div className="flex-1 flex">
                            {timeSlots.map(hour => (
                                <div key={hour} className="flex-1 min-w-[60px] p-3 text-center border-r border-dashed border-slate-200 dark:border-slate-700/50 last:border-none">
                                    <span className="text-[10px] font-bold text-slate-500">{formatTime(hour)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredTimelineData.map(user => (
                            <div key={user.id} className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                {/* User Info Column */}
                                <div className="w-48 p-4 flex flex-col justify-center border-r border-slate-100 dark:border-slate-700 flex-shrink-0 sticky left-0 bg-white dark:bg-dark-card group-hover:bg-slate-50 dark:group-hover:bg-slate-800 z-10">
                                    <span className="text-sm font-bold text-slate-800 dark:text-white truncate">{user.name}</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">
                                            {new Date(user.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                    {user.isHoliday ? (
                                        <span className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Holiday
                                        </span>
                                    ) : user.isAbsent ? (
                                        <span className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Absent
                                        </span>
                                    ) : user.activities.length === 0 && (
                                        <span className="text-[10px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> No DAR
                                        </span>
                                    )}
                                </div>

                                {/* Time Slots & Bars */}
                                <div className="flex-1 flex relative py-2">
                                    {/* Background Grid Lines */}
                                    {timeSlots.map(hour => (
                                        <div key={hour} className="flex-1 min-w-[60px] border-r border-dashed border-slate-100 dark:border-slate-700/30 h-full absolute" style={{
                                            left: `${((hour - currentShift.start) / (currentShift.end - currentShift.start + 1)) * 100}%`,
                                            width: `${(1 / (currentShift.end - currentShift.start + 1)) * 100}%`
                                        }}></div>
                                    ))}

                                    {/* Activities Bars or STATUS OVERLAY */}
                                    <div className="relative w-full h-full min-h-[50px]">
                                        {/* 1. Holiday Overlay (Background) */}
                                        {user.isHoliday && (
                                            <div className="absolute inset-x-0 inset-y-1 bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-lg flex items-center justify-center pointer-events-none z-0">
                                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase opacity-80">{user.holidayName || "HOLIDAY"}</span>
                                            </div>
                                        )}

                                        {/* 2. Absent Overlay (Background) - Exclusive to No Holiday */}
                                        {!user.isHoliday && user.isAbsent && (
                                            <div className="absolute inset-x-0 inset-y-1 bg-red-50/50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg flex items-center justify-center pointer-events-none z-0">
                                                <span className="text-xs font-bold text-red-500 dark:text-red-400 tracking-widest uppercase opacity-80">ABSENT</span>
                                            </div>
                                        )}

                                        {/* 3. Time-In Marker (Z-Index 20) */}
                                        {user.attendance?.hasTimedIn && (
                                            <div
                                                className="absolute inset-y-0 border-l-2 border-emerald-500 z-20 group/marker"
                                                style={{
                                                    left: `${((user.attendance.timeInDecimal - currentShift.start) / (currentShift.end - currentShift.start + 1)) * 100}%`
                                                }}
                                            >
                                                <div className="absolute top-0 left-0.5 bg-emerald-500 text-white text-[9px] font-bold px-1 py-0.5 rounded shadow-sm opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                                    IN {user.attendance.timeInStr}
                                                </div>
                                            </div>
                                        )}

                                        {/* 4. Activities (Z-Index 10) - ONLY SHOW IF NOT ABSENT */}
                                        {!user.isAbsent && user.activities.map(act => {
                                            // Calculate positioning
                                            let actStart = act.start;
                                            let actEnd = act.end;

                                            if (currentShift.end > 24) {
                                                if (actStart < currentShift.start) actStart += 24;
                                                if (actEnd < currentShift.start) actEnd += 24;
                                                if (actEnd < actStart) actEnd += 24;
                                            }

                                            const totalHours = currentShift.end - currentShift.start + 1;
                                            const offset = actStart - currentShift.start;
                                            const duration = actEnd - actStart;

                                            if (actEnd <= currentShift.start || actStart >= currentShift.end + 1) return null;

                                            const leftPct = (offset / totalHours) * 100;
                                            const widthPct = (duration / totalHours) * 100;

                                            // Dynamic Styles based on Category
                                            let bgClass = "bg-indigo-100 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700/50";
                                            let textClass = "text-indigo-700 dark:text-indigo-300";
                                            let subTextClass = "text-indigo-500 dark:text-indigo-400";

                                            const cat = (act.category || '').toUpperCase();
                                            if (cat === 'MEETING') {
                                                bgClass = "bg-purple-100 dark:bg-purple-900/40 border-purple-200 dark:border-purple-700/50";
                                                textClass = "text-purple-700 dark:text-purple-300";
                                                subTextClass = "text-purple-500 dark:text-purple-400";
                                            } else if (cat === 'EVENT') {
                                                bgClass = "bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700/50";
                                                textClass = "text-blue-700 dark:text-blue-300";
                                                subTextClass = "text-blue-500 dark:text-blue-400";
                                            } else if (cat === 'BREAK') {
                                                bgClass = "bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-700/50";
                                                textClass = "text-amber-700 dark:text-amber-300";
                                                subTextClass = "text-amber-500 dark:text-amber-400";
                                            }

                                            return (
                                                <div
                                                    key={act.id}
                                                    className={`absolute inset-y-1 rounded-lg border flex items-center px-2 overflow-hidden hover:z-10 hover:scale-[1.02] transition-all cursor-pointer shadow-sm z-10 ${bgClass}`}
                                                    style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.min(100, widthPct)}%` }}
                                                    title={`${act.title} (${act.category})\n${formatTime(act.start)} - ${formatTime(act.end)}`}
                                                >
                                                    <div className="flex flex-col overflow-hidden">
                                                        <span className={`text-[10px] font-bold truncate leading-tight ${textClass}`}>{act.title}</span>
                                                        <span className={`text-[9px] truncate uppercase tracking-wider ${subTextClass}`}>{act.category}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MasterDataView;
