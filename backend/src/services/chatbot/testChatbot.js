import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { answerWebsiteQuestion, answerInternalQuestion } from './websiteRagService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

console.log('Environment Loaded. GROQ_API_KEY present:', !!process.env.GROQ_API_KEY);

async function runTests() {
    try {
        console.log('\n=======================================');
        console.log('TEST 1: High-Level Entire Software Query (Pre-login)');
        console.log('=======================================');
        const q1 = "explain the entire software highlights and modules";
        console.log(`Query: "${q1}"`);
        const res1 = await answerWebsiteQuestion(q1);
        console.log('\n--- ANSWER ---');
        console.log(res1.answer);
        console.log('\n--- SOURCES ---');
        console.log(res1.sources);

        console.log('\n=======================================');
        console.log('TEST 2: Keyword Synonym & Multi-Module Query (Internal Mano Copilot)');
        console.log('=======================================');
        const q2 = "how can I request an attendance correction and check my leave balance?";
        console.log(`Query: "${q2}"`);
        const res2 = await answerInternalQuestion(q2, 'employee', '/dashboard');
        console.log('\n--- ANSWER ---');
        console.log(res2.answer);

        console.log('\n=======================================');
        console.log('TEST 3: Semantic Fallback Query (Internal Mano Copilot)');
        console.log('=======================================');
        // This query does not contain exact keywords like 'daily activity', 'dar', 'task log' etc.
        const q3 = "how can I record what meetings and projects I finished today?";
        console.log(`Query: "${q3}"`);
        const res3 = await answerInternalQuestion(q3, 'employee', '/dashboard');
        console.log('\n--- ANSWER ---');
        console.log(res3.answer);

        console.log('\n=======================================');
        console.log('TEST 4: Non-Misinformation / Hallucination-Free Query (Pre-login)');
        console.log('=======================================');
        const q4 = "does the app support cryptocurrency integration for payroll payouts?";
        console.log(`Query: "${q4}"`);
        const res4 = await answerWebsiteQuestion(q4);
        console.log('\n--- ANSWER ---');
        console.log(res4.answer);

        console.log('\n=======================================');
        console.log('TESTS COMPLETED');
        console.log('=======================================');
    } catch (err) {
        console.error('Test execution failed:', err);
    }
}

runTests();
