import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Radar, ShieldCheck, Sparkles, BarChart3, Clock3, MapPin, Workflow, Activity, Users, TimerReset, Table2, Scale, HeartHandshake, Settings2, Cpu, ShieldAlert, BrainCircuit, ArrowRightLeft, MessageSquare, Clock, ChevronDown } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import MotionSection from "../components/MotionSection";
import { homeData, pageContent } from "../siteData";

const highlightIcons = [Radar, ShieldCheck, Sparkles, BarChart3];
const heroIcons = [ShieldCheck, MapPin, Clock3, Workflow];
const statIcons = [Activity, Users, TimerReset];

export default function HomePage() {
    const [isRevealed, setIsRevealed] = useState(false);
    const { hash } = useLocation();

    // Auto-reveal if navigating via hash (e.g., from footer links)
    useEffect(() => {
        if (hash) setIsRevealed(true);
    }, [hash]);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 50) {
                setIsRevealed(true);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const revealContent = () => setIsRevealed(true);

    return (
        <div className={`homepage-wrapper ${isRevealed ? 'is-revealed' : 'hero-exclusive'}`}>
            <section className="hero-wrap container hero-fold-exclusive">
                <div className="hero-grid">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <span className="eyebrow">Workforce Platform</span>
                        <h1>{homeData.headline}</h1>
                        <p className="lead-copy">{homeData.subtext}</p>

                        <div className="hero-actions">
                            <Link to="/get-started" className="btn-primary" onClick={revealContent}>{homeData.ctaPrimary}</Link>
                            <button onClick={revealContent} className="btn-ghost" style={{ cursor: 'pointer' }}>{homeData.ctaSecondary}</button>
                        </div>

                        <ul className="check-list">
                            {homeData.values.map((item) => (
                                <li key={item}>
                                    <CheckCircle2 size={18} /> {item}
                                </li>
                            ))}
                        </ul>
                    </motion.div>

                    <motion.div
                        className="hero-visual glass-card"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <img src={homeData.heroImage} alt="Platform Dashboard" />
                    </motion.div>
                </div>

                {!isRevealed && (
                    <motion.div
                        className="scroll-indicator"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 1 }}
                        onClick={revealContent}
                    >
                        <span>Scroll to discover</span>
                        <ChevronDown className="bounce-icon" />
                    </motion.div>
                )}
            </section>

            <AnimatePresence>
                {isRevealed && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >

                        <MotionSection id="features" className="container section-gap">
                            <div className="section-title-wrap">
                                <h2>Product Highlights</h2>
                                <p>Core capabilities designed to reduce attendance errors, improve compliance, and accelerate payroll readiness.</p>
                            </div>

                            <div className="home-highlights">
                                {homeData.highlights.map((item, idx) => {
                                    const isReverse = idx % 2 !== 0;
                                    return (
                                        <div key={item.title} className={`split-section ${isReverse ? 'reverse' : ''}`} style={{ marginBottom: "6rem", alignItems: "center" }}>
                                            <div className="split-content" style={{ padding: "2rem" }}>
                                                <h3 style={{ fontSize: "2rem", marginBottom: "1rem", color: "var(--text-primary)" }}>{item.title}</h3>
                                                <p className="soft-copy" style={{ fontSize: "1.1rem", marginBottom: "2rem" }}>{item.body}</p>

                                                {item.bullets && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                                                        {item.bullets.map(bullet => (
                                                            <div key={bullet} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.3rem', borderRadius: '50%' }}>
                                                                    <CheckCircle2 size={16} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
                                                                </div>
                                                                <span style={{ color: "var(--text-secondary)" }}>{bullet}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <a href="#contact" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    Talk to Sales <Workflow size={16} />
                                                </a>
                                            </div>
                                            <div className="split-image-container glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                {item.image ? (
                                                    <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                ) : (
                                                    <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                                                        <Sparkles size={48} style={{ color: "var(--accent-secondary)", opacity: 0.5 }} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </MotionSection>

                        <MotionSection className="container section-gap">
                            <div className="section-title-wrap">
                                <h2>Impact Snapshot</h2>
                                <p>Business outcomes teams typically track during the first phase of rollout.</p>
                            </div>

                            <div className="grid-three home-stats-grid" style={{ gap: '2rem' }}>
                                {(homeData.impactStats || []).map((item, idx) => {
                                    const IconComponent = {
                                        TimerReset, Activity, Table2, ShieldCheck, Scale, HeartHandshake
                                    }[item.icon] || Activity;
                                    return (
                                        <article key={item.title} className="glass-card metric-card" style={{ padding: '1.15rem 1.35rem', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
                                            {/* A subtle glowing overlay map in the background of each stat card */}
                                            <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', opacity: 0.05, transform: 'rotate(-15deg)', pointerEvents: 'none' }}>
                                                <IconComponent size={120} />
                                            </div>
                                            <div className="module-title" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative', zIndex: 1 }}>
                                                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '10px' }}>
                                                    <IconComponent size={20} style={{ color: "var(--accent-primary)" }} />
                                                </div>
                                                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{item.title}</h3>
                                            </div>
                                            <p className="metric-value" style={{ fontSize: '2rem', fontWeight: 700, backgroundImage: 'linear-gradient(90deg, #fff, var(--accent-primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.4rem', position: 'relative', zIndex: 1, lineHeight: 1 }}>{item.value}</p>
                                            <p className="soft-copy" style={{ fontSize: '0.95rem', lineHeight: 1.4, marginTop: '0.4rem', position: 'relative', zIndex: 1 }}>{item.note}</p>
                                        </article>
                                    );
                                })}
                            </div>
                        </MotionSection>

                        <MotionSection className="container section-gap">
                            <div className="section-title-wrap">
                                <h2>How MANO-Attendance Works</h2>
                                <p>A practical flow from clock-in to reports and notifications.</p>
                            </div>

                            {/* Vertical Interactive Timeline */}
                            <div className="timeline-wrapper" style={{ position: 'relative', padding: '1rem 0', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                                {/* Glowing vertical line */}
                                <div className="timeline-line" style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '2px', background: 'linear-gradient(180deg, rgba(99, 102, 241, 0) 0%, rgba(99, 102, 241, 0.5) 15%, rgba(168, 85, 247, 0.5) 85%, rgba(168, 85, 247, 0) 100%)', transform: 'translateX(-50%)' }}></div>

                                {(homeData.workflowSteps || []).map((step, idx) => {
                                    const IconComponent = {
                                        Settings2, MapPin, Cpu, ShieldAlert, BrainCircuit, ArrowRightLeft
                                    }[step.icon] || Clock3;

                                    const isEven = idx % 2 === 0;

                                    return (
                                        <div key={step.title} className="timeline-node" style={{ display: 'flex', justifyContent: isEven ? 'flex-start' : 'flex-end', position: 'relative', width: '100%', alignItems: 'center' }}>

                                            {/* Center floating Icon connecting the lines */}
                                            <div style={{ position: 'absolute', left: '50%', transform: 'translate(-50%, 0)', width: '56px', height: '56px', background: 'var(--bg-card)', border: '2px solid var(--accent-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
                                                <IconComponent size={24} style={{ color: "var(--accent-secondary)" }} />
                                            </div>

                                            {/* Content Card sliding off left/right  */}
                                            <article className="glass-card timeline-content" style={{ width: '45%', padding: '1.15rem 1.35rem', position: 'relative', textAlign: isEven ? 'right' : 'left', display: 'flex', flexDirection: 'column', alignItems: isEven ? 'flex-end' : 'flex-start' }}>

                                                {/* Massive background number watermark */}
                                                <div style={{ position: 'absolute', top: '-5px', [isEven ? 'left' : 'right']: '15px', fontSize: '6rem', fontWeight: 900, color: 'rgba(255,255,255,0.02)', zIndex: 0, lineHeight: 1, pointerEvents: 'none' }}>
                                                    {idx + 1}
                                                </div>

                                                <div style={{ position: 'relative', zIndex: 1 }}>
                                                    <h3 style={{ fontSize: '1.3rem', marginBottom: '0.4rem', color: "var(--text-primary)" }}>{step.title}</h3>
                                                    <p className="soft-copy" style={{ fontSize: '1rem', lineHeight: 1.4 }}>{step.body}</p>
                                                </div>
                                            </article>

                                        </div>
                                    );
                                })}
                            </div>
                        </MotionSection>

                        <MotionSection id="pricing" className="container section-gap">
                            <div className="section-title-wrap">
                                <h2>Plans Built For Every Stage</h2>
                                <p>Start lean, grow confidently, and scale with policy controls tailored for your workforce model.</p>
                            </div>

                            <div className="pricing-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '2rem' }}>
                                {(pageContent['/pricing'].plans || []).map((plan, idx) => {
                                    const Icon = [Activity, Sparkles, ShieldCheck][idx % 3];
                                    return (
                                        <article key={plan.name} className="glass-card pricing-card" style={{ padding: '1.15rem 1.35rem' }}>
                                            <div className="module-title" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                <Icon size={20} style={{ color: "var(--accent-primary)" }} />
                                                <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{plan.name}</h3>
                                            </div>
                                            <p className="eyebrow inline-eyebrow" style={{ marginBottom: '1rem', color: 'var(--accent-secondary)' }}>{plan.audience}</p>
                                            <p className="pricing-note" style={{ fontSize: '1.05rem', marginBottom: '2rem', height: '48px' }}>{plan.priceNote}</p>
                                            <ul className="check-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                {plan.bullets.map((item) => (
                                                    <li key={item} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
                                                        <CheckCircle2 size={20} style={{ color: "var(--accent-primary)", shrink: 0, marginTop: '2px' }} />
                                                        <span style={{ fontSize: '0.95rem' }}>{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </article>
                                    );
                                })}
                            </div>
                        </MotionSection>

                        <MotionSection id="contact" className="container section-gap">
                            <div className="section-title-wrap">
                                <h2>Talk To The Team</h2>
                                <p>Choose the right channel based on your need and we will route it to the relevant team quickly.</p>
                            </div>

                            <div className="contact-split-wrapper" style={{ gap: '2rem' }}>
                                {/* Left Side: Hero Visual */}
                                <div className="contact-split-hero">
                                    <div className="hero-visual-card">
                                        <div className="flex items-center gap-3 mb-6">
                                            <img src="/mano-logo.svg" alt="Mano Logo" className="h-10 w-auto" />
                                            <span className="text-white font-bold text-2xl tracking-tight">MANO</span>
                                        </div>
                                        <h3 className="text-3xl font-bold text-white mb-4">Let's build a smarter workforce together.</h3>
                                        <p className="text-gray-400 mb-8 leading-relaxed">
                                            Join hundreds of forward-thinking companies using AI to transform their attendance and productivity management.
                                        </p>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center gap-3 text-blue-400 font-medium">
                                                <MessageSquare size={18} />
                                                <span>Instant Support Channels</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-blue-400 font-medium">
                                                <Clock size={18} />
                                                <span>24/5 Response Window</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Information Cards */}
                                <div className="contact-split-content">
                                    {/* Card 1: Contact Detail */}
                                    <article className="glass-card info-card-horizontal">
                                        <div>
                                            <h4 className="text-blue-500 font-bold text-sm uppercase tracking-wider mb-2">Connect</h4>
                                            <h3 className="text-white font-bold text-xl">Contact Channels</h3>
                                        </div>
                                        <ul className="check-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                            {pageContent['/company/contact'].contactCards.map((item) => (
                                                <li key={item} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
                                                    <CheckCircle2 size={16} style={{ color: "var(--accent-primary)", shrink: 0, marginTop: '4px' }} />
                                                    <span style={{ fontSize: '0.9rem', color: "var(--text-secondary)" }}>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </article>

                                    {/* Card 2: Availability */}
                                    <article className="glass-card info-card-horizontal">
                                        <div>
                                            <h4 className="text-blue-500 font-bold text-sm uppercase tracking-wider mb-2">Availability</h4>
                                            <h3 className="text-white font-bold text-xl flex items-center gap-3">
                                                Office Hours
                                                <span className="flex items-center gap-2 bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full text-[10px] uppercase font-black border border-green-500/20">
                                                    <span className="pulse-dot" style={{ width: '6px', height: '6px', marginRight: '4px' }}></span> LIVE
                                                </span>
                                            </h3>
                                        </div>
                                        <ul className="check-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                            {pageContent['/company/contact'].officeHours.map((item) => (
                                                <li key={item} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
                                                    <CheckCircle2 size={16} style={{ color: "var(--accent-primary)", shrink: 0, marginTop: '4px' }} />
                                                    <span style={{ fontSize: '0.9rem', color: "var(--text-secondary)" }}>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </article>

                                    {/* Card 3: Support Flow */}
                                    <article className="glass-card info-card-horizontal">
                                        <div>
                                            <h4 className="text-blue-500 font-bold text-sm uppercase tracking-wider mb-2">Success</h4>
                                            <h3 className="text-white font-bold text-xl">Support Journey</h3>
                                        </div>
                                        <div className="timeline-compact">
                                            {pageContent['/company/contact'].supportFlow.map((item, index) => (
                                                <div key={index} className="timeline-tag">
                                                    <span className="tag-dot"></span>
                                                    {item.split(':')[0] || item}
                                                </div>
                                            ))}
                                        </div>
                                    </article>
                                </div>
                            </div>
                        </MotionSection>

                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
