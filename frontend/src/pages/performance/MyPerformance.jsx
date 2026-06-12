import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import MinimalSelect from '../../components/MinimalSelect';
import { useAuth } from '../../context/AuthContext';
import {
    Award,
    CheckCircle2,
    Clock,
    AlertCircle,
    Calendar,
    Sparkles,
    TrendingUp,
    Check,
    Info,
    ShieldCheck,
    Activity,
    Layers,
    User,
    FileText,
    ListTodo
} from 'lucide-react';
import { motion } from 'framer-motion';

// Mock cycles identical to the admin master definitions
const DEFAULT_CYCLES = [
    { id: 'cycle-1', name: 'Q1 2026 Performance Cycle', type: 'Quarterly', status: 'Evaluating', startDate: '2026-01-01', endDate: '2026-03-31' },
    { id: 'cycle-2', name: 'Q2 2026 Performance Cycle', type: 'Quarterly', status: 'Active', startDate: '2026-04-01', endDate: '2026-06-30' },
    { id: 'cycle-3', name: 'Mid-Year 2026 Appraisal', type: 'Half Yearly', status: 'Closed', startDate: '2026-01-01', endDate: '2026-06-30' },
    { id: 'cycle-4', name: 'Annual Review 2026', type: 'Yearly', status: 'Closed', startDate: '2026-01-01', endDate: '2026-12-31' }
];

// Helper to resolve fallback goals matching PerformanceViews.jsx logic
const getFallbackGoals = (empId) => {
    const variant = Number(empId) % 3;
    if (variant === 0) {
        return [
            { id: 'g-1', title: 'Complete Core Module Sprint Tasks', deadline: '2026-06-15', status: 'Completed', rating: 9, comments: 'Delivered all geofencing modules on time.' },
            { id: 'g-2', title: 'Achieve 95% Bug Resolution within SLA', deadline: '2026-06-20', status: 'Completed', rating: 8, comments: 'Resolved critical blocker tickets inside SLA limits.' },
            { id: 'g-3', title: 'Refactor Legacy Code and reduce smells', deadline: '2026-06-30', status: 'Completed', rating: 9, comments: 'Cleaned up CSS variables and reduced build sizes.' }
        ];
    } else if (variant === 1) {
        return [
            { id: 'g-1', title: 'Review and fix CSS scaling on tablet screens', deadline: '2026-06-15', status: 'Completed', rating: 7, comments: 'Fixed layout queries, but took extra time.' },
            { id: 'g-2', title: 'Conduct user feedback sessions for DAR logging', deadline: '2026-06-20', status: 'In-Progress', rating: 0, comments: '' },
            { id: 'g-3', title: 'Improve unit test coverage by 15%', deadline: '2026-06-30', status: 'Pending', rating: 0, comments: '' }
        ];
    } else {
        return [
            { id: 'g-1', title: 'Complete compliance training courses', deadline: '2026-06-10', status: 'Pending', rating: 0, comments: '' },
            { id: 'g-2', title: 'Update API endpoint error handling structures', deadline: '2026-06-25', status: 'In-Progress', rating: 0, comments: '' }
        ];
    }
};

// Helper to resolve fallback reviews matching PerformanceViews.jsx logic
const getFallbackReview = (empId) => {
    const variant = Number(empId) % 3;
    if (variant === 0) {
        return {
            selfAchievements: 'Delivered the attendance logging geofencing module ahead of the sprint timeline and verified all check-in edge cases. Mentored two interns.',
            selfChallenges: 'Faced layout scaling problems on specific tablet screen queries, but resolved them by refactoring index.css layout classes.',
            selfLearning: 'Learned HSL color palette designs, advanced Socket.io logic, and local storage state sync layouts.',
            managerComments: 'Consistently check-in on time. Excelled at frontend delivery. Suresh has shown superior engineering quality and was a great mentor this cycle.',
            managerRec: 'Promote to Senior Role',
            lastUpdated: '2026-06-05 11:10:00'
        };
    } else if (variant === 1) {
        return {
            selfAchievements: 'Resolved CSS scaling query errors and updated client pages. Set up active DAR notifications.',
            selfChallenges: 'Struggled with unit testing frameworks configuration due to legacy mock setup libraries.',
            selfLearning: 'Learned CSS flexbox grid layouts and Jest mock testing suites.',
            managerComments: 'Good work on UI modifications. Need to show more speed in test cases and complete pending goals.',
            managerRec: 'Retain with Standard Increment',
            lastUpdated: '2026-06-05 13:40:00'
        };
    } else {
        return {
            selfAchievements: 'Started refactoring error check routes in backend API systems.',
            selfChallenges: 'Faced frequent connectivity and local check-in deployment blockers.',
            selfLearning: 'Read express API routing documentation and basic node crash logs.',
            managerComments: 'Appraisal progress has been slow. Check-in records have also been irregular this quarter. Needs to show improvement in sprint velocity.',
            managerRec: 'Retain with Performance Improvement Plan',
            lastUpdated: '2026-06-05 16:20:00'
        };
    }
};

const COMPANY_DECORUM_GUIDELINES = [
    { key: 'attendance_time', title: 'Daily Attendance Punctuality', detail: 'Mark attendance before 09:30 AM daily to avoid late checks. 95%+ punctuality required.' },
    { key: 'dar_submissions', title: 'Daily Activity Reporting (DAR)', detail: 'Submit comprehensive task updates before 07:00 PM. Keep comments descriptive.' },
    { key: 'geofence_compliance', title: 'Geofenced Bound Integrity', detail: 'Clock in only from assigned geofenced coordinates. Off-site checks must have pre-approval.' },
    { key: 'task_sla_velocity', title: 'Milestone Execution SLA', detail: 'Ensure high quality of code commits and maintain task resolution SLAs.' },
    { key: 'collaboration_comms', title: 'Professional Communication', detail: 'Keep active presence on Slack, and respond to chatbot verification requests promptly.' },
    { key: 'professional_conduct', title: 'Decorum & Dress Standards', detail: 'Adhere to corporate professional guidelines and represent the brand respectfully.' }
];

const MyPerformance = () => {
    const { user } = useAuth();
    const empId = user?.user_id ?? user?.id ?? 101;
    const empName = user?.user_name ?? 'Employee';

    const [selectedCycleId, setSelectedCycleId] = useState('cycle-2');
    const [goals, setGoals] = useState([]);
    const [review, setReview] = useState(null);
    const [aiResult, setAiResult] = useState(null);

    // Fetch cycle list
    const [cycles] = useState(() => {
        const stored = localStorage.getItem('mano_performance_cycles');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error(e);
            }
        }
        return DEFAULT_CYCLES;
    });

    // Load data based on selected cycle and employee ID
    useEffect(() => {
        if (empId) {
            // 1. Load Goals
            const goalsKey = `mano_perf_goals_${empId}_${selectedCycleId}`;
            const storedGoals = localStorage.getItem(goalsKey);
            if (storedGoals) {
                try {
                    setGoals(JSON.parse(storedGoals));
                } catch (e) {
                    setGoals(getFallbackGoals(empId));
                }
            } else {
                setGoals(getFallbackGoals(empId));
            }

            // 2. Load Reviews
            const reviewsKey = `mano_perf_review_${empId}_${selectedCycleId}`;
            const storedReview = localStorage.getItem(reviewsKey);
            if (storedReview) {
                try {
                    setReview(JSON.parse(storedReview));
                } catch (e) {
                    setReview(getFallbackReview(empId));
                }
            } else {
                setReview(getFallbackReview(empId));
            }

            // 3. Load AI Analyzer results
            const aiKey = `mano_perf_ai_${empId}_${selectedCycleId}`;
            const storedAi = localStorage.getItem(aiKey);
            if (storedAi) {
                try {
                    setAiResult(JSON.parse(storedAi));
                } catch (e) {
                    setAiResult(null);
                }
            } else {
                setAiResult(null);
            }
        }
    }, [empId, selectedCycleId]);

    // Calculate arithmetic average score
    const ratedGoals = goals.filter(g => g.rating > 0);
    const totalRating = ratedGoals.reduce((sum, g) => sum + g.rating, 0);
    const averageScore = ratedGoals.length > 0 ? (totalRating / ratedGoals.length) : 0;
    const formattedAverageScore = Math.round(averageScore * 10) / 10;

    const getScoreBadgeDetails = (score) => {
        if (score >= 8.5) return { label: 'Outstanding', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' };
        if (score >= 7.5) return { label: 'Exceeds Expectations', color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30' };
        if (score >= 6.0) return { label: 'Meets Expectations', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' };
        if (score > 0) return { label: 'Underperforming', color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' };
        return { label: 'Pending Review', color: 'text-slate-500 bg-slate-500/10 border-slate-500/30' };
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Completed':
                return 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20';
            case 'In-Progress':
                return 'bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-400 border border-blue-500/20';
            case 'Deferred':
                return 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 border border-amber-500/20';
            default:
                return 'bg-slate-100 dark:bg-[#21262d] text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-github-dark-border';
        }
    };

    return (
        <DashboardLayout title="My Performance">
            <div className="space-y-6 text-xs select-none animate-fade-in-up">
                
                {/* Cycles selection & header banner */}
                <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                    <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-github-dark-text flex items-center gap-1.5">
                            <Award size={16} className="text-indigo-500" />
                            My Performance Evaluation Panel
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                            View assigned KPIs, targets, and official appraisals. This portal is view-only, managed directly by HR and Admins.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-500 font-bold uppercase font-sans">Appraisal Period:</span>
                        <MinimalSelect
                            value={selectedCycleId}
                            onChange={setSelectedCycleId}
                            options={cycles.map(c => ({ value: c.id, label: `${c.name} (${c.status})` }))}
                            triggerClassName="bg-slate-50 dark:bg-github-dark-subtle/50 border-slate-200 dark:border-github-dark-border text-[11px] text-slate-700 dark:text-github-dark-text font-bold"
                            size="sm"
                        />
                    </div>
                </div>

                {/* Score Dial & Metrics row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Dial gauge */}
                    <div className="p-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
                        <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500">Average Performance Rating</span>
                        
                        <div className="relative w-24 h-24 flex items-center justify-center my-3">
                            <svg className="absolute w-full h-full" viewBox="0 0 96 96">
                                <g transform="rotate(-90 48 48)">
                                    <circle 
                                        cx="48" 
                                        cy="48" 
                                        r="40" 
                                        className="stroke-slate-200 dark:stroke-slate-800 fill-none"
                                        strokeWidth="8"
                                    />
                                    <circle 
                                        cx="48" 
                                        cy="48" 
                                        r="40" 
                                        className="stroke-indigo-600 dark:stroke-indigo-400 fill-none transition-all duration-500"
                                        strokeWidth="8"
                                        strokeDasharray={251.2}
                                        strokeDashoffset={251.2 - (251.2 * (formattedAverageScore || 0)) / 10}
                                        strokeLinecap="round"
                                    />
                                </g>
                            </svg>
                            <div className="flex flex-col items-center justify-center">
                                <span className="text-2xl font-black text-slate-800 dark:text-[#f0f6fc]">
                                    {formattedAverageScore > 0 ? formattedAverageScore : '-'}
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono">OF 10</span>
                            </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getScoreBadgeDetails(formattedAverageScore).color}`}>
                            {getScoreBadgeDetails(formattedAverageScore).label}
                        </span>
                        
                        <span className="text-[9px] text-slate-400 font-mono mt-2">
                            {ratedGoals.length} of {goals.length} goals rated by manager
                        </span>
                    </div>

                    {/* Manager Comments & Recommendation Card */}
                    <div className="md:col-span-2 p-5 bg-slate-50/50 dark:bg-github-dark-subtle/10 border border-slate-200 dark:border-github-dark-border rounded-xl flex flex-col justify-between shadow-sm">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-100 dark:border-github-dark-border/40 pb-2">
                                <h4 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5">
                                    <User size={15} className="text-[#0969da]" />
                                    Manager Appraisal Summary
                                </h4>
                                {review?.lastUpdated && (
                                    <span className="text-[9px] text-slate-400 font-mono">Last updated: {review.lastUpdated}</span>
                                )}
                            </div>
                            
                            <div className="space-y-2">
                                <div className="space-y-1">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Official Cycle Recommendation</span>
                                    <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-bold inline-block border border-indigo-100/50 dark:border-indigo-950/30">
                                        {review?.managerRec || 'Evaluation In-Progress'}
                                    </span>
                                </div>
                                <div className="space-y-1 pt-1.5">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Overall Feedback & Comments</span>
                                    <p className="text-slate-700 dark:text-slate-350 leading-relaxed font-semibold italic bg-white dark:bg-dark-card p-3 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                        "{review?.managerComments || 'Manager evaluation feedback will appear here once submitted.'}"
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Split Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Column (8 cols): Goals list, Decorum expectations */}
                    <div className="lg:col-span-8 space-y-6">
                        
                        {/* Assigned Goals panel */}
                        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl p-4 space-y-4 shadow-sm">
                            <div className="border-b border-slate-100 dark:border-github-dark-border pb-3">
                                <h5 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5">
                                    <Layers size={14} className="text-[#0969da]" />
                                    Assigned Key Performance Indicators (KPIs)
                                </h5>
                                <p className="text-[10px] text-slate-400 mt-0.5">Established targets, execution requirements, and scorecards.</p>
                            </div>

                            <div className="space-y-4">
                                {goals.length > 0 ? (
                                    goals.map(goal => (
                                        <div key={goal.id} className="p-4 border border-slate-200 dark:border-github-dark-border rounded-xl bg-slate-50/50 dark:bg-github-dark-subtle/5 space-y-3">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="space-y-1.5 flex-1">
                                                    <span className="font-bold text-slate-800 dark:text-github-dark-text text-[13px] block">{goal.title}</span>
                                                    <div className="text-[10px] text-slate-400 flex items-center gap-3 font-mono">
                                                        <span>Due: {goal.deadline}</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1.5">
                                                            Status:
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getStatusBadgeClass(goal.status)}`}>
                                                                {goal.status}
                                                            </span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Rating and comments output */}
                                            {goal.rating > 0 ? (
                                                <div className="p-3 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl space-y-2">
                                                    <div className="flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-400 uppercase font-black tracking-wider block">Goal Score</span>
                                                         <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                                                            <Check size={11} className="stroke-[3]" />
                                                            {goal.rating} / 10
                                                        </span>
                                                    </div>
                                                    {goal.comments && (
                                                        <p className="text-slate-600 dark:text-slate-350 leading-relaxed font-semibold italic text-[11px]">
                                                            "{goal.comments}"
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="p-2 bg-slate-100/40 dark:bg-github-dark-subtle/5 border border-dashed border-slate-200 dark:border-github-dark-border rounded-lg text-slate-400 italic text-[10px]">
                                                    Rating and feed comments pending manager feedback cycle.
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p className="py-12 text-center text-slate-400 italic">No goals assigned to this appraisal cycle yet.</p>
                                )}
                            </div>
                        </div>

                        {/* Decorum expectations card */}
                        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl p-4 space-y-4 shadow-sm">
                            <div className="border-b border-slate-100 dark:border-github-dark-border pb-3">
                                <h5 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5">
                                    <ListTodo size={14} className="text-[#0969da]" />
                                    Company Decorum & Expectations Guidelines
                                </h5>
                                <p className="text-[10px] text-slate-400 mt-0.5">Critical guidelines that employees must follow for corporate discipline.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {COMPANY_DECORUM_GUIDELINES.map((guide) => (
                                    <div key={guide.key} className="p-3 bg-slate-50/50 dark:bg-github-dark-subtle/5 border border-slate-200 dark:border-github-dark-border rounded-xl space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#0969da]" />
                                            <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{guide.title}</span>
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[10px] pl-3.5">
                                            {guide.detail}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Right Column (4 cols): AI performance dashboard, Self-Review Summary */}
                    <div className="lg:col-span-4 space-y-6">
                        
                        {/* AI performance analyzer summary */}
                        {aiResult ? (
                            <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-github-dark-border rounded-xl p-4 space-y-4 shadow-sm">
                                <div className="border-b border-slate-100 dark:border-github-dark-border pb-3 flex justify-between items-center">
                                    <h5 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5">
                                        <Sparkles size={14} className="text-indigo-550 dark:text-indigo-400" />
                                        AI Performance Audit
                                    </h5>
                                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded text-[9px] font-bold border border-indigo-550/20">
                                        Verified
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    {/* Score indices */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="border border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/5 p-2.5 rounded-lg">
                                            <span className="text-[8px] text-slate-400 block font-bold uppercase tracking-wider">Punctuality</span>
                                            <span className="text-sm font-black text-slate-800 dark:text-[#f0f6fc]">{aiResult.attendance.punctuality}%</span>
                                        </div>
                                        <div className="border border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/5 p-2.5 rounded-lg">
                                            <span className="text-[8px] text-slate-400 block font-bold uppercase tracking-wider">Goal SLA Rate</span>
                                            <span className="text-sm font-black text-slate-800 dark:text-[#f0f6fc]">{aiResult.kpis.completionRate}%</span>
                                        </div>
                                    </div>

                                    {/* AI comments summary */}
                                    <div className="space-y-1">
                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Auditor Evaluation Summary</span>
                                        <p className="text-slate-600 dark:text-slate-350 leading-relaxed font-semibold bg-slate-50/50 dark:bg-github-dark-subtle/10 p-3 rounded-lg">
                                            {aiResult.summary}
                                        </p>
                                    </div>

                                    {/* Strengths & Weaknesses */}
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <span className="font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 uppercase tracking-wider text-[9px]">
                                                <CheckCircle2 size={11} /> Strengths
                                            </span>
                                            <ul className="text-slate-600 dark:text-slate-400 space-y-1 text-[10px] pl-1 font-semibold">
                                                {aiResult.strengths.slice(0, 2).map((str, i) => (
                                                    <li key={i} className="flex gap-1 items-start">
                                                        <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                                                        <span>{str}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="space-y-1.5">
                                            <span className="font-black text-amber-600 dark:text-amber-400 flex items-center gap-1 uppercase tracking-wider text-[9px]">
                                                <AlertCircle size={11} /> Improvements
                                            </span>
                                            <ul className="text-slate-600 dark:text-slate-400 space-y-1 text-[10px] pl-1 font-semibold">
                                                {aiResult.improvements.slice(0, 2).map((imp, i) => (
                                                    <li key={i} className="flex gap-1 items-start">
                                                        <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                                                        <span>{imp}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="border border-dashed border-slate-200 dark:border-github-dark-border p-5 rounded-xl bg-slate-50/20 dark:bg-github-dark-subtle/5 text-center text-slate-400">
                                <Sparkles size={24} className="mx-auto text-indigo-400 mb-2 opacity-50" />
                                <span className="block font-bold">AI appraisal report card not compiled</span>
                                <p className="text-[10px] mt-1">Once your manager runs the performance compiler, the AI report card metrics will compile here.</p>
                            </div>
                        )}

                        {/* Read-Only Self-Review details card */}
                        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl p-4 space-y-4 shadow-sm">
                            <div className="border-b border-slate-100 dark:border-github-dark-border pb-3">
                                <h5 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5">
                                    <FileText size={14} className="text-[#0969da]" />
                                    My Self-Appraisal Record
                                </h5>
                                <p className="text-[10px] text-slate-400 mt-0.5">Your achievements and obstacles registered for this cycle.</p>
                            </div>

                            <div className="space-y-3.5">
                                <div className="space-y-1">
                                    <span className="font-bold text-slate-400 text-[9px] uppercase tracking-wider block">Key Achievements</span>
                                    <div className="text-slate-600 dark:text-slate-350 leading-relaxed font-semibold bg-slate-50 dark:bg-github-dark-subtle/10 p-2.5 rounded-lg">
                                        {review?.selfAchievements ? `"${review.selfAchievements}"` : 'No achievements reported.'}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <span className="font-bold text-slate-400 text-[9px] uppercase tracking-wider block">Obstacles & Challenges</span>
                                    <div className="text-slate-600 dark:text-slate-350 leading-relaxed font-semibold bg-slate-50 dark:bg-github-dark-subtle/10 p-2.5 rounded-lg">
                                        {review?.selfChallenges ? `"${review.selfChallenges}"` : 'No obstacles reported.'}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <span className="font-bold text-slate-400 text-[9px] uppercase tracking-wider block">Competencies & Learnings</span>
                                    <div className="text-slate-600 dark:text-slate-350 leading-relaxed font-semibold bg-slate-50 dark:bg-github-dark-subtle/10 p-2.5 rounded-lg">
                                        {review?.selfLearning ? `"${review.selfLearning}"` : 'No competencies reported.'}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                </div>

            </div>
        </DashboardLayout>
    );
};

export default MyPerformance;
