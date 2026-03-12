import React, { useState } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { Bug, MessageSquare, Paperclip, Camera } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';

const Feedback = () => {
    const [activeTab, setActiveTab] = useState('bug'); // 'bug' | 'feedback'
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!title.trim() || !description.trim()) {
            toast.error('Please fill in both title and description');
            return;
        }

        setIsSubmitting(true);
        // Simulate API call to match screenshot intent
        try {
            await new Promise(resolve => setTimeout(resolve, 800));
            toast.success(`${activeTab === 'bug' ? 'Bug Report' : 'Feedback'} submitted successfully!`);
            setTitle('');
            setDescription('');
        } catch (error) {
            toast.error('Failed to submit report.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <MobileDashboardLayout title="Feedback & Support">
            <div className="px-4 pb-6 pt-2 space-y-6 max-w-md mx-auto">
                
                {/* Tabs */}
                <div className="flex p-1 bg-slate-50 dark:bg-[#1a2332] rounded-[16px] border border-slate-200 dark:border-slate-800/50">
                    <button
                        onClick={() => setActiveTab('bug')}
                        className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-[12px] text-[13px] font-bold transition-all ${
                            activeTab === 'bug' 
                                ? 'bg-white dark:bg-[#2a364b] text-indigo-500 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-700/50' 
                                : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent'
                        }`}
                    >
                        <Bug size={16} /> Bug Report
                    </button>
                    <button
                        onClick={() => setActiveTab('feedback')}
                        className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-[12px] text-[13px] font-bold transition-all ${
                            activeTab === 'feedback' 
                                ? 'bg-white dark:bg-[#2a364b] text-indigo-500 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-700/50' 
                                : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent'
                        }`}
                    >
                        <MessageSquare size={16} /> Feedback
                    </button>
                </div>

                {/* Form Elements */}
                <div className="space-y-5">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                            {activeTab === 'bug' ? 'Bug Title' : 'Feedback Title'}
                        </label>
                        <input 
                            type="text" 
                            placeholder={activeTab === 'bug' ? "e.g., Error on Leave Page" : "e.g., Suggestion for new feature"}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-[#1a2332] border border-slate-200 dark:border-slate-800/50 rounded-2xl px-4 py-4 text-[13px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                            {activeTab === 'bug' ? 'Bug Description' : 'Feedback Description'}
                        </label>
                        <textarea 
                            placeholder={activeTab === 'bug' ? "Describe the issue and steps to reproduce..." : "Share your thoughts and ideas with us..."}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            className="w-full bg-slate-50 dark:bg-[#1a2332] border border-slate-200 dark:border-slate-800/50 rounded-2xl px-4 py-4 text-[13px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                            Screenshots (Optional)
                        </label>
                        <button className="w-full flex items-center justify-between bg-slate-50 dark:bg-[#1a2332] border border-slate-200 dark:border-slate-800/50 rounded-2xl px-4 py-4 text-[13px] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group">
                            <div className="flex items-center gap-3">
                                <Paperclip size={18} className="text-indigo-500 dark:text-indigo-400" />
                                <span>Attach Screenshots (Optional)</span>
                            </div>
                            <Camera size={18} className="group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                        </button>
                    </div>

                    <button 
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full mt-4 py-4 bg-indigo-500 hover:bg-indigo-600 text-white text-[13px] font-bold rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Submitting...' : `Submit ${activeTab === 'bug' ? 'Bug Report' : 'Feedback'}`}
                    </button>
                </div>

            </div>
        </MobileDashboardLayout>
    );
};

export default Feedback;
