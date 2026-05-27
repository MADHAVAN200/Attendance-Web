import api from './api';

const API_BASE_URL = '/website-chatbot';

export const internalChatbotService = {
    async ask(question, pathname) {
        const text = String(question || '').trim();
        if (!text) {
            throw new Error('Question is required');
        }

        try {
            const res = await api.post(`${API_BASE_URL}/ask-internal`, {
                question: text,
                path: pathname
            });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to get copilot response');
        }
    },
};
