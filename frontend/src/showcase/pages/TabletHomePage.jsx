import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
    Clock, Radar, BarChart3, Calendar, MessageSquare, Sparkles, BrainCircuit, MapPin,
    Settings2, Cpu, ShieldAlert, ArrowRightLeft, TimerReset, Activity, Table2,
    ShieldCheck, Scale, HeartHandshake, CheckCircle2
} from "lucide-react";
import { siteData, homeData } from "../siteData";
import useDeviceType from "../hooks/useDeviceType";

const featureIcons = [Clock, Radar, BarChart3, Calendar, MessageSquare, Sparkles, BrainCircuit, MapPin];
const workflowIcons = { Settings2, MapPin, Cpu, ShieldAlert, BrainCircuit, ArrowRightLeft };
const statIcons = { TimerReset, Activity, Table2, ShieldCheck, Scale, HeartHandshake };

const Section = ({ id, children, title, subtitle }) => (
    <section id={id} className="py-10 px-8 relative">
        <div className="max-w-5xl mx-auto">
            {(title || subtitle) && (
                <div className="mb-8 text-center">
                    {title && <h2 className="text-3xl font-bold text-white mb-2">{title}</h2>}
                    {subtitle && <p className="text-gray-400 text-base leading-relaxed max-w-2xl mx-auto">{subtitle}</p>}
                </div>
            )}
            {children}
        </div>
    </section>
);

export default function TabletHomePage() {
    const { isPortrait } = useDeviceType();

    return (
        <div className="site-bg min-h-screen overflow-x-hidden">

            {/* ─── Hero Section ─── */}
            <section className={`pt-28 px-8 ${isPortrait ? "pb-6" : "pb-10 text-center min-h-[60vh] flex flex-col items-center justify-center"}`}>
                {isPortrait ? (
                    /* Portrait: side-by-side text + image */
                    <div className="max-w-5xl mx-auto flex items-center gap-8">
                        <div className="flex-1">
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="mb-4 bg-blue-600/10 border border-blue-500/20 px-4 py-1.5 rounded-full inline-block"
                            >
                                <span className="text-blue-400 text-xs font-bold tracking-widest uppercase">Next-Gen Attendance</span>
                            </motion.div>

                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.1 }}
                                className="text-4xl font-extrabold text-white leading-tight mb-4"
                            >
                                Empowering your{" "}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
                                    Workforce
                                </span>
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-gray-400 text-sm leading-relaxed mb-6"
                            >
                                The AI-driven platform for smart attendance, productivity analytics, and workforce governance.
                            </motion.p>

                            <div className="flex flex-row gap-3">
                                <a href="#features" className="bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-3 px-8 rounded-2xl shadow-xl hover:shadow-blue-500/25 active:scale-95 transition-all text-sm">
                                    Explore Features
                                </a>
                                <Link to="/login" className="bg-white/5 border border-white/10 text-white font-semibold py-3 px-8 rounded-2xl hover:bg-white/10 active:scale-95 transition-all text-sm">
                                    Manager Login
                                </Link>
                            </div>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.7, delay: 0.2 }}
                            className="flex-1 max-w-[45%]"
                        >
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/5">
                                <img src={homeData.heroImage} alt="Platform Dashboard" className="w-full h-auto block" />
                            </div>
                        </motion.div>
                    </div>
                ) : (
                    /* Landscape: centered text + image below */
                    <>
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="mb-5 bg-blue-600/10 border border-blue-500/20 px-5 py-2 rounded-full"
                        >
                            <span className="text-blue-400 text-xs font-bold tracking-widest uppercase">Next-Gen Attendance</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="text-5xl font-extrabold text-white leading-tight mb-5 max-w-3xl"
                        >
                            Empowering your{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
                                Workforce
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-gray-400 text-base leading-relaxed mb-8 max-w-xl"
                        >
                            The AI-driven platform for smart attendance, productivity analytics, and workforce governance.
                        </motion.p>

                        <div className="flex flex-row gap-4 mb-10">
                            <a href="#features" className="bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-3.5 px-10 rounded-2xl shadow-xl hover:shadow-blue-500/25 active:scale-95 transition-all text-center">
                                Explore Features
                            </a>
                            <Link to="/login" className="bg-white/5 border border-white/10 text-white font-semibold py-3.5 px-10 rounded-2xl hover:bg-white/10 active:scale-95 transition-all text-center">
                                Manager Login
                            </Link>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, delay: 0.3 }}
                            className="max-w-3xl w-full"
                        >
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/5">
                                <img src={homeData.heroImage} alt="Platform Dashboard" className="w-full h-auto block" />
                            </div>
                        </motion.div>
                    </>
                )}
            </section>

            {/* ─── Core Features ─── */}
            <Section id="features" title="Core Solutions" subtitle="Everything you need to manage time and productivity sync effortlessly.">
                {isPortrait ? (
                    /* Portrait: alternating image + text cards for a richer look */
                    <div className="flex flex-col gap-6">
                        {siteData.highlights.map((feature, idx) => {
                            const Icon = featureIcons[idx] || Clock;
                            const isEven = idx % 2 === 0;
                            return (
                                <div key={idx} className={`flex items-stretch gap-5 ${isEven ? "" : "flex-row-reverse"}`}>
                                    {/* Image side */}
                                    <div className="w-[42%] shrink-0 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                        <img src={feature.image} alt={feature.title} className="w-full h-full object-cover" />
                                    </div>
                                    {/* Text side */}
                                    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] hover:border-blue-500/20 transition-all group flex flex-col justify-center">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="p-2.5 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                                                <Icon size={22} className="text-blue-400" />
                                            </div>
                                            <h3 className="text-white font-bold text-base">{feature.title}</h3>
                                        </div>
                                        <p className="text-gray-400 text-sm leading-relaxed mb-3">{feature.body}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {feature.bullets.map((bullet, bidx) => (
                                                <span key={bidx} className="text-[11px] bg-white/5 text-gray-300 px-2.5 py-1 rounded-lg border border-white/5">
                                                    {bullet}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Landscape: compact 3-col grid with icon cards */
                    <div className="grid gap-5 grid-cols-3">
                        {siteData.highlights.map((feature, idx) => {
                            const Icon = featureIcons[idx] || Clock;
                            return (
                                <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] hover:border-blue-500/20 transition-all group">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2.5 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                                            <Icon size={22} className="text-blue-400" />
                                        </div>
                                        <h3 className="text-white font-bold text-base">{feature.title}</h3>
                                    </div>
                                    <p className="text-gray-400 text-sm leading-relaxed mb-3">{feature.body}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {feature.bullets.map((bullet, bidx) => (
                                            <span key={bidx} className="text-[11px] bg-white/5 text-gray-300 px-2.5 py-1 rounded-lg border border-white/5">
                                                {bullet}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Section>

            {/* ─── How It Works ─── */}
            <Section id="workflow" title="How It Works" subtitle="From onboarding to payroll export in six seamless steps.">
                {isPortrait ? (
                    /* Portrait: vertical timeline */
                    <div className="relative pl-10 max-w-2xl mx-auto">
                        <div className="absolute left-[13px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-blue-500/60 via-blue-400/30 to-transparent" />
                        <div className="flex flex-col gap-5">
                            {siteData.homeData.workflowSteps.map((step, idx) => {
                                const Icon = workflowIcons[step.icon] || Clock;
                                return (
                                    <div key={idx} className="relative">
                                        <div className="absolute -left-10 top-2 w-7 h-7 rounded-full bg-blue-500/10 border-2 border-blue-500 flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.4)]">
                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                                        </div>
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                                    <Icon size={18} className="text-blue-400" />
                                                </div>
                                                <span className="text-xs text-blue-400/70 font-bold uppercase tracking-widest">Step {idx + 1}</span>
                                            </div>
                                            <h3 className="text-white font-bold mb-1">{step.title}</h3>
                                            <p className="text-gray-400 text-sm leading-relaxed">{step.body}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* Landscape: 3-col grid cards with step numbers */
                    <div className="grid grid-cols-3 gap-4">
                        {siteData.homeData.workflowSteps.map((step, idx) => {
                            const Icon = workflowIcons[step.icon] || Clock;
                            return (
                                <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-5 relative overflow-hidden hover:border-blue-500/20 transition-all group">
                                    <div className="absolute top-2 right-3 text-[3rem] font-black text-white/[0.03] leading-none pointer-events-none">
                                        {idx + 1}
                                    </div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                                            <Icon size={18} className="text-blue-400" />
                                        </div>
                                        <span className="text-xs text-blue-400/70 font-bold uppercase tracking-widest">Step {idx + 1}</span>
                                    </div>
                                    <h3 className="text-white font-bold mb-1">{step.title}</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">{step.body}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Section>

            {/* ─── Impact Stats ─── */}
            <Section id="impact" title="Real Results" subtitle="Measurable outcomes from teams already using MANO.">
                <div className={`grid gap-4 ${isPortrait ? "grid-cols-3" : "grid-cols-6"}`}>
                    {siteData.homeData.impactStats.map((stat, idx) => {
                        const Icon = statIcons[stat.icon] || Activity;
                        return (
                            <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center text-center hover:border-blue-500/20 transition-all">
                                <div className="p-2.5 bg-blue-500/10 rounded-xl mb-3">
                                    <Icon size={20} className="text-blue-400" />
                                </div>
                                <p className="text-white font-bold text-sm leading-tight mb-1">{stat.value}</p>
                                <p className="text-blue-400 text-[10px] font-semibold uppercase tracking-wider mb-2">{stat.title}</p>
                                <p className="text-gray-500 text-[11px] leading-relaxed">{stat.note}</p>
                            </div>
                        );
                    })}
                </div>
            </Section>

            {/* ─── Pricing ─── */}
            <Section id="pricing" title="Plans Built For Every Stage" subtitle="Start lean, grow confidently, and scale with policy controls tailored for your workforce model.">
                <div className="grid grid-cols-3 gap-5 max-w-4xl mx-auto">
                    {siteData.pageContent['/pricing'].plans.map((plan, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-blue-500/20 transition-all">
                            <h3 className="text-white font-bold text-lg mb-1">{plan.name}</h3>
                            <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">{plan.audience}</p>
                            <p className="text-gray-400 text-sm leading-relaxed mb-5">{plan.priceNote}</p>
                            <ul className="space-y-3">
                                {plan.bullets.map((item, bidx) => (
                                    <li key={bidx} className="text-sm text-gray-300 flex items-start gap-2.5">
                                        <CheckCircle2 size={16} className="text-blue-500 shrink-0 mt-0.5" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </Section>

            {/* ─── Contact ─── */}
            <Section id="contact" title="Get in Touch" subtitle="Our team is ready to help you optimize your workforce governance.">
                <div className={`max-w-3xl mx-auto ${isPortrait ? "" : "flex gap-6 items-stretch"}`}>
                    <div className={`bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 text-center relative overflow-hidden ${isPortrait ? "" : "flex-1"}`}>
                        <h3 className="text-2xl font-bold text-white mb-4">Ready to start?</h3>
                        <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">Join hundreds of companies using MANO to transform their operations.</p>
                        <a href="mailto:business@mano.co.in" className="inline-block bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold px-10 py-3.5 rounded-xl shadow-lg hover:shadow-blue-500/25 active:scale-95 transition-all text-sm">
                            Contact Sales
                        </a>
                    </div>
                    {!isPortrait && (
                        <div className="flex flex-col gap-4 flex-1">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1 flex flex-col items-center justify-center text-center">
                                <p className="text-blue-400 font-bold text-sm tracking-wide uppercase mb-2">Connect</p>
                                <p className="text-white font-medium">+91 91360 96633</p>
                                <p className="text-gray-400 text-sm">business@mano.co.in</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1 flex flex-col items-center justify-center text-center">
                                <p className="text-blue-400 font-bold text-sm tracking-wide uppercase mb-2">Office</p>
                                <p className="text-gray-400 text-sm leading-relaxed">B-11, 2nd Floor, West View, 88, L.N Road, Dadar (East), Mumbai - 400014</p>
                            </div>
                        </div>
                    )}
                </div>
            </Section>
        </div>
    );
}
