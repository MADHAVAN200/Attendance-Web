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

const BulkUpload = () => {
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
                    const name = row['Name'] || row['name'] || row['user_name'];
                    const email = row['Email'] || row['email'];
                    const dept = row['Department'] || row['department'] || row['dept_name'];
                    const desg = row['Designation'] || row['designation'] || row['desg_name'] || row['Role'] || row['role'];

                    // Basic validation check for preview
                    const status = (name && email) ? 'Valid' : 'Error';
                    return {
                        ...row,
                        name,
                        email,
                        dept: dept || '-',
                        desg: desg || '-',
                        status
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
            // 1. Check current subscription limit and existing users
            const SUBSCRIPTION_LIMIT = 10;
            const usersData = await adminService.getAllUsers();
            const currentUsers = usersData.users || [];
            const currentCount = currentUsers.length;
            const availableSlots = Math.max(0, SUBSCRIPTION_LIMIT - currentCount);

            // Create a Set of existing emails for quick lookup
            const existingEmails = new Set(currentUsers.map(u => u.email.toLowerCase()));

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

            validRows.forEach(row => {
                const emailLower = row.email.toLowerCase();
                if (existingEmails.has(emailLower)) {
                    duplicates.push({ ...row, skipReason: 'User already exists' });
                } else if (newEmailsSeen.has(emailLower)) {
                    // Duplicate within the CSV itself
                    duplicates.push({ ...row, skipReason: 'Duplicate in file' });
                } else {
                    newCandidates.push(row);
                    newEmailsSeen.add(emailLower);
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
            <div className="max-w-4xl mx-auto space-y-8">


                {/* Back Button */}
                <button
                    onClick={() => navigate('/employees')}
                    className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors mb-4"
                >
                    <ArrowLeft size={20} />
                    <span>Back to Employees</span>
                </button>

                {/* Progress Steps */}
                <div className="flex items-center justify-center mb-8">
                    <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'} transition-colors`}>1</div>
                        <span className={`ml-2 text-sm font-medium ${step >= 1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Upload</span>
                    </div>
                    <div className={`w-16 h-0.5 mx-4 ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                    <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'} transition-colors`}>2</div>
                        <span className={`ml-2 text-sm font-medium ${step >= 2 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Preview</span>
                    </div>
                    <div className={`w-16 h-0.5 mx-4 ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                    <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'} transition-colors`}>3</div>
                        <span className={`ml-2 text-sm font-medium ${step >= 3 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Done</span>
                    </div>
                </div>

                {/* Step 1: Upload Area */}
                {step === 1 && (
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-8 sm:p-12 shadow-sm border border-slate-200 dark:border-slate-700 text-center transition-colors duration-300">
                        <div
                            className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-10 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer group"
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
                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                <UploadCloud size={32} />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">Click to upload or drag and drop</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-6">CSV files only (Max 5MB)</p>
                            <button className="px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors">
                                Select File
                            </button>
                        </div>

                        <div
                            onClick={downloadSample}
                            className="mt-8 flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer">
                            <Download size={16} />
                            <span>Download Sample CSV Template</span>
                        </div>
                    </div>
                )}

                {/* Step 2: Preview */}
                {step === 2 && (
                    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                    <FileText className="text-indigo-600 dark:text-indigo-400" size={20} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">{file?.name}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{(file?.size / 1024).toFixed(2)} KB</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setStep(1); setFile(null); }}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Email</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4">Department</th>
                                        <th className="px-6 py-4">Validation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {previewData.slice(0, 50).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200">{row.name || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{row.email || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{row.desg}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{row.dept}</td>
                                            <td className="px-6 py-4">
                                                {row.status === 'Valid' ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">
                                                        <CheckCircle size={12} /> Valid
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full">
                                                        <AlertCircle size={12} /> Missing Data
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {previewData.length > 50 && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-4 text-center text-xs text-slate-500 italic">
                                                ... and {previewData.length - 50} more rows
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Import Summary Section */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">Import Data Summary</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h5 className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Departments Found ({uniqueDepts.length})</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueDepts.map((d, i) => (
                                            <span key={i} className="px-2 py-1 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300">
                                                {d}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h5 className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Designations Found ({uniqueDesgs.length})</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueDesgs.map((d, i) => (
                                            <span key={i} className="px-2 py-1 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300">
                                                {d}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 rounded-b-2xl bg-white dark:bg-dark-card">
                            <button
                                onClick={() => setStep(1)}
                                className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={isUploading}
                                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70"
                            >
                                {isUploading ? 'Uploading...' :
                                    <>
                                        <span>Upload Employees</span>
                                        <ChevronRight size={16} />
                                    </>
                                }
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Success */}
                {step === 3 && (
                    <div className="text-center py-12">
                        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Upload Processed!</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">
                            Processed: {uploadReport?.total_processed || 0} <br />
                            Success: {uploadReport?.success_count || 0} <br />
                            Skipped: {(uploadReport?.failure_count || 0) + (uploadReport?.skipped_rows?.length || 0) - (uploadReport?.failure_count || 0)}
                            {/* Adjusted total to match visual expectation, simple 'skipped' is clearer */}
                        </p>

                        {/* Skipped Items Table */}
                        {uploadReport?.skipped_rows?.length > 0 && (
                            <div className="mb-8 mx-auto max-w-2xl text-left px-6">
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">Skipped Items</h4>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <div className="overflow-x-auto max-h-64">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-3">Name</th>
                                                    <th className="px-4 py-3">Email</th>
                                                    <th className="px-4 py-3">Status / Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {uploadReport.skipped_rows.map((row, i) => (
                                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{row.name}</td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.email}</td>
                                                        <td className="px-4 py-3">
                                                            {row.skipReason === 'Subscription limit reached' ? (
                                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full whitespace-nowrap">
                                                                    <AlertCircle size={10} /> Limit Reached
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full whitespace-nowrap">
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
                            <div className="mb-8 max-w-lg mx-auto bg-red-50 dark:bg-red-900/10 p-4 rounded-lg text-left overflow-auto max-h-40">
                                <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">Other Errors:</h4>
                                <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-300 space-y-1">
                                    {uploadReport.errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-center gap-4">
                            <button
                                onClick={() => navigate('/employees')}
                                className="px-6 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                View Employee List
                            </button>
                            <button
                                onClick={() => { setStep(1); setFile(null); setUploadReport(null); }}
                                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-colors"
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
