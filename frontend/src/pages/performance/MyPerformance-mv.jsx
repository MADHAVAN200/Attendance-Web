import React, { useState, useEffect } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import MobileSelect from '../../components/MobileSelect';
import { useAuth } from '../../context/AuthContext';
import {
    Award,
    CheckCircle2,
    Clock,
    AlertCircle,
    Calendar,
    Sparkles,
    Check,
    Info,
    User,
    FileText,
    ListTodo,
    Layers
} from 'lucide-react';

// Mock cycles identical to the admin master definitions
const DEFAULT_CYCLES = [
    { id: 'cycle-1', name: 'Q1 2026 Appraisal', type: 'Quarterly', status: 'Evaluating', startDate: '2026-01-01', endDate: '2026-03-31' },
    { id: 'cycle-2', name: 'Q2 2026 Appraisal', type: 'Quarterly', status: 'Active', startDate: '2026-04-01', endDate: '2026-06-30' },
    { id: 'cycle-3', name: 'Mid-Year 2026', type: 'Half Yearly', status: 'Closed', startDate: '2026-01-01', endDate: '2026-06-30' },
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
    { key: 'attendance_time', title: 'Attendance Punctuality', detail: 'Mark attendance before 09:30 AM.' },
    { key: 'dar_submissions', title: 'Daily Report (DAR)', detail: 'Submit comprehensive updates before 07:00 PM.' },
    { key: 'geofence_compliance', title: 'Geofence Bound Compliance', detail: 'Clock in only from assigned coordinates.' },
    { key: 'task_sla_velocity', title: 'Milestone Execution SLA', detail: 'Maintain task resolution and quality SLAs.' },
    { key: 'collaboration_comms', title: 'Professional Comms', detail: 'Keep active presence on Slack/collaboration.' },
    { key: 'professional_conduct', title: 'Corporate Decorum', detail: 'Adhere to corporate professional guidelines.' }
];

const MyPerformanceMobile = () => {
    const { user } = useAuth();
    const empId = user?.user_id ?? user?.id ?? 101;

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
        if (score >= 7.5) return { label: 'Exceeds Expects', color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30' };
        if (score >= 6.0) return { label: 'Meets Expects', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' };
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
        <MobileDashboardLayout title="Performance" hideHeader={false}>
            <div className="space-y-4 pb-6 select-none text-[11px]">
                
                {/* 1. Header & Appraisal Selector */}
                <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border p-3.5 rounded-2xl shadow-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Award size={16} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-github-dark-text text-xs leading-none">Evaluation Panel</h4>
                            <span className="text-[10px] text-slate-400 mt-1 block">View-only guidelines & feedback</span>
                        </div>
                    </div>
                    
                    <div className="w-40 shrink-0 select-none">
                        <MobileSelect
                            value={cycles.find(c => c.id === selectedCycleId)?.name || ''}
                            options={cycles.map(c => c.name)}
                            onChange={(val) => {
                                const found = cycles.find(c => c.name === val);
                                if (found) setSelectedCycleId(found.id);
                            }}
                            placeholder="Select cycle"
                        />
                    </div>
                </div>

                {/* 2. Overall KPI Score & Recommendation */}
                <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-2xl p-4 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-1 items-start">
                            <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Appraisal Index</span>
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${getScoreBadgeDetails(formattedAverageScore).color}`}>
                                {getScoreBadgeDetails(formattedAverageScore).label}
                            </span>
                        </div>

                        {/* Dial Circle inside a compact container */}
                        <div className="relative w-14 h-14 flex items-center justify-center">
                            <svg className="absolute w-full h-full" viewBox="0 0 48 48">
                                <g transform="rotate(-90 24 24)">
                                    <circle 
                                        cx="24" 
                                        cy="24" 
                                        r="20" 
                                        className="stroke-slate-200 dark:stroke-slate-800 fill-none"
                                        strokeWidth="4"
                                    />
                                    <circle 
                                        cx="24" 
                                        cy="24" 
                                        r="20" 
                                        className="stroke-indigo-600 dark:stroke-indigo-400 fill-none transition-all duration-500"
                                        strokeWidth="4"
                                        strokeDasharray={125.6}
                                        strokeDashoffset={125.6 - (125.6 * (formattedAverageScore || 0)) / 10}
                                        strokeLinecap="round"
                                    />
                                </g>
                            </svg>
                            <div className="flex flex-col items-center justify-center">
                                <span className="text-sm font-black text-slate-800 dark:text-[#f0f6fc]">
                                    {formattedAverageScore > 0 ? formattedAverageScore : '-'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-github-dark-border/40 pt-3 space-y-2.5">
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 font-bold uppercase tracking-wider">Official Recommendation</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                {review?.managerRec || 'Evaluation Pending'}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Manager Feedback</span>
                            <p className="text-slate-600 dark:text-slate-350 leading-relaxed font-semibold italic bg-slate-50 dark:bg-github-dark-subtle/20 p-2.5 rounded-xl border border-slate-100 dark:border-github-dark-border/50">
                                "{review?.managerComments || 'No manager comments registered.'}"
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. Assigned KPIs (Goals) */}
                <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-2xl p-4 shadow-sm space-y-3">
                    <h5 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5 text-xs">
                        <Layers size={14} className="text-[#0969da]" />
                        Assigned KPIs & Targets
                    </h5>

                    <div className="space-y-3">
                        {goals.length > 0 ? (
                            goals.map(goal => (
                                <div key={goal.id} className="p-3 border border-slate-200 dark:border-github-dark-border rounded-xl bg-slate-50/50 dark:bg-github-dark-subtle/10 space-y-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <span className="font-bold text-slate-800 dark:text-github-dark-text text-xs leading-snug">{goal.title}</span>
                                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase shrink-0 ${getStatusBadgeClass(goal.status)}`}>
                                            {goal.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
                                        <span>Due: {goal.deadline}</span>
                                        {goal.rating > 0 && (
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">Score: {goal.rating}/10</span>
                                        )}
                                    </div>
                                    {goal.rating > 0 && goal.comments && (
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic bg-white dark:bg-dark-card p-2 rounded-lg border border-slate-100 dark:border-github-dark-border mt-1 font-semibold leading-relaxed">
                                            "{goal.comments}"
                                        </p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="py-6 text-center text-slate-400 italic font-medium">No KPIs assigned for this cycle.</p>
                        )}
                    </div>
                </div>

                {/* 4. AI Appraisal Performance Summary */}
                {aiResult && (
                    <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-2xl p-4 shadow-sm space-y-3">
                        <h5 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5 text-xs">
                            <Sparkles size={14} className="text-indigo-550 dark:text-indigo-400" />
                            AI Performance Auditor
                        </h5>

                        <div className="space-y-3">
                            {/* Score badges */}
                            <div className="flex justify-between items-center text-[10px] bg-slate-50 dark:bg-github-dark-subtle/20 p-2.5 rounded-xl border border-slate-100 dark:border-github-dark-border/40 font-semibold">
                                <span className="text-slate-500">Punctuality: <strong className="text-slate-750 dark:text-slate-200">{aiResult.attendance.punctuality}%</strong></span>
                                <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                                <span className="text-slate-500">Goal SLA: <strong className="text-slate-750 dark:text-slate-200">{aiResult.kpis.completionRate}%</strong></span>
                            </div>

                            <p className="text-[10px] text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-github-dark-subtle/10 p-2.5 rounded-xl leading-relaxed font-semibold italic">
                                "{aiResult.summary}"
                            </p>

                            <div className="space-y-2 pt-1">
                                <div className="space-y-1">
                                    <span className="font-black text-emerald-600 dark:text-emerald-400 uppercase text-[9px] flex items-center gap-1">
                                        <CheckCircle2 size={10} /> Strengths
                                    </span>
                                    <ul className="text-slate-600 dark:text-slate-400 space-y-1 text-[10px] pl-1 font-semibold">
                                        {aiResult.strengths.slice(0, 2).map((str, i) => (
                                            <li key={i} className="flex gap-1 items-start leading-snug">
                                                <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                                                <span>{str}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. Company Decorum Guidelines */}
                <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-2xl p-4 shadow-sm space-y-3">
                    <h5 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5 text-xs">
                        <ListTodo size={14} className="text-[#0969da]" />
                        Company Decorum Rules
                    </h5>

                    <div className="space-y-2.5">
                        {COMPANY_DECORUM_GUIDELINES.map((guide) => (
                            <div key={guide.key} className="flex gap-2 items-start bg-slate-50/50 dark:bg-github-dark-subtle/5 p-2 rounded-xl border border-slate-100 dark:border-github-dark-border/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#0969da] shrink-0 mt-1.5" />
                                <div>
                                    <span className="font-bold text-slate-700 dark:text-slate-200 block text-[10px] leading-tight">{guide.title}</span>
                                    <p className="text-slate-500 dark:text-slate-400 text-[9.5px] mt-0.5 leading-normal">
                                        {guide.detail}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 6. Static Self-Appraisal summary */}
                <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-2xl p-4 shadow-sm space-y-3">
                    <h5 className="font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5 text-xs">
                        <FileText size={14} className="text-[#0969da]" />
                        Self-Appraisal Record
                    </h5>

                    <div className="space-y-3 text-[10px]">
                        <div className="space-y-1">
                            <span className="text-slate-400 font-bold uppercase tracking-wider block text-[8px]">Key Achievements</span>
                            <div className="text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-github-dark-subtle/20 p-2.5 rounded-xl font-semibold leading-relaxed">
                                {review?.selfAchievements ? `"${review.selfAchievements}"` : 'No achievements reported.'}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-slate-400 font-bold uppercase tracking-wider block text-[8px]">Obstacles & Challenges</span>
                            <div className="text-slate-655 dark:text-slate-350 bg-slate-50 dark:bg-github-dark-subtle/20 p-2.5 rounded-xl font-semibold leading-relaxed">
                                {review?.selfChallenges ? `"${review.selfChallenges}"` : 'No obstacles reported.'}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </MobileDashboardLayout>
    );
};

export default MyPerformanceMobile;
