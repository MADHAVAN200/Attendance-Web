import { adminDB, attendanceDB } from '../../config/database.js';

export const initReportsDatabase = async () => {
    try {
        const db = adminDB || attendanceDB;
        if (!db) {
            console.error('No database connection found for Reports table initialization.');
            return;
        }

        const hasTable = await db.schema.hasTable('generated_reports');
        if (!hasTable) {
            console.log('Creating "generated_reports" table...');
            await db.schema.createTable('generated_reports', (table) => {
                table.string('report_id', 255).primary();
                table.integer('user_id').notNullable();
                table.integer('org_id').notNullable();
                table.string('report_type', 100).notNullable();
                table.string('format', 10).notNullable();
                table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
                table.text('file_url').nullable();
                table.string('error_message', 255).nullable();
                table.timestamp('created_at').defaultTo(db.fn.now());
                table.timestamp('updated_at').defaultTo(db.fn.now());
            });
            console.log('✅ "generated_reports" table created successfully.');
        } else {
            console.log('ℹ️ "generated_reports" table already exists.');
        }
    } catch (error) {
        console.error('Error during Reports database table initialization:', error);
    }
};
