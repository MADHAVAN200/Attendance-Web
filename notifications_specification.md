# Attendance Web - Real-Time & Push Notification Specification

This specification catalogs all API endpoints, payload configurations, triggers, and events related to browser push and real-time on-screen/off-app notifications. Use these details to align notification functionality on any platform client (e.g., mobile, desktop, web).

---

## 1. Architecture Overview
The platform supports three channels for notifying users:
- **Database + FCM (Off-App/Background)**: All standard notifications are logged to the `notifications` database table. Saving to this table triggers an EventBus listener (`notification_saved`) which automatically fires an FCM (Firebase Cloud Messaging) push message to all devices registered to that user.
- **WebSockets (On-Screen/Foreground)**: Live notifications are pushed to active browser sessions via Socket.IO (`new-notification` or `new_notification`).
- **System DM Chat Alerts**: Actions requiring visual workflow approvals (like Leave Requests, Correction Requests, Shift/Geofence assignments) are pushed as interactive rich card components in the direct messaging (DM) chat rooms.

---

## 2. API Endpoints
All endpoints are prefixed with `/notifications` and require JWT authentication.

### `POST /notifications/register-token`
Registers a device FCM token to the current user.
- **Request Body**:
  ```json
  {
    "token": "FCM_REGISTRATION_TOKEN_HERE",
    "device_type": "web" // or "android", "ios"
  }
  ```
- **Response**:
  ```json
  {
    "ok": true,
    "message": "FCM token registered successfully"
  }
  ```

### `GET /notifications`
Fetch notifications for the logged-in user.
- **Query Params**:
  - `limit` (default: `20`, max: `50`)
  - `unread_only` (default: `false`)
- **Response**:
  ```json
  {
    "ok": true,
    "data": [
      {
        "notification_id": 1,
        "org_id": 1,
        "user_id": 10,
        "type": "SUCCESS",
        "title": "Attendance Checked In",
        "message": "You have successfully checked in at 2026-06-04T12:00:00 from Main Office",
        "is_read": 0,
        "related_entity_type": "ATTENDANCE",
        "related_entity_id": "142",
        "created_at": "2026-06-04T12:00:05.000Z"
      }
    ],
    "unread_count": 1
  }
  ```

### `PUT /notifications/:id/read`
Marks a specific notification as read.
- **Response**:
  ```json
  {
    "ok": true,
    "message": "Marked as read"
  }
  ```

### `PUT /notifications/read-all`
Marks all notifications for the user as read.
- **Response**:
  ```json
  {
    "ok": true,
    "message": "All notifications marked as read",
    "updated_count": 5
  }
  ```

### `POST /notifications/test-push`
Triggers an immediate test FCM push notification to the logged-in user's active tokens.
- **Response**:
  ```json
  {
    "ok": true,
    "message": "Test push notification request sent successfully"
  }
  ```

---

## 3. Push Notification Payloads & Settings (FCM)
When sending FCM messages from the backend, the following configurations are applied to ensure reliable background delivery:

### FCM Message Structure
```json
{
  "notification": {
    "title": "Notification Title",
    "body": "Notification Body Message"
  },
  "data": {
    "notification_id": "123",
    "type": "SUCCESS",
    "click_action": "FLUTTER_NOTIFICATION_CLICK"
  },
  "android": {
    "priority": "high",
    "notification": {
      "channelId": "high_importance_channel",
      "sound": "default",
      "defaultSound": true,
      "icon": "ic_notification",
      "color": "#5B60F6",
      "clickAction": "FLUTTER_NOTIFICATION_CLICK"
    }
  },
  "apns": {
    "headers": {
      "apns-priority": "10"
    },
    "payload": {
      "aps": {
        "sound": "default",
        "badge": 1,
        "contentAvailable": true
      }
    }
  }
}
```

---

## 4. Triggered Events Catalog
Below is the full catalog of events in the platform that trigger notifications:

### Standard DB-Saved & FCM Push Events (Via EventBus)

| Event Name | Trigger Code Location | Title | Message Template | Type | Entity Type | Entity ID |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Attendance Checked In** | `attendanceService.js` (L145) | `"Attendance Checked In"` | `"You have successfully checked in at {localTime} from {address}"` | `SUCCESS` | `"ATTENDANCE"` | `{attendance_id}` |
| **Attendance Checked Out** | `attendanceService.js` (L307) | `"Attendance Checked Out"` | `"You have successfully checked out at {localTime}. Total hours today: {hours}h"` | `INFO` | `"ATTENDANCE"` | `{attendance_id}` |
| **Missed Clock-Out** | `AttendanceProcessor.js` (L152) | `"Missed Time Out"` | `"You forgot to check out on {dateStr}. Please submit a correction request to fix your hours, otherwise it will be marked as absent."` | `WARNING` | `"ATTENDANCE"` | `null` |
| **Attendance Escalated** | `AttendanceProcessor.js` (L266) | `"Attendance Marked Absent"` | `"Your attendance for {dateStr} has been marked as ABSENT because the missed checkout was not corrected within {graceDays} days."` | `ERROR` | `"ATTENDANCE"` | `null` |
| **Report Ready** | `reportWorker.js` (L59) | `"Report Ready"` | `"Your requested {type} ({format}) report is completed and ready for download."` | `SUCCESS` | `"REPORT"` | `{reportId}` |
| **Report Failed** | `reportWorker.js` (L82) | `"Report Failed"` | `"Your requested {type} report generation failed: {error}"` | `ERROR` | `"REPORT"` | `{reportId}` |
| **New Chat Message** | `chatController.js` (L677) | `"{senderName}"` or `"{senderName} in {groupName}"` | `"{messageText}"` or `"Sent an attachment"` | `CHAT` | `"CHAT_MESSAGE"` | `{roomId}` |
| **User Feedback Submitted** | `feedbackService.js` (L74) | `"Feedback Submitted"` | `"A new feedback/bug report has been submitted by {userName}."` | `INFO` | `"FEEDBACK"` | `{feedbackId}` |
| **User Mentioned (General)**| `mentionService.js` (L68) | `"New Mention"` | `"{senderName} mentioned you."` | `INFO` | `{context_type}` | `{context_id}` |
| **User Mentioned (Chat)** | `mentionService.js` (L72) | `"Mentioned in Chat"` | `"{senderName} mentioned you in a chat message."` | `INFO` | `"chat_message"`| `{message_id}` |
| **User Mentioned (DAR)** | `mentionService.js` (L75) | `"Mentioned in DAR"` | `"{senderName} tagged you in their Daily Activity Report task."` | `INFO` | `"dar_activity"`| `{activity_id}` |
| **User Mentioned (Meeting)** | `mentionService.js` (L78) | `"Mentioned in Meeting"`| `"{senderName} tagged you in a Daily Activity Report meeting."` | `INFO` | `"dar_meeting"` | `{event_id}` |

---

### System Chat DM Card Alerts (Via WebSocket/DM Message)
These trigger direct messages in chat containing system card structures: `[SYSTEM_CARD:card_type:entity_id:status] {Payload JSON}`.

1. **Leave Applied (`leave_request`)**
   - **Recipient**: All active organization Admins & HRs.
   - **Status**: `"Pending"`
   - **Payload**:
     ```json
     {
       "employee_name": "John Doe",
       "leave_type": "Sick Leave",
       "start_date": "2026-06-10",
       "end_date": "2026-06-12",
       "reason": "Doctor appointment",
       "local_time": "2026-06-04T12:00:00.000Z",
       "attachments": [{"name": "medical.pdf", "url": "..."}]
     }
     ```

2. **Leave Status Updated (`leave_request`)**
   - **Recipient**: The requesting employee.
   - **Status**: `"Approved"` or `"Rejected"`
   - **Payload**:
     ```json
     {
       "reviewer_name": "Admin Smith",
       "leave_type": "Sick Leave",
       "start_date": "2026-06-10",
       "end_date": "2026-06-12",
       "reason": "Doctor appointment",
       "admin_comment": "Approved, get well soon!",
       "status": "Approved",
       "local_time": "2026-06-04T12:30:00.000Z",
       "attachments": []
     }
     ```

3. **Correction Request Applied (`correction_request`)**
   - **Recipient**: All active organization Admins & HRs.
   - **Status**: `"pending"`
   - **Payload**:
     ```json
     {
       "employee_name": "John Doe",
       "correction_type": "Forgot Clock Out",
       "request_date": "2026-06-03",
       "reason": "Internet outage at checkout time",
       "local_time": "2026-06-04T12:00:00.000Z",
       "proposed_data": [{"time_in": "09:00:00", "time_out": "18:00:00"}]
     }
     ```

4. **Correction Request Reviewed (`correction_request`)**
   - **Recipient**: The requesting employee.
   - **Status**: `"approved"` or `"rejected"`
   - **Payload**:
     ```json
     {
       "reviewer_name": "HR Jane",
       "correction_type": "Forgot Clock Out",
       "request_date": "2026-06-03",
       "reason": "Internet outage at checkout time",
       "review_comments": "Verified and applied to records.",
       "status": "approved",
       "local_time": "2026-06-04T12:45:00.000Z"
     }
     ```

5. **Shift Assigned (`shift_assign`)**
   - **Recipient**: The assigned employee.
   - **Status**: `"Active"`
   - **Payload**:
     ```json
     {
       "admin_name": "Admin Smith",
       "shift_name": "Day Shift",
       "start_time": "09:00:00",
       "end_time": "18:00:00",
       "grace_period_mins": 15,
       "local_time": "2026-06-04T13:00:00.000Z"
     }
     ```

6. **Geofence Zone Assigned (`geofence_assign`)**
   - **Recipient**: The assigned employee.
   - **Status**: `"Active"`
   - **Payload**:
     ```json
     {
       "admin_name": "Admin Smith",
       "location_name": "Headquarters",
       "address": "123 Technology Park, Suite A",
       "radius": 150,
       "local_time": "2026-06-04T13:05:00.000Z"
     }
     ```

---

## 5. Web Client Handlers (Standard Reference)

### Service Worker Handlers (`firebase-messaging-sw.js`):
Background/off-app notifications show via native browser controls.
```javascript
messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || 'Workforce Alert';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new real-time alert.',
        icon: '/mano-logo.svg',
        data: payload.data || {},
        tag: payload.data?.notification_id || 'workforce-notification'
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});
```

### Foreground Context Handlers (`NotificationContext.jsx`):
If the app is in the foreground, active socket connection handles the notification to show beautiful toast popups. If the socket is inactive/disconnected, it falls back to the FCM foreground handler.
```javascript
// WebSockets
socket.on('new-notification', (notif) => {
    showInAppToast(notif.title, notif.message);
});

// FCM Foreground Fallback
onForegroundMessage((payload) => {
    if (!socket || !socket.connected) {
        showInAppToast(payload.notification?.title, payload.notification?.body);
    }
});
```
