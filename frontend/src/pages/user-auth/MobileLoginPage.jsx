import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { motion } from "framer-motion";
import { Mail, Lock, Loader2, Eye, EyeOff, Shield, Activity, Sun, Moon, ArrowRight } from "lucide-react";

const MobileLoginPage = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ identifier: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        // Sync theme with HTML element
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(formData.identifier, formData.password, undefined, rememberMe);
            toast.success("Identity Verified. Access Granted.");
            navigate("/dashboard");
        } catch (err) {
            const errorMessage = err.response?.data?.message || "Authentication Failed";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-slate-50 dark:bg-[#010404] font-poppins selection:bg-indigo-500/30 overflow-x-hidden transition-colors duration-500">

            {/* Background Visuals */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-5%] left-[-5%] w-[70%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[80px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-5%] right-[-5%] w-[60%] h-[40%] bg-violet-600/5 dark:bg-violet-600/10 blur-[80px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] dark:opacity-[0.03]" />
            </div>

            <div className="relative z-10 flex flex-col min-h-screen px-6 py-8">
                {/* Header Section */}
                <header className="mb-10 pt-4">
                    <div className="flex items-center justify-between mb-8">
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-4"
                        >
                            <div className="w-12 h-12 bg-white dark:bg-[#0d1117] rounded-xl flex items-center justify-center shadow-lg">
                                <img src="/mano-logo.svg" alt="logo" className="w-7 h-7" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic leading-none">
                                    MANO <span className="text-indigo-600 dark:text-indigo-400 not-italic font-medium opacity-80 text-sm">Attendance</span>
                                </h1>
                                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mt-1">Enterprise Grade Security</span>
                            </div>
                        </motion.div>

                        {/* Theme Toggle */}
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => setIsDark(!isDark)}
                            className="w-12 h-12 bg-white dark:bg-[#0d1117] rounded-xl flex items-center justify-center shadow-lg text-slate-600 dark:text-slate-400 active:scale-90 transition-all"
                        >
                            {isDark ? <Sun size={20} /> : <Moon size={20} />}
                        </motion.button>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="space-y-3"
                    >
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight">
                            Precision <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400">Intelligence.</span>
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-[280px]">
                            Secure, automated, and hyper-accurate workforce monitoring.
                        </p>
                    </motion.div>
                </header>

                {/* Industrial Stats */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="grid grid-cols-2 gap-3 mb-10"
                >
                    <div className="p-4 bg-white/60 dark:bg-[#0d1117]/60 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                        <div className="flex items-center gap-2 mb-2 text-emerald-600 dark:text-emerald-400">
                            <Activity size={12} />
                            <span className="text-[8px] font-black uppercase tracking-widest">Live Sync</span>
                        </div>
                        <span className="text-xl font-mono text-slate-900 dark:text-white font-black">99.98%</span>
                    </div>
                    <div className="p-4 bg-white/60 dark:bg-[#0d1117]/60 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                        <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400">
                            <Shield size={12} />
                            <span className="text-[8px] font-black uppercase tracking-widest">Uptime</span>
                        </div>
                        <span className="text-xl font-mono text-slate-900 dark:text-white font-black">365<span className="text-[10px] ml-1">Days</span></span>
                    </div>
                </motion.div>

                {/* Login Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex-1"
                >
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1">
                                Email / Mobile
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                    type="text"
                                    name="identifier"
                                    value={formData.identifier}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-[1.25rem] py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                                    placeholder="Enter identifier"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                    Password
                                </label>
                                <Link to="/forgot-password" className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest transition-colors">
                                    Forgot?
                                </Link>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-[1.25rem] py-4 pl-14 pr-12 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                                    placeholder="********"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me Checkbox */}
                        <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-5 h-5 rounded-lg border border-slate-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 group-hover:scale-105">
                                    <svg
                                        className={`w-3.5 h-3.5 text-white transition-opacity ${rememberMe ? 'opacity-100' : 'opacity-0'}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth="3.5"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] select-none transition-colors group-hover:text-slate-600 dark:group-hover:text-slate-400">
                                    Keep me signed in
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-[1.25rem] text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-indigo-600/20 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <>
                                    Secure Login
                                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>

                {/* Footer */}
                <footer className="mt-auto pt-10 text-center">
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] leading-relaxed">
                        Authorized Personnel Only <br />
                        <span className="opacity-60">Problem with access? </span>
                        <a href="#" className="text-indigo-600 dark:text-indigo-400 hover:underline">Support</a>
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default MobileLoginPage;
