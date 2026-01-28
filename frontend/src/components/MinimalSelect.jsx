import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { createPortal } from 'react-dom';

const MinimalSelect = ({
    options,
    value,
    onChange,
    placeholder = "Select...",
    icon: Icon,
    searchable = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);

    // Toggle Dropdown & Calculate Position
    const toggleDropdown = () => {
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 8,
                left: rect.left,
                width: rect.width
            });
        }
        setIsOpen(!isOpen);
        setSearch("");
    };

    // Close on Outside Click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                triggerRef.current &&
                !triggerRef.current.contains(event.target) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            window.addEventListener("scroll", () => setIsOpen(false)); // Close on scroll
            window.addEventListener("resize", () => setIsOpen(false));
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", () => setIsOpen(false));
            window.removeEventListener("resize", () => setIsOpen(false));
        };
    }, [isOpen]);

    const filteredOptions = searchable
        ? options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()))
        : options;

    return (
        <>
            <button
                ref={triggerRef}
                onClick={toggleDropdown}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${isOpen
                        ? 'bg-slate-50 dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
                        : 'bg-white dark:bg-dark-card border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
            >
                {Icon && (
                    <span className={`opacity-70 group-hover:opacity-100 transition-opacity ${isOpen ? 'text-indigo-500' : 'text-slate-400'
                        }`}>
                        <Icon size={16} />
                    </span>
                )}
                <span className="truncate max-w-[120px]">{value || placeholder}</span>
                <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 opacity-50 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`}
                />
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed z-[9999] bg-white dark:bg-dark-card border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-100 overflow-hidden flex flex-col"
                    style={{
                        top: position.top,
                        left: position.left,
                        minWidth: Math.max(200, position.width),
                        maxHeight: '300px'
                    }}
                >
                    {searchable && (
                        <div className="p-2 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    autoFocus
                                    type="text"
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all dark:text-white"
                                    placeholder="Search..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="overflow-y-auto p-1 custom-scrollbar flex-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        onChange(opt);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between group transition-colors ${value === opt
                                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <span className="truncate">{opt}</span>
                                    {value === opt && <Check size={14} className="text-indigo-500" />}
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-slate-400 italic">
                                No results found.
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default MinimalSelect;
