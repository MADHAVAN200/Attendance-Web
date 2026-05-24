import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import {
    UploadCloud,
    FileText,
    CheckCircle,
    AlertCircle,
    X,
    ChevronRight,
    Download,
    ArrowLeft
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

                    // Basic validation check for preview
                    let status = (name && (email || phone)) ? 'Valid' : 'Error';
                    let errorMsg = status === 'Error' ? 'Missing (Name & Contact)' : '';

                    // Role Restrictions
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
            // 1. Check existing users to calculate available slots based on subscription limit
            const usersData = await adminService.getAllUsers();
            const currentUsers = usersData.users || [];
            const currentCount = currentUsers.length;
            const maxUsersLimit = currentUser?.org_max_users || Infinity; // Fallback to Infinity if not yet in state
            const availableSlots = Math.max(0, maxUsersLimit - currentCount);

            // Create Sets of existing identifiers for quick lookup
            const existingEmails = new Set(currentUsers.filter(u => u.email).map(u => u.email.toLowerCase()));
            const existingPhones = new Set(currentUsers.filter(u => u.phone_no).map(u => u.phone_no.toString()));

            const validRows = previewData.filter(r => r.status === 'Valid');

            if (validRows.length === 0) {
                toast.error("No valid data to upload");
                setIsUploading(false);
                return;
            }

            // 2. Separate Duplicates from New Candidates
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

            // 3. Partition New Candidates based on Available Slots
            const rowsToUpload = newCandidates.slice(0, availableSlots);
            const rowsRejected = newCandidates.slice(availableSlots);

            // Mark rejected rows with reason
            const rejectedWithReason = rowsRejected.map(r => ({ ...r, skipReason: 'Subscription limit reached' }));

            // Combine all skipped items for the table
            const skippedItems = [...duplicates, ...rejectedWithReason];

            let finalReport = {
                total_processed: validRows.length,
                success_count: 0,
                failure_count: 0,
                errors: [],
                skipped_rows: skippedItems
            };

            // 4. Process Allowed New Rows
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

            // 5. Finalize Stats
            finalReport.failure_count += rowsRejected.length; // From limit
            // Note: We don't necessarily count duplicates as "failures", but they are "not uploaded".

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

    // Calculate unique values for summary
    const uniqueDepts = [...new Set(previewData.map(r => r.dept).filter(d => d && d !== '-'))];
    const uniqueDesgs = [...new Set(previewData.map(r => r.desg).filter(d => d && d !== '-'))];

    return (
        <DashboardLayout title="Bulk Employee Upload">
            <div className="w-full space-y-8">

                {/* Back Button */}
                <button
                    onClick={() => navigate('/employees')}
                    className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 dark:text-github-dark-muted dark:hover:text-indigo-400 transition-colors mb-4 group"
                >
                    <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
                    <span className="text-sm font-semibold">Back to Employees</span>
                </button>

                {/* Progress Steps */}
                <div className="flex items-center justify-center mb-10">
                    <div className="flex items-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                            step >= 1 
                                ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>1</div>
                        <span className={`ml-2.5 text-sm font-bold tracking-wide transition-colors ${
                            step >= 1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                        }`}>Upload</span>
                    </div>
                    <div className={`w-20 h-[3px] mx-4 rounded-full transition-all duration-500 ${
                        step >= 2 ? 'bg-indigo-600' : 'bg-slate-100 dark:bg-slate-800'
                    }`}></div>
                    <div className="flex items-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                            step >= 2 
                                ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>2</div>
                        <span className={`ml-2.5 text-sm font-bold tracking-wide transition-colors ${
                            step >= 2 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                        }`}>Preview</span>
                    </div>
                    <div className={`w-20 h-[3px] mx-4 rounded-full transition-all duration-500 ${
                        step >= 3 ? 'bg-indigo-600' : 'bg-slate-100 dark:bg-slate-800'
                    }`}></div>
                    <div className="flex items-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                            step >= 3 
                                ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>3</div>
                        <span className={`ml-2.5 text-sm font-bold tracking-wide transition-colors ${
                            step >= 3 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                        }`}>Done</span>
                    </div>
                </div>

                {/* Step 1: Upload Area */}
                {step === 1 && (
                    <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-3xl p-8 sm:p-12 shadow-[0_8px_30px_rgba(99,102,241,0.02)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] text-center transition-colors duration-300">
                        <div
                            className="border-2 border-dashed border-slate-200 dark:border-github-dark-border rounded-2xl p-10 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all cursor-pointer group"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleFileDrop}
                            onClick={() => document.getElementById('fileInput').click()}
                        >
                            <input
                                type="file"
                                id="fileInput"
                                className="hidden"
                                accept=".csv"
                                onChange={handleFileSelect}
                            />
                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-all duration-300">
                                <UploadCloud size={28} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text mb-2">Click to upload or drag and drop</h3>
                            <p className="text-sm text-slate-400 dark:text-github-dark-muted mb-6">CSV files only (Max 5MB)</p>
                            <button className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md active:scale-95">
                                Select File
                            </button>
                        </div>

                        <div
                            onClick={downloadSample}
                            className="mt-8 flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold hover:underline cursor-pointer transition-colors">
                            <Download size={15} />
                            <span>Download Sample CSV Template</span>
                        </div>
                    </div>
                )}

                {/* Step 2: Preview */}
                {step === 2 && (
                    <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-3xl shadow-[0_8px_30px_rgba(99,102,241,0.02)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] overflow-hidden transition-all duration-300">
                        <div className="p-6 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between bg-slate-50/20 dark:bg-github-dark-subtle/10">
                            <div className="flex items-center gap-3.5">
                                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl">
                                    <FileText className="text-indigo-600 dark:text-indigo-400 animate-pulse" size={20} />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-slate-800 dark:text-github-dark-text text-sm sm:text-base">{file?.name}</h3>
                                    <p className="text-xs text-slate-400">{(file?.size / 1024).toFixed(1)} KB • {previewData.length} Rows</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setStep(1); setFile(null); }}
                                className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="overflow-x-auto max-h-96 custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 dark:bg-github-dark-subtle/50 text-[10px] uppercase text-slate-400 dark:text-github-dark-muted font-bold tracking-wider sticky top-0 z-10 backdrop-blur-md">
                                    <tr>
                                        <th className="px-6 py-3.5">Name</th>
                                        <th className="px-6 py-3.5">Email</th>
                                        <th className="px-6 py-3.5">Role</th>
                                        <th className="px-6 py-3.5">Department</th>
                                        <th className="px-6 py-3.5">Validation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {previewData.slice(0, 50).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-[#161b22]/30 transition-colors">
                                            <td className="px-6 py-3.5 text-sm font-bold text-slate-800 dark:text-github-dark-text">{row.name || '-'}</td>
                                            <td className="px-6 py-3.5 text-sm text-slate-500 dark:text-github-dark-muted">{row.email || '-'}</td>
                                            <td className="px-6 py-3.5 text-sm text-slate-500 dark:text-github-dark-muted">{row.desg}</td>
                                            <td className="px-6 py-3.5 text-sm text-slate-500 dark:text-github-dark-muted">{row.dept}</td>
                                            <td className="px-6 py-3.5">
                                                {row.status === 'Valid' ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1 rounded-full border border-emerald-200/30 dark:border-emerald-800/20">
                                                        <CheckCircle size={12} /> Valid
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-3 py-1 rounded-full border border-red-200/30 dark:border-red-800/20 whitespace-nowrap" title={row.errorMsg}>
                                                        <AlertCircle size={12} /> {row.errorMsg || 'Error'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {previewData.length > 50 && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-5 text-center text-xs text-slate-400 italic">
                                                ... and {previewData.length - 50} more rows
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Import Summary Section */}
                        <div className="p-6 bg-slate-50/40 dark:bg-[#161b22]/30 border-t border-slate-100 dark:border-github-dark-border">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-widest mb-4">Import Data Summary</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white dark:bg-[#0d1117]/40 border border-slate-100 dark:border-github-dark-border rounded-2xl p-4 text-left">
                                    <h5 className="text-[10px] text-slate-400 dark:text-slate-400 uppercase font-black tracking-widest mb-3">Departments Found ({uniqueDepts.length})</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueDepts.map((d, i) => (
                                            <span key={i} className="px-2.5 py-1 text-xs font-semibold bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-150 dark:border-github-dark-border rounded-lg text-slate-700 dark:text-slate-300">
                                                {d}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-[#0d1117]/40 border border-slate-100 dark:border-github-dark-border rounded-2xl p-4 text-left">
                                    <h5 className="text-[10px] text-slate-400 dark:text-slate-400 uppercase font-black tracking-widest mb-3">Designations Found ({uniqueDesgs.length})</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueDesgs.map((d, i) => (
                                            <span key={i} className="px-2.5 py-1 text-xs font-semibold bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-150 dark:border-github-dark-border rounded-lg text-slate-700 dark:text-slate-300">
                                                {d}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-github-dark-border flex justify-end gap-3 bg-white dark:bg-dark-card rounded-b-3xl">
                            <button
                                onClick={() => setStep(1)}
                                className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={isUploading}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70"
                            >
                                {isUploading ? 'Uploading...' :
                                    <>
                                        <span>Upload Employees</span>
                                        <ChevronRight size={15} />
                                    </>
                                }
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Success */}
                {step === 3 && (
                    <div className="text-center py-10 bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-3xl p-8 sm:p-12 shadow-[0_8px_30px_rgba(99,102,241,0.02)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
                        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-md shadow-emerald-500/10">
                            <CheckCircle size={38} strokeWidth={1.8} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-850 dark:text-github-dark-text mb-2">Upload Completed!</h2>
                        <p className="text-slate-400 text-sm mb-8 max-w-sm mx-auto">
                            The uploaded CSV list has been parsed and integrated successfully. See details below.
                        </p>

                        <div className="grid grid-cols-3 gap-4 mb-8">
                            <div className="bg-slate-50/40 dark:bg-github-dark-subtle/20 border border-slate-100 dark:border-github-dark-border p-4.5 rounded-2xl">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Processed</span>
                                <span className="text-2xl font-extrabold text-slate-850 dark:text-github-dark-text">{uploadReport?.total_processed || 0}</span>
                            </div>
                            <div className="bg-slate-50/40 dark:bg-[#161b22]/20 border border-slate-100 dark:border-github-dark-border p-4.5 rounded-2xl">
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block mb-1">Success</span>
                                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-450">{uploadReport?.success_count || 0}</span>
                            </div>
                            <div className="bg-slate-50/40 dark:bg-github-dark-subtle/20 border border-slate-100 dark:border-github-dark-border p-4.5 rounded-2xl">
                                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Skipped</span>
                                <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{uploadReport?.skipped_rows?.length || 0}</span>
                            </div>
                        </div>

                        {/* Skipped Items Table */}
                        {uploadReport?.skipped_rows?.length > 0 && (
                            <div className="mb-8 text-left">
                                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-4">Skipped Items</h4>
                                <div className="border border-slate-100 dark:border-github-dark-border rounded-2xl overflow-hidden shadow-sm">
                                    <div className="overflow-y-auto max-h-60 custom-scrollbar">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50/60 dark:bg-github-dark-subtle/50 text-[10px] uppercase text-slate-400 dark:text-github-dark-muted font-bold tracking-wider sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-3">Name</th>
                                                    <th className="px-4 py-3">Email</th>
                                                    <th className="px-4 py-3 text-right">Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {uploadReport.skipped_rows.map((row, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/30 dark:hover:bg-[#161b22]/30 transition-colors">
                                                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-github-dark-text text-xs sm:text-sm">{row.name}</td>
                                                        <td className="px-4 py-3 text-slate-500 dark:text-github-dark-muted text-xs sm:text-sm truncate max-w-[150px]">{row.email}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            {row.skipReason === 'Subscription limit reached' ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-full border border-red-200/20">
                                                                    Limit Reached
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full border border-amber-200/20">
                                                                    User Exists
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Generic Errors (Backend) */}
                        {uploadReport?.errors?.length > 0 && (
                            <div className="mb-8 bg-red-50 dark:bg-red-950/10 border border-red-150 dark:border-red-900/20 p-4 rounded-2xl text-left overflow-auto max-h-40">
                                <h4 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide mb-2">Detailed Errors:</h4>
                                <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-300 space-y-1">
                                    {uploadReport.errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-center gap-3">
                            <button
                                onClick={() => navigate('/employees')}
                                className="px-6 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-github-dark-subtle/50 dark:hover:bg-github-dark-subtle text-slate-700 dark:text-github-dark-text text-sm font-bold rounded-xl border border-slate-150 dark:border-github-dark-border transition-colors active:scale-95"
                            >
                                View Employee List
                            </button>
                            <button
                                onClick={() => { setStep(1); setFile(null); setUploadReport(null); }}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-colors active:scale-95"
                            >
                                Upload More
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </DashboardLayout>
    );
};

export default BulkUpload;
