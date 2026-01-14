import React, { useEffect, useState } from 'react';
import { Video, CalendarDays } from 'lucide-react';
import { darService } from '../../services/mockDarService';

const UpcomingMeetings = () => {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMeetings = async () => {
            try {
                const data = await darService.getUpcomingMeetings();
                setMeetings(data);
            } catch (error) {
                console.error("Failed to load upcoming meetings", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMeetings();
    }, []);

    if (loading) return <div className="p-4 text-xs text-center text-gray-400">Loading meetings...</div>;

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-3">
            <h5 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                <div className="p-1 bg-purple-50 text-purple-600 rounded">
                    <Video size={14} />
                </div>
                Upcoming Meetings
            </h5>

            {meetings.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-4">No upcoming meetings this week.</div>
            ) : (
                <div className="space-y-3">
                    {meetings.map(meeting => {
                        const dateObj = new Date(meeting.date);
                        const isToday = new Date().toISOString().split('T')[0] === meeting.date;

                        return (
                            <div key={meeting.id} className="flex gap-3 items-start group">
                                {/* Date Box */}
                                <div className={`
                            shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center border font-medium text-xs
                            ${isToday ? 'bg-purple-50 border-purple-100 text-purple-700' : 'bg-gray-50 border-gray-100 text-gray-500'}
                        `}>
                                    <span className="uppercase text-[9px] font-bold opacity-70">
                                        {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                                    </span>
                                    <span className="text-sm font-bold leading-none">
                                        {dateObj.getDate()}
                                    </span>
                                </div>

                                {/* Details */}
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-gray-700 truncate group-hover:text-purple-600 transition-colors">
                                        {meeting.title}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        {meeting.startTime} - {meeting.endTime}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default UpcomingMeetings;
