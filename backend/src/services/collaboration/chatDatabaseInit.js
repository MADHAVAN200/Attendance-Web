import { adminDB, attendanceDB } from '../../config/database.js';

export const initChatDatabase = async () => {
    try {
        // Use higher-privilege adminDB if initialized, fallback to attendanceDB
        const db = adminDB || attendanceDB;
        if (!db) {
            console.error('No database connection found for Chat initialization.');
            return;
        }

        const connName = adminDB ? 'adminDB' : 'attendanceDB';

        // Drop old tables that are no longer needed
        try {
            await db.schema.dropTableIfExists('chat_room_members');
            await db.schema.dropTableIfExists('chat_messages');
        } catch (dropErr) {
            // Ignore silently if production DB user lacks drop privileges
        }

        const hasRooms = await db.schema.hasTable('chat_rooms');
        if (hasRooms) {
            // Drop legacy table if it doesn't have the optimized columns
            const hasMessagesCol = await db.schema.hasColumn('chat_rooms', 'messages');
            if (!hasMessagesCol) {
                try {
                    await db.schema.dropTable('chat_rooms');
                    console.log('Old chat_rooms table dropped for single-row optimization.');
                } catch (dropErr) {
                    console.warn('⚠️ Unable to drop legacy chat_rooms table due to lack of DROP permission.');
                }
            }
        }

        const hasRoomsUpdated = await db.schema.hasTable('chat_rooms');
        if (!hasRoomsUpdated) {
            await db.schema.createTable('chat_rooms', (table) => {
                table.increments('room_id').primary();
                table.integer('org_id').unsigned().notNullable();
                table.string('room_name', 255).nullable(); // NULL for 1-to-1 DMs
                table.enum('room_type', ['direct', 'group']).defaultTo('direct');
                table.integer('created_by').unsigned().nullable();
                table.text('member_ids').notNullable(); // JSON array of user IDs
                table.text('messages', 'longtext').notNullable(); // JSON array of message objects
                table.text('last_read_times').notNullable(); // JSON mapping user_id -> timestamp
                table.timestamps(true, true); // created_at, updated_at

                table.index(['org_id']);
            });
            console.log('Optimized table "chat_rooms" created successfully.');
        }

        // Collaboration / Chat database tables verified.
    } catch (error) {
        console.error('Error during Collaboration / Chat database initialization:', error);
    }
};
