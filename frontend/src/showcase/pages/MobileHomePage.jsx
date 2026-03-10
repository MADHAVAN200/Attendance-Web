import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Clock, Radar, BarChart3, Calendar, MessageSquare, Sparkles, BrainCircuit, MapPin, Settings2, Cpu, ShieldAlert, ArrowRightLeft, TimerReset, Activity, Table2, ShieldCheck, Scale, HeartHandshake } from "lucide-react";
import { siteData } from "../siteData";

const featureIcons = [Clock, Radar, BarChart3, Calendar, MessageSquare, Sparkles, BrainCircuit, MapPin];

const workflowIcons = { Settings2, MapPin, Cpu, ShieldAlert, BrainCircuit, ArrowRightLeft };
const statIcons = { TimerReset, Activity, Table2, ShieldCheck, Scale, HeartHandshake };

const Section = ({ id, children, title, subtitle }) => (
    <section id={id} className="py-6 px-6 sm:px-10 relative">
        <div className="max-w-md sm:max-w-2xl lg:max-w-4xl mx-auto">
            {(title || subtitle) && (
                <div className="mb-5 text-center">
                    {title && <h2 className="text-3xl font-bold text-white mb-2">{title}</h2>}
                    {subtitle && <p className="text-gray-400 text-sm leading-relaxed px-4">{subtitle}</p>}
                </div>
            )}
            {children}
        </div>
    </section>
);

export default function MobileHomePage() {
    return (
        <div className="site-bg min-h-screen overflow-x-hidden">

            {/* Hero Section */}
            <section className="pt-24 pb-6 px-6 sm:px-10 text-center flex flex-col items-center justify-center min-h-[70vh]">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-6 bg-blue-600/10 border border-blue-500/20 px-4 py-1.5 rounded-full"
                >
                    <span className="text-blue-400 text-[10px] font-bold tracking-widest uppercase">Next-Gen Attendance</span>
                </motion.div>

                <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-6">
                    Empowering your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">Workforce</span>
                </h1>

                <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 px-4 max-w-lg">
                    The AI-driven platform for smart attendance, productivity analytics, and workforce governance.
                </p>

                <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3 px-4">
                    <a href="#features" className="bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-4 sm:px-10 rounded-2xl shadow-xl active:scale-95 transition-all text-center">
                        Explore Features
                    </a>
                    <Link to="/login" className="bg-white/5 border border-white/10 text-white font-semibold py-4 sm:px-10 rounded-2xl active:bg-white/10 transition-all text-center">
                        Manager Login
                    </Link>
                </div>
            </section>

            {/* Core Features - Highly Compact */}
            <Section id="features" title="Core Solutions" subtitle="Everything you need to manage time and productivity sync effortlessly.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {siteData.highlights.map((feature, idx) => {
                        const Icon = featureIcons[idx] || Clock;
                        return (
                        <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-5 active:bg-white/10 transition-all">
                            <div className="flex items-center gap-4 mb-3">
                                <div className="p-2.5 bg-blue-500/10 rounded-xl">
                                    <Icon size={22} className="text-blue-400" />
                                </div>
                                <h3 className="text-white font-bold text-lg">{feature.title}</h3>
                            </div>
                            <p className="text-gray-400 text-xs leading-relaxed mb-3">{feature.body}</p>
                            <div className="flex flex-wrap gap-2">
                                {feature.bullets.map((bullet, bidx) => (
                                    <span key={bidx} className="text-[10px] bg-white/5 text-gray-300 px-2.5 py-1 rounded-lg border border-white/5 italic">
                                        • {bullet}
                                    </span>
                                ))}
                            </div>
                        </div>
                        );
                    })}
                </div>
            </Section>

            {/* How It Works — Stepped Timeline */}
            <Section id="workflow" title="How It Works" subtitle="From onboarding to payroll export in six seamless steps.">
                <div className="relative pl-8">
                    {/* Vertical line */}
                    <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-blue-500/60 via-blue-400/30 to-transparent" />

                    <div className="flex flex-col gap-6">
                        {siteData.homeData.workflowSteps.map((step, idx) => {
                            const Icon = workflowIcons[step.icon] || Clock;
                            return (
                                <div key={idx} className="relative">
                                    {/* Node dot */}
                                    <div className="absolute -left-8 top-1 w-6 h-6 rounded-full bg-blue-500/10 border-2 border-blue-500 flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.4)]">
                                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                                    </div>

                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-1.5 bg-blue-500/10 rounded-lg">
                                                <Icon size={16} className="text-blue-400" />
                                            </div>
                                            <span className="text-[10px] text-blue-400/70 font-bold uppercase tracking-widest">Step {idx + 1}</span>
                                        </div>
                                        <h3 className="text-white font-bold text-sm mb-1">{step.title}</h3>
                                        <p className="text-gray-400 text-xs leading-relaxed">{step.body}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Section>

            {/* Impact Stats — Compact Grid */}
            <Section id="impact" title="Real Results" subtitle="Measurable outcomes from teams already using MANO.">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {siteData.homeData.impactStats.map((stat, idx) => {
                        const Icon = statIcons[stat.icon] || Activity;
                        return (
                            <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center text-center">
                                <div className="p-2 bg-blue-500/10 rounded-xl mb-3">
                                    <Icon size={18} className="text-blue-400" />
                                </div>
                                <p className="text-white font-bold text-sm leading-tight mb-1">{stat.value}</p>
                                <p className="text-blue-400 text-[10px] font-semibold uppercase tracking-wider mb-2">{stat.title}</p>
                                <p className="text-gray-500 text-[10px] leading-relaxed">{stat.note}</p>
                            </div>
                        );
                    })}
                </div>
            </Section>

            {/* Pricing Summary */}
            <Section id="pricing" title="Plans Built For Every Stage" subtitle="Start lean, grow confidently, and scale with policy controls tailored for your workforce model.">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {siteData.pageContent['/pricing'].plans.map((plan, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                            <h3 className="text-white font-bold text-lg mb-1">{plan.name}</h3>
                            <p className="text-blue-400 text-[11px] font-semibold uppercase tracking-wider mb-2">{plan.audience}</p>
                            <p className="text-gray-400 text-xs leading-relaxed mb-4">{plan.priceNote}</p>
                            <ul className="space-y-2.5">
                                {plan.bullets.map((item, bidx) => (
                                    <li key={bidx} className="text-xs text-gray-300 flex items-start gap-2.5">
                                        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </Section>

            {/* Contact Bridge */}
            <Section id="contact" title="Get in Touch" subtitle="Our team is ready to help you optimize your workforce governance.">
                <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 text-center relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-2xl font-bold text-white mb-4">Ready to start?</h3>
                        <p className="text-gray-400 text-sm mb-6">Join hundreds of companies using MANO to transform their operations.</p>
                        <a href="mailto:business@mano.co.in" className="inline-block bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg active:scale-95 transition-all text-sm">
                            Contact Sales
                        </a>
                    </div>
                </div>
            </Section>
        </div>
    );
}
