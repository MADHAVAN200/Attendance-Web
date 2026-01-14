import React, { useEffect, useState } from 'react';
import { Calendar, PartyPopper } from 'lucide-react';
import { darService } from '../../services/mockDarService';

const UpcomingHolidays = () => {
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHolidays = async () => {
            try {
                const data = await darService.getUpcomingHolidays();
                setHolidays(data);
            } catch (error) {
                console.error("Failed to load upcoming holidays", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHolidays();
    }, []);

    if (loading) return null;

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-3">
            <h5 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                <div className="p-1 bg-green-50 text-green-600 rounded">
                    <PartyPopper size={14} />
                </div>
                Upcoming Holidays
            </h5>

            {holidays.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-2">No holidays coming up soon.</div>
            ) : (
                <div className="space-y-3">
                    {holidays.map((holiday, idx) => {
                        const dateObj = new Date(holiday.date);
                        return (
                            <div key={idx} className="flex gap-3 items-center group">
                                {/* Date Box */}
                                <div className="shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center border font-medium text-xs bg-green-50 border-green-100 text-green-700">
                                    <span className="uppercase text-[9px] font-bold opacity-70">
                                        {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                                    </span>
                                    <span className="text-sm font-bold leading-none">
                                        {dateObj.getDate()}
                                    </span>
                                </div>

                                {/* Details */}
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-gray-700 truncate group-hover:text-green-600 transition-colors">
                                        {holiday.name}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        {dateObj.toLocaleDateString('en-US', { weekday: 'long' })}
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

export default UpcomingHolidays;
