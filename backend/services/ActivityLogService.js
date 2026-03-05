import EventBus from '../utils/EventBus.js';
import { attendanceDB } from '../database.js';

class ActivityLogService {
    constructor() {
        this.init();
    }

    init() {
        EventBus.on(EventBus.events.ACTIVITY_LOG, this.handleActivityLog.bind(this));
        EventBus.on(EventBus.events.ERROR_LOG, this.handleErrorLog.bind(this));
        console.log('📜 Activity Log Service Initialized');
    }

    async handleActivityLog(payload) {
        try {
            const {
                user_id,
                org_id,
                event_type,
                event_source, // e.g., 'WEB', 'MOBILE'
                object_type,  // e.g., 'USER', 'ATTENDANCE'
                object_id,
                request_ip,
                user_agent,
                location,
                description,
                metadata
            } = payload;

            await attendanceDB('user_activity_logs').insert({
                user_id,
                org_id,
                event_type,
                event_source,
                object_type,
                object_id,
                request_ip,
                user_agent,
                location,
                description,
                metadata: metadata ? JSON.stringify(metadata) : null,
                occurred_at: new Date()
            });

        } catch (error) {
            console.error('❌ Activity Log Error:', error);
        }
    }

    async handleErrorLog(payload) {
        try {
            const {
                level = 'ERROR',
                service_name = 'BACKEND',
                user_id,
                org_id,
                error_code,
                error_message,
                stack_trace,
                request_method,
                request_path,
                client_ip,
                extra_context
            } = payload;

            await attendanceDB('application_error_logs').insert({
                level,
                service_name,
                user_id,
                org_id,
                error_code,
                error_message: error_message ? error_message.substring(0, 500) : 'Unknown Error',
                stack_trace,
                request_method,
                request_path,
                client_ip,
                extra_context: extra_context ? JSON.stringify(extra_context) : null,
                occurred_at: new Date()
            });

        } catch (error) {
            console.error('❌ Error Logging Failed:', error); // Fallback logging
        }
    }
}

export default new ActivityLogService();
