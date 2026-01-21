import { knexDB } from './database.js';

async function testConnection() {
    console.log("Testing DB Connection...");
    try {
        const result = await knexDB.raw('SELECT 1+1 as result');
        console.log("Connection Successful!", result[0]);
    } catch (error) {
        console.error("Connection Failed:", error);
    } finally {
        const pool = knexDB.client.pool;
        if (pool) {
            await knexDB.destroy();
        }
    }
}

testConnection();
