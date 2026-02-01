import { useState, useRef, useCallback } from 'react';
import { X, Mic, MicOff, Loader2, AlertCircle, Check, Zap, Volume2 } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import './VoiceScanner.css';

// Rate limiter: 10 requests per minute (shared with BillScanner)
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

// Master prompt for voice-based expense extraction
const VOICE_EXTRACTION_PROMPT = `You are an expert expense tracker. Extract expense data from this Marathi/Hindi/English voice transcription.

IMPORTANT: You MUST respond with ONLY valid JSON. No text, no markdown, no code blocks, no explanation. JUST THE JSON ARRAY.

CRITICAL RULES:
1. If text is NOT about expenses: {"error": "not_expense", "message": "This doesn't appear to be about an expense"}
2. If text is unclear: {"error": "unclear", "message": "Please speak more clearly about the expense"}
3. For valid expense text: Return a JSON array of expense items (structure below)

SUPPORTED INPUTS:
- Marathi: "आज चाय ला दहा रुपये दिले" → Tea, 10 rupees, today
- Hindi: "कल दूध के लिए पचास रुपये खर्च किये" → Milk, 50 rupees, yesterday
- English: "Spent 100 on groceries today"
- Mixed languages

REQUIRED OUTPUT FORMAT (STRICT JSON, NO MARKDOWN):
[{"date":"YYYY-MM-DD","item":"Description","category":"Food|Transportation|Shopping|Health|Entertainment|Bills|Essentials|Other","amount":123.45,"vendor":"","confidence":0.95}]

GUIDELINES:
- Extract date from context (आज/today=today, काल/yesterday=yesterday, परवा=day before yesterday)
- Missing date: Use today (${new Date().toISOString().split('T')[0]})
- Extract amount (रुपये/rupees/rs/₹)
- Categorize intelligently (चाय/tea→Food, किराणा/groceries→Essentials, etc.)
- amount MUST be a number, not string
- Set confidence based on clarity (0.0-1.0)

RESPOND WITH ONLY THE JSON. NOTHING ELSE.`;

const VoiceScanner = ({ onClose, onExpensesAdded }) => {
    const { addExpense } = useGoogleAuth();
    const {
        sheetData,
        geminiApiKey,
        geminiRequestCount,
        incrementGeminiRequestCount
    } = useStore();

    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [parsedExpenses, setParsedExpenses] = useState(null);
    const [addingStatus, setAddingStatus] = useState(null);
    const [interimTranscript, setInterimTranscript] = useState('');

    const recognitionRef = useRef(null);
    const previousFinalTranscript = useRef('');
    const silenceTimerRef = useRef(null);

    // Check for duplicates
    const isDuplicate = useCallback((expense) => {
        const normalize = (str) => str ? str.toLowerCase().trim() : '';
        const newHash = `${expense.date}-${expense.amount}-${normalize(expense.item)}`;

        return sheetData.some(existing => {
            const existingHash = `${existing.date}-${existing.amount}-${normalize(existing.item)}`;
            if (existingHash === newHash) return true;

            // Fuzzy match: same date, similar amount (±5%)
            if (existing.date === expense.date) {
                const amountDiff = Math.abs(existing.amount - expense.amount) / expense.amount;
                if (amountDiff < 0.05) return true;
            }
            return false;
        });
    }, [sheetData]);

    // Initialize speech recognition
    const initializeSpeechRecognition = useCallback(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
            return null;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.lang = 'mr-IN'; // Marathi (India)
        recognition.continuous = false; // Disable continuous to prevent duplicates
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            console.log('🎤 Voice recognition started (Marathi)');
            setIsRecording(true);
            setError(null);
        };

        recognition.onresult = (event) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcriptPart = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += transcriptPart + ' ';
                } else {
                    interim += transcriptPart;
                }
            }

            if (final) {
                // Deduplicate: only add if different from previous final
                if (final.trim() !== previousFinalTranscript.current.trim()) {
                    setTranscript(prev => prev + final);
                    previousFinalTranscript.current = final;
                }
                setInterimTranscript('');

                // Auto-restart recognition to continue listening
                if (recognitionRef.current) {
                    // Clear any existing silence timer
                    if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                    }
                    // Set timer to stop after 2 seconds of silence
                    silenceTimerRef.current = setTimeout(() => {
                        if (recognitionRef.current) {
                            recognitionRef.current.stop();
                        }
                    }, 2000);

                    // Restart recognition
                    try {
                        recognitionRef.current.start();
                    } catch (e) {
                        // Ignore if already started
                    }
                }
            } else {
                setInterimTranscript(interim);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                setError('No speech detected. Please try again.');
            } else if (event.error === 'not-allowed') {
                setError('Microphone access denied. Please enable microphone permissions.');
            } else {
                setError(`Recognition error: ${event.error}`);
            }
            setIsRecording(false);
        };

        recognition.onend = () => {
            console.log('🎤 Voice recognition ended');
            setIsRecording(false);
        };

        return recognition;
    }, []);

    // Start recording
    const startRecording = () => {
        setTranscript('');
        setInterimTranscript('');
        setError(null);
        setParsedExpenses(null);
        previousFinalTranscript.current = ''; // Clear previous transcript tracking

        // Clear any existing silence timer
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        const recognition = initializeSpeechRecognition();
        if (recognition) {
            recognitionRef.current = recognition;
            recognition.start();
        }
    };

    // Stop recording
    const stopRecording = () => {
        // Clear silence timer
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsRecording(false);
    };

    // Process transcript with Gemini
    const processWithGemini = async () => {
        if (!transcript.trim()) {
            setError('No speech detected. Please record again.');
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
            const model = "gemini-1.5-flash"; // Stable and fast for text processing
            console.log(`Using Gemini model: ${model}`);
            console.log('Transcript:', transcript);

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: VOICE_EXTRACTION_PROMPT },
                                { text: `\n\nUser's speech: "${transcript}"` }
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
                if (parsed.error === 'not_expense') {
                    setError('This doesn\'t appear to be about an expense. Please describe what you spent money on.');
                } else if (parsed.error === 'unclear') {
                    setError('Speech was unclear. Please speak more clearly about the expense.');
                } else {
                    setError(parsed.message || 'Could not understand the speech');
                }
                return;
            }

            // Ensure array format
            const expenses = Array.isArray(parsed) ? parsed : [parsed];

            // Add duplicate flag and format
            const processedExpenses = expenses.map(exp => ({
                ...exp,
                date: exp.date || new Date().toISOString().split('T')[0],
                paymentMethod: 'Cash',
                notes: exp.vendor || 'Added via voice',
                month: new Date(exp.date || Date.now()).toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
                isDuplicate: isDuplicate(exp)
            }));

            setParsedExpenses(processedExpenses);

        } catch (err) {
            console.error('Gemini processing error:', err);
            setError(err.message || 'Failed to process speech');
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
            <div className="scanner-modal voice-scanner-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><Mic size={20} /> Voice Input (Marathi)</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="scanner-content">
                    {!parsedExpenses ? (
                        <>
                            {/* Recording Area */}
                            <div className="voice-recording-area">
                                {!isRecording && !transcript ? (
                                    <div className="voice-prompt">
                                        <Mic size={48} className="mic-icon" />
                                        <p>Speak in Marathi about your expense</p>
                                        <p className="voice-hint">Example: "आज चाय ला दहा रुपये दिले"</p>
                                        <button className="btn-record" onClick={startRecording}>
                                            <Mic size={20} />
                                            Start Recording
                                        </button>
                                    </div>
                                ) : isRecording ? (
                                    <div className="voice-recording">
                                        <div className="mic-animation">
                                            <Volume2 size={64} className="pulse" />
                                        </div>
                                        <p className="recording-status">🔴 Recording...</p>
                                        {transcript && (
                                            <div className="transcript-preview">
                                                <p>{transcript}</p>
                                            </div>
                                        )}
                                        {interimTranscript && (
                                            <div className="interim-transcript">
                                                <p className="interim-text">{interimTranscript}</p>
                                            </div>
                                        )}
                                        <button className="btn-stop-recording" onClick={stopRecording}>
                                            <MicOff size={20} />
                                            Stop Recording
                                        </button>
                                    </div>
                                ) : (
                                    <div className="voice-transcript">
                                        <h3>Your Recording:</h3>
                                        <div className="transcript-display">
                                            <p>{transcript}</p>
                                        </div>
                                        <div className="transcript-actions">
                                            <button className="btn-retake" onClick={startRecording}>
                                                ↻ Record Again
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="error-msg">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            {/* Process Button */}
                            {transcript && !isRecording && (
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
                                            Extract Expense
                                        </>
                                    )}
                                </button>
                            )}

                            {/* API Key Warning */}
                            {!geminiApiKey && (
                                <div className="api-warning">
                                    <AlertCircle size={16} />
                                    Add your Gemini API key in Settings to use voice input
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
                                    setTranscript('');
                                }}
                            >
                                ← Record Another
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VoiceScanner;
