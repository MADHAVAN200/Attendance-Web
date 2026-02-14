
import { attendanceDB } from "./backend/database.js";

async function checkSchema() {
    try {
        const tableInfo = await attendanceDB.raw("DESCRIBE attendance_records");
        console.log("Table Structure:");
        console.table(tableInfo[0]); // MySQL2 returns [rows, fields]
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkSchema();
