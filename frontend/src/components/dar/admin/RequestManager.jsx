
import React, { useState, useEffect } from 'react';
import { Search, FileText } from 'lucide-react';
import RequestReviewModal from '../../dar/RequestReviewModal'; // Ensure path is correct
import api from '../../../services/api'; // Ensure path is correct
import { toast } from 'react-toastify';

const RequestManager = () => {
    const [requests, setRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [requestSearch, setRequestSearch] = useState("");
    const [selectedRequest, setSelectedRequest] = useState(null);

    // Fetch Requests
    const fetchRequests = async () => {
        setLoadingRequests(true);
        try {
            const res = await api.get('/dar/requests/list');
            // Map API data to UI format
            const mapped = res.data.data.map(r => ({
                id: r.request_id,
                user: r.user_name, // from join
                date: r.request_date,
                changes: (r.proposed_data?.length || 0), // Rough count
                employeeName: r.user_name,
                originalTasks: r.original_data.map(t => ({
                    ...t,
                    id: t.id || Math.random(),
                    startTime: t.start_time || t.startTime,
                    endTime: t.end_time || t.endTime
                })),
                proposedTasks: r.proposed_data.map(t => ({
                    ...t,
                    id: t.id || Math.random(),
                    startTime: t.start_time || t.startTime,
                    endTime: t.end_time || t.endTime
                })),
                status: r.status,
                reason: r.reason
            }));

            setRequests([...mapped]);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load requests");
        } finally {
            setLoadingRequests(false);
        }
    };

    const handleApproveRequest = async (reqId) => {
        try {
            await api.post(`/dar/requests/approve/${reqId}`);
            toast.success("Request Approved & Applied");
            setSelectedRequest(null);
            fetchRequests(); // Refresh
        } catch (err) {
            toast.error("Approval Failed: " + (err.response?.data?.message || err.message));
        }
    };

    const handleRejectRequest = async (reqId) => {
        try {
            await api.post(`/dar/requests/reject/${reqId}`, { comment: "Rejected by Admin" });
            toast.info("Request Rejected");
            setSelectedRequest(null);
            fetchRequests(); // Refresh
        } catch (err) {
            toast.error("Rejection Failed");
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    return (
        <div className="flex h-full gap-6 pb-6">
            {/* Left: List */}
            <div className="w-1/3 min-w-[350px] bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3 bg-white dark:bg-dark-card z-10">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 dark:text-white">Requests</h3>
                        <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-full font-bold">{requests.length} Total</span>
                    </div>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={requestSearch}
                            onChange={(e) => setRequestSearch(e.target.value)}
                            placeholder="Search by employee name..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {loadingRequests ? (
                        <div className="text-center py-10 text-slate-400">Loading requests...</div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 italic">No requests found.</div>
                    ) : (
                        requests.filter(req => req.user.toLowerCase().includes(requestSearch.toLowerCase())).map(req => (
                            <div
                                key={req.id}
                                onClick={() => setSelectedRequest(req)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${selectedRequest?.id === req.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-200'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`font-bold text-sm ${selectedRequest?.id === req.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-white'}`}>{req.user}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">{req.date}</span>
                                </div>
                                <div className="text-xs text-slate-500 mb-2">{req.changes} changes proposed</div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${req.status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{req.status}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right: Details */}
            <div className="flex-1 bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col relative">
                {selectedRequest ? (
                    <RequestReviewModal
                        isOpen={true}
                        onClose={() => setSelectedRequest(null)}
                        request={selectedRequest}
                        onApprove={() => handleApproveRequest(selectedRequest.id)}
                        onReject={() => handleRejectRequest(selectedRequest.id)}
                        inline={true}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                        <FileText size={48} className="mb-4 opacity-50" />
                        <span className="text-lg font-medium">Select a request to view details</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RequestManager;
