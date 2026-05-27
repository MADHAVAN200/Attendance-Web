import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import {
    FileText,
    Download,
    Calendar,
    FileSpreadsheet,
    FileType,
    CheckCircle,
    AlertCircle,
    DownloadCloud,
    Eye,
    Table
} from 'lucide-react';

import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import DatePicker from '../../components/DatePicker';
import MonthPicker from '../../components/MonthPicker';

const Reports = () => {
    const navigate = useNavigate();


    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [reportType, setReportType] = useState('matrix_monthly');
    const [fileFormat, setFileFormat] = useState('xlsx');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'history'

    React.useEffect(() => {
        window.dispatchEvent(new CustomEvent('mano-active-tab', {
            detail: { tab: activeTab }
        }));
    }, [activeTab]);

    // Export History with Persistence
    const [exportHistory, setExportHistory] = useState(() => {
        const savedHistory = localStorage.getItem('attendance_export_history');
        return savedHistory ? JSON.parse(savedHistory) : [];
    });

    // Save history to localStorage whenever it changes
    React.useEffect(() => {
        localStorage.setItem('attendance_export_history', JSON.stringify(exportHistory));
    }, [exportHistory]);

    // Real Preview Data State
    const [previewData, setPreviewData] = useState({ columns: [], rows: [] });
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Fetch Preview
    React.useEffect(() => {
        const fetchPreview = async () => {
            setLoadingPreview(true);
            try {
                const res = await adminService.getReportPreview(selectedMonth, reportType, selectedDate);
                if (res.ok) {
                    setPreviewData(res.data);
                }
            } catch (error) {
                toast.error("Failed to load preview data");
            } finally {
                setLoadingPreview(false);
            }
        };
        fetchPreview();
    }, [selectedMonth, reportType, selectedDate]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const data = await adminService.downloadReport(selectedMonth, reportType, fileFormat, "", selectedDate);
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            const filename = `Report_${reportType}_${selectedMonth}.${fileFormat}`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();

            const newReport = {
                id: exportHistory.length + 1,
                name: filename,
                type: reportType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                date: new Date().toLocaleString(),
                status: 'Ready',
                size: (data.size / 1024).toFixed(1) + ' KB'
            };
            setExportHistory([newReport, ...exportHistory]);
            toast.success("Report generated successfully");
        } catch (error) {
            toast.error(error.message || "Failed to generate report");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <DashboardLayout title="Reports & Exports">
            <div className="space-y-6">

                {/* Top Control Bar: Generate Report */}
                <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border p-6 sm:p-7">
                    <div className="flex flex-col xl:flex-row items-start xl:items-end gap-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 flex-1 w-full">
                            {reportType !== 'employee_master' && (
                                <div>
                                    {['matrix_monthly', 'attendance_detailed', 'attendance_summary'].includes(reportType) ? (
                                        <MonthPicker
                                            label="Select Month"
                                            value={selectedMonth}
                                            onChange={(val) => setSelectedMonth(val)}
                                        />
                                    ) : (
                                        <DatePicker
                                            label="Select Date"
                                            value={selectedDate}
                                            onChange={(val) => setSelectedDate(val)}
                                        />
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-github-dark-muted mb-1.5 ml-1">Report Type</label>
                                <select
                                    value={reportType}
                                    onChange={(e) => setReportType(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm font-medium text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all"
                                >
                                    <option value="matrix_daily">Daily Attendance Matrix</option>
                                    <option value="matrix_weekly">Weekly Attendance Matrix</option>
                                    <option value="matrix_monthly">Monthly Attendance Matrix</option>
                                    <option value="attendance_summary">Monthly Summary Report</option>
                                    <option value="employee_master">Employee Master Data</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-github-dark-muted mb-1.5 ml-1">File Format</label>
                                <div className="flex gap-2">
                                    {[
                                        { id: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
                                        { id: 'csv', label: 'CSV', icon: FileType },
                                        { id: 'pdf', label: 'PDF', icon: FileText }
                                    ].map((format) => (
                                        <button
                                            key={format.id}
                                            onClick={() => setFileFormat(format.id)}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-all ${fileFormat === format.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-800' : 'bg-slate-50 dark:bg-github-dark-subtle border-slate-200 dark:border-github-dark-border text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                        >
                                            <format.icon size={18} />
                                            <span className="text-sm font-semibold">{format.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full xl:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md shadow-indigo-200 dark:shadow-indigo-950/20 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-[48px]"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span className="whitespace-nowrap">Generating...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={18} />
                                    <span className="whitespace-nowrap">Download Report</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Main Content Area: Tabs + Full Width Table */}
                <div className="space-y-4">
                    {/* Tabs */}
                    <div className="flex space-x-1 bg-slate-100 dark:bg-github-dark-subtle p-1 rounded-lg w-fit">
                        {[
                            { id: 'preview', label: 'Data Preview', icon: Eye },
                            { id: 'history', label: 'Export History', icon: DownloadCloud }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-200'}`}
                            >
                                <tab.icon size={16} /> {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Full Width Card - Responsive Height */}
                    <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden transition-all">

                        {activeTab === 'preview' && (
                            <>
                                <div className="p-5 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/10 flex justify-between items-center shrink-0">
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                            <Table className="text-slate-400" size={18} />
                                            Report Preview
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-1">
                                            Report data for <span className="font-medium text-slate-700 dark:text-slate-300">{reportType.replace('_', ' ')}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="overflow-x-auto no-scrollbar">
                                    {loadingPreview ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                                            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                            <p className="text-slate-500 text-sm font-medium">Loading preview data...</p>
                                        </div>
                                    ) : previewData.rows && previewData.rows.length > 0 ? (
                                        <table className="w-full text-left border-collapse">
                                            <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-github-dark-subtle/95 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-github-dark-border">
                                                {previewData.headers ? (
                                                    <>
                                                        <tr className="text-xs uppercase text-slate-500 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                                            {previewData.headers[0].map((cell, idx) => (
                                                                <th 
                                                                    key={idx} 
                                                                    rowSpan={cell.rowspan} 
                                                                    colSpan={cell.colspan} 
                                                                    className="px-6 py-4 whitespace-nowrap tracking-wider text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0"
                                                                >
                                                                    {cell.label}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                        <tr className="text-xs uppercase text-slate-500 dark:text-github-dark-muted font-bold">
                                                            {previewData.headers[1].map((cell, idx) => (
                                                                <th 
                                                                    key={idx} 
                                                                    className="px-6 py-3 whitespace-nowrap tracking-wider text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0"
                                                                >
                                                                    {cell.label}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </>
                                                ) : (
                                                    <tr className="text-xs uppercase text-slate-500 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                                        {previewData.columns.map((col, idx) => (
                                                            <th key={idx} className="px-6 py-4 whitespace-nowrap tracking-wider text-left">
                                                                {col?.toString().split('\n').map((line, lIdx) => (
                                                                    <div key={lIdx} className="leading-tight">{line}</div>
                                                                ))}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                )}
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {previewData.rows.map((row, rIdx) => (
                                                    <tr key={rIdx} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group">
                                                        {row.map((cell, cIdx) => (
                                                            <td key={cIdx} className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                                                {cell?.toString().split('\n').map((line, lIdx) => (
                                                                    <div key={lIdx} className="leading-normal">{line}</div>
                                                                ))}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}

                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                                            <Table className="text-slate-200 dark:text-slate-700" size={48} />
                                            <p className="text-slate-500 text-sm">No data available for this selection.</p>
                                        </div>
                                    )}
                                </div>

                            </>
                        )}

                        {activeTab === 'history' && (
                            <>
                                <div className="p-5 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/10 flex justify-between items-center">
                                    <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                        <DownloadCloud className="text-slate-400" size={18} />
                                        Export History
                                    </h3>

                                </div>
                                <div className="overflow-x-auto no-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-github-dark-subtle/95 backdrop-blur-md shadow-sm">
                                            <tr className="bg-slate-50/50 dark:bg-github-dark-subtle/50 text-xs uppercase text-slate-500 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                                <th className="px-6 py-5">File Name</th>
                                                <th className="px-6 py-5">Generated</th>
                                                <th className="px-6 py-5">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {exportHistory.map((file) => (
                                                <tr key={file.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group">
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`p-2.5 rounded-lg shadow-sm ${file.name.endsWith('.pdf') ? 'bg-red-50 text-red-600' : file.name.endsWith('.csv') ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'} dark:bg-github-dark-subtle dark:text-slate-300`}>
                                                                {file.name.endsWith('.pdf') ? <FileText size={18} /> : file.name.endsWith('.csv') ? <FileType size={18} /> : <FileSpreadsheet size={18} />}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-slate-800 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">{file.type}</p>
                                                                <p className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">{file.size}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-sm font-medium text-slate-600 dark:text-github-dark-muted">
                                                        {file.date}
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        {file.status === 'Ready' ? (
                                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full shadow-sm">
                                                                <CheckCircle size={14} /> Ready
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full shadow-sm">
                                                                <AlertCircle size={14} /> Failed
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Reports;
