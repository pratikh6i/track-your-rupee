import { useState, useRef } from 'react';
import { X, Zap, AlertCircle, Check, Loader2, Upload, FileImage, ImagePlus } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import './AIQuickAdd.css';

const AIQuickAdd = ({ onClose }) => {
    const { addExpense } = useGoogleAuth();
    const [parsedData, setParsedData] = useState(null);
    const [error, setError] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [addedCount, setAddedCount] = useState(0);
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            setError("File too large. Max 10MB.");
            return;
        }

        analyzeImage(file);
    };

    const analyzeImage = async (file) => {
        setIsAnalyzing(true);
        setError(null);
        setParsedData(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://127.0.0.1:5000/analyze', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to analyze image');
            }

            parseAIResponse(data.analysis);
        } catch (err) {
            console.error(err);
            setError(err.message === 'Failed to fetch'
                ? 'Backend server not running. Run "python server.py" in terminal.'
                : err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const parseAIResponse = (jsonString) => {
        try {
            let cleanJson = jsonString.trim();
            // Extract array if wrapped in text
            const match = cleanJson.match(/\[[\s\S]*\]/);
            if (match) cleanJson = match[0];

            const data = JSON.parse(cleanJson);

            if (!Array.isArray(data)) throw new Error("AI did not return a list of expenses");

            setParsedData(data);
        } catch (err) { // eslint-disable-line no-unused-vars
            setError("Failed to parse AI response. Try again with a clearer image.");
        }
    };

    const addAllExpenses = async () => {
        if (!parsedData || parsedData.length === 0) return;

        setIsAdding(true);
        setAddedCount(0);

        try {
            for (let i = 0; i < parsedData.length; i++) {
                // Ensure UPI enforcement here as separate safety net
                const expense = {
                    ...parsedData[i],
                    paymentMethod: 'UPI'
                };
                await addExpense(expense);
                setAddedCount(i + 1);
            }

            setTimeout(() => {
                onClose();
            }, 1000);
        } catch {
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

    const totalAmount = parsedData?.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) || 0;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="ai-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><Zap size={20} /> AI Bill Scanner</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="ai-content">
                    {!parsedData && !isAnalyzing ? (
                        <div className="upload-section">
                            <div
                                className="drop-zone"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="icon-circle">
                                    <ImagePlus size={32} />
                                </div>
                                <p className="drop-title">Upload Bill / Receipt</p>
                                <p className="drop-subtitle">Supports JPG, PNG (Max 10MB)</p>
                                <button className="btn-select-file">Select Image</button>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                            {error && (
                                <div className="error-msg">
                                    <AlertCircle size={16} /> {error}
                                </div>
                            )}
                        </div>
                    ) : isAnalyzing ? (
                        <div className="analyzing-state">
                            <Loader2 size={48} className="spin text-primary" />
                            <h3>Analyzing Receipt...</h3>
                            <p>Extracting items, prices, and dates securely.</p>
                        </div>
                    ) : (
                        <>
                            <div className="preview-header">
                                <h3>Found {parsedData.length} Items</h3>
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
                                    <span>Successfully added all expenses!</span>
                                </div>
                            ) : (
                                <div className="preview-actions">
                                    <button className="btn-secondary" onClick={() => setParsedData(null)}>
                                        Retry
                                    </button>
                                    <button className="btn-add-all" onClick={addAllExpenses}>
                                        <Check size={18} /> Add All to Sheet
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
