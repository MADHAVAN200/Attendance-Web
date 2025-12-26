import EventBus from '../utils/EventBus.js';
import { knexDB } from '../database.js';

class NotificationService {
    constructor() {
        this.init();
    }

    init() {
        EventBus.on(EventBus.events.NOTIFICATION, this.handleNotification.bind(this));
        console.log('🔔 Notification Service Initialized');
    }

    async handleNotification(payload) {
        try {
            const {
                org_id,
                user_id,
                type = 'INFO',
                title,
                message,
                related_entity_type,
                related_entity_id
            } = payload;

            if (!org_id || !user_id || !title) {
                console.warn('⚠️ Notification Service: Missing required fields', payload);
                return;
            }

            await knexDB('notifications').insert({
                org_id,
                user_id,
                type,
                title,
                message,
                related_entity_type,
                related_entity_id,
                is_read: 0,
                created_at: new Date()
            });

            // Future: Emit to Socket.IO for real-time update
            // const io = global.io; 
            // if(io) io.to(`user_${user_id}`).emit('new_notification', payload);

        } catch (error) {
            console.error('❌ Notification Service Error:', error);
        }
    }
}

export default new NotificationService();
