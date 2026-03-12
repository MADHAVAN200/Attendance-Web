import React, { useState, useEffect } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { 
    ChevronDown, 
    History, 
    FileText, 
    ExternalLink, 
    Eye,
    Calendar,
    Download,
    FileSpreadsheet,
    FileType,
    Table,
    DownloadCloud,
    CheckCircle,
    AlertCircle
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';

const Reports = () => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [reportType, setReportType] = useState('matrix_monthly');
    const [fileFormat, setFileFormat] = useState('xlsx');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'history'

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
        { id: 'xlsx', label: 'XLSX' },
        { id: 'csv', label: 'CSV' },
        { id: 'pdf', label: 'PDF' }
    ];

    // Export History with Persistence
    const [exportHistory, setExportHistory] = useState(() => {
        const savedHistory = localStorage.getItem('attendance_export_history');
        return savedHistory ? JSON.parse(savedHistory) : [];
    });

    useEffect(() => {
        localStorage.setItem('attendance_export_history', JSON.stringify(exportHistory));
    }, [exportHistory]);

    // Real Preview Data State
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
            <div className="space-y-3 px-2 pb-6 pt-2">
                {/* Control Form area */}
                <div className="bg-white dark:bg-dark-card text-slate-800 dark:text-white rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700/50 flex flex-col gap-4">
                    
                    {reportType !== 'employee_master' && (
                        <div>
                            <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                                {['matrix_monthly', 'lateness_report', 'attendance_detailed', 'attendance_summary'].includes(reportType) ? 'Select Month' : 'Select Date'}
                            </label>
                            <div className="relative bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-600/50 flex items-center overflow-hidden">
                                <div className="absolute left-3 z-10 text-indigo-500 dark:text-indigo-400">
                                    <Calendar size={14} />
                                </div>
                                {['matrix_monthly', 'lateness_report', 'attendance_detailed', 'attendance_summary'].includes(reportType) ? (
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        className="w-full bg-transparent pl-9 pr-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none appearance-none cursor-pointer"
                                    />
                                ) : (
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-full bg-transparent pl-9 pr-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none appearance-none cursor-pointer"
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                            Report Type
                        </label>
                        <div className="relative bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-600/50 flex items-center overflow-hidden">
                            <select
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                                className="w-full bg-transparent pl-3 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none appearance-none cursor-pointer"
                            >
                                {reportTypes.map(t => (
                                    <option key={t.id} value={t.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">{t.label}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 pointer-events-none text-slate-400">
                                <ChevronDown size={14} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                            File Format
                        </label>
                        <div className="flex bg-slate-50 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-600/50 gap-1">
                            {fileFormats.map((format) => (
                                <button
                                    key={format.id}
                                    onClick={() => setFileFormat(format.id)}
                                    className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                                        fileFormat === format.id 
                                            ? 'bg-slate-200 dark:bg-slate-700/60 text-slate-800 dark:text-white shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    {format.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 mt-2"
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin"></div>
                                <span>Exporting...</span>
                            </>
                        ) : (
                            <>
                                <Download size={14} />
                                <span>Export Report</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-white dark:bg-dark-card p-1 rounded-lg border border-slate-200 dark:border-slate-700/50 mt-4 shadow-sm">
                    {[
                        { id: 'preview', label: 'Preview', icon: Eye },
                        { id: 'history', label: 'History', icon: History }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-md text-xs font-bold transition-all ${
                                activeTab === tab.id 
                                    ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-slate-700' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border border-transparent'
                            }`}
                        >
                            <tab.icon size={12} /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="mt-4">
                    {activeTab === 'preview' && (
                        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/50 overflow-hidden min-h-[250px] flex flex-col">
                            {loadingPreview ? (
                                <div className="flex flex-col items-center justify-center py-10 gap-3">
                                    <div className="w-6 h-6 border-[3px] border-indigo-100 dark:border-indigo-900/30 border-t-indigo-500 dark:border-t-indigo-400 rounded-full animate-spin"></div>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Loading preview data...</p>
                                </div>
                            ) : previewData.rows && previewData.rows.length > 0 ? (
                                <div className="overflow-x-auto w-full">
                                    <table className="w-full text-left border-collapse min-w-max">
                                        <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50">
                                            <tr className="text-[9px] tracking-wider uppercase text-slate-500 dark:text-slate-400 font-bold">
                                                {previewData.columns.map((col, idx) => (
                                                    <th key={idx} className="px-3 py-2.5 whitespace-nowrap">{col}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                            {previewData.rows.map((row, rIdx) => (
                                                <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    {row.map((cell, cIdx) => {
                                                        const isStatusColumn = cIdx === row.length - 1 && typeof cell === 'string' && (cell.toLowerCase().includes('present') || cell.toLowerCase().includes('absent') || cell.toLowerCase().includes('late') || cell.toLowerCase().includes('leave'));
                                                        return (
                                                        <td key={cIdx} className="px-3 py-2.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                            {isStatusColumn ? (
                                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                                    cell.toLowerCase().includes('absent') ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' 
                                                                    : cell.toLowerCase().includes('late') ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'
                                                                    : cell.toLowerCase().includes('present') ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                                    : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                                                                }`}>
                                                                    {cell}
                                                                </span>
                                                            ) : (
                                                                cell
                                                            )}
                                                        </td>
                                                    )})}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 gap-2">
                                    <Table className="text-slate-200 dark:text-slate-700" size={32} />
                                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">No data available.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-2">
                            {exportHistory.length > 0 ? (
                                exportHistory.map((report) => (
                                    <div key={report.id} className="bg-white dark:bg-dark-card rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700/50 flex flex-col gap-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                                report.name.endsWith('.pdf') ? 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400' 
                                                : report.name.endsWith('.csv') ? 'bg-green-50 text-green-500 dark:bg-green-500/10 dark:text-green-400'
                                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                            }`}>
                                                {report.name.endsWith('.pdf') ? <FileText size={16} /> : report.name.endsWith('.csv') ? <FileType size={16} /> : <FileSpreadsheet size={16} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-slate-800 dark:text-white text-xs truncate pr-2">{report.type}</h4>
                                                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">{report.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5 text-[9px] font-medium">
                                                    <span className="text-slate-500 dark:text-slate-400">{report.date}</span>
                                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                                    <span className="text-slate-500 dark:text-slate-400">{report.size}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/50 p-6 flex flex-col items-center justify-center gap-2 text-center">
                                    <DownloadCloud size={28} className="text-slate-300 dark:text-slate-700" />
                                    <div>
                                        <p className="text-slate-800 dark:text-white font-bold text-xs">No Export History</p>
                                        <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">Generated reports will appear here</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </MobileDashboardLayout>
    );
};

export default Reports;
