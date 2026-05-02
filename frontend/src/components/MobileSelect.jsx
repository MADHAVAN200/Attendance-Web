import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const MobileSelect = ({ label, value, options, onChange, placeholder = "Select option" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        onChange(option);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1.5">{label}</label>}
            
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full h-11 px-4 bg-slate-50 dark:bg-black border ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-100 dark:border-slate-800'} rounded-2xl flex items-center justify-between cursor-pointer transition-all dark:text-white`}
            >
                <span className={`text-sm font-semibold ${value ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
                    {value || placeholder}
                </span>
                <ChevronDown size={18} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-black rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-[110] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                    <div className="p-1.5 max-h-60 overflow-y-auto">
                        {options.map((option) => (
                            <div
                                key={option}
                                onClick={() => handleSelect(option)}
                                className={`px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-semibold transition-colors ${
                                    value === option 
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                                        : 'text-slate-600 dark:text-slate-300 active:bg-slate-50 dark:active:bg-slate-900'
                                }`}
                            >
                                <span>{option}</span>
                                {value === option && <Check size={14} />}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileSelect;
