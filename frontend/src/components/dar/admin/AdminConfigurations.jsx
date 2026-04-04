
import React, { useState, useEffect } from 'react';
import { Settings, Save, Plus, Trash2, X } from 'lucide-react';
import api from '../../../services/api';
import { toast } from 'react-toastify';

const AdminConfigurations = ({ onClose }) => {
    // --- SETTINGS STATE ---
    const [categories, setCategories] = useState([]);
    const [newCat, setNewCat] = useState("");
    const [bufferTime, setBufferTime] = useState(30);
    const [loadingSettings, setLoadingSettings] = useState(false);

    // Fetch Settings
    const fetchSettings = async () => {
        setLoadingSettings(true);
        try {
            const res = await api.get('/dar/settings/list');
            if (res.data.ok) {
                setCategories(res.data.data.categories);
                setBufferTime(res.data.data.buffer_minutes);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load settings");
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleSaveSettings = async () => {
        try {
            await api.post('/dar/settings/update', {
                buffer_minutes: parseInt(bufferTime),
                categories
            });
            toast.success("Settings updated successfully!");
        } catch (err) {
            toast.error("Failed to update settings");
        }
    };

    const handleAddCategory = async () => {
        if (newCat.trim()) {
            const updated = [...categories, newCat.trim()];
            setCategories(updated);
            setNewCat("");
            try {
                await api.post('/dar/settings/update', {
                    buffer_minutes: parseInt(bufferTime),
                    categories: updated
                });
                toast.success("Category added");
            } catch (err) {
                toast.error("Failed to add category");
            }
        }
    };

    const handleRemoveCategory = async (cat) => {
        const updated = categories.filter(c => c !== cat);
        setCategories(updated);
        try {
            await api.post('/dar/settings/update', {
                buffer_minutes: parseInt(bufferTime),
                categories: updated
            });
            toast.success("Category removed");
        } catch (err) {
            toast.error("Failed to remove category");
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-github-dark-subtle overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-github-dark-border">
                <div className="flex items-center gap-3">
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    )}
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                            <Settings size={20} className="text-indigo-600" />
                            Configurations
                        </h2>
                    </div>
                </div>
                <button
                    onClick={handleSaveSettings}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all text-sm"
                >
                    <Save size={16} />
                    Save
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 flex flex-col gap-8">

                    {/* Section 1: Categories */}
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text mb-2">Activity Categories</h3>
                        <p className="text-sm text-slate-500 mb-6">Manage standard activities available for employees to select properly.</p>

                        <div className="flex gap-3 mb-6">
                            <input
                                type="text"
                                value={newCat}
                                onChange={(e) => setNewCat(e.target.value)}
                                placeholder="Enter new category..."
                                className="flex-1 px-5 py-3 rounded-xl border border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                            />
                            <button
                                type="button"
                                onClick={handleAddCategory}
                                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-md shadow-indigo-100 dark:shadow-none"
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {categories.map((cat, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-github-dark-subtle border border-slate-100 dark:border-github-dark-border rounded-xl group hover:border-indigo-200 dark:hover:border-indigo-900 transition-all shadow-sm">
                                    <span className="font-semibold text-slate-700 dark:text-github-dark-text truncate pr-2" title={cat}>{cat}</span>
                                    <button
                                        onClick={() => handleRemoveCategory(cat)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                            {categories.length === 0 && (
                                <div className="col-span-full flex flex-col items-center justify-center p-10 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-dashed border-slate-200 dark:border-github-dark-border text-slate-400 italic">
                                    <Settings size={32} className="mb-2 opacity-20" />
                                    No categories defined. Add one above.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full h-[1px] bg-slate-100 dark:bg-slate-700"></div>

                    {/* Section 2: Buffer Time */}
                    <div className="flex items-start justify-between pb-10">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text mb-2">Grace Period Buffer</h3>
                            <p className="text-sm text-slate-500 max-w-md">
                                Time in minutes allowed after the current time for 'Execution Mode' tasks.
                                Tasks logged after this buffer will be marked as future planning.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-github-dark-subtle p-2 rounded-xl border border-slate-200 dark:border-github-dark-border">
                            <button
                                onClick={() => setBufferTime(Math.max(0, bufferTime - 5))}
                                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all font-bold text-lg"
                            >-</button>
                            <div className="w-16 text-center font-bold text-lg text-slate-700 dark:text-github-dark-text">
                                {bufferTime}m
                            </div>
                            <button
                                onClick={() => setBufferTime(bufferTime + 5)}
                                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all font-bold text-lg"
                            >+</button>
                        </div>
                    </div>

                </div>
            </div>
    );
};

export default AdminConfigurations;
