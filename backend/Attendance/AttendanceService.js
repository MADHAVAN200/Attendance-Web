
import { attendanceDB } from "../database.js";
import { uploadCompressedImage } from "../s3/s3Service.js";
import EventBus from "../utils/EventBus.js";
import { PolicyService } from "./PolicyEngine.js";

// Helper: Fetch User Shift
async function getUserShift(user_id) {
    const user = await attendanceDB("users")
        .join("shifts", "users.shift_id", "shifts.shift_id")
        .where("users.user_id", user_id)
        .select("shifts.*")
        .first();
    return user;
}

export const AttendanceService = {
    /**
     * Process Time In
     * context: { user_id, org_id, latitude, longitude, accuracy, late_reason, file, localTime, address, ip, user_agent }
     */
    processTimeIn: async (context) => {
        const {
            user_id,
            org_id,
            latitude,
            longitude,
            accuracy,
            late_reason,
            file,
            localTime,
            address,
            ip,
            user_agent
        } = context;

        // 1. Check Existing Session
        const openSession = await attendanceDB("attendance_records")
            .where({ user_id })
            .whereNull("time_out")
            .whereRaw("time_in >= DATE_SUB(?, INTERVAL 12 HOUR)", [localTime])
            .first();

        if (openSession) {
            return { ok: false, status: 400, message: "Already timed in. Please time out first." };
        }

        // 2. Policy Context
        const sessionContext = await PolicyService.buildSessionContext(user_id, localTime, "time_in");
        const shift = await getUserShift(user_id);
        const rules = PolicyService.getRulesFromShift(shift);

        // 3. Modular Policy Checks

        // A. Geolocation Check
        const geoCheck = await PolicyService.checkLocationCompliance(user_id, latitude, longitude, accuracy, rules.entry_requirements);
        if (!geoCheck.ok) {
            return { ok: false, status: 400, message: "Policy Violation: " + geoCheck.error };
        }

        // B. Biometric Check
        const bioCheck = PolicyService.checkBiometricCompliance(file, rules.entry_requirements);
        if (!bioCheck.ok) {
            return { ok: false, status: 400, message: "Policy Violation: " + bioCheck.error };
        }

        // 4. Policy Execution (Late Calculation)
        let lateCheck = { minutesLate: 0, isLate: false, gracePeriod: 0 };

        if (sessionContext.is_first_session) {
            lateCheck = PolicyService.calculateLateArrival(localTime, rules);
        }

        const minutesLate = lateCheck.minutesLate;

        // VALIDATION: Late Reason Compulsory
        if (lateCheck.isLate && !late_reason) {
            return {
                ok: false,
                status: 400,
                message: `You are ${minutesLate} minutes late. A 'late_reason' is required to check in.`
            };
        }

        // Metadata
        // Note: timezone is not passed in context currently, if needed we can add it. 
        // Assuming context might have timezone if available, or we skip it for now.
        const metadata = {
            time_in: {
                accuracy: Math.round(accuracy),
                ip_address: ip,
                user_agent: user_agent,
                timestamp_utc: new Date().toISOString(), // This is technically "process time", not "captured time" for sim, but acceptable. 
                // ideally sim passes UTC too or we derive/ignore it.
                timezone: context.timezone || "N/A"
            },
            session_context: sessionContext
        };


        // DB Insert
        const [attendance_id] = await attendanceDB("attendance_records").insert({
            user_id,
            org_id,
            late_reason: sessionContext.is_first_session ? (late_reason || (lateCheck.isLate ? "Late Entry" : null)) : null,
            late_minutes: minutesLate,
            time_in: localTime,
            time_in_lat: latitude,
            time_in_lng: longitude,
            time_in_address: address,
            status: "PRESENT", // Session is now open (Status: PRESENT)
            metadata: JSON.stringify(metadata),
            created_at: attendanceDB.fn.now(),
            updated_at: attendanceDB.fn.now(),
        });

        // Daily Sync
        try {
            const dateStr = localTime.split('T')[0];

            // Sync Daily Attendance (will create daily record if missing)
            await AttendanceService.syncDailyAttendance(user_id, dateStr);

        } catch (dailyErr) {
            console.error("Daily Sync Error:", dailyErr);
        }

        // S3 Upload
        let imageKey = null;
        if (file) {
            const uploadResult = await uploadCompressedImage({
                fileBuffer: file.buffer,
                key: `${attendance_id}_in`,
                directory: "attendance_images"
            });
            imageKey = uploadResult.key;
            await attendanceDB("attendance_records")
                .where({ attendance_id })
                .update({
                    time_in_image_key: imageKey,
                    updated_at: attendanceDB.fn.now(),
                });
        }

        // Events
        EventBus.emitNotification({
            org_id,
            user_id,
            title: "Attendance Checked In",
            message: `You have successfully checked in at ${localTime} from ${address}`,
            type: "SUCCESS",
            related_entity_type: "ATTENDANCE",
            related_entity_id: attendance_id
        });

        EventBus.emitActivityLog({
            user_id,
            org_id,
            event_type: "CHECK_IN",
            event_source: context.event_source || "WEB", // Default to WEB
            object_type: "ATTENDANCE",
            object_id: attendance_id,
            description: `User checked in at ${address} (Session #${sessionContext.session_number})`,
            location: `${latitude},${longitude}`,
            request_ip: ip,
            user_agent: user_agent
        });

        return {
            ok: true,
            attendance_id,
            local_time: localTime,
            address,
            tz_name: context.timezone,
            image_key: imageKey,
            session_number: sessionContext.session_number,
            is_first_session: sessionContext.is_first_session,
            message: "Timed in successfully",
        };
    },

    /**
     * Process Time Out
     * context: { user_id, org_id, latitude, longitude, accuracy, file, localTime, address, ip, user_agent }
     */
    processTimeOut: async (context) => {
        const {
            user_id,
            org_id,
            latitude,
            longitude,
            accuracy,
            file,
            localTime,
            address,
            ip,
            user_agent
        } = context;

        // 1. Check Existing Session (Fail Fast)
        const openSession = await attendanceDB("attendance_records")
            .where({ user_id })
            .whereNull("time_out")
            .whereRaw("time_in >= DATE_SUB(?, INTERVAL 12 HOUR)", [localTime])
            .orderBy("time_in", "desc")
            .first();

        if (!openSession) {
            return { ok: false, status: 400, message: "No active time-in found to time out." };
        }

        // 2. Policy Context
        const sessionContext = await PolicyService.buildSessionContext(user_id, localTime, "time_out");
        const shift = await getUserShift(user_id);
        const rules = PolicyService.getRulesFromShift(shift);

        // 3. Modular Policy Checks

        // A. Geolocation Check
        const geoCheck = await PolicyService.checkLocationCompliance(user_id, latitude, longitude, accuracy, rules.exit_requirements);
        if (!geoCheck.ok) {
            return { ok: false, status: 400, message: "Policy Violation: " + geoCheck.error };
        }

        // B. Biometric Check
        const bioCheck = PolicyService.checkBiometricCompliance(file, rules.exit_requirements);
        if (!bioCheck.ok) {
            return { ok: false, status: 400, message: "Policy Violation: " + bioCheck.error };
        }

        // 4. Policy Execution (S3 Upload)
        let imageKey = null;
        if (file) {
            const uploadResult = await uploadCompressedImage({
                fileBuffer: file.buffer,
                key: `${openSession.attendance_id}_out`,
                directory: "attendance_images"
            });
            imageKey = uploadResult.key;
            await attendanceDB("attendance_records")
                .where({ attendance_id: openSession.attendance_id })
                .update({
                    time_out_image_key: imageKey,
                    updated_at: attendanceDB.fn.now(),
                });
        }

        // Calculations
        const timeIn = new Date(openSession.time_in);
        const timeOut = new Date(localTime);
        const durationMs = timeOut - timeIn;
        const totalHours = durationMs / (1000 * 60 * 60);
        const minutesLate = openSession.late_minutes || 0;

        // Status Evaluation
        // const statusEvalData = {
        //     ...sessionContext,
        //     total_hours: totalHours,
        //     minutes_late: minutesLate,
        //     check_in_hour: timeIn.getHours(),
        //     check_out_hour: timeOut.getHours(),
        //     last_time_out_hour: timeOut.getHours()
        // };
        // const status = PolicyService.evaluateStatus(rules, statusEvalData);


        // Simple Shift Status Evaluation
        // If the first session of the day was late, the day is considered LATE.
        // Otherwise, it is PRESENT.
        const status = openSession.status === "LATE_NOT_PUNCHED_OUT" ? "LATE" : "PRESENT";

        // Metadata Update
        let metadata = {};
        try {
            if (typeof openSession.metadata === 'string') {
                metadata = JSON.parse(openSession.metadata);
            } else if (typeof openSession.metadata === 'object' && openSession.metadata !== null) {
                metadata = openSession.metadata;
            }
        } catch (e) { console.error("Metadata parse error", e); }

        metadata.time_out = {
            accuracy: Math.round(accuracy),
            ip_address: ip,
            user_agent: user_agent,
            timestamp_utc: new Date().toISOString(),
            timezone: context.timezone || "N/A",
            total_hours: parseFloat(totalHours.toFixed(2))
        };
        metadata.session_context_at_checkout = sessionContext;

        // DB Update
        await attendanceDB("attendance_records")
            .where({ attendance_id: openSession.attendance_id })
            .update({
                time_out: localTime,
                time_out_lat: latitude,
                time_out_lng: longitude,
                time_out_address: address,
                overtime_hours: totalHours > (rules.overtime?.threshold || 8) ? (totalHours - (rules.overtime?.threshold || 8)) : 0,
                status: "PRESENT",
                metadata: JSON.stringify(metadata),
                updated_at: attendanceDB.fn.now(),
            });

        // Daily Sync
        try {
            const dateStrSync = localTime.split('T')[0];

            // Call sync to update last_out, total_hours, overtime, and status
            await AttendanceService.syncDailyAttendance(user_id, dateStrSync, {
                status: status // Pass evaluated status (PRESENT/LATE) to override computed status if needed, or let sync handle it if logic is moved there. 
                // Currently sync doesn't calculate status (PRESENT/LATE), it just updates times.
                // So we pass the status we evaluated above.
            });

        } catch (dailyErr) {
            console.error("Daily Sync Error (Timeout):", dailyErr);
        }

        // Events
        EventBus.emitNotification({
            org_id,
            user_id,
            title: "Attendance Checked Out",
            message: `You have successfully checked out at ${localTime}. Total hours today: ${sessionContext.total_hours_today.toFixed(2)}h`,
            type: "INFO",
            related_entity_type: "ATTENDANCE",
            related_entity_id: openSession.attendance_id
        });

        EventBus.emitActivityLog({
            user_id,
            org_id,
            event_type: "CHECK_OUT",
            event_source: context.event_source || "WEB",
            object_type: "ATTENDANCE",
            object_id: openSession.attendance_id,
            description: `User checked out at ${address} (Status: ${status})`,
            location: `${latitude},${longitude}`,
            request_ip: ip,
            user_agent: user_agent
        });

        return {
            ok: true,
            attendance_id: openSession.attendance_id,
            local_time_out: localTime,
            address,
            tz_name: context.timezone,
            image_key: imageKey,
            status,
            session_hours: parseFloat(totalHours.toFixed(2)),
            total_hours_today: sessionContext.total_hours_today,
            message: "Timed out successfully",
        };
    },

    /**
     * Sync Daily Attendance
     * Re-calculates and updates daily_attendance based on current records
     */
    syncDailyAttendance: async (user_id, dateStr, overrides = {}) => {
        try {
            // 1. Fetch all records for the day
            const records = await attendanceDB("attendance_records")
                .where({ user_id })
                .whereRaw("DATE(time_in) = ?", [dateStr])
                .orderBy("time_in", "asc");

            if (!records.length) return;

            const firstRec = records[0];
            const lastRec = records[records.length - 1];

            // 2. Ensure Daily Record Exists (Upsert-like behavior)
            const existingDaily = await attendanceDB("daily_attendance")
                .where({ user_id, date: dateStr })
                .first();

            if (!existingDaily) {
                // Fetch shift for initial creation if missing
                const shift = await getUserShift(user_id);

                await attendanceDB("daily_attendance").insert({
                    user_id,
                    org_id: records[0].org_id,
                    date: dateStr,
                    shift_id: shift ? shift.shift_id : null,
                    status: 'PRESENT', // Will be updated by overrides or logic below
                    created_at: attendanceDB.fn.now(),
                    updated_at: attendanceDB.fn.now(),
                    total_hours: 0
                });
            }

            // 3. Calculate Hours
            let totalMs = 0;
            records.forEach(r => {
                if (r.time_in && r.time_out) {
                    totalMs += (new Date(r.time_out) - new Date(r.time_in));
                }
            });
            const totalHours = parseFloat((totalMs / (1000 * 60 * 60)).toFixed(2));

            // 4. Get Rules for Overtime 
            let overtimeHours = 0;
            try {
                const shift = await getUserShift(user_id);
                // PolicyService is imported
                const rules = PolicyService.getRulesFromShift(shift);
                const threshold = rules.overtime?.threshold || 8;
                if (totalHours > threshold) {
                    overtimeHours = totalHours - threshold;
                }
            } catch (e) {
                // Ignore missing shift/policy errors during sync
            }

            const getTimeStr = (d) => {
                if (!d) return null;
                try {
                    const dateObj = new Date(d);
                    if (isNaN(dateObj.getTime())) return null;
                    // Use local time instead of ISO (UTC) to preserve the stored wall-clock time
                    const pad = (n) => String(n).padStart(2, '0');
                    return `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
                } catch (e) { return null; }
            };

            const updateData = {
                first_in: getTimeStr(firstRec.time_in),
                last_out: getTimeStr(lastRec.time_out),
                total_hours: totalHours,
                overtime_hours: overtimeHours,
                updated_at: attendanceDB.fn.now(),
                ...overrides
            };

            await attendanceDB("daily_attendance")
                .where({ user_id, date: dateStr })
                .update(updateData);

        } catch (err) {
            console.error("Sync Daily Attendance Error:", err);
            throw err;
        }
    }
};
