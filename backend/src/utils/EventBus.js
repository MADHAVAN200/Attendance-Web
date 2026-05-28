import { EventEmitter } from 'events';
import { attendanceDB } from '../config/database.js';

class AppEventBus extends EventEmitter {
    constructor() {
        super();
        this.events = {
            NOTIFICATION: 'notification',
            ACTIVITY_LOG: 'activity_log',
            USER_CREATED: 'user_created',
            ATTENDANCE_LOGGED: 'attendance_logged',
            ERROR_LOG: 'error_log'
        };

        // Listen for activity logs and save to Database
        this.on(this.events.ACTIVITY_LOG, async (payload) => {
            try {
                const logData = {
                    user_id: payload.user_id || null,
                    org_id: payload.org_id || null,
                    event_type: payload.event_type || 'ACTIVITY',
                    event_source: payload.event_source || 'API',
                    object_type: payload.object_type || null,
                    object_id: payload.object_id || null,
                    request_ip: payload.request_ip || null,
                    user_agent: payload.user_agent || null,
                    location: payload.location || null,
                    description: payload.description || '',
                    metadata: payload.metadata ? (typeof payload.metadata === 'object' ? JSON.stringify(payload.metadata) : payload.metadata) : null,
                    occurred_at: attendanceDB.fn.now()
                };
                await attendanceDB('user_activity_logs').insert(logData);
            } catch (err) {
                console.error('[EventBus DB Activity Log Error]:', err);
            }
        });

        // Listen for error logs and save to Database
        this.on(this.events.ERROR_LOG, async (payload) => {
            try {
                const logData = {
                    level: payload.level || 'ERROR',
                    service_name: payload.service_name || 'backend-api',
                    environment: payload.environment || process.env.NODE_ENV || 'production',
                    user_id: payload.user_id || null,
                    org_id: payload.org_id || null,
                    error_code: payload.error_code || null,
                    error_message: payload.error_message || '',
                    stack_trace: payload.stack_trace || null,
                    request_method: payload.request_method || null,
                    request_path: payload.request_path || null,
                    request_id: payload.request_id || null,
                    client_ip: payload.client_ip || null,
                    extra_context: payload.extra_context ? (typeof payload.extra_context === 'object' ? JSON.stringify(payload.extra_context) : payload.extra_context) : null,
                    occurred_at: attendanceDB.fn.now()
                };
                await attendanceDB('application_error_logs').insert(logData);
            } catch (err) {
                console.error('[EventBus DB Error Log Error]:', err);
            }
        });

        // Listen for notifications and save to Database, then emit 'notification_saved' for Socket.IO
        this.on(this.events.NOTIFICATION, async (payload) => {
            try {
                const notificationData = {
                    org_id: payload.org_id || null,
                    user_id: payload.user_id,
                    title: payload.title || '',
                    message: payload.message || '',
                    type: payload.type || 'INFO',
                    related_entity_type: payload.related_entity_type || null,
                    related_entity_id: payload.related_entity_id || null,
                    is_read: 0,
                    created_at: attendanceDB.fn.now()
                };
                const [insertedId] = await attendanceDB('notifications').insert(notificationData);
                
                // Fetch the fully inserted database row to get exact timestamps and auto-generated fields
                const savedNotification = await attendanceDB('notifications')
                    .where({ notification_id: insertedId })
                    .first();

                if (savedNotification) {
                    this.emit('notification_saved', savedNotification);
                }
            } catch (err) {
                console.error('[EventBus DB Notification Error]:', err);
            }
        });
    }

    emitNotification(payload) {
        this.emit(this.events.NOTIFICATION, payload);
    }

    emitActivityLog(payload) {
        this.emit(this.events.ACTIVITY_LOG, payload);
    }

    emitError(payload) {
        this.emit(this.events.ERROR_LOG, payload);
    }
}

const EventBus = new AppEventBus();
export default EventBus;
