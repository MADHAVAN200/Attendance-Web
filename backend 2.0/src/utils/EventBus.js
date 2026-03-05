import { EventEmitter } from 'events';

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
