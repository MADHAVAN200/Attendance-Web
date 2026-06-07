import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';
import { answerWebsiteQuestion, answerInternalQuestion } from '../../services/chatbot/websiteRagService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const askWebsiteChatbot = catchAsync(async (req, res, next) => {
    const { question, message, history } = req.body || {};
    const input = question || message;

    if (!input || !String(input).trim()) {
        return next(new AppError('question is required in request body', 400));
    }

    let result;
    try {
        result = await answerWebsiteQuestion(String(input), history);
    } catch (error) {
        const rawMessage = String(error?.message || '').toLowerCase();
        const infraFailure = rawMessage.includes('chromadb')
            || rawMessage.includes('connect')
            || rawMessage.includes('timeout')
            || rawMessage.includes('fetch')
            || rawMessage.includes('could not be found')
            || rawMessage.includes('not found');

        if (infraFailure) {
            return res.status(200).json({
                ok: true,
                data: {
                    question: String(input).trim(),
                    answer: 'I am temporarily unable to access website knowledge. Please try again in a moment.',
                    sources: [],
                },
            });
        }

        return next(error);
    }

    res.status(200).json({
        ok: true,
        data: {
            question: String(input).trim(),
            answer: result.answer,
            sources: result.sources,
        },
    });
});

export const askInternalChatbot = catchAsync(async (req, res, next) => {
    const { question, message, path: pathName } = req.body || {};
    const input = question || message;
    const role = req.user?.user_type || 'employee';

    if (!input || !String(input).trim()) {
        return next(new AppError('question is required in request body', 400));
    }

    let result;
    try {
        result = await answerInternalQuestion(String(input), role, pathName);
    } catch (error) {
        return next(error);
    }

    res.status(200).json({
        ok: true,
        data: {
            question: String(input).trim(),
            answer: result.answer,
        },
    });
});

export const getAppGuide = catchAsync(async (req, res, next) => {
    let guides = [];
    try {
        const fileContent = await fs.readFile(path.resolve(__dirname, '../../services/chatbot/internalAppGuide.json'), 'utf-8');
        guides = JSON.parse(fileContent);
    } catch (error) {
        console.error('Failed to load internalAppGuide.json:', error);
        return next(new AppError('Failed to load application guide', 500));
    }

    res.status(200).json({
        ok: true,
        data: guides,
    });
});
