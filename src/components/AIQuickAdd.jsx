import { useState } from 'react';
import { X, Zap, AlertCircle, Check, Loader2 } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import './AIQuickAdd.css';

const AIQuickAdd = ({ onClose }) => {
    const { addExpense } = useGoogleAuth();
    const [jsonInput, setJsonInput] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [error, setError] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [addedCount, setAddedCount] = useState(0);

    const parseJSON = () => {
        setError(null);
        setParsedData(null);

        if (!jsonInput.trim()) {
            setError('Please paste JSON data from AI');
            return;
        }

        try {
            // Try to extract JSON array from the input (in case there's extra text)
            let jsonStr = jsonInput.trim();

            // Find JSON array in the input
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
                paymentMethod: item.paymentMethod || item.payment_method || 'UPI',
                notes: item.notes || '',
                month: new Date(item.date || Date.now()).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
            }));

            setParsedData(cleanedData);
        } catch (err) {
            setError(`Invalid JSON: ${err.message}. Make sure the AI response is pure JSON.`);
        }
    };

    const addAllExpenses = async () => {
        if (!parsedData || parsedData.length === 0) return;

        setIsAdding(true);
        setAddedCount(0);

        try {
            for (let i = 0; i < parsedData.length; i++) {
                await addExpense(parsedData[i]);
                setAddedCount(i + 1);
            }

            // Success - close after brief delay
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err) {
            setError('Failed to add some expenses. Please try again.');
        } finally {
            setIsAdding(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const totalAmount = parsedData?.reduce((sum, item) => sum + item.amount, 0) || 0;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="ai-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><Zap size={20} /> Quick-Add from AI</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="ai-content">
                    {!parsedData ? (
                        <>
                            <p className="ai-intro">
                                Paste the JSON output from Gemini/ChatGPT below:
                            </p>

                            <textarea
                                className="json-input"
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                placeholder='[{"date": "2026-01-03", "item": "Lunch", "category": "Food", "amount": 150, ...}]'
                                rows={8}
                                autoFocus
                            />

                            {error && (
                                <div className="error-msg">
                                    <AlertCircle size={16} /> {error}
                                </div>
                            )}

                            <button className="btn-parse" onClick={parseJSON}>
                                <Zap size={18} /> Parse JSON
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="preview-header">
                                <h3>Preview ({parsedData.length} expenses)</h3>
                                <span className="preview-total">{formatCurrency(totalAmount)}</span>
                            </div>

                            <div className="preview-list">
                                {parsedData.map((item, i) => (
                                    <div key={i} className="preview-item">
                                        <div className="preview-info">
                                            <span className="preview-name">{item.item}</span>
                                            <span className="preview-meta">{item.category} • {item.date}</span>
                                        </div>
                                        <span className="preview-amount">{formatCurrency(item.amount)}</span>
                                    </div>
                                ))}
                            </div>

                            {isAdding ? (
                                <div className="adding-status">
                                    <Loader2 size={20} className="spin" />
                                    <span>Adding {addedCount}/{parsedData.length}...</span>
                                </div>
                            ) : addedCount === parsedData.length ? (
                                <div className="success-status">
                                    <Check size={20} />
                                    <span>All {addedCount} expenses added!</span>
                                </div>
                            ) : (
                                <div className="preview-actions">
                                    <button className="btn-secondary" onClick={() => setParsedData(null)}>
                                        ← Back
                                    </button>
                                    <button className="btn-add-all" onClick={addAllExpenses}>
                                        <Check size={18} /> Add All {parsedData.length} Expenses
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
