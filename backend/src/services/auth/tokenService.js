import crypto from 'crypto';
import { attendanceDB } from '../../config/database.js';

/**
 * Generate a cryptographically strong random token
 * @returns {string}
 */
export function generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
}

/**
 * Save a refresh token to the database
 * @param {number} userId 
 * @param {string} token 
 * @param {string} ipAddress 
 * @param {string} userAgent 
 * @param {boolean} rememberMe
 */

export async function saveRefreshToken(userId, token, ipAddress, userAgent, rememberMe = false) {
    const expiresAt = new Date();
    const validityDays = rememberMe ? 30 : 30;
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    await attendanceDB('refresh_tokens').insert({
        user_id: userId,
        token: token,
        expires_at: expiresAt,
        ip_address: ipAddress,
        user_agent: userAgent,
        remember_me: rememberMe ? 1 : 0
    });
}

/**
 * Verify a refresh token and return the associated user
 * @param {string} token 
 * @returns {Promise<{user: any, refreshToken: any} | null>}
 */
export async function verifyRefreshToken(token) {
    const refreshTokenRecord = await attendanceDB('refresh_tokens')
        .where({ token: token })
        .first();

    if (!refreshTokenRecord) {
        // Token not found
        return null;
    }

    if (refreshTokenRecord.revoked) {
        // Check for Grace Period (Reuse within 60 seconds of replacement)
        if (refreshTokenRecord.replaced_by_token) {
            const replacementToken = await attendanceDB('refresh_tokens')
                .where({ token: refreshTokenRecord.replaced_by_token })
                .first();

            if (replacementToken) {
                const timeDiff = new Date() - new Date(replacementToken.created_at);
                const GRACE_PERIOD_MS = 300 * 1000; // 5 Minutes (Increased for stability)

                if (timeDiff < GRACE_PERIOD_MS) {
                    console.log(`Grace period active for token reuse. Returning valid replacement.`);
                    const user = await attendanceDB('users').where('user_id', refreshTokenRecord.user_id).first();
                    return {
                        user,
                        gracePeriodActive: true,
                        activeRefreshToken: replacementToken.token
                    };
                }
            }
        }

        // Token revoked and outside grace period - Potential Reuse Attack!
        console.warn(`Token Reuse Detected! Revoking all tokens for user ${refreshTokenRecord.user_id}`);
        await revokeAllTokensForUser(refreshTokenRecord.user_id);
        return { error: 'Reuse Detected' };
    }

    if (new Date() > new Date(refreshTokenRecord.expires_at)) {
        // Token expired
        return null;
    }

    // Token is valid, return user details
    const user = await attendanceDB('users').where('user_id', refreshTokenRecord.user_id).first();

    if (!user || !user.is_active || user.is_deleted) {
        // Revoke if user is blocked
        await revokeAllTokensForUser(refreshTokenRecord.user_id);
        return { error: 'User Blocked or Deleted' };
    }

    return { user, refreshTokenRecord };
}

/**
 * Revoke a specific refresh token (used on logout or rotation)
 * @param {string} token 
 * @param {string} replacedByToken optional
 */
export async function revokeRefreshToken(token, replacedByToken = null) {
    await attendanceDB('refresh_tokens')
        .where('token', token)
        .update({
            revoked: true,
            replaced_by_token: replacedByToken
        });
}

/**
 * Revoke all tokens for a user (e.g. change password)
 * @param {number} userId 
 */
export async function revokeAllTokensForUser(userId) {
    await attendanceDB('refresh_tokens')
        .where('user_id', userId)
        .update({ revoked: true });
}

/**
 * Extend a refresh token by 30 days from now (Sliding Session)
 * @param {string} token 
 */
export async function extendRefreshToken(token) {
    const record = await attendanceDB('refresh_tokens')
        .where('token', token)
        .first();

    const isRememberMe = record?.remember_me === 1;
    const expiresAt = new Date();
    const validityDays = isRememberMe ? 30 : 30;
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    await attendanceDB('refresh_tokens')
        .where('token', token)
        .update({ expires_at: expiresAt });
}
