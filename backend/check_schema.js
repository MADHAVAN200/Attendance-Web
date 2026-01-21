
import { knexDB } from './database.js';

async function check() {
    try {
        const columns = await knexDB.raw("SHOW COLUMNS FROM leave_requests");
        console.log("Columns:", JSON.stringify(columns[0], null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        process.exit();
    }
}

check();
