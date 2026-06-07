import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Briefcase, MapPin, Calendar, Clock, DollarSign, 
  Upload, FileText, Send, CheckCircle,
  Linkedin, Globe, Sparkles, Award, Sun, Moon, ArrowRight
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';

const getDefaultFields = () => [
  { id: 'def_1', type: 'text', label: 'Full Name', placeholder: 'John Doe', required: true, options: [], width: 'full' },
  { id: 'def_2', type: 'email', label: 'Email Address', placeholder: 'john@example.com', required: true, options: [], width: 'full' },
  { id: 'def_3', type: 'tel', label: 'Mobile Number', placeholder: '+91 98765 43210', required: true, options: [], width: 'full' },
  { id: 'def_4', type: 'textarea', label: 'Short Cover Letter / Cover Note', placeholder: "Brief note on why you're a great fit...", required: false, options: [], width: 'full' },
  { id: 'def_5', type: 'file', label: 'Resume File (PDF Only)', placeholder: '', required: true, options: [], width: 'full' },
];

const PublicJobOpening = () => {
  const { slug } = useParams();
  const [job, setJob] = useState(null);
  const [formData, setFormData] = useState({});
  const [resumeFile, setResumeFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  // Initialize theme from localStorage or default to browser system setting
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await api.get(`/recruitment/public-opening/${slug}`);
        const foundJob = res.data;
        if (foundJob.isExpired) {
          setJob(null);
          setIsExpired(true);
        } else if (foundJob.status !== 'active') {
          setJob(null);
          setIsExpired(false);
        } else {
          setJob(foundJob);
          setIsExpired(false);

          // Initialize form state dynamically
          const initialForm = {};
          const fields = foundJob.form_config && foundJob.form_config.length > 0 
            ? foundJob.form_config 
            : getDefaultFields();
          fields.forEach(field => {
            if (field.type !== 'divider' && field.type !== 'section_header') {
              initialForm[field.label] = field.type === 'checkbox_group' ? [] : '';
            }
          });
          setFormData(initialForm);
        }
      } catch (err) {
        console.error('Error fetching job details:', err);
        setJob(null);
        setIsExpired(false);
      }
    };
    fetchJob();
  }, [slug]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast.error('Only PDF resumes are supported for AI analysis.');
        return;
      }
      setResumeFile(file);
    }
  };

  const renderField = (field) => {
    switch (field.type) {
      case 'divider':
        return <hr key={field.id} className="border-slate-200 dark:border-[#30363d] my-5 col-span-2" />;
      case 'section_header':
        return (
          <h4 key={field.id} className="text-xs font-extrabold text-slate-800 dark:text-[#f0f6fc] mt-4 mb-1 border-b border-slate-100 dark:border-[#30363d] pb-1.5 uppercase tracking-wider col-span-2">
            {field.label}
          </h4>
        );
      case 'textarea':
        return (
          <div key={field.id} className="col-span-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">
              {field.label} {field.required && ' *'}
            </label>
            <textarea
              required={field.required}
              placeholder={field.placeholder}
              rows="3"
              value={formData[field.label] || ''}
              onChange={(e) => setFormData({ ...formData, [field.label]: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] dark:text-[#f0f6fc]"
            />
          </div>
        );
      case 'select':
        return (
          <div key={field.id} className={field.width === 'half' ? 'col-span-1' : 'col-span-2'}>
            <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">
              {field.label} {field.required && ' *'}
            </label>
            <select
              required={field.required}
              value={formData[field.label] || ''}
              onChange={(e) => setFormData({ ...formData, [field.label]: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] dark:text-[#f0f6fc]"
            >
              <option value="">Select an option...</option>
              {field.options.map((opt, i) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );
      case 'radio_group':
        return (
          <div key={field.id} className="col-span-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-2 block">
              {field.label} {field.required && ' *'}
            </label>
            <div className="flex flex-wrap gap-4">
              {field.options.map((opt, i) => (
                <label key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-[#c9d1d9] cursor-pointer">
                  <input
                    type="radio"
                    name={field.id}
                    required={field.required && !formData[field.label]}
                    checked={formData[field.label] === opt}
                    onChange={() => setFormData({ ...formData, [field.label]: opt })}
                    className="text-[#0969da] focus:ring-[#0969da]"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        );
      case 'checkbox_group':
        return (
          <div key={field.id} className="col-span-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-2 block">
              {field.label} {field.required && ' *'}
            </label>
            <div className="flex flex-wrap gap-4">
              {field.options.map((opt, i) => {
                const currentValues = formData[field.label] || [];
                const isChecked = currentValues.includes(opt);
                return (
                  <label key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-[#c9d1d9] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const newValues = e.target.checked 
                          ? [...currentValues, opt] 
                          : currentValues.filter(v => v !== opt);
                        setFormData({ ...formData, [field.label]: newValues });
                      }}
                      className="text-[#0969da] rounded focus:ring-[#0969da]"
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          </div>
        );
      case 'file':
        return (
          <div key={field.id} className="col-span-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">
              {field.label} {field.required && ' *'}
            </label>
            <div className="relative border-2 border-dashed border-slate-200 dark:border-[#30363d] rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-[#161b22] transition-colors cursor-pointer">
              <input
                type="file"
                accept=".pdf"
                required={field.required}
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <Upload size={20} className="text-slate-400" />
                {resumeFile ? (
                  <span className="text-xs font-bold text-slate-700 dark:text-[#c9d1d9] flex items-center gap-1">
                    <FileText size={12} className="text-indigo-500" />
                    {resumeFile.name}
                  </span>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-slate-600 dark:text-[#c9d1d9]">Click to Upload Resume</span>
                    <span className="text-[10px] text-slate-400">PDF up to 5MB</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div key={field.id} className={field.width === 'half' ? 'col-span-1' : 'col-span-2'}>
            <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">
              {field.label} {field.required && ' *'}
            </label>
            <input
              type={field.type === 'tel' ? 'tel' : field.type === 'url' ? 'url' : field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
              required={field.required}
              placeholder={field.placeholder}
              value={formData[field.label] || ''}
              onChange={(e) => setFormData({ ...formData, [field.label]: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] dark:text-[#f0f6fc]"
            />
          </div>
        );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if the form configuration has a required file field
    const fileField = fieldsToShow.find(f => f.type === 'file');
    const isFileRequired = fileField ? fileField.required : false;

    if (isFileRequired && !resumeFile) {
      toast.error(`Please upload your ${fileField.label || 'Resume'}.`);
      return;
    }

    setSubmitting(true);
    setAiAnalyzing(true);

    try {
      const formDataPayload = new FormData();
      formDataPayload.append('responses', JSON.stringify(formData));
      formDataPayload.append('template_id', job.template_id || '');
      formDataPayload.append('template_source', job.template_source || 'scratch');
      if (resumeFile) {
        formDataPayload.append('resume', resumeFile);
      }

      await api.post(`/recruitment/candidates/${job.id}/apply`, formDataPayload, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setAiAnalyzing(false);
      setSubmitting(false);
      setSubmitted(true);
      toast.success('Application submitted successfully!');
    } catch (err) {
      console.error('Error submitting application:', err);
      setAiAnalyzing(false);
      setSubmitting(false);
      toast.error(err.response?.data?.error || 'Failed to submit candidate application.');
    }
  };

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-github-dark-bg flex flex-col justify-center items-center p-6 text-center">
        <div className="max-w-md bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] p-8 rounded-2xl shadow-lg">
          <Briefcase size={48} className="mx-auto text-slate-400 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-[#f0f6fc] mb-2">
            {isExpired ? 'Application Deadline Passed' : 'Job Opening Closed'}
          </h2>
          <p className="text-slate-500 dark:text-github-dark-muted text-sm mb-6">
            {isExpired 
              ? 'The deadline for submitting applications to this role has passed, and we are no longer accepting submissions.'
              : 'This opening has been deactivated by the administrator or is no longer accepting applications.'}
          </p>
          <Link to="/login" className="px-5 py-2 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-lg text-sm font-medium transition-all">
            Go to Portal Login
          </Link>
        </div>
      </div>
    );
  }

  const fieldsToShow = job.form_config && job.form_config.length > 0 
    ? job.form_config 
    : getDefaultFields();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#010409] font-poppins text-slate-800 dark:text-[#f0f6fc] transition-colors duration-300 pb-16">
      
      {/* Careers Header */}
      <header className="bg-white dark:bg-[#0d1117] border-b border-slate-200 dark:border-[#30363d] py-5 shadow-sm transition-colors duration-300">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/mano-logo.svg" alt="MANO" className="w-8 h-8 object-contain" />
            <span className="font-black text-xl text-[#0969da] dark:text-github-dark-accent">MANO Careers</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Header Sun/Moon Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161b22] hover:bg-slate-100 dark:hover:bg-[#30363d] text-slate-500 dark:text-github-dark-muted border border-slate-200 dark:border-[#30363d] transition-all"
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} className="text-amber-400" />}
            </button>

            <span className="text-xs bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-[#c9d1d9] px-3 py-1 rounded-full font-mono border border-transparent dark:border-[#30363d]">
              Applicant Portal
            </span>
          </div>
        </div>
      </header>

      {/* Main Body - Horizontal Width Expanded */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 mt-8">
        {submitted ? (
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl p-10 text-center shadow-lg max-w-2xl mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
            <CheckCircle size={64} className="mx-auto text-emerald-500 mb-6" />
            <h1 className="text-2xl font-bold text-slate-800 dark:text-[#f0f6fc] mb-3">Application Submitted!</h1>
            <p className="text-slate-600 dark:text-github-dark-muted text-sm mb-2 max-w-md mx-auto">
              Thank you for applying for the <strong>{job.job_title}</strong> role at MANO. Our recruitment team has received your application.
            </p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mb-8">
              Our AI resume assistant is currently analyzing your credentials for matching. No further action is required from your end.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setSubmitted(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-[#21262d] text-slate-700 dark:text-[#c9d1d9] border border-transparent dark:border-[#30363d] rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-[#30363d] transition-colors"
              >
                Submit another application
              </button>
            </div>
          </div>
        ) : (
          /* Grid updated to col-12 to scale layouts wider */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Job Details Section (8 Columns out of 12 for spacious horizontal presentation) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl p-6 md:p-8 shadow-sm transition-colors duration-300">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-[#f0f6fc] leading-tight mb-2">
                      {job.job_title}
                    </h1>
                    <p className="text-sm font-bold text-[#0969da] dark:text-github-dark-accent">
                      {job.department}
                    </p>
                  </div>
                  <span className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs px-3.5 py-1.5 rounded-full font-bold">
                    Active Opening
                  </span>
                </div>

                {/* Badges bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-[#161b22] border border-slate-100 dark:border-[#30363d] rounded-xl text-xs font-medium text-slate-600 dark:text-[#8b949e]">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-[#0969da] dark:text-github-dark-accent" />
                    <span>{job.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-[#0969da] dark:text-github-dark-accent" />
                    <span>{job.employment_type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award size={16} className="text-[#0969da] dark:text-github-dark-accent" />
                    <span>{job.experience_required} Exp Required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-[#0969da] dark:text-github-dark-accent" />
                    <span>Apply before {job.deadline}</span>
                  </div>
                </div>

                <div className="space-y-6 text-sm leading-relaxed text-slate-600 dark:text-[#c9d1d9] mt-8">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-[#f0f6fc] mb-2.5 border-l-4 border-[#0969da] pl-3">
                      Job Responsibilities
                    </h3>
                    <p className="whitespace-pre-line pl-4">
                      {job.responsibilities}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-[#f0f6fc] mb-2.5 border-l-4 border-[#0969da] pl-3">
                      Skills Required
                    </h3>
                    <div className="flex flex-wrap gap-2 pl-4 mt-3">
                      {job.skills_required.split(',').map((skill, i) => (
                        <span key={i} className="bg-slate-100 dark:bg-[#21262d] border border-transparent dark:border-[#30363d] text-slate-700 dark:text-[#c9d1d9] px-3 py-1.5 rounded-lg text-xs font-mono font-semibold">
                          {skill.trim()}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-[#f0f6fc] mb-2.5 border-l-4 border-[#0969da] pl-3">
                      Benefits & Perks
                    </h3>
                    <p className="whitespace-pre-line pl-4">
                      {job.benefits}
                    </p>
                  </div>

                  {job.salary_range && (
                    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl flex items-center gap-3">
                      <DollarSign size={20} className="text-indigo-600 dark:text-indigo-400" />
                      <div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Offered Salary Package Range:</span>
                        <p className="font-bold text-indigo-700 dark:text-indigo-400 text-sm mt-0.5">{job.salary_range}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Application Submission Form (4 Columns or 5 Columns out of 12) */}
            <div className="lg:col-span-5 xl:col-span-4">
              <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl p-6 shadow-sm sticky top-6 transition-colors duration-300">
                <h2 className="text-lg font-bold text-slate-800 dark:text-[#f0f6fc] mb-4 flex items-center gap-2">
                  <Send size={18} className="text-[#0969da]" />
                  Apply for this position
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {fieldsToShow.map(field => renderField(field))}
                  </div>

                  {aiAnalyzing ? (
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-3.5 text-center flex flex-col items-center gap-2 animate-pulse">
                      <Sparkles className="w-5 h-5 text-indigo-500 animate-spin" />
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">AI Resume Assistant analyzing skills...</span>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex justify-center items-center gap-2 bg-[#0969da] hover:bg-[#0969da]/90 text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={16} />
                      Submit Application
                    </button>
                  )}
                </form>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default PublicJobOpening;
