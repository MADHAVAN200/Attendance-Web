import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Loader2, Eye, EyeOff, ShieldAlert, Activity, Sun, Moon } from "lucide-react";

const SuperAdminLogin = () => {
    const { superAdminLogin } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener("resize", handleResize);

        // Sync theme with HTML element
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        return () => window.removeEventListener("resize", handleResize);
    }, [isDark]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await superAdminLogin(formData.email, formData.password);
            toast.success("Super Admin authenticated. System Access Granted.");
            navigate("/dashboard");
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || "Invalid credentials";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-slate-50 dark:bg-[#010404] font-poppins selection:bg-indigo-500/30 overflow-hidden transition-colors duration-500">

            {/* Background Visuals */}
            <div className="fixed inset-0 z-0 opacity-100 dark:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-amber-600/5 dark:bg-amber-600/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] dark:opacity-[0.03] pointer-events-none" />
            </div>

            {/* Theme Toggle Button */}
            <button
                onClick={() => setIsDark(!isDark)}
                className="fixed top-8 right-8 z-[100] p-3 rounded-2xl bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] text-slate-600 dark:text-slate-400 hover:scale-110 active:scale-95 transition-all shadow-xl shadow-black/5"
            >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* --- CORE CONTENT CONTAINER --- */}
            <div className="flex min-h-screen relative z-10">
                {/* --- LEFT SECTION: VISUALS (Desktop only) --- */}
                {!isMobile && (
                    <div className="relative w-[58%] flex flex-col justify-center p-[7rem] overflow-hidden border-r border-slate-200 dark:border-white/5 transition-colors duration-500 gap-24">
                        {/* Logo & Branding */}
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative z-10 flex items-center gap-6"
                        >
                            <div className="w-16 h-16 bg-white dark:bg-[#0d1117] rounded-2xl flex items-center justify-center border border-slate-100 dark:border-[#30363d] shadow-2xl">
                                <ShieldAlert className="w-10 h-10 text-amber-500 dark:text-amber-400" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic leading-none">
                                    MANO <span className="text-amber-600 dark:text-amber-400 not-italic font-medium opacity-80">Internal</span>
                                </h1>
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] mt-1">Super Admin Portal Access</span>
                            </div>
                        </motion.div>

                        {/* Industrial Stats / Mockup Centerpiece */}
                        <div className="relative z-10 flex flex-col items-start gap-10">
                            <motion.div
                                initial={{ opacity: 0, x: -50 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="space-y-5"
                            >
                                <h2 className="text-6xl font-black text-slate-900 dark:text-white leading-tight tracking-[calc(-0.02em)] uppercase">
                                    Global <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-indigo-500 dark:from-amber-400 dark:to-indigo-400">Control.</span>
                                </h2>
                                <p className="max-w-md text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed">
                                    Internal management portal for MANO Attendance. Manage organizations, monitor security alerts, and oversee platform-wide activity logs.
                                </p>
                            </motion.div>

                            {/* Glassmorphic Activity Card */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="w-full max-w-2xl p-1 bg-gradient-to-br from-amber-500/10 to-transparent dark:from-white/10 dark:to-transparent rounded-[2.4rem] shadow-2xl backdrop-blur-xl border border-slate-200 dark:border-white/10"
                            >
                                <div className="bg-white/80 dark:bg-[#0d1117]/80 rounded-[2.3rem] p-8 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                                                <Activity size={18} />
                                            </div>
                                            <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">System Health</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-ping" />
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">Secure Link</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-black underline decoration-amber-500/30 underline-offset-4">Internal Monitoring</span>
                                            <span className="text-lg font-mono text-slate-900 dark:text-white font-black">ACTIVE</span>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-black underline decoration-amber-500/30 underline-offset-4">Security Level</span>
                                            <span className="text-lg font-mono text-slate-900 dark:text-white font-black">MAX Tier</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}

                {/* --- RIGHT SECTION: LOGIN FORM --- */}
                <div className={`relative flex flex-col justify-center ${isMobile ? 'w-full p-8' : 'w-[42%] p-[6rem]'} z-10 bg-white dark:bg-[#010101] transition-colors duration-500 shadow-[-20px_0_60px_rgba(0,0,0,0.05)] dark:shadow-none`}>
                    <div className="w-full max-w-md mx-auto space-y-10">
                        {/* Header */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className={isMobile ? 'text-center' : ''}
                        >
                            <h3 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight uppercase mb-3">Internal Auth</h3>
                            <p className="text-slate-500 font-normal tracking-tight">Enter secure credentials to access the organizational management portal.</p>
                        </motion.div>

                        {/* Form Group */}
                        <motion.form
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            onSubmit={handleSubmit}
                            className="space-y-8"
                        >
                            {/* Email Field */}
                            <div className="space-y-3">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1">
                                    Authorized Email
                                </label>
                                <div className="relative group">
                                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-amber-600 dark:group-focus-within:text-amber-400 transition-colors" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none ring-offset-bg focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                                        placeholder="admin@mano.co.in"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                        Secure Password
                                    </label>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-amber-600 dark:group-focus-within:text-amber-400 transition-colors" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl py-4 pl-14 pr-12 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Action */}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="group relative w-full bg-amber-600 hover:bg-amber-700 text-white py-5 rounded-[1.25rem] text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-2xl shadow-amber-600/20 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <Loader2 className="animate-spin" size={18} />
                                    ) : (
                                        <>
                                            Secure Access
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.form>

                        {/* Footer */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-center pt-4"
                        >
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] whitespace-nowrap">
                                Authorized Personnel Only <span className="mx-2">•</span> <Link to="/login" className="text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors opacity-80">User Login</Link>
                            </p>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminLogin;
