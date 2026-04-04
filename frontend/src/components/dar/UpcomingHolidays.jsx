import React, { useEffect, useState } from 'react';
import { Calendar, PartyPopper } from 'lucide-react';
import api from '../../services/api';

const UpcomingHolidays = ({ listMode = false }) => {
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHolidays = async () => {
            try {
                const res = await api.get('/holiday');
                // The API returns all holidays for the org: { ok: true, holidays: [...] }
                const allHolidays = res.data.holidays || [];

                // Filter for holidays equal to or after today
                const todayStr = new Date().toISOString().split('T')[0];
                const upcoming = allHolidays
                    .filter(h => h.holiday_date >= todayStr)
                    .sort((a, b) => new Date(a.holiday_date) - new Date(b.holiday_date));

                // Transform to UI format expected below { date, name }
                const transformed = upcoming.map(h => ({
                    name: h.holiday_name,
                    date: h.holiday_date
                }));

                setHolidays(transformed.slice(0, 5));
            } catch (error) {
                console.error("Failed to load upcoming holidays", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHolidays();
    }, []);

    if (loading) return null;

    const Content = () => (
        <>
            {!listMode && (
                <h5 className="font-bold text-slate-800 dark:text-github-dark-text text-sm flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-lg">
                        <PartyPopper size={14} />
                    </div>
                    Upcoming Holidays
                </h5>
            )}

            {holidays.length === 0 ? (
                <div className="text-[11px] text-slate-400 dark:text-github-dark-muted py-4 text-center bg-slate-50/50 dark:bg-github-dark-subtle/30 rounded-lg border border-dashed border-slate-200 dark:border-github-dark-border">
                    No holidays soon
                </div>
            ) : (
                <div className="space-y-3">
                    {holidays.map((holiday, idx) => {
                        const dateObj = new Date(`${holiday.date}T12:00:00`);
                        return (
                            <div key={idx} className="flex gap-3 items-center group cursor-pointer">
                                {/* Date Box */}
                                <div className="shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center border font-bold text-xs bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 transition-all group-hover:scale-105">
                                    <span className="uppercase text-[8px] font-black opacity-70">
                                        {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                                    </span>
                                    <span className="text-sm leading-none">
                                        {dateObj.getDate()}
                                    </span>
                                </div>

                                {/* Details */}
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-700 dark:text-github-dark-text truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                        {holiday.name}
                                    </p>
                                    <p className="text-[10px] font-semibold text-slate-400 dark:text-github-dark-muted mt-0.5">
                                        {dateObj.toLocaleDateString('en-US', { weekday: 'long' })}
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

export default UpcomingHolidays;
