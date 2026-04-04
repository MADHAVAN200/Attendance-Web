import React, { useEffect, useState } from 'react';
import { Video, CalendarDays } from 'lucide-react';
import api from '../../services/api';

const UpcomingMeetings = ({ listMode = false }) => {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMeetings = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                const nextWeekStr = nextWeek.toISOString().split('T')[0];

                const res = await api.get('/dar/events/list', {
                    params: {
                        type: 'MEETING',
                        date_from: today,
                        date_to: nextWeekStr
                    }
                });

                // Transform snake_case to UI props
                const rawData = res.data.data || [];
                const transformed = rawData.map(m => ({
                    id: m.event_id,
                    title: m.title,
                    date: m.event_date, // "2024-01-18"
                    startTime: m.start_time ? m.start_time.slice(0, 5) : '',
                    endTime: m.end_time ? m.end_time.slice(0, 5) : ''
                }));

                // Limit to top 5 maybe?
                setMeetings(transformed.slice(0, 5));
            } catch (error) {
                console.error("Failed to load upcoming meetings", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMeetings();
    }, []);

    if (loading) return <div className="p-4 text-[10px] text-center text-slate-400">Loading...</div>;

    const Content = () => (
        <>
            {!listMode && (
                <h5 className="font-bold text-slate-800 dark:text-github-dark-text text-sm flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-lg">
                        <Video size={14} />
                    </div>
                    Upcoming Meetings
                </h5>
            )}

            {meetings.length === 0 ? (
                <div className="text-[11px] text-slate-400 dark:text-github-dark-muted py-4 text-center bg-slate-50/50 dark:bg-github-dark-subtle/30 rounded-lg border border-dashed border-slate-200 dark:border-github-dark-border">
                    No upcoming meetings
                </div>
            ) : (
                <div className="space-y-3">
                    {meetings.map(meeting => {
                        const dateObj = new Date(`${meeting.date}T12:00:00`);
                        const isToday = new Date().toISOString().split('T')[0] === meeting.date;

                        return (
                            <div key={meeting.id} className="flex gap-3 items-center group cursor-pointer">
                                {/* Date Box */}
                                <div className={`
                            shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center border font-bold text-xs transition-all group-hover:scale-105
                            ${isToday ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-100 dark:shadow-none' : 'bg-white dark:bg-github-dark-subtle border-slate-200 dark:border-github-dark-border text-slate-500 dark:text-github-dark-muted group-hover:border-purple-200'}
                        `}>
                                    <span className={`uppercase text-[8px] font-black ${isToday ? 'text-purple-100' : 'text-slate-400'}`}>
                                        {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                                    </span>
                                    <span className="text-sm leading-none">
                                        {dateObj.getDate()}
                                    </span>
                                </div>

                                {/* Details */}
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-700 dark:text-github-dark-text truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                        {meeting.title}
                                    </p>
                                    <p className="text-[10px] font-semibold text-slate-400 dark:text-github-dark-muted mt-0.5">
                                        {meeting.startTime} - {meeting.endTime}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );

    if (listMode) return <div className="flex flex-col gap-3"><Content /></div>;

    return (
        <div className="p-5 bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm flex flex-col gap-3">
            <Content />
        </div>
    );
};

export default UpcomingMeetings;
