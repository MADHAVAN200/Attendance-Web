import api from './api';

const API_BASE_URL = '/website-chatbot';

export const websiteChatbotService = {
    async ask(question, history = []) {
        const text = String(question || '').trim();
        if (!text) {
            throw new Error('Question is required');
        }

        try {
            const res = await api.post(`${API_BASE_URL}/ask`, { question: text, history });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to get chatbot response');
        }
    },
};
