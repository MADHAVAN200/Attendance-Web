import { attendanceDB } from '../../config/database.js';

/**
 * Calculate date ranges for the given period.
 */
function getDateRanges(range, year, month) {
    const today = new Date().toISOString().split('T')[0];
    let currentStartStr, currentEndStr, prevStartStr, prevEndStr, daysInPeriod;

    if (year && month) {
        const selectedMonth = parseInt(month);
        const selectedYear = parseInt(year);

        const startDate = new Date(selectedYear, selectedMonth - 1, 1);
        const endDate = new Date(selectedYear, selectedMonth, 0);

        currentStartStr = startDate.toISOString().split('T')[0];
        currentEndStr = endDate.toISOString().split('T')[0];
        daysInPeriod = endDate.getDate();

        const prevMonthDate = new Date(selectedYear, selectedMonth - 2, 1);
        const prevMonthEndDate = new Date(selectedYear, selectedMonth - 1, 0);
        prevStartStr = prevMonthDate.toISOString().split('T')[0];
        prevEndStr = prevMonthEndDate.toISOString().split('T')[0];
    } else if (range === 'daily') {
        currentStartStr = today;
        currentEndStr = today;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        prevStartStr = yesterday.toISOString().split('T')[0];
        prevEndStr = today;
        daysInPeriod = 1;
    } else if (range === 'monthly') {
        const currentStart = new Date();
        currentStart.setDate(currentStart.getDate() - 29);
        currentStartStr = currentStart.toISOString().split('T')[0];
        currentEndStr = today;

        const prevStart = new Date();
        prevStart.setDate(prevStart.getDate() - 59);
        prevStartStr = prevStart.toISOString().split('T')[0];
        prevEndStr = currentStartStr;
        daysInPeriod = 30;
    } else {
        // default: weekly
        const currentStart = new Date();
        currentStart.setDate(currentStart.getDate() - 6);
        currentStartStr = currentStart.toISOString().split('T')[0];
        currentEndStr = today;

        const prevStart = new Date();
        prevStart.setDate(prevStart.getDate() - 13);
        prevStartStr = prevStart.toISOString().split('T')[0];
        prevEndStr = currentStartStr;
        daysInPeriod = 7;
    }

    return { today, currentStartStr, currentEndStr, prevStartStr, prevEndStr, daysInPeriod };
}

function calculateTrend(current, previous) {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

/**
 * Get dashboard statistics for an organization.
 */
export async function getDashboardStats(org_id, { range = 'weekly', year, month }) {
    const { today, currentStartStr, currentEndStr, prevStartStr, prevEndStr, daysInPeriod } = getDateRanges(range, year, month);

    // Execute all queries in parallel
    const [
        totalEmployeesRes,
        presentTodayRes,
        lateCheckinsRes,
        periodPresentRes,
        prevPeriodPresentRes,
        periodLateRes,
        prevPeriodLateRes,
        activities
    ] = await Promise.all([
        attendanceDB("users").where("org_id", org_id).where("user_type", "employee").count("user_id as count").first(),
        attendanceDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) = ?", [today]).countDistinct("user_id as count").first(),
        attendanceDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) = ?", [today]).where("late_minutes", ">", 0).countDistinct("user_id as count").first(),
        attendanceDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) >= ? AND DATE(time_in) <= ?", [currentStartStr, currentEndStr]).countDistinct("user_id as count").first(),
        attendanceDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) >= ? AND DATE(time_in) <= ?", [prevStartStr, prevEndStr]).countDistinct("user_id as count").first(),
        attendanceDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) >= ? AND DATE(time_in) <= ? AND late_minutes > 0", [currentStartStr, currentEndStr]).countDistinct("user_id as count").first(),
        attendanceDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) >= ? AND DATE(time_in) <= ? AND late_minutes > 0", [prevStartStr, prevEndStr]).countDistinct("user_id as count").first(),
        attendanceDB("user_activity_logs as al")
            .leftJoin("users as u", "al.user_id", "u.user_id")
            .leftJoin("designations as d", "u.desg_id", "d.desg_id")
            .select("al.activity_id as id", "u.user_name as user", "d.desg_name as role", "al.description as action", "al.occurred_at as time", "u.profile_image_url")
            .where("al.org_id", org_id)
            .whereRaw("DATE(al.occurred_at) = ?", [today])
            .orderBy("al.occurred_at", "desc")
            .limit(20)
    ]);

    const totalEmployees = totalEmployeesRes.count || 0;
    const presentToday = presentTodayRes.count || 0;
    const lateCheckins = lateCheckinsRes.count || 0;
    const absentToday = Math.max(0, totalEmployees - presentToday);

    const periodPresentAvg = (periodPresentRes.count || 0) / daysInPeriod;
    const prevPeriodPresentAvg = (prevPeriodPresentRes.count || 0) / daysInPeriod;
    const periodLateAvg = (periodLateRes.count || 0) / daysInPeriod;
    const prevPeriodLateAvg = (prevPeriodLateRes.count || 0) / daysInPeriod;

    const periodAbsentAvg = Math.max(0, totalEmployees - periodPresentAvg);
    const prevPeriodAbsentAvg = Math.max(0, totalEmployees - prevPeriodPresentAvg);

    const trends = {
        present: calculateTrend(periodPresentAvg, prevPeriodPresentAvg),
        absent: calculateTrend(periodAbsentAvg, prevPeriodAbsentAvg),
        late: calculateTrend(periodLateAvg, prevPeriodLateAvg)
    };

    // Chart Data
    const chartDaysCount = range === 'monthly' ? 30 : 7;
    const chartDays = [];
    if (year && month) {
        for (let d = 1; d <= daysInPeriod; d++) {
            const date = new Date(year, month - 1, d);
            chartDays.push(date.toISOString().split('T')[0]);
        }
    } else {
        for (let i = chartDaysCount - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            chartDays.push(d.toISOString().split('T')[0]);
        }
    }

    const chartData = await Promise.all(
        chartDays.map(async (dayStr) => {
            const dayName = new Date(dayStr).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
            const [pRes, lRes] = await Promise.all([
                attendanceDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) = ?", [dayStr]).countDistinct("user_id as count").first(),
                attendanceDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) = ?", [dayStr]).where("late_minutes", ">", 0).countDistinct("user_id as count").first()
            ]);
            const present = Number(pRes.count || 0);
            const late = Number(lRes.count || 0);
            const absent = Math.max(0, Number(totalEmployees) - present);
            return { name: dayName, present, late, absent };
        })
    );

    const formattedActivities = activities.map(a => ({
        ...a,
        time: new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: a.action.toLowerCase().includes('clocked in') ? 'present' :
            a.action.toLowerCase().includes('late') ? 'late' : 'absent'
    }));

    return {
        stats: { presentToday, totalEmployees, absentToday, lateCheckins },
        trends,
        chartData,
        activities: formattedActivities
    };
}
