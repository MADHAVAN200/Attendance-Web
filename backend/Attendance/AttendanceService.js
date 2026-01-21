
import { knexDB } from "../database.js";
import { uploadCompressedImage } from "../s3/s3Service.js";
import EventBus from "../utils/EventBus.js";
import { PolicyService } from "./PolicyEngine.js";

// Helper: Fetch User Shift
async function getUserShift(user_id) {
    const user = await knexDB("users")
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
        const openSession = await knexDB("attendance_records")
            .where({ user_id })
            .whereNull("time_out")
            .whereRaw("DATE(time_in) = DATE(?)", [localTime])
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
        const [attendance_id] = await knexDB("attendance_records").insert({
            user_id,
            org_id,
            late_reason: sessionContext.is_first_session ? (late_reason || (lateCheck.isLate ? "Late Entry" : null)) : null,
            late_minutes: minutesLate,
            time_in: localTime,
            time_in_lat: latitude,
            time_in_lng: longitude,
            time_in_address: address,
            status: "OPEN", // Session is now open
            metadata: JSON.stringify(metadata),
            created_at: knexDB.fn.now(),
            updated_at: knexDB.fn.now(),
        });

        // Daily Sync
        try {
            const dateStr = localTime.split('T')[0];
            const timeStr = localTime.split('T')[1].split('.')[0];

            const existingDaily = await knexDB("daily_attendance")
                .where({ user_id, date: dateStr })
                .first();

            if (!existingDaily) {
                await knexDB("daily_attendance").insert({
                    user_id,
                    org_id,
                    date: dateStr,
                    shift_id: shift ? shift.shift_id : null,
                    first_in: timeStr,
                    status: lateCheck.isLate ? 'LATE_NOT_PUNCHED_OUT' : 'NOT_PUNCHED_OUT',
                    late_minutes: lateCheck.isLate ? minutesLate : 0,
                    total_hours: 0,
                    created_at: knexDB.fn.now(),
                    updated_at: knexDB.fn.now()
                });
            }
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
            await knexDB("attendance_records")
                .where({ attendance_id })
                .update({
                    time_in_image_key: imageKey,
                    updated_at: knexDB.fn.now(),
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
        const openSession = await knexDB("attendance_records")
            .where({ user_id })
            .whereNull("time_out")
            .whereRaw("DATE(time_in) = DATE(?)", [localTime])
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
            await knexDB("attendance_records")
                .where({ attendance_id: openSession.attendance_id })
                .update({
                    time_out_image_key: imageKey,
                    updated_at: knexDB.fn.now(),
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
        await knexDB("attendance_records")
            .where({ attendance_id: openSession.attendance_id })
            .update({
                time_out: localTime,
                time_out_lat: latitude,
                time_out_lng: longitude,
                time_out_address: address,
                overtime_hours: totalHours > (rules.overtime?.threshold || 8) ? (totalHours - (rules.overtime?.threshold || 8)) : 0,
                status: "CLOSED",
                metadata: JSON.stringify(metadata),
                updated_at: knexDB.fn.now(),
            });

        // Daily Sync
        try {
            const dateStrSync = localTime.split('T')[0];
            const timeStrSync = localTime.split('T')[1].split('.')[0];
            const grandTotalHours = parseFloat((sessionContext.total_hours_today + totalHours).toFixed(2));

            await knexDB("daily_attendance")
                .where({ user_id, date: dateStrSync })
                .update({
                    last_out: timeStrSync,
                    total_hours: grandTotalHours,
                    overtime_hours: grandTotalHours > (rules.overtime?.threshold || 8) ? (grandTotalHours - (rules.overtime?.threshold || 8)) : 0,
                    status: status,
                    updated_at: knexDB.fn.now()
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
    }
};
