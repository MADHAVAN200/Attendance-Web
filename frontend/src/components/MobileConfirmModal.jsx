import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, CheckCircle, Info, X } from 'lucide-react';

const MobileConfirmModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    type = 'info', // 'info', 'warning', 'delete', 'success'
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isSubmitting = false
}) => {
    if (!isOpen) return null;

    const icons = {
        info: <Info className="text-indigo-500" size={24} />,
        warning: <AlertTriangle className="text-amber-500" size={24} />,
        delete: <Trash2 className="text-rose-500" size={24} />,
        success: <CheckCircle className="text-emerald-500" size={24} />
    };

    const buttonColors = {
        info: 'bg-indigo-600 shadow-indigo-200 dark:shadow-none',
        warning: 'bg-amber-500 shadow-amber-200 dark:shadow-none',
        delete: 'bg-rose-600 shadow-rose-200 dark:shadow-none',
        success: 'bg-emerald-600 shadow-emerald-200 dark:shadow-none'
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative z-10 w-full max-w-[320px] bg-white dark:bg-black rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 text-center">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center animate-bounce">
                            {icons[type]}
                        </div>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                        {title}
                    </h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="flex p-4 gap-3 bg-slate-50 dark:bg-slate-900/50">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 py-3.5 px-4 rounded-2xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className={`flex-1 py-3.5 px-4 rounded-2xl text-sm font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${buttonColors[type]}`}
                    >
                        {isSubmitting ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default MobileConfirmModal;
