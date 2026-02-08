
import cron from 'node-cron';
import { knexDB } from '../database.js';
import EventBus from '../utils/EventBus.js';

export const initSubscriptionManager = () => {
    // Run every day at midnight (00:00)
    cron.schedule('0 0 * * *', async () => {
        console.log('⏰ Running Subscription Checks...');
        await checkExpiredSubscriptions();
    });
    console.log('📅 Subscription Manager Scheduler Initialized');
};

async function checkExpiredSubscriptions() {
    try {
        const today = new Date();

        // 1. Find organizations expiring today or already expired but still active
        const expiredOrgs = await knexDB('organizations')
            .where('status', 'active')
            .whereNotNull('subscription_expiry')
            .where('subscription_expiry', '<', today);

        for (const org of expiredOrgs) {
            console.log(`Checking expiry for Org: ${org.name || org.org_name} (${org.id})`);

            // Check grace period
            const endDate = new Date(org.subscription_expiry);
            const gracePeriod = org.grace_period_days || 0;
            const hardStopDate = new Date(endDate);
            hardStopDate.setDate(hardStopDate.getDate() + gracePeriod);

            if (today > hardStopDate) {
                // EXPIRE ORGANIZATION
                await knexDB('organizations')
                    .where('id', org.id)
                    .update({ status: 'suspended' }); // Use 'suspended' or 'inactive'

                // Log History
                await knexDB('subscription_history').insert({
                    org_id: org.id,
                    change_type: 'cancellation', // 'cancel' or 'cancellation'
                    plan_name: org.subscription_plan,
                    end_date: org.subscription_expiry,
                    performed_by: null, // System
                });

                EventBus.emitActivityLog({
                    user_id: null, // System Action
                    org_id: org.id,
                    event_type: 'SUBSCRIPTION_EXPIRED',
                    event_source: 'SYSTEM_CRON',
                    object_type: 'ORGANIZATION',
                    object_id: org.id,
                    description: `Organization suspended due to expired subscription (Grace period: ${gracePeriod} days exceeded).`,
                    request_ip: '127.0.0.1',
                    user_agent: 'Node-Cron'
                });

                // Trigger Alert
                await knexDB('security_alerts').insert({
                    org_id: org.id,
                    alert_type: 'SUBSCRIPTION_EXPIRED',
                    severity: 'medium',
                    description: `Organization ${org.name} subscription expired. Status set to suspended.`,
                    status: 'open'
                });

            } else {
                // WARNING STATE
                console.log(`Org ${org.id} is in grace period until ${hardStopDate}`);
            }
        }

    } catch (error) {
        console.error('❌ Subscription Check Error:', error);
    }
}
