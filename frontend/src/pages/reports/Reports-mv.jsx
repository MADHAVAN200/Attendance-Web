import React, { useState } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { ChevronDown, History, FileText, ExternalLink, Eye } from 'lucide-react';

const Reports = () => {
    const [selectedReportType, setSelectedReportType] = useState('Monthly Matrix');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const reportTypes = [
        'Daily Matrix',
        'Weekly Matrix',
        'Monthly Matrix',
        'Lateness Report',
        'Detailed Log',
        'Monthly Summary',
        'Employee Master'
    ];

    const generatedReports = [
        { id: 1, name: `Report_matrix_monthly_1771042589719...`, date: 'Feb 14, 09:46 AM', type: 'pdf', iconColor: 'bg-red-100 text-red-500' },
        { id: 2, name: `Report_matrix_monthly_1771042571929...`, date: 'Feb 14, 09:46 AM', type: 'xls', iconColor: 'bg-emerald-100 text-emerald-600' },
    ];

    return (
        <MobileDashboardLayout title="Reports & Exports">
            {/* Report Type Selector */}
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-visible relative z-20">
                <div
                    className="p-5 flex justify-between items-center"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                    <span className="font-medium text-slate-700 dark:text-slate-200">{selectedReportType}</span>
                    <ChevronDown size={20} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-dark-card rounded-b-2xl shadow-xl border-t border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        {reportTypes.map((type) => (
                            <div
                                key={type}
                                onClick={() => {
                                    setSelectedReportType(type);
                                    setIsDropdownOpen(false);
                                }}
                                className={`px-5 py-3 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors
                                    ${selectedReportType === type ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}
                                `}
                            >
                                {type}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4">
                <button className="py-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl flex items-center justify-center gap-2 text-sm">
                    <Eye size={18} /> Preview
                </button>
                <button className="py-3 bg-white dark:bg-dark-card text-indigo-600 dark:text-indigo-400 font-bold rounded-xl border border-indigo-100 dark:border-indigo-900 shadow-sm flex items-center justify-center gap-2 text-sm">
                    <History size={18} /> History
                </button>
            </div>

            {/* Report History List */}
            <div className="space-y-4">
                {generatedReports.map((report) => (
                    <div key={report.id} className="bg-white dark:bg-dark-card rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className={`w-12 h-12 rounded-xl ${report.iconColor} flex items-center justify-center shrink-0`}>
                                <FileText size={24} />
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate pr-2">{report.name}</h4>
                                <p className="text-xs text-slate-400">{report.date}</p>
                            </div>
                        </div>
                        <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                            <ExternalLink size={20} />
                        </button>
                    </div>
                ))}
            </div>
        </MobileDashboardLayout>
    );
};

export default Reports;
