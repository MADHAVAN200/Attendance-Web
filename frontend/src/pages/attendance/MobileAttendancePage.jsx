import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    MapPin,
    Clock,
    Camera,
    History,
    Calendar,
    AlertCircle,
    X,
    CheckCircle,
    RefreshCw,
    Download,
    ChevronRight,
    FileText,
    User,
    ArrowRight,
    LogOut,
    Plus,
    Minus,
    Paperclip,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
    MoreHorizontal,
    Navigation,
    Scan,
    XCircle,
    Image as ImageIcon,
    Eye,
    FileClock
} from 'lucide-react';
import { attendanceService } from '../../services/attendanceService';
import { toast } from 'react-toastify';
import MobileDatePicker from '../../components/MobileDatePicker';
import MonthPicker from '../../components/MonthPicker';
import {
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer
} from 'recharts';
import { useAuth } from '../../context/AuthContext';

const MobileAttendancePage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [avatarTimestamp] = useState(Date.now());

    const SUB_TABS = [
        { id: 'history', label: 'History', icon: History },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'corrections', label: 'Corrections', icon: FileClock }
    ];

    // --- STATE ---
    const [mainTab, setMainTab] = useState('attendance'); // 'attendance', 'my_attendance'
    const [subTab, setSubTab] = useState('history'); // 'history', 'analytics', 'corrections'
    const [correctionFilter, setCorrectionFilter] = useState('pending'); // 'pending', 'history'
    const [direction, setDirection] = useState(0);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('mano-active-tab', {
            detail: {
                tab: mainTab === 'attendance' ? 'mark_attendance' : 'my_attendance',
                subTab: subTab === 'corrections' ? 'correction' : subTab
            }
        }));
    }, [mainTab, subTab]);

    const mainTabs = ['attendance', 'my_attendance'];
    const currentMainIndex = mainTabs.indexOf(mainTab);

    const subTabs = ['history', 'analytics', 'corrections'];
    const currentSubIndex = subTabs.indexOf(subTab);

    // Correction Form State
    const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    const [correctionForm, setCorrectionForm] = useState({
        date: new Date().toISOString().split('T')[0],
        type: 'Missed Punch',
        method: 'manual', // 'manual' or 'reset'
        sessions: [{ in: '', out: '' }],
        reason: '',
        files: []
    });

    const [currentTime, setCurrentTime] = useState(new Date());
    const [location, setLocation] = useState({ lat: null, lng: null, address: 'Fetching location...', error: null });
    const [isLoadingLoc, setIsLoadingLoc] = useState(false);

    // Camera
    const [showCamera, setShowCamera] = useState(false);
    const [cameraMode, setCameraMode] = useState(null); // 'IN' or 'OUT'
    const [imgSrc, setImgSrc] = useState(null);
    const webcamRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Data
    const [dailySessions, setDailySessions] = useState([]);
    const [monthlySessions, setMonthlySessions] = useState([]);
    const [correctionHistory, setCorrectionHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [fileFormat, setFileFormat] = useState('xlsx');

    // Dates
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const [showFullCalendar, setShowFullCalendar] = useState(false);
    const [scrollerDates, setScrollerDates] = useState([]);

    useEffect(() => {
        const d = [];
        const today = new Date();
        // Generate 30 days around today
        for (let i = -15; i <= 15; i++) {
            const date = new Date();
            date.setDate(today.getDate() + i);
            d.push(date);
        }
        setScrollerDates(d);
    }, []);

    // --- EFFECTS ---

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        
        let watchId;
        if (navigator.geolocation) {
            setIsLoadingLoc(true);
            watchId = navigator.geolocation.watchPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                        const data = await res.json();
                        setLocation({
                            lat: latitude,
                            lng: longitude,
                            address: data.display_name?.split(',')[0] || 'Unknown Location',
                            error: null
                        });
                    } catch (err) {
                        setLocation({ lat: latitude, lng: longitude, address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, error: null });
                    } finally {
                        setIsLoadingLoc(false);
                    }
                },
                (err) => {
                    setLocation(prev => ({ ...prev, error: err.message, address: 'Location Access Denied' }));
                    setIsLoadingLoc(false);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }

        fetchDailyRecords();
        fetchMonthlyRecords();
        fetchCorrectionHistory();

        return () => {
            clearInterval(timer);
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, []);

    useEffect(() => {
        // Auto-scroll to selected date in the scroller
        const element = document.getElementById("selected-date-btn");
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [selectedDate, scrollerDates]);

    useEffect(() => {
        fetchDailyRecords();
    }, [selectedDate]);

    useEffect(() => {
        fetchMonthlyRecords();
    }, [reportMonth]);

    // --- FETCHING ---



    const fetchDailyRecords = async () => {
        try {
            const res = await attendanceService.getMyRecords(selectedDate, selectedDate);
            if (res.ok || res.data) {
                const records = res.data || res || [];
                setDailySessions(Array.isArray(records) ? records : []);
            }
        } catch (error) {
            console.error("Failed to fetch daily records", error);
        }
    };

    const fetchMonthlyRecords = async () => {
        if (!reportMonth) return;
        setLoading(true);
        const [year, month] = reportMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        try {
            const res = await attendanceService.getMyRecords(startDate, endDate);
            if (res.ok || res.data) {
                const records = res.data || res || [];
                setMonthlySessions(Array.isArray(records) ? records : []);
            }
        } catch (error) {
            console.error("Failed to load history");
        } finally {
            setLoading(false);
        }
    };

    const fetchCorrectionHistory = async () => {
        try {
            const res = await attendanceService.getCorrectionRequests();
            setCorrectionHistory(res.data || []);
        } catch (error) {
            console.error(error);
        }
    };

    // --- ACTIONS ---

    const openCamera = (mode) => {
        setCameraMode(mode);
        setShowCamera(true);
        setImgSrc(null);
    };

    const closeCamera = () => {
        setShowCamera(false);
        setImgSrc(null);
        setCameraMode(null);
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setImgSrc(imageSrc);
    }, [webcamRef]);

    const retake = () => {
        setImgSrc(null);
    };

    const dataURLtoBlob = (dataurl) => {
        let arr = dataurl.split(';base64,'), mime = arr[0].match(/:(.*?);/) ? arr[0].match(/:(.*?);/)[1] : 'image/png';
        let bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    };

    const confirmAttendance = async () => {
        if (!imgSrc || !location.lat) return;

        setIsSubmitting(true);
        try {
            const imageBlob = dataURLtoBlob(imgSrc);
            const payload = {
                latitude: location.lat,
                longitude: location.lng,
                accuracy: 10,
                imageFile: imageBlob
            };

            if (cameraMode === 'IN') {
                await attendanceService.timeIn(payload);
                toast.success("Checked In Successfully!");
            } else {
                await attendanceService.timeOut(payload);
                toast.success("Checked Out Successfully!");
            }

            closeCamera();
            fetchDailyRecords();
            fetchMonthlyRecords();
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Attendance failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const downloadReport = async () => {
        if (!reportMonth) return;
        setIsDownloading(true);
        try {
            const blob = await attendanceService.downloadMyReport(reportMonth, fileFormat);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Attendance_Report_${reportMonth}.${fileFormat}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Report downloaded successfully");
        } catch (error) {
            console.error("Download failed", error);
            toast.error("Failed to download report");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleCorrectionSubmit = async () => {
        if (!correctionForm.reason) {
            toast.error("Reason is required");
            return;
        }
        setShowConfirmSubmit(true);
    };

    const handleConfirmSubmitMobile = async () => {
        setSubmitLoading(true);
        try {
            const payload = {
                request_date: correctionForm.date,
                correction_type: correctionForm.type,
                reason: correctionForm.reason,
                details: {
                    method: correctionForm.method,
                    sessions: correctionForm.sessions
                }
            };

            await attendanceService.submitCorrectionRequest(payload);
            toast.success("Correction request submitted successfully!");
            setShowConfirmSubmit(false);
            setShowSuccessPopup(true);
            setIsCorrectionOpen(false);
            setCorrectionForm({ ...correctionForm, sessions: [{ in: '', out: '' }], reason: '' });
            fetchCorrectionHistory();
        } catch (error) {
            console.error("Correction submit failed", error);
            toast.error(error.message || "Failed to submit correction");
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleRequestClick = async (item) => {
        if (isFetchingDetails) return;
        try {
            setIsFetchingDetails(true);
            const requestId = item.acr_id || item.request_id || item.id;
            const res = await attendanceService.getCorrectionDetails(requestId);
            setSelectedRequest({ ...item, ...(res.data || res) });
        } catch (error) {
            console.error("Failed to fetch correction details:", error);
            setSelectedRequest(item);
        } finally {
            setIsFetchingDetails(false);
        }
    };

    const addSession = () => {
        setCorrectionForm({
            ...correctionForm,
            sessions: [...correctionForm.sessions, { in: '', out: '' }]
        });
    };

    const removeSession = (index) => {
        if (correctionForm.sessions.length > 1) {
            const newSessions = [...correctionForm.sessions];
            newSessions.splice(index, 1);
            setCorrectionForm({ ...correctionForm, sessions: newSessions });
        }
    };

    const updateSession = (index, field, value) => {
        const newSessions = [...correctionForm.sessions];
        newSessions[index][field] = value;
        setCorrectionForm({ ...correctionForm, sessions: newSessions });
    };

    const handleMainTabChange = (newTab) => {
        const newIndex = mainTabs.indexOf(newTab);
        setDirection(newIndex > currentMainIndex ? 1 : -1);
        setMainTab(newTab);
    };

    const handleSubTabChange = (newTab) => {
        const newIndex = subTabs.indexOf(newTab);
        setDirection(newIndex > currentSubIndex ? 1 : -1);
        setSubTab(newTab);
    };

    const handleSwipe = (swipeDir) => {
        if (mainTab === 'attendance') {
            if (swipeDir === 'left' && currentMainIndex < mainTabs.length - 1) {
                setDirection(1);
                setMainTab(mainTabs[currentMainIndex + 1]);
            }
        } else {
            // In my_attendance, swipe subtabs
            if (swipeDir === 'left') {
                if (currentSubIndex < subTabs.length - 1) {
                    setDirection(1);
                    setSubTab(subTabs[currentSubIndex + 1]);
                }
            } else if (swipeDir === 'right') {
                if (currentSubIndex > 0) {
                    setDirection(-1);
                    setSubTab(subTabs[currentSubIndex - 1]);
                } else {
                    // At the first subtab, swipe back to main attendance
                    setDirection(-1);
                    setMainTab('attendance');
                }
            }
        }
    };

    // --- HELPERS ---

    const calculateHours = (inTime, outTime) => {
        if (!inTime || !outTime) return '0h 0m';
        const start = new Date(inTime);
        const end = new Date(outTime);
        const diffMs = end - start;
        if (diffMs < 0) return '0h 0m';
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.round((diffMs % 3600000) / 60000);
        return `${diffHrs}h ${diffMins}m`;
    };

    // Analytics Calcs
    const totalRecords = monthlySessions.length;
    let presentCount = 0;
    let lateCount = 0;
    let totalHours = 0;

    const attendanceTrendData = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekStats = { Sun: { hrs: 0, count: 0 }, Mon: { hrs: 0, count: 0 }, Tue: { hrs: 0, count: 0 }, Wed: { hrs: 0, count: 0 }, Thu: { hrs: 0, count: 0 }, Fri: { hrs: 0, count: 0 }, Sat: { hrs: 0, count: 0 } };

    monthlySessions.forEach(session => {
        const h = parseFloat(session.total_hours || session.hours || 0);
        totalHours += h;
        if (session.status !== 'ABSENT') {
            presentCount++;
            if (session.late_minutes > 0) lateCount++;
        }

        const dateString = session.time_in || session.date || session.shift_date;
        const d = dateString ? new Date(dateString) : null;

        if (d && !isNaN(d)) {
            attendanceTrendData.push({ date: d.getDate(), hours: h });
            const dayName = daysOfWeek[d.getDay()];
            if (weekStats[dayName]) {
                weekStats[dayName].hrs += h;
                weekStats[dayName].count += 1;
            }
        }
    });

    attendanceTrendData.sort((a, b) => a.date - b.date);

    const weeklyActivityData = daysOfWeek.map(day => ({
        day,
        hours: weekStats[day].count > 0 ? (weekStats[day].hrs / weekStats[day].count).toFixed(1) : 0
    }));

    const statusPieData = [
        { name: 'On Time', value: presentCount - lateCount, color: '#10b981' },
        { name: 'Late', value: lateCount, color: '#f59e0b' }
    ].filter(d => d.value > 0);

    const avgHours = totalRecords > 0 ? (totalHours / totalRecords).toFixed(1) : '0.0';
    const presentPercentage = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;
    const latePercentage = presentCount > 0 ? Math.round((lateCount / presentCount) * 100) : 0;

    let underHoursCount = 0;
    monthlySessions.forEach(session => {
        const h = parseFloat(session.total_hours || session.hours || 0);
        if (session.status !== 'ABSENT' && h > 0 && h < 8) underHoursCount++;
    });

    const filteredCorrections = correctionHistory.filter(item => {
        const status = (item.status || 'PENDING').toUpperCase();
        if (correctionFilter === 'pending') return status === 'PENDING';
        return status !== 'PENDING';
    });

    const hasActiveSession = dailySessions.some(s => !s.time_out);

    return (
        <MobileDashboardLayout title="Attendance">
            <div className="pb-24">
                {/* Premium Header / Greeting */}
                <div className="px-5 pt-8 pb-12 bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 dark:from-indigo-900/40 dark:via-indigo-950/40 dark:to-black rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
                    {/* Animated Background Blobs */}
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            rotate: [0, 90, 0],
                        }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full"
                    />
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.5, 1],
                            x: [0, 50, 0],
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        className="absolute -bottom-24 -left-24 w-80 h-80 bg-sky-500/10 blur-3xl rounded-full"
                    />

                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight">
                                    Good {currentTime.getHours() < 12 ? 'Morning' : currentTime.getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.user_name?.split(' ')[0] || 'User'}!
                                </h1>
                                <p className="text-indigo-100/70 text-sm font-medium mt-1">
                                    {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                            </div>

                        </div>

                        {/* Current Time Widget */}
                        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-500/30 rounded-2xl flex items-center justify-center text-white">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Current Time</span>
                                    <span className="text-2xl font-black text-white font-mono">
                                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1">Location</span>
                                <div className="flex items-center gap-1.5 text-white/90 font-bold text-xs bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                                    <MapPin size={12} className="text-indigo-300" />
                                    {isLoadingLoc ? 'Locating...' : location.address}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Switcher - Floating Style - Standardized */}
                <div className="px-5 -mt-6 relative z-20">
                    <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1.5 flex rounded-2xl backdrop-blur-md border border-white/20 dark:border-white/5 shadow-xl">
                        <button
                            onClick={() => handleMainTabChange('attendance')}
                            className={`flex-1 py-2.5 text-[11px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                                mainTab === 'attendance'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md transform scale-[1.02]'
                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <User size={14} />
                            Attendance
                        </button>
                        <button
                            onClick={() => handleMainTabChange('my_attendance')}
                            className={`flex-1 py-2.5 text-[11px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                                mainTab === 'my_attendance'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md transform scale-[1.02]'
                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <History size={14} />
                            My Attendance
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="px-5 pt-8">
                    <AnimatePresence mode="wait">
                        {mainTab === 'attendance' ? (
                            <motion.div
                                key="attendance-tab"
                                custom={direction}
                                variants={{
                                    enter: (direction) => ({ x: direction > 0 ? 50 : -50, opacity: 0 }),
                                    center: { x: 0, opacity: 1 },
                                    exit: (direction) => ({ x: direction < 0 ? 50 : -50, opacity: 0, position: 'absolute', width: 'calc(100% - 40px)' })
                                }}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ type: "spring", stiffness: 400, damping: 35 }}
                                className="space-y-6"
                                drag="x"
                                dragConstraints={{ left: 0, right: 0 }}
                                dragElastic={0.2}
                                onDragEnd={(e, info) => {
                                    if (info.offset.x < -80) handleSwipe('left');
                                    else if (info.offset.x > 80) handleSwipe('right');
                                }}
                            >
                                {/* Punch Cards - Redesigned to match image */}
                                <div className="grid grid-cols-1 gap-4">
                                    <button
                                        onClick={() => !hasActiveSession && openCamera('IN')}
                                        disabled={hasActiveSession}
                                        className={`group relative p-4 rounded-[2rem] flex items-center justify-between transition-all duration-300 overflow-hidden border ${
                                            hasActiveSession
                                                ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-white/5 opacity-40'
                                                : 'bg-white dark:bg-[#000000] border-slate-100 dark:border-white/10 shadow-lg dark:shadow-2xl active:scale-[0.98]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                                hasActiveSession 
                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600' 
                                                    : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20'
                                            }`}>
                                                <ArrowRight size={22} strokeWidth={2.5} />
                                            </div>
                                            <div className="text-left">
                                                <h3 className={`text-base font-bold tracking-tight ${hasActiveSession ? 'text-slate-300 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>Time In</h3>
                                                <p className="text-slate-400 dark:text-slate-500 text-[11px] font-medium mt-0.5">
                                                    {hasActiveSession ? 'Session active' : 'Start shift for today'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center">
                                            <ChevronRight size={16} className={hasActiveSession ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500'} />
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => hasActiveSession && openCamera('OUT')}
                                        disabled={!hasActiveSession}
                                        className={`group relative p-4 rounded-[2rem] flex items-center justify-between transition-all duration-300 overflow-hidden border ${
                                            !hasActiveSession
                                                ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-white/5 opacity-40'
                                                : 'bg-white dark:bg-[#000000] border-slate-100 dark:border-white/10 shadow-lg dark:shadow-2xl active:scale-[0.98]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                                !hasActiveSession 
                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600' 
                                                    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20'
                                            }`}>
                                                <LogOut size={22} strokeWidth={2.5} />
                                            </div>
                                            <div className="text-left">
                                                <h3 className={`text-base font-bold tracking-tight ${!hasActiveSession ? 'text-slate-300 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>Time Out</h3>
                                                <p className="text-slate-400 dark:text-slate-500 text-[11px] font-medium mt-0.5">
                                                    {!hasActiveSession ? 'No active session' : 'End your day'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center">
                                            <ChevronRight size={16} className={!hasActiveSession ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500'} />
                                        </div>
                                    </button>
                                </div>

                                {/* Date Selection Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <h3 className="text-xs font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.2em]">Select Date</h3>
                                        <button 
                                            onClick={() => setShowFullCalendar(!showFullCalendar)}
                                            className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl active:scale-95 transition-all"
                                        >
                                            <Calendar size={18} />
                                        </button>
                                    </div>

                                    {showFullCalendar && (
                                        <div className="bg-white dark:bg-github-dark-subtle p-4 rounded-[2rem] border border-slate-100 dark:border-github-dark-border shadow-xl mb-4 relative z-50">
                                            <div className="grid grid-cols-7 gap-1">
                                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                                    <div key={d} className="text-center text-[10px] font-black text-slate-400 py-2">{d}</div>
                                                ))}
                                                {/* Simple inline calendar for demo or implement full logic */}
                                                {(() => {
                                                    const today = new Date();
                                                    const year = today.getFullYear();
                                                    const month = today.getMonth();
                                                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                                                    const firstDay = new Date(year, month, 1).getDay();
                                                    const cells = [];
                                                    for (let i = 0; i < firstDay; i++) cells.push(<div key={`p-${i}`} />);
                                                    for (let d = 1; d <= daysInMonth; d++) {
                                                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                        const isSelected = dateStr === selectedDate;
                                                        const isToday = dateStr === today.toISOString().split('T')[0];
                                                        cells.push(
                                                            <button
                                                                key={d}
                                                                onClick={() => {
                                                                    setSelectedDate(dateStr);
                                                                    setShowFullCalendar(false);
                                                                }}
                                                                className={`h-10 rounded-xl text-xs font-bold transition-all ${
                                                                    isSelected ? 'bg-indigo-600 text-white' : isToday ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 dark:text-github-dark-text hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                {d}
                                                            </button>
                                                        );
                                                    }
                                                    return cells;
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3 overflow-x-auto py-5 px-1 no-scrollbar scroll-smooth">
                                        {scrollerDates.map((date) => {
                                            const dateStr = date.toISOString().split('T')[0];
                                            const isSelected = dateStr === selectedDate;
                                            const isToday = dateStr === new Date().toISOString().split('T')[0];
                                            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                                            
                                            return (
                                                <button
                                                    key={dateStr}
                                                    id={isSelected ? "selected-date-btn" : undefined}
                                                    onClick={() => setSelectedDate(dateStr)}
                                                    className={`flex flex-col items-center justify-center min-w-[60px] h-20 rounded-[1.8rem] transition-all duration-300 ${
                                                        isSelected 
                                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 transform scale-105' 
                                                            : 'bg-white dark:bg-github-dark-subtle text-slate-400 dark:text-github-dark-muted border border-slate-100 dark:border-github-dark-border'
                                                    }`}
                                                >
                                                    <span className="text-[9px] font-black uppercase tracking-tighter mb-1 opacity-70">
                                                        {dayName}
                                                    </span>
                                                    <span className="text-lg font-black">{date.getDate()}</span>
                                                    {isToday && !isSelected && <div className="w-1 h-1 bg-indigo-500 rounded-full mt-1"></div>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Today's Activity */}
                                <div className="pt-4">
                                    <div className="flex items-center justify-between mb-4 px-1">
                                        <h3 className="text-lg font-black text-slate-800 dark:text-github-dark-text uppercase tracking-tight">
                                            {selectedDate === new Date().toISOString().split('T')[0] ? "Today's Logs" : `Logs for ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                        </h3>
                                        <button onClick={() => setIsCorrectionOpen(true)} className="flex items-center gap-1.5 text-indigo-600 font-black text-xs uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-full active:scale-95 transition-all">
                                            <Plus size={14} strokeWidth={3} /> Correction
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {dailySessions.length > 0 ? dailySessions.map((s, idx) => (
                                            <div key={s.acr_id || s.id || s.time_in} className="bg-white dark:bg-github-dark-subtle p-6 rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm space-y-5 transition-all active:scale-[0.98]">
                                                {/* Session Header */}
                                                <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-github-dark-border/10">
                                                    <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest flex items-center gap-2">
                                                        <Clock size={12} /> Session #{dailySessions.length - idx}
                                                    </span>
                                                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${s.late_minutes > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                        {s.late_minutes > 0 ? 'Late' : 'On Time'}
                                                    </span>
                                                </div>

                                                {/* IN/OUT Sections Grid */}
                                                <div className="grid grid-cols-2 gap-5">
                                                    {/* Time In Section */}
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                                                <ArrowUpRight size={16} strokeWidth={3} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="block text-[9px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest leading-none mb-1">Time In</span>
                                                                <span className="text-sm font-black text-slate-800 dark:text-github-dark-text truncate block">{new Date(s.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </div>
                                                        {s.time_in_image ? (
                                                            <button 
                                                                onClick={() => setPreviewImage(s.time_in_image)}
                                                                className="w-full aspect-square rounded-2xl overflow-hidden border border-slate-100 dark:border-github-dark-border relative group active:scale-95 transition-all shadow-inner"
                                                            >
                                                                <img src={s.time_in_image} alt="In" className="w-full h-full object-cover" />
                                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                                    <Eye size={20} className="text-white" />
                                                                </div>
                                                            </button>
                                                        ) : (
                                                            <div className="w-full aspect-square rounded-2xl bg-slate-50 dark:bg-github-dark-border/30 border border-dashed border-slate-200 dark:border-github-dark-border flex flex-col items-center justify-center text-slate-300">
                                                                <ImageIcon size={20} />
                                                                <span className="text-[8px] font-bold mt-1 uppercase tracking-tighter">No Photo</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Time Out Section */}
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600">
                                                                <ArrowDownRight size={16} strokeWidth={3} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="block text-[9px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest leading-none mb-1">Time Out</span>
                                                                <span className="text-sm font-black text-slate-800 dark:text-github-dark-text truncate block">{s.time_out ? new Date(s.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}</span>
                                                            </div>
                                                        </div>
                                                        {s.time_out_image ? (
                                                            <button 
                                                                onClick={() => setPreviewImage(s.time_out_image)}
                                                                className="w-full aspect-square rounded-2xl overflow-hidden border border-slate-100 dark:border-github-dark-border relative group active:scale-95 transition-all shadow-inner"
                                                            >
                                                                <img src={s.time_out_image} alt="Out" className="w-full h-full object-cover" />
                                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                                    <Eye size={20} className="text-white" />
                                                                </div>
                                                            </button>
                                                        ) : (
                                                            <div className="w-full aspect-square rounded-2xl bg-slate-50 dark:bg-github-dark-border/30 border border-dashed border-slate-200 dark:border-github-dark-border flex flex-col items-center justify-center text-slate-300">
                                                                <ImageIcon size={20} />
                                                                <span className="text-[8px] font-bold mt-1 uppercase tracking-tighter">No Photo</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Session Footer */}
                                                <div className="flex items-center justify-between pt-3 border-t border-slate-50 dark:border-github-dark-border/10">
                                                    <div className="flex items-center gap-2 text-slate-500 dark:text-github-dark-muted text-[10px] font-bold truncate max-w-[150px]">
                                                        <MapPin size={12} className="text-indigo-400" />
                                                        {s.location || 'Default Office'}
                                                    </div>
                                                    <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full">
                                                        Total: {s.total_hours || calculateHours(s.time_in, s.time_out)}
                                                    </div>
                                                </div>

                                                {s.late_minutes > 0 && s.late_reason && (
                                                    <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl flex items-start gap-2.5">
                                                        <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="block text-[8px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1">Late Reason</span>
                                                            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-tight">{s.late_reason}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )) : (
                                            <div className="py-12 bg-white dark:bg-github-dark-subtle rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-github-dark-border flex flex-col items-center justify-center text-center">
                                                <div className="w-16 h-16 bg-slate-50 dark:bg-github-dark-border/50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                                                    <Calendar size={32} />
                                                </div>
                                                <p className="text-slate-400 text-sm font-bold">No records found for today</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="logs-tab"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-6"
                            >
                                {/* Logs Subtabs - Standardized Icon Style */}
                                <div className="flex items-center gap-6 px-1 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-white/5 mb-2">
                                    {SUB_TABS.map((sub) => {
                                        const isActive = subTab === sub.id;
                                        return (
                                            <button
                                                key={sub.id}
                                                onClick={() => handleSubTabChange(sub.id)}
                                                className={`flex items-center gap-2 py-3 relative transition-all duration-300 whitespace-nowrap ${
                                                    isActive 
                                                        ? 'text-indigo-600 dark:text-indigo-400' 
                                                        : 'text-slate-400 dark:text-github-dark-muted'
                                                }`}
                                            >
                                                <sub.icon size={16} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
                                                <span className={`text-[11px] font-bold uppercase tracking-wider ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                                                    {sub.label}
                                                </span>
                                                {isActive && (
                                                    <motion.div 
                                                        layoutId="subTabUnderlineMyAttendance"
                                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                <AnimatePresence mode="wait" initial={false} custom={direction}>
                                    <motion.div
                                        key={subTab}
                                        custom={direction}
                                        variants={{
                                            enter: (direction) => ({ x: direction > 0 ? 30 : -30, opacity: 0 }),
                                            center: { x: 0, opacity: 1 },
                                            exit: (direction) => ({ x: direction < 0 ? 30 : -30, opacity: 0, position: 'absolute', width: '100%' })
                                        }}
                                        initial="enter"
                                        animate="center"
                                        exit="exit"
                                        transition={{ type: "spring", stiffness: 400, damping: 40 }}
                                        drag="x"
                                        dragConstraints={{ left: 0, right: 0 }}
                                        dragElastic={0.2}
                                        onDragEnd={(e, info) => {
                                            if (info.offset.x < -80) handleSwipe('left');
                                            else if (info.offset.x > 80) handleSwipe('right');
                                        }}
                                        className="space-y-4 pt-4"
                                    >
                                        {subTab === 'history' && (
                                            <div className="space-y-4">
                                        {monthlySessions.length > 0 ? monthlySessions.map((s, idx) => (
                                            <div key={s.acr_id || s.id || s.time_in || s.date} className="bg-white dark:bg-github-dark-subtle p-5 rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm space-y-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 w-12 h-14 rounded-2xl flex flex-col items-center justify-center text-indigo-700 dark:text-indigo-400 font-black shrink-0 border border-indigo-100/50">
                                                        <span className="text-[10px] uppercase opacity-60 leading-none mb-0.5">{new Date(s.time_in || s.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                                                        <span className="text-xl leading-none">{new Date(s.time_in || s.date).getDate()}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-black text-sm text-slate-800 dark:text-github-dark-text">
                                                            {new Date(s.time_in || s.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                                        </h4>
                                                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                                                            <MapPin size={10} /> {s.location || "Office"}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="block text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-full leading-none">
                                                            {s.total_hours || calculateHours(s.time_in, s.time_out)}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50 dark:border-github-dark-border/10">
                                                    <div className="flex items-center justify-between bg-slate-50/50 dark:bg-github-dark-border/20 p-2 rounded-2xl">
                                                        <div>
                                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">In</span>
                                                            <span className="text-[11px] font-black text-slate-700 dark:text-github-dark-text">{new Date(s.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                        {s.time_in_image && (
                                                            <button onClick={() => setPreviewImage(s.time_in_image)} className="w-8 h-8 rounded-lg border border-white dark:border-github-dark-border overflow-hidden active:scale-90 transition-all shadow-sm">
                                                                <img src={s.time_in_image} alt="In" className="w-full h-full object-cover" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between bg-slate-50/50 dark:bg-github-dark-border/20 p-2 rounded-2xl">
                                                        <div>
                                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Out</span>
                                                            <span className="text-[11px] font-black text-slate-700 dark:text-github-dark-text">{s.time_out ? new Date(s.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}</span>
                                                        </div>
                                                        {s.time_out_image && (
                                                            <button onClick={() => setPreviewImage(s.time_out_image)} className="w-8 h-8 rounded-lg border border-white dark:border-github-dark-border overflow-hidden active:scale-90 transition-all shadow-sm">
                                                                <img src={s.time_out_image} alt="Out" className="w-full h-full object-cover" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {s.late_minutes > 0 && s.late_reason && (
                                                    <div className="p-2.5 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 rounded-xl flex items-start gap-2">
                                                        <AlertCircle size={12} className="text-amber-600 shrink-0 mt-0.5" />
                                                        <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 leading-tight">
                                                            <span className="text-amber-600/60 uppercase text-[7px] block mb-0.5">Late Reason</span>
                                                            {s.late_reason}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )) : (
                                            <p className="text-center text-slate-400 py-12 font-bold uppercase tracking-widest text-xs">No history this month</p>
                                        )}
                                    </div>
                                )}

                                {subTab === 'analytics' && (
                                    <div className="space-y-6">
                                        {/* Month Selection */}
                                        <div className="flex flex-col gap-1.5 w-full">
                                            <MonthPicker
                                                label="Select Month"
                                                value={reportMonth}
                                                onChange={(val) => setReportMonth(val)}
                                            />
                                        </div>

                                        {/* Premium Stats Grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white dark:bg-github-dark-subtle p-5 rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm">
                                                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
                                                    <CheckCircle size={20} />
                                                </div>
                                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Attendance</span>
                                                <h4 className="text-2xl font-black text-slate-800 dark:text-github-dark-text mt-1">{presentPercentage}%</h4>
                                                <p className="text-[9px] font-bold text-slate-400 mt-1">{presentCount} Days Present</p>
                                            </div>
                                            <div className="bg-white dark:bg-github-dark-subtle p-5 rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm">
                                                <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
                                                    <Clock size={20} />
                                                </div>
                                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Avg Shift</span>
                                                <h4 className="text-2xl font-black text-slate-800 dark:text-github-dark-text mt-1">{avgHours}h</h4>
                                                <p className="text-[9px] font-bold text-slate-400 mt-1">Per Working Day</p>
                                            </div>
                                            <div className="bg-white dark:bg-github-dark-subtle p-5 rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm">
                                                <div className="w-10 h-10 bg-rose-50 dark:bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-600 mb-4">
                                                    <AlertCircle size={20} />
                                                </div>
                                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Late Arrival</span>
                                                <h4 className="text-2xl font-black text-slate-800 dark:text-github-dark-text mt-1">{lateCount}</h4>
                                                <p className="text-[9px] font-bold text-slate-400 mt-1">{latePercentage}% of shifts</p>
                                            </div>
                                            <div className="bg-white dark:bg-github-dark-subtle p-5 rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm">
                                                <div className="w-10 h-10 bg-sky-50 dark:bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-600 mb-4">
                                                    <BarChart3 size={20} />
                                                </div>
                                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Short Shifts</span>
                                                <h4 className="text-2xl font-black text-slate-800 dark:text-github-dark-text mt-1">{underHoursCount}</h4>
                                                <p className="text-[9px] font-bold text-slate-400 mt-1">Under 8 Hours</p>
                                            </div>
                                        </div>

                                        {/* Trends Chart */}
                                        <div className="bg-white dark:bg-github-dark-subtle p-6 rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm">
                                            <h3 className="text-[10px] font-black text-slate-800 dark:text-github-dark-text uppercase tracking-[0.2em] mb-8 flex items-center justify-between opacity-60">
                                                Daily Work Hours
                                                <div className="flex items-center gap-1.5 text-indigo-500 font-bold tracking-tight">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                                    Trend
                                                </div>
                                            </h3>
                                            <div className="h-48 -ml-4">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={attendanceTrendData}>
                                                        <defs>
                                                            <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:opacity-10" />
                                                        <XAxis dataKey="date" hide />
                                                        <YAxis hide />
                                                        <RechartsTooltip 
                                                            contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: 'rgb(255 255 255 / 0.9)' }}
                                                            itemStyle={{ color: '#6366f1', fontWeight: 'bold' }}
                                                        />
                                                        <Area type="monotone" dataKey="hours" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* Download Action Section */}
                                        <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20">
                                            <div className="relative z-10">
                                                <h3 className="text-xl font-black tracking-tight mb-2">Monthly Summary</h3>
                                                <p className="text-indigo-100/70 text-[11px] font-medium mb-4 max-w-[200px]">Download your detailed attendance report for {new Date(reportMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>
                                                <div className="mb-5">
                                                    <label className="block text-[9px] font-black uppercase text-indigo-200 tracking-wider mb-2">File Format</label>
                                                    <select
                                                        value={fileFormat}
                                                        onChange={(e) => setFileFormat(e.target.value)}
                                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-white/20 cursor-pointer"
                                                    >
                                                        <option value="xlsx" className="text-slate-800">Excel (xlsx)</option>
                                                        <option value="csv" className="text-slate-800">CSV (csv)</option>
                                                        <option value="pdf" className="text-slate-800">PDF (pdf)</option>
                                                    </select>
                                                </div>
                                                <button
                                                    onClick={downloadReport}
                                                    disabled={isDownloading}
                                                    className="w-full py-4 bg-white text-indigo-600 text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] transition-all"
                                                >
                                                    {isDownloading ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
                                                    Download Report
                                                </button>
                                            </div>
                                            {/* Abstract Background Element */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-sky-400/20 rounded-full -ml-12 -mb-12 blur-2xl" />
                                        </div>
                                    </div>
                                )  }

                                {subTab === 'corrections' && (
                                    <div className="space-y-4">
                                        <div className="flex gap-2 mb-2">
                                            {['pending', 'history'].map(f => (
                                                <button
                                                    key={f}
                                                    onClick={() => setCorrectionFilter(f)}
                                                    className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                                                        correctionFilter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-transparent border-slate-200 text-slate-400'
                                                    }`}
                                                >
                                                    {f}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="space-y-3">
                                            {filteredCorrections.length > 0 ? filteredCorrections.map((item, idx) => (
                                                <div
                                                    key={item.acr_id || item.request_id || item.id}
                                                    onClick={() => handleRequestClick(item)}
                                                    className="bg-white dark:bg-github-dark-subtle p-5 rounded-3xl border border-slate-100 dark:border-github-dark-border shadow-sm flex items-center justify-between active:scale-95 transition-all"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                                            <FileText size={18} />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-sm text-slate-800 dark:text-github-dark-text truncate max-w-[150px] leading-none">{item.correction_type}</h4>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1.5">{new Date(item.request_date).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                                                        item.status?.toLowerCase() === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                        item.status?.toLowerCase() === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                                    }`}>
                                                        {item.status || 'PENDING'}
                                                    </span>
                                                </div>
                                            )) : (
                                                <p className="text-center text-slate-400 py-12 font-bold uppercase tracking-widest text-xs">No {correctionFilter} requests</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                                    </motion.div>
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* --- MODALS & PORTALS --- */}

            {/* Camera Overlay */}
            {showCamera && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
                    <div className="flex-1 relative">
                        {imgSrc ? (
                            <img src={imgSrc} alt="Captured" className="w-full h-full object-cover" />
                        ) : (
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="w-full h-full object-cover"
                                videoConstraints={{ facingMode: "user" }}
                            />
                        )}
                        <button onClick={closeCamera} className="absolute top-6 right-6 p-4 bg-black/50 text-white rounded-full backdrop-blur-md">
                            <X size={24} />
                        </button>

                        <div className="absolute bottom-12 left-0 right-0 px-10">
                            {!imgSrc ? (
                                <button onClick={capture} className="w-20 h-20 bg-white rounded-full mx-auto border-8 border-white/30 flex items-center justify-center">
                                    <div className="w-14 h-14 bg-indigo-600 rounded-full" />
                                </button>
                            ) : (
                                <div className="flex gap-4">
                                    <button onClick={retake} className="flex-1 py-5 bg-white/10 backdrop-blur-md text-white font-black uppercase tracking-widest rounded-2xl border border-white/20">Retake</button>
                                    <button onClick={confirmAttendance} disabled={isSubmitting} className="flex-1 py-5 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl">
                                        {isSubmitting ? 'Processing...' : 'Confirm'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Correction Modal */}
            <AnimatePresence>
                {isCorrectionOpen && (
                    <div className="fixed inset-0 z-[1000] flex items-end justify-center">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            onClick={() => setIsCorrectionOpen(false)} 
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                        />
                        <motion.div 
                            initial={{ y: '100%' }} 
                            animate={{ y: 0 }} 
                            exit={{ y: '100%' }} 
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="relative w-full bg-white dark:bg-[#121212] rounded-t-[3rem] p-8 pb-12 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto no-scrollbar border-t border-white/10"
                        >
                            {/* Handle Bar */}
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-8 shrink-0" />

                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Apply Correction</h3>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-widest mt-1">Adjust your attendance records</p>
                                </div>
                                <button onClick={() => setIsCorrectionOpen(false)} className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-400">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-8">
                                {/* Date Selection */}
                                <div className="space-y-3 relative z-30">
                                    <MobileDatePicker
                                        label="Adjustment Date"
                                        value={correctionForm.date}
                                        onChange={(val) => setCorrectionForm({...correctionForm, date: val})}
                                    />
                                </div>

                                {/* Type Selection */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.2em] px-1">Correction Type</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['Missed Punch', 'Overtime', 'Correction', 'Other'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setCorrectionForm({...correctionForm, type})}
                                                className={`py-4 px-2 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border ${
                                                    correctionForm.type === type 
                                                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20' 
                                                        : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-github-dark-muted border-slate-100 dark:border-white/5'
                                                }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Method Toggle */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.2em] px-1">Method</label>
                                    <div className="flex p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setCorrectionForm({...correctionForm, method: 'manual'})}
                                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${correctionForm.method === 'manual' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                        >
                                            Manual Entry
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCorrectionForm({...correctionForm, method: 'reset'})}
                                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${correctionForm.method === 'reset' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                        >
                                            Reset Day
                                        </button>
                                    </div>
                                </div>

                                {/* Sessions Logic */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.2em]">Sessions</label>
                                        {correctionForm.method === 'manual' && (
                                            <button 
                                                onClick={addSession}
                                                className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg"
                                            >
                                                + Add
                                            </button>
                                        )}
                                    </div>

                                    {correctionForm.method === 'manual' ? (
                                        <div className="space-y-3">
                                            {correctionForm.sessions.map((s, idx) => (
                                                <div key={idx} className="flex items-center gap-3 bg-slate-50 dark:bg-white/5 p-4 rounded-[2rem] border border-slate-100 dark:border-white/5">
                                                    <div className="flex-1 space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">In</label>
                                                        <input 
                                                            type="time" 
                                                            value={s.in} 
                                                            onChange={(e) => updateSession(idx, 'in', e.target.value)}
                                                            className="w-full bg-white dark:bg-slate-900 rounded-xl p-3 text-xs font-bold dark:text-white border border-slate-100 dark:border-white/10" 
                                                        />
                                                    </div>
                                                    <div className="flex-1 space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Out</label>
                                                        <input 
                                                            type="time" 
                                                            value={s.out} 
                                                            onChange={(e) => updateSession(idx, 'out', e.target.value)}
                                                            className="w-full bg-white dark:bg-slate-900 rounded-xl p-3 text-xs font-bold dark:text-white border border-slate-100 dark:border-white/10" 
                                                        />
                                                    </div>
                                                    {correctionForm.sessions.length > 1 && (
                                                        <button onClick={() => removeSession(idx)} className="mt-4 p-2 text-rose-500">
                                                            <XCircle size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/20 p-5 rounded-2xl">
                                            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 leading-relaxed italic">
                                                * Resetting the day will remove all existing logs for this date and replace them with a single manual entry.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.2em] px-1">Reason for correction</label>
                                    <textarea
                                        value={correctionForm.reason}
                                        onChange={(e) => setCorrectionForm({...correctionForm, reason: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[1.5rem] p-5 text-sm font-bold min-h-[120px] focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white resize-none"
                                        placeholder="Please explain the reason for this adjustment..."
                                    />
                                </div>

                                <button 
                                    onClick={handleCorrectionSubmit} 
                                    className="w-full py-5 bg-indigo-600 text-white text-xs font-black uppercase tracking-[0.2em] rounded-[1.5rem] shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                                >
                                    <FileClock size={20} />
                                    Submit Request
                                </button>
                                <p className="text-[9px] text-center text-slate-400 font-bold uppercase mt-4 tracking-widest opacity-60">Requires admin approval</p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Success Popup */}
            <AnimatePresence>
                {showSuccessPopup && (
                    <div className="fixed inset-0 z-[2001] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSuccessPopup(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="relative w-full max-w-sm bg-white dark:bg-github-dark-subtle rounded-[3rem] p-10 text-center shadow-3xl">
                            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter">Success!</h3>
                            <p className="text-sm text-slate-500 dark:text-github-dark-muted mb-8 font-medium">Your request has been submitted for approval.</p>
                            <button onClick={() => setShowSuccessPopup(false)} className="w-full py-5 bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl">Dismiss</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Image Preview Modal */}
            <AnimatePresence>
                {previewImage && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            onClick={() => setPreviewImage(null)} 
                            className="absolute inset-0 bg-black/90 backdrop-blur-xl" 
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.9, opacity: 0 }} 
                            className="relative w-full max-w-lg aspect-[3/4] bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10"
                        >
                            <img src={previewImage} alt="Attendance" className="w-full h-full object-cover" />
                            <button 
                                onClick={() => setPreviewImage(null)} 
                                className="absolute top-6 right-6 w-12 h-12 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center border border-white/10 active:scale-95 transition-all"
                            >
                                <X size={24} />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent">
                                <div className="flex items-center gap-3 text-white">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                                        <Camera size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-sm uppercase tracking-widest">Attendance Photo</h4>
                                        <p className="text-[10px] font-bold text-white/60 uppercase mt-1">Verification Image</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </MobileDashboardLayout>
    );
};

export default MobileAttendancePage;
