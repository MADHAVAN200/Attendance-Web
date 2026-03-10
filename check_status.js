
import { attendanceDB } from "./backend/database.js";

async function checkStatus() {
    try {
        const records = await attendanceDB("attendance_records")
            .select("attendance_id", "user_id", "time_in", "time_out", "status")
            .orderBy("created_at", "desc")
            .limit(10);

        console.log("Recent Attendance Records:");
        console.table(records);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkStatus();
