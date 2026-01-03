import { useState } from 'react';
import { X, Zap, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import useGoogleSheets from '../hooks/useGoogleSheets';
import './AIQuickAdd.css';

const AIQuickAdd = ({ onClose }) => {
    const [jsonInput, setJsonInput] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const { appendExpenses } = useGoogleSheets();

    const validateAndParse = () => {
        setError(null);
        setParsedData(null);

        if (!jsonInput.trim()) {
            setError('Please paste some JSON data');
            return;
        }

        try {
            // Try to extract JSON from the input (in case there's extra text)
            const jsonMatch = jsonInput.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in input');
            }

            let data = JSON.parse(jsonMatch[0]);

            // Ensure it's an array
            if (!Array.isArray(data)) {
                data = [data];
            }

            // Validate required fields
            const validated = data.map((item, index) => {
                if (!item.item && !item.name) {
                    throw new Error(`Item ${index + 1}: Missing "item" or "name" field`);
                }
                if (item.amount === undefined) {
                    throw new Error(`Item ${index + 1}: Missing "amount" field`);
                }

                return {
                    date: item.date || new Date().toISOString().split('T')[0],
                    item: item.item || item.name,
                    category: item.category || 'Uncategorized',
                    amount: parseFloat(item.amount) || 0,
                    payment_method: item.payment_method || item.paymentMethod || '',
                    notes: item.notes || item.store || '',
                };
            });

            setParsedData(validated);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSubmit = async () => {
        if (!parsedData || parsedData.length === 0) return;

        setIsLoading(true);
        setError(null);

        try {
            await appendExpenses(parsedData);
            setSuccess(`Successfully added ${parsedData.length} item${parsedData.length > 1 ? 's' : ''}! 🎉`);

            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(Math.abs(amount));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content ai-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">
                        <Zap className="text-blue" size={24} />
                        <h2>Quick-Add via AI</h2>
                    </div>
                    <button className="btn-icon-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <p className="modal-subtitle">
                        Paste the JSON output from Gemini or ChatGPT below. We'll parse it and add the expenses to your sheet.
                    </p>

                    <div className="json-input-container">
                        <textarea
                            className="input textarea json-textarea"
                            placeholder={`[
  {
    "date": "2026-01-03",
    "item": "Coffee",
    "category": "Food & Drinks",
    "amount": 150,
    "payment_method": "UPI"
  }
]`}
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            disabled={isLoading || success}
                        />
                    </div>

                    {error && (
                        <div className="message error">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="message success">
                            <CheckCircle size={18} />
                            {success}
                        </div>
                    )}

                    {!success && (
                        <button
                            className="btn btn-secondary validate-btn"
                            onClick={validateAndParse}
                            disabled={isLoading || !jsonInput.trim()}
                        >
                            Validate JSON
                        </button>
                    )}

                    {parsedData && !success && (
                        <div className="preview-section">
                            <h4>Preview ({parsedData.length} item{parsedData.length > 1 ? 's' : ''})</h4>
                            <div className="preview-list">
                                {parsedData.map((item, index) => (
                                    <div key={index} className="preview-item">
                                        <div className="preview-info">
                                            <span className="preview-name">{item.item}</span>
                                            <span className="preview-category">{item.category}</span>
                                        </div>
                                        <span className="preview-amount">{formatCurrency(item.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {parsedData && !success && (
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
                            Cancel
                        </button>
                        <button
                            className="btn btn-success"
                            onClick={handleSubmit}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={18} />
                                    Add to Sheet
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIQuickAdd;
