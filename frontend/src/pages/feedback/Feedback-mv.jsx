import React, { useState } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { Bug, MessageSquare, Paperclip, Camera, X, FileText, Trash2, Loader2, Info, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';

const Feedback = () => {
    const [activeTab, setActiveTab] = useState('bug'); // 'bug' | 'feedback'
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [files, setFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles(prev => [...prev, ...selectedFiles]);
    };

    const removeFile = (idx) => {
        setFiles(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
        if (!title.trim() || !description.trim()) {
            toast.error('Intelligence Report: Title and Description are required.');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('type', activeTab.toUpperCase());
            
            files.forEach(file => {
                formData.append('files', file);
            });

            await api.post('/feedback', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success(`${activeTab === 'bug' ? 'Anomaly' : 'Feedback'} reported successfully.`);
            setTitle('');
            setDescription('');
            setFiles([]);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Transmission Failed: Could not submit report.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <MobileDashboardLayout title="Support Lab">
            <div className="min-h-screen bg-slate-50 dark:bg-black pb-24 transition-colors duration-300">
                {/* Header Metadata */}
                <div className="px-5 pt-4 pb-6 bg-slate-50 dark:bg-black border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${activeTab === 'bug' ? 'bg-red-500' : 'bg-indigo-500'}`} />
                        <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.2em]">System Monitoring Active</span>
                    </div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                        {activeTab === 'bug' ? 'Anomaly Report' : 'User Insight'}
                    </h2>
                </div>

                <div className="px-5 py-6 space-y-8">
                    {/* Standardized Tab Switcher */}
                    <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1.5 flex rounded-2xl backdrop-blur-md border border-white/20 dark:border-white/5">
                        <button
                            onClick={() => setActiveTab('bug')}
                            className={`flex-1 py-2.5 text-[11px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'bug' 
                                    ? 'bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 transform scale-[1.02]' 
                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <Bug size={14} className={activeTab === 'bug' ? 'text-red-500' : 'text-slate-400'} />
                            <span>Bug Report</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('feedback')}
                            className={`flex-1 py-2.5 text-[11px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'feedback' 
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 transform scale-[1.02]' 
                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <MessageSquare size={14} className={activeTab === 'feedback' ? 'text-indigo-500' : 'text-slate-400'} />
                            <span>Feedback</span>
                        </button>
                    </div>

                    {/* Report Form - High Density */}
                    <div className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest px-1">Report Subject</label>
                            <input 
                                type="text" 
                                placeholder={activeTab === 'bug' ? "Identify the anomaly..." : "Subject of your feedback..."}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 text-xs font-bold text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest px-1">Detailed Logs</label>
                            <textarea 
                                placeholder={activeTab === 'bug' ? "Describe the sequence of events and current behavior..." : "Share your operational insights and suggestions..."}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={5}
                                className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 text-xs font-semibold text-slate-700 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm resize-none"
                            />
                        </div>

                        {/* Multi-File Upload Section */}
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest px-1 flex items-center justify-between">
                                Visual Evidence
                                <span className="text-[8px] opacity-60 italic">{files.length} attached</span>
                            </label>
                            
                            <div className="relative group">
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                />
                                <div className="w-full flex items-center justify-between bg-white dark:bg-black border border-dashed border-slate-300 dark:border-slate-700 rounded-xl px-4 py-4 text-xs font-bold text-slate-400 dark:text-github-dark-muted group-active:scale-[0.98] transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center text-indigo-500">
                                            <Paperclip size={16} />
                                        </div>
                                        <span>Attach Evidence</span>
                                    </div>
                                    <Camera size={16} className="text-slate-300" />
                                </div>
                            </div>

                            {/* File List */}
                            {files.length > 0 && (
                                <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {files.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500">
                                                    <FileText size={14} />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-700 dark:text-white truncate max-w-[200px]">{file.name}</span>
                                            </div>
                                            <button 
                                                onClick={() => removeFile(idx)}
                                                className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Submit Action */}
                        <div className="pt-4">
                            <button 
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className={`w-full py-4 rounded-xl text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.97] flex items-center justify-center gap-3 ${
                                    isSubmitting 
                                        ? 'opacity-70 bg-slate-400' 
                                        : activeTab === 'bug' 
                                            ? 'bg-red-600 shadow-red-600/20 hover:bg-red-700' 
                                            : 'bg-indigo-600 shadow-indigo-600/20 hover:bg-indigo-700'
                                }`}
                            >
                                {isSubmitting ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <>
                                        {activeTab === 'bug' ? <Bug size={16} className="animate-pulse" /> : <CheckCircle size={16} />}
                                        <span>Transmit Report</span>
                                    </>
                                )}
                            </button>
                            <div className="mt-4 p-3 bg-slate-100 dark:bg-white/5 rounded-xl flex items-start gap-2.5">
                                <Info size={12} className="text-slate-400 mt-0.5" />
                                <p className="text-[9px] font-medium text-slate-400 dark:text-github-dark-muted leading-relaxed">
                                    Our specialists will analyze your intelligence report and apply the necessary fixes within 24-48 business hours. Thank you for your cooperation.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MobileDashboardLayout>
    );
};

export default Feedback;
