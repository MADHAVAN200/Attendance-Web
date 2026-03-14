import express from 'express';
import * as paymentController from '../../controllers/payment/paymentController.js';

const router = express.Router();

router.post('/create-customer', paymentController.createCustomer);
router.post('/create-order', paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);
// router.post('/webhook', paymentController.handleWebhook);

export default router;
