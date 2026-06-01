import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../components/DashboardLayout';
import Webcam from 'react-webcam';
import {
    ArrowRight,
    LogOut,
    MapPin,
    Calendar as CalendarIcon,
    Camera,
    X,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    FileText,
    Download,
    Clock,
    BarChart3,
    History,
    MoreVertical,
    AlertCircle,
    Check,
    FileClock,
    CheckCircle,
    XCircle,
    Eye,
    User,
    Plus,
    ArrowUpRight
} from 'lucide-react';
import { attendanceService } from '../../services/attendanceService';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler
} from 'chart.js';
import { Bar, Doughnut, Radar } from 'react-chartjs-2';

import CustomCalendar from '../../components/CustomCalendar';
import DatePicker from '../../components/DatePicker';
import { getStatusStyle, ATTENDANCE_STATUS } from '../../utils/attendanceStatus';

// Register ChartJS
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler
);

const ThemedSelect = ({ label, value, options, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value) || options[0];

    return (
        <div className="space-y-3" ref={containerRef}>
            {label && <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-[0.2em] px-1">{label}</label>}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl flex items-center justify-between text-slate-700 dark:text-white font-bold transition-all hover:bg-white dark:hover:bg-white/10 active:scale-[0.99] shadow-sm"
                >
                    <span>{selectedOption.label}</span>
                    <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                        <ChevronRight size={18} className="text-slate-400 rotate-90" />
                    </div>
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 right-0 mt-2 z-[150] bg-white/90 dark:bg-github-dark-subtle/90 border border-slate-100 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
                        >
                            <div className="p-2 max-h-60 overflow-y-auto no-scrollbar">
                                {options.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(opt.value);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all mb-1 last:mb-0 ${value === opt.value ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const Attendance = () => {
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [location, setLocation] = useState({ lat: null, lng: null, address: 'Fetching location...', error: null });
    const [isLoadingLoc, setIsLoadingLoc] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        
        const fetchLocation = async () => {
            if (!navigator.geolocation) {
                setLocation(prev => ({ ...prev, error: "Geolocation not supported", address: "Location Access Denied" }));
                return;
            }

            setIsLoadingLoc(true);

            const onSuccess = async (pos) => {
                const { latitude, longitude } = pos.coords;
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await res.json();
                    const addr = data.address;
                    const simplifiedAddress = addr.suburb || addr.neighbourhood || addr.city_district || addr.city || addr.town || addr.village || data.display_name?.split(',')[0];
                    
                    setLocation({
                        lat: latitude,
                        lng: longitude,
                        address: simplifiedAddress || 'Unknown Location',
                        error: null
                    });
                } catch (err) {
                    setLocation({ lat: latitude, lng: longitude, address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, error: null });
                } finally {
                    setIsLoadingLoc(false);
                }
            };

            const onError = (err) => {
                console.warn("fetchLocation (highAccuracy=true) failed, trying fallback with low accuracy...", err);
                if (err.code === 3 || err.code === 1) {
                    navigator.geolocation.getCurrentPosition(
                        onSuccess,
                        (fallbackErr) => {
                            setLocation(prev => ({ ...prev, error: fallbackErr.message, address: 'Location Access Denied' }));
                            setIsLoadingLoc(false);
                        },
                        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
                    );
                } else {
                    setLocation(prev => ({ ...prev, error: err.message, address: 'Location Access Denied' }));
                    setIsLoadingLoc(false);
                }
            };

            navigator.geolocation.getCurrentPosition(
                onSuccess,
                onError,
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
            );
        };

        fetchLocation();
        
        let watchId;
        const startWatch = (highAccuracy = true) => {
            if (!navigator.geolocation) return;
            watchId = navigator.geolocation.watchPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    // Only update address if moved significantly (approx 100m)
                    setLocation(prev => ({ ...prev, lat: latitude, lng: longitude }));
                },
                (err) => {
                    console.warn(`watchPosition (highAccuracy=${highAccuracy}) failed in Attendance.jsx:`, err);
                    if (highAccuracy && (err.code === 3 || err.code === 1)) {
                        if (watchId) navigator.geolocation.clearWatch(watchId);
                        startWatch(false);
                    }
                },
                { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: 30000 }
            );
        };

        startWatch(true);

        return () => {
            clearInterval(timer);
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, []);

    // Current date for Mark Attendance
    const today = new Date();
    const formattedToday = today.toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(formattedToday);

    // Month for Reports/History/Analytics
    const [reportYear, setReportYear] = useState(today.getFullYear());
    const [reportMonthIdx, setReportMonthIdx] = useState(today.getMonth()); // 0-11
    const [fileFormat, setFileFormat] = useState('xlsx');

    // Derived YYYY-MM string for API
    const reportMonth = `${reportYear}-${String(reportMonthIdx + 1).padStart(2, '0')}`;

    // Data State
    const [dailySessions, setDailySessions] = useState([]); // For Mark Attendance tab
    const [monthlySessions, setMonthlySessions] = useState([]); // For My Attendance tab
    const [loading, setLoading] = useState(false);
    const [holidays, setHolidays] = useState([]);
    const [myShift, setMyShift] = useState(null);

    // Fetch Holidays and Shift Policy
    useEffect(() => {
        attendanceService.getHolidays()
            .then(data => setHolidays(data.holidays || []))
            .catch(console.error);
            
        attendanceService.getMyShiftPolicy()
            .then(data => {
                if (data.ok) setMyShift(data.shift);
            })
            .catch(console.error);
    }, []);

    // Navigation State
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('tab') || 'mark_attendance';
    });
    const [subTab, setSubTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('subTab') || 'history';
    });
    const [isCorrectionDrawerOpen, setIsCorrectionDrawerOpen] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const sTab = params.get('subTab');
        if (tab) {
            setActiveTab(tab);
        }
        if (sTab) {
            setSubTab(sTab);
        }
    }, [window.location.search]);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('mano-active-tab', {
            detail: { tab: activeTab, subTab }
        }));
    }, [activeTab, subTab]);

    const [viewerImage, setViewerImage] = useState(null);

    // Calendar State
    const [showCalendar, setShowCalendar] = useState(false);
    const calendarRef = useRef(null);

    // Handle outside click to close calendar
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target)) {
                setShowCalendar(false);
            }
        };
        if (showCalendar) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showCalendar]);

    // Camera State
    const [showCamera, setShowCamera] = useState(false);
    const [cameraMode, setCameraMode] = useState(null); // 'IN' or 'OUT'
    const webcamRef = useRef(null);
    const [imgSrc, setImgSrc] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    // Late Reason Context
    const [requireLateReason, setRequireLateReason] = useState(false);
    const [lateReasonMessage, setLateReasonMessage] = useState("");
    const [lateReasonText, setLateReasonText] = useState("");

    // Correction Request State
    const [correctionHistory, setCorrectionHistory] = useState([]);

    // Default corrDate to today
    const [corrDate, setCorrDate] = useState(() => {
        const d = new Date();
        const yOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - yOffset).toISOString().split('T')[0];
    });

    const [corrType, setCorrType] = useState('Correction'); // 'Correction' | 'Missed Punch' | 'Overtime' | 'Other'
    const [corrOtherType, setCorrOtherType] = useState(''); // Custom type input
    const [corrMethod, setCorrMethod] = useState('add_session'); // 'add_session' | 'reset'

    // Inputs for 'fix' and 'reset'
    const [corrIn, setCorrIn] = useState('');
    const [corrOut, setCorrOut] = useState('');

    // Inputs for 'add_session'
    const [corrSessions, setCorrSessions] = useState([{ id: Date.now(), time_in: '', time_out: '' }]);

    const [corrReason, setCorrReason] = useState('');
    const [existingRecord, setExistingRecord] = useState(null);
    const [originalSessions, setOriginalSessions] = useState([]); // Immutable snapshot of DB records at date-load time
    const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null); // For details sidebar
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
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

    useEffect(() => {
        // Auto-scroll to selected date in the scroller
        const element = document.getElementById("selected-date-btn");
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [selectedDate, scrollerDates]);

    // --- DATA FETCHING ---

    const [globalActiveSession, setGlobalActiveSession] = useState(false);
    const [missedPunchWarning, setMissedPunchWarning] = useState(null); // { dates: ['2026-05-01', ...] }

    // 1. Fetch Daily Records (for "Mark Attendance" tab)
    const fetchDailyRecords = useCallback(async () => {
        if (activeTab !== 'mark_attendance') return;
        setLoading(true);
        try {
            const res = await attendanceService.getMyRecords(selectedDate, selectedDate);
            if (res.ok) setDailySessions(res.data);

            // Fetch recent records to detect missed punches and today's active session
            const recentRes = await attendanceService.getMyRecords();
            if (recentRes && recentRes.data && recentRes.data.length > 0) {
                const today = new Date();
                const todayDateStr = today.toISOString().split('T')[0];
                
                // Create a midnight copy for day calculation
                const todayMidnight = new Date(today);
                todayMidnight.setHours(0, 0, 0, 0);

                const deadlineDays = myShift?.rules?.correction_deadline || 2;
                const missedDates = [];
                let hasTodayActiveSession = false;

                for (const session of recentRes.data) {
                    if (!session.time_out) {
                        const sessionDate = new Date(session.time_in);
                        const sessionDateStr = sessionDate.toISOString().split('T')[0];

                        if (sessionDateStr < todayDateStr) {
                            // PAST DATE missed checkout
                            const diffTime = todayMidnight - new Date(sessionDate).setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            // Show banner if not already escalated to ABSENT/REJECTED and within deadline
                            const isNotProcessed = !['ABSENT', 'REJECTED'].includes(session.status);
                            if (isNotProcessed && diffDays <= deadlineDays) {
                                missedDates.push(sessionDateStr);
                            }
                        } else if (sessionDateStr === todayDateStr) {
                            // TODAY'S active session
                            hasTodayActiveSession = true;
                        }
                    }
                }

                setGlobalActiveSession(hasTodayActiveSession);
                setMissedPunchWarning(missedDates.length > 0 ? { dates: [...new Set(missedDates)] } : null);
            } else {
                setGlobalActiveSession(false);
                setMissedPunchWarning(null);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch daily records");
        } finally {
            setLoading(false);
        }
    }, [selectedDate, activeTab, myShift]);

    // 2. Fetch Monthly Records (for "My Attendance" tab - History & Analytics)
    const fetchMonthlyRecords = useCallback(async () => {
        if (activeTab !== 'my_attendance') return;
        setLoading(true);
        try {
            const year = reportMonth.split('-')[0];
            const month = reportMonth.split('-')[1];
            const startDate = `${year}-${month}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];

            const res = await attendanceService.getMyRecords(startDate, endDate);
            if (res.ok) setMonthlySessions(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch monthly records");
        } finally {
            setLoading(false);
        }
    }, [reportMonth, activeTab]);

    // 3. Fetch Correction History (my own requests only, even for admins)
    const fetchCorrectionHistory = useCallback(async () => {
        if (activeTab === 'my_attendance' && subTab === 'correction') {
            setLoading(true);
            try {
                const res = await attendanceService.getCorrectionRequests({ limit: 10000, my_requests: 'true' });
                const history = res.data || [];
                setCorrectionHistory(history);
                // Auto-select the first item: fetch its full details for the right panel
                if (history.length > 0) {
                    const first = history[0];
                    const requestId = first.acr_id || first.request_id || first.id;
                    try {
                        setIsFetchingDetails(true);
                        const detail = await attendanceService.getCorrectionDetails(requestId);
                        setSelectedRequest({ ...first, ...(detail.data || detail) });
                    } catch {
                        setSelectedRequest(first);
                    } finally {
                        setIsFetchingDetails(false);
                    }
                } else {
                    setSelectedRequest(null);
                }
            } catch (error) {
                console.error(error);
                toast.error("Failed to fetch correction history");
            } finally {
                setLoading(false);
            }
        }
    }, [activeTab, subTab]);


    // 4. Fetch Existing Record for Correction Date
    useEffect(() => {
        if (!corrDate) {
            setExistingRecord(null);
            return;
        }

        const fetchRecord = async () => {
            try {
                const res = await attendanceService.getMyRecords(corrDate, corrDate);
                if (res?.data && res.data.length > 0) {
                    setExistingRecord(res.data[0]);

                    // Parse out all sessions and auto-populate the add_session array
                    const userSessions = res.data;
                    const loadedSessions = userSessions.map((s, i) => {
                        let time_in_str = '';
                        let time_out_str = '';
                        if (s.time_in) {
                            time_in_str = new Date(s.time_in).toTimeString().slice(0, 5);
                        }
                        if (s.time_out) {
                            time_out_str = new Date(s.time_out).toTimeString().slice(0, 5);
                        }
                        return { id: Date.now() + i, time_in: time_in_str, time_out: time_out_str, isExisting: true };
                    });

                    // Save a frozen snapshot for original_data — never modified by form edits
                    setOriginalSessions(loadedSessions.map(s => ({ time_in: s.time_in, time_out: s.time_out })));

                    // Pre-fill form with existing sessions (user will edit these)
                    setCorrSessions(loadedSessions);

                } else {
                    setExistingRecord(null);
                    setOriginalSessions([]);
                    setCorrSessions([{ id: Date.now(), time_in: '', time_out: '' }]);
                }
            } catch (error) {
                console.error("Failed to fetch existing record", error);
                setExistingRecord(null);
                setOriginalSessions([]);
                setCorrSessions([{ id: Date.now(), time_in: '', time_out: '' }]);
            }
        };

        fetchRecord();
    }, [corrDate]);

    useEffect(() => {
        fetchDailyRecords();
    }, [fetchDailyRecords]);

    useEffect(() => {
        fetchMonthlyRecords();
    }, [fetchMonthlyRecords]);

    useEffect(() => {
        fetchCorrectionHistory();
    }, [fetchCorrectionHistory]);


    // --- ACTION HANDLERS ---

    const openCamera = (mode) => {
        setCameraMode(mode);
        setImgSrc(null);
        setRequireLateReason(false);
        setLateReasonMessage("");
        setLateReasonText("");
        setShowCamera(true);
    };

    const closeCamera = () => {
        setShowCamera(false);
        setImgSrc(null);
        setCameraMode(null);
        setRequireLateReason(false);
        setLateReasonMessage("");
        setLateReasonText("");
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setImgSrc(imageSrc);
    }, [webcamRef]);

    const retake = () => {
        setImgSrc(null);
    };

    const dataURLtoBlob = (dataurl) => {
        let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    const confirmAttendance = async () => {
        if (!imgSrc) return;
        setIsSubmitting(true);

        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported");
            setIsSubmitting(false);
            return;
        }

        const submitData = async (position) => {
            try {
                const { latitude, longitude, accuracy } = position.coords;
                // const MAX_ALLOWED_ACCURACY = 200; 
                // if (accuracy > MAX_ALLOWED_ACCURACY) ... (Strict check disabled for dev flexibility if needed, but keeping generally)

                const imageBlob = dataURLtoBlob(imgSrc);
                let payload = { latitude, longitude, accuracy, imageFile: imageBlob };

                if (requireLateReason && lateReasonText.trim()) {
                    payload.late_reason = lateReasonText;
                }

                let res;
                if (cameraMode === 'IN') {
                    res = await attendanceService.timeIn(payload);
                    toast.success("Checked In Successfully!");
                } else {
                    res = await attendanceService.timeOut(payload);
                    toast.success("Checked Out Successfully!");
                }

                closeCamera();
                fetchDailyRecords();
            } catch (error) {
                console.error(error);

                // Intercept Late Reason missing error
                const errorMsg = error.message || "Attendance failed";
                const errorLower = errorMsg.toLowerCase();

                if (cameraMode === 'IN' && errorLower.includes("late") && errorLower.includes("reason")) {
                    setRequireLateReason(true);
                    setLateReasonMessage(errorMsg);
                    toast.warning(errorMsg);
                } else {
                    toast.error(errorMsg);
                }
            } finally {
                setIsSubmitting(false);
            }
        };

        const handleGeoError = (error) => {
            console.warn("High accuracy geolocation failed during punch-in/out, retrying with low accuracy...", error);
            if (error.code === 3 || error.code === 1) {
                navigator.geolocation.getCurrentPosition(
                    submitData,
                    (fallbackError) => {
                        console.error("Fallback geolocation also failed:", fallbackError);
                        toast.error("Location error: " + fallbackError.message);
                        setIsSubmitting(false);
                    },
                    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
                );
            } else {
                toast.error("Location error: " + error.message);
                setIsSubmitting(false);
            }
        };

        navigator.geolocation.getCurrentPosition(
            submitData,
            handleGeoError,
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        );
    };

    const handleDownloadReport = async () => {
        const toastId = toast.loading("Report compilation starting...");
        try {
            const res = await attendanceService.downloadMyReport(reportMonth, fileFormat);
            if (res.ok && res.reportId) {
                toast.update(toastId, { render: "Compiling your report in the background...", type: "info", isLoading: true });
                const reportId = res.reportId;
                
                // Poll status
                const pollInterval = setInterval(async () => {
                    try {
                        const statusRes = await attendanceService.getMyReportStatus(reportId);
                        if (statusRes.ok && statusRes.data) {
                            const { status, file_url, error_message } = statusRes.data;
                            if (status === 'completed') {
                                clearInterval(pollInterval);
                                // Trigger download from S3 pre-signed URL
                                const link = document.createElement('a');
                                link.href = file_url;
                                link.setAttribute('download', `My_Attendance_${reportMonth}.${fileFormat}`);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                toast.update(toastId, { render: "Report compiled and downloaded successfully!", type: "success", isLoading: false, autoClose: 3000 });
                            } else if (status === 'failed') {
                                clearInterval(pollInterval);
                                toast.update(toastId, { render: `Generation failed: ${error_message || 'Unknown error'}`, type: "error", isLoading: false, autoClose: 4000 });
                            }
                        }
                    } catch (pollErr) {
                        console.error("Error polling report status:", pollErr);
                    }
                }, 2000);

                // Safe fallback to prevent infinite polling loop in case anything hangs
                setTimeout(() => {
                    clearInterval(pollInterval);
                }, 60000); // 1 minute max timeout
            } else {
                toast.update(toastId, { render: "Failed to queue report.", type: "error", isLoading: false, autoClose: 3000 });
            }
        } catch (error) {
            toast.update(toastId, { render: error.message || "Failed to download your report", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const handleSubmitCorrection = async (e) => {
        e.preventDefault();
        if (!corrDate || !corrReason) {
            toast.error("Date and Reason are required");
            return;
        }

        // ENFORCE DYNAMIC CORRECTION DEADLINE
        const deadlineDays = myShift?.rules?.correction_deadline || 2;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const reqDate = new Date(corrDate);
        reqDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((today - reqDate) / (1000 * 60 * 60 * 24));

        if (diffDays > deadlineDays) {
            toast.error(`Correction requests can only be submitted within ${deadlineDays} days of the attendance date.`);
            return;
        }

        // Validation for sessions if manual correction
        if (corrMethod === 'add_session') {
            const validSessions = corrSessions.filter(s => s.time_in && s.time_out);
            if (validSessions.length === 0) {
                toast.error("Please add at least one valid session (Time In & Time Out)");
                return;
            }

            for (let i = 0; i < validSessions.length; i++) {
                const sessionA = validSessions[i];
                if (sessionA.time_in >= sessionA.time_out) {
                    toast.error(`Invalid range: In (${sessionA.time_in}) must be before Out (${sessionA.time_out})`);
                    return;
                }
                for (let j = i + 1; j < validSessions.length; j++) {
                    const sessionB = validSessions[j];
                    if (sessionA.time_in < sessionB.time_out && sessionA.time_out > sessionB.time_in) {
                        toast.error(`Sessions cannot overlap: ${sessionA.time_in}-${sessionA.time_out} with ${sessionB.time_in}-${sessionB.time_out}`);
                        return;
                    }
                }
            }
        } else if (corrMethod === 'reset') {
            if (!corrIn || !corrOut) {
                toast.error("New Time In and Time Out are required for Reset.");
                return;
            }
            if (corrIn >= corrOut) {
                toast.error("Time In must be before Time Out.");
                return;
            }
        }

        setShowConfirmSubmit(true);
    };

    const handleConfirmSubmit = async () => {
        setSubmitLoading(true);
        try {
            const original_data = originalSessions;
            let proposed_data = [];

            if (corrMethod === 'add_session') {
                const validSessions = corrSessions.filter(s => s.time_in && s.time_out);
                proposed_data = validSessions.map(s => ({ time_in: s.time_in, time_out: s.time_out }));
            } else if (corrMethod === 'reset') {
                proposed_data = [{ time_in: corrIn, time_out: corrOut }];
            }

            const payload = {
                correction_type: corrType === 'Other' ? corrOtherType : corrType,
                request_date: corrDate,
                reason: corrReason,
                original_data,
                proposed_data
            };

            await attendanceService.submitCorrectionRequest(payload);
            toast.success("Correction request submitted successfully!");

            setShowConfirmSubmit(false);
            setIsCorrectionDrawerOpen(false);

            // Reset Form after delay or on success popup close
            // (We'll do it here)
            const d = new Date();
            const yOffset = d.getTimezoneOffset() * 60000;
            const todayLocal = new Date(d.getTime() - yOffset).toISOString().split('T')[0];

            setCorrDate(todayLocal);
            setCorrIn('');
            setCorrOut('');
            setCorrReason('');
            setCorrType('Correction');
            setCorrOtherType('');
            setCorrMethod('add_session');
            setCorrSessions([{ id: Date.now(), time_in: '', time_out: '' }]);
            setExistingRecord(null);

            fetchCorrectionHistory();
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to submit request");
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleRequestClick = async (req) => {
        if (isFetchingDetails) return;
        try {
            setIsFetchingDetails(true);
            const requestId = req.acr_id || req.request_id || req.id;
            const res = await attendanceService.getCorrectionDetails(requestId);
            setSelectedRequest({ ...req, ...(res.data || res) });
        } catch (error) {
            console.error("Failed to fetch correction details:", error);
            setSelectedRequest(req);
        } finally {
            setIsFetchingDetails(false);
        }
    };

    // --- HELPERS ---
    const formatCorrectionDate = (dateStr) => {
        if (!dateStr) return 'Unknown Date';
        try {
            const cleanStr = (dateStr.length === 10 && !dateStr.includes('T')) ? dateStr + 'T00:00:00' : dateStr;
            const d = new Date(cleanStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    };

    const formatDateDisplay = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    };

    const formatTime = (isoString) => {
        if (!isoString) return null;
        return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const calculateDuration = (timeIn, timeOut) => {
        if (!timeIn || !timeOut) return null;
        const start = new Date(timeIn);
        const end = new Date(timeOut);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

        let diffMs = end - start;
        // Handle overnight shifts where end time is on the next day (or incorrectly stored as same day)
        if (diffMs < 0) {
            diffMs += 24 * 60 * 60 * 1000;
        }

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours === 0) return `${minutes}m`;
        return `${hours}h ${minutes}m`;
    };

    const handlePrevDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() - 1);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const handleNextDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + 1);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    // --- ANALYTICS DATA PREP ---
    const chartData = {
        labels: monthlySessions.map(s => new Date(s.check_in || s.time_in).getDate()).reverse(),
        datasets: [
            {
                label: 'Hours Worked',
                data: monthlySessions.map(s => parseFloat(s.total_hours || 0)).reverse(),
                backgroundColor: 'rgba(79, 70, 229, 0.6)',
                borderRadius: 4,
            }
        ]
    };

    const statusCounts = monthlySessions.reduce((acc, s) => {
        const label = getStatusStyle(s.status).label;
        acc[label] = (acc[label] || 0) + 1;
        return acc;
    }, {});

    const pieData = {
        labels: Object.keys(statusCounts),
        datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: Object.keys(statusCounts).map(label => {
                if (label === 'PRESENT') return '#10b981'; // emerald-500
                if (label === 'LATE') return '#f59e0b';    // amber-500
                if (label === 'OVERTIME') return '#8b5cf6'; // violet-500
                if (label === 'ABSENT') return '#ef4444';   // red-500
                if (label === 'MISSED PUNCH') return '#f43f5e'; // rose-500
                if (label === 'HALF DAY') return '#f97316'; // orange-500
                return '#94a3b8'; // slate-400
            }),
            borderWidth: 0
        }]
    };


    // --- COMPUTE CALENDAR EVENTS ---
    const calendarEvents = {};

    // 1. Add Holidays (Yellow)
    holidays.forEach(h => {
        calendarEvents[h.holiday_date] = { type: 'holiday' };
    });

    // 2. Add Absents (Red) - Simple Approximation
    // Mark past weekdays (not Sat/Sun) as absent if no record exists
    const daysInReportMonth = new Date(reportYear, reportMonthIdx + 1, 0).getDate();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const hasRecord = (dateStr) => {
        return monthlySessions.some(s =>
            (s.time_in && s.time_in.startsWith(dateStr)) ||
            (s.check_in && s.check_in.startsWith(dateStr))
        );
    };

    for (let d = 1; d <= daysInReportMonth; d++) {
        const date = new Date(reportYear, reportMonthIdx, d);
        const dateStr = date.toISOString().split('T')[0];

        if (dateStr > todayStr) break; // Don't mark future

        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (!isWeekend && !calendarEvents[dateStr] && !hasRecord(dateStr)) {
            if (dateStr !== todayStr) {
                calendarEvents[dateStr] = { type: 'absent' };
            }
        }
    }

    // --- NON-WORKING DAY CHECK ---
    const isWorkingDayToday = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // 1. Is it a holiday?
        if (holidays.some(h => h.holiday_date === todayStr)) return false;

        // 2. Is it in the shift working days?
        if (myShift?.rules?.workingDays) {
            const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'short' });
            if (!myShift.rules.workingDays.includes(todayDay)) {
                return false;
            }
        }
        
        return true;
    }, [myShift, holidays]);

    return (
        <DashboardLayout title="Attendance">
            <div className="pb-10 overflow-x-hidden" style={{ zoom: 0.8 }}>
                {/* Premium Header / Greeting */}
                <div className="pt-6 pb-10 bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 dark:from-indigo-900/40 dark:via-indigo-950/40 dark:to-black rounded-2xl shadow-xl relative overflow-hidden">
                    {/* Animated Background Blobs */}
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            rotate: [0, 90, 0],
                        }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/20 blur-3xl rounded-full"
                    />
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.5, 1],
                            x: [0, 50, 0],
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        className="absolute -bottom-24 -left-24 w-[30rem] h-[30rem] bg-sky-500/10 blur-3xl rounded-full"
                    />

                    <div className="relative z-10 w-full px-6 mx-auto">
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight">
                                    Good {currentTime.getHours() < 12 ? 'Morning' : currentTime.getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.user_name?.split(' ')[0] || 'User'}!
                                </h1>
                                <p className="text-indigo-100/70 text-lg font-medium mt-2">
                                    {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                        </div>

                        {/* Current Time Widget */}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 bg-white/20 backdrop-blur-lg rounded-xl flex items-center justify-center text-white shadow-inner">
                                    <Clock size={40} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <span className="block text-xs font-black text-indigo-200 tracking-[0.2em] mb-1 opacity-80">Current Time</span>
                                    <span className="text-3xl font-black text-white font-mono tracking-tighter">
                                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                    </span>
                                </div>
                            </div>
                            <div className="w-full md:w-auto flex flex-col md:items-end gap-3">
                                <span className="block text-xs font-black text-indigo-200 tracking-[0.2em] opacity-80">Your Location</span>
                                <div className="flex items-center gap-3 text-white/90 font-bold text-sm bg-white/10 px-6 py-4 rounded-2xl border border-white/10 shadow-lg backdrop-blur-xl">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center">
                                        <MapPin size={18} className="text-indigo-300" />
                                    </div>
                                    <span className="truncate max-w-[200px] md:max-w-[400px]" title={location.address}>
                                        {isLoadingLoc ? 'Locating...' : location.address}
                                    </span>
                                    <button 
                                        onClick={() => window.location.reload()} 
                                        className="ml-2 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                                    >
                                        <RefreshCw size={14} className={isLoadingLoc ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Switcher - Floating Style */}
                <div className="max-w-xl mx-auto -mt-8 relative z-20 px-6">
                    <div className="bg-white/10 dark:bg-black/20 backdrop-blur-[40px] p-1.2 flex rounded-xl border border-white/40 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.1)] ring-1 ring-white/30 relative overflow-hidden group">
                        {/* Internal Liquid Highlights */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/5 blur-3xl rounded-full pointer-events-none" />
                        
                        <button
                            onClick={() => setActiveTab('mark_attendance')}
                            className={`flex-1 py-4 text-sm font-bold rounded-xl transition-all duration-500 flex items-center justify-center gap-3 z-10 ${
                                activeTab === 'mark_attendance'
                                    ? 'bg-white text-indigo-600 shadow-[0_4px_15px_rgba(0,0,0,0.1)] transform scale-[1.01]'
                                    : 'text-slate-200 dark:text-slate-400 hover:bg-white/5'
                            }`}
                        >
                            <User size={18} strokeWidth={2.5} />
                            Attendance
                        </button>
                        <button
                            onClick={() => setActiveTab('my_attendance')}
                            className={`flex-1 py-4 text-sm font-bold rounded-xl transition-all duration-500 flex items-center justify-center gap-3 z-10 ${
                                activeTab === 'my_attendance'
                                    ? 'bg-white text-indigo-600 shadow-[0_4px_15px_rgba(0,0,0,0.1)] transform scale-[1.01]'
                                    : 'text-slate-200 dark:text-slate-400 hover:bg-white/5'
                            }`}
                        >
                            <History size={18} strokeWidth={2.5} />
                            My Attendance
                        </button>
                    </div>
                </div>

                <div className="w-full mx-auto mt-6">
                    {/* 1. MARK ATTENDANCE TAB */}
                    {activeTab === 'mark_attendance' && (
                        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* Action Buttons & Correction Toggle */}
                        <div className="flex flex-col gap-6">
                            {/* Session Logic Calculation */}
                            {(() => {
                                const hasActiveSession = globalActiveSession;
                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {/* Time In Card */}
                                        <button
                                            onClick={() => openCamera('IN')}
                                            disabled={hasActiveSession}
                                            className={`group relative p-5 rounded-xl flex items-center justify-between transition-all duration-500 overflow-hidden border-2 ${
                                                hasActiveSession
                                                    ? 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-white/5 opacity-40 grayscale-[0.5]'
                                                    : 'bg-white dark:bg-github-dark-subtle border-slate-100 dark:border-white/10 shadow-lg hover:shadow-xl hover:border-emerald-500/30 active:scale-[0.98]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-4 relative z-10">
                                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-500 ${
                                                    hasActiveSession 
                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' 
                                                        : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:rotate-[15deg] group-hover:scale-110 shadow-lg shadow-emerald-500/10'
                                                }`}>
                                                    <ArrowRight size={24} strokeWidth={2.5} />
                                                </div>
                                                <div className="text-left">
                                                    <h3 className={`text-xl font-black tracking-tight ${hasActiveSession ? 'text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>Time In</h3>
                                                    <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-wider opacity-60">
                                                        {hasActiveSession ? 'Session Active' : 'Start shift for today'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center transition-all duration-300 group-hover:bg-emerald-500/10 group-hover:text-emerald-500">
                                                <ChevronRight size={20} className={hasActiveSession ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500'} />
                                            </div>
                                        </button>

                                        {/* Time Out Card */}
                                        <button
                                            onClick={() => openCamera('OUT')}
                                            disabled={!hasActiveSession}
                                            className={`group relative p-5 rounded-xl flex items-center justify-between transition-all duration-500 overflow-hidden border-2 ${
                                                !hasActiveSession
                                                    ? 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-white/5 opacity-40 grayscale-[0.5]'
                                                    : 'bg-white dark:bg-github-dark-subtle border-slate-100 dark:border-white/10 shadow-lg hover:shadow-xl hover:border-rose-500/30 active:scale-[0.98]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-4 relative z-10">
                                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-500 ${
                                                    !hasActiveSession 
                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' 
                                                        : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:rotate-[-15deg] group-hover:scale-110 shadow-lg shadow-rose-500/10'
                                                }`}>
                                                    <LogOut size={24} strokeWidth={2.5} />
                                                </div>
                                                <div className="text-left">
                                                    <h3 className={`text-xl font-black tracking-tight ${!hasActiveSession ? 'text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>Time Out</h3>
                                                    <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-wider opacity-60">
                                                        {!hasActiveSession ? 'No Active Session' : 'End your day'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center transition-all duration-300 group-hover:bg-rose-500/10 group-hover:text-rose-500">
                                                <ChevronRight size={20} className={!hasActiveSession ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500'} />
                                            </div>
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>

                        {!isWorkingDayToday && !globalActiveSession && (
                            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-lg shrink-0">
                                    <AlertCircle size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-amber-800 dark:text-amber-500">Non-Working Day</p>
                                    <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-0.5">
                                        Today is not a scheduled working day. Any hours worked today will not be counted towards your regular attendance.
                                    </p>
                                </div>
                            </div>
                        )}

                        {missedPunchWarning && (
                            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 rounded-xl flex flex-col sm:flex-row gap-4 justify-between items-center animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-lg relative">
                                        <AlertCircle size={20} />
                                        {missedPunchWarning.dates.length > 1 && (
                                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                                {missedPunchWarning.dates.length}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-amber-800 dark:text-amber-500">Missed Time Out</p>
                                        <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-0.5">
                                            You forgot to time out on {missedPunchWarning.dates.join(', ')}. Please submit a correction request or it will be marked absent.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setActiveTab('my_attendance'); setSubTab('correction'); }}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap shadow-sm"
                                >
                                    Fix Now
                                </button>
                            </div>
                        )}

                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex justify-end items-center gap-4 relative" ref={calendarRef}>
                                <button
                                    onClick={handlePrevDay}
                                    className="p-2 rounded-xl bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                <div
                                    onClick={() => setShowCalendar(!showCalendar)}
                                    className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-dark-card py-2.5 px-6 rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border min-w-[200px] cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors select-none"
                                >
                                    <CalendarIcon size={18} />
                                    <span>{formatDateDisplay(selectedDate)}</span>
                                </div>

                                    {showCalendar && (
                                        <div className="absolute top-full right-0 mt-4 z-[100] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                                            <CustomCalendar
                                                selectedDate={selectedDate}
                                                onChange={(date) => {
                                                    setSelectedDate(date);
                                                    setShowCalendar(false);
                                                }}
                                                onClose={() => setShowCalendar(false)}
                                                events={calendarEvents}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Horizontal Date Scroller */}
                            <div className="flex gap-4 overflow-x-auto py-6 px-2 no-scrollbar scroll-smooth">
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
                                            className={`flex flex-col items-center justify-center min-w-[70px] h-24 rounded-xl transition-all duration-500 relative group ${
                                                isSelected 
                                                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/40 transform scale-105 z-10' 
                                                    : 'bg-white dark:bg-github-dark-subtle text-slate-400 dark:text-github-dark-muted border border-slate-100 dark:border-white/5 hover:border-indigo-600/30'
                                            }`}
                                        >
                                            <span className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                {dayName}
                                            </span>
                                            <span className="text-xl font-black">{date.getDate()}</span>
                                            {isToday && !isSelected && <div className="absolute bottom-3 w-1 h-1 bg-indigo-500 rounded-full animate-pulse"></div>}
                                            {isSelected && <motion.div layoutId="activeDate" className="absolute -inset-0.5 rounded-xl border-2 border-indigo-600/50" />}
                                        </button>
                                    );
                                })}
                        </div>

                        {/* Logs Section Header */}
                        <div className="pt-8">
                            <div className="flex items-center justify-between mb-8 px-2">
                                <div className="flex items-center gap-4">
                                    <div className="w-1.5 h-8 bg-indigo-600 rounded-full" />
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                                        {selectedDate === new Date().toISOString().split('T')[0] ? "Today's Logs" : `Logs for ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                    </h3>
                                </div>
                                <button 
                                    onClick={() => {
                                        setCorrDate(selectedDate);
                                        setIsCorrectionDrawerOpen(true);
                                    }} 
                                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-[10px] tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2 rounded-xl hover:shadow-lg transition-all active:scale-95 border border-indigo-100/50 dark:border-indigo-500/20"
                                >
                                    <Plus size={14} strokeWidth={3} /> Request Correction
                                </button>
                            </div>

                            {/* Daily Records List */}
                            <div className="space-y-4">
                                {loading ? (
                                    <p className="text-center text-slate-500 py-10">Loading...</p>
                                ) : dailySessions.length === 0 ? (
                                    <p className="text-center text-slate-400 py-10">No attendance records for this date.</p>
                                ) : (
                                    dailySessions.map((session, idx) => (
                                        <div key={session.attendance_id || session.id} className="bg-white dark:bg-github-dark-subtle p-5 rounded-xl border border-slate-100 dark:border-white/5 shadow-md space-y-6 transition-all hover:shadow-xl">
                                            {/* Session Header */}
                                            <div className="flex justify-between items-center pb-4 border-b border-slate-50 dark:border-white/5">
                                                <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <div className="p-1.5 bg-slate-50 dark:bg-white/5 rounded-lg">
                                                        <Clock size={14} />
                                                    </div>
                                                    Session #{dailySessions.length - idx}
                                                </span>
                                                <div className="flex flex-col items-end gap-2">
                                                    {(() => {
                                                        const st = (session.status || (session.late_minutes > 0 ? 'LATE' : 'PRESENT')).toUpperCase();
                                                        const style = getStatusStyle(st);
                                                        return (
                                                            <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-sm flex items-center gap-2 ${style.bg} ${style.text}`}>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse`} />
                                                                {style.label}
                                                            </span>
                                                        );
                                                    })()}
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-50/50 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-slate-100/50 dark:border-white/5">
                                                        <Clock size={12} className="text-indigo-500 dark:text-indigo-400 animate-pulse" />
                                                        <span>Duration: <span className="font-black text-slate-800 dark:text-white">{session.total_hours || calculateDuration(session.time_in, session.time_out) || '--'}</span></span>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* IN/OUT Sections Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                {/* Time In Section */}
                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                                                            <ArrowUpRight size={24} strokeWidth={3} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="block text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest mb-1 opacity-70">Time In</span>
                                                            <span className="text-2xl font-black text-slate-800 dark:text-white truncate block tracking-tight">
                                                                {formatTime(session.time_in)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* In Address */}
                                                    <div className="flex items-start gap-3 bg-slate-50/50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100/50 dark:border-white/5">
                                                        <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                                                            {session.time_in_address || 'Address not captured'}
                                                        </p>
                                                    </div>

                                                    {/* In Image */}
                                                    <div className="space-y-3 max-w-[280px]">
                                                        <div className="flex items-center justify-between px-1">
                                                            <p className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest opacity-60">Verification Image</p>
                                                            {session.time_in_image && <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">Captured</span>}
                                                        </div>
                                                        <div 
                                                            onClick={() => session.time_in_image && setViewerImage(session.time_in_image)}
                                                            className="aspect-video rounded-xl overflow-hidden border-2 border-slate-100 dark:border-white/5 group relative shadow-inner cursor-pointer"
                                                        >
                                                            {session.time_in_image ? (
                                                                <>
                                                                    <img src={session.time_in_image} alt="In" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                                                        <Eye size={32} className="text-white transform scale-75 group-hover:scale-100 transition-transform duration-300" />
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="w-full h-full bg-slate-50 dark:bg-white/5 flex flex-col items-center justify-center gap-3">
                                                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-300">
                                                                        <Camera size={24} />
                                                                    </div>
                                                                    <span className="text-[9px] font-black text-slate-300 tracking-[0.2em]">No Image</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Time Out Section */}
                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-sm">
                                                            <LogOut size={24} strokeWidth={3} className="rotate-180" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="block text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest mb-1 opacity-70">Time Out</span>
                                                            <span className={`text-2xl font-black truncate block tracking-tight ${session.time_out ? 'text-slate-800 dark:text-white' : 'text-emerald-500 animate-pulse'}`}>
                                                                {session.time_out ? formatTime(session.time_out) : 'Active Session'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Out Address */}
                                                    <div className="flex items-start gap-3 bg-slate-50/50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100/50 dark:border-white/5">
                                                        <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                                                            {session.time_out ? (session.time_out_address || 'Address not captured') : 'Ongoing session...'}
                                                        </p>
                                                    </div>

                                                    {/* Out Image */}
                                                    <div className="space-y-3 max-w-[280px]">
                                                        <div className="flex items-center justify-between px-1">
                                                            <p className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest opacity-60">Verification Image</p>
                                                            {session.time_out_image && <span className="text-[9px] font-black text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-md">Captured</span>}
                                                        </div>
                                                        <div 
                                                            onClick={() => session.time_out_image && setViewerImage(session.time_out_image)}
                                                            className="aspect-video rounded-xl overflow-hidden border-2 border-slate-100 dark:border-white/5 group relative shadow-inner cursor-pointer"
                                                        >
                                                            {session.time_out_image ? (
                                                                <>
                                                                    <img src={session.time_out_image} alt="Out" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                                                        <Eye size={32} className="text-white transform scale-75 group-hover:scale-100 transition-transform duration-300" />
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="w-full h-full bg-slate-50 dark:bg-white/5 flex flex-col items-center justify-center gap-3">
                                                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-300">
                                                                        <Camera size={24} />
                                                                    </div>
                                                                    <span className="text-[9px] font-black text-slate-300 tracking-[0.2em]">No Image</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                )}

                {/* 2. MY ATTENDANCE TAB */}
                {activeTab === 'my_attendance' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Report Header */}
                        <div className="bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-github-dark-text leading-none">Monthly Report</h4>
                                    <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-1">Download and view your logs</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    value={reportMonthIdx}
                                    onChange={(e) => setReportMonthIdx(parseInt(e.target.value))}
                                    className="px-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i} value={i}>
                                            {new Date(0, i).toLocaleString('en-US', { month: 'long' })}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={reportYear}
                                    onChange={(e) => setReportYear(parseInt(e.target.value))}
                                    className="px-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                                <select
                                    value={fileFormat}
                                    onChange={(e) => setFileFormat(e.target.value)}
                                    className="px-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    <option value="xlsx">Excel (xlsx)</option>
                                    <option value="csv">CSV (csv)</option>
                                    <option value="pdf">PDF (pdf)</option>
                                </select>
                                <button
                                    onClick={handleDownloadReport}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                                >
                                    <Download size={16} />
                                    Download
                                </button>
                            </div>
                        </div>

                        {/* Sub Tabs */}
                        <div className="border-b border-slate-200 dark:border-github-dark-border flex gap-6">
                            <button
                                onClick={() => setSubTab('history')}
                                className={`pb-3 text-sm font-medium transition-all relative ${subTab === 'history'
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <History size={16} />
                                    History
                                </div>
                                {subTab === 'history' && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                                )}
                            </button>
                            <button
                                onClick={() => setSubTab('analytics')}
                                className={`pb-3 text-sm font-medium transition-all relative ${subTab === 'analytics'
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <BarChart3 size={16} />
                                    Analytics
                                </div>
                                {subTab === 'analytics' && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                                )}
                            </button>
                            <button
                                onClick={() => setSubTab('correction')}
                                className={`pb-3 text-sm font-medium transition-all relative ${subTab === 'correction'
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <FileClock size={16} />
                                    Correction Requests
                                </div>
                                {subTab === 'correction' && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                                )}
                            </button>
                        </div>

                        {/* SUB-TAB: HISTORY (Weekly Grouped) */}
                        {subTab === 'history' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {monthlySessions.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl border border-slate-200 dark:border-github-dark-border border-dashed">
                                        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500 font-medium">No records found for this month</p>
                                    </div>
                                ) : (
                                    // Group by Week
                                    Object.entries(monthlySessions.reduce((groups, session) => {
                                        const date = new Date(session.time_in || session.check_in); // Handle both key names if backend varies
                                        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
                                        const weekNumber = Math.ceil((((date - firstDay) / 86400000) + firstDay.getDay() + 1) / 7);
                                        const weekKey = `Week ${weekNumber}`;

                                        if (!groups[weekKey]) groups[weekKey] = [];
                                        groups[weekKey].push(session);
                                        return groups;
                                    }, {})).sort().map(([week, weekSessions]) => (
                                        <div key={week} className="space-y-4">
                                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 sticky top-0 bg-slate-50/95 dark:bg-black/20 backdrop-blur-sm py-2 z-10">
                                                {week}
                                            </h3>
                                            <div className="grid gap-4">
                                                {weekSessions.map((session, index) => (
                                                    <div key={session.attendance_id || index} className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-github-dark-border hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${getStatusStyle(session.status).bg} ${getStatusStyle(session.status).text}`}>
                                                                    {new Date(session.time_in).getDate()}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-800 dark:text-github-dark-text">
                                                                        {new Date(session.time_in).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                                        {(() => {
                                                                            const style = getStatusStyle(session.status);
                                                                            return (
                                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}>
                                                                                    {style.label}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                        <span>•</span>
                                                                        <span>{session.time_in_address || 'Remote'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-6 text-sm">
                                                                <div>
                                                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">In</p>
                                                                    <p className="font-mono font-medium text-slate-700 dark:text-slate-300">{formatTime(session.time_in)}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Out</p>
                                                                    <p className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                                                        {session.time_out ? formatTime(session.time_out) : '--:--'}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right min-w-[60px]">
                                                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Hrs</p>
                                                                    <p className="font-bold text-indigo-600 dark:text-indigo-400">
                                                                        {session.total_hours || calculateDuration(session.time_in, session.time_out) || '-'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* SUB-TAB: ANALYTICS */}
                        {subTab === 'analytics' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* 1. KPI Cards Row */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Card 1: Total Days */}
                                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Total Days</p>
                                            <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">{monthlySessions.length}</h3>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                            <CalendarIcon size={24} />
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border relative overflow-hidden">
                                        <div className="flex justify-between items-start z-10 relative">
                                            <div>
                                                <p className="text-sm text-slate-500 font-medium">Present</p>
                                                <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">
                                                    {monthlySessions.length > 0 ? Math.round((monthlySessions.filter(s => s.status !== 'ABSENT' && s.status !== 'LATE' && s.status !== 'OVERTIME').length / monthlySessions.length) * 100) : 0}%
                                                </h3>
                                            </div>
                                            <div className="h-12 w-12 rounded-full border-4 border-emerald-100 dark:border-emerald-900/30 border-t-emerald-500 flex items-center justify-center">
                                                <span className="text-[10px] font-bold text-emerald-600">
                                                    {monthlySessions.length > 0 ? Math.round((monthlySessions.filter(s => s.status !== 'ABSENT' && s.status !== 'LATE' && s.status !== 'OVERTIME').length / monthlySessions.length) * 100) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 3: Late % */}
                                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border relative overflow-hidden">
                                        <div className="flex justify-between items-start z-10 relative">
                                            <div>
                                                <p className="text-sm text-slate-500 font-medium">Late</p>
                                                <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">
                                                    {monthlySessions.length > 0 ? Math.round((monthlySessions.filter(s => s.late_minutes > 0).length / monthlySessions.length) * 100) : 0}%
                                                </h3>
                                            </div>
                                            <div className="h-12 w-12 rounded-full border-4 border-amber-100 dark:border-amber-900/30 border-t-amber-500 flex items-center justify-center">
                                                <span className="text-[10px] font-bold text-amber-600">
                                                    {monthlySessions.length > 0 ? Math.round((monthlySessions.filter(s => s.late_minutes > 0).length / monthlySessions.length) * 100) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 4: Overtime Days */}
                                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Overtime</p>
                                            <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">
                                                {monthlySessions.filter(s => s.status === 'OVERTIME').length}
                                            </h3>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                                            <History size={24} />
                                        </div>
                                    </div>

                                    {/* Card 5: Avg Hours */}
                                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Avg Hours</p>
                                            <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">
                                                {monthlySessions.length > 0
                                                    ? (monthlySessions.reduce((acc, s) => acc + parseFloat(s.total_hours || 0), 0) / monthlySessions.length).toFixed(1)
                                                    : '0'}
                                            </h3>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                            <Clock size={24} />
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Attendance Trends (Full Width) */}
                                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text">Total Attendance Report</h3>
                                        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                                            <MoreVertical size={18} />
                                        </button>
                                    </div>
                                    <div className="h-72">
                                        <Bar
                                            data={chartData}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: { display: false }
                                                },
                                                scales: {
                                                    y: {
                                                        beginAtZero: true,
                                                        grid: { color: 'rgba(200, 200, 200, 0.1)', borderDash: [5, 5] },
                                                        ticks: { color: '#94a3b8' }
                                                    },
                                                    x: {
                                                        grid: { display: false },
                                                        ticks: { color: '#94a3b8' }
                                                    }
                                                },
                                                borderRadius: 6,
                                                barThickness: 24
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* 3. Bottom Row: Status & Weekly Pattern */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Status Breakdown */}
                                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text mb-6">Attendance Status</h3>
                                        <div className="h-64 flex justify-center relative">
                                            <Doughnut
                                                data={pieData}
                                                options={{
                                                    responsive: true,
                                                    maintainAspectRatio: false,
                                                    cutout: '75%',
                                                    plugins: {
                                                        legend: {
                                                            position: 'right',
                                                            labels: { usePointStyle: true, boxWidth: 8, padding: 20 }
                                                        }
                                                    }
                                                }}
                                            />
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-3xl font-bold text-slate-800 dark:text-github-dark-text">{monthlySessions.length}</span>
                                                <span className="text-xs text-slate-500 uppercase font-bold">Total</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Weekly Radar Chart */}
                                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text mb-6">Weekly Activity</h3>
                                        <div className="h-64 flex justify-center">
                                            <Radar
                                                data={{
                                                    labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                                                    datasets: [{
                                                        label: 'Avg Hours',
                                                        data: [0, 1, 2, 3, 4, 5, 6].map(d => {
                                                            // Calculate Avg Hours per Day of Week
                                                            const sessionsOnDay = monthlySessions.filter(s => new Date(s.time_in).getDay() === d);
                                                            if (sessionsOnDay.length === 0) return 0;
                                                            const total = sessionsOnDay.reduce((acc, s) => acc + parseFloat(s.total_hours || 0), 0);
                                                            return (total / sessionsOnDay.length).toFixed(1);
                                                        }),
                                                        backgroundColor: 'rgba(79, 70, 229, 0.2)',
                                                        borderColor: '#4f46e5',
                                                        borderWidth: 2,
                                                        pointBackgroundColor: '#fff',
                                                        pointBorderColor: '#4f46e5',
                                                    }]
                                                }}
                                                options={{
                                                    responsive: true,
                                                    maintainAspectRatio: false,
                                                    scales: {
                                                        r: {
                                                            angleLines: { color: 'rgba(200, 200, 200, 0.2)' },
                                                            grid: { color: 'rgba(200, 200, 200, 0.2)' },
                                                            pointLabels: { color: '#64748b', font: { size: 11 } },
                                                            ticks: { display: false, backdropColor: 'transparent' }
                                                        }
                                                    },
                                                    plugins: {
                                                        legend: { display: false }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* SUB-TAB: CORRECTION REQUESTS */}
                        {subTab === 'correction' && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                                {/* Split Panel */}
                                <div className="flex flex-col lg:flex-row gap-6 items-start">
                                    {/* LEFT — Request List */}
                                    <div className="w-full lg:w-1/3 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col lg:sticky lg:top-6" style={{ height: '650px' }}>
                                        <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-center">
                                            <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text uppercase tracking-wider">My Requests</h3>
                                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                                                {correctionHistory.length} Total
                                            </span>
                                        </div>
                                        <div className="overflow-y-auto flex-1 p-3 space-y-2 no-scrollbar">
                                            {loading ? (
                                                <div className="p-10 text-center text-slate-400 text-sm">Loading…</div>
                                            ) : correctionHistory.length === 0 ? (
                                                <div className="p-10 text-center">
                                                    <FileClock size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                                    <p className="text-sm text-slate-400 dark:text-github-dark-muted italic">No correction requests yet.</p>
                                                </div>
                                            ) : (
                                                correctionHistory.map((req) => (
                                                    <div
                                                        key={req.acr_id}
                                                        onClick={() => handleRequestClick(req)}
                                                        className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                                                            selectedRequest?.acr_id === req.acr_id
                                                                ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-400/40 dark:border-indigo-500/40 shadow-indigo-500/5'
                                                                : 'bg-slate-50/40 dark:bg-github-dark-subtle/20 border-slate-200/60 dark:border-github-dark-border/80 hover:bg-slate-50/80 dark:hover:bg-github-dark-subtle/40 hover:border-slate-300 dark:hover:border-github-dark-border'
                                                        }`}
                                                    >
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                                                    {req.profile_image_url && req.profile_image_url.startsWith('http') ? (
                                                                        <img src={req.profile_image_url} alt={req.user_name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        (req.user_name || 'U').charAt(0).toUpperCase()
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className={`text-xs font-bold leading-none ${selectedRequest?.acr_id === req.acr_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>{req.user_name}</p>
                                                                    <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-medium mt-1 inline-block">ID: {req.user_id}</span>
                                                                </div>
                                                            </div>
                                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                                                req.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                                : req.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                            }`}>{req.status}</span>
                                                        </div>
                                                        <p className={`text-sm font-semibold mb-1 ${selectedRequest?.acr_id === req.acr_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                            {formatCorrectionDate(req.request_date)}
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted italic line-clamp-1">"{req.reason}"</p>
                                                        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2.5 font-mono border-t border-slate-100/50 dark:border-github-dark-border/30 pt-2">
                                                            <span>Sub. {req.submitted_at ? formatCorrectionDate(req.submitted_at) : '—'}</span>
                                                            <span className="font-bold text-[9px] text-indigo-600 dark:text-indigo-400 bg-transparent dark:bg-transparent p-0">{(req.correction_type || '').replace('_', ' ')}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* RIGHT — Details Panel */}
                                    <div className="w-full lg:w-2/3 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col min-h-[650px] h-fit">
                                        {isFetchingDetails ? (
                                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
                                                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                                                <p className="text-xs font-bold uppercase tracking-wider">Fetching details…</p>
                                            </div>
                                        ) : selectedRequest ? (
                                            <>
                                                {/* Detail Header */}
                                                <div className="p-5 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-start">
                                                    <div className="flex items-center gap-3">
                                                         <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-sm text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                                             {selectedRequest.profile_image_url && selectedRequest.profile_image_url.startsWith('http') ? (
                                                                 <img src={selectedRequest.profile_image_url} alt={selectedRequest.user_name} className="w-full h-full object-cover" />
                                                             ) : (
                                                                 (selectedRequest.user_name || 'U').charAt(0).toUpperCase()
                                                             )}
                                                         </div>
                                                         <div>
                                                             <h2 className="text-lg font-bold text-slate-900 dark:text-github-dark-text mb-0.5">Request #{selectedRequest.acr_id}</h2>
                                                             <p className="text-xs text-slate-500 dark:text-github-dark-muted">
                                                                 By <span className="font-bold text-slate-700 dark:text-slate-300">{selectedRequest.user_name}</span> • {formatCorrectionDate(selectedRequest.request_date)}
                                                             </p>
                                                         </div>
                                                     </div>
                                                    <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-lg border ${
                                                        selectedRequest.status === 'approved'
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30'
                                                            : selectedRequest.status === 'rejected'
                                                            ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/30'
                                                            : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/30'
                                                    }`}>
                                                        {selectedRequest.status}
                                                    </span>
                                                </div>

                                                {/* Detail Body */}
                                                <div className="flex-1">

                                                    {/* ── Visual Sync Timeline ── */}
                                                    {(() => {
                                                        const originalSnap = Array.isArray(selectedRequest.original_data) ? selectedRequest.original_data : [];
                                                        const proposedSnap = Array.isArray(selectedRequest.proposed_data) ? selectedRequest.proposed_data : [];
                                                        const fmtTime = (t) => t ? String(t).substring(0, 5) : '';
                                                        const originalTasks = originalSnap.map((s, i) => ({ id: `orig-${i}`, startTime: fmtTime(s.time_in), endTime: fmtTime(s.time_out) })).filter(t => t.startTime && t.endTime);
                                                        const proposedTasks = proposedSnap.map((s, i) => ({ id: `prop-${i}`, startTime: fmtTime(s.time_in), endTime: fmtTime(s.time_out) })).filter(t => t.startTime && t.endTime);
                                                        const allTasks = [...originalTasks, ...proposedTasks];
                                                        if (allTasks.length === 0) return null;
                                                        const getMinutes = (t) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
                                                        let minMin = Math.min(...allTasks.map(t => getMinutes(t.startTime)));
                                                        let maxMin = Math.max(...allTasks.map(t => getMinutes(t.endTime)));
                                                        let startHour = Math.max(0, Math.floor((minMin - 60) / 60));
                                                        let endHour = Math.min(24, Math.ceil((maxMin + 60) / 60));
                                                        const span = Math.max(1, endHour - startHour);
                                                        const timeToPos = (time) => { if (!time) return 0; const [h, m] = time.split(':').map(Number); const mins = (h || 0) * 60 + (m || 0); return Math.max(0, Math.min(100, ((mins - startHour * 60) / (span * 60)) * 100)); };
                                                        const getDurationPct = (s, e) => Math.max(0, timeToPos(e) - timeToPos(s));
                                                        const changesList = [];
                                                        const origCopy = originalTasks.map(t => ({ ...t }));
                                                        proposedTasks.forEach(prop => {
                                                            const match = origCopy.find(o => o.startTime === prop.startTime && o.endTime === prop.endTime);
                                                            if (match) { match.matched = true; } else {
                                                                const over = origCopy.find(o => !o.matched && (Math.abs(getMinutes(o.startTime) - getMinutes(prop.startTime)) < 120 || Math.abs(getMinutes(o.endTime) - getMinutes(prop.endTime)) < 120));
                                                                if (over) { over.matched = true; changesList.push({ type: 'MODIFY', task: prop, original: over }); }
                                                                else { changesList.push({ type: 'ADD', task: prop }); }
                                                            }
                                                        });
                                                        origCopy.filter(o => !o.matched).forEach(o => changesList.push({ type: 'DELETE', task: o }));
                                                        // Show only every 2nd hour if span > 8 to avoid crowding
                                                        const hourStep = span > 8 ? 2 : 1;
                                                        return (
                                                            <div className="bg-slate-50 dark:bg-[#13151f] border-b border-slate-200 dark:border-github-dark-border px-6 pt-4 pb-5">
                                                                {/* Title row */}
                                                                <div className="flex items-center gap-2 mb-4">
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visual Sync Timeline</span>
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-800">
                                                                        {(selectedRequest.correction_type || 'correction').toUpperCase()}
                                                                    </span>
                                                                    {/* Legend */}
                                                                    <div className="ml-auto flex items-center gap-3 text-[9px] font-bold uppercase text-slate-400">
                                                                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-slate-400/30 border border-slate-400/40"></span>Original</span>
                                                                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-emerald-500/20 border border-emerald-500/40"></span>Proposed</span>
                                                                    </div>
                                                                </div>

                                                                {/* Scale */}
                                                                <div className="relative mb-1 h-5">
                                                                    {Array.from({ length: span + 1 }, (_, i) => startHour + i)
                                                                        .filter((_, i) => i % hourStep === 0)
                                                                        .map((h, i, arr) => (
                                                                            <span key={h} className="absolute text-[9px] text-slate-400 font-mono -translate-x-1/2" style={{ left: `${((h - startHour) / span) * 100}%` }}>
                                                                                {h}:00
                                                                            </span>
                                                                        ))}
                                                                </div>

                                                                {/* Tick lines + rows */}
                                                                <div className="relative">
                                                                    {/* Vertical grid lines */}
                                                                    <div className="absolute inset-0 pointer-events-none flex">
                                                                        {Array.from({ length: span + 1 }, (_, i) => i).map(i => (
                                                                            <div key={i} className="absolute top-0 bottom-0 border-l border-dashed border-slate-300/40 dark:border-github-dark-border/40" style={{ left: `${(i / span) * 100}%` }} />
                                                                        ))}
                                                                    </div>

                                                                    {/* Original row */}
                                                                    <div className="mb-1">
                                                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Original</div>
                                                                        <div className="relative h-8 bg-slate-200/40 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-github-dark-border/50 overflow-hidden">
                                                                            {originalTasks.map(task => (
                                                                                <div key={task.id}
                                                                                    className="absolute inset-y-1 rounded-md bg-slate-400/25 border border-slate-400/40 flex items-center justify-center overflow-hidden"
                                                                                    style={{ left: `${timeToPos(task.startTime)}%`, width: `${getDurationPct(task.startTime, task.endTime)}%` }}>
                                                                                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 px-1 truncate">{fmtTime(task.startTime)}–{fmtTime(task.endTime)}</span>
                                                                                </div>
                                                                            ))}
                                                                            {originalTasks.length === 0 && (
                                                                                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Original Records</div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Proposed row */}
                                                                    <div>
                                                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Proposed</div>
                                                                        <div className="relative h-8 bg-slate-200/40 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-github-dark-border/50 overflow-hidden">
                                                                            {proposedTasks.map(task => {
                                                                                const isNew = changesList.some(c => c.type === 'ADD' && c.task.id === task.id);
                                                                                const isChanged = changesList.some(c => c.type === 'MODIFY' && c.task.id === task.id);
                                                                                const cls = isNew
                                                                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                                                                                    : isChanged
                                                                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 dark:text-amber-400'
                                                                                    : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-600 dark:text-indigo-400';
                                                                                return (
                                                                                    <div key={task.id}
                                                                                        className={`absolute inset-y-1 rounded-md border flex items-center justify-center overflow-hidden ${cls}`}
                                                                                        style={{ left: `${timeToPos(task.startTime)}%`, width: `${getDurationPct(task.startTime, task.endTime)}%` }}>
                                                                                        {isNew && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />}
                                                                                        <span className="text-[10px] font-mono font-bold px-1 truncate">{fmtTime(task.startTime)}–{fmtTime(task.endTime)}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* ── Info Cards ── */}
                                                    <div className="p-5 space-y-4">

                                                        {/* Meta row */}
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div className="bg-slate-50 dark:bg-github-dark-subtle/40 rounded-xl p-3 border border-slate-100 dark:border-github-dark-border/50">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Type</p>
                                                                <p className="text-xs font-bold text-slate-700 dark:text-github-dark-text capitalize">{selectedRequest.correction_type || '—'}</p>
                                                            </div>
                                                            <div className="bg-slate-50 dark:bg-github-dark-subtle/40 rounded-xl p-3 border border-slate-100 dark:border-github-dark-border/50">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Method</p>
                                                                <p className="text-xs font-bold text-slate-700 dark:text-github-dark-text capitalize">
                                                                    {selectedRequest.correction_method === 'add_session' ? 'Manual' : selectedRequest.correction_method || 'Fix'}
                                                                </p>
                                                            </div>
                                                            <div className="bg-slate-50 dark:bg-github-dark-subtle/40 rounded-xl p-3 border border-slate-100 dark:border-github-dark-border/50">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Submitted</p>
                                                                <p className="text-xs font-bold text-slate-700 dark:text-github-dark-text">
                                                                    {selectedRequest.submitted_at ? new Date(selectedRequest.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Proposed Sessions */}
                                                        {Array.isArray(selectedRequest.proposed_data) && selectedRequest.proposed_data.length > 0 && (
                                                            <div className="bg-slate-50 dark:bg-[#1a1c26] rounded-xl border border-slate-200 dark:border-github-dark-border overflow-hidden">
                                                                <div className="px-4 py-3 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between">
                                                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-github-dark-text">Proposed Sessions</h3>
                                                                    <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                                                        {selectedRequest.proposed_data.length} session{selectedRequest.proposed_data.length !== 1 ? 's' : ''}
                                                                    </span>
                                                                </div>
                                                                <div className="divide-y divide-slate-100 dark:divide-github-dark-border">
                                                                    {selectedRequest.proposed_data.map((s, i) => (
                                                                        <div key={i} className="flex items-center px-4 py-3 gap-4">
                                                                            <span className="text-[10px] font-black text-slate-400 w-5 shrink-0">#{i + 1}</span>
                                                                            <div className="flex items-center gap-2 flex-1">
                                                                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">In</span>
                                                                                <span className="text-sm font-black text-slate-800 dark:text-github-dark-text font-mono">{String(s.time_in || '').substring(0, 5)}</span>
                                                                            </div>
                                                                            <span className="text-slate-300 dark:text-slate-600">→</span>
                                                                            <div className="flex items-center gap-2 flex-1 justify-end">
                                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Out</span>
                                                                                <span className="text-sm font-black text-slate-800 dark:text-github-dark-text font-mono">{String(s.time_out || '').substring(0, 5)}</span>
                                                                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Reason */}
                                                        <div className="bg-slate-50 dark:bg-[#1e202e] rounded-xl border border-slate-200 dark:border-github-dark-border p-4">
                                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                                                <FileClock size={12} /> Request Reason
                                                            </h3>
                                                            <p className="text-sm text-slate-700 dark:text-slate-200 italic leading-relaxed">
                                                                "{selectedRequest.reason || 'No reason provided.'}"
                                                            </p>
                                                        </div>

                                                        {/* Reviewer Decision */}
                                                        {selectedRequest.status !== 'pending' && (
                                                            <div className={`rounded-xl border p-4 ${
                                                                selectedRequest.status === 'approved'
                                                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30'
                                                                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/30'
                                                            }`}>
                                                                <h3 className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ${
                                                                    selectedRequest.status === 'approved'
                                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                                        : 'text-red-600 dark:text-red-400'
                                                                }`}>
                                                                    <CheckCircle size={12} /> Reviewer Decision
                                                                </h3>
                                                                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                                                    {selectedRequest.review_comments || 'No reviewer comments provided.'}
                                                                </p>
                                                                <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                                    Reviewed {selectedRequest.reviewed_at ? formatDateDisplay(selectedRequest.reviewed_at) : '—'}
                                                                </p>
                                                            </div>
                                                        )}

                                                    </div>
                                                </div>

                                            </>
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 p-12">
                                                <FileText size={48} className="mb-4 opacity-40" />
                                                <p className="text-sm">Select a request to view details</p>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                        )}
                     </div>
                )}

                {/* --- CONFIRM SUBMISSION MODAL --- */}
                {showConfirmSubmit && createPortal(
                    <div className="fixed inset-0 z-[9000] overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center animate-in fade-in duration-200">
                            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => !submitLoading && setShowConfirmSubmit(false)} />
                            <div className="relative bg-white dark:bg-dark-card w-full max-w-md rounded-xl shadow-2xl border border-slate-200 dark:border-github-dark-border overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="p-6 text-center">
                                    <div className="w-16 h-16 bg-amber-50 dark:bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <AlertCircle size={32} />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-github-dark-text tracking-tight mb-2">Confirm Submission</h3>
                                    <p className="text-sm text-slate-500 dark:text-github-dark-muted mb-6">
                                        Are you sure you want to submit this correction request for <span className="font-bold text-slate-800 dark:text-github-dark-text">{formatDateDisplay(corrDate)}</span>?
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowConfirmSubmit(false)}
                                            className="flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-github-dark-muted hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleConfirmSubmit}
                                            disabled={submitLoading}
                                            className="flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                                        >
                                            {submitLoading ? <RefreshCw className="animate-spin" size={16} /> : "Confirm & Send"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}


                {/* --- IMAGE VIEWER MODAL --- */}
                <AnimatePresence>
                    {viewerImage && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setViewerImage(null)}
                            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 backdrop-blur-md p-4 md:p-10 cursor-zoom-out"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="relative max-w-5xl w-full h-full flex items-center justify-center"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="absolute -top-14 right-0 flex items-center gap-3">
                                    <button 
                                        onClick={() => window.open(viewerImage, '_blank')}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-xl transition-all border border-white/20 shadow-lg group"
                                        title="Open in new tab"
                                    >
                                        <Download size={18} className="group-hover:scale-110 transition-transform" />
                                        <span className="text-xs font-bold uppercase tracking-widest">Open Original</span>
                                    </button>
                                    <button 
                                        onClick={() => setViewerImage(null)}
                                        className="p-2.5 bg-white/10 hover:bg-rose-500 text-white rounded-xl backdrop-blur-xl transition-all border border-white/20 shadow-lg"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                                <img 
                                    src={viewerImage} 
                                    alt="Verification" 
                                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10"
                                />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- CAMERA PORTAL --- */}
                {showCamera && createPortal(
                    <div className="fixed inset-0 z-[9000] overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center transition-all duration-200">
                            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity" onClick={closeCamera} />
                            <div className="relative w-full max-w-4xl space-y-8 animate-in fade-in zoom-in-95 duration-200 text-left mx-auto">
                            <div className="flex justify-between items-center px-4">
                                <h3 className="text-2xl font-bold text-white tracking-tight">
                                    {cameraMode === 'IN' ? 'Check In' : 'Check Out'}
                                </h3>
                                <button
                                    onClick={closeCamera}
                                    className="p-2.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-all backdrop-blur-md"
                                >
                                    <X size={28} />
                                </button>
                            </div>

                            <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 flex items-center justify-center aspect-video">
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
                            </div>

                            {requireLateReason && imgSrc && (
                                <div className="space-y-3 px-2 w-full max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center gap-2 text-amber-300 bg-amber-900/40 border border-amber-500/30 p-3 rounded-xl mb-4 text-sm font-medium">
                                        <AlertCircle size={18} className="shrink-0" />
                                        <p>{lateReasonMessage}</p>
                                    </div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                                        Please provide a reason
                                    </label>
                                    <textarea
                                        value={lateReasonText}
                                        onChange={(e) => setLateReasonText(e.target.value)}
                                        placeholder="I got held up in traffic..."
                                        className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder-slate-400 h-24 resize-none backdrop-blur-md"
                                        required
                                    ></textarea>
                                </div>
                            )}

                            <div className="flex justify-center gap-6 pt-2">
                                {!imgSrc ? (
                                    <button
                                        onClick={capture}
                                        className="w-24 h-24 rounded-full bg-white text-indigo-600 hover:scale-110 active:scale-95 flex items-center justify-center shadow-xl shadow-indigo-900/20 transition-all duration-300 ring-8 ring-white/20">
                                        <Camera size={40} />
                                    </button>
                                ) : (
                                    <div className="flex w-full gap-4 px-4 max-w-lg mx-auto">
                                        <button
                                            onClick={retake}
                                            className="flex-1 px-8 py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white border border-white/10 font-bold text-lg transition-all flex items-center justify-center gap-3 backdrop-blur-md hover:scale-[1.02] active:scale-95">
                                            <RefreshCw size={22} /> Retake
                                        </button>
                                        <button
                                            onClick={confirmAttendance}
                                            disabled={isSubmitting}
                                            className="flex-1 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-xl shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 disabled:pointer-events-none">
                                            {isSubmitting ? '...' : 'Confirm'} <ArrowRight size={22} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    </div>,
                    document.body
                )}
                {/* --- CORRECTION DRAWER (RIGHT SIDEBAR) --- */}
                <AnimatePresence>
                    {isCorrectionDrawerOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsCorrectionDrawerOpen(false)}
                                className="fixed inset-0 z-[110] bg-slate-950/20 backdrop-blur-sm cursor-pointer"
                            />
                            <motion.div
                                initial={{ x: '100%', opacity: 0.5 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: '100%', opacity: 0.5 }}
                                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                                className="fixed top-0 right-0 h-full w-full max-w-xl bg-white dark:bg-github-dark-subtle z-[120] shadow-2xl border-l border-slate-100 dark:border-github-dark-border flex flex-col"
                            >
                                <div className="p-8 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-transparent dark:from-github-dark-bg/30">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                            <FileClock size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 dark:text-github-dark-text tracking-tight">Request Correction</h3>
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted tracking-widest mt-1">Submit Your Attendance Adjustments</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setIsCorrectionDrawerOpen(false)}
                                        className="p-3 rounded-xl bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all active:scale-90"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>
 
                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                    <form id="correction-form" onSubmit={handleSubmitCorrection} className="space-y-8">
                                        {/* Date Section */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-[0.2em] px-1">Adjustment Date</label>
                                            <div className="relative z-[130]">
                                                <DatePicker
                                                    value={corrDate}
                                                    onChange={(val) => setCorrDate(val)}
                                                    maxDate={new Date().toISOString().split('T')[0]}
                                                />
                                            </div>
                                        </div>
 
                                        {/* Type & Method Grid */}
                                        <div className="grid grid-cols-1 gap-6">
                                            <ThemedSelect 
                                                label="Correction Type"
                                                value={corrType}
                                                onChange={(val) => setCorrType(val)}
                                                options={[
                                                    { label: 'Normal Correction', value: 'Correction' },
                                                    { label: 'Missed Punch', value: 'Missed Punch' },
                                                    { label: 'Overtime Request', value: 'Overtime' },
                                                    { label: 'Other Adjustment', value: 'Other' }
                                                ]}
                                            />
                                            {corrType === 'Other' && (
                                                <motion.input
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    type="text"
                                                    placeholder="Specify Adjustment Type"
                                                    value={corrOtherType}
                                                    onChange={(e) => setCorrOtherType(e.target.value)}
                                                    className="w-full mt-3 px-5 py-4 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text font-bold shadow-sm"
                                                    required
                                                />
                                            )}
 
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-[0.2em] px-1">Correction Method</label>
                                                <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-50 dark:bg-github-dark-bg rounded-2xl border border-slate-200 dark:border-github-dark-border">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCorrMethod('add_session')}
                                                        className={`py-3 text-[11px] font-black tracking-widest rounded-xl transition-all ${corrMethod === 'add_session' ? 'bg-white dark:bg-github-dark-subtle text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-github-dark-border' : 'text-slate-400'}`}
                                                    >
                                                        Manual Entry
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCorrMethod('reset')}
                                                        className={`py-3 text-[11px] font-black tracking-widest rounded-xl transition-all ${corrMethod === 'reset' ? 'bg-white dark:bg-github-dark-subtle text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-github-dark-border' : 'text-slate-400'}`}
                                                    >
                                                        Full Day Reset
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
 
                                        {/* Dynamic Session Inputs */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-1">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-[0.2em]">Session Details</label>
                                                {corrMethod === 'add_session' && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => setCorrSessions(prev => [...prev, { id: Date.now(), time_in: '', time_out: '' }])}
                                                        className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg hover:shadow-md transition-all active:scale-95"
                                                    >
                                                        + Add Session
                                                    </button>
                                                )}
                                            </div>
 
                                            {corrMethod === 'reset' ? (
                                                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-github-dark-bg p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border">
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 tracking-widest px-1">New In</label>
                                                        <input
                                                            type="time"
                                                            value={corrIn}
                                                            onChange={(e) => setCorrIn(e.target.value)}
                                                            className="w-full px-4 py-3 bg-white dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text font-mono font-bold"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 tracking-widest px-1">New Out</label>
                                                        <input
                                                            type="time"
                                                            value={corrOut}
                                                            onChange={(e) => setCorrOut(e.target.value)}
                                                            className="w-full px-4 py-3 bg-white dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text font-mono font-bold"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {[...corrSessions].sort((a, b) => {
                                                        if (!a.time_in) return 1;
                                                        if (!b.time_in) return -1;
                                                        return a.time_in.localeCompare(b.time_in);
                                                    }).map((session, index, arr) => (
                                                        <motion.div 
                                                            layout
                                                            key={session.id} 
                                                            className={`flex items-end gap-3 p-4 rounded-2xl border transition-all ${
                                                                session.isExisting 
                                                                    ? 'bg-slate-100/30 dark:bg-github-dark-border/20 border-slate-200 dark:border-github-dark-border/50' 
                                                                    : 'bg-white dark:bg-github-dark-bg/50 border-indigo-100 dark:border-indigo-500/20 shadow-sm'
                                                            }`}
                                                        >
                                                            {session.isExisting ? (
                                                                <div className="flex-1 flex gap-4 w-full">
                                                                    <div className="flex-1 bg-slate-100/50 dark:bg-github-dark-bg p-4 rounded-xl border border-slate-200 dark:border-github-dark-border flex flex-col justify-center shadow-inner">
                                                                        <span className="block text-[9px] font-black text-slate-500 dark:text-github-dark-muted tracking-widest mb-1.5">Existing In</span>
                                                                        <span className="text-base font-black text-slate-800 dark:text-github-dark-text font-mono tracking-tight">{session.time_in || '--:--'}</span>
                                                                    </div>
                                                                    <div className="flex-1 bg-slate-100/50 dark:bg-github-dark-bg p-4 rounded-xl border border-slate-200 dark:border-github-dark-border flex flex-col justify-center shadow-inner">
                                                                        <span className="block text-[9px] font-black text-slate-500 dark:text-github-dark-muted tracking-widest mb-1.5">Existing Out</span>
                                                                        <span className="text-base font-black text-slate-800 dark:text-github-dark-text font-mono tracking-tight">{session.time_out || '--:--'}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex-1 space-y-2">
                                                                        <label className="text-[9px] font-black text-slate-400 tracking-widest px-1">In</label>
                                                                        <input
                                                                            type="time"
                                                                            value={session.time_in}
                                                                            onChange={(e) => setCorrSessions(prev => prev.map(s => s.id === session.id ? { ...s, time_in: e.target.value } : s))}
                                                                            className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-sm bg-slate-50 dark:bg-github-dark-bg text-slate-700 dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border"
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1 space-y-2">
                                                                        <label className="text-[9px] font-black text-slate-400 tracking-widest px-1">Out</label>
                                                                        <input
                                                                            type="time"
                                                                            value={session.time_out}
                                                                            onChange={(e) => setCorrSessions(prev => prev.map(s => s.id === session.id ? { ...s, time_out: e.target.value } : s))}
                                                                            className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-sm bg-slate-50 dark:bg-github-dark-bg text-slate-700 dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border"
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}
                                                            {arr.length > 1 && !session.isExisting && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setCorrSessions(prev => prev.filter(s => s.id !== session.id))}
                                                                    className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                                                                >
                                                                    <X size={18} />
                                                                </button>
                                                            )}
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Reason Section */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-[0.2em] px-1">Reason for Adjustment</label>
                                            <textarea
                                                value={corrReason}
                                                onChange={(e) => setCorrReason(e.target.value)}
                                                placeholder="Please provide context for this correction..."
                                                className="w-full px-5 py-4 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text font-medium h-32 resize-none shadow-sm"
                                                required
                                            />
                                        </div>
                                    </form>
                                </div>

                                <div className="p-8 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-bg/80">
                                    <button 
                                        type="submit" 
                                        form="correction-form"
                                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black tracking-[0.15em] rounded-[1.25rem] shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
                                    >
                                        <FileClock size={20} className="group-hover:scale-110 transition-transform" />
                                        Submit Request
                                    </button>
                                    <p className="text-[9px] text-center text-slate-400 font-bold mt-4 tracking-widest opacity-60">Requires Admin Approval</p>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </div>
    </DashboardLayout>
);
};

export default Attendance;
