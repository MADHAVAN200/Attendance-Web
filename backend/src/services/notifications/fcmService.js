import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { attendanceDB } from '../../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let messagingInstance = null;

// Initialize Firebase Admin
try {
  let credential = null;

  // Option 1: Env variable pointing to a service account JSON file
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const filePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(filePath)) {
      credential = admin.credential.cert(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    }
  }

  // Option 2: Look for default firebase-service-account.json in the backend directory
  if (!credential) {
    const defaultPath = path.join(__dirname, '../../../firebase-service-account.json');
    if (fs.existsSync(defaultPath)) {
      credential = admin.credential.cert(JSON.parse(fs.readFileSync(defaultPath, 'utf8')));
    }
  }

  // Option 3: Read from explicit env variables
  if (!credential && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    });
  }

  if (credential) {
    admin.initializeApp({
      credential,
    });
    messagingInstance = admin.messaging();
    console.log('✅ Firebase Admin SDK initialized successfully.');
  } else {
    console.warn('⚠️ Firebase Admin SDK not initialized: Missing firebase-service-account.json or environment credentials. Push notifications will be logged to console instead.');
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error);
}

/**
 * Register or update an FCM token for a user
 */
export const registerToken = async (userId, token, deviceType = 'android') => {
  try {
    const existing = await attendanceDB('user_fcm_tokens')
      .where({ token })
      .first();

    if (existing) {
      if (existing.user_id !== userId) {
        await attendanceDB('user_fcm_tokens')
          .where({ token })
          .update({
            user_id: userId,
            device_type: deviceType,
            updated_at: attendanceDB.fn.now()
          });
      }
    } else {
      await attendanceDB('user_fcm_tokens').insert({
        user_id: userId,
        token,
        device_type: deviceType,
        created_at: attendanceDB.fn.now(),
        updated_at: attendanceDB.fn.now()
      });
    }
    return true;
  } catch (error) {
    console.error(`Error saving FCM token for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Send push notification to all registered tokens of a user
 */
export const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    // Get all active tokens for the user
    const tokensRows = await attendanceDB('user_fcm_tokens')
      .where({ user_id: userId })
      .select('token');

    if (!tokensRows || tokensRows.length === 0) {
      console.log(`FCM: No active tokens registered for user ID ${userId}.`);
      return;
    }

    const tokens = tokensRows.map(row => row.token);

    if (!messagingInstance) {
      console.log(`[FCM Mock Push] To User ${userId}: Title="${title}", Body="${body}"`);
      return;
    }

    console.log(`Sending FCM push notification to ${tokens.length} devices of user ${userId}...`);

    // Prepare message payload
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        // String values only in FCM data payload
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      // ── Android config ──────────────────────────────────────────────────
      // 'high' priority ensures delivery even when the device is in Doze mode
      // and the app is killed. This is required for WhatsApp-style real-time delivery.
      android: {
        priority: 'high',
        notification: {
          // Must match the channel created in LocalNotificationService + AndroidManifest.xml
          channelId: 'high_importance_channel',
          channel_id: 'high_importance_channel',
          sound: 'default',
          defaultSound: true,
          // Use our custom monochrome icon (declared in AndroidManifest.xml meta-data)
          icon: 'ic_notification',
          color: '#5B60F6',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      // ── iOS / macOS config ───────────────────────────────────────────────
      apns: {
        headers: {
          'apns-priority': '10', // 10 = immediate delivery (like push for messages)
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true, // Wake the app even when in background on iOS
          },
        },
      },
    };

    // Send to each token
    const invalidTokens = [];
    for (const token of tokens) {
      try {
        await messagingInstance.send({
          token,
          ...message,
        });
      } catch (err) {
        console.error(`Error sending push notification to token:`, err.message);
        // If token is invalid/expired, queue it for cleanup
        if (
          err.code === 'messaging/registration-token-not-registered' ||
          err.code === 'messaging/invalid-registration-token' ||
          err.code === 'messaging/third-party-auth-error'
        ) {
          invalidTokens.push(token);
        }
      }
    }

    // Clean up stale/invalid tokens
    if (invalidTokens.length > 0) {
      console.log(`FCM: Cleaning up ${invalidTokens.length} stale tokens for user ${userId}.`);
      await attendanceDB('user_fcm_tokens')
        .whereIn('token', invalidTokens)
        .delete();
    }

  } catch (error) {
    console.error(`Error in sendPushNotification:`, error);
  }
};
