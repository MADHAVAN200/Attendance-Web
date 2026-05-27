import express from 'express';
import { askWebsiteChatbot, askInternalChatbot } from '../../controllers/chatbot/chatbotController.js';
import { authenticateJWT } from '../../middleware/auth.js';

const router = express.Router();

router.post('/ask', askWebsiteChatbot);
router.post('/ask-internal', authenticateJWT, askInternalChatbot);

export default router;
