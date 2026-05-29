import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Sparkles, Send, Loader2, X, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { internalChatbotService } from '../services/internalChatbotService';
import { useAuth } from '../context/AuthContext';

function cleanAssistantText(rawText) {
    return String(rawText || '').trim();
}

function formatLineContent(text) {
    if (!text) return '';
    
    // Regexp to match attendance.mano.co.in URLs with optional paths and query parameters
    const urlRegex = /(https?:\/\/)?(www\.)?attendance\.mano\.co\.in(\/[a-zA-Z0-9\-_/]+)?(\?[a-zA-Z0-9\-_&%=]+)?/gi;
    
    const parts = [];
    let lastIndex = 0;
    let match;
    
    // Reset regex index
    urlRegex.lastIndex = 0;
    
    while ((match = urlRegex.exec(text)) !== null) {
        const matchIndex = match.index;
        
        // Add preceding text
        if (matchIndex > lastIndex) {
            parts.push(text.substring(lastIndex, matchIndex));
        }
        
        const fullUrl = match[0];
        const routePath = match[3] || '/dashboard';
        const queryParams = match[4] || '';
        const targetPath = routePath + queryParams;
        
        parts.push(
            <Link
                key={`link-${matchIndex}`}
                to={targetPath}
                className="text-indigo-600 dark:text-indigo-400 font-extrabold underline hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
            >
                {fullUrl}
            </Link>
        );
        
        lastIndex = urlRegex.lastIndex;
    }
    
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
}

function renderAssistantLine(line, idx) {
    const cleaned = String(line || '').trim();
    if (!cleaned) {
        return <div key={`line-${idx}`} className="h-2" aria-hidden="true" />;
    }

    // Bold tags formatting inside line
    const numberedWithDescription = cleaned.match(/^(\d+[.)]\s*)([^:]+):\s*(.+)$/);
    if (numberedWithDescription) {
        return (
            <p key={`line-${idx}`} className="mb-1.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>{`${numberedWithDescription[1]}${numberedWithDescription[2]}:`}</strong>{' '}
                {formatLineContent(numberedWithDescription[3])}
            </p>
        );
    }

    const labeledLine = cleaned.match(/^([A-Za-z][A-Za-z\s&()/-]{2,}):\s*(.+)$/);
    if (labeledLine) {
        return (
            <p key={`line-${idx}`} className="mb-1.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>{`${labeledLine[1]}:`}</strong>{' '}
                {formatLineContent(labeledLine[2])}
            </p>
        );
    }

    if (cleaned.startsWith('- ') || cleaned.startsWith('* ')) {
        return (
            <li key={`line-${idx}`} className="ml-4 list-disc text-sm mb-1.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                {formatLineContent(cleaned.substring(2))}
            </li>
        );
    }

    return <p key={`line-${idx}`} className="text-sm mb-1.5 text-slate-700 dark:text-slate-300 leading-relaxed">{formatLineContent(cleaned)}</p>;
}

function renderMessageText(message) {
    if (message.role !== 'assistant') {
        return <p className="text-sm leading-relaxed">{message.text}</p>;
    }

    const lines = String(message.text || '').split('\n');
    return <div className="space-y-0.5">{lines.map((line, idx) => renderAssistantLine(line, idx))}</div>;
}

const getSuggestionsForRoute = (pathname, tabInfo, userRole) => {
    const cleanPath = '/' + pathname.split('/').filter(Boolean)[0] || '/dashboard';
    
    // 1. Attendance Page (with Tab and SubTab support)
    if (cleanPath === '/attendance') {
        const activeTab = tabInfo?.tab || 'mark_attendance';
        const subTab = tabInfo?.subTab || 'history';

        if (activeTab === 'mark_attendance') {
            return [
                "What is the shift policy today?",
                "How do I clock in/out?",
                "What happens if I clock in outside the geofence?",
                "Why am I seeing a 'Non-Working Day' message?",
                "How does facial verification work during clock-in?"
            ];
        }
        if (activeTab === 'my_attendance') {
            if (subTab === 'history') {
                return [
                    "How do I download my monthly attendance report?",
                    "What do the different status labels (Present, Late, Half Day) mean?",
                    "How do I request a correction for a past date?",
                    "What is the deadline to submit an attendance correction?",
                    "Why does a past date show as 'Missed Punch'?"
                ];
            }
            if (subTab === 'analytics') {
                return [
                    "What does the 'Hours Worked' chart represent?",
                    "How is my average daily work duration calculated?",
                    "Where can I see a breakdown of my Present vs Late days?",
                    "Can I view attendance analytics for past months?",
                    "How is Overtime tracked in the monthly summary?"
                ];
            }
            if (subTab === 'correction' || subTab === 'corrections') {
                return [
                    "How do I submit an attendance correction request?",
                    "What is the difference between 'Correction' and 'Missed Punch'?",
                    "Who approves my attendance correction requests?",
                    "How can I track the status of my submitted corrections?",
                    "Can I edit or cancel a pending correction request?"
                ];
            }
        }
    }

    // 2. Main Dashboard (Role-aware)
    if (cleanPath === '/dashboard') {
        if (userRole === 'super_admin') {
            return [
                "What metrics are tracked on the Super Admin Dashboard?",
                "How do I see the total number of registered organizations?",
                "Where can I view active system subscription revenue?",
                "How do I monitor active users across the whole platform?",
                "Where do I check system security alert levels?"
            ];
        }
        if (userRole === 'admin' || userRole === 'hr') {
            return [
                "What metrics are shown on the admin dashboard?",
                "How do I view today's active employees?",
                "Where can I monitor real-time check-ins?",
                "What does the live activity feed display?",
                "How do I view pending leave and correction requests?"
            ];
        }
        // Employee default
        return [
            "What is the employee dashboard summary?",
            "How do I view my shift details for this week?",
            "Where can I find my active feed or notifications?",
            "How do I quickly access leave application from here?",
            "What are the quick actions available on the dashboard?"
        ];
    }

    // 3. Holidays Management & Apply Leave
    if (cleanPath === '/holidays') {
        const activeTab = tabInfo?.tab || 'holidays';
        if (activeTab === 'leave_application' || activeTab === 'my_leaves' || activeTab === 'requests') {
            return [
                "How do I apply for a new leave?",
                "How do I check my remaining leave balances?",
                "What are the different types of leaves available?",
                "How long does it take for a leave request to be approved?",
                "Can I attach documents/medical certificates to my leave application?"
            ];
        }
        return [
            "How do I view the company holiday list for this year?",
            "How does a holiday affect my attendance status?",
            "How can admins add new holidays to the calendar?",
            "Can I bulk import holidays using an Excel file?",
            "What is the difference between leaves and holidays?"
        ];
    }

    if (cleanPath === '/apply-leave') {
        return [
            "How do I apply for a new leave?",
            "How do I check my remaining leave balances?",
            "What are the different types of leaves available?",
            "How long does it take for a leave request to be approved?",
            "Can I attach documents/medical certificates to my leave application?"
        ];
    }

    // 4. Daily Activity Report (DAR)
    if (cleanPath === '/daily-activity') {
        return [
            "How do I add or log a new daily activity?",
            "What are AI DAR insights and how do they work?",
            "Can I edit or delete a previously logged activity?",
            "Is there a limit to how many activities I can log daily?",
            "How do managers review my daily activity reports?"
        ];
    }

    // 5. Geofencing Zones
    if (cleanPath === '/geofencing') {
        return [
            "How do I create a new geofence zone?",
            "What is the radius setting for geofencing?",
            "How do I assign a geofence zone to an employee?",
            "What happens if an employee clocks in outside their assigned zone?",
            "Can I set up multiple active geofence zones?"
        ];
    }

    // 6. Shifts & Policies
    if (cleanPath === '/shift-management') {
        return [
            "How do I create a new work shift policy?",
            "How do I assign shifts to employees?",
            "What is a flexible shift and how is it configured?",
            "How do shift grace periods (late arrival rules) work?",
            "Can I set up multi-day or overnight shifts?"
        ];
    }

    // 7. Employee Directory
    if (cleanPath === '/employees') {
        return [
            "How do I add a new employee to the organization?",
            "How do I bulk import employees using a template?",
            "How can I edit an existing employee's details or role?",
            "Where do I assign shifts and geofences to employees?",
            "How do I deactivate or delete an employee account?"
        ];
    }

    // 8. Reports Generator
    if (cleanPath === '/reports') {
        const activeTab = tabInfo?.tab || 'preview';
        if (activeTab === 'history') {
            return [
                "Where can I find and download past exported reports?",
                "How do I delete or archive old reports from history?",
                "How long are exported reports retained in the history?",
                "Can I download multiple reports from history at once?",
                "Who has access to the generated report history?"
            ];
        }
        return [
            "What types of reports can I generate?",
            "How do I export attendance reports to Excel or PDF?",
            "How do I preview report data before exporting?",
            "How do I filter reports by department or date range?",
            "What does the 'Detailed Daily Logs' report include?"
        ];
    }

    // 9. User Profile
    if (cleanPath === '/profile') {
        return [
            "How do I update my profile details?",
            "How do I change my profile photo or password?",
            "Where can I view my shift policy and manager details?",
            "Can I enable two-factor authentication (2FA)?",
            "Who should I contact if my profile details are incorrect?"
        ];
    }

    // 10. Super Admin Pages
    if (cleanPath === '/organizations') {
        return [
            "How do I register a new organization on the platform?",
            "How do I approve or modify an organization's subscription?",
            "Can I suspend or deactivate an organization's account?",
            "How do I filter organizations by region or size?",
            "Where can I download the list of all registered organizations?"
        ];
    }

    if (cleanPath === '/super-admin') {
        const subSec = pathname.split('/')[2];
        if (subSec === 'alerts') {
            return [
                "What triggers a platform security alert?",
                "How do I review high-priority security notifications?",
                "Where can I check failed login attempts or IP locks?",
                "How do I export security audit logs?",
                "Can I configure automatic alert thresholds?"
            ];
        }
        if (subSec === 'feedback') {
            return [
                "How do I view feedback submitted by users?",
                "Can I filter user feedback by category or rating?",
                "How do I respond or assign a support ticket for feedback?",
                "Where can I see general user satisfaction (CSAT) metrics?",
                "How do I export user feedback reports?"
            ];
        }
        if (subSec === 'logs') {
            const activeTab = tabInfo?.tab || 'activity';
            if (activeTab === 'errors') {
                return [
                    "How do I identify critical system or API error logs?",
                    "Where can I find error stack traces for server crashes?",
                    "How do I clear or archive resolved system error logs?",
                    "How do I set up automated email notifications for fatal errors?",
                    "Can I filter system errors by component or impact level?"
                ];
            }
            return [
                "What platform activities are captured in the system logs?",
                "How do I search the logs for a specific organization's activity?",
                "How do I filter activity logs by user or date range?",
                "Can I export database transaction activity?",
                "What is the automatic data retention policy for activity logs?"
            ];
        }
    }

    // Default suggestions
    return [
        "What is the difference between Attendance and Corrections?",
        "What is the difference between Holidays and Leaves?",
        "What is the Active Feed on the dashboard?",
        "How do I request an Attendance Correction?",
        "How do I apply for a leave?"
    ];
};

export default function InternalChatbotWidget() {
    const location = useLocation();
    
    // Completely remove the AI Assistant chatbot from the Chat page
    if (location.pathname.includes('/collaboration')) {
        return null;
    }

    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const { user } = useAuth();

    const currentRole = user?.user_type || 'employee';

    // Track active tab and subtab info dynamically
    const [activeTabInfo, setActiveTabInfo] = useState({ tab: '', subTab: '' });

    // Reset activeTabInfo when the main route path changes
    useEffect(() => {
        setActiveTabInfo({ tab: '', subTab: '' });
    }, [location.pathname]);

    // Listen to tab changes within pages
    useEffect(() => {
        const handleTabChange = (event) => {
            if (event?.detail) {
                setActiveTabInfo(event.detail);
            }
        };
        window.addEventListener('mano-active-tab', handleTabChange);
        return () => window.removeEventListener('mano-active-tab', handleTabChange);
    }, []);

    // Fetch route suggestions dynamically based on the current active page, active tab, and role
    const suggestions = useMemo(() => 
        getSuggestionsForRoute(location.pathname, activeTabInfo, currentRole), 
        [location.pathname, activeTabInfo, currentRole]
    );

    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            text: `Hi ${user?.user_name || 'there'}. I'm your Mano AI Copilot. Ask me anything about the page features, policies, or how to navigate the software!`,
        },
    ]);

    const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);
    const sendMessage = async (textToSend) => {
        const question = String(textToSend || input).trim();
        if (!question || loading) return;

        setInput('');
        setLoading(true);
        setMessages((prev) => [...prev, { role: 'user', text: question }]);

        try {
            const response = await internalChatbotService.ask(question, location.pathname);
            const rawAnswer = response?.data?.answer || 'I am sorry, I am unable to answer your query right now.';
            const answer = cleanAssistantText(rawAnswer);

            setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
        } catch (error) {
            setMessages((prev) => [...prev, { role: 'assistant', text: error.message || 'Something went wrong while connecting to the assistant.' }]);
        } finally {
            setLoading(false);
        }
    };

    const onKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="font-poppins">
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop overlay identical to Notification sidebar */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 999998,
                                width: '100vw',
                                height: '100vh',
                                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                backdropFilter: 'blur(4px)'
                            }}
                        />

                        {/* Sidebar Drawer Container */}
                        <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{
                                position: 'fixed',
                                top: 0,
                                right: 0,
                                height: '100vh',
                                width: '100%',
                                zIndex: 999999
                            }}
                            className="max-w-md bg-white dark:bg-dark-card shadow-2xl flex flex-col border-l border-slate-100 dark:border-github-dark-border"
                        >
                            {/* Drawer Header */}
                            <div className="p-6 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                                        <Sparkles size={20} className="animate-pulse" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">Mano AI Copilot</h2>
                                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold capitalize mt-0.5">
                                            {currentRole.replace('_', ' ')} Help Mode
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Chat Messages Log */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/10 dark:bg-github-dark-bg/5 no-scrollbar">
                                {messages.map((message, idx) => (
                                    <div
                                        key={`${message.role}-${idx}`}
                                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm border ${
                                                message.role === 'user'
                                                    ? 'bg-indigo-600 border-indigo-600 text-white rounded-br-none'
                                                    : 'bg-slate-100 dark:bg-github-dark-subtle/50 border-slate-200/50 dark:border-github-dark-border/80 text-slate-800 dark:text-github-dark-text rounded-bl-none'
                                            }`}
                                        >
                                            {renderMessageText(message)}
                                        </div>
                                    </div>
                                ))}
                                {loading && (
                                    <div className="flex justify-start">
                                        <div className="max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm border bg-slate-100 dark:bg-github-dark-subtle/50 border-slate-200/50 dark:border-github-dark-border/80 text-slate-550 dark:text-github-dark-muted rounded-bl-none flex items-center gap-2.5">
                                            <Loader2 size={14} className="animate-spin text-indigo-500" />
                                            <span className="text-xs">MANO AI is thinking...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Suggested Questions based on active page route */}
                            <div className="px-6 py-4 bg-slate-50/40 dark:bg-github-dark-bg/20 border-t border-slate-100 dark:border-github-dark-border">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <HelpCircle size={12} className="text-slate-400" /> Suggested Questions
                                </p>
                                <div className="flex flex-col gap-1.5 pb-1 max-h-[140px] overflow-y-auto no-scrollbar">
                                    {suggestions.map((q, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => sendMessage(q)}
                                            disabled={loading}
                                            className="text-left text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30 transition-all hover:translate-x-1 active:scale-98 disabled:opacity-50 flex items-center justify-between group"
                                        >
                                            <span>{q}</span>
                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 dark:text-indigo-500 font-bold ml-2">→</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Form Input Area */}
                            <div className="p-4 border-t border-slate-100 dark:border-github-dark-border bg-white dark:bg-dark-card flex items-center gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={onKeyDown}
                                    disabled={loading}
                                    placeholder="Ask about attendance, corrections, leaves..."
                                    className="flex-1 bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-200 dark:border-github-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:focus:ring-indigo-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => sendMessage()}
                                    disabled={!canSend}
                                    className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 dark:disabled:bg-github-dark-border text-white disabled:text-slate-400 dark:disabled:text-slate-600 flex items-center justify-center transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-95"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Toggle Trigger Button */}
            {!isOpen && (
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    style={{
                        position: 'fixed',
                        right: '24px',
                        bottom: '24px',
                        zIndex: 999999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0
                    }}
                    className="copilot-toggle-btn w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl hover:shadow-indigo-600/30 transition-all duration-300 hover:scale-105 active:scale-95 group relative"
                    aria-label="Open Mano AI Copilot"
                >
                    <Sparkles size={20} className="group-hover:rotate-12 transition-transform duration-300 flex-shrink-0" />
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-github-dark-bg flex items-center justify-center">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                    </span>
                </button>
            )}
        </div>
    );
}
