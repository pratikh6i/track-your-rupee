import { useState, useEffect } from 'react';
import { X, Save, Loader2, User, DollarSign, TrendingUp, Wallet, Target, Bell, Zap, Eye, EyeOff } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import './ProfileModal.css';

const ProfileModal = ({ onClose }) => {
    const { accessToken } = useGoogleAuth();
    const {
        sheetId,
        monthlySalary, otherGains, currentBalance,
        setMonthlySalary, setOtherGains, setCurrentBalance,
        budget, setBudget,
        webhookUrl, setWebhookUrl,
        geminiApiKey, setGeminiApiKey
    } = useStore();

    // Profile fields
    const [localSalary, setLocalSalary] = useState(monthlySalary || 0);
    const [localGains, setLocalGains] = useState(otherGains || 0);
    const [localBalance, setLocalBalance] = useState(currentBalance || 0);

    // Settings fields
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
        setLocalSalary(monthlySalary || 0);
        setLocalGains(otherGains || 0);
        setLocalBalance(currentBalance || 0);
        setLocalBudget(budget || 11000);
        setLocalWebhook(webhookUrl || '');
        setLocalGeminiKey(geminiApiKey || '');
    }, [monthlySalary, otherGains, currentBalance, budget, webhookUrl, geminiApiKey]);

    const testWebhook = async () => {
        if (!localWebhook) return;
        setIsTestingWebhook(true);
        setTestStatus(null);

        try {
            // Use no-cors mode for Google Chat webhooks (they don't return CORS headers)
            await fetch(localWebhook, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `✅ *Test Alert Success!* \nYour Track your Rupee webhook is configured correctly.`
                })
            });
            // With no-cors, we can't read the response, so assume success
            setTestStatus({ type: 'success', msg: '✓ Test message sent! Check your Google Chat.' });
        } catch (error) {
            setTestStatus({ type: 'error', msg: '✗ Failed to send. Check URL.' });
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
            const metaResponse = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            const metaData = await metaResponse.json();
            const sheets = metaData.sheets || [];
            const profileSheetExists = sheets.some(s => s.properties.title === 'Profile');
            const settingsSheetExists = sheets.some(s => s.properties.title === 'Settings');

            // Create sheets if needed
            const sheetsToCreate = [];
            if (!profileSheetExists) sheetsToCreate.push({ addSheet: { properties: { title: 'Profile' } } });
            if (!settingsSheetExists) sheetsToCreate.push({ addSheet: { properties: { title: 'Settings' } } });

            if (sheetsToCreate.length > 0) {
                await fetch(
                    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
                    {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ requests: sheetsToCreate })
                    }
                );
            }

            // Save Profile data
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Profile!A1:B4?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        values: [
                            ['Key', 'Value'],
                            ['monthlySalary', localSalary],
                            ['otherGains', localGains],
                            ['currentBalance', localBalance]
                        ]
                    })
                }
            );

            // Save Settings data
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Settings!A1:B4?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        values: [
                            ['Key', 'Value'],
                            ['monthlyBudget', localBudget],
                            ['webhookUrl', localWebhook],
                            ['geminiApiKey', localGeminiKey]
                        ]
                    })
                }
            );

            // Update store
            setMonthlySalary(localSalary);
            setOtherGains(localGains);
            setCurrentBalance(localBalance);
            setBudget(localBudget);
            setWebhookUrl(localWebhook);
            setGeminiApiKey(localGeminiKey);

            setSaveStatus('success');
            setTimeout(() => onClose(), 1000);
        } catch (error) {
            console.error('Error saving:', error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(value);
    };

    const totalIncome = localSalary + localGains;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="profile-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><User size={20} /> Profile & Settings</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="profile-content">
                    {/* Income Section */}
                    <div className="section-title">💰 Income Details</div>

                    <div className="profile-group">
                        <label><DollarSign size={16} /> Monthly Salary</label>
                        <div className="currency-input">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                value={localSalary}
                                onChange={(e) => setLocalSalary(parseInt(e.target.value) || 0)}
                                min={0}
                                step={1000}
                            />
                        </div>
                    </div>

                    <div className="profile-group">
                        <label><TrendingUp size={16} /> Other Gains</label>
                        <div className="currency-input">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                value={localGains}
                                onChange={(e) => setLocalGains(parseInt(e.target.value) || 0)}
                                min={0}
                                step={500}
                            />
                        </div>
                    </div>

                    <div className="profile-group">
                        <label><Wallet size={16} /> Current Balance</label>
                        <div className="currency-input">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                value={localBalance}
                                onChange={(e) => setLocalBalance(parseInt(e.target.value) || 0)}
                                step={1000}
                            />
                        </div>
                    </div>

                    <div className="profile-summary">
                        <span>Total Monthly Income</span>
                        <span className="summary-value">{formatCurrency(totalIncome)}</span>
                    </div>

                    {/* Budget Section */}
                    <div className="section-title">🎯 Budget Settings</div>

                    <div className="profile-group">
                        <label><Target size={16} /> Monthly Budget Limit</label>
                        <div className="currency-input">
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

                    {/* Webhook Section */}
                    <div className="section-title">🔔 Alerts</div>

                    <div className="profile-group">
                        <label><Bell size={16} /> Google Chat Webhook</label>
                        <p className="field-hint">Get alerts at 50%, 75%, 90%, 100% of budget</p>
                        <div className="webhook-input">
                            <input
                                type={showWebhook ? "text" : "password"}
                                value={localWebhook}
                                onChange={(e) => setLocalWebhook(e.target.value)}
                                placeholder="https://chat.googleapis.com/v1/spaces/..."
                            />
                            <button className="btn-toggle" onClick={() => setShowWebhook(!showWebhook)}>
                                {showWebhook ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <button
                            className="btn-test"
                            onClick={testWebhook}
                            disabled={!localWebhook || isTestingWebhook}
                        >
                            {isTestingWebhook ? 'Sending...' : 'Test Webhook'}
                        </button>
                        {testStatus && <p className={`test-status ${testStatus.type}`}>{testStatus.msg}</p>}
                    </div>

                    {/* Gemini Section */}
                    <div className="section-title">🤖 AI Settings</div>

                    <div className="profile-group">
                        <label><Zap size={16} /> Gemini API Key</label>
                        <p className="field-hint">
                            Required for bill scanning. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Get free key</a>
                        </p>
                        <div className="webhook-input">
                            <input
                                type={showGeminiKey ? "text" : "password"}
                                value={localGeminiKey}
                                onChange={(e) => setLocalGeminiKey(e.target.value)}
                                placeholder="AIza..."
                            />
                            <button className="btn-toggle" onClick={() => setShowGeminiKey(!showGeminiKey)}>
                                {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Save Button */}
                    {saveStatus === 'success' && (
                        <div className="status-msg success">✓ Saved successfully!</div>
                    )}
                    {saveStatus === 'error' && (
                        <div className="status-msg error">Failed to save. Try again.</div>
                    )}

                    <button className="btn-save" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <><Loader2 size={18} className="spin" /> Saving...</>
                        ) : (
                            <><Save size={18} /> Save All</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
