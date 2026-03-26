
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Calendar, Download, Users, Building, Clock, FileText
} from 'lucide-react';
import MinimalSelect from "../../MinimalSelect"; // Ensure path is correct relative to new location
import MiniCalendar from '../MiniCalendar'; // Ensure path is correct relative to new location
import api from '../../../services/api'; // Ensure path is correct relative to new location
import { toast } from 'react-toastify';

function shiftDateYMD(dateStr, deltaDays) {
    const base = new Date(`${dateStr}T00:00:00`);
    base.setDate(base.getDate() + deltaDays);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function buildRangeByMode(anchorDate, mode) {
    if (mode === 'week') {
        return { start: shiftDateYMD(anchorDate, -6), end: anchorDate };
    }
    if (mode === 'month') {
        return { start: shiftDateYMD(anchorDate, -29), end: anchorDate };
    }
    return { start: anchorDate, end: anchorDate };
}

function enumerateDates(startDate, endDate) {
    if (!startDate || !endDate) return [];
    const dates = [];
    let cursor = startDate;
    while (cursor <= endDate) {
        dates.push(cursor);
        cursor = shiftDateYMD(cursor, 1);
    }
    return dates;
}

const MasterDataView = ({ departments, shifts, allUsers }) => {
    // Helper to get local YYYY-MM-DD
    const getLocalToday = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [dateRange, setDateRange] = useState({ start: getLocalToday(), end: getLocalToday() });
    const [timeMode, setTimeMode] = useState('day');
    const [loadingData, setLoadingData] = useState(false);
    const [timelineData, setTimelineData] = useState([]);
    const [summaryByQuery, setSummaryByQuery] = useState({});
    const [openSummaryRows, setOpenSummaryRows] = useState({});
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
            const selectedStart = dateRange.start;
            const selectedEnd = dateRange.end;

            // Parallel Fetch: Activities, Attendance, Holidays, Events
            const [res, attRes, holRes, eventsRes] = await Promise.all([
                api.get(`/dar/activities/admin/all?startDate=${selectedStart}&endDate=${selectedEnd}`),
                api.get(`/attendance/records/admin`, { params: { date_from: selectedStart, date_to: selectedEnd, limit: 1000 } }),
                api.get('/holiday'),
                api.get('/dar/events/admin/all', { params: { date_from: selectedStart, date_to: selectedEnd } })
            ]);

            if (res.data.ok) {
                // Process Holidays
                const holidayMap = {}; // date -> name
                if (holRes.data?.holidays) {
                    holRes.data.holidays.forEach(h => {
                        holidayMap[h.holiday_date] = h.holiday_name;
                    });
                }

                // Process Attendance efficiently
                const attendanceMap = {};
                if (attRes.data?.data) {
                    attRes.data.data.forEach(att => {
                        if (!att.time_in) return;
                        const cleanTime = att.time_in.replace('T', ' ');
                        const [datePart, timePart] = cleanTime.split(' ');
                        if (!datePart || !timePart) return;
                        if (datePart < selectedStart || datePart > selectedEnd) return;

                        const [h, m] = timePart.split(':').map(Number);
                        const dec = h + (m / 60);

                        const key = `${att.user_id}-${datePart}`;
                        const status = String(att.status || '').toUpperCase();
                        const existing = attendanceMap[key];

                        if (!existing || dec < existing.timeInDecimal) {
                            attendanceMap[key] = {
                                hasTimedIn: true,
                                timeInDecimal: dec,
                                timeInStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
                                status
                            };
                        } else if (!existing.status && status) {
                            existing.status = status;
                        }
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
                    const localDate = String(a.activity_date || '').split('T')[0];
                    if (!localDate) return;
                    if (localDate < selectedStart || localDate > selectedEnd) return;
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
                        title: a.title || 'Task',
                        activityDate: localDate
                    });
                });

                // Process Events
                const userMap = {};
                allUsers.forEach(u => userMap[u.userId] = u);

                if (eventsRes.data?.data) {
                    eventsRes.data.data.forEach(e => {
                        const eventDate = String(e.event_date || '').split('T')[0];
                        if (!eventDate || eventDate < selectedStart || eventDate > selectedEnd) return;

                        const key = `${e.user_id}-${eventDate}`;

                        if (!grouped[key]) {
                            const u = userMap[e.user_id];
                            if (u) {
                                grouped[key] = {
                                    id: key,
                                    userId: u.userId,
                                    name: u.name,
                                    role: u.role || 'Employee',
                                    date: eventDate,
                                    dept: u.dept,
                                    shift: u.shift,
                                    activities: [],
                                    isHoliday: !!holidayMap[eventDate],
                                    holidayName: holidayMap[eventDate],
                                    isAbsent: false,
                                    attendance: attendanceMap[`${e.user_id}-${eventDate}`]
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
                                location: e.location,
                                activityDate: eventDate
                            });
                        }
                    });
                }

                // Backfill Gaps
                const dates = [];
                let cursor = selectedStart;
                while (cursor <= selectedEnd) {
                    dates.push(cursor);
                    cursor = shiftDateYMD(cursor, 1);
                }

                allUsers.forEach(u => {
                    dates.forEach(dateStr => {
                        const key = `${u.userId}-${dateStr}`;
                        const isHol = !!holidayMap[dateStr];
                        const attData = attendanceMap[`${u.userId}-${dateStr}`];
                        const isAbsent = false;

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

                // Final absence pass: do not label as absent when DAR/Event activities exist.
                Object.values(grouped).forEach((item) => {
                    const hasActivities = Array.isArray(item.activities) && item.activities.length > 0;
                    const explicitAbsent = String(item.attendance?.status || '').toUpperCase() === 'ABSENT';
                    item.isAbsent = !item.isHoliday && !hasActivities && explicitAbsent;
                });

                // Re-aggregate data if not in 'day' mode
                let finalData = Object.values(grouped);
                if (timeMode !== 'day') {
                    const aggregated = {};
                    Object.values(grouped).forEach((item) => {
                        const key = item.userId;
                        if (!aggregated[key]) {
                            aggregated[key] = {
                                id: key,
                                userId: item.userId,
                                name: item.name,
                                role: item.role,
                                dateStart: item.date,
                                dateEnd: item.date,
                                dept: item.dept,
                                shift: item.shift,
                                activities: [],
                                holidayDates: [],
                                absentDates: []
                            };
                        }
                        aggregated[key].dateEnd = item.date;
                        aggregated[key].activities.push(...item.activities);
                        if (item.isHoliday) {
                            aggregated[key].holidayDates.push(item.date);
                        }
                        if (item.isAbsent) {
                            aggregated[key].absentDates.push(item.date);
                        }
                    });

                    // Set isHoliday and isAbsent flags based on aggregated dates
                    Object.values(aggregated).forEach((item) => {
                        item.isHoliday = item.holidayDates.length > 0;
                        item.isAbsent = item.absentDates.length > 0 && item.holidayDates.length === 0;
                    });

                    finalData = Object.values(aggregated);
                }

                const sorted = finalData
                    .sort((a, b) => {
                        if (a.name === b.name) return new Date(a.dateStart || a.date) - new Date(b.dateStart || b.date);
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

    const reportType = timeMode === 'day' ? 'daily' : (timeMode === 'week' ? 'weekly' : 'monthly');

    const buildSummaryKey = (userId) => `${userId}|${reportType}|${dateRange.start}|${dateRange.end}`;

    const formatDateDisplay = (user) => {
        if (timeMode === 'day') {
            return new Date(user.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        } else {
            const startDate = new Date(user.dateStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endDate = new Date(user.dateEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return `${startDate} - ${endDate}`;
        }
    };

    const handleSummaryClick = async (user) => {
        const rowId = user.id;
        const nextOpen = !openSummaryRows[rowId];
        setOpenSummaryRows((prev) => ({ ...prev, [rowId]: nextOpen }));
        if (!nextOpen) return;

        const summaryKey = buildSummaryKey(user.userId);
        const cached = summaryByQuery[summaryKey];
        if (cached?.loading || cached?.data || cached?.error) return;

        setSummaryByQuery((prev) => ({
            ...prev,
            [summaryKey]: { loading: true },
        }));

        try {
            const toTimeString = (decimalHour) => {
                const safe = Number.isFinite(decimalHour) ? decimalHour : 0;
                const totalMinutes = Math.max(0, Math.round(safe * 60));
                const hh = Math.floor(totalMinutes / 60) % 24;
                const mm = totalMinutes % 60;
                return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
            };

            const userRows = timelineData.filter((row) => row.userId === user.userId);
            const allRowActivities = userRows.flatMap((row) => (row.activities || []).map((act) => ({
                ...act,
                activityDate: act.activityDate || row.date,
            })));

            const activitiesPayload = allRowActivities
                .filter((act) => {
                    const cat = String(act.category || '').toUpperCase();
                    return !act.isEvent && cat !== 'EVENT' && cat !== 'MEETING';
                })
                .map((act) => ({
                    activity_date: act.activityDate,
                    title: act.title || 'Task',
                    activity_type: String(act.category || 'WORK').toUpperCase(),
                    start_time: toTimeString(act.start),
                    end_time: toTimeString(act.end),
                }));

            const eventsPayload = allRowActivities
                .filter((act) => {
                    const cat = String(act.category || '').toUpperCase();
                    return act.isEvent || cat === 'EVENT' || cat === 'MEETING';
                })
                .map((act) => ({
                    event_date: act.activityDate,
                    title: act.title || 'Event',
                    type: String(act.category || 'EVENT').toUpperCase(),
                    start_time: toTimeString(act.start),
                    end_time: toTimeString(act.end),
                }));

            const res = await api.post('/dar/reports/preview/client', {
                type: reportType,
                start: dateRange.start,
                end: dateRange.end,
                generation: 'llm',
                employee: {
                    user_id: user.userId,
                    user_name: user.name,
                    dept_name: user.dept,
                    shift_name: user.shift,
                },
                activities: activitiesPayload,
                events: eventsPayload,
            });

            const employeeSummary = res?.data?.data?.[0];
            if (!employeeSummary) {
                throw new Error('No summary available for this employee and timeframe.');
            }

            setSummaryByQuery((prev) => ({
                ...prev,
                [summaryKey]: {
                    loading: false,
                    data: {
                        report_summary: employeeSummary.report_summary,
                        work_summary: employeeSummary.work_summary,
                    },
                },
            }));
        } catch (error) {
            setSummaryByQuery((prev) => ({
                ...prev,
                [summaryKey]: {
                    loading: false,
                    error: error?.response?.data?.message || 'Failed to generate summary.',
                },
            }));
        }
    };

    useEffect(() => {
        setOpenSummaryRows({});
    }, [timeMode, dateRange.start, dateRange.end]);

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
                                        const nextRange = buildRangeByMode(range.start, timeMode);
                                        setDateRange(nextRange);
                                        setShowCalendar(false);
                                    }}
                                />
                            </div>
                        </div>,
                        document.body
                    )}
                </div>

                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {[
                        { key: 'day', label: 'Day' },
                        { key: 'week', label: 'Week' },
                        { key: 'month', label: 'Month' },
                    ].map((option) => (
                        <button
                            key={option.key}
                            onClick={() => {
                                setTimeMode(option.key);
                                setDateRange(buildRangeByMode(dateRange.end, option.key));
                            }}
                            className={`px-3 py-2 text-xs font-bold transition-colors border-r last:border-r-0 border-slate-200 dark:border-slate-700 ${timeMode === option.key
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
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
                <div className="min-w-[1600px]">
                    {/* Table Header (Time Slots) */}
                    <div className="flex border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                        <div className="w-48 p-3 text-xs font-bold text-slate-500 uppercase flex-shrink-0 sticky left-0 bg-slate-50 dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 z-20">
                            Employee
                        </div>
                        <div className="flex-1 flex">
                            {timeSlots.map(hour => (
                                <div key={hour} className="flex-1 min-w-[120px] p-3 text-center border-r border-dashed border-slate-200 dark:border-slate-700/50 last:border-none">
                                    <span className="text-[10px] font-bold text-slate-500">{formatTime(hour)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredTimelineData.map(user => {
                            const summaryKey = buildSummaryKey(user.userId);
                            const summaryState = summaryByQuery[summaryKey];
                            const isSummaryOpen = Boolean(openSummaryRows[user.id]);
                            const dayDates = timeMode === 'day'
                                ? [user.date || dateRange.start]
                                : enumerateDates(dateRange.start, dateRange.end);

                            const getVisibleWindow = (act) => {
                                let actStart = act.start;
                                let actEnd = act.end;

                                if (currentShift.end > 24) {
                                    if (actStart < currentShift.start) actStart += 24;
                                    if (actEnd < currentShift.start) actEnd += 24;
                                    if (actEnd < actStart) actEnd += 24;
                                }

                                if (actEnd <= currentShift.start || actStart >= currentShift.end + 1) return null;

                                const clampedStart = Math.max(actStart, currentShift.start);
                                const clampedEnd = Math.min(actEnd, currentShift.end + 1);
                                if (clampedEnd <= clampedStart) return null;

                                return { start: clampedStart, end: clampedEnd };
                            };

                            const dayLayout = (() => {
                                const activitiesByDate = {};
                                user.activities.forEach((act) => {
                                    const d = act.activityDate || user.date || dateRange.start;
                                    if (!activitiesByDate[d]) activitiesByDate[d] = [];
                                    activitiesByDate[d].push(act);
                                });

                                const layout = [];
                                const placements = {};
                                let runningTop = 0;

                                const laneHeight = timeMode === 'day' ? 24 : 22;
                                const laneGap = 4;
                                const dayTopPadding = 16;
                                const dayBottomPadding = 8;
                                const minDayHeight = timeMode === 'day' ? 72 : 36;

                                dayDates.forEach((date) => {
                                    const dayActs = (activitiesByDate[date] || []).slice();
                                    const sortable = dayActs
                                        .map((act) => ({ act, window: getVisibleWindow(act) }))
                                        .filter((item) => Boolean(item.window))
                                        .sort((a, b) => {
                                            if (a.window.start === b.window.start) {
                                                return (a.window.end - a.window.start) - (b.window.end - b.window.start);
                                            }
                                            return a.window.start - b.window.start;
                                        });

                                    const laneEndTimes = [];

                                    sortable.forEach(({ act, window }) => {
                                        let laneIdx = laneEndTimes.findIndex((laneEnd) => laneEnd <= window.start);
                                        if (laneIdx === -1) {
                                            laneIdx = laneEndTimes.length;
                                            laneEndTimes.push(window.end);
                                        } else {
                                            laneEndTimes[laneIdx] = window.end;
                                        }
                                        placements[act.id] = { laneIdx, window, date };
                                    });

                                    const laneCount = Math.max(1, laneEndTimes.length);
                                    const dayHeight = Math.max(minDayHeight, dayTopPadding + laneCount * (laneHeight + laneGap) + dayBottomPadding);

                                    layout.push({
                                        date,
                                        top: runningTop,
                                        height: dayHeight,
                                        laneHeight,
                                        laneGap,
                                        dayTopPadding,
                                        laneCount,
                                    });
                                    runningTop += dayHeight;
                                });

                                return {
                                    days: layout,
                                    placements,
                                    rowHeight: Math.max(96, runningTop || 96),
                                };
                            })();

                            const getCategoryStyles = (category) => {
                                const cat = (category || '').toUpperCase();
                                if (cat === 'MEETING') {
                                    return {
                                        bgClass: 'bg-purple-100 dark:bg-purple-900/40 border-purple-200 dark:border-purple-700/50',
                                        textClass: 'text-purple-800 dark:text-purple-100',
                                        subTextClass: 'text-purple-600 dark:text-purple-200',
                                    };
                                }
                                if (cat === 'EVENT') {
                                    return {
                                        bgClass: 'bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700/50',
                                        textClass: 'text-blue-800 dark:text-blue-100',
                                        subTextClass: 'text-blue-600 dark:text-blue-200',
                                    };
                                }
                                if (cat === 'BREAK') {
                                    return {
                                        bgClass: 'bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-700/50',
                                        textClass: 'text-amber-800 dark:text-amber-100',
                                        subTextClass: 'text-amber-600 dark:text-amber-200',
                                    };
                                }
                                return {
                                    bgClass: 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700/50',
                                    textClass: 'text-indigo-800 dark:text-indigo-100',
                                    subTextClass: 'text-indigo-600 dark:text-indigo-200',
                                };
                            };

                            return (
                                <div key={user.id}>
                                    <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                        {/* User Info Column */}
                                        <div className="w-48 p-4 flex flex-col justify-center border-r border-slate-100 dark:border-slate-700 flex-shrink-0 sticky left-0 bg-white dark:bg-dark-card group-hover:bg-slate-50 dark:group-hover:bg-slate-800 z-30">
                                            <span className="text-sm font-bold text-slate-800 dark:text-white truncate">{user.name}</span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">
                                                    {formatDateDisplay(user)}
                                                </span>
                                            </div>
                                            {user.holidayDates && user.holidayDates.length > 0 ? (
                                                <span className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Holiday {user.holidayDates.length > 1 ? `(${user.holidayDates.length})` : ''}
                                                </span>
                                            ) : user.absentDates && user.absentDates.length > 0 ? (
                                                <span className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Absent {user.absentDates.length > 1 ? `(${user.absentDates.length})` : ''}
                                                </span>
                                            ) : user.activities.length === 0 && (
                                                <span className="text-[10px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> No DAR
                                                </span>
                                            )}

                                            <button
                                                onClick={() => handleSummaryClick(user)}
                                                className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors w-fit"
                                            >
                                                <FileText size={12} />
                                                {isSummaryOpen ? 'Hide Summary' : 'Summary'}
                                            </button>
                                        </div>

                                        {/* Time Slots & Bars */}
                                        <div className="flex-1 flex relative py-2 overflow-hidden">
                                            {/* Background Grid Lines */}
                                            {timeSlots.map(hour => (
                                                <div key={hour} className="flex-1 min-w-[120px] border-r border-dashed border-slate-100 dark:border-slate-700/30 h-full absolute" style={{
                                                    left: `${((hour - currentShift.start) / (currentShift.end - currentShift.start + 1)) * 100}%`,
                                                    width: `${(1 / (currentShift.end - currentShift.start + 1)) * 100}%`
                                                }}></div>
                                            ))}

                                            {/* Activities Bars or STATUS OVERLAY */}
                                            <div className="relative w-full" style={{ minHeight: `${dayLayout.rowHeight}px` }}>
                                                {/* Day separators and labels */}
                                                {dayLayout.days.map((day, idx) => (
                                                    <React.Fragment key={day.date}>
                                                        {idx < dayLayout.days.length - 1 && (
                                                            <div
                                                                className="absolute w-full border-b border-slate-300 dark:border-slate-600"
                                                                style={{ top: `${day.top + day.height}px` }}
                                                            ></div>
                                                        )}
                                                        <div
                                                            className="absolute text-[9px] font-bold text-slate-400 dark:text-slate-500 px-1"
                                                            style={{ top: `${day.top + 2}px`, left: '4px' }}
                                                        >
                                                            {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </div>
                                                    </React.Fragment>
                                                ))}

                                                {/* 1. Holiday Overlay (Background) */}
                                                {user.isHoliday && (
                                                    <div className="absolute inset-x-0 inset-y-1 bg-emerald-50/40 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-800/30 rounded-lg pointer-events-none z-0"></div>
                                                )}

                                                {/* 2. Absent Overlay (Background) - Exclusive to No Holiday */}
                                                {!user.isHoliday && user.isAbsent && (
                                                    <div className="absolute inset-x-0 inset-y-1 bg-red-50/40 dark:bg-red-900/15 border border-red-100 dark:border-red-800/30 rounded-lg pointer-events-none z-0"></div>
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

                                                {/* 4. Activities (Z-Index 10) */}
                                                {user.activities.map((act) => {
                                                    const placement = dayLayout.placements[act.id];
                                                    if (!placement) return null;

                                                    const totalHours = currentShift.end - currentShift.start + 1;
                                                    const offset = placement.window.start - currentShift.start;
                                                    const duration = placement.window.end - placement.window.start;
                                                    const leftPct = (offset / totalHours) * 100;
                                                    const widthPct = (duration / totalHours) * 100;

                                                    const dayMeta = dayLayout.days.find((d) => d.date === placement.date);
                                                    if (!dayMeta) return null;

                                                    const topPx = dayMeta.top + dayMeta.dayTopPadding + placement.laneIdx * (dayMeta.laneHeight + dayMeta.laneGap);
                                                    const { bgClass, textClass, subTextClass } = getCategoryStyles(act.category);
                                                    const canShowCategory = widthPct >= 14 && dayMeta.laneHeight >= 24;

                                                    return (
                                                        <div
                                                            key={act.id}
                                                            className={`absolute rounded-lg border flex items-center pl-2 pr-1 overflow-hidden hover:z-[6] hover:scale-[1.02] transition-all cursor-pointer shadow-sm z-[5] ${bgClass}`}
                                                            style={{
                                                                left: `${Math.max(0, leftPct)}%`,
                                                                width: `${Math.min(100, widthPct)}%`,
                                                                top: `${topPx}px`,
                                                                height: `${dayMeta.laneHeight}px`
                                                            }}
                                                            title={`${act.title} (${act.category})\n${formatTime(act.start)} - ${formatTime(act.end)}`}
                                                        >
                                                            <div className="w-full overflow-hidden">
                                                                <span className={`block text-[11px] font-semibold truncate leading-[1.1] ${textClass}`}>{act.title}</span>
                                                                {canShowCategory && (
                                                                    <span className={`block text-[9px] truncate uppercase tracking-wide ${subTextClass}`}>{act.category}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {isSummaryOpen && (
                                        <div className="px-4 py-3 bg-indigo-50/60 dark:bg-indigo-900/10 border-t border-indigo-100 dark:border-indigo-900/30">
                                            {summaryState?.loading ? (
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Generating summary...</p>
                                            ) : summaryState?.error ? (
                                                <p className="text-xs text-red-500">{summaryState.error}</p>
                                            ) : summaryState?.data ? (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{summaryState.data.report_summary}</p>
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">{summaryState.data.work_summary}</p>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MasterDataView;
