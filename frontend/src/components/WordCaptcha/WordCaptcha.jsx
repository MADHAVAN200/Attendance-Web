import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import api from "../../services/api";

const WordCaptcha = ({ onCaptchaChange, isDarkMode = false }) => {
  const [captchaId, setCaptchaId] = useState(null);
  const [captchaSvg, setCaptchaSvg] = useState(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [loading, setLoading] = useState(false);

  const loadCaptcha = async () => {
    setLoading(true);
    try {
      const response = await api.get("/auth/captcha/generate");
      setCaptchaId(response.data.captchaId);
      setCaptchaSvg(response.data.captchaSvg);
      setCaptchaInput("");
      // Notify parent that captcha data has changed
      onCaptchaChange(null, "");
    } catch (error) {
      console.error("Failed to load captcha:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase();
    setCaptchaInput(value);
    // Notify parent with current captchaId and captchaText
    onCaptchaChange(captchaId, value);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={`relative rounded-xl border overflow-hidden ${
        isDarkMode 
          ? 'border-slate-700 bg-slate-800/50' 
          : 'border-slate-200 bg-slate-50'
      }`}>
        {/* Captcha Image */}
        <div className="flex items-center justify-center p-4 min-h-[80px]">
          {loading ? (
            <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
          ) : captchaSvg ? (
            <img 
              src={captchaSvg} 
              alt="Captcha" 
              className="max-w-full h-auto"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
              Loading captcha...
            </span>
          )}
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={loadCaptcha}
          disabled={loading}
          className={`absolute top-2 right-2 p-2 rounded-lg transition-all duration-200 ${
            isDarkMode
              ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              : 'bg-white hover:bg-slate-100 text-slate-600'
          } disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
          title="Refresh captcha"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Input Field */}
      <div>
        <label 
          htmlFor="captcha-input" 
          className={`block text-sm font-medium mb-2 ${
            isDarkMode ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          Enter the characters above
        </label>
        <input
          id="captcha-input"
          type="text"
          value={captchaInput}
          onChange={handleInputChange}
          maxLength={6}
          placeholder="Enter captcha"
          className={`block w-full px-4 py-3 border rounded-xl text-center text-lg font-semibold tracking-widest uppercase transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
            isDarkMode
              ? 'border-slate-600 bg-slate-800/50 text-white placeholder-slate-500'
              : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400'
          }`}
        />
      </div>
    </div>
  );
};

export default WordCaptcha;
