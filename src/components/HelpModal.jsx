import { useState } from 'react';
import { X, Copy, Check, Camera, FileText, Mic } from 'lucide-react';
import './HelpModal.css';

const PROMPTS = [
    {
        id: 'snap-scan',
        icon: <Camera />,
        name: 'Snap & Scan',
        description: 'Use this when you have a photo of a physical bill (D-Mart, Restaurant, etc.)',
        prompt: `Analyze this image of a receipt. Extract every purchased item. Return a strictly valid JSON array where each object has these keys: date (YYYY-MM-DD), item (string name), category (guess the category, e.g., Grocery, Electronics), amount (number only), payment_method (Cash/Card/UPI), and notes (store name). Do not write any conversational text, just the JSON code.`
    },
    {
        id: 'messy-paste',
        icon: <FileText />,
        name: 'Messy Paste',
        description: 'Use this when you paste a messy bank SMS or email confirmation.',
        prompt: `I am pasting a transaction message below. Please extract the financial details and format them into a JSON object with keys: date, item, category, amount, payment_method. If the date is missing, use today's date: ${new Date().toISOString().split('T')[0]}. Here is the text: [PASTE TEXT HERE]. Return ONLY JSON.`
    },
    {
        id: 'voice-log',
        icon: <Mic />,
        name: 'Voice Log',
        description: 'Use this when you just want to ramble to Gemini about your day.',
        prompt: `I am going to tell you what I spent money on today. Please listen and output a JSON list for my finance tracker. Keys: item, amount, category. If I say 'I bought a coffee for 5 dollars and a bagel for 3', split them into two items. Here is my input: [PASTE SPEECH TEXT]. Return ONLY JSON.`
    }
];

const HelpModal = ({ onClose }) => {
    const [copiedId, setCopiedId] = useState(null);

    const handleCopy = async (id, text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content help-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>The 3 Golden Prompts ✨</h2>
                    <button className="btn-icon-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <p className="modal-intro">
                        Copy these prompts and use them with Gemini, ChatGPT, or any AI assistant. Then paste the JSON response in Quick-Add.
                    </p>

                    <div className="prompts-list">
                        {PROMPTS.map((prompt) => (
                            <div key={prompt.id} className="prompt-card">
                                <div className="prompt-header">
                                    <div className="prompt-icon">{prompt.icon}</div>
                                    <div className="prompt-meta">
                                        <h3>{prompt.name}</h3>
                                        <p>{prompt.description}</p>
                                    </div>
                                </div>

                                <div className="prompt-text">
                                    <pre>{prompt.prompt}</pre>
                                </div>

                                <button
                                    className="btn btn-secondary copy-btn"
                                    onClick={() => handleCopy(prompt.id, prompt.prompt)}
                                >
                                    {copiedId === prompt.id ? (
                                        <>
                                            <Check size={16} />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={16} />
                                            Copy Prompt
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpModal;
