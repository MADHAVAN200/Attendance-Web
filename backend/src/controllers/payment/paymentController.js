import catchAsync from '../../utils/catchAsync.js';
import * as paymentService from '../../services/payment/paymentService.js';

/**
 * POST /payment/create-customer
 */
export const createCustomer = catchAsync(async (req, res) => {
    const { name, email, contact } = req.body;

    const customer_id = await paymentService.createCustomer({ name, email, contact });

    // TODO: Save customer_id to DB against the user

    res.json({ customer_id });
});

/**
 * POST /payment/create-order
 */
export const createOrder = catchAsync(async (req, res) => {
    const { amount, currency, receipt, notes, customer_id } = req.body;

    const order = await paymentService.createOrder({ amount, currency, receipt, notes, customer_id });

    res.json(order);
});

/**
 * POST /payment/verify
 */
export const verifyPayment = catchAsync(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const isValid = paymentService.verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature });

    if (isValid) {
        // TODO: Update DB with 'Active' subscription status
        res.json({ status: 'success', message: 'Payment verified successfully' });
    } else {
        res.status(400).json({ status: 'failure', message: 'Invalid signature' });
    }
});

/**
 * POST /payment/webhook
 * NOTE: Add this URL (e.g., https://yourapi.com/api/payment/webhook) to Razorpay Dashboard > Settings > Webhooks
 */
// export const handleWebhook = catchAsync(async (req, res) => {
//     const signature = req.headers['x-razorpay-signature'];
//
//     const isValid = paymentService.verifyWebhookSignature(req.body, signature);
//
//     if (isValid) {
//         const { event } = req.body;
//         paymentService.handleWebhookEvent(event, req.body.payload);
//         res.json({ status: 'ok' });
//     } else {
//         res.status(400).json({ status: 'invalid signature' });
//     }
// });
