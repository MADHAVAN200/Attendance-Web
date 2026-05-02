import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    AlertTriangle, 
    Trash2, 
    CheckCircle, 
    Info, 
    X, 
    UserCheck, 
    UserX, 
    RotateCcw,
    AlertCircle
} from 'lucide-react';

const ConfirmationModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    type = 'info', // 'danger', 'warning', 'success', 'info'
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isSubmitting = false 
}) => {
    // Prevent scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const config = {
        danger: {
            icon: <Trash2 size={32} strokeWidth={2.5} />,
            color: 'text-rose-500',
            bg: 'bg-rose-500/10',
            btn: 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20',
            accent: 'rose'
        },
        warning: {
            icon: <AlertTriangle size={32} strokeWidth={2.5} />,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            btn: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20',
            accent: 'amber'
        },
        success: {
            icon: <CheckCircle size={32} strokeWidth={2.5} />,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20',
            accent: 'emerald'
        },
        info: {
            icon: <Info size={32} strokeWidth={2.5} />,
            color: 'text-indigo-500',
            bg: 'bg-indigo-500/10',
            btn: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20',
            accent: 'indigo'
        }
    };

    const theme = config[type] || config.info;

    const modalVariants = {
        hidden: { 
            opacity: 0, 
            y: typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : 40,
            scale: typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 0.9
        },
        visible: { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: { type: 'spring', damping: 25, stiffness: 400 }
        },
        exit: { 
            opacity: 0, 
            y: typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : 40,
            scale: typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 0.9,
            transition: { duration: 0.2, ease: "easeIn" }
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center sm:items-center justify-center sm:p-4 overflow-hidden">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Container */}
            <motion.div
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative w-[90%] max-w-[380px] sm:w-full mx-auto bottom-0 sm:bottom-auto fixed sm:relative bg-black rounded-[2.5rem] sm:rounded-[3rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden"
            >
                {/* Drag handle for mobile */}
                <div className="sm:hidden w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-4 mb-2" />

                <div className="p-8 sm:p-10 text-center">
                    {/* Animated Icon Container */}
                    <div className="relative mb-8 flex justify-center">
                        <motion.div 
                            className={`w-20 h-20 ${theme.bg} rounded-3xl flex items-center justify-center ${theme.color} relative z-10`}
                            initial={{ rotate: -20, scale: 0, opacity: 0 }}
                            animate={{ rotate: 0, scale: 1, opacity: 1 }}
                            transition={{ 
                                type: 'spring', 
                                damping: 12, 
                                stiffness: 200,
                                delay: 0.15
                            }}
                        >
                            <motion.div
                                animate={{ 
                                    scale: [1, 1.04, 1],
                                    rotate: [0, 1, -1, 0],
                                }}
                                transition={{ 
                                    duration: 3, 
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                            >
                                {theme.icon}
                            </motion.div>
                            
                            {/* Decorative glow */}
                            <div className={`absolute inset-0 bg-current opacity-20 blur-2xl rounded-full`} />
                        </motion.div>
                        
                        {/* Outer pulsing ring */}
                        <motion.div 
                            className={`absolute inset-0 m-auto w-20 h-20 rounded-3xl border-2 border-current opacity-20`}
                            initial={{ scale: 1, opacity: 0 }}
                            animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                            transition={{ 
                                duration: 2.5, 
                                repeat: Infinity,
                                ease: "easeOut",
                                delay: 0.5
                            }}
                        />
                    </div>

                    <h3 className="text-xl font-black text-white tracking-tight mb-3 uppercase leading-none">
                        {title}
                    </h3>
                    <p className="text-sm font-medium text-slate-400 leading-relaxed px-4 opacity-80">
                        {message}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex p-6 sm:p-8 gap-4 bg-white/[0.02] border-t border-white/5">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 py-4 px-6 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white hover:bg-white/5 transition-all active:scale-95"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className={`flex-1 py-4 px-6 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2 ${theme.btn}`}
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </motion.div>
        </div>,
        document.body
    );
};

export default ConfirmationModal;
