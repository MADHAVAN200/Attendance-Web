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

// Helper: Safe JSON parse policy rules
export const safeParseRules = (policyRules) => {
    if (!policyRules) return {};
    if (typeof policyRules === 'object') return policyRules;
    try {
        return JSON.parse(policyRules);
    } catch (e) {
        return {};
    }
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
    } else if (["matrix_monthly", "attendance_summary", "attendance_detailed"].includes(type) || month) {
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
        .whereNotIn("u.user_type", ["admin", "super_admin"])
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
        .whereNotIn("u.user_type", ["admin", "super_admin"])
        .whereRaw("DATE(ar.time_in) >= ?", [startDate])
        .whereRaw("DATE(ar.time_in) <= ?", [endDate])
        .orderBy("ar.time_in", "asc");
}



export async function getPreviewData({ type, org_id, month, startDate, endDate }) {
    let data = { columns: [], rows: [] };

    if (type.startsWith("matrix_")) {
        const users = await attendanceDB("users as u")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .leftJoin("designations as dg", "u.desg_id", "dg.desg_id")
            .select("u.user_id", "u.user_name", "d.dept_name", "dg.desg_name")
            .where("u.org_id", org_id)
            .whereNotIn("u.user_type", ["admin", "super_admin"]);

        const records = await getAttendanceRecords({ org_id, startDate, endDate });

        if (type === "matrix_daily") {
            data.columns = ["Name", "Dept", "Time In", "Time Out", "Work Hrs", "Status", "In Location", "Out Location"];
            data.rows = users.map(u => {
                const rec = records.find(r => r.user_id === u.user_id);
                return [
                    u.user_name,
                    u.dept_name || "-",
                    rec?.time_in ? new Date(rec.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
                    rec?.time_out ? new Date(rec.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
                    calculateWorkHours(rec?.time_in, rec?.time_out),
                    rec?.status || "Absent",
                    rec?.time_in_address || "-",
                    rec?.time_out_address || "-"
                ];
            });
        } else {
            // Multi-day Matrix Preview (Weekly or Monthly)
            const start = new Date(startDate);
            const end = new Date(endDate);
            const dateHeaders = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dateHeaders.push(new Date(d));
            }

            const baseHeaders = ["SR No.", "Name", "Position", "Dept"];
            const timeHeaders = ["Time In", "Time Out", "Late Hours"];
            
            // Build grouped headers for the frontend table
            const row1 = [
                { label: "SR No.", rowspan: 2, colspan: 1 },
                { label: "Name", rowspan: 2, colspan: 1 },
                { label: "Position", rowspan: 2, colspan: 1 },
                { label: "Dept", rowspan: 2, colspan: 1 },
                { label: "Time In", rowspan: 2, colspan: 1 },
                { label: "Time Out", rowspan: 2, colspan: 1 },
                { label: "Late Hours", rowspan: 2, colspan: 1 }
            ];

            dateHeaders.forEach(d => {
                const datePrefix = `${d.getDate()} ${d.toLocaleDateString('en-US', { weekday: 'short' })}`;
                row1.push({ label: datePrefix, rowspan: 1, colspan: 4 });
            });

            row1.push(
                { label: "Present Days", rowspan: 2, colspan: 1 },
                { label: "Total Hrs", rowspan: 2, colspan: 1 },
                { label: "Late Count", rowspan: 2, colspan: 1 },
                { label: "Late Mins", rowspan: 2, colspan: 1 }
            );

            const row2 = [];
            dateHeaders.forEach(() => {
                row2.push(
                    { label: "In Time" },
                    { label: "Out Time" },
                    { label: "In Location" },
                    { label: "Out Location" }
                );
            });

            data.headers = [row1, row2];

            const gridHeaders = [];
            dateHeaders.forEach(d => {
                const datePrefix = `${d.getDate()} ${d.toLocaleDateString('en-US', { weekday: 'short' })}`;
                gridHeaders.push(
                    `${datePrefix}\nIn Time`,
                    `${datePrefix}\nOut Time`,
                    `${datePrefix}\nIn Location`,
                    `${datePrefix}\nOut Location`
                );
            });

            const summaryHeaders = ["Present Days", "Total Hrs", "Late Count", "Late Mins"];

            data.columns = [...baseHeaders, ...timeHeaders, ...gridHeaders, ...summaryHeaders];
            data.rows = users.map((u, index) => {
                const userRecs = records.filter(r => r.user_id === u.user_id);

                let latestTimeIn = "-";
                let latestTimeOut = "-";
                let totalLateHours = 0;

                if (userRecs.length > 0) {
                    const latestRec = userRecs.reduce((latest, rec) => {
                        return new Date(rec.time_in) > new Date(latest.time_in) ? rec : latest;
                    });
                    latestTimeIn = latestRec.time_in ? new Date(latestRec.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";
                    latestTimeOut = latestRec.time_out ? new Date(latestRec.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";
                    totalLateHours = userRecs.reduce((sum, r) => sum + (r.late_minutes || 0), 0) / 60;
                }

                const userRow = [index + 1, u.user_name, u.desg_name || "-", u.dept_name || "-", latestTimeIn, latestTimeOut, totalLateHours.toFixed(2)];

                let totalHrs = 0;
                let lateCount = 0;
                let lateMins = 0;

                dateHeaders.forEach(d => {
                    const dateStr = d.toISOString().split('T')[0];
                    const rec = userRecs.find(r => new Date(r.time_in).toISOString().split('T')[0] === dateStr);
                    if (rec) {
                        const checkInTime = rec.time_in ? new Date(rec.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";
                        const checkOutTime = rec.time_out ? new Date(rec.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";
                        const locationIn = rec.time_in_address || "-";
                        const locationOut = rec.time_out_address || "-";
                        userRow.push(checkInTime, checkOutTime, locationIn, locationOut);
                         
                        totalHrs += parseFloat(calculateWorkHours(rec.time_in, rec.time_out));
                        if (rec.late_minutes > 0) {
                            lateCount++;
                            lateMins += rec.late_minutes;
                        }
                    } else {
                        const day = d.getDay();
                        const statusStr = day === 0 ? "Sun" : day === 6 ? "Sat" : "Absent";
                        userRow.push(statusStr, "-", "-", "-");
                    }
                });

                userRow.push(userRecs.length, totalHrs.toFixed(2), lateCount, lateMins);
                return userRow;
            });
        }
    } else if (type === "attendance_detailed") {
        const records = await getDetailedRecords({ org_id, startDate, endDate });
        data.columns = ["Date", "Name", "Dept", "Shift", "Time In", "Time Out", "Work Hrs", "Status", "In Location", "Out Location"];
        data.rows = records.map(r => [
            new Date(r.time_in).toLocaleDateString(),
            r.user_name,
            r.dept_name || "-",
            r.shift_name || "-",
            r.time_in ? new Date(r.time_in).toLocaleTimeString() : "-",
            r.time_out ? new Date(r.time_out).toLocaleTimeString() : "-",
            calculateWorkHours(r.time_in, r.time_out),
            deriveStatus(r),
            r.time_in_address || "-",
            r.time_out_address || "-"
        ]);
    } else if (type === "attendance_summary") {
        const [year, monthNum] = month.split("-").map(Number);
        const totalDaysInMonth = new Date(year, monthNum, 0).getDate();

        const users = await attendanceDB("users as u")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .select("u.user_id", "u.user_name", "d.dept_name")
            .where("u.org_id", org_id)
            .whereNotIn("u.user_type", ["admin", "super_admin"]);

        const records = await getAttendanceRecords({ org_id, startDate, endDate });

        data.columns = [
            "Name", 
            "Dept", 
            "Total Days", 
            "Present", 
            "Absent", 
            "Half Day", 
            "On Leave", 
            "Late Days", 
            "Late Mins", 
            "Overtime Hrs", 
            "Total Hrs", 
            "Payable Days"
        ];
        data.rows = users.map(u => {
            const userRecs = records.filter(r => r.user_id === u.user_id);
            const presentDays = userRecs.filter(r => r.time_in && r.status !== 'ABSENT' && r.status !== 'ON_LEAVE').length;
            const halfDayCount = userRecs.filter(r => r.status === 'HALF_DAY').length;
            const leaveCount = userRecs.filter(r => r.status === 'ON_LEAVE').length;
            const absentDays = Math.max(0, totalDaysInMonth - (presentDays + leaveCount));
            const lateCount = userRecs.filter(r => r.late_minutes > 0).length;
            const totalLateMins = userRecs.reduce((sum, r) => sum + (r.late_minutes || 0), 0);
            const totalOvertimeHrs = userRecs.reduce((sum, r) => sum + parseFloat(r.overtime_hours || 0), 0);
            const totalHrs = userRecs.reduce((sum, r) => {
                const start = new Date(r.time_in);
                const end = r.time_out ? new Date(r.time_out) : null;
                if (start && end) return sum + (end - start) / (1000 * 60 * 60);
                return sum;
            }, 0);
            const payableDays = presentDays - (0.5 * halfDayCount) + leaveCount;

            return [
                u.user_name, 
                u.dept_name || "-", 
                totalDaysInMonth, 
                presentDays, 
                absentDays, 
                halfDayCount, 
                leaveCount, 
                lateCount, 
                totalLateMins, 
                totalOvertimeHrs.toFixed(2), 
                totalHrs.toFixed(2), 
                Math.round(payableDays).toFixed(0)
            ];
        });

    } else if (type === "employee_master") {
        const users = await attendanceDB("users as u")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .leftJoin("designations as dg", "u.desg_id", "dg.desg_id")
            .select("u.user_id", "u.user_name", "u.email", "u.phone_no", "d.dept_name", "dg.desg_name", "u.user_type")
            .where("u.org_id", org_id)
            .whereNotIn("u.user_type", ["admin", "super_admin"]);

        data.columns = ["Name", "Email", "Phone", "Dept", "Designation", "Role"];
        data.rows = users.map(u => [u.user_name, u.email, u.phone_no, u.dept_name || "-", u.desg_name || "-", u.user_type]);
    }

    return data;
}