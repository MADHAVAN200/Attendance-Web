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
        console.log(res1.sources.map(s => s.section_heading || s.source_file));

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
        console.log('TEST 5: Onboarding, Setup & Hardware Requirements (Pre-login)');
        console.log('=======================================');
        const q5 = "how do we onboard our employees and do we need to buy special fingerprint devices?";
        console.log(`Query: "${q5}"`);
        const res5 = await answerWebsiteQuestion(q5);
        console.log('\n--- ANSWER ---');
        console.log(res5.answer);
        console.log('\n--- SOURCES ---');
        console.log(res5.sources.map(s => s.section_heading || s.source_file));

        console.log('\n=======================================');
        console.log('TEST 6: Plan Suitability and Recommendation (Pre-login)');
        console.log('=======================================');
        const q6 = "we are a company of 60 employees with dynamic client sites. Which plan is best for us?";
        console.log(`Query: "${q6}"`);
        const res6 = await answerWebsiteQuestion(q6);
        console.log('\n--- ANSWER ---');
        console.log(res6.answer);
        console.log('\n--- SOURCES ---');
        console.log(res6.sources.map(s => s.section_heading || s.source_file));

        console.log('\n=======================================');
        console.log('TEST 7: Purchasing, Trials & Payment Options (Pre-login)');
        console.log('=======================================');
        const q7 = "how do I buy a subscription and is there a trial available? What payments do you accept?";
        console.log(`Query: "${q7}"`);
        const res7 = await answerWebsiteQuestion(q7);
        console.log('\n--- ANSWER ---');
        console.log(res7.answer);

        console.log('\n=======================================');
        console.log('TEST 8: Security, GDPR compliance & Data Privacy (Pre-login)');
        console.log('=======================================');
        const q8 = "is our attendance and employee data secure? Where is it hosted and is it GDPR compliant?";
        console.log(`Query: "${q8}"`);
        const res8 = await answerWebsiteQuestion(q8);
        console.log('\n--- ANSWER ---');
        console.log(res8.answer);

        console.log('\n=======================================');
        console.log('TEST 9: Customer SLAs, Response Times & Live Office Hours (Pre-login)');
        console.log('=======================================');
        const q9 = "when can we contact support and what is the SLA for critical issues?";
        console.log(`Query: "${q9}"`);
        const res9 = await answerWebsiteQuestion(q9);
        console.log('\n--- ANSWER ---');
        console.log(res9.answer);

        console.log('\n=======================================');
        console.log('TEST 10: Business ROI, Savings & Proxy Prevention (Pre-login)');
        console.log('=======================================');
        const q10 = "how does this app save time and money for our business and prevent buddy-punching?";
        console.log(`Query: "${q10}"`);
        const res10 = await answerWebsiteQuestion(q10);
        console.log('\n--- ANSWER ---');
        console.log(res10.answer);

        console.log('\n=======================================');
        console.log('TEST 11: Greeting Intent Router (Pre-login)');
        console.log('=======================================');
        const q11 = "hello mano assistant!";
        console.log(`Query: "${q11}"`);
        const res11 = await answerWebsiteQuestion(q11);
        console.log('\n--- ANSWER ---');
        console.log(res11.answer);

        console.log('\n=======================================');
        console.log('TEST 12: Gratitude Intent Router (Pre-login)');
        console.log('=======================================');
        const q12 = "thank you so much, bye!";
        console.log(`Query: "${q12}"`);
        const res12 = await answerWebsiteQuestion(q12);
        console.log('\n--- ANSWER ---');
        console.log(res12.answer);

        console.log('\n=======================================');
        console.log('TEST 13: Conversation History Memory & Follow-Up (Pre-login)');
        console.log('=======================================');
        const q13 = "how much does it cost and how do I buy it?";
        const mockHistory = [
            { role: 'user', text: 'tell me about the Starter plan features' },
            { role: 'assistant', text: 'The Starter plan is best for small teams of up to 20 employees. It includes one-click attendance logging, basic leave balances, standard weekly attendance logs and reports, and standard onboarding email support.' }
        ];
        console.log(`Prior History:\n- User: "${mockHistory[0].text}"\n- Assistant: "${mockHistory[1].text}"`);
        console.log(`Follow-Up Query: "${q13}"`);
        const res13 = await answerWebsiteQuestion(q13, mockHistory);
        console.log('\n--- ANSWER ---');
        console.log(res13.answer);

        console.log('\n=======================================');
        console.log('TESTS COMPLETED');
        console.log('=======================================');
    } catch (err) {
        console.error('Test execution failed:', err);
    }
}

runTests();

