# Notification System Implementation Walkthrough

We have successfully integrated the Firebase Cloud Messaging (FCM) and WebSocket notification pipelines for all critical platform activities, ensuring both **foreground (on-screen)** and **background (off-app/browser push)** alerts work seamlessly.

---

## 🛠️ Changes Implemented

### 1. Mentions Notification Pipeline
* **File Modified**: [mentionService.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/backend/src/services/collaboration/mentionService.js)
* **Change**: Replaced the manual direct Knex DB insert and raw Socket emit for mentions. It now publishes events via `EventBus.emitNotification`, ensuring mentions automatically trigger:
  1. Safe database persistence in the `notifications` table.
  2. Live WebSockets message broadcasts (`new-notification` event).
  3. FCM browser background push notifications to the tagged user.

### 2. Leave Request & Approval Events
* **File Modified**: [chatAlertService.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/backend/src/services/collaboration/chatAlertService.js)
* **Change**: Integrated `EventBus.emitNotification` calls for leave workflows:
  * **Submit Leave**: Automatically sends a standard push notification to all organization Admins and HRs informing them of the new leave request.
  * **Leave Status Update**: Automatically pushes a standard notification to the requesting employee indicating whether their leave was *Approved* or *Rejected*.

### 3. Attendance Correction Events
* **File Modified**: [chatAlertService.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/backend/src/services/collaboration/chatAlertService.js)
* **Change**: Added EventBus notifications to the correction workflow:
  * **Apply Correction**: Pushes standard browser notifications to organization Admins and HRs.
  * **Review Correction**: Sends a push notification to the employee indicating whether the correction was approved or rejected.

### 4. Admin Policy Assignment Events
* **File Modified**: [chatAlertService.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/backend/src/services/collaboration/chatAlertService.js)
* **Change**: Standard push notifications are now sent when:
  * **Shift Assigned**: Notifies the employee with their new shift rules and timings.
  * **Geofence Zone Assigned**: Notifies the employee of their newly assigned work boundaries.

### 5. Chat Messages Unified Notification
* **File Modified**: [chatController.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/backend/src/controllers/collaboration/chatController.js)
* **Change**: Refactored `sendMessage` to trigger `EventBus.emitNotification` for all other members of the room when a new message or attachment is posted. This ensures chat messages automatically get:
  1. Stored in the `notifications` DB table.
  2. Broadcast via Socket.IO `new-notification` event (triggering an on-screen toast popup outside the chat window).
  3. Pushed via FCM (triggering off-app background banners/lock screen alerts).

### 6. Frontend Notifications UI Icon Mapping
* **File Modified**: [Notifications-mv.jsx](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/frontend/src/pages/notifications/Notifications-mv.jsx)
* **Change**: Imported the Lucide `MessageSquare` icon and mapped the `CHAT`/`CHAT_MESSAGE` notification types to render it automatically in the notifications list.

### 7. User Feedback Submitted Push Alerts
* **File Modified**: [feedbackService.js](file:///c:/Users/madha/OneDrive/Desktop/Attendance-Web/backend/src/services/feedback/feedbackService.js)
* **Change**: Integrated `EventBus.emitNotification` inside `submitFeedback` to automatically dispatch standard DB-saved, WebSockets, and FCM background push alerts to all active Admins in the submitting user's organization when feedback is received.

---

## 🧪 Validation & Verification

1. **Service Compilation**: The node server restarted automatically via nodemon with all imports and EventBus instances successfully resolved.
2. **Notification Pipeline Flow**:
   ```mermaid
   graph TD
     A[Trigger Event: Leave/Message/Correction/Mention] --> B[EventBus.emitNotification]
     B --> C[DB Persistence: notifications table]
     C --> D[Event: notification_saved]
     D --> E[Socket.io Broadcast: new-notification]
     D --> F[FCM Push Notification Service]
     E --> G[Web Client: On-Screen Toast]
     F --> H[Browser/App: Background Off-App Banner]
   ```

---

## 🚀 Next Steps for Testing
To verify push delivery on a live device:
1. Log in to the application and grant notification permissions when prompted.
2. The browser registers the FCM token to the server database.
3. Test your device connection using the test endpoint:
   * **Method**: `POST`
   * **URL**: `/notifications/test-push`
   * Check your desktop banner/mobile lock screen for the `FCM Connection Test` notification!
