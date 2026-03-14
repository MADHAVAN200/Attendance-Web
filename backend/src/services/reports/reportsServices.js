import { attendanceDB } from '../../config/database.js';

// Helper: Calculate Work Hours
export const calculateWorkHours = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return "0.00";
    const start = new Date(timeIn);
    const end = new Date(timeOut);
    const diffMs = end - start;
    if (diffMs < 0) return "0.00";
    return (diffMs / (1000 * 60 * 60)).toFixed(2);
};

// Helper: Derive Status dynamically
export const deriveStatus = (r) => {
    if (!r.time_in) return "Absent";
    if (r.status === 'ON_LEAVE') return "On Leave";
    if (r.status === 'HALF_DAY') return "Half Day";
    if (r.status === 'ABSENT') return "Absent";

    let statusParts = [];
    if (r.late_minutes > 0) statusParts.push("Late");
    if (r.overtime_hours > 0) statusParts.push("Overtime");

    if (statusParts.length > 0) return statusParts.join(" & ");

    return "Present";
};

// Helper: Resolve date range from query params
export const resolveDateRange = ({ type, month, date }) => {
    let startDate, endDate;

    if (type === "employee_master") {
        startDate = "2000-01-01";
        endDate = new Date().toISOString().split("T")[0];
    } else if (["matrix_monthly", "attendance_summary", "attendance_detailed", "lateness_report"].includes(type) || month) {
        const [year, monthNum] = month.split("-");
        startDate = `${month}-01`;
        endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];
    } else if (type === "matrix_weekly") {
        const start = new Date(date);
        startDate = start.toISOString().split("T")[0];
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        endDate = end.toISOString().split("T")[0];
    } else if (type === "matrix_daily") {
        startDate = date;
        endDate = date;
    }

    return { startDate, endDate };
};

export async function getUsers({ org_id, targetUserId }) {
    return attendanceDB("users as u")
        .leftJoin("departments as d", "u.dept_id", "d.dept_id")
        .leftJoin("designations as dg", "u.desg_id", "dg.desg_id")
        .select("u.user_id", "u.user_name", "d.dept_name", "dg.desg_name", "u.email", "u.phone_no", "u.user_type")
        .where("u.org_id", org_id)
        .modify(qb => { if (targetUserId) qb.where("u.user_id", targetUserId); });
}

export async function getAttendanceRecords({ org_id, startDate, endDate }) {
    return attendanceDB("attendance_records")
        .where("org_id", org_id)
        .whereRaw("DATE(time_in) >= ?", [startDate])
        .whereRaw("DATE(time_in) <= ?", [endDate]);
}

export async function getDetailedRecords({ org_id, startDate, endDate }) {
    return attendanceDB("attendance_records as ar")
        .join("users as u", "ar.user_id", "u.user_id")
        .leftJoin("departments as d", "u.dept_id", "d.dept_id")
        .leftJoin("shifts as s", "u.shift_id", "s.shift_id")
        .select("ar.time_in", "u.user_id", "u.user_name", "d.dept_name", "s.shift_name", "ar.time_out", "ar.status", "ar.time_in_address", "ar.time_out_address", "ar.late_minutes", "ar.overtime_hours")
        .where("ar.org_id", org_id)
        .whereRaw("DATE(ar.time_in) >= ?", [startDate])
        .whereRaw("DATE(ar.time_in) <= ?", [endDate])
        .orderBy("ar.time_in", "asc");
}

export async function getLatenessRecords({ org_id, startDate, endDate }) {
    return attendanceDB("attendance_records as ar")
        .join("users as u", "ar.user_id", "u.user_id")
        .leftJoin("departments as d", "u.dept_id", "d.dept_id")
        .leftJoin("shifts as s", "u.shift_id", "s.shift_id")
        .select("u.user_name", "d.dept_name", "ar.time_in", "s.policy_rules", "ar.late_minutes", "ar.late_reason")
        .where("ar.org_id", org_id)
        .whereRaw("DATE(ar.time_in) >= ?", [startDate])
        .whereRaw("DATE(ar.time_in) <= ?", [endDate])
        .where("ar.late_minutes", ">", 0);
}

export async function getPreviewData({ type, org_id, month, startDate, endDate }) {
    let data = { columns: [], rows: [] };

    if (type.startsWith("matrix_")) {
        const users = await attendanceDB("users as u")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .select("u.user_id", "u.user_name", "d.dept_name")
            .where("u.org_id", org_id);

        const records = await getAttendanceRecords({ org_id, startDate, endDate });

        if (type === "matrix_daily") {
            data.columns = ["Name", "Dept", "Time In", "Time Out", "Work Hrs", "Status"];
            data.rows = users.map(u => {
                const rec = records.find(r => r.user_id === u.user_id);
                return [
                    u.user_name,
                    u.dept_name || "-",
                    rec?.time_in ? new Date(rec.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
                    rec?.time_out ? new Date(rec.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
                    calculateWorkHours(rec?.time_in, rec?.time_out),
                    rec?.status || "Absent"
                ];
            });
        } else {
            data.columns = ["Name", "Dept", "Present Days", "Total Hrs", "Late Count"];
            data.rows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const totalHrs = userRecs.reduce((sum, r) => sum + parseFloat(calculateWorkHours(r.time_in, r.time_out)), 0);
                const lateCount = userRecs.filter(r => r.late_minutes > 0).length;
                return [u.user_name, u.dept_name || "-", userRecs.length, totalHrs.toFixed(2), lateCount];
            });
        }
    } else if (type === "attendance_detailed") {
        const records = await getDetailedRecords({ org_id, startDate, endDate });
        data.columns = ["Date", "Name", "Dept", "Shift", "Time In", "Time Out", "Work Hrs", "Status"];
        data.rows = records.map(r => [
            new Date(r.time_in).toLocaleDateString(),
            r.user_name,
            r.dept_name || "-",
            r.shift_name || "-",
            r.time_in ? new Date(r.time_in).toLocaleTimeString() : "-",
            r.time_out ? new Date(r.time_out).toLocaleTimeString() : "-",
            calculateWorkHours(r.time_in, r.time_out),
            deriveStatus(r)
        ]);
    } else if (type === "attendance_summary") {
        const [year, monthNum] = month.split("-").map(Number);
        const totalDaysInMonth = new Date(year, monthNum, 0).getDate();

        const users = await attendanceDB("users as u")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .select("u.user_id", "u.user_name", "d.dept_name")
            .where("u.org_id", org_id);

        const records = await getAttendanceRecords({ org_id, startDate, endDate });

        data.columns = ["Name", "Dept", "Total Days", "Present", "Absent", "Late", "Leaves", "Total Hrs"];
        data.rows = users.map(u => {
            const userRecs = records.filter(r => r.user_id === u.user_id);
            const presentDays = new Set(userRecs.map(r => new Date(r.time_in).toISOString().split('T')[0])).size;
            const lateCount = userRecs.filter(r => r.late_minutes > 0).length;
            const totalHrs = userRecs.reduce((sum, r) => {
                const start = new Date(r.time_in);
                const end = r.time_out ? new Date(r.time_out) : null;
                if (start && end) return sum + (end - start) / (1000 * 60 * 60);
                return sum;
            }, 0);
            const leaves = 0;
            const absent = Math.max(0, totalDaysInMonth - (presentDays + leaves));
            return [u.user_name, u.dept_name || "-", totalDaysInMonth, presentDays, absent, lateCount, leaves, totalHrs.toFixed(2)];
        });
    } else if (type === "lateness_report") {
        const records = await getLatenessRecords({ org_id, startDate, endDate });
        data.columns = ["Date", "Employee", "Expected In", "Actual In", "Late By (Mins)", "Reason"];
        data.rows = records.map(r => {
            const rules = typeof r.policy_rules === 'string' ? JSON.parse(r.policy_rules) : (r.policy_rules || {});
            const expectedIn = rules.shift_timing?.start_time || "-";
            return [
                new Date(r.time_in).toLocaleDateString(),
                r.user_name,
                expectedIn,
                r.time_in ? new Date(r.time_in).toLocaleTimeString() : "-",
                r.late_minutes || 0,
                r.late_reason || "-"
            ];
        });
    } else if (type === "employee_master") {
        const users = await attendanceDB("users as u")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .leftJoin("designations as dg", "u.desg_id", "dg.desg_id")
            .select("u.user_id", "u.user_name", "u.email", "u.phone_no", "d.dept_name", "dg.desg_name", "u.user_type")
            .where("u.org_id", org_id);

        data.columns = ["Name", "Email", "Phone", "Dept", "Designation", "Role"];
        data.rows = users.map(u => [u.user_name, u.email, u.phone_no, u.dept_name || "-", u.desg_name || "-", u.user_type]);
    }

    return data;
}