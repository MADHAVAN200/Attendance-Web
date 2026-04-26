import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import Groq from 'groq-sdk';
import { ChromaClient } from 'chromadb';
import { pipeline } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROMA_COLLECTION = process.env.WEBSITE_CHAT_COLLECTION || 'website_knowledge';
const CHROMA_URL = process.env.CHROMA_URL || process.env.WEBSITE_CHAT_CHROMA_URL || 'http://localhost:8000';
const CHUNKS_FILE = process.env.WEBSITE_CHAT_CHUNKS_FILE
    || path.resolve(__dirname, '../../../../knowledge_base/chunks.json');
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MAX_CONTEXT_CHUNKS = Number(process.env.WEBSITE_CHAT_TOP_K || 8);
const WEBSITE_CHAT_DEBUG = String(process.env.WEBSITE_CHAT_DEBUG || '').toLowerCase() === 'true';
const FEATURE_KEYWORDS = [
    { name: 'Simple Time In & Time Out', keywords: ['time in', 'time out', 'clock in', 'clock out', 'attendance logging', 'punch in', 'punch out'] },
    { name: 'Live Command Center', keywords: ['command center', 'live dashboard', 'live attendance', 'live activity'] },
    { name: 'Detailed Attendance & Matrix Reports', keywords: ['attendance report', 'matrix report', 'payroll report', 'export report', 'attendance logs'] },
    { name: 'Holiday & Leave Management', keywords: ['leave', 'holiday', 'leave request', 'leave approval', 'leave balance'] },
    { name: 'Ask HR AI Assistant', keywords: ['ask hr', 'ai assistant', 'chatbot', 'policy question'] },
    { name: 'Generative Policy Builder', keywords: ['policy builder', 'policy generation', 'shift policy', 'prompt policy'] },
    { name: 'Smart DAR Insights', keywords: ['dar', 'daily activity report', 'smart dar', 'productivity insights'] },
    { name: 'Advanced Geofencing', keywords: ['geofencing', 'geo fencing', 'location tracking', 'gps', 'geofence'] },
    { name: 'Facial Camera Verification', keywords: ['face verification', 'facial verification', 'webcam verification', 'biometric'] },
];

let embeddingPipelinePromise;
let chromaClient;
let collectionPromise;
let groqClient;
let localChunkIndexPromise;
let chromaUnavailable = false;
let hasLoggedChromaFallback = false;

function getGroqClient() {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('Missing GROQ_API_KEY in environment');
    }
    if (!groqClient) {
        groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return groqClient;
}

async function getEmbeddingPipeline() {
    if (!embeddingPipelinePromise) {
        embeddingPipelinePromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embeddingPipelinePromise;
}

function getChromaClient() {
    if (!chromaClient) {
        const url = new URL(CHROMA_URL);
        const ssl = url.protocol === 'https:';
        const port = Number(url.port || (ssl ? 443 : 80));

        chromaClient = new ChromaClient({
            host: url.hostname,
            port,
            ssl,
        });
    }
    return chromaClient;
}

function isChromaNotFoundError(error) {
    const name = String(error?.name || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return name.includes('notfound')
        || message.includes('requested resource could not be found')
        || message.includes('not found');
}

function toMetadata(chunk) {
    return {
        url: String(chunk?.url || ''),
        source_file: String(chunk?.source_file || ''),
        page_name: String(chunk?.page_name || ''),
        section_num: Number(chunk?.section_num || 0),
        section_heading: String(chunk?.section_heading || ''),
    };
}

function cosineSimilarity(a = [], b = []) {
    const length = Math.min(a.length, b.length);
    if (length === 0) return 0;

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < length; i += 1) {
        const av = Number(a[i] || 0);
        const bv = Number(b[i] || 0);
        dot += av * bv;
        magA += av * av;
        magB += bv * bv;
    }

    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function getCollection() {
    if (!collectionPromise) {
        collectionPromise = (async () => {
            const client = getChromaClient();
            try {
                return await client.getCollection({ name: CHROMA_COLLECTION });
            } catch (error) {
                if (!isChromaNotFoundError(error)) {
                    throw error;
                }

                const collection = await client.createCollection({ name: CHROMA_COLLECTION });
                await bootstrapCollection(collection);
                return collection;
            }
        })();
    }
    return collectionPromise;
}

async function embedText(text) {
    const extractor = await getEmbeddingPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

async function bootstrapCollection(collection) {
    const currentCount = await collection.count();
    if (currentCount > 0) return;

    const fileContent = await fs.readFile(CHUNKS_FILE, 'utf-8');
    const chunks = JSON.parse(fileContent);
    if (!Array.isArray(chunks) || chunks.length === 0) return;

    const docs = [];
    const ids = [];
    const metas = [];

    for (let i = 0; i < chunks.length; i += 1) {
        const item = chunks[i] || {};
        const doc = String(item.content || '').trim();
        if (!doc) continue;

        docs.push(doc);
        ids.push(String(item.id || `chunk_${i}`));
        metas.push(toMetadata(item));
    }

    if (docs.length === 0) return;

    const embeddings = [];
    for (const doc of docs) {
        embeddings.push(await embedText(doc));
    }

    await collection.add({
        ids,
        documents: docs,
        metadatas: metas,
        embeddings,
    });
}

async function getLocalChunkIndex() {
    if (!localChunkIndexPromise) {
        localChunkIndexPromise = (async () => {
            const fileContent = await fs.readFile(CHUNKS_FILE, 'utf-8');
            const chunks = JSON.parse(fileContent);

            if (!Array.isArray(chunks) || chunks.length === 0) {
                return [];
            }

            const indexed = [];
            for (let i = 0; i < chunks.length; i += 1) {
                const item = chunks[i] || {};
                const content = String(item.content || '').trim();
                if (!content) continue;

                indexed.push({
                    content,
                    metadata: toMetadata(item),
                    embedding: await embedText(content),
                });
            }

            return indexed;
        })();
    }

    return localChunkIndexPromise;
}

async function queryLocalIndex(queryEmbedding) {
    const localIndex = await getLocalChunkIndex();
    if (!localIndex.length) {
        return { documents: [[]], metadatas: [[]], distances: [[]] };
    }

    const ranked = localIndex
        .map((item) => {
            const similarity = cosineSimilarity(queryEmbedding, item.embedding);
            return {
                doc: item.content,
                metadata: item.metadata,
                distance: 1 - similarity,
                similarity,
            };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, Math.max(1, MAX_CONTEXT_CHUNKS));

    return {
        documents: [ranked.map((item) => item.doc)],
        metadatas: [ranked.map((item) => item.metadata)],
        distances: [ranked.map((item) => item.distance)],
    };
}

function buildContextBlocks(queryResult) {
    const docs = queryResult?.documents?.[0] || [];
    const metas = queryResult?.metadatas?.[0] || [];
    const distances = queryResult?.distances?.[0] || [];

    return docs.map((doc, idx) => {
        const meta = metas[idx] || {};
        return {
            content: String(doc || '').trim(),
            source_file: meta.source_file || 'unknown',
            url: meta.url || '',
            page_name: meta.page_name || '',
            section_num: meta.section_num,
            section_heading: meta.section_heading || '',
            distance: typeof distances[idx] === 'number' ? distances[idx] : null,
        };
    }).filter((item) => item.content.length > 0);
}

function detectRequestedFeatures(question) {
    const normalized = String(question || '').toLowerCase();
    if (!normalized) return [];

    const matches = FEATURE_KEYWORDS
        .filter((feature) => feature.keywords.some((keyword) => normalized.includes(keyword)))
        .map((feature) => feature.name);

    return [...new Set(matches)];
}

function buildPrompt(question, contextBlocks, requestedFeatures = []) {
    const contextText = contextBlocks
        .map((item, idx) => {
            const header = [
                `Source ${idx + 1}`,
                item.page_name ? `Page: ${item.page_name}` : null,
                item.url ? `URL: ${item.url}` : null,
                item.section_heading ? `Section: ${item.section_heading}` : null,
            ].filter(Boolean).join(' | ');

            return `${header}\n${item.content}`;
        })
        .join('\n\n--------------------\n\n');

    const isSpecificFeatureQuestion = requestedFeatures.length > 0;
    const specificFeatureInstructions = isSpecificFeatureQuestion
        ? [
            `User requested specific feature explanation for: ${requestedFeatures.join(', ')}.`,
            'Explain ONLY the requested feature(s), unless the user explicitly asks for all features.',
            'For each feature, use this structure with plain text labels (no markdown symbols):',
            '<Feature Name>:',
            'How it works: ...',
            'Why it matters: ...',
            'Keep each explanation practical and end-user friendly.',
        ]
        : [
            'When the user asks about features, modules, capabilities, or highlights, respond in a numbered point format.',
            'For each point, include the feature name and a clear 1-2 sentence description.',
            'Do not return a single comma-separated list for feature explanations.',
            'Keep numbered feature lists concise (typically 5-8 points unless user asks for more).',
        ];

    return [
        'You are the official pre-login website assistant for MANO-Attendance.',
        'Answer ONLY from the provided context.',
        'Start directly with the answer content.',
        'Do not repeat the user question.',
        ...specificFeatureInstructions,
        'Do not use markdown symbols like ** or __ in the final answer.',
        'Do not use preambles like: "To answer your question", "According to the provided context", "Here is the answer".',
        'If the answer is not present, reply exactly: "I do not have that information on the website right now."',
        'Keep answers concise, factual, and user-friendly.',
        'Never mention internal implementation details or vector databases.',
        '',
        `User question: ${question}`,
        '',
        'Context:',
        contextText,
    ].join('\n');
}

function sanitizeModelAnswer(rawAnswer) {
    let text = String(rawAnswer || '').replace(/\r\n?/g, '\n').trim();
    text = text.replace(/\*\*/g, '').trim();
    text = text.replace(/^User question:\s*.*$/gim, '').trim();
    text = text.replace(/^Answer:\s*/i, '').trim();
    text = text.replace(/^Answer\s+from\s+Source\s+\d+\s*:\s*/i, '').trim();
    text = text.replace(/^According to the provided context,?\s*the answer is:?\s*/i, '').trim();
    text = text.replace(/^To answer your question:\s*/i, '').trim();
    text = text.replace(/^Here(?:'s| is) (?:the )?answer:\s*/i, '').trim();
    text = text.replace(/^\s*[A-Za-z0-9\-\s]+works as follows:\s*\n?/i, '').trim();
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return text;
}

export async function answerWebsiteQuestion(question) {
    const trimmed = String(question || '').trim();
    if (!trimmed) {
        throw new Error('Question is required');
    }

    const requestedFeatures = detectRequestedFeatures(trimmed);
    const retrievalQuery = requestedFeatures.length > 0
        ? `${trimmed}\nFocus features: ${requestedFeatures.join(', ')}`
        : trimmed;

    const queryEmbedding = await embedText(retrievalQuery);
    let queryResult;

    if (!chromaUnavailable) {
        try {
            const collection = await getCollection();
            queryResult = await collection.query({
                queryEmbeddings: [queryEmbedding],
                nResults: MAX_CONTEXT_CHUNKS,
                include: ['documents', 'metadatas', 'distances'],
            });
        } catch (error) {
            chromaUnavailable = true;
            if (!hasLoggedChromaFallback && WEBSITE_CHAT_DEBUG) {
                hasLoggedChromaFallback = true;
                console.warn('[website-chatbot] Chroma unavailable, using local chunk index fallback:', error?.message || error);
            }
        }
    }

    if (!queryResult) {
        queryResult = await queryLocalIndex(queryEmbedding);
    }

    const contextBlocks = buildContextBlocks(queryResult);

    if (contextBlocks.length === 0) {
        return {
            answer: 'I do not have that information on the website right now.',
            sources: [],
        };
    }

    const groq = getGroqClient();
    const prompt = buildPrompt(trimmed, contextBlocks, requestedFeatures);

    const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content: 'You are a strict website assistant that answers only from provided context.',
            },
            {
                role: 'user',
                content: prompt,
            },
        ],
    });

    const rawAnswer = completion?.choices?.[0]?.message?.content?.trim();
    const answer = sanitizeModelAnswer(rawAnswer)
        || 'I do not have that information on the website right now.';

    const sources = contextBlocks.slice(0, 5).map((item) => ({
        page_name: item.page_name,
        source_file: item.source_file,
        url: item.url,
        section_heading: item.section_heading,
    }));

    return { answer, sources };
}
