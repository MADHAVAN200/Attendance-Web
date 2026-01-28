import crypto from 'crypto';
import { knexDB } from '../database.js';

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
 */
export async function saveRefreshToken(userId, token, ipAddress, userAgent) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 Days validity

    await knexDB('refresh_tokens').insert({
        user_id: userId,
        token: token,
        expires_at: expiresAt,
        ip_address: ipAddress,
        user_agent: userAgent
    });
}

/**
 * Verify a refresh token and return the associated user
 * @param {string} token 
 * @returns {Promise<{user: any, refreshToken: any} | null>}
 */
export async function verifyRefreshToken(token) {
    const refreshTokenRecord = await knexDB('refresh_tokens')
        .where({ token: token })
        .first();

    if (!refreshTokenRecord) {
        // Token not found
        return null;
    }

    if (refreshTokenRecord.revoked) {
        // Check for Grace Period (Reuse within 60 seconds of replacement)
        if (refreshTokenRecord.replaced_by_token) {
            const replacementToken = await knexDB('refresh_tokens')
                .where({ token: refreshTokenRecord.replaced_by_token })
                .first();

            if (replacementToken) {
                const timeDiff = new Date() - new Date(replacementToken.created_at);
                const GRACE_PERIOD_MS = 60 * 1000; // 60 Seconds

                if (timeDiff < GRACE_PERIOD_MS) {
                    console.log(`Grace period active for token reuse. Returning valid replacement.`);
                    const user = await knexDB('users').where('user_id', refreshTokenRecord.user_id).first();
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
    const user = await knexDB('users').where('user_id', refreshTokenRecord.user_id).first();
    return { user, refreshTokenRecord };
}

/**
 * Revoke a specific refresh token (used on logout or rotation)
 * @param {string} token 
 * @param {string} replacedByToken optional
 */
export async function revokeRefreshToken(token, replacedByToken = null) {
    await knexDB('refresh_tokens')
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
    await knexDB('refresh_tokens')
        .where('user_id', userId)
        .update({ revoked: true });
}

