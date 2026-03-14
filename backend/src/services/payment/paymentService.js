import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create a Razorpay customer.
 */
export async function createCustomer({ name, email, contact }) {
    const customer = await razorpay.customers.create({ name, email, contact });
    return customer.id;
}

/**
 * Create a Razorpay order.
 */
export async function createOrder({ amount, currency = 'INR', receipt, notes, customer_id }) {
    const options = {
        amount: amount * 100, // Convert to subunits (paise)
        currency,
        receipt,
        notes,
        payment_capture: 1
    };

    if (customer_id) {
        options.customer_id = customer_id;
    }

    return await razorpay.orders.create(options);
}

/**
 * Verify a Razorpay payment signature.
 * Returns true if signature is valid.
 */
export function verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    return expectedSignature === razorpay_signature;
}

/**
 * Verify a Razorpay webhook signature.
 * Returns true if the webhook signature is valid.
 */
// export function verifyWebhookSignature(body, signature) {
//     const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
//     const expectedSignature = crypto
//         .createHmac('sha256', secret)
//         .update(JSON.stringify(body))
//         .digest('hex');
//
//     return expectedSignature === signature;
// }
//
// /**
//  * Handle a verified webhook event.
//  */
// export function handleWebhookEvent(event, payload) {
//     if (event === 'payment.captured') {
//         const payment = payload.payment.entity;
//         console.log('Payment Captured:', payment.id);
//         // TODO: Failsafe update to DB if frontend verify missed it
//     }
// }
