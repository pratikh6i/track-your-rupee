import { useState, useRef, useCallback } from 'react';
import { X, Camera, Upload, Loader2, AlertCircle, Check, Zap } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import './BillScanner.css';

// Rate limiter: 10 requests per minute
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;
let requestTimestamps = [];

const isRateLimited = () => {
    const now = Date.now();
    requestTimestamps = requestTimestamps.filter(ts => now - ts < RATE_WINDOW_MS);
    return requestTimestamps.length >= RATE_LIMIT;
};

const recordRequest = () => {
    requestTimestamps.push(Date.now());
};

// Get model based on request count
const getGeminiModel = (count) => {
    if (count < 10) return 'gemini-2.0-flash';
    if (count < 20) return 'gemini-2.5-flash';
    return 'gemma-3-12b';
};

// Master prompt for bill extraction
const BILL_EXTRACTION_PROMPT = `You are an expert bill/receipt OCR system. Analyze this image and extract expense data.

IMPORTANT: You MUST respond with ONLY valid JSON. No text, no markdown, no code blocks, no explanation. JUST THE JSON ARRAY.

CRITICAL RULES:
1. If image is NOT a bill/receipt: {"error": "not_a_bill", "message": "This doesn't appear to be a bill or receipt"}
2. If image is too blurry: {"error": "blurry", "message": "Image is too blurry. Please retake with better lighting"}
3. For valid bills: Return a JSON array of expense items (structure below)

SUPPORTED INPUTS:
- Thermal receipts, printed invoices, handwritten bills
- Multi-language bills (Hindi, English, Marathi, Tamil, etc.)
- UPI/payment screenshots

REQUIRED OUTPUT FORMAT (STRICT JSON, NO MARKDOWN):
[{"date":"YYYY-MM-DD","item":"Description","category":"Food|Transportation|Shopping|Health|Entertainment|Bills|Essentials|Other","amount":123.45,"vendor":"Store name","confidence":0.95}]

GUIDELINES:
- Restaurant: One entry with total
- Grocery: Combine items, use total amount
- Missing date: Use today (${new Date().toISOString().split('T')[0]})
- Unknown category: "Other"
- amount MUST be a number, not string

RESPOND WITH ONLY THE JSON. NOTHING ELSE.`;


const BillScanner = ({ onClose, onExpensesAdded }) => {
    const fileInputRef = useRef(null);
    const { addExpense } = useGoogleAuth();
    const {
        sheetData,
        geminiApiKey,
        geminiRequestCount,
        incrementGeminiRequestCount
    } = useStore();

    const [imageData, setImageData] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [parsedExpenses, setParsedExpenses] = useState(null);
    const [addingStatus, setAddingStatus] = useState(null);

    // Check for duplicates
    const isDuplicate = useCallback((expense) => {
        const normalize = (str) => str ? str.toLowerCase().trim() : '';
        const newHash = `${expense.date}-${expense.amount}-${normalize(expense.item)}`;

        return sheetData.some(existing => {
            const existingHash = `${existing.date}-${existing.amount}-${normalize(existing.item)}`;
            if (existingHash === newHash) return true;

            // Fuzzy match: same date, similar amount (±5%), similar item
            if (existing.date === expense.date) {
                const amountDiff = Math.abs(existing.amount - expense.amount) / expense.amount;
                if (amountDiff < 0.05) return true;
            }
            return false;
        });
    }, [sheetData]);

    // Handle file selection
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setParsedExpenses(null);

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Read and compress image
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Compress to max 768px for token efficiency
                const canvas = document.createElement('canvas');
                const maxDim = 768;
                let { width, height } = img;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = (height / width) * maxDim;
                        width = maxDim;
                    } else {
                        width = (width / height) * maxDim;
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to base64 (JPEG quality 85)
                const compressedData = canvas.toDataURL('image/jpeg', 0.85);
                setImageData(compressedData.split(',')[1]); // Remove data:image/jpeg;base64, prefix
                setImagePreview(compressedData);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Process image with Gemini
    const processWithGemini = async () => {
        if (!imageData) {
            setError('Please capture or upload an image first');
            return;
        }

        if (!geminiApiKey) {
            setError('Please add your Gemini API key in Settings first');
            return;
        }

        if (isRateLimited()) {
            setError('Rate limit reached. Please wait a minute before trying again.');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setParsedExpenses(null);

        try {
            const model = "gemini-1.5-flash"; // Use flash for speed
            console.log(`Using Gemini model: ${model}`);

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: BILL_EXTRACTION_PROMPT },
                                {
                                    inline_data: {
                                        mime_type: 'image/jpeg',
                                        data: base64Image
                                    }
                                }
                            ]
                        }]
                    })
                }
            );

            recordRequest();
            incrementGeminiRequestCount();

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Gemini API request failed');
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
                throw new Error('No response from Gemini');
            }

            // Parse JSON response
            let parsed;
            try {
                // Try to extract JSON from response (handle potential markdown wrapper)
                const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch {
                throw new Error('Failed to parse Gemini response. Please try again.');
            }

            // Check for error responses
            if (parsed.error) {
                if (parsed.error === 'not_a_bill') {
                    setError('This doesn\'t appear to be a bill or receipt. Please upload a valid bill image.');
                } else if (parsed.error === 'blurry') {
                    setError('Image is too blurry. Please retake with better lighting.');
                } else {
                    setError(parsed.message || 'Could not process this image');
                }
                return;
            }

            // Ensure array format
            const expenses = Array.isArray(parsed) ? parsed : [parsed];

            // Add duplicate flag and format
            const processedExpenses = expenses.map(exp => ({
                ...exp,
                date: exp.date || new Date().toISOString().split('T')[0],
                paymentMethod: 'UPI',
                notes: exp.vendor || '',
                month: new Date(exp.date || Date.now()).toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
                isDuplicate: isDuplicate(exp)
            }));

            setParsedExpenses(processedExpenses);

        } catch (err) {
            console.error('Gemini processing error:', err);
            setError(err.message || 'Failed to process image');
        } finally {
            setIsProcessing(false);
        }
    };

    // Add all expenses
    const addAllExpenses = async () => {
        if (!parsedExpenses) return;

        setAddingStatus({ adding: true, count: 0 });
        let added = 0;
        let skipped = 0;

        for (const expense of parsedExpenses) {
            if (expense.isDuplicate) {
                skipped++;
            } else {
                await addExpense(expense);
                added++;
                setAddingStatus({ adding: true, count: added });
            }
        }

        setAddingStatus({ adding: false, count: added, skipped });

        setTimeout(() => {
            if (onExpensesAdded) onExpensesAdded(added);
            onClose();
        }, 1500);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const totalAmount = parsedExpenses?.reduce((sum, e) => sum + (e.isDuplicate ? 0 : e.amount), 0) || 0;
    const duplicateCount = parsedExpenses?.filter(e => e.isDuplicate).length || 0;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="scanner-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><Camera size={20} /> Scan Bill</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="scanner-content">
                    {!parsedExpenses ? (
                        <>
                            {/* Image Preview */}
                            {imagePreview ? (
                                <div className="image-preview">
                                    <img src={imagePreview} alt="Bill preview" />
                                    <div className="preview-overlay">
                                        <p>📷 Image captured! Review and proceed.</p>
                                    </div>
                                    <div className="preview-actions">
                                        <button
                                            className="btn-retake"
                                            onClick={() => {
                                                setImagePreview(null);
                                                setImageData(null);
                                                fileInputRef.current.value = '';
                                            }}
                                        >
                                            ↻ Retake
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="capture-area">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleFileSelect}
                                        style={{ display: 'none' }}
                                    />
                                    <button
                                        className="btn-capture"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Camera size={32} />
                                        <span>Take Photo</span>
                                    </button>
                                    <button
                                        className="btn-upload"
                                        onClick={() => {
                                            fileInputRef.current.removeAttribute('capture');
                                            fileInputRef.current?.click();
                                            setTimeout(() => {
                                                fileInputRef.current?.setAttribute('capture', 'environment');
                                            }, 100);
                                        }}
                                    >
                                        <Upload size={20} />
                                        <span>Upload Image</span>
                                    </button>
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <div className="error-msg">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            {/* Process Button */}
                            {imagePreview && (
                                <button
                                    className="btn-process"
                                    onClick={processWithGemini}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 size={20} className="spin" />
                                            Processing with AI...
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={20} />
                                            Extract Expenses
                                        </>
                                    )}
                                </button>
                            )}

                            {/* API Key Warning */}
                            {!geminiApiKey && (
                                <div className="api-warning">
                                    <AlertCircle size={16} />
                                    Add your Gemini API key in Profile to use AI scanning
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Results */}
                            <div className="results-header">
                                <h3>Found {parsedExpenses.length} Item(s)</h3>
                                <span className="results-total">{formatCurrency(totalAmount)}</span>
                            </div>

                            {duplicateCount > 0 && (
                                <div className="duplicate-warning">
                                    <AlertCircle size={14} />
                                    {duplicateCount} duplicate(s) will be skipped
                                </div>
                            )}

                            <div className="results-list">
                                {parsedExpenses.map((expense, i) => (
                                    <div key={i} className={`result-item ${expense.isDuplicate ? 'duplicate' : ''}`}>
                                        <div className="result-info">
                                            <span className="result-name">
                                                {expense.item}
                                                {expense.isDuplicate && <span className="dup-badge">DUP</span>}
                                            </span>
                                            <span className="result-meta">
                                                {expense.category} • {expense.date}
                                                {expense.confidence && (
                                                    <span className="confidence"> • {Math.round(expense.confidence * 100)}% conf</span>
                                                )}
                                            </span>
                                        </div>
                                        <span className="result-amount">{formatCurrency(expense.amount)}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Add Button */}
                            {addingStatus?.adding !== false ? (
                                <button
                                    className="btn-add-all"
                                    onClick={addAllExpenses}
                                    disabled={addingStatus?.adding}
                                >
                                    {addingStatus?.adding ? (
                                        <>
                                            <Loader2 size={18} className="spin" />
                                            Adding {addingStatus.count}...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={18} />
                                            Add {parsedExpenses.length - duplicateCount} Expense(s)
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="success-status">
                                    <Check size={20} />
                                    Added {addingStatus.count} expense(s)!
                                    {addingStatus.skipped > 0 && ` (${addingStatus.skipped} skipped)`}
                                </div>
                            )}

                            <button
                                className="btn-back"
                                onClick={() => {
                                    setParsedExpenses(null);
                                    setImagePreview(null);
                                    setImageData(null);
                                }}
                            >
                                ← Scan Another
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BillScanner;
