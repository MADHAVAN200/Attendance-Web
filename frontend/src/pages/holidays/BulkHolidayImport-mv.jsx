import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    UploadCloud,
    FileText,
    CheckCircle,
    AlertCircle,
    X,
    ChevronRight,
    Download,
    History
} from 'lucide-react';
import Papa from 'papaparse';
import { holidayService } from '../../services/holidayService';
import { toast } from 'react-toastify';

const BulkHolidayImport = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Upload, 2: Preview, 3: Success
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadReport, setUploadReport] = useState(null);

    const handleFileDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
            setFile(droppedFile);
            parseCSV(droppedFile);
        } else {
            toast.error("Please upload a valid CSV file");
        }
    };

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseCSV(selectedFile);
        }
    };

    const parseCSV = (file) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data;
                const processed = data.map(row => {
                    const name = row['Holiday Name'] || row['holiday_name'] || row['name'];
                    const date = row['Date'] || row['holiday_date'] || row['date'];
                    const type = row['Type'] || row['holiday_type'] || row['type'] || 'Public';

                    let status = (name && date) ? 'Valid' : 'Error';
                    let errorMsg = !status === 'Valid' ? 'Missing Data' : '';

                    if (!name) {
                        status = 'Error';
                        errorMsg = 'Missing Holiday Name';
                    } else if (!date) {
                        status = 'Error';
                        errorMsg = 'Missing Date';
                    }

                    return {
                        ...row,
                        name,
                        date,
                        type,
                        status,
                        errorMsg
                    };
                });
                setPreviewData(processed);
                setStep(2);
            },
            error: (error) => {
                console.error(error);
                toast.error("Failed to parse CSV file");
            }
        });
    };

    const handleUpload = async () => {
        setIsUploading(true);
        try {
            const validRows = previewData.filter(r => r.status === 'Valid');

            if (validRows.length === 0) {
                toast.error("No valid data to upload");
                setIsUploading(false);
                return;
            }

            const validationResponse = await holidayService.bulkValidateHolidays(validRows);

            if (!validationResponse.ok) {
                toast.error("Validation failed");
                setIsUploading(false);
                return;
            }

            const validation = validationResponse.validation;
            const duplicates = validation.duplicates || [];
            const rowsToUpload = validRows.filter((row, idx) => 
                !duplicates.some(d => d.row === idx + 1)
            );

            let finalReport = {
                total_processed: previewData.length,
                success_count: 0,
                failure_count: 0,
                errors: [],
                skipped_rows: duplicates.map((d) => ({
                    name: validRows[d.row - 1]?.name,
                    date: validRows[d.row - 1]?.date,
                    skipReason: d.reason
                }))
            };

            if (rowsToUpload.length > 0) {
                const uploadResponse = await holidayService.bulkCreateHolidaysJson(rowsToUpload);
                if (uploadResponse.ok) {
                    finalReport.success_count = uploadResponse.report.success_count;
                    finalReport.failure_count += uploadResponse.report.failure_count;
                    finalReport.errors = [...uploadResponse.report.errors];
                } else {
                    toast.error("Upload failed");
                }
            }

            setUploadReport(finalReport);
            setStep(3);

        } catch (error) {
            console.error(error);
            toast.error(error.message || "Upload failed");
        } finally {
            setIsUploading(false);
        }
    };

    const downloadSample = () => {
        const csvContent = "Holiday Name,Date,Type\nNew Year,2025-01-01,Public\nRepublic Day,2025-01-26,Public\nIndependence Day,2025-08-15,Public";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "holidays_import.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const uniqueTypes = [...new Set(previewData.map(r => r.type).filter(t => t && t !== '-'))];

    return (
        <MobileDashboardLayout title="Bulk Import">
            <div className="flex flex-col h-full -mx-4 -mt-2">
                
                {/* Steps Header - Compact */}
                <div className="px-6 py-4 bg-white dark:bg-black border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>1</div>
                            <span className={`text-xs font-semibold ${step === 1 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Upload</span>
                        </div>
                        <div className={`flex-1 h-[2px] mx-4 ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-100 dark:bg-slate-800'}`}></div>
                        <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>2</div>
                            <span className={`text-xs font-semibold ${step === 2 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Preview</span>
                        </div>
                        <div className={`flex-1 h-[2px] mx-4 ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-100 dark:bg-slate-800'}`}></div>
                        <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>3</div>
                            <span className={`text-xs font-semibold ${step === 3 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Done</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-6">
                    {/* Step 1: Upload */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div 
                                className="bg-white dark:bg-black border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] p-10 flex flex-col items-center text-center active:scale-[0.98] transition-all cursor-pointer"
                                onClick={() => document.getElementById('fileInput').click()}
                            >
                                <input
                                    type="file"
                                    id="fileInput"
                                    className="hidden"
                                    accept=".csv"
                                    onChange={handleFileSelect}
                                />
                                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/10 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6">
                                    <UploadCloud size={36} />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Upload CSV File</h3>
                                <p className="text-sm text-slate-400 max-w-[200px]">Drag and drop your file here or tap to browse</p>
                                
                                <button className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-semibold shadow-xl shadow-indigo-200 dark:shadow-none transition-all active:scale-95">
                                    Browse Files
                                </button>
                            </div>

                            <div 
                                onClick={downloadSample}
                                className="flex items-center justify-center gap-3 p-5 bg-slate-50 dark:bg-[#161b22] rounded-2xl border border-slate-100 dark:border-slate-800 cursor-pointer active:scale-[0.98] transition-all"
                            >
                                <div className="w-10 h-10 bg-white dark:bg-black rounded-xl flex items-center justify-center text-indigo-600">
                                    <Download size={20} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Sample Template</p>
                                    <p className="text-xs text-slate-400">Download holidays_import.csv</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Preview */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="bg-white dark:bg-black rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl flex items-center justify-center text-indigo-600">
                                            <FileText size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{file?.name}</p>
                                            <p className="text-[10px] text-slate-400 uppercase font-semibold">{(file?.size / 1024).toFixed(1)} KB • {previewData.length} Rows</p>
                                        </div>
                                    </div>
                                    <button onClick={() => { setStep(1); setFile(null); }} className="w-8 h-8 flex items-center justify-center text-slate-400">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-[40vh] overflow-y-auto">
                                    {previewData.slice(0, 50).map((row, idx) => (
                                        <div key={idx} className="p-4 flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{row.name || '-'}</p>
                                                <p className="text-xs text-slate-400">{row.date} • {row.type}</p>
                                            </div>
                                            <div>
                                                {row.status === 'Valid' ? (
                                                    <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center text-emerald-500">
                                                        <CheckCircle size={14} />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-red-50 dark:bg-red-900/10 flex items-center justify-center text-red-500" title={row.errorMsg}>
                                                        <AlertCircle size={14} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {previewData.length > 50 && (
                                        <div className="p-4 text-center">
                                            <p className="text-xs text-slate-400 italic">... and {previewData.length - 50} more rows</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-indigo-600 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-200 dark:shadow-none">
                                <p className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">Ready to Import</p>
                                <p className="text-2xl font-semibold">{previewData.filter(r => r.status === 'Valid').length} Valid Holidays</p>
                                <p className="text-xs mt-4 opacity-70 leading-relaxed">
                                    These holidays will be added to your organization's calendar. 
                                    Duplicates will be automatically skipped during processing.
                                </p>
                            </div>

                            <button
                                onClick={handleUpload}
                                disabled={isUploading}
                                className="w-full py-4 bg-slate-900 dark:bg-white dark:text-black text-white rounded-2xl font-semibold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                            >
                                {isUploading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white dark:border-black border-t-transparent animate-spin rounded-full"></div>
                                        <span>Importing...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Start Import Now</span>
                                        <ChevronRight size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Step 3: Success */}
                    {step === 3 && (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                            <div className="text-center">
                                <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/10 rounded-[2.5rem] flex items-center justify-center text-emerald-500 mx-auto mb-6 shadow-sm">
                                    <CheckCircle size={48} strokeWidth={1.5} />
                                </div>
                                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">Import Complete</h2>
                                <p className="text-slate-400 text-sm">Your holidays have been processed successfully.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-black p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 text-center">
                                    <p className="text-2xl font-semibold text-slate-900 dark:text-white">{uploadReport?.success_count || 0}</p>
                                    <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-widest mt-1">Success</p>
                                </div>
                                <div className="bg-white dark:bg-black p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 text-center">
                                    <p className="text-2xl font-semibold text-slate-900 dark:text-white">{uploadReport?.skipped_rows?.length || 0}</p>
                                    <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest mt-1">Skipped</p>
                                </div>
                            </div>

                            {uploadReport?.skipped_rows?.length > 0 && (
                                <div className="bg-white dark:bg-black rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#161b22]">
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <History size={14} /> Skipped Items
                                        </h4>
                                    </div>
                                    <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-64 overflow-y-auto">
                                        {uploadReport.skipped_rows.map((row, i) => (
                                            <div key={i} className="p-4">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{row.name}</p>
                                                <p className="text-xs text-amber-500 mt-1 font-medium">{row.skipReason}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <button
                                    onClick={() => navigate('/holidays')}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold shadow-xl shadow-indigo-200 dark:shadow-none active:scale-95 transition-all"
                                >
                                    Go to Holidays
                                </button>
                                <button
                                    onClick={() => { setStep(1); setFile(null); setUploadReport(null); }}
                                    className="w-full py-4 bg-slate-50 dark:bg-[#161b22] text-slate-600 dark:text-slate-300 rounded-2xl font-semibold active:scale-95 transition-all"
                                >
                                    Import More
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </MobileDashboardLayout>
    );
};

export default BulkHolidayImport;
