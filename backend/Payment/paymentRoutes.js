import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
// import { db } from '../database.js'; // Assuming you have a db connection exported

dotenv.config();

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// 1. Create Customer (Optional but recommended)
// Checks if user already has a customer_id, if not creates one
router.post('/create-customer', async (req, res) => {
    try {
        const { name, email, contact, userId } = req.body;

        // Check DB for existing customer_id (Psuedo-code, replace with actual DB query)
        // const [user] = await db.query('SELECT razorpay_customer_id FROM users WHERE id = ?', [userId]);
        // if (user[0].razorpay_customer_id) return res.json({ customer_id: user[0].razorpay_customer_id });

        const customer = await razorpay.customers.create({
            name,
            email,
            contact
        });

        // Save customer.id to your DB against the user
        // await db.query('UPDATE users SET razorpay_customer_id = ? WHERE id = ?', [customer.id, userId]);

        res.json({ customer_id: customer.id });
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// 2. Create Order
router.post('/create-order', async (req, res) => {
    try {
        const { amount, currency = 'INR', receipt, notes, customer_id } = req.body;

        const options = {
            amount: amount * 100, // Convert to subunits (paise)
            currency,
            receipt,
            notes,
            payment_capture: 1 // Auto capture
        };

        if (customer_id) {
            options.customer_id = customer_id;
        }

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// 3. Verify Payment
router.post('/verify', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Signature matches - Payment Successful
            // TODO: Update Database with 'Active' Subscription status
            // await db.query('UPDATE users SET subscription_status = ? WHERE ...', ['active']);

            res.json({ status: 'success', message: 'Payment verified successfully' });
        } else {
            res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 4. Webhook Handler
// NOTE: You must add this URL (e.g., https://yourapi.com/api/payment/webhook) to Razorpay Dashboard > Settings > Webhooks
// router.post('/webhook', (req, res) => {
//     const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

//     // Razorpay sends signature in this header
//     const shasum = crypto.createHmac('sha256', secret);
//     shasum.update(JSON.stringify(req.body));
//     const digest = shasum.digest('hex');

//     if (digest === req.headers['x-razorpay-signature']) {
//         console.log('Webhook verified');

//         // Handle events
//         const event = req.body.event;
//         if (event === 'payment.captured') {
//             const payment = req.body.payload.payment.entity;
//             console.log('Payment Captured:', payment.id);
//             // TODO: Failsafe update to DB if frontend verify missed it
//         }

//         res.json({ status: 'ok' });
//     } else {
//         res.status(400).json({ status: 'invalid signature' });
//     }
// });

export default router;
