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
    History,
    Shield
} from 'lucide-react';
import Papa from 'papaparse';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const BulkUpload = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
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
                    const name = row['Name'] || row['name'] || row['user_name'];
                    const email = row['Email'] || row['email'];
                    const phone = row['Phone'] || row['phone'] || row['phone_no'];
                    const dept = row['Department'] || row['department'] || row['dept_name'];
                    const desg = row['Designation'] || row['designation'] || row['desg_name'] || row['Role'] || row['role'];

                    let status = (name && (email || phone)) ? 'Valid' : 'Error';
                    let errorMsg = status === 'Error' ? 'Missing (Name & Contact)' : '';

                    const roleLower = desg ? desg.toString().toLowerCase() : '';
                    if (roleLower === 'admin') {
                        status = 'Error';
                        errorMsg = 'Cannot create Admin';
                    }
                    if (currentUser?.user_type === 'hr' && (roleLower === 'hr' || roleLower === 'admin')) {
                        status = 'Error';
                        errorMsg = 'HR cannot create HR/Admin';
                    }

                    return {
                        ...row,
                        name,
                        email,
                        phone,
                        dept: dept || '-',
                        desg: desg || '-',
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
            const usersData = await adminService.getAllUsers();
            const currentUsers = usersData.users || [];
            const currentCount = currentUsers.length;
            const maxUsersLimit = currentUser?.org_max_users || Infinity;
            const availableSlots = Math.max(0, maxUsersLimit - currentCount);

            const existingEmails = new Set(currentUsers.filter(u => u.email).map(u => u.email.toLowerCase()));
            const existingPhones = new Set(currentUsers.filter(u => u.phone_no).map(u => u.phone_no.toString()));

            const validRows = previewData.filter(r => r.status === 'Valid');

            if (validRows.length === 0) {
                toast.error("No valid data to upload");
                setIsUploading(false);
                return;
            }

            const newCandidates = [];
            const duplicates = [];
            const newEmailsSeen = new Set();
            const newPhonesSeen = new Set();

            validRows.forEach(row => {
                const emailLower = row.email?.toString().toLowerCase();
                const phoneStr = row.phone?.toString();

                let isDuplicate = false;
                let skipReason = '';

                if (emailLower && existingEmails.has(emailLower)) {
                    isDuplicate = true;
                    skipReason = 'User already exists (Email)';
                } else if (phoneStr && existingPhones.has(phoneStr)) {
                    isDuplicate = true;
                    skipReason = 'User already exists (Phone)';
                } else if (emailLower && newEmailsSeen.has(emailLower)) {
                    isDuplicate = true;
                    skipReason = 'Duplicate Email in file';
                } else if (phoneStr && newPhonesSeen.has(phoneStr)) {
                    isDuplicate = true;
                    skipReason = 'Duplicate Phone in file';
                }

                if (isDuplicate) {
                    duplicates.push({ ...row, skipReason });
                } else {
                    newCandidates.push(row);
                    if (emailLower) newEmailsSeen.add(emailLower);
                    if (phoneStr) newPhonesSeen.add(phoneStr);
                }
            });

            const rowsToUpload = newCandidates.slice(0, availableSlots);
            const rowsRejected = newCandidates.slice(availableSlots);

            const rejectedWithReason = rowsRejected.map(r => ({ ...r, skipReason: 'Subscription limit reached' }));

            const skippedItems = [...duplicates, ...rejectedWithReason];

            let finalReport = {
                total_processed: validRows.length,
                success_count: 0,
                failure_count: 0,
                errors: [],
                skipped_rows: skippedItems
            };

            if (rowsToUpload.length > 0) {
                const response = await adminService.bulkCreateUsersJson(rowsToUpload);
                if (response.ok) {
                    finalReport.success_count = response.report.success_count;
                    finalReport.failure_count += response.report.failure_count;
                    finalReport.errors = [...response.report.errors];
                } else {
                    toast.error("Partial upload failed");
                }
            }

            finalReport.failure_count += rowsRejected.length;

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
        const csvContent = "Name,Email,Phone,Department,Designation,Password \n John Doe,john@example.com,9876543210,Sales,Sales Exec,Pass@123";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "user_upload.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const uniqueDepts = [...new Set(previewData.map(r => r.dept).filter(d => d && d !== '-'))];
    const uniqueDesgs = [...new Set(previewData.map(r => r.desg).filter(d => d && d !== '-'))];

    return (
        <MobileDashboardLayout title="Bulk Upload">
            <div className="flex flex-col h-full -mx-4 -mt-2">
                
                {/* Steps Header */}
                <div className="px-6 py-4 bg-white dark:bg-dark-card border-b border-slate-100 dark:border-github-dark-border transition-colors duration-300">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                                step >= 1 
                                    ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]' 
                                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                            }`}>1</div>
                            <span className={`text-xs font-bold ${step === 1 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Upload</span>
                        </div>
                        <div className={`flex-1 h-[2px] mx-3 rounded-full transition-all duration-550 ${
                            step >= 2 ? 'bg-indigo-600' : 'bg-slate-100 dark:bg-slate-800'
                        }`}></div>
                        <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                                step >= 2 
                                    ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]' 
                                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                            }`}>2</div>
                            <span className={`text-xs font-bold ${step === 2 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Preview</span>
                        </div>
                        <div className={`flex-1 h-[2px] mx-3 rounded-full transition-all duration-550 ${
                            step >= 3 ? 'bg-indigo-600' : 'bg-slate-100 dark:bg-slate-800'
                        }`}></div>
                        <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                                step >= 3 
                                    ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]' 
                                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                            }`}>3</div>
                            <span className={`text-xs font-bold ${step === 3 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Done</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-6 pb-24">
                    {/* Step 1: Upload */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-[2rem] p-5 shadow-xl shadow-indigo-500/5">
                                <div 
                                    className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[1.8rem] p-8 sm:p-10 flex flex-col items-center text-center active:scale-[0.98] hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-[#161b22]/20 transition-all cursor-pointer"
                                    onClick={() => document.getElementById('fileInput').click()}
                                >
                                    <input
                                        type="file"
                                        id="fileInput"
                                        className="hidden"
                                        accept=".csv"
                                        onChange={handleFileSelect}
                                    />
                                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-5 shadow-md">
                                        <UploadCloud size={28} />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">Upload Employee List</h3>
                                    <p className="text-xs text-slate-400 max-w-[200px]">Choose a CSV file to import multiple employees at once</p>
                                    
                                    <button className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all">
                                        Select File
                                    </button>
                                </div>
                            </div>

                            <div 
                                onClick={downloadSample}
                                className="flex items-center gap-3.5 p-5 bg-slate-50 dark:bg-[#161b22]/40 rounded-2xl border border-slate-100 dark:border-github-dark-border cursor-pointer active:scale-[0.98] transition-all hover:bg-slate-100 dark:hover:bg-[#161b22]/70"
                            >
                                <div className="w-10 h-10 bg-white dark:bg-dark-card rounded-xl flex items-center justify-center text-indigo-500 shadow-sm border border-slate-100 dark:border-github-dark-border">
                                    <Download size={18} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Sample CSV Template</p>
                                    <p className="text-[10px] text-slate-400">Download user_upload.csv</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Preview */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-white dark:bg-dark-card rounded-[2rem] border border-slate-100 dark:border-github-dark-border overflow-hidden shadow-xl shadow-indigo-500/5">
                                <div className="p-5 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between bg-slate-50/20 dark:bg-github-dark-subtle/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl flex items-center justify-center text-indigo-650 animate-pulse">
                                            <FileText size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{file?.name}</p>
                                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">{(file?.size / 1024).toFixed(1)} KB • {previewData.length} Rows</p>
                                        </div>
                                    </div>
                                    <button onClick={() => { setStep(1); setFile(null); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500">
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-[40vh] overflow-y-auto custom-scrollbar">
                                    {previewData.slice(0, 50).map((row, idx) => (
                                        <div key={idx} className="p-4 flex items-center justify-between gap-3 bg-white dark:bg-dark-card hover:bg-slate-50/40 dark:hover:bg-[#161b22]/30 transition-colors">
                                            <div className="flex-1 min-w-0 text-left">
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{row.name || '-'}</p>
                                                <p className="text-[11px] text-slate-400 truncate">{row.email || row.phone} • {row.desg}</p>
                                            </div>
                                            <div>
                                                {row.status === 'Valid' ? (
                                                    <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-500 border border-emerald-200/20">
                                                        <CheckCircle size={13} />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center text-red-500 border border-red-200/20" title={row.errorMsg}>
                                                        <AlertCircle size={13} />
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

                            <div className="bg-indigo-600 dark:bg-[#161b22]/40 rounded-[2rem] border border-transparent dark:border-indigo-500/20 p-6 text-white shadow-xl shadow-indigo-100 dark:shadow-none text-left">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Import Summary</p>
                                        <p className="text-xl font-extrabold">{previewData.filter(r => r.status === 'Valid').length} Ready to Upload</p>
                                    </div>
                                    <Shield size={22} className="opacity-50" />
                                </div>
                                <div className="space-y-1.5 pt-1 border-t border-white/10 dark:border-slate-800">
                                    <p className="text-xs opacity-75 font-semibold">
                                        • {uniqueDepts.length} Departments identified
                                    </p>
                                    <p className="text-xs opacity-75 font-semibold">
                                        • {uniqueDesgs.length} Designations identified
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleUpload}
                                disabled={isUploading}
                                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-black text-white rounded-2xl font-bold shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-70"
                            >
                                {isUploading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white dark:border-black border-t-transparent animate-spin rounded-full"></div>
                                        <span>Uploading...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Confirm & Upload</span>
                                        <ChevronRight size={16} />
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Step 3: Success */}
                    {step === 3 && (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                            <div className="text-center pt-4">
                                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/20 rounded-[2rem] flex items-center justify-center text-emerald-500 mx-auto mb-5 shadow-md shadow-emerald-500/5">
                                    <CheckCircle size={38} strokeWidth={1.8} />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1.5">Upload Success</h2>
                                <p className="text-slate-400 text-xs sm:text-sm">Employee records have been added to your system.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-dark-card p-5 rounded-[2rem] border border-slate-100 dark:border-github-dark-border text-center shadow-md shadow-indigo-500/5">
                                    <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{uploadReport?.success_count || 0}</p>
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">Uploaded</p>
                                </div>
                                <div className="bg-white dark:bg-dark-card p-5 rounded-[2rem] border border-slate-100 dark:border-github-dark-border text-center shadow-md shadow-indigo-500/5">
                                    <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{uploadReport?.skipped_rows?.length || 0}</p>
                                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1">Skipped</p>
                                </div>
                            </div>

                            {uploadReport?.skipped_rows?.length > 0 && (
                                <div className="bg-white dark:bg-dark-card rounded-[2rem] border border-slate-100 dark:border-github-dark-border overflow-hidden shadow-md shadow-indigo-500/5 text-left">
                                    <div className="p-4 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <History size={13} /> Skipped Rows
                                        </h4>
                                    </div>
                                    <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-60 overflow-y-auto custom-scrollbar">
                                        {uploadReport.skipped_rows.map((row, i) => (
                                            <div key={i} className="p-4 flex justify-between items-center bg-white dark:bg-dark-card hover:bg-slate-50/30 transition-colors">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{row.name}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{row.email}</p>
                                                </div>
                                                <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full border border-amber-200/20 shrink-0">
                                                    {row.skipReason === 'Subscription limit reached' ? 'Limit Reached' : 'User Exists'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3 pb-8">
                                <button
                                    onClick={() => navigate('/employees')}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-200 dark:shadow-none active:scale-[0.98] transition-all"
                                >
                                    View Employee Directory
                                </button>
                                <button
                                    onClick={() => { setStep(1); setFile(null); setUploadReport(null); }}
                                    className="w-full py-4 bg-slate-50 hover:bg-slate-100 dark:bg-[#161b22] dark:hover:bg-[#161b22]/70 text-slate-600 dark:text-slate-300 rounded-2xl font-bold border border-slate-150 dark:border-github-dark-border active:scale-[0.98] transition-all"
                                >
                                    Upload More
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </MobileDashboardLayout>
    );
};

export default BulkUpload;
