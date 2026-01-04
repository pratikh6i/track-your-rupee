import { useState, useEffect } from 'react';
import { X, Save, Loader2, Wallet, Bell, Eye, EyeOff, Zap } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import './SettingsModal.css';

const SettingsModal = ({ onClose }) => {
    const { accessToken } = useGoogleAuth();
    const { sheetId, budget, setBudget, webhookUrl, setWebhookUrl, geminiApiKey, setGeminiApiKey } = useStore();

    const [localBudget, setLocalBudget] = useState(budget || 11000);
    const [localWebhook, setLocalWebhook] = useState(webhookUrl || '');
    const [localGeminiKey, setLocalGeminiKey] = useState(geminiApiKey || '');
    const [showWebhook, setShowWebhook] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);
    const [isTestingWebhook, setIsTestingWebhook] = useState(false);
    const [testStatus, setTestStatus] = useState(null);

    useEffect(() => {
        setLocalBudget(budget || 11000);
        setLocalWebhook(webhookUrl || '');
        setLocalGeminiKey(geminiApiKey || '');
    }, [budget, webhookUrl, geminiApiKey]);

    const testWebhook = async () => {
        if (!localWebhook) return;
        setIsTestingWebhook(true);
        setTestStatus(null);

        try {
            const response = await fetch(localWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `✅ *Test Alert Success!* \nYour Track your Rupee webhook is configured correctly.`
                })
            });

            if (response.ok) {
                setTestStatus({ type: 'success', msg: '✓ Test message sent successfully!' });
            } else {
                setTestStatus({ type: 'error', msg: '✗ Failed. Check URL.' });
            }
        } catch (error) {
            setTestStatus({ type: 'error', msg: '✗ Network error. Check URL.' });
        } finally {
            setIsTestingWebhook(false);
        }
    };

    const handleSave = async () => {
        if (!accessToken || !sheetId) {
            setSaveStatus('error');
            return;
        }

        setIsSaving(true);
        setSaveStatus(null);

        try {
            // Check if Settings sheet exists, create if not
            const metaResponse = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            const metaData = await metaResponse.json();
            const sheets = metaData.sheets || [];
            const settingsSheetExists = sheets.some(s => s.properties.title === 'Settings');

            if (!settingsSheetExists) {
                // Create Settings sheet
                await fetch(
                    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            requests: [{
                                addSheet: {
                                    properties: { title: 'Settings' }
                                }
                            }]
                        })
                    }
                );

                // Initialize headers
                await fetch(
                    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Settings!A1:B1?valueInputOption=RAW`,
                    {
                        method: 'PUT',
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            values: [['Key', 'Value']]
                        })
                    }
                );
            }

            // Save budget to row 2
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Settings!A2:B2?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        values: [['monthlyBudget', localBudget]]
                    })
                }
            );

            // Save webhook to row 3 (SECURE STORAGE)
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Settings!A3:B3?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        values: [['webhookUrl', localWebhook]]
                    })
                }
            );

            // Save Gemini API Key to row 4 (SECURE STORAGE)
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Settings!A4:B4?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        values: [['geminiApiKey', localGeminiKey]]
                    })
                }
            );

            setBudget(localBudget);
            setWebhookUrl(localWebhook);
            setGeminiApiKey(localGeminiKey);
            setSaveStatus('success');
            setTimeout(() => onClose(), 1000);
        } catch (error) {
            console.error('Error saving settings:', error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Settings</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="settings-content">
                    <div className="setting-group">
                        <label>
                            <Wallet size={18} />
                            Monthly Budget
                        </label>
                        <p className="setting-desc">Set your monthly spending limit. Default is ₹11,000.</p>
                        <div className="budget-input-group">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                value={localBudget}
                                onChange={(e) => setLocalBudget(parseInt(e.target.value) || 0)}
                                min={0}
                                step={1000}
                            />
                        </div>
                    </div>

                    <div className="setting-group">
                        <label>
                            <Bell size={18} />
                            Webhook Alerts (Google Chat)
                        </label>
                        <p className="setting-desc">Get alerts at 50%, 75%, 90% and 100% of budget.</p>
                        <div className="webhook-input-group">
                            <input
                                type={showWebhook ? "text" : "password"}
                                value={localWebhook}
                                onChange={(e) => setLocalWebhook(e.target.value)}
                                placeholder="Paste Google Chat Webhook URL..."
                            />
                            <button className="btn-icon-sm" onClick={() => setShowWebhook(!showWebhook)} title={showWebhook ? "Hide" : "Show"}>
                                {showWebhook ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <button
                            className="btn-test-alert"
                            onClick={testWebhook}
                            disabled={!localWebhook || isTestingWebhook}
                        >
                            {isTestingWebhook ? 'Sending...' : 'Test Alert'}
                        </button>
                        {testStatus && <p className={`test-status ${testStatus.type}`}>{testStatus.msg}</p>}
                    </div>

                    <div className="setting-group">
                        <label>
                            <Zap size={18} />
                            Gemini API Key (Bill Scanner)
                        </label>
                        <p className="setting-desc">
                            Required for AI bill scanning. Get free key from{' '}
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                                Google AI Studio
                            </a>
                        </p>
                        <div className="webhook-input-group">
                            <input
                                type={showGeminiKey ? "text" : "password"}
                                value={localGeminiKey}
                                onChange={(e) => setLocalGeminiKey(e.target.value)}
                                placeholder="AIza..."
                            />
                            <button className="btn-icon-sm" onClick={() => setShowGeminiKey(!showGeminiKey)} title={showGeminiKey ? "Hide" : "Show"}>
                                {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <p className="setting-hint">
                            🔒 Stored securely in your private Google Sheet
                        </p>
                    </div>

                    {saveStatus === 'success' && (
                        <div className="status-msg success">✓ Settings saved!</div>
                    )}
                    {saveStatus === 'error' && (
                        <div className="status-msg error">Failed to save. Please try again.</div>
                    )}

                    <button className="btn-save" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 size={18} className="spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Save Settings
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
