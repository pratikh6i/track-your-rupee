import { useState } from 'react';
import { X, Zap, AlertCircle, Check, Loader2, Copy, ExternalLink } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import './AIQuickAdd.css';

const AIQuickAdd = ({ onClose }) => {
    const { addExpense } = useGoogleAuth();
    const { sheetData } = useStore();
    const [jsonInput, setJsonInput] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [error, setError] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [addedCount, setAddedCount] = useState(0);
    const [skippedCount, setSkippedCount] = useState(0);

    const SAMPLE_PROMPT = `Analyze this bill image and extract expenses as a JSON array. Each object must have:
- "date": "YYYY-MM-DD"
- "item": "Short description"
- "category": "Food/Travel/Shopping/Bills/Entertainment/Health/Other"
- "amount": Number (no currency symbol)
- "paymentMethod": "UPI"
- "notes": "Vendor name"

Return ONLY the JSON array, no markdown.`;

    const copyPrompt = () => {
        navigator.clipboard.writeText(SAMPLE_PROMPT);
    };

    // Duplicate check using hash
    const isDuplicate = (expense) => {
        const normalize = (str) => str ? str.toLowerCase().trim() : '';
        const newHash = `${expense.date}-${expense.amount}-${normalize(expense.item)}`;

        return sheetData.some(existing => {
            const existingHash = `${existing.date}-${existing.amount}-${normalize(existing.item)}`;
            return existingHash === newHash;
        });
    };

    const parseJSON = () => {
        setError(null);
        setParsedData(null);

        if (!jsonInput.trim()) {
            setError('Please paste JSON data from AI');
            return;
        }

        try {
            let jsonStr = jsonInput.trim();

            // Extract JSON array from response
            const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                jsonStr = arrayMatch[0];
            }

            const data = JSON.parse(jsonStr);

            if (!Array.isArray(data)) {
                setError('Expected a JSON array. Make sure AI returned an array of expenses.');
                return;
            }

            if (data.length === 0) {
                setError('No expenses found in the JSON');
                return;
            }

            // Validate and clean each entry
            const cleanedData = data.map((item, i) => ({
                date: item.date || new Date().toISOString().split('T')[0],
                item: item.item || item.description || `Item ${i + 1}`,
                category: item.category || 'Food',
                subcategory: item.subcategory || '',
                amount: parseFloat(item.amount) || 0,
                paymentMethod: 'UPI', // Always UPI
                notes: item.notes || '',
                month: new Date(item.date || Date.now()).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
            }));

            // Mark duplicates
            const dataWithDuplicateFlag = cleanedData.map(item => ({
                ...item,
                isDuplicate: isDuplicate(item)
            }));

            setParsedData(dataWithDuplicateFlag);
        } catch {
            setError('Invalid JSON format. Make sure the AI response is pure JSON.');
        }
    };

    const addAllExpenses = async () => {
        if (!parsedData || parsedData.length === 0) return;

        setIsAdding(true);
        setAddedCount(0);
        setSkippedCount(0);

        let added = 0;
        let skipped = 0;

        for (let i = 0; i < parsedData.length; i++) {
            const item = parsedData[i];
            if (item.isDuplicate) {
                skipped++;
                setSkippedCount(skipped);
            } else {
                await addExpense(item);
                added++;
                setAddedCount(added);
            }
        }

        setTimeout(() => {
            onClose();
        }, 1500);

        setIsAdding(false);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const totalAmount = parsedData?.reduce((sum, item) => sum + (item.isDuplicate ? 0 : item.amount), 0) || 0;
    const duplicateCount = parsedData?.filter(item => item.isDuplicate).length || 0;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="ai-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><Zap size={20} /> AI Quick Add</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="ai-content">
                    {!parsedData ? (
                        <>
                            <div className="ai-instructions">
                                <h4>How to use:</h4>
                                <ol>
                                    <li>Open <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer">Gemini <ExternalLink size={12} /></a> or ChatGPT</li>
                                    <li>Upload your bill/receipt image</li>
                                    <li>Use this prompt:</li>
                                </ol>
                                <div className="prompt-box">
                                    <pre>{SAMPLE_PROMPT}</pre>
                                    <button className="btn-copy" onClick={copyPrompt} title="Copy prompt">
                                        <Copy size={14} />
                                    </button>
                                </div>
                                <p>Then paste the JSON response below:</p>
                            </div>

                            <textarea
                                className="json-input"
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                placeholder='[{"date": "2026-01-04", "item": "Lunch", "category": "Food", "amount": 150, ...}]'
                                rows={6}
                            />

                            {error && (
                                <div className="error-msg">
                                    <AlertCircle size={16} /> {error}
                                </div>
                            )}

                            <button className="btn-parse" onClick={parseJSON} disabled={!jsonInput.trim()}>
                                <Zap size={18} /> Parse JSON
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="preview-header">
                                <h3>Found {parsedData.length} Items</h3>
                                <span className="preview-total">{formatCurrency(totalAmount)}</span>
                            </div>

                            {duplicateCount > 0 && (
                                <div className="duplicate-warning">
                                    <AlertCircle size={14} />
                                    {duplicateCount} duplicate(s) will be skipped
                                </div>
                            )}

                            <div className="preview-list">
                                {parsedData.map((item, i) => (
                                    <div key={i} className={`preview-item ${item.isDuplicate ? 'duplicate' : ''}`}>
                                        <div className="preview-info">
                                            <span className="preview-name">
                                                {item.item}
                                                {item.isDuplicate && <span className="dup-badge">DUPLICATE</span>}
                                            </span>
                                            <span className="preview-meta">{item.category} • {item.date}</span>
                                        </div>
                                        <span className="preview-amount">{formatCurrency(item.amount)}</span>
                                    </div>
                                ))}
                            </div>

                            {isAdding ? (
                                <div className="adding-status">
                                    <Loader2 size={20} className="spin" />
                                    <span>Adding {addedCount}/{parsedData.length - duplicateCount}...</span>
                                    {skippedCount > 0 && <span className="skipped">({skippedCount} skipped)</span>}
                                </div>
                            ) : addedCount > 0 ? (
                                <div className="success-status">
                                    <Check size={20} />
                                    <span>Added {addedCount} expenses! {skippedCount > 0 && `(${skippedCount} skipped)`}</span>
                                </div>
                            ) : (
                                <div className="preview-actions">
                                    <button className="btn-secondary" onClick={() => setParsedData(null)}>
                                        ← Back
                                    </button>
                                    <button className="btn-add-all" onClick={addAllExpenses}>
                                        <Check size={18} /> Add {parsedData.length - duplicateCount} Expenses
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIQuickAdd;
