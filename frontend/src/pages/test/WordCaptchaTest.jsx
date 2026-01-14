import { useState, useEffect } from "react";
// import { useAuth } from "../../context/AuthContext"; // We won't use AuthContext's login as strictly v2
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Mail, Lock, ArrowRight, Loader2, RefreshCw, Eye, EyeOff } from "lucide-react";
import api, { setAccessToken } from "../../services/api";

const WordCaptchaTest = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
    captchaText: ""
  });
  const [loading, setLoading] = useState(false);
  const [captchaData, setCaptchaData] = useState({ id: null, svg: null });
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fetchCaptcha = async () => {
    setCaptchaLoading(true);
    try {
      const res = await api.get("/auth/captcha/generate");
      setCaptchaData({
        id: res.data.captchaId,
        svg: res.data.captchaSvg
      });
      // Clear previous input
      setFormData(prev => ({ ...prev, captchaText: "" }));
    } catch (err) {
      console.error("Captcha error:", err);
      toast.error("Failed to load CAPTCHA");
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!captchaData.id || !formData.captchaText) {
      toast.error("Please complete the CAPTCHA check.");
      return;
    }

    setLoading(true);
    try {
      // Direct API call to test the "App" flow
      const res = await api.post("/auth/login", {
        user_input: formData.identifier,
        user_password: formData.password,
        captchaId: captchaData.id,
        captchaText: formData.captchaText
      });

      if (res.data.accessToken) {
        setAccessToken(res.data.accessToken);
        toast.success("Login Successful! (App Flow Verified)");
        // Optional: Redirect or just stay to show success
        navigate("/");   
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || err.response?.data?.message || "Login Failed");
      // Refresh captcha on failure
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-dark-bg transition-colors duration-300 font-poppins px-4">
      <div className="w-full max-w-md">
        
        {/* Header - Marked as Test Page */}
        <div className="flex flex-col items-center mb-8">
           <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold mb-4 border border-amber-200">
            TEST MODE: WORD CAPTCHA
          </div>
          <div className="w-16 h-16 bg-white dark:bg-dark-card rounded-2xl shadow-lg flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-700">
            <img src="/mano-logo.svg" alt="MANO" className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            App Login Test
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            Verifying Word-Based Captcha Flow
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-xl dark:shadow-2xl border border-slate-100 dark:border-slate-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email or Phone
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="text"
                  name="identifier"
                  value={formData.identifier}
                  onChange={handleChange}
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  placeholder="admin@demo.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="block w-full pl-10 pr-10 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Word Captcha UI */}
            <div className="space-y-3 pt-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Security Verification
                </label>
                
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-16 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden flex items-center justify-center relative">
                        {captchaLoading ? (
                            <Loader2 className="animate-spin text-slate-400" />
                        ) : captchaData.svg ? (
                            <img src={captchaData.svg} alt="Captcha" className="h-full w-full object-cover" />
                        ) : (
                            <span className="text-xs text-slate-400">Error loading captcha</span>
                        )}
                    </div>
                    <button 
                        type="button" 
                        onClick={fetchCaptcha}
                        className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors border border-slate-200 dark:border-slate-600"
                        title="Reload Captcha"
                    >
                        <RefreshCw className={`h-5 w-5 ${captchaLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="relative">
                    <input
                        type="text"
                        name="captchaText"
                        value={formData.captchaText}
                        onChange={handleChange}
                        required
                        className="block w-full py-3 px-4 uppercase tracking-widest text-center border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 font-bold"
                        placeholder="ENTER TEXT"
                        autoComplete="off"
                    />
                </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Verifying...
                </>
              ) : (
                <>
                  App Login
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="mt-8 text-center">
             <a href="/" className="text-sm text-indigo-600 hover:underline">← Back to Main Login</a>
        </div>
      </div>
    </div>
  );
};

export default WordCaptchaTest;
