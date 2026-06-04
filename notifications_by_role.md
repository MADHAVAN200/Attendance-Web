# Attendance Web - Notifications Catalog by User Role

This document details all standard database, real-time WebSocket, background FCM, and DM Chat Alert notifications categorized by user roles (**Employee**, **HR**, and **Admin**).

---

## 1. Employee Notifications
Employees receive notifications concerning their attendance logs, shift/geofence assignments, collaboration tags/mentions, leave request updates, and direct messaging chats.

| Trigger Event | Notification Title | Notification Message Template | Deliverable Channels | Description / Context |
| :--- | :--- | :--- | :--- | :--- |
| **Attendance Clock-In** | `"Attendance Checked In"` | `"You have successfully checked in at {localTime} from {address}"` | DB, Websocket, FCM | Triggered instantly upon a successful check-in (Time-In). |
| **Attendance Clock-Out** | `"Attendance Checked Out"` | `"You have successfully checked out at {localTime}. Total hours today: {hours}h"` | DB, Websocket, FCM | Triggered instantly upon a successful check-out (Time-Out). |
| **Missed Clock-Out Warning**| `"Missed Time Out"` | `"You forgot to check out on {dateStr}. Please submit a correction request to fix your hours..."` | DB, Websocket, FCM | Triggered by the hourly processor at the end of the shift day. |
| **Escalated Missed Punch** | `"Attendance Marked Absent"` | `"Your attendance for {dateStr} has been marked as ABSENT because the missed checkout was not corrected..."` | DB, Websocket, FCM | Triggered when the correction grace period (e.g. 2 days) expires. |
| **Leave Status Reviewed** | `"Leave Request Approved"` or `"Leave Request Rejected"` | `"Your leave request for {leaveType} has been {status} by {reviewerName}."` | DB, Websocket, FCM, DM Chat Card | Sent instantly when an Admin/HR approves or rejects their leave application. |
| **Correction Reviewed** | `"Correction Request Approved"` or `"Correction Request Rejected"` | `"Your attendance correction request for {date} has been {status} by {reviewerName}."` | DB, Websocket, FCM, DM Chat Card | Sent instantly when an Admin/HR approves or rejects a correction. |
| **Shift Policy Assigned** | `"New Shift Assigned"` | `"You have been assigned to shift \"{shiftName}\" ({start} - {end}) by {adminName}."` | DB, Websocket, FCM, DM Chat Card | Triggered when the Admin assigns a new work shift to the employee. |
| **Geofence Zone Assigned** | `"Work Location Assigned"` | `"You have been assigned to work location \"{locationName}\" by {adminName}."` | DB, Websocket, FCM, DM Chat Card | Triggered when the Admin assigns a new geofenced work location. |
| **New Chat Message** | `"{senderName}"` | `"{messageText}"` or `"Sent an attachment"` | Websocket, FCM | Received when another employee or manager sends a direct message. |
| **Group Chat Message** | `"{senderName} in {groupName}"` | `"{messageText}"` or `"Sent an attachment"` | Websocket, FCM | Received when a message is sent in an active group chat. |
| **Tagged in Chat Message** | `"Mentioned in Chat"` | `"{senderName} mentioned you in a chat message."` | DB, Websocket, FCM | Triggered when a coworker tags them using `@username` in chat. |
| **Tagged in DAR Activity** | `"Mentioned in DAR"` | `"{senderName} tagged you in their Daily Activity Report task."` | DB, Websocket, FCM, DM Chat Link | Triggered when a coworker tags them in their daily tasks. |
| **Tagged in DAR Meeting** | `"Mentioned in Meeting"` | `"{senderName} tagged you in a Daily Activity Report meeting."` | DB, Websocket, FCM, DM Chat Link | Triggered when a coworker tags them in a meeting note. |
| **Personal Report Ready** | `"Report Ready"` | `"Your requested {type} ({format}) report is completed and ready for download."` | DB, Websocket, FCM | Triggered when their self-requested attendance report is generated. |

---

## 2. HR Notifications
HR managers receive notifications required to audit employee time-logs, process request queues, and collaborate on team activities.

| Trigger Event | Notification Title | Notification Message Template | Deliverable Channels | Description / Context |
| :--- | :--- | :--- | :--- | :--- |
| **Employee Leaves Applied** | `"New Leave Application"` | `"{employeeName} has applied for {leaveType} ({startDate} to {endDate})."` | DB, Websocket, FCM, DM Chat Card | Sent to all active HRs when an employee submits a leave request. |
| **Employee Corrections** | `"New Correction Request"` | `"{employeeName} has submitted an attendance correction request for {date}."` | DB, Websocket, FCM, DM Chat Card | Sent to all active HRs when an employee requests a punch correction. |
| **Chat message received** | `"{senderName}"` or `"{sender} in {group}"`| `"{messageText}"` | Websocket, FCM | Direct messages and group messages related to their team. |
| **General Mention** | `"New Mention"` or `"Mentioned..."` | `"{senderName} mentioned you..."` | DB, Websocket, FCM | Triggered when tagged in chat rooms, tasks, or event calendars. |
| **HR Report Ready** | `"Report Ready"` | `"Your requested {type} ({format}) report is completed and ready for download."` | DB, Websocket, FCM | Sent when department summaries or compliance spreadsheets are ready. |
| **HR Report Generation Failed**| `"Report Failed"` | `"Your requested {type} report generation failed: {error}"` | DB, Websocket, FCM | Sent when a large department export job fails. |

---

## 3. Admin Notifications
Administrators receive system-wide operational alerts, workspace configuration updates, compliance exception flags, and billing/feedback logs.

| Trigger Event | Notification Title | Notification Message Template | Deliverable Channels | Description / Context |
| :--- | :--- | :--- | :--- | :--- |
| **Employee Leaves Applied** | `"New Leave Application"` | `"{employeeName} has applied for {leaveType} ({startDate} to {endDate})."` | DB, Websocket, FCM, DM Chat Card | Sent to all organization Admins when an employee applies for leave. |
| **Employee Corrections** | `"New Correction Request"` | `"{employeeName} has submitted an attendance correction request for {date}."` | DB, Websocket, FCM, DM Chat Card | Sent to all organization Admins when an employee submits a correction. |
| **User Feedback Submitted** | `"Feedback Submitted"` | `"A new feedback / bug report has been submitted by {userName}."` | Email (Standard Alert) | Sent to registered admin emails for support/maintenance tracking. |
| **Chat message received** | `"{senderName}"` or `"{sender} in {group}"`| `"{messageText}"` | Websocket, FCM | Direct messages and group messages. |
| **General Mention** | `"New Mention"` or `"Mentioned..."` | `"{senderName} mentioned you..."` | DB, Websocket, FCM | Tagged in chat rooms, tasks, or event calendars. |
| **Admin Report Ready** | `"Report Ready"` | `"Your requested {type} ({format}) report is completed and ready for download."` | DB, Websocket, FCM | Sent when company-wide compliance or payroll worksheets are ready. |
| **Admin Report Failed** | `"Report Failed"` | `"Your requested {type} report generation failed: {error}"` | DB, Websocket, FCM | Sent if S3 uploads or workbook builds for company-wide exports fail. |

---

## 4. Key Client Channels Matrix

1. **On-App / Foreground (Websocket)**
   * **Receiver Event**: `new-notification`
   * **Action**: Increment unread notifications count, append to list in real-time, and trigger a styled in-app Toast banner popup.
2. **Off-App / Background (FCM)**
   * **Receiver Event**: `onBackgroundMessage` (via `firebase-messaging-sw.js` service worker)
   * **Action**: Display native OS/browser push banner. When clicked, it automatically refocuses/opens the client app and redirects directly to the `/notifications` page.
