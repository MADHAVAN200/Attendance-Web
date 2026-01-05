import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
    Download
} from 'lucide-react';
import { attendanceService } from '../../services/attendanceService';
import { toast } from 'react-toastify';

import CustomCalendar from '../../components/CustomCalendar';

const Attendance = () => {
    // Initialize with today's date formatted for input type="date" (YYYY-MM-DD)
    const today = new Date();
    const formattedToday = today.toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(formattedToday);
    const [reportMonth, setReportMonth] = useState(today.toISOString().slice(0, 7));
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Calendar State
    const [showCalendar, setShowCalendar] = useState(false);
    const calendarRef = useRef(null);

    // Handle outside click to close calendar
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target)) {
                // Check if the click was on the trigger button (handled by parent onClick)
                // Actually, since the calendarRef is on the popover container effectively, 
                // we might need to be careful.
                // The triggering div has `onClick` to toggle.
                // We'll rely on the parent div handling for now, or refine if needed.
                // A simpler way: bind the click outside to the whole wrapper or document.
                setShowCalendar(false);
            }
        };

        if (showCalendar) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showCalendar]);

    // Camera State
    const [showCamera, setShowCamera] = useState(false);
    const [cameraMode, setCameraMode] = useState(null); // 'IN' or 'OUT'
    const webcamRef = useRef(null);
    const [imgSrc, setImgSrc] = useState(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    // Fetch Records
    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const res = await attendanceService.getMyRecords(selectedDate, selectedDate);
            if (res.ok) {
                setSessions(res.data);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch attendance records");
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    // Handle Camera Logic
    const openCamera = (mode) => {
        setCameraMode(mode);
        setImgSrc(null);
        setShowCamera(true);
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

    // Convert Base64 to Blob
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

        // Get Location
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            setIsSubmitting(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const { latitude, longitude, accuracy } = position.coords;

                // --- STRICT ACCURACY CHECK ---
                // IP Geolocation is usually > 5000m. GPS/Wi-Fi is usually < 100m.
                const MAX_ALLOWED_ACCURACY = 500; // meters

                if (accuracy > MAX_ALLOWED_ACCURACY) {
                    toast.error(`Location too inaccurate (${Math.round(accuracy)}m). We require < ${MAX_ALLOWED_ACCURACY}m.`);
                    toast.warn("Please use a Mobile Phone with GPS or ensure Wi-Fi is ON.", { autoClose: 8000 });
                    setIsSubmitting(false);
                    return; // BLOCK submission
                }

                // Debug info (optional, keeping for transparency)
                // toast.info(`Location Accuracy: ${Math.round(accuracy)}m (Good)`);

                const imageBlob = dataURLtoBlob(imgSrc);

                const payload = {
                    latitude,
                    longitude,
                    imageFile: imageBlob
                };

                let res;
                if (cameraMode === 'IN') {
                    res = await attendanceService.timeIn(payload);
                    toast.success("Checked In Successfully!");
                } else {
                    res = await attendanceService.timeOut(payload);
                    toast.success("Checked Out Successfully!");
                }

                closeCamera();
                fetchRecords(); // Refresh list

            } catch (error) {
                console.error(error);
                toast.error(error.message || "Attendance failed");
            } finally {
                setIsSubmitting(false);
            }
        }, (error) => {
            console.error(error);
            toast.error("Unable to retrieve your location: " + error.message);
            setIsSubmitting(false);
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    };


    // Helper to format the displayed date
    const formatDateDisplay = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Helper formats
    const formatTime = (isoString) => {
        if (!isoString) return null;
        return new Date(isoString).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    };

    // Date Navigation Handlers
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

    const handleDownloadReport = async () => {
        try {
            const data = await attendanceService.downloadMyReport(reportMonth);
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `My_Attendance_${reportMonth}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Monthly report downloaded successfully");
        } catch (error) {
            toast.error(error.message);
        }
    };

    return (
        <DashboardLayout title="Attendance">
            <div className="space-y-8 relative">

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <button
                        onClick={() => openCamera('IN')}
                        className="flex items-center justify-center gap-3 bg-indigo-600 text-white h-24 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 hover:bg-indigo-700 hover:shadow-xl transition-all active:scale-95 group">
                        <div className="p-2 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                            <ArrowRight size={24} />
                        </div>
                        <span className="text-2xl font-bold">Time In</span>
                    </button>

                    <button
                        onClick={() => openCamera('OUT')}
                        className="flex items-center justify-center gap-3 bg-slate-800 dark:bg-slate-700 text-white h-24 rounded-2xl shadow-lg shadow-slate-200 dark:shadow-slate-900/30 hover:bg-slate-900 dark:hover:bg-slate-600 hover:shadow-xl transition-all active:scale-95 group">
                        <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                            <LogOut size={24} />
                        </div>
                        <span className="text-2xl font-bold">Time Out</span>
                    </button>
                </div>

                {/* Report Download Section for User */}
                <div className="bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-none">Monthly Report</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Download your full logs for the month</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="month"
                            value={reportMonth}
                            onChange={(e) => setReportMonth(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <button
                            onClick={handleDownloadReport}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-all active:scale-95 shadow-lg shadow-indigo-100 dark:shadow-none"
                        >
                            <Download size={16} />
                            Download
                        </button>
                    </div>
                </div>

                {/* Date Picker Header */}
                <div className="flex justify-center items-center gap-4">
                    <button
                        onClick={handlePrevDay}
                        className="p-2 rounded-xl bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 dark:hover:text-indigo-400 dark:hover:border-indigo-900 transition-all shadow-sm"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div
                        className="relative cursor-pointer group"
                        onClick={() => setShowCalendar(!showCalendar)}
                    >
                        <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-dark-card py-2.5 px-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all min-w-[200px]">
                            <CalendarIcon size={18} />
                            <span>{formatDateDisplay(selectedDate)}</span>
                        </div>

                        {/* Custom Calendar Popover */}
                        {showCalendar && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-full" ref={calendarRef}>
                                <CustomCalendar
                                    selectedDate={selectedDate}
                                    onChange={setSelectedDate}
                                    onClose={() => setShowCalendar(false)}
                                />
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleNextDay}
                        className="p-2 rounded-xl bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 dark:hover:text-indigo-400 dark:hover:border-indigo-900 transition-all shadow-sm"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Timeline Sessions */}
                <div className="space-y-4">
                    {loading ? <p className="text-center text-slate-500">Loading records...</p> :
                        sessions.length === 0 ? <p className="text-center text-slate-400 py-10">No attendance records for this date.</p> :
                            sessions.map((session) => (
                                <div key={session.attendance_id} className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative transition-colors duration-300">
                                    {/* Connector Line */}
                                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-100 dark:bg-slate-700 hidden sm:block"></div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2">

                                        {/* Time In Column */}
                                        <div className="p-5 relative">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">TIME IN</span>
                                            </div>

                                            <div className="flex gap-4 items-start">
                                                {/* Avatar */}
                                                <div className="shrink-0">
                                                    {session.time_in_image ? (
                                                        <img
                                                            src={session.time_in_image}
                                                            alt="In"
                                                            onClick={() => setPreviewImage(session.time_in_image)}
                                                            className="w-14 h-14 rounded-full object-cover border-2 border-slate-100 dark:border-slate-600 shadow-sm cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                                                        />
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-50 dark:border-slate-700">
                                                            <MapPin size={20} className="text-slate-300 dark:text-slate-600" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Details */}
                                                <div className="flex flex-col gap-1 min-w-0">
                                                    <div className="flex flex-wrap items-baseline gap-2">
                                                        <span className="text-2xl font-bold text-slate-800 dark:text-white leading-none">{formatTime(session.time_in)}</span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${session.late_minutes > 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
                                                            {session.late_minutes > 0 ? `Late ${session.late_minutes}m` : 'On Time'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-start gap-1.5 text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                                                        <MapPin size={14} className="flex-shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" />
                                                        <span className="line-clamp-2 leading-relaxed">{session.time_in_address || "Location unavailable"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Time Out Column */}
                                        <div className="p-5 relative border-t sm:border-t-0 border-slate-100 dark:border-slate-700 sm:pl-8">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className={`w-2.5 h-2.5 rounded-full ${session.time_out ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">TIME OUT</span>
                                            </div>

                                            {session.time_out ? (
                                                <div className="flex gap-4 items-start">
                                                    {/* Avatar */}
                                                    <div className="shrink-0">
                                                        {session.time_out_image ? (
                                                            <img
                                                                src={session.time_out_image}
                                                                alt="Out"
                                                                onClick={() => setPreviewImage(session.time_out_image)}
                                                                className="w-14 h-14 rounded-full object-cover border-2 border-slate-100 dark:border-slate-600 shadow-sm cursor-pointer hover:ring-2 hover:ring-red-500 transition-all"
                                                            />
                                                        ) : (
                                                            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-50 dark:border-slate-700">
                                                                <MapPin size={20} className="text-slate-300 dark:text-slate-600" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Details */}
                                                    <div className="flex flex-col gap-1 min-w-0">
                                                        <div className="flex flex-wrap items-baseline gap-2">
                                                            <span className="text-2xl font-bold text-slate-800 dark:text-white leading-none">{formatTime(session.time_out)}</span>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300`}>
                                                                {session.status}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-start gap-1.5 text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                                                            <MapPin size={14} className="flex-shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" />
                                                            <span className="line-clamp-2 leading-relaxed">{session.time_out_address || "Location unavailable"}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-full flex flex-col justify-center pl-2">
                                                    <span className="text-4xl font-light text-slate-300 dark:text-slate-600">-</span>
                                                    <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">Active Session</span>
                                                </div>
                                            )}

                                        </div>

                                    </div>
                                </div>
                            ))}
                </div>

                {/* --- CAMERA COMPONENT --- */}
                {showCamera && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4 transition-all duration-200">
                        <div className="w-full max-w-4xl space-y-8 animate-in fade-in zoom-in-95 duration-200">
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

                            <div className="relative bg-black rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/10 flex items-center justify-center aspect-video">
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
                    </div>,
                    document.body
                )}

                {/* --- IMAGE PREVIEW MODAL --- */}
                {previewImage && createPortal(
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4 transition-all duration-200"
                        onClick={() => setPreviewImage(null)}
                    >
                        <div
                            className="w-full max-w-4xl space-y-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center px-4">
                                <h3 className="text-2xl font-bold text-white tracking-tight">
                                    Attendance Photo
                                </h3>
                                <button
                                    onClick={() => setPreviewImage(null)}
                                    className="p-2.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-all backdrop-blur-md"
                                >
                                    <X size={28} />
                                </button>
                            </div>

                            <div className="relative bg-black rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/10 flex items-center justify-center min-h-[50vh]">
                                <img
                                    src={previewImage}
                                    alt="Attendance Preview"
                                    className="w-full h-full object-contain max-h-[80vh]"
                                />
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            </div>
        </DashboardLayout>
    );
};

export default Attendance;
