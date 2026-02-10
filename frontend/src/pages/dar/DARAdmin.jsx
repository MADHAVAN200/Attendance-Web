import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../../components/DashboardLayout';
import {
    Settings,
    BarChart3,
    FileText,
    Download,
    Plus,
    Trash2,
    Save,
    Search,
    Calendar,
    Users,
    X,
    Building, // Import building icon
    Clock, // Import Clock icon for Shifts
    Edit, // Import Edit icon
    PieChart as PieChartIcon // Import PieChart icon aliased
} from 'lucide-react';
import MinimalSelect from '../../components/MinimalSelect';
import {
    PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, CartesianGrid
} from 'recharts';
import RequestReviewModal from '../../components/dar/RequestReviewModal';
import MiniCalendar from '../../components/dar/MiniCalendar';
import api from '../../services/api';
import { toast } from 'react-toastify';

const DARAdmin = ({ embedded = false }) => {
    const [activeTab, setActiveTab] = useState('insights'); // 'insights' | 'settings' | 'data'

    // --- SETTINGS STATE ---
    const [categories, setCategories] = useState([]);
    const [newCat, setNewCat] = useState("");
    const [bufferTime, setBufferTime] = useState(30);
    const [loadingSettings, setLoadingSettings] = useState(false);


    // Fetch Settings
    const fetchSettings = async () => {
        setLoadingSettings(true);
        try {
            const res = await api.get('/dar/settings/list');
            if (res.data.ok) {
                setCategories(res.data.data.categories);
                setBufferTime(res.data.data.buffer_minutes);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load settings");
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleSaveSettings = async () => {
        try {
            await api.post('/dar/settings/update', {
                buffer_minutes: parseInt(bufferTime),
                categories
            });
            toast.success("Settings updated successfully!");
        } catch (err) {
            toast.error("Failed to update settings");
        }
    };

    // --- CHART DATA STATE ---
    const [categoryData, setCategoryData] = useState([]);
    const [complianceData, setComplianceData] = useState([]);
    const [stats, setStats] = useState({
        submissionRate: 0,
        submittedCount: 0,
        totalEmployees: 0,
        topActivity: '-',
        topActivityPercent: 0
    });

    // Shift State
    const [shifts, setShifts] = useState([]);
    const [currentShift, setCurrentShift] = useState({ start: 8, end: 18 }); // Default View Range
    const [selectedShiftObj, setSelectedShiftObj] = useState(null);

    // --- MASTER DATA STATE ---
    const [timelineData, setTimelineData] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [allUsers, setAllUsers] = useState([]); // Store full user list for filters/gaps

    // Fetch Total Employees Count (for calculations)
    const [totalEmpCount, setTotalEmpCount] = useState(20); // Default fallback

    useEffect(() => {
        // Fetch total employees count & list
        const fetchUsers = async () => {
            try {
                const res = await api.get('/admin/users');
                if (res.data.success) {
                    setTotalEmpCount(res.data.users.length);
                    // Store minimal info needed for mapping
                    setAllUsers(res.data.users.map(u => ({
                        userId: u.user_id,
                        name: u.user_name,
                        dept: u.dept_name,
                        shift: u.shift_name,
                        role: u.user_type
                    })));
                }
            } catch (e) { console.error("Failed to fetch users", e); }
        };
        // Fetch Departments & Shifts
        const fetchDeptsAndShifts = async () => {
            // 1. Departments
            try {
                const res = await api.get('/admin/departments');
                if (res.data.success) {
                    setDepartments(res.data.departments.map(d => d.dept_name));
                }
            } catch (e) { console.error("Failed to fetch departments", e); }

            // 2. Shifts
            try {
                const res = await api.get('/admin/shifts');
                if (res.data.success) {
                    setShifts(res.data.shifts);
                    // Match current selected shift or default
                    if (res.data.shifts.length > 0) {
                        const gen = res.data.shifts.find(s => s.shift_name === 'General');
                        if (gen) setSelectedShiftObj(gen);
                    }
                }
            } catch (e) { console.error("Failed to fetch shifts", e); }
        };
        fetchUsers();
        fetchDeptsAndShifts();
    }, []);

    const fetchInsights = async () => {
        setLoadingData(true);
        try {
            // Last 7 days (Use local date to avoid timezone issues)
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 6);

            const toLocalYMD = (d) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const sStr = toLocalYMD(start);
            const eStr = toLocalYMD(end);

            const res = await api.get(`/dar/activities/admin/all?startDate=${sStr}&endDate=${eStr}`);
            if (res.data.ok) {
                processInsights(res.data.data, sStr, eStr);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load insights");
        } finally {
            setLoadingData(false);
        }
    };

    const processInsights = (activities, startStr, endStr) => {
        // 1. Category Data (Pie)
        const catMap = {};
        let totalHours = 0;

        const parseMinutes = (t) => {
            if (!t) return 0;
            const parts = t.split(':');
            return (parseInt(parts[0]) * 60) + (parseInt(parts[1]) || 0);
        };

        activities.forEach(a => {
            if (!a.start_time || !a.end_time) return;
            let startM = parseMinutes(a.start_time);
            let endM = parseMinutes(a.end_time);

            // Handle overnight (if end < start, add 24h)
            if (endM < startM) endM += (24 * 60);

            const hours = Math.max(0, (endM - startM) / 60);
            const type = a.activity_type || "Uncategorized";
            catMap[type] = (catMap[type] || 0) + hours;
            totalHours += hours;
        });

        const catChart = Object.entries(catMap).map(([name, value], i) => ({
            name,
            value: Math.round(value * 10) / 10,
            color: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 6]
        })).sort((a, b) => b.value - a.value);
        setCategoryData(catChart);

        // 2. Top Activity
        if (catChart.length > 0) {
            setStats(prev => ({
                ...prev,
                topActivity: catChart[0].name,
                topActivityPercent: totalHours > 0 ? Math.round((catChart[0].value / totalHours) * 100) : 0
            }));
        }

        // Helper to get local YYYY-MM-DD
        const getLocalDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // 3. Compliance Data (Bar - Last 7 days)
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            days.push(getLocalDate(d));
        }

        const compChart = days.map(dayStr => {
            const submittedUsers = new Set(
                activities.filter(a => {
                    const localActDate = getLocalDate(new Date(a.activity_date));
                    return localActDate === dayStr;
                }).map(a => a.user_id)
            );
            const submitted = submittedUsers.size;
            const pending = Math.max(0, totalEmpCount - submitted);
            const dateObj = new Date(dayStr);
            return {
                day: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
                fullDate: dayStr,
                submitted,
                pending
            };
        });
        setComplianceData(compChart);

        // 4. Rate (Today)
        const todayStr = getLocalDate(new Date());
        const todayStats = compChart.find(c => c.fullDate === todayStr);
        if (todayStats) {
            const rate = Math.round((todayStats.submitted / totalEmpCount) * 100);
            setStats(prev => ({
                ...prev,
                submissionRate: rate,
                submittedCount: todayStats.submitted,
                totalEmployees: totalEmpCount
            }));
        }
    };

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

                // Process Attendance efficiently (UserID + Date -> { hasTimedIn, timeInDecimal, timeInStr })
                const attendanceMap = {};
                if (attRes.data?.data) {
                    attRes.data.data.forEach(att => {
                        // att.time_in is formatted "YYYY-MM-DDTHH:mm:ss" or similar
                        if (!att.time_in) return;

                        // Handle "YYYY-MM-DDTHH:mm:ss" or "YYYY-MM-DD HH:mm:ss"
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

                // Group activities by User AND Date
                const grouped = {};
                res.data.data.forEach(a => {
                    const localDate = getLocalDate(new Date(a.activity_date));
                    const key = `${a.user_id}-${localDate}`;

                    // ... (existing helper logic)
                    const parseTime = (t) => {
                        const [h, m] = t.split(':').map(Number);
                        return h + (m / 60);
                    };

                    if (!grouped[key]) {
                        grouped[key] = {
                            id: key,
                            userId: a.user_id,
                            name: a.user_name,
                            role: a.user_role || 'Employee',
                            date: localDate,
                            dept: a.user_dept,
                            shift: a.user_shift_name, // Store shift
                            activities: [],
                            isHoliday: !!holidayMap[localDate],
                            holidayName: holidayMap[localDate],
                            isAbsent: false, // Will calc below
                            attendance: attendanceMap[`${a.user_id}-${localDate}`] // Attach attendance
                        };
                    }

                    grouped[key].activities.push({
                        id: a.id,
                        start: parseTime(a.start_time),
                        end: parseTime(a.end_time),
                        category: a.activity_type,
                        title: a.title || 'Task'
                    });
                });

                // Process Events & Meetings
                // Create User Map for quick lookup
                const userMap = {};
                allUsers.forEach(u => userMap[u.userId] = u);

                // Process Events & Meetings
                if (eventsRes.data?.data) {
                    eventsRes.data.data.forEach(e => {
                        // e.event_date is "YYYY-MM-DD"
                        const key = `${e.user_id}-${e.event_date}`;

                        // If no group exists (user has no tasks this day), try to create one
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
                                    // Initial Absent check (will be refined in backfill loop update)
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
                                category: (e.type || '').toUpperCase(), // 'EVENT' or 'MEETING'
                                title: e.title,
                                isEvent: true,
                                location: e.location
                            });
                        }
                    });
                }

                // Backfill Gaps: Ensure EVERY user has an entry for EVERY date in range
                // 1. Generate array of dates
                const dates = [];
                let d = new Date(dateRange.start);
                const e = new Date(dateRange.end);
                while (d <= e) {
                    dates.push(getLocalDate(d));
                    d.setDate(d.getDate() + 1);
                }

                while (d <= e) {
                    dates.push(getLocalDate(d));
                    d.setDate(d.getDate() + 1);
                }

                // todayStr moved up


                // 2. Iterate (Users x Dates)
                allUsers.forEach(u => {
                    dates.forEach(dateStr => {
                        const key = `${u.userId}-${dateStr}`;
                        const isHol = !!holidayMap[dateStr];
                        const attData = attendanceMap[`${u.userId}-${dateStr}`];
                        const hasAtt = !!attData;

                        // Check Absent: Not future, Not holiday, No Attendance
                        const isPast = dateStr < todayStr;
                        const isAbsent = isPast && !isHol && !hasAtt;

                        if (!grouped[key]) {
                            // Create empty entry
                            grouped[key] = {
                                id: key,
                                userId: u.userId,
                                name: u.name,
                                role: u.role || 'Employee',
                                date: dateStr,
                                dept: u.dept,
                                shift: u.shift,
                                activities: [], // Empty
                                isHoliday: isHol,
                                holidayName: holidayMap[dateStr],
                                isAbsent: isAbsent,
                                attendance: attData
                            };
                        } else {
                            // Update existing entry
                            grouped[key].isHoliday = isHol;
                            grouped[key].holidayName = holidayMap[dateStr];
                            // STRICT ABSENT: Regardless of activities, if no attendance -> Absent
                            grouped[key].isAbsent = isAbsent;
                            if (!grouped[key].attendance) grouped[key].attendance = attData;
                        }
                    });
                });

                // Sort by User Name then Date (Desc)
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

    // Filters
    const [selectedShift, setSelectedShift] = useState('General'); // Name of shift

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

                const startH = parseInt(startStr.split(':')[0]);
                const endH = parseInt(endStr.split(':')[0]);

                // Set timeline to -1hr start and +1hr end
                setCurrentShift({
                    start: Math.max(0, startH - 1),
                    end: Math.min(24, endH + 1) // Allow up to 25 for overflow visual if needed, but 24 max usu
                });

            } catch (e) {
                console.error("Error parsing shift rules", e);
                setCurrentShift({ start: 8, end: 18 });
            }
        }
    }, [selectedShift, shifts]);
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
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [departments, setDepartments] = useState([]); // List of departments
    const [selectedDepartment, setSelectedDepartment] = useState("All Departments");
    const [requests, setRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [requestSearch, setRequestSearch] = useState("");

    const [employeesList, setEmployeesList] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState("All Employees");

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

    const filteredTimelineData = timelineData.filter(user => {
        // 1. Filter by Department
        if (selectedDepartment !== "All Departments" && user.dept !== selectedDepartment) return false;
        // 2. Filter by Shift
        if (selectedShift && user.shift !== selectedShift) return false;
        // 3. Filter by Employee
        if (selectedEmployee !== "All Employees" && user.name !== selectedEmployee) return false;

        return true;
    });

    // Fetch Requests
    const fetchRequests = async () => {
        setLoadingRequests(true);
        try {
            const res = await api.get('/dar/requests/list');
            // Map API data to UI format
            const mapped = res.data.data.map(r => ({
                id: r.request_id,
                user: r.user_name, // from join
                date: r.request_date,
                changes: (r.proposed_data?.length || 0), // Rough count
                employeeName: r.user_name,
                originalTasks: r.original_data.map(t => ({
                    ...t,
                    id: t.id || Math.random(),
                    startTime: t.start_time || t.startTime,
                    endTime: t.end_time || t.endTime
                })),
                proposedTasks: r.proposed_data.map(t => ({
                    ...t,
                    id: t.id || Math.random(),
                    startTime: t.start_time || t.startTime,
                    endTime: t.end_time || t.endTime
                })),
                status: r.status
            }));
            // Mock Data for demonstration
            const mockRequests = [
                {
                    id: 'mock-1',
                    user: 'Rohan Sharma',
                    date: '2024-02-02',
                    changes: 3,
                    employeeName: 'Rohan Sharma',
                    originalTasks: [
                        { id: 't1', title: 'Site Inspection - Wing A', startTime: '09:00', endTime: '11:00', category: 'SITE_VISIT' },
                        { id: 't2', title: 'Material Handover', startTime: '11:30', endTime: '12:30', category: 'LOGISTICS' },
                        { id: 't3', title: 'Client Call', startTime: '14:00', endTime: '15:00', category: 'MEETING' }
                    ],
                    proposedTasks: [
                        { id: 't1', title: 'Site Inspection - Wing A', startTime: '09:00', endTime: '12:00', category: 'SITE_VISIT' }, // Extended
                        { id: 't3', title: 'Client Call', startTime: '15:00', endTime: '16:00', category: 'MEETING' }, // Moved
                        { id: 't4', title: 'Safety Briefing', startTime: '12:00', endTime: '12:30', category: 'MISC' } // New
                    ],
                    status: 'pending'
                },
                {
                    id: 'mock-2',
                    user: 'Priya Patel',
                    date: '2024-02-01',
                    changes: 1,
                    employeeName: 'Priya Patel',
                    originalTasks: [
                        { id: 'p1', title: 'Documentation', startTime: '10:00', endTime: '13:00', category: 'OFFICE' }
                    ],
                    proposedTasks: [
                        { id: 'p1', title: 'Documentation', startTime: '10:00', endTime: '14:00', category: 'OFFICE' } // Extended
                    ],
                    status: 'pending'
                },
                {
                    id: 'mock-3', // The one "just rejected" - restored
                    user: 'Amit Singh',
                    date: '2024-02-03',
                    changes: 2,
                    employeeName: 'Amit Singh',
                    originalTasks: [
                        { id: 'a1', title: 'Morning Standup', startTime: '09:00', endTime: '09:30', category: 'MEETING' },
                        { id: 'a2', title: 'Inventory Check', startTime: '10:00', endTime: '12:00', category: 'INVENTORY' }
                    ],
                    proposedTasks: [
                        { id: 'a1', title: 'Morning Standup', startTime: '09:30', endTime: '10:00', category: 'MEETING' },
                        // Inventory Check Deleted
                    ],
                    status: 'pending'
                }
            ];

            setRequests([...mockRequests, ...mapped]);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load requests");
        } finally {
            setLoadingRequests(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'insights') {
            fetchInsights();
        } else if (activeTab === 'requests') {
            fetchRequests();
        } else if (activeTab === 'settings') {
            fetchSettings();
        } else if (activeTab === 'data') {
            fetchMasterData();
        }
    }, [activeTab, dateRange, totalEmpCount]); // Re-fetch if tab or date range changes

    const handleApproveRequest = async (reqId) => {
        try {
            await api.post(`/dar/requests/approve/${reqId}`);
            toast.success("Request Approved & Applied");
            setSelectedRequest(null);
            fetchRequests(); // Refresh
        } catch (err) {
            toast.error("Approval Failed: " + (err.response?.data?.message || err.message));
        }
    };

    const handleRejectRequest = async (reqId) => {
        try {
            await api.post(`/dar/requests/reject/${reqId}`, { comment: "Rejected by Admin" });
            toast.info("Request Rejected");
            setSelectedRequest(null);
            fetchRequests(); // Refresh
        } catch (err) {
            toast.error("Rejection Failed");
        }
    };
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

    const [selectedCategory, setSelectedCategory] = useState("All Categories");

    // Employees List
    const employees = ["All Employees", ...employeesList];

    // --- DYNAMIC SHIFT TIMING & FILTER ---

    // Update Timeline Range when Shift Changes
    useEffect(() => {
        if (!selectedShift || shifts.length === 0) return;

        let targetShift = shifts.find(s => s.shift_name === selectedShift);
        // If not found (e.g. init), default to first or General
        if (!targetShift) targetShift = shifts.find(s => s.shift_name === 'General') || shifts[0];

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
                // If end < start, it means it crosses midnight, so we treat end as end+24
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

    const timeSlots = [];
    for (let i = currentShift.start; i <= currentShift.end; i++) {
        timeSlots.push(i);
    }

    // --- HANDLERS ---
    const handleAddCategory = async () => {
        if (newCat.trim()) {
            const updated = [...categories, newCat.trim()];
            setCategories(updated);
            setNewCat("");
            try {
                await api.post('/dar/settings/update', {
                    buffer_minutes: parseInt(bufferTime),
                    categories: updated
                });
                toast.success("Category added");
            } catch (err) {
                toast.error("Failed to add category");
            }
        }
    };

    const handleRemoveCategory = async (cat) => {
        const updated = categories.filter(c => c !== cat);
        setCategories(updated);
        try {
            await api.post('/dar/settings/update', {
                buffer_minutes: parseInt(bufferTime),
                categories: updated
            });
            toast.success("Category removed");
        } catch (err) {
            toast.error("Failed to remove category");
        }
    };


    const formatTime = (val) => {
        const normalized = val >= 24 ? val - 24 : val;
        const h = Math.floor(normalized);
        const m = (normalized - h) * 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}${m > 0 ? ':' + m : ''} ${ampm}`;
    };

    const Wrapper = embedded ? React.Fragment : DashboardLayout;

    return (
        <Wrapper {...(embedded ? {} : { title: "DAR Admin Panel" })}>
            <div className="flex flex-col h-[calc(100vh-140px)] gap-6">

                {/* Tabs Header - Styled like Attendance.jsx */}
                <div className="border-b border-slate-200 dark:border-slate-700 flex gap-12 px-2">
                    {[
                        { id: 'insights', icon: <BarChart3 size={16} />, label: 'Live Dashboard', type: 'tab' },
                        { id: 'requests', icon: <Edit size={16} />, label: 'Edit Requests', type: 'tab' },
                        { id: 'data', icon: <FileText size={16} />, label: 'Master Data', type: 'tab' },
                        { id: 'settings', icon: <Settings size={16} />, label: 'Configurations', type: 'tab' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                setSelectedRequest(null);
                            }}
                            className={`pb-3 text-sm font-medium transition-all relative ${activeTab === tab.id
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                {tab.icon}
                                {tab.label}
                            </div>
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden">

                    {/* --- CONFIGURATIONS TAB --- */}
                    {activeTab === 'settings' && (
                        <div className="flex flex-col h-full bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-700">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <Settings size={22} className="text-indigo-600" />
                                        Configurations
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">Manage system-wide settings and master lists.</p>
                                </div>
                                <button
                                    onClick={handleSaveSettings}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all"
                                >
                                    <Save size={18} />
                                    Save Changes
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 flex flex-col gap-8">

                                {/* Section 1: Categories */}
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Activity Categories</h3>
                                    <p className="text-sm text-slate-500 mb-6">Manage standard activities available for employees to select properly.</p>

                                    <div className="flex gap-3 mb-6">
                                        <input
                                            type="text"
                                            value={newCat}
                                            onChange={(e) => setNewCat(e.target.value)}
                                            placeholder="Enter new category..."
                                            className="flex-1 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddCategory}
                                            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-md shadow-indigo-100 dark:shadow-none"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {categories.map((cat, i) => (
                                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl group hover:border-indigo-200 dark:hover:border-indigo-900 transition-all shadow-sm">
                                                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate pr-2" title={cat}>{cat}</span>
                                                <button
                                                    onClick={() => handleRemoveCategory(cat)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        ))}
                                        {categories.length === 0 && (
                                            <div className="col-span-full flex flex-col items-center justify-center p-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 italic">
                                                <Settings size={32} className="mb-2 opacity-20" />
                                                No categories defined. Add one above.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="w-full h-[1px] bg-slate-100 dark:bg-slate-700"></div>

                                {/* Section 2: Buffer Time */}
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Grace Period Buffer</h3>
                                        <p className="text-sm text-slate-500 max-w-md">
                                            Time in minutes allowed after the current time for 'Execution Mode' tasks.
                                            Tasks logged after this buffer will be marked as future planning.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <button
                                            onClick={() => setBufferTime(Math.max(0, bufferTime - 5))}
                                            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all font-bold text-lg"
                                        >-</button>
                                        <div className="w-16 text-center font-bold text-lg text-slate-700 dark:text-white">
                                            {bufferTime}m
                                        </div>
                                        <button
                                            onClick={() => setBufferTime(bufferTime + 5)}
                                            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all font-bold text-lg"
                                        >+</button>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                    {/* --- MASTER DATA TAB (TIMELINE VIEW) --- */}
                    {activeTab === 'data' && (
                        <div className="flex flex-col h-full bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">

                            {/* Toolbar */}
                            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap gap-4 items-center justify-between bg-white dark:bg-dark-card z-20">
                                <div className="flex items-center gap-3">
                                    {/* Shift Selector Redesign */}
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
                                            {/* Backdrop */}
                                            <div
                                                className="fixed inset-0 bg-transparent"
                                                onClick={() => setShowCalendar(false)}
                                            />
                                            {/* Popup */}
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
                    )}


                    {/* --- REQUESTS TAB --- */}
                    {activeTab === 'requests' && (
                        <div className="flex h-full gap-6 pb-6">
                            {/* Left: List */}
                            <div className="w-1/3 min-w-[350px] bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                                <div className="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3 bg-white dark:bg-dark-card z-10">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-slate-800 dark:text-white">Requests</h3>
                                        <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-full font-bold">{requests.length} Total</span>
                                    </div>
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={requestSearch}
                                            onChange={(e) => setRequestSearch(e.target.value)}
                                            placeholder="Search by employee name..."
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                    {loadingRequests ? (
                                        <div className="text-center py-10 text-slate-400">Loading requests...</div>
                                    ) : requests.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400 italic">No requests found.</div>
                                    ) : (
                                        requests.filter(req => req.user.toLowerCase().includes(requestSearch.toLowerCase())).map(req => (
                                            <div
                                                key={req.id}
                                                onClick={() => setSelectedRequest(req)}
                                                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${selectedRequest?.id === req.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-200'}`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={`font-bold text-sm ${selectedRequest?.id === req.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-white'}`}>{req.user}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">{req.date}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 mb-2">{req.changes} changes proposed</div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${req.status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{req.status}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Right: Details */}
                            <div className="flex-1 bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col relative">
                                {selectedRequest ? (
                                    <RequestReviewModal
                                        isOpen={true}
                                        onClose={() => setSelectedRequest(null)}
                                        request={selectedRequest}
                                        onApprove={() => handleApproveRequest(selectedRequest.id)}
                                        onReject={() => handleRejectRequest(selectedRequest.id)}
                                        inline={true}
                                    />
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                                        <FileText size={48} className="mb-4 opacity-50" />
                                        <span className="text-lg font-medium">Select a request to view details</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- INSIGHTS TAB --- */}
                    {activeTab === 'insights' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-y-auto pb-10 custom-scrollbar">

                            {/* Chart 3: Pending DAR Edit Requests */}


                            {/* Row 1: Key Metrics (Condensed) */}
                            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <div>
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">Submission Rate</div>
                                        <div className="text-3xl font-black text-slate-800 dark:text-white">{stats.submissionRate}%</div>
                                        <div className="text-xs text-emerald-500 font-bold mt-1">{stats.submittedCount}/{stats.totalEmployees} Employees</div>
                                    </div>
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-full">
                                        <FileText size={24} className="text-emerald-500" />
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <div>
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">Top Activity</div>
                                        <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 truncate">{stats.topActivity}</div>
                                        <div className="text-xs text-slate-400 font-bold mt-1">{stats.topActivityPercent}% of total time</div>
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-full">
                                        <BarChart3 size={24} className="text-indigo-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Chart 1: Hours by Category (Donut) */}
                            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <PieChartIcon size={20} className="text-indigo-500" /> Hours by Category
                                </h3>
                                <div className="flex-1 w-full min-h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={categoryData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {categoryData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>



                            {/* Chart 2: Daily Submission Compliance (Bar) */}
                            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                                    <Users size={20} className="text-emerald-500" /> Submission Compliance
                                </h3>
                                <div className="flex-1 w-full min-h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={complianceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                                            <Tooltip
                                                cursor={{ fill: '#F1F5F9' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" height={36} iconType="circle" />
                                            <Bar dataKey="submitted" name="Submitted" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} barSize={30} />
                                            <Bar dataKey="pending" name="Pending" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={30} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* Diff Modal */}
                    {/* Premium Diff Review Modal */}
                    {/* Diff Modal - Only show as modal if NOT in requests tab (where it is inline) */}
                    {activeTab !== 'requests' && (
                        <RequestReviewModal
                            isOpen={!!selectedRequest}
                            onClose={() => setSelectedRequest(null)}
                            request={selectedRequest}
                            onApprove={() => handleApproveRequest(selectedRequest?.id)}
                            onReject={() => handleRejectRequest(selectedRequest?.id)}
                        />
                    )}

                </div>
            </div>
        </Wrapper >
    );
};

export default DARAdmin;
