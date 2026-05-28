import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, Loader2, X } from 'lucide-react';
import { websiteChatbotService } from '../../services/websiteChatbotService';

function dedupeSources(items) {
    const seen = new Set();
    const unique = [];

    for (const item of items || []) {
        const key = `${item?.url || ''}|${item?.section_heading || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
    }

    return unique;
}

function cleanAssistantText(rawText) {
    let text = String(rawText || '').replace(/\r\n?/g, '\n').trim();
    text = text.replace(/^User question:\s*.*$/gim, '').trim();
    text = text.replace(/^Answer:\s*/i, '').trim();
    text = text.replace(/^Answer\s+from\s+Source\s+\d+\s*:\s*/i, '').trim();
    text = text.replace(/^Source\s+\d+\s*:\s*/gim, '').trim();
    text = text.replace(/^According to the provided context,?\s*the answer is:?\s*/i, '').trim();
    text = text.replace(/^To answer your question:\s*/i, '').trim();
    text = text.replace(/^Here(?:'s| is) (?:the )?answer:\s*/i, '').trim();
    text = text.replace(/^\s*[A-Za-z0-9\-\s]+works as follows:\s*\n?/i, '').trim();
    text = text.replace(/\*\*/g, '').trim();
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return text;
}

function renderAssistantLine(line, idx) {
    const cleaned = String(line || '').trim();
    if (!cleaned) {
        return <div key={`line-${idx}`} className="website-chatbot-line-spacer" aria-hidden="true" />;
    }

    const numberedWithDescription = cleaned.match(/^(\d+[.)]\s*)([^:]+):\s*(.+)$/);
    if (numberedWithDescription) {
        return (
            <p key={`line-${idx}`}>
                <strong>{`${numberedWithDescription[1]}${numberedWithDescription[2]}:`}</strong>{' '}
                {numberedWithDescription[3]}
            </p>
        );
    }

    const labeledLine = cleaned.match(/^([A-Za-z][A-Za-z\s&()/-]{2,}):\s*(.+)$/);
    if (labeledLine) {
        return (
            <p key={`line-${idx}`}>
                <strong>{`${labeledLine[1]}:`}</strong>{' '}
                {labeledLine[2]}
            </p>
        );
    }

    return <p key={`line-${idx}`}>{cleaned}</p>;
}

function renderMessageText(message) {
    if (message.role !== 'assistant') {
        return <p>{message.text}</p>;
    }

    const lines = String(message.text || '').split('\n');
    return <div className="website-chatbot-rich-text">{lines.map((line, idx) => renderAssistantLine(line, idx))}</div>;
}

const SUGGESTED_QUESTIONS = [
    "What is MANO-Attendance and how does it work?",
    "What are the subscription plans and pricing?",
    "Do we need special fingerprint/biometric devices?",
    "How does the app prevent proxy attendance?",
    "Is our employee data secure and GDPR compliant?"
];

export default function WebsiteChatbotWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const panelRef = useRef(null);
    const messagesEndRef = useRef(null);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            text: 'Hi. Ask me anything about MANO-Attendance features, pricing, security, or documentation.',
            sources: [],
        },
    ]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const sendSuggestedQuestion = async (q) => {
        if (loading) return;

        setInput('');
        setLoading(true);

        const history = messages
            .filter((m) => !m.pending && m.text !== 'Thinking...')
            .slice(-6)
            .map((m) => ({
                role: m.role,
                text: m.text,
            }));

        setMessages((prev) => [...prev, { role: 'user', text: q }, { role: 'assistant', text: 'Thinking...', pending: true }]);

        try {
            const response = await websiteChatbotService.ask(q, history);
            const rawAnswer = response?.data?.answer || 'I do not have that information on the website right now.';
            const answer = cleanAssistantText(rawAnswer) || 'I do not have that information on the website right now.';

            setMessages((prev) => {
                const withoutPending = prev.filter((m) => !m.pending);
                return [...withoutPending, { role: 'assistant', text: answer }];
            });
        } catch (error) {
            setMessages((prev) => {
                const withoutPending = prev.filter((m) => !m.pending);
                return [...withoutPending, { role: 'assistant', text: error.message || 'Something went wrong while asking the assistant.' }];
            });
        } finally {
            setLoading(false);
        }
    };

    const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleOutsideClick = (event) => {
            if (panelRef.current && !panelRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [isOpen]);

    const sendMessage = async () => {
        const question = input.trim();
        if (!question || loading) return;

        setInput('');
        setLoading(true);
        
        // Compile prior history for contextual query awareness
        const history = messages
            .filter((m) => !m.pending && m.text !== 'Thinking...')
            .slice(-6) // Send up to last 6 messages
            .map((m) => ({
                role: m.role,
                text: m.text,
            }));

        setMessages((prev) => [...prev, { role: 'user', text: question }, { role: 'assistant', text: 'Thinking...', pending: true }]);

        try {
            const response = await websiteChatbotService.ask(question, history);
            const rawAnswer = response?.data?.answer || 'I do not have that information on the website right now.';
            const answer = cleanAssistantText(rawAnswer) || 'I do not have that information on the website right now.';
            const sources = dedupeSources(response?.data?.sources || []);

            setMessages((prev) => {
                const withoutPending = prev.filter((m) => !m.pending);
                return [...withoutPending, { role: 'assistant', text: answer, sources }];
            });
        } catch (error) {
            setMessages((prev) => {
                const withoutPending = prev.filter((m) => !m.pending);
                return [...withoutPending, { role: 'assistant', text: error.message || 'Something went wrong while asking the assistant.', sources: [] }];
            });
        } finally {
            setLoading(false);
        }
    };

    const onKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="website-chatbot-root" aria-live="polite">
            {isOpen && (
                <div className="website-chatbot-panel" ref={panelRef}>
                    <div className="website-chatbot-header">
                        <div>
                            <h4>Ask Assistant</h4>
                        </div>
                        <button type="button" className="website-chatbot-close" onClick={() => setIsOpen(false)} aria-label="Close chatbot">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="website-chatbot-messages">
                        {messages.map((message, idx) => (
                            <div key={`${message.role}-${idx}`} className={`website-chatbot-bubble ${message.role === 'user' ? 'is-user' : 'is-assistant'}`}>
                                {renderMessageText(message)}
                                
                                {idx === 0 && messages.length === 1 && (
                                    <div className="website-chatbot-suggested-questions">
                                        <p className="website-chatbot-suggested-title">Suggested Questions</p>
                                        <div className="website-chatbot-suggested-grid">
                                            {SUGGESTED_QUESTIONS.map((q, qIdx) => (
                                                <button
                                                    key={`suggest-${qIdx}`}
                                                    type="button"
                                                    className="website-chatbot-suggested-chip"
                                                    onClick={() => sendSuggestedQuestion(q)}
                                                    disabled={loading}
                                                >
                                                    {q}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="website-chatbot-input-wrap">
                        <textarea
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="Ask about features, plans, security..."
                            rows={1}
                        />
                        <button type="button" onClick={sendMessage} disabled={!canSend}>
                            {loading ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                        </button>
                    </div>
                </div>
            )}

            {!isOpen && (
                <button
                    type="button"
                    className="website-chatbot-toggle"
                    onClick={() => setIsOpen(true)}
                    aria-label="Open website chatbot"
                >
                    <MessageCircle size={20} />
                    <span>Ask</span>
                </button>
            )}
        </div>
    );
}
