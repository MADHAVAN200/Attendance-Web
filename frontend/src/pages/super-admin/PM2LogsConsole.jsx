import React, { useState, useEffect, useRef, useMemo } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { 
  Play, Pause, Trash2, Copy, Search, Terminal, AlertTriangle, 
  Info, ShieldAlert, Database, Cpu, Server, Activity, 
  Check, RefreshCw, Download, ChevronRight, Eye, RefreshCw as SpinIcon
} from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';

const PM2LogsConsole = () => {
  // Check screen width for mobile vs desktop layout
  const detectMobile = () => {
    if (typeof window === 'undefined') return false;
    const prefersCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return window.innerWidth < 1024 || prefersCoarse;
  };

  const [isMobile, setIsMobile] = useState(detectMobile());

  useEffect(() => {
    const handleResize = () => setIsMobile(detectMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Socket
  const socket = useSocket();

  // Core State
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [selectedSeverities, setSelectedSeverities] = useState({
    INFO: true,
    WARNING: true,
    CRITICAL: true
  });

  const [selectedCategories, setSelectedCategories] = useState({
    Database: true,
    'Cache & Queues': true,
    'Security & Auth': true,
    'FCM & Push': true,
    'API & Requests': true,
    System: true
  });

  const [selectedSources, setSelectedSources] = useState({
    stdout: true,
    stderr: true
  });

  const terminalEndRef = useRef(null);
  const terminalBodyRef = useRef(null);

  // Fetch log history on mount
  const fetchLogHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/super-admin/monitor/pm2-logs');
      if (res.data && (res.data.success || res.data.status === 'success')) {
        setLogs(res.data.data || []);
      } else {
        toast.error('Failed to parse log history response');
      }
    } catch (err) {
      console.error('Failed to fetch PM2 logs history:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch log history from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogHistory();
  }, []);

  // Subscribe to live logs via socket.io
  useEffect(() => {
    if (!socket) return;

    socket.emit('subscribe_pm2_logs');

    const handleNewLog = (logEntry) => {
      // If live updates are paused, discard or buffer? Rule: pause disables incoming stream updates to state
      setLogs((prev) => {
        // Keep logs list capped at 1000 entries
        const updated = [...prev, logEntry];
        if (updated.length > 1000) {
          return updated.slice(-1000);
        }
        return updated;
      });
    };

    if (isLive) {
      socket.on('pm2:log', handleNewLog);
    }

    return () => {
      socket.off('pm2:log', handleNewLog);
      socket.emit('unsubscribe_pm2_logs');
    };
  }, [socket, isLive]);

  // Scroll to bottom helper
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Statistics
  const stats = useMemo(() => {
    const counts = { INFO: 0, WARNING: 0, CRITICAL: 0, db: 0, auth: 0, api: 0, total: logs.length };
    logs.forEach(l => {
      if (l.severity === 'CRITICAL') counts.CRITICAL++;
      else if (l.severity === 'WARNING') counts.WARNING++;
      else counts.INFO++;

      if (l.category === 'Database') counts.db++;
      else if (l.category === 'Security & Auth') counts.auth++;
      else if (l.category === 'API & Requests') counts.api++;
    });
    return counts;
  }, [logs]);

  // Filters logic
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Severity Filter
      if (!selectedSeverities[log.severity]) return false;

      // 2. Category Filter
      if (!selectedCategories[log.category]) return false;

      // 3. Source Filter
      if (!selectedSources[log.source]) return false;

      // 4. Text Search Match
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const msgMatch = log.message && log.message.toLowerCase().includes(query);
        const categoryMatch = log.category && log.category.toLowerCase().includes(query);
        const sourceMatch = log.source && log.source.toLowerCase().includes(query);
        const severityMatch = log.severity && log.severity.toLowerCase().includes(query);
        const timestampMatch = log.timestamp && log.timestamp.includes(query);
        return msgMatch || categoryMatch || sourceMatch || severityMatch || timestampMatch;
      }

      return true;
    });
  }, [logs, selectedSeverities, selectedCategories, selectedSources, searchQuery]);

  // Clipboard copy helper
  const handleCopyLogs = () => {
    if (filteredLogs.length === 0) {
      toast.warn('No logs to copy');
      return;
    }
    const logText = filteredLogs.map(l => 
      `[${new Date(l.timestamp).toLocaleString()}] [${l.source.toUpperCase()}] [${l.severity}] [${l.category}] ${l.message}`
    ).join('\n');

    navigator.clipboard.writeText(logText);
    toast.success('Logs copied to clipboard');
  };

  // Download logs helper
  const handleDownloadLogs = () => {
    if (filteredLogs.length === 0) {
      toast.warn('No logs to download');
      return;
    }
    const logText = filteredLogs.map(l => 
      `[${new Date(l.timestamp).toLocaleString()}] [${l.source.toUpperCase()}] [${l.severity}] [${l.category}] ${l.message}`
    ).join('\n');

    const element = document.createElement("a");
    const file = new Blob([logText], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `mano-pm2-logs-${new Date().toISOString().slice(0,10)}.log`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Logs download started');
  };

  // Clear console helper
  const handleClearConsole = () => {
    setLogs([]);
    toast.info('Console log buffer cleared');
  };

  // Toggle helper
  const toggleSeverity = (sev) => {
    setSelectedSeverities(prev => ({ ...prev, [sev]: !prev[sev] }));
  };

  const toggleCategory = (cat) => {
    setSelectedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleSource = (src) => {
    setSelectedSources(prev => ({ ...prev, [src]: !prev[src] }));
  };

  // Search Highlighter
  const highlightMatch = (text, query) => {
    if (!query || !query.trim() || !text) return text;
    const cleanQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${cleanQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) 
        ? <mark key={index} className="bg-amber-500/30 text-amber-200 border-b border-amber-500/50 rounded-sm px-0.5">{part}</mark>
        : part
    );
  };

  // Category Theme
  const getCategoryStyles = (category, isTerminal = false) => {
    if (isTerminal) {
      switch (category) {
        case 'Database': return 'text-cyan-400 bg-cyan-950/30 border-cyan-800/40';
        case 'Cache & Queues': return 'text-violet-400 bg-violet-950/30 border-violet-800/40';
        case 'Security & Auth': return 'text-pink-400 bg-pink-950/30 border-pink-800/40';
        case 'FCM & Push': return 'text-orange-400 bg-orange-950/30 border-orange-800/40';
        case 'API & Requests': return 'text-teal-400 bg-teal-950/30 border-teal-800/40';
        default: return 'text-slate-400 bg-slate-900 border-slate-700/40';
      }
    }
    switch (category) {
      case 'Database': return 'text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-950/30 dark:border-cyan-800/40';
      case 'Cache & Queues': return 'text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-950/30 dark:border-violet-800/40';
      case 'Security & Auth': return 'text-pink-700 bg-pink-50 border-pink-200 dark:text-pink-400 dark:bg-pink-950/30 dark:border-pink-800/40';
      case 'FCM & Push': return 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-800/40';
      case 'API & Requests': return 'text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-400 dark:bg-teal-950/30 dark:border-teal-800/40';
      default: return 'text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900 dark:border-slate-700/40';
    }
  };

  // Severity Theme
  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-400 font-bold border-red-900/30 bg-red-950/20';
      case 'WARNING': return 'text-amber-400 border-amber-900/30 bg-amber-950/20';
      default: return 'text-emerald-400 border-emerald-900/30 bg-emerald-950/20';
    }
  };

  // Format Date String nicely
  const formatTime = (ts) => {
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
    } catch (e) {
      return '';
    }
  };

  // Page Content Inner component
  const renderContent = () => (
    <div className="flex flex-col h-auto lg:h-[calc(100vh-64px)] p-3 space-y-4 overflow-y-auto lg:overflow-hidden">
      
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total logs */}
        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-500 dark:text-github-dark-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Log Buffer Size</span>
            <Terminal size={16} />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-github-dark-text">{stats.total} / 1000</div>
          <p className="text-[10px] text-slate-400 dark:text-github-dark-muted mt-1">Capped ring-buffer entries</p>
        </div>

        {/* Critical Logs */}
        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-500 dark:text-github-dark-muted">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-500">Critical Warnings</span>
            <ShieldAlert className="text-rose-500" size={16} />
          </div>
          <div className={`mt-2 text-2xl font-bold ${stats.CRITICAL > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-github-dark-text'}`}>
            {stats.CRITICAL}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-github-dark-muted mt-1">Errors, exceptions, crashes</p>
        </div>

        {/* Warning Logs */}
        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-500 dark:text-github-dark-muted">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">Warnings</span>
            <AlertTriangle className="text-amber-500" size={16} />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-github-dark-text">{stats.WARNING}</div>
          <p className="text-[10px] text-slate-400 dark:text-github-dark-muted mt-1">Actionable diagnostic logs</p>
        </div>

        {/* DB & API Logs */}
        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-500 dark:text-github-dark-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">DB & API Logs</span>
            <Database size={16} className="text-cyan-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-github-dark-text">{stats.db + stats.api}</div>
          <p className="text-[10px] text-slate-400 dark:text-github-dark-muted mt-1">Database & API router load</p>
        </div>
      </div>

      {/* Control Panel (Filters & Actions) */}
      <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl p-4 shadow-sm space-y-4">
        
        {/* Row 1: Search & Console Actions */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search / Filter messages, paths, queries..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-github-dark-text font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            )}
          </div>

          {/* Quick streaming state & operations */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Live Toggle */}
            <button
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                isLive 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
              }`}
              title={isLive ? "Pause Log Stream" : "Resume Log Stream"}
            >
              {isLive ? <Pause size={13} /> : <Play size={13} />}
              <span>{isLive ? 'Live Streaming' : 'Stream Paused'}</span>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            </button>

            {/* Refresh */}
            <button
              onClick={fetchLogHistory}
              disabled={loading}
              className="p-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-600 dark:text-slate-350 hover:text-indigo-600 hover:border-indigo-500 transition-all flex items-center justify-center disabled:opacity-50"
              title="Sync log history from file"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Clear Console */}
            <button
              onClick={handleClearConsole}
              className="p-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-600 dark:text-slate-350 hover:text-rose-500 hover:border-rose-500/50 transition-all flex items-center justify-center"
              title="Clear Console view buffer"
            >
              <Trash2 size={14} />
            </button>

            {/* Copy Logs */}
            <button
              onClick={handleCopyLogs}
              className="p-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-600 dark:text-slate-350 hover:text-indigo-600 hover:border-indigo-500 transition-all flex items-center justify-center"
              title="Copy active logs"
            >
              <Copy size={14} />
            </button>

            {/* Download logs */}
            <button
              onClick={handleDownloadLogs}
              className="p-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-600 dark:text-slate-350 hover:text-indigo-600 hover:border-indigo-500 transition-all flex items-center justify-center"
              title="Download active logs"
            >
              <Download size={14} />
            </button>
          </div>
        </div>

        {/* Row 2: Severity, Source, Auto-scroll */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 dark:border-github-dark-border pt-4 text-xs font-semibold">
          {/* Severity filters */}
          <div>
            <span className="text-[10px] text-slate-400 dark:text-github-dark-muted uppercase block mb-2 tracking-wider">Severity Filter</span>
            <div className="flex gap-2">
              {Object.keys(selectedSeverities).map((sev) => (
                <button
                  key={sev}
                  onClick={() => toggleSeverity(sev)}
                  className={`px-2.5 py-1 rounded border transition-all flex items-center gap-1.5 ${
                    selectedSeverities[sev]
                      ? sev === 'CRITICAL' 
                        ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400'
                        : sev === 'WARNING'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-50 dark:bg-github-dark-bg border-slate-200 dark:border-github-dark-border text-slate-400 dark:text-github-dark-muted opacity-50'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    sev === 'CRITICAL' ? 'bg-rose-500' : sev === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <span>{sev}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sources Filter */}
          <div>
            <span className="text-[10px] text-slate-400 dark:text-github-dark-muted uppercase block mb-2 tracking-wider">Log Source</span>
            <div className="flex gap-2">
              {Object.keys(selectedSources).map((src) => (
                <button
                  key={src}
                  onClick={() => toggleSource(src)}
                  className={`px-2.5 py-1 rounded border transition-all ${
                    selectedSources[src]
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold'
                      : 'bg-slate-50 dark:bg-github-dark-bg border-slate-200 dark:border-github-dark-border text-slate-400 dark:text-github-dark-muted opacity-50'
                  }`}
                >
                  {src === 'stdout' ? 'stdout (OUT)' : 'stderr (ERR)'}
                </button>
              ))}
            </div>
          </div>

          {/* Scrolling Actions */}
          <div className="flex flex-col justify-end">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-1.5 rounded border transition-all text-center w-full md:w-fit self-start md:self-end flex items-center justify-center gap-1.5 ${
                autoScroll 
                  ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold' 
                  : 'bg-slate-50 dark:bg-github-dark-bg border-slate-200 dark:border-github-dark-border text-slate-500 dark:text-github-dark-muted'
              }`}
            >
              <Check size={14} className={autoScroll ? 'opacity-100' : 'opacity-0'} />
              <span>Auto-Scroll Terminal</span>
            </button>
          </div>
        </div>

        {/* Row 3: Category filter pills */}
        <div className="border-t border-slate-100 dark:border-github-dark-border pt-4">
          <span className="text-[10px] text-slate-400 dark:text-github-dark-muted uppercase block mb-2 tracking-wider">Filter Modules / Domains</span>
          <div className="flex flex-wrap gap-2">
            {Object.keys(selectedCategories).map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                  selectedCategories[cat]
                    ? getCategoryStyles(cat)
                    : 'bg-slate-50 dark:bg-github-dark-bg border-slate-200 dark:border-github-dark-border text-slate-400 dark:text-github-dark-muted opacity-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Terminal View Console */}
      <div className="bg-slate-950 dark:bg-black border border-slate-800 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative flex flex-col h-[450px] sm:h-[550px] lg:h-auto lg:flex-1 lg:min-h-0">
        {/* Terminal Header */}
        <div className="bg-slate-900 border-b border-slate-800 flex justify-between items-center px-4 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 cursor-pointer" onClick={handleClearConsole} title="Clear console buffer" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 cursor-pointer" onClick={() => setAutoScroll(!autoScroll)} title="Toggle auto scroll" />
            <span className="text-slate-400 text-xs font-mono font-medium ml-2 select-none">ATTENDANCE-BACKEND console (~/logs)</span>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 select-none">
            {isLive ? (
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>ONLINE</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold bg-amber-950/20 px-2 py-0.5 rounded border border-amber-900/30">
                <span>PAUSED</span>
              </div>
            )}
            <span className="hidden sm:inline border-l border-slate-800 pl-2">Filter Match: {filteredLogs.length}</span>
          </div>
        </div>

        {/* Terminal Body */}
        <div 
          ref={terminalBodyRef}
          className="p-4 flex-1 overflow-y-auto no-scrollbar font-mono text-xs text-slate-300 space-y-1.5 select-text"
        >
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-xs">Fetching log buffer history...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center space-y-2 p-6 select-none">
              <Terminal className="text-slate-700" size={32} />
              <p className="text-xs font-semibold">No logs in current console buffer matching your filter rules.</p>
              <p className="text-[10px] text-slate-600">Try toggling severity levels, enabling categories, or clearing search filter.</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div 
                key={index} 
                className={`flex flex-col sm:flex-row items-start gap-1 sm:gap-2 leading-relaxed border-l-2 pl-2 ${
                  log.severity === 'CRITICAL' 
                    ? 'border-rose-500/50 hover:bg-rose-950/5' 
                    : log.severity === 'WARNING' 
                      ? 'border-amber-500/40 hover:bg-amber-950/5' 
                      : 'border-emerald-500/30 hover:bg-slate-900/40'
                }`}
              >
                {/* Meta block */}
                <div className="flex flex-wrap items-center gap-1 shrink-0 select-none text-[10px]">
                  {/* Timestamp */}
                  <span className="text-slate-500 whitespace-nowrap">
                    [{formatTime(log.timestamp)}]
                  </span>

                  {/* Source Out/Err */}
                  <span className={`px-1 rounded font-bold uppercase ${
                    log.source === 'stderr' ? 'text-amber-500 bg-amber-950/20' : 'text-sky-400 bg-sky-950/20'
                  }`}>
                    {log.source === 'stderr' ? 'err' : 'out'}
                  </span>

                  {/* Severity */}
                  <span className={`px-1 rounded font-bold border text-[9px] ${getSeverityStyles(log.severity)}`}>
                    {log.severity}
                  </span>

                  {/* Category */}
                  <span className={`px-1 rounded font-bold border text-[9px] ${getCategoryStyles(log.category, true)}`}>
                    {log.category}
                  </span>
                </div>

                {/* Log Message Text */}
                <div className={`flex-1 break-all whitespace-pre-wrap select-text font-medium font-mono text-[11px] leading-relaxed ${
                  log.severity === 'CRITICAL' 
                    ? 'text-rose-100 font-semibold' 
                    : log.severity === 'WARNING' 
                      ? 'text-amber-100' 
                      : 'text-slate-200'
                }`}>
                  {highlightMatch(log.message, searchQuery)}
                </div>
              </div>
            ))
          )}
          {/* Scroll anchor */}
          <div ref={terminalEndRef} />
        </div>

        {/* Scroll helper bar */}
        {!autoScroll && filteredLogs.length > 0 && (
          <div className="absolute bottom-2 right-4 bg-indigo-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-md cursor-pointer hover:bg-indigo-700 transition-all flex items-center gap-1 shadow-lg border border-indigo-500 select-none animate-bounce" onClick={() => setAutoScroll(true)}>
            <span>Auto-Scroll Paused</span>
            <ChevronRight size={12} className="rotate-90" />
          </div>
        )}
      </div>

    </div>
  );

  // Responsive Layout Wrappers
  if (isMobile) {
    return (
      <MobileDashboardLayout title="PM2 logs Console">
        {renderContent()}
      </MobileDashboardLayout>
    );
  }

  return (
    <DashboardLayout title="PM2 Logs Console" noPadding={true}>
      {renderContent()}
    </DashboardLayout>
  );
};

export default PM2LogsConsole;
