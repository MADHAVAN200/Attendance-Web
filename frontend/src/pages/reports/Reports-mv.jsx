import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { 
    Download, 
    Calendar, 
    ChevronDown, 
    History as HistoryIcon, 
    Eye, 
    FileText, 
    Clock, 
    Table, 
    Activity,
    CheckCircle2,
    ArrowRight,
    Search,
    X,
    AlertCircle,
    DownloadCloud,
    FileSpreadsheet,
    FileType
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import MonthPicker from '../../components/MonthPicker';
import MobileDatePicker from '../../components/MobileDatePicker';

const MobileReports = () => {
    // State (Synchronized with Web)
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [reportType, setReportType] = useState('matrix_monthly');
    const [fileFormat, setFileFormat] = useState('xlsx');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'history'

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('mano-active-tab', {
            detail: { tab: activeTab }
        }));
    }, [activeTab]);

    const reportTypes = [
        { id: 'matrix_daily', label: 'Daily Matrix' },
        { id: 'matrix_weekly', label: 'Weekly Matrix' },
        { id: 'matrix_monthly', label: 'Monthly Matrix' },
        { id: 'lateness_report', label: 'Lateness Report' },
        { id: 'attendance_detailed', label: 'Detailed Log' },
        { id: 'attendance_summary', label: 'Monthly Summary' },
        { id: 'employee_master', label: 'Employee Master' }
    ];

    const fileFormats = [
        { id: 'xlsx', label: 'XLSX', icon: FileSpreadsheet, color: 'emerald' },
        { id: 'csv', label: 'CSV', icon: FileType, color: 'blue' },
        { id: 'pdf', label: 'PDF', icon: FileText, color: 'rose' }
    ];

    // Export History
    const [exportHistory, setExportHistory] = useState(() => {
        const savedHistory = localStorage.getItem('attendance_export_history');
        return savedHistory ? JSON.parse(savedHistory) : [];
    });

    useEffect(() => {
        localStorage.setItem('attendance_export_history', JSON.stringify(exportHistory));
    }, [exportHistory]);

    // Preview Data State
    const [previewData, setPreviewData] = useState({ columns: [], rows: [] });
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Fetch Preview
    useEffect(() => {
        if (activeTab !== 'preview') return;
        const fetchPreview = async () => {
            setLoadingPreview(true);
            try {
                const res = await adminService.getReportPreview(selectedMonth, reportType, selectedDate);
                if (res.ok) {
                    setPreviewData(res.data);
                }
            } catch (error) {
                console.error(error);
                toast.error("Failed to load preview data");
            } finally {
                setLoadingPreview(false);
            }
        };
        fetchPreview();
    }, [selectedMonth, reportType, selectedDate, activeTab]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const data = await adminService.downloadReport(selectedMonth, reportType, fileFormat, "", selectedDate);
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            const filename = `Report_${reportType}_${selectedMonth || selectedDate}.${fileFormat}`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();

            const reportTypeLabel = reportTypes.find(r => r.id === reportType)?.label || reportType;
            const newReport = {
                id: Date.now(),
                name: filename,
                type: reportTypeLabel,
                date: new Date().toLocaleString(),
                status: 'Ready',
                size: (data.size / 1024).toFixed(1) + ' KB'
            };
            setExportHistory([newReport, ...exportHistory]);
            toast.success("Report generated successfully");
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to generate report");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <MobileDashboardLayout title="Reports & Exports">
            <div className="min-h-screen bg-slate-50 dark:bg-black pb-24 transition-colors duration-300">
                
                {/* --- HEADER AREA --- */}
                <div className="px-5 pt-6 space-y-6">
                    {/* Standardized Tabs Card */}
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1.5 flex rounded-2xl backdrop-blur-md border border-white/20 dark:border-white/5"
                    >
                        {['preview', 'history'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-2.5 text-[11px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                                    activeTab === tab 
                                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 transform scale-[1.02]' 
                                        : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                                }`}
                            >
                                {tab === 'preview' ? <Eye size={14} /> : <HistoryIcon size={14} />}
                                <span className="capitalize">{tab}</span>
                            </button>
                        ))}
                    </motion.div>

                    {/* Quick Info Bar - Now inside the card flow */}
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                <FileText size={16} />
                            </div>
                            <div>
                                <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase leading-none">{reportType.replace('_', ' ')}</h3>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{activeTab === 'preview' ? 'Live Data View' : 'Past Exports'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-full">
                            <Clock size={10} className="text-slate-400" />
                            <span className="text-[9px] font-black text-slate-500">{selectedMonth || selectedDate}</span>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-6 space-y-6">
                    {/* --- CONFIGURATION PANEL (Matched Size) --- */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-github-dark-subtle p-5 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            {/* Date Picker */}
                            <div className="space-y-0 flex-1">
                                {['matrix_monthly', 'lateness_report', 'attendance_detailed', 'attendance_summary'].includes(reportType) ? (
                                    <MonthPicker
                                        label="Period"
                                        value={selectedMonth}
                                        onChange={setSelectedMonth}
                                    />
                                ) : (
                                    <MobileDatePicker
                                        label="Period"
                                        value={selectedDate}
                                        onChange={setSelectedDate}
                                    />
                                )}
                            </div>

                            {/* Report Type */}
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Type</label>
                                <div className="relative group">
                                    <select
                                        value={reportType}
                                        onChange={(e) => setReportType(e.target.value)}
                                        className="w-full pl-3 pr-8 h-10 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold appearance-none focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 dark:text-white cursor-pointer"
                                    >
                                        {reportTypes.map(t => (
                                            <option key={t.id} value={t.id} className="bg-white dark:bg-github-dark-subtle text-slate-800 dark:text-white">{t.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>
                        </div>

                        {/* Format Selection */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">File Format</label>
                            <div className="flex gap-2">
                                {fileFormats.map((f) => (
                                    <button
                                        key={f.id}
                                        onClick={() => setFileFormat(f.id)}
                                        className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border transition-all duration-300 ${
                                            fileFormat === f.id 
                                                ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                                                : 'bg-slate-50 dark:bg-black/20 border-slate-100 dark:border-white/5 text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        <f.icon size={14} />
                                        <span className="text-[10px] font-black uppercase">{f.id}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Action Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Generating...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={16} strokeWidth={3} />
                                    <span>Generate & Download</span>
                                </>
                            )}
                        </button>
                    </motion.div>

                    {/* --- CONTENT SECTION --- */}
                    <AnimatePresence mode="wait">
                        {activeTab === 'preview' ? (
                            <motion.div 
                                key="preview"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="space-y-0 mt-6"
                            >
                                <div className="overflow-hidden flex flex-col min-h-[300px]">
                                    <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-white dark:bg-github-dark-bg">
                                        <span className="text-[10px] font-black text-slate-500 dark:text-github-dark-muted uppercase tracking-widest flex items-center gap-2">
                                            <Table size={12} className="text-indigo-500" /> Data Preview
                                        </span>
                                        {previewData.rows?.length > 0 && (
                                            <span className="text-[9px] font-black text-slate-400 px-2.5 py-1 bg-slate-100 dark:bg-white/5 rounded-full border border-slate-200 dark:border-white/10">
                                                {previewData.rows.length} ROWS
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[500px] no-scrollbar">
                                        {loadingPreview ? (
                                            <div className="h-full flex flex-col items-center justify-center py-20 gap-3">
                                                <div className="w-8 h-8 border-3 border-indigo-100 dark:border-indigo-900/30 border-t-indigo-500 rounded-full animate-spin" />
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Crunching Data...</p>
                                            </div>
                                        ) : previewData.rows?.length > 0 ? (
                                            <table className="w-full text-left border-collapse min-w-max">
                                                <thead className="sticky top-0 z-10 bg-white/95 dark:bg-github-dark-bg/95 backdrop-blur-md">
                                                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/10">
                                                        {previewData.columns.map((col, idx) => (
                                                            <th key={idx} className="px-4 py-3 whitespace-nowrap">{col}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                                    {previewData.rows.map((row, rIdx) => (
                                                        <tr key={rIdx} className="hover:bg-indigo-50/50 dark:hover:bg-white/5 transition-colors">
                                                            {row.map((cell, cIdx) => (
                                                                <td key={cIdx} className="px-4 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                                    {cell}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                                <Activity size={32} className="text-slate-200 dark:text-white/5" />
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No results for this selection</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="history"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-3 px-4"
                            >
                                {exportHistory.length > 0 ? (
                                    exportHistory.map((report) => (
                                        <div key={report.id} className="bg-white dark:bg-github-dark-subtle p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                report.name.endsWith('.pdf') ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10' 
                                                : report.name.endsWith('.csv') ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/10'
                                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
                                            }`}>
                                                {report.name.endsWith('.pdf') ? <FileText size={18} /> : report.name.endsWith('.csv') ? <FileType size={18} /> : <FileSpreadsheet size={18} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <h4 className="text-xs font-black text-slate-800 dark:text-white truncate pr-2 uppercase">{report.type}</h4>
                                                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 shrink-0">READY</span>
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-400 truncate mt-0.5">{report.name}</p>
                                                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-50 dark:border-white/5">
                                                    <div className="flex items-center gap-1">
                                                        <Clock size={10} className="text-slate-300" />
                                                        <span className="text-[9px] font-black text-slate-400">{report.date}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <DownloadCloud size={10} className="text-indigo-400" />
                                                        <span className="text-[9px] font-black text-slate-400">{report.size}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-white dark:bg-github-dark-subtle rounded-2xl border border-dashed border-slate-200 dark:border-white/5 p-12 flex flex-col items-center justify-center gap-3 text-center">
                                        <DownloadCloud size={32} className="text-slate-200 dark:text-white/10" />
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Your export history is empty</p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </MobileDashboardLayout>
    );
};

// Simple wrapper to fix naming conflict if any
const MobileReportsWrapper = ({ children }) => children;

export default MobileReports;
