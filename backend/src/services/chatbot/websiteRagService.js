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
    { name: 'Simple Time In & Time Out', keywords: ['time in', 'time out', 'clock in', 'clock out', 'attendance logging', 'punch in', 'punch out', 'punching', 'clocking', 'timeclock', 'time clock', 'session timer'] },
    { name: 'Live Command Center', keywords: ['command center', 'live dashboard', 'live attendance', 'live activity', 'active feed', 'live ticker', 'map tracking'] },
    { name: 'Detailed Attendance & Matrix Reports', keywords: ['attendance report', 'matrix report', 'payroll report', 'export report', 'attendance logs', 'lateness summary', 'overtime sheets', 'excel export', 'pdf summary'] },
    { name: 'Holiday & Leave Management', keywords: ['leave', 'holiday', 'leave request', 'leave approval', 'leave balance', 'sick leave', 'casual leave', 'earned leave', 'time-off', 'time off', 'festival', 'calendar'] },
    { name: 'Ask HR AI Assistant', keywords: ['ask hr', 'ai assistant', 'chatbot', 'policy question', 'copilot', 'virtual assistant', 'faq helper'] },
    { name: 'Generative Policy Builder', keywords: ['policy builder', 'policy generation', 'shift policy', 'prompt policy', 'legal check', 'terms document'] },
    { name: 'Smart DAR Insights', keywords: ['dar', 'daily activity report', 'smart dar', 'productivity insights', 'vague logs', 'theme synthesizing', 'morale analysis'] },
    { name: 'Advanced Geofencing', keywords: ['geofencing', 'geo fencing', 'location tracking', 'gps', 'geofence', 'google maps', 'radius lock', 'strict location'] },
    { name: 'Facial Camera Verification', keywords: ['face verification', 'facial verification', 'webcam verification', 'biometric', 'camera validation', 'buddy punching'] },
];

let embeddingPipelinePromise;
let chromaClient;
let collectionPromise;
let groqClient;
let localChunkIndexPromise;
let chromaUnavailable = false;
let hasLoggedChromaFallback = false;
let cachedInternalGuidesWithEmbeddings = null;

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

function detectEntireSoftwareQuery(question) {
    const normalized = String(question || '').toLowerCase();
    const generalKeywords = [
        'explain the software', 'explain the entire software', 'tell me about the software',
        'what is this software', 'what does this software do', 'features of the software',
        'product overview', 'product highlights', 'how does it work', 'what is mano-attendance',
        'what does mano-attendance do', 'explain the app', 'what are the features',
        'tell me about the product', 'give me an overview', 'whole software', 'entire system',
        'explain everything', 'what modules', 'walkthrough of the system'
    ];
    return generalKeywords.some(keyword => normalized.includes(keyword));
}

async function getFullSoftwareOverviewContext() {
    try {
        const fileContent = await fs.readFile(CHUNKS_FILE, 'utf-8');
        const rawChunks = JSON.parse(fileContent);
        const targetIds = ['chunk_0000', 'chunk_0001', 'chunk_0009', 'chunk_0016'];
        const selected = rawChunks.filter(c => targetIds.includes(c.id));
        
        return selected.map((item) => ({
            content: String(item.content || '').trim(),
            source_file: item.source_file || 'landing_home.txt',
            url: item.url || '',
            page_name: item.page_name || '',
            section_num: item.section_num,
            section_heading: item.section_heading || '',
            distance: 0
        }));
    } catch (err) {
        console.error('Failed to compile full software overview context:', err);
        return [];
    }
}

function detectRequestedFeatures(question) {
    const normalized = String(question || '').toLowerCase();
    if (!normalized) return [];

    const matches = FEATURE_KEYWORDS
        .filter((feature) => feature.keywords.some((keyword) => normalized.includes(keyword)))
        .map((feature) => feature.name);

    return [...new Set(matches)];
}

function buildPrompt(question, contextBlocks, requestedFeatures = [], isGeneralOverview = false) {
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

    let specificFeatureInstructions = [];
    if (isGeneralOverview) {
        specificFeatureInstructions = [
            'The user wants an overview of the ENTIRE software platform. Provide a comprehensive, premium sales pitch/walkthrough.',
            'Structure your response beautifully with plain text headings (no markdown symbols like # or **):',
            'Overview:',
            'Brief high-level summary of what MANO-Attendance is.',
            'Core Product Highlights:',
            'Present the major highlights in an elegant, structured format (e.g. Time In & Time Out, Live Command Center, Detailed Reports, Holidays & Leaves, AI Ask HR, Generative Policy Builder, Smart DAR Insights, Advanced Geofencing). Make them sound premium and explain how they work.',
            'Subscription Plans:',
            'List and describe the Starter, Growth, and Enterprise plans so the client understands the options.',
            'How It Works:',
            'Walk them through the 6 simple steps from onboarding to payroll.',
        ];
    } else if (requestedFeatures.length > 0) {
        specificFeatureInstructions = [
            `User requested specific feature explanation for: ${requestedFeatures.join(', ')}.`,
            'Explain ONLY the requested feature(s), unless the user explicitly asks for all features.',
            'For each feature, use this structure with plain text labels (no markdown symbols):',
            '<Feature Name>:',
            'How it works: ...',
            'Why it matters: ...',
            'Keep each explanation practical and end-user friendly.',
        ];
    } else {
        specificFeatureInstructions = [
            'When the user asks about features, modules, capabilities, or highlights, respond in a numbered point format.',
            'For each point, include the feature name and a clear 1-2 sentence description.',
            'Do not return a single comma-separated list for feature explanations.',
            'Keep numbered feature lists concise (typically 5-8 points unless user asks for more).',
        ];
    }

    return [
        'You are the official pre-login website assistant for MANO-Attendance, a state-of-the-art AI-driven workforce platform.',
        'Answer ONLY from the provided context. Do not make up any facts or hallucinate features.',
        'Start directly with the answer content.',
        'Do not repeat the user question.',
        ...specificFeatureInstructions,
        'Do not use markdown symbols like ** or __ in the final answer. Use clean spacing and CAPITALized headings for visual hierarchy.',
        'Do not use preambles like: "To answer your question", "According to the provided context", "Here is the answer".',
        'If the answer is not present in the context, do not speculate or hallucinate. Reply exactly: "I do not have that information on the website right now. You can reach out to our team at sales@manoattendance.com or business@mano.co.in for assistance."',
        'Keep answers concise, factual, highly professional, and user-friendly.',
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

    const isGeneralOverview = detectEntireSoftwareQuery(trimmed);
    let contextBlocks = [];

    if (isGeneralOverview) {
        contextBlocks = await getFullSoftwareOverviewContext();
    } else {
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

        contextBlocks = buildContextBlocks(queryResult);
    }

    if (contextBlocks.length === 0) {
        return {
            answer: 'I do not have that information on the website right now. You can reach out to our team at sales@manoattendance.com or business@mano.co.in for assistance.',
            sources: [],
        };
    }

    const groq = getGroqClient();
    const prompt = buildPrompt(trimmed, contextBlocks, detectRequestedFeatures(trimmed), isGeneralOverview);

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
    let answer = sanitizeModelAnswer(rawAnswer);
    
    if (!answer || answer.includes('I do not have that information')) {
        answer = 'I do not have that information on the website right now. You can reach out to our team at sales@manoattendance.com or business@mano.co.in for assistance.';
    }

    const sources = contextBlocks.slice(0, 5).map((item) => ({
        page_name: item.page_name,
        source_file: item.source_file,
        url: item.url,
        section_heading: item.section_heading,
    }));

    return { answer, sources };
}

function getGuideTextForEmbedding(g) {
    const roleDetailsText = Object.entries(g.roleDetails || {})
        .map(([r, detail]) => `${r}: ${detail}`)
        .join('. ');
    const faqsText = (g.faqs || [])
        .map(faq => `Q: ${faq.question} A: ${faq.answer}`)
        .join('. ');
    return `${g.moduleName}. ${g.description}. ${roleDetailsText}. ${faqsText}`;
}

async function getInternalGuidesWithEmbeddings(guides) {
    if (!cachedInternalGuidesWithEmbeddings) {
        cachedInternalGuidesWithEmbeddings = [];
        for (const g of guides) {
            const docText = getGuideTextForEmbedding(g);
            const embedding = await embedText(docText);
            cachedInternalGuidesWithEmbeddings.push({
                ...g,
                embedding,
            });
        }
    }
    return cachedInternalGuidesWithEmbeddings;
}

export async function answerInternalQuestion(question, role, pathName) {
    const trimmed = String(question || '').trim();
    if (!trimmed) {
        throw new Error('Question is required');
    }

    let guides = [];
    try {
        const fileContent = await fs.readFile(path.resolve(__dirname, './internalAppGuide.json'), 'utf-8');
        guides = JSON.parse(fileContent);
    } catch (error) {
        console.error('Failed to load internalAppGuide.json:', error);
    }

    const queryLower = trimmed.toLowerCase();
    
    // Keyword mappings matching the guide routes
    const keywordMappings = {
        '/dashboard': ['dashboard', 'home', 'stats', 'timer', 'feed', 'active feed', 'recent logs', 'quick actions', 'performance', 'overview', 'main page'],
        '/attendance': ['attendance', 'clock', 'punch', 'check-in', 'check-out', 'time-in', 'time-out', 'correction', 'missed punch', 'overtime', 'session', 'face verification', 'biometric', 'webcam', 'audit log', 'camera verification', 'photo verify'],
        '/holidays': ['holiday', 'festival', 'calendar', 'public holiday', 'national holiday', 'list of holidays'],
        '/apply-leave': ['apply leave', 'request leave', 'sick leave', 'casual leave', 'earned leave', 'leave balance', 'leave list', 'leave request', 'take time off', 'vacation'],
        '/daily-activity': ['dar', 'daily activity', 'task', 'meeting', 'insights', 'vague logs', 'activity report', 'daily log', 'work log', 'log tasks', 'log meetings'],
        '/attendance-monitoring': ['monitoring', 'command center', 'real-time check-in', 'location map', 'clocked in right now', 'where are employees', 'live attendance', 'live pulse'],
        '/geofencing': ['geofence', 'geofencing', 'radius', 'work location', 'boundary', 'gps lock', 'strict locking', 'map drawing', 'google map zone', 'gps bypass'],
        '/shift-management': ['shift', 'policy', 'roster', 'schedule', 'grace period', 'late threshold', 'create shift', 'shift timing', 'grace period late'],
        '/reports': ['report', 'export', 'excel', 'pdf', 'matrix', 'download', 'lateness sheet', 'overtime sheet', 'payroll data'],
        '/profile': ['profile', 'password', 'avatar', 'photo', 'email', '2fa', 'two-factor', 'change password', 'credentials', 'personal settings'],
        '/employees': ['employee', 'staff', 'bulk upload', 'import employee', 'add employee', 'directory', 'roster upload', 'staff directory'],
        '/organizations': ['organization', 'client', 'tenant', 'license', 'suspend', 'client databases', 'companies', 'activate organization'],
        '/super-admin/alerts': ['alert', 'security', 'threat', 'failed login', 'spoof', 'violation', 'gps spoofing', 'threat logging', 'security violations'],
        '/super-admin/logs': ['system logs', 'error logs', 'stack trace', 'transaction', 'api request', 'api speed', 'debug log', 'trace path']
    };

    // 1. Keyword-based matching (NLP search)
    const matchedGuidesWithScores = [];
    
    for (const g of guides) {
        if (!g.roles.includes(role)) continue;
        
        let score = 0;
        const keywords = keywordMappings[g.route] || [];
        
        for (const keyword of keywords) {
            if (queryLower.includes(keyword)) {
                score += keyword.split(' ').length * 3; // Give multi-word keywords high weight
            }
        }
        
        if (g.moduleName && queryLower.includes(g.moduleName.toLowerCase())) {
            score += 5;
        }

        if (score > 0) {
            matchedGuidesWithScores.push({ guide: g, score });
        }
    }

    // Sort descending by score
    matchedGuidesWithScores.sort((a, b) => b.score - a.score);

    let selectedGuides = [];
    
    // If we have high-confidence matches (score >= 3), select all of them
    const highConfidenceMatches = matchedGuidesWithScores.filter(m => m.score >= 3);
    if (highConfidenceMatches.length > 0) {
        selectedGuides = highConfidenceMatches.map(m => m.guide);
    } else if (matchedGuidesWithScores.length > 0) {
        // Otherwise, if we have any keyword matches at all, pick the highest scoring one
        selectedGuides = [matchedGuidesWithScores[0].guide];
    }

    // 2. Fallback to Semantic Similarity Search if no keyword matches or scores are low
    if (selectedGuides.length === 0) {
        try {
            const queryEmbedding = await embedText(trimmed);
            const guidesWithEmbeddings = await getInternalGuidesWithEmbeddings(guides);
            
            const semanticMatches = [];
            for (const g of guidesWithEmbeddings) {
                if (!g.roles.includes(role)) continue;
                const similarity = cosineSimilarity(queryEmbedding, g.embedding);
                semanticMatches.push({ guide: g, similarity });
            }
            
            semanticMatches.sort((a, b) => b.similarity - a.similarity);
            
            // Pick semantic matches above 0.35 similarity (up to 2 modules)
            const acceptableSemanticMatches = semanticMatches.filter(m => m.similarity >= 0.35);
            if (acceptableSemanticMatches.length > 0) {
                selectedGuides = acceptableSemanticMatches.slice(0, 2).map(m => m.guide);
            }
        } catch (err) {
            console.error('[Mano Copilot] Semantic matching fallback failed:', err);
        }
    }

    // 3. Fallback to matching pathname if still no matches
    if (selectedGuides.length === 0) {
        if (pathName) {
            const cleanPath = '/' + pathName.split('/').filter(Boolean)[0] || '/dashboard';
            const pathMatchedGuide = guides.find(g => {
                const guidePath = g.route;
                const cleanGuidePath = '/' + guidePath.split('/').filter(Boolean)[0] || '/dashboard';
                return cleanGuidePath === cleanPath && g.roles.includes(role);
            });
            if (pathMatchedGuide) {
                selectedGuides = [pathMatchedGuide];
            }
        }
    }

    // 4. Fallback to dashboard guide if still absolutely no match
    if (selectedGuides.length === 0) {
        const dashboardGuide = guides.find(g => g.route === '/dashboard');
        if (dashboardGuide) {
            selectedGuides = [dashboardGuide];
        }
    }

    // Build context of other routes so the LLM can advise where to go.
    const selectedRoutes = new Set(selectedGuides.map(g => g.route));
    const otherRoutesSummary = guides
        .filter(g => !selectedRoutes.has(g.route))
        .map(g => `- ${g.moduleName} (Path: ${g.route}): ${g.description}`)
        .join('\n');

    const matchedContext = selectedGuides.map((g, idx) => `
=== MATCHED MODULE ${idx + 1}: ${g.moduleName} ===
Active Route Path: ${g.route}
General Description: ${g.description}
Instructions for your role (${role}): ${g.roleDetails?.[role] || g.description}
Frequently Asked Questions for this module:
${(g.faqs || []).map((faq, fIdx) => `Q${fIdx+1}: ${faq.question}\nA${fIdx+1}: ${faq.answer}`).join('\n')}
`).join('\n--------------------\n');

    const groq = getGroqClient();
    const prompt = [
        `You are the official in-app AI Copilot ("Mano Copilot") for MANO-Attendance, a smart workforce management platform.`,
        `You are helping a logged-in user with the role "${role}".`,
        `The user is currently viewing the page path: "${pathName || '/dashboard'}".`,
        ``,
        `Here is the official documentation context for the most relevant page/module matched to their query:`,
        matchedContext,
        ``,
        `Here are details about other modules in the application if they need to navigate elsewhere:`,
        otherRoutesSummary,
        ``,
        `Core Instructions:`,
        `- You MUST provide your explanation in a strict, step-by-step, bulleted, or numbered point format.`,
        `- NEVER write explanations in a single continuous paragraph. Always break down all answers into clear, concise points or chronological steps (e.g., Point 1, Point 2, or Step 1, Step 2, Step 3).`,
        `- Explain functionalities clearly and make them extremely easy for end-users to digest.`,
        `- If the user asks about "Attendance" vs "Corrections", explain that:`,
        `  * Attendance: Real-time clock-in/out via web or mobile.`,
        `  * Corrections: Retroactive requests for past days (e.g., if they forgot to punch) needing HR approval.`,
        `- If they ask about "Holidays" vs "Leaves", explain that:`,
        `  * Holidays: Company-wide pre-scheduled days off (e.g., festivals) which do not deduct leave balance.`,
        `  * Leaves: Personal time-off requests (Sick, Casual) that deduct from leave balance and need approval.`,
        `- Always state the exact navigation URL to complete their task. You MUST output this URL strictly in the format "www.attendance.mano.co.in<path>" (for example, "www.attendance.mano.co.in/attendance" or "www.attendance.mano.co.in/apply-leave" or "www.attendance.mano.co.in/daily-activity").`,
        `- NEVER just write raw paths like "/attendance" or general names like "Holidays page". Always write them out completely in the format "www.attendance.mano.co.in/holidays" so that they are fully clickable for the user.`,
        `- Keep your explanation concise, professional, and directly answer the question.`,
        `- Use clean formatting (like bold labels or bullet points). DO NOT use raw HTML or markdown bold symbols like **. Use plain labels.`,
        `- Speak directly to the user as their helpful assistant.`,
        ``,
        `User question: ${trimmed}`,
    ].join('\n');

    const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content: `You are the in-app Mano AI Copilot. Assist the logged-in ${role} with their query.`,
            },
            {
                role: 'user',
                content: prompt,
            },
        ],
    });

    const rawAnswer = completion?.choices?.[0]?.message?.content?.trim();
    const answer = sanitizeModelAnswer(rawAnswer) || 'I am sorry, I am unable to answer your query right now.';

    return { answer };
}
