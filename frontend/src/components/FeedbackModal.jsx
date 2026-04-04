import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Bug, MessageSquare, Loader2, Image as ImageIcon, Trash2, CheckCircle } from 'lucide-react';
import api from '../services/api'; // Adjust path as needed
import { toast } from 'react-toastify';

const FeedbackModal = ({ isOpen, onClose }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('BUG'); // BUG or FEEDBACK
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        const validFiles = selectedFiles.filter(file => file.type.startsWith('image/'));

        if (validFiles.length !== selectedFiles.length) {
            toast.warning("Only image files are allowed.");
        }

        setFiles(prev => [...prev, ...validFiles]);
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) {
            toast.error("Title and description are required.");
            return;
        }

        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('type', type);

            files.forEach(file => {
                formData.append('files', file);
            });

            const res = await api.post('/feedback', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data.ok) {
                toast.success("Feedback submitted successfully!");
                // Reset form
                setTitle('');
                setDescription('');
                setFiles([]);
                setType('BUG');
                onClose();
            }
        } catch (error) {
            console.error("Feedback submit error:", error);
            toast.error(error.response?.data?.message || "Failed to submit feedback.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    />

                    {/* Sidebar */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#30363d]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#010409]/40">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 dark:text-[#f0f6fc] flex items-center gap-2 tracking-tight uppercase">
                                    {type === 'BUG' ? <Bug className="text-red-500" size={22} /> : <MessageSquare className="text-indigo-500" size={22} />}
                                    Support Lab
                                </h2>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted mt-0.5 tracking-[0.2em] uppercase">SYSTEM FEEDBACK & STABILITY</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-[#f0f6fc] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all active:scale-90"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body - Scrollable */}
                        <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar space-y-10">
                            
                            {/* Tab Switcher - Premium Segmented Control */}
                            <div className="relative">
                                <label className="block text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.15em] mb-4">Select Category</label>
                                <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-[#010409] border border-slate-200 dark:border-[#30363d] rounded-xl relative overflow-hidden">
                                    <button
                                        onClick={() => setType('BUG')}
                                        className={`relative z-10 py-3 text-xs font-black uppercase tracking-widest transition-colors ${type === 'BUG' ? 'text-white' : 'text-slate-500 dark:text-[#8b949e]'}`}
                                    >
                                        Bug Report
                                    </button>
                                    <button
                                        onClick={() => setType('FEEDBACK')}
                                        className={`relative z-10 py-3 text-xs font-black uppercase tracking-widest transition-colors ${type === 'FEEDBACK' ? 'text-white' : 'text-slate-500 dark:text-[#8b949e]'}`}
                                    >
                                        Feedback
                                    </button>
                                    
                                    {/* Animated Active Background */}
                                    <motion.div
                                        className={`absolute inset-y-1.5 left-1.5 w-[calc(50%-6px)] rounded-lg shadow-lg shadow-black/10 ${type === 'BUG' ? 'bg-red-600' : 'bg-indigo-600'}`}
                                        animate={{ x: type === 'BUG' ? '0%' : '100%' }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    />
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-8">
                                {/* Title Input */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-[#8b949e] uppercase tracking-[0.15em] mb-2.5">
                                        Title
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 dark:bg-[#010409] border border-slate-200 dark:border-[#30363d] rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-slate-800 dark:text-[#f0f6fc] text-sm font-bold transition-all placeholder:text-slate-400 dark:placeholder:text-[#484f58]"
                                        placeholder={type === 'BUG' ? "Describe the anomaly..." : "What's on your mind?"}
                                    />
                                </div>

                                {/* Description Textarea */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-[#8b949e] uppercase tracking-[0.15em] mb-2.5">
                                        Intelligence Report
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={6}
                                        className="w-full px-5 py-4 bg-slate-50 dark:bg-[#010409] border border-slate-200 dark:border-[#30363d] rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-slate-800 dark:text-[#c9d1d9] text-sm font-medium resize-none transition-all placeholder:text-slate-400 dark:placeholder:text-[#484f58]"
                                        placeholder="Provide as much detail as possible to help us analyze the situation..."
                                    />
                                </div>

                                {/* File Upload */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-[#8b949e] uppercase tracking-[0.15em] mb-3">
                                        Visual Evidence
                                    </label>
                                    <div className="group relative border-2 border-dashed border-slate-200 dark:border-[#30363d] rounded-[2rem] p-8 text-center transition-all hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10">
                                        <input
                                            type="file"
                                            id="sidebar-feedback-files"
                                            multiple
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                        <label htmlFor="sidebar-feedback-files" className="cursor-pointer flex flex-col items-center gap-4">
                                            <div className="w-14 h-14 bg-white dark:bg-[#0d1117] border border-slate-100 dark:border-[#30363d] rounded-2xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-indigo-500 group-hover:scale-110 transition-all duration-300">
                                                <Upload size={24} />
                                            </div>
                                            <div>
                                                <span className="block text-sm font-black text-slate-700 dark:text-[#f0f6fc] uppercase tracking-wide">
                                                    Drop or Click to Upload
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                                    Images up to 50MB
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Preview Grid */}
                                {files.length > 0 && (
                                    <div className="grid grid-cols-2 gap-4">
                                        {files.map((file, idx) => (
                                            <div key={idx} className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-[#30363d] aspect-video">
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    alt="preview"
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFile(idx)}
                                                        className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-transform active:scale-90"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Footer Actions */}
                        <div className="px-8 py-8 border-t border-slate-100 dark:border-[#30363d] bg-slate-50/50 dark:bg-[#010409]/60 backdrop-blur-md">
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-4 rounded-xl border border-slate-200 dark:border-[#30363d] text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-[#8b949e] hover:bg-white dark:hover:bg-[#161b22] transition-all active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className={`flex-[2] py-4 rounded-xl text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.97] flex items-center justify-center gap-3 ${loading ? 'opacity-70 bg-slate-400' : type === 'BUG' ? 'bg-red-600 shadow-red-600/20 hover:bg-red-700' : 'bg-indigo-600 shadow-indigo-600/20 hover:bg-indigo-700'}`}
                                >
                                    {loading ? (
                                        <Loader2 className="animate-spin" size={16} />
                                    ) : (
                                        <>
                                            <Bug className={type === 'BUG' ? 'animate-bounce' : 'hidden'} size={16} />
                                            Submit Report
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default FeedbackModal;
