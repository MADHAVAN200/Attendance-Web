
import { AttendanceService } from "./backend/Attendance/AttendanceService.js";
import { attendanceDB } from "./backend/database.js";

async function verifyFix() {

    // 1. Get VALID User ID
    const validUser = await attendanceDB("users").select("user_id", "org_id").first();
    if (!validUser) {
        console.error("No valid users found in database!");
        process.exit(1);
    }

    const user_id = validUser.user_id;
    const org_id = validUser.org_id;
    const now = new Date().toISOString();

    console.log(`Using Test User ID: ${user_id} Org ID: ${org_id}`);

    console.log("Simulating Time In...");
    const timeInRes = await AttendanceService.processTimeIn({
        user_id,
        org_id,
        latitude: 0,
        longitude: 0,
        accuracy: 10,
        localTime: now,
        address: "Test Location",
        ip: "127.0.0.1",
        user_agent: "TestScript",
        event_source: "TEST",
        late_reason: "Testing fix" // Added late reason
    });

    if (!timeInRes.ok) {
        console.error("Time In Failed:", timeInRes);
        process.exit(1);
    }

    console.log("Time In Success. Checking DB Status...");
    const processingRec = await attendanceDB("attendance_records")
        .where({ attendance_id: timeInRes.attendance_id })
        .first();

    console.log(`Time In Record Status: ${processingRec.status}`);

    console.log("Simulating Time Out...");
    const timeOutRes = await AttendanceService.processTimeOut({
        user_id,
        org_id,
        latitude: 0,
        longitude: 0,
        accuracy: 10,
        localTime: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1 hour later
        address: "Test Location",
        ip: "127.0.0.1",
        user_agent: "TestScript",
        event_source: "TEST"
    });

    if (!timeOutRes.ok) {
        console.error("Time Out Failed:", timeOutRes);
        process.exit(1);
    }

    console.log("Time Out Success. Checking DB Status...");
    const finalRec = await attendanceDB("attendance_records")
        .where({ attendance_id: timeInRes.attendance_id })
        .first();

    console.log(`Final Record Status: ${finalRec.status}`);

    // Cleanup test record
    await attendanceDB("attendance_records").where({ attendance_id: timeInRes.attendance_id }).del();
    console.log("Cleanup done.");

    process.exit(0);
}

verifyFix().catch(console.error);
