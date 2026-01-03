import { useState } from 'react';
import { X, Copy, Check, Zap, Sparkles } from 'lucide-react';
import './HelpModal.css';

const PROMPTS = [
    {
        title: "📸 Receipt Scanner",
        description: "Paste a photo of your receipt or bill",
        prompt: `I'm pasting a photo of my receipt/bill. Extract all items and return ONLY a JSON array in this exact format, no other text:

[
  {
    "date": "YYYY-MM-DD",
    "item": "Item name",
    "category": "Food|Transportation|Essentials/Personal Care|Telecommunications|Family Spent|Gifts/Donations|Trip/Entry Fees|Medical|BRIBE|Entertainment|Shopping|Bills & Utilities",
    "subcategory": "Specific type like Lunch/Dinner/Petrol/Auto etc",
    "amount": 123.45,
    "paymentMethod": "UPI|Cash|Card|Bitcoin"
  }
]

Use today's date if not visible. Amounts in INR. Return ONLY the JSON array.`
    },
    {
        title: "💬 Voice/Text Entry",
        description: "Describe expenses in natural language",
        prompt: `Convert this expense description into JSON. Return ONLY a JSON array, no other text:

[
  {
    "date": "YYYY-MM-DD",
    "item": "Item name",
    "category": "Food|Transportation|Essentials/Personal Care|Telecommunications|Family Spent|Gifts/Donations|Trip/Entry Fees|Medical|BRIBE|Entertainment|Shopping|Bills & Utilities",
    "subcategory": "Specific type",
    "amount": 123.45,
    "paymentMethod": "UPI|Cash|Card|Bitcoin"
  }
]

Categories for Food subcategory: Lunch, Dinner, Breakfast, Fruits, Milk, Dates, Cashew, Almond, Snacks, Beverages, Groceries.
Default paymentMethod to "UPI". Use today's date if not specified. Return ONLY JSON.

My expenses: `
    },
    {
        title: "📊 Bank Statement",
        description: "Paste bank statement text",
        prompt: `Parse this bank statement and extract expenses. Return ONLY a JSON array:

[
  {
    "date": "YYYY-MM-DD",
    "item": "Transaction description",
    "category": "Best matching category",
    "subcategory": "Specific type if applicable",
    "amount": 123.45,
    "paymentMethod": "UPI|Cash|Card|Bitcoin"
  }
]

Categories: Food, Transportation, Essentials/Personal Care, Telecommunications, Family Spent, Gifts/Donations, Trip/Entry Fees, Medical, BRIBE, Entertainment, Shopping, Bills & Utilities.

Skip income/credits. Only include debits/expenses. Return ONLY JSON.

Statement text:`
    }
];

const HelpModal = ({ onClose }) => {
    const [copiedIndex, setCopiedIndex] = useState(null);

    const copyPrompt = async (text, index) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="help-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><Zap size={20} /> AI Quick-Add Prompts</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="help-content">
                    <p className="help-intro">
                        <Sparkles size={16} /> Copy a prompt, paste in Gemini/ChatGPT, then paste the JSON output in Quick-Add.
                    </p>

                    <div className="prompts-list">
                        {PROMPTS.map((p, i) => (
                            <div key={i} className="prompt-card">
                                <div className="prompt-header">
                                    <h3>{p.title}</h3>
                                    <p>{p.description}</p>
                                </div>
                                <button
                                    className={`btn-copy ${copiedIndex === i ? 'copied' : ''}`}
                                    onClick={() => copyPrompt(p.prompt, i)}
                                >
                                    {copiedIndex === i ? (
                                        <><Check size={16} /> Copied!</>
                                    ) : (
                                        <><Copy size={16} /> Copy Prompt</>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="help-tip">
                        <strong>💡 Pro Tip:</strong> After getting JSON from AI, use the ⚡ Quick-Add button on the dashboard to paste and import all expenses at once!
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpModal;
