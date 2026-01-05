import React, { useState } from 'react';
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
    Filter,
    Eye,
    Table
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

    // Mock Export History
    const [exportHistory, setExportHistory] = useState([
        { id: 1, name: 'Attendance_Report_Nov_2023.xlsx', type: 'Detailed Attendance', date: '01 Dec 2023, 10:00 AM', status: 'Ready', size: '1.2 MB' },
        { id: 2, name: 'Payroll_Summary_Nov_2023.pdf', type: 'Payroll Summary', date: '01 Dec 2023, 10:05 AM', status: 'Ready', size: '450 KB' },
        { id: 3, name: 'Lateness_Report_Oct_2023.csv', type: 'Lateness Report', date: '01 Nov 2023, 09:30 AM', status: 'Ready', size: '200 KB' },
        { id: 4, name: 'Full_Dump_2022.zip', type: 'System Backup', date: '15 Jan 2023, 02:00 PM', status: 'Failed', size: '-' },
    ]);

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
                console.error(error);
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
            console.error(error);
            toast.error(error.message || "Failed to generate report");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <DashboardLayout title="Reports & Exports">
            <div className="space-y-6">

                {/* Top Control Bar: Generate Report */}
                <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
                    <div className="flex flex-col xl:flex-row items-start xl:items-end gap-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 flex-1 w-full">
                            {reportType !== 'employee_master' && (
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                                        {['matrix_monthly', 'lateness_report', 'attendance_detailed', 'attendance_summary'].includes(reportType) ? 'Select Month' : 'Select Date'}
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        {['matrix_monthly', 'lateness_report', 'attendance_detailed', 'attendance_summary'].includes(reportType) ? (
                                            <input
                                                type="month"
                                                value={selectedMonth}
                                                onChange={(e) => setSelectedMonth(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                            />
                                        ) : (
                                            <input
                                                type="date"
                                                value={selectedDate}
                                                onChange={(e) => setSelectedDate(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">Report Type</label>
                                <select
                                    value={reportType}
                                    onChange={(e) => setReportType(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                                >
                                    <option value="matrix_daily">Daily Attendance Matrix</option>
                                    <option value="matrix_weekly">Weekly Attendance Matrix</option>
                                    <option value="matrix_monthly">Monthly Attendance Matrix</option>
                                    <option value="lateness_report">Lateness & Overtime Report</option>
                                    <option value="attendance_detailed">Detailed Attendance Log (Original)</option>
                                    <option value="attendance_summary">Monthly Summary (Original)</option>
                                    <option value="employee_master">Employee Master Data</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">File Format</label>
                                <div className="flex gap-2">
                                    {[
                                        { id: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
                                        { id: 'csv', label: 'CSV', icon: FileType },
                                        { id: 'pdf', label: 'PDF', icon: FileText }
                                    ].map((format) => (
                                        <button
                                            key={format.id}
                                            onClick={() => setFileFormat(format.id)}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border transition-all ${fileFormat === format.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                        >
                                            <format.icon size={16} />
                                            <span className="text-sm font-medium">{format.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full xl:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-[42px]"
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
                    <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
                        {[
                            { id: 'preview', label: 'Data Preview', icon: Eye },
                            { id: 'history', label: 'Export History', icon: DownloadCloud }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            >
                                <tab.icon size={16} /> {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Full Width Card */}
                    <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[500px] flex flex-col">

                        {activeTab === 'preview' && (
                            <>
                                <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/10 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                            <Table className="text-slate-400" size={18} />
                                            Report Preview
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            Sample data for <span className="font-medium text-slate-700 dark:text-slate-300">{reportType.replace('_', ' ')}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="overflow-x-auto flex-1">
                                    {loadingPreview ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                                            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                            <p className="text-slate-500 text-sm font-medium">Loading preview data...</p>
                                        </div>
                                    ) : previewData.rows && previewData.rows.length > 0 ? (
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                                                    {previewData.columns.map((col, idx) => (
                                                        <th key={idx} className="px-6 py-4 whitespace-nowrap">{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {previewData.rows.map((row, rIdx) => (
                                                    <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                        {row.map((cell, cIdx) => (
                                                            <td key={cIdx} className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                                {cell}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                                {/* Filler Rows */}
                                                {previewData.rows.length < 10 && Array.from({ length: Math.max(0, 5 - previewData.rows.length) }).map((_, i) => (
                                                    <tr key={`filler-${i}`} className="bg-slate-50/10 dark:bg-slate-800/10">
                                                        {previewData.columns.map((_, cIdx) => (
                                                            <td key={cIdx} className="px-6 py-4 text-sm text-slate-300 dark:text-slate-600 blur-[1px] opacity-30 select-none">...</td>
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
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    This is a preview of the first few records. Actual report will contain all data.
                                </div>
                            </>
                        )}

                        {activeTab === 'history' && (
                            <>
                                <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/10 flex justify-between items-center">
                                    <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                        <DownloadCloud className="text-slate-400" size={18} />
                                        Export History
                                    </h3>
                                    <button className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                        <Filter size={16} />
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                                                <th className="px-6 py-4">File Name</th>
                                                <th className="px-6 py-4">Generated</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {exportHistory.map((file) => (
                                                <tr key={file.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-lg ${file.name.endsWith('.pdf') ? 'bg-red-50 text-red-600' : file.name.endsWith('.csv') ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'} dark:bg-slate-800 dark:text-slate-300`}>
                                                                {file.name.endsWith('.pdf') ? <FileText size={16} /> : file.name.endsWith('.csv') ? <FileType size={16} /> : <FileSpreadsheet size={16} />}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-slate-800 dark:text-white line-clamp-1">{file.type}</p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">{file.size}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                        {file.date}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {file.status === 'Ready' ? (
                                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-0.5 rounded-full">
                                                                <CheckCircle size={12} /> Ready
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-0.5 rounded-full">
                                                                <AlertCircle size={12} /> Failed
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {file.status === 'Ready' && (
                                                            <button className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium text-sm transition-colors">
                                                                Download
                                                            </button>
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
