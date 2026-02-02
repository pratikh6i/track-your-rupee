import { useState, useEffect } from 'react';
import { X, Save, Loader2, User, DollarSign, TrendingUp, Wallet, Target, Bell, Zap, Eye, EyeOff } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import SanitizeModal from './SanitizeModal';
import './ProfileModal.css';

const ProfileModal = ({ onClose }) => {
    const { accessToken } = useGoogleAuth();
    const {
        sheetId,
        monthlySalary, otherGains, currentBalance, invested,
        setMonthlySalary, setOtherGains, setCurrentBalance, setInvested,
        budget, setBudget,
        webhookUrl, setWebhookUrl,
        geminiApiKey, setGeminiApiKey
    } = useStore();

    // Profile fields
    const [localSalary, setLocalSalary] = useState(monthlySalary || 0);
    const [localGains, setLocalGains] = useState(otherGains || 0);
    const [localBalance, setLocalBalance] = useState(currentBalance || 0);
    const [localInvested, setLocalInvested] = useState(invested || 0);

    // Settings fields
    const [localBudget, setLocalBudget] = useState(budget || 11000);
    const [localWebhook, setLocalWebhook] = useState(webhookUrl || '');
    const [localGeminiKey, setLocalGeminiKey] = useState(geminiApiKey || '');
    const [showWebhook, setShowWebhook] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);

    // Report fields
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportStatus, setReportStatus] = useState(null);

    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);
    const [isTestingWebhook, setIsTestingWebhook] = useState(false);
    const [testStatus, setTestStatus] = useState(null);
    const [isSanitizeOpen, setIsSanitizeOpen] = useState(false);

    useEffect(() => {
        setLocalSalary(monthlySalary || 0);
        setLocalGains(otherGains || 0);
        setLocalBalance(currentBalance || 0);
        setLocalInvested(invested || 0);
        setLocalBudget(budget || 11000);
        setLocalWebhook(webhookUrl || '');
        setLocalGeminiKey(geminiApiKey || '');
    }, [monthlySalary, otherGains, currentBalance, invested, budget, webhookUrl, geminiApiKey]);

    const testWebhook = async () => {
        if (!localWebhook) return;
        setIsTestingWebhook(true);
        setTestStatus(null);

        // List of CORS proxies to try (in order)
        const corsProxies = [
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?',
            'https://cors-anywhere.herokuapp.com/'
        ];

        const testMessage = {
            text: `✅ *Test Alert from Track your Rupee*\nYour webhook is configured correctly!\nTime: ${new Date().toLocaleString('en-IN')}`
        };

        let success = false;
        let lastError = null;

        for (const proxy of corsProxies) {
            try {
                const targetUrl = proxy.includes('allorigins')
                    ? proxy + encodeURIComponent(localWebhook)
                    : proxy + localWebhook;

                const response = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(testMessage)
                });

                if (response.ok) {
                    success = true;
                    setTestStatus({ type: 'success', msg: '✓ Test message sent! Check your Google Chat.' });
                    break;
                }
            } catch (error) {
                lastError = error;
                console.log('Proxy failed:', proxy, error.message);
            }
        }

        if (!success) {
            console.error('All webhook proxies failed:', lastError);
            setTestStatus({
                type: 'error',
                msg: '✗ Could not send test. The webhook will work via Apps Script scheduler.'
            });
        }

        setIsTestingWebhook(false);
    };

    const sendToWebhook = async (message) => {
        // Use multiple reliable proxies
        const corsProxies = [
            'https://api.allorigins.win/raw?url=',
            'https://thingproxy.freeboard.io/fetch/',
            'https://corsproxy.io/?'
        ];

        let lastErr = null;
        for (const proxy of corsProxies) {
            try {
                const targetUrl = proxy.includes('allorigins')
                    ? proxy + encodeURIComponent(localWebhook)
                    : proxy + localWebhook;

                console.log('Sending report via:', proxy);
                const response = await fetch(targetUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text: message })
                });

                if (response.ok) {
                    console.log('✓ Report sent via', proxy);
                    return true;
                }
            } catch (e) {
                lastErr = e;
                console.warn('Proxy failed:', proxy, e.message);
            }
        }

        console.error('All proxies failed for report', lastErr);
        return false;
    };

    const getGeminiInsight = async (prompt) => {
        if (!localGeminiKey) return null;
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${localGeminiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
                    })
                }
            );
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (e) {
            console.error('Gemini error:', e);
            return null;
        }
    };

    const handleReport = async (type) => {
        if (!localWebhook) {
            setReportStatus({ type: 'error', msg: 'Please configure webhook first' });
            return;
        }

        setIsGeneratingReport(true);
        setReportStatus(null);

        const { sheetData } = useStore.getState();
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        try {
            let message = '';
            let statsData = [];

            if (type === 'today') {
                const todayExpenses = sheetData.filter(d => d.date === todayStr && d.category !== 'Income');
                const todayIncome = sheetData.filter(d => d.date === todayStr && d.category === 'Income');
                const totalSpent = todayExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

                message = `📊 *Today's Analysis (Real-time)*\n📅 ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}\n\n`;

                if (todayExpenses.length === 0) {
                    message += `✨ No expenses recorded yet today! Feeling rich? 🍵\n`;
                } else {
                    message += `💸 *Expenses*\n` + todayExpenses.map(e => `• ${e.item}: ₹${e.amount}`).join('\n') + `\n\n`;
                    message += `*Total Spent:* ₹${totalSpent}\n\n`;
                }

                if (localGeminiKey) {
                    const aiPrompt = `Give a short, funny financial roast or insight for these expenses today: ${JSON.stringify(todayExpenses)}. Current budget: ₹${localBudget}. Max 30 words. No markdown.`;
                    const insight = await getGeminiInsight(aiPrompt);
                    if (insight) message += `💭 *AI Note:* ${insight}`;
                }
            } else {
                const year = now.getFullYear();
                const monthName = monthNames[selectedMonth];
                const filtered = sheetData.filter(d => {
                    const dDate = new Date(d.date);
                    return dDate.getMonth() === selectedMonth && dDate.getFullYear() === year;
                });

                const spent = filtered.filter(d => d.category !== 'Income').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                const income = filtered.filter(d => d.category === 'Income').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                const cats = filtered.filter(d => d.category !== 'Income').reduce((acc, e) => {
                    acc[e.category] = (acc[e.category] || 0) + (parseFloat(e.amount) || 0);
                    return acc;
                }, {});

                message = `🏆 *Monthly Wrap-up: ${monthName} ${year}*\n\n`;
                message += `💰 *Income:* ₹${income}\n`;
                message += `💸 *Expenses:* ₹${spent}\n`;
                message += `🎯 *Budget:* ₹${localBudget}\n`;
                message += `📊 *Usage:* ${Math.round((spent / localBudget) * 100)}%\n\n`;

                message += `*Top Categories:*\n`;
                Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([c, a]) => {
                    message += `• ${c}: ₹${a}\n`;
                });

                if (localGeminiKey) {
                    const aiPrompt = `Analyze my spending for ${monthName}: Total Spent ₹${spent}, Categories: ${JSON.stringify(cats)}. Budget was ₹${localBudget}. 
                    Highlight my behavior patterns (e.g. "Impulse buyer", "Savings ninja", etc.) and give one actionable tip. Max 60 words. No markdown.`;
                    const analysis = await getGeminiInsight(aiPrompt);
                    if (analysis) message += `\n🧐 *Financial Behavior Analysis:*\n${analysis}`;
                }
            }

            const ok = await sendToWebhook(message);
            if (ok) {
                setReportStatus({ type: 'success', msg: `✓ ${type === 'today' ? "Today's" : 'Monthly'} report sent!` });
            } else {
                throw new Error('Proxy failed');
            }
        } catch (e) {
            setReportStatus({ type: 'error', msg: 'Failed to send report. Check connection.' });
        } finally {
            setIsGeneratingReport(false);
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

                    {/* Reports Section */}
                    <div className="section-title">📊 Reports & Analysis</div>
                    <div className="report-group">
                        <p className="field-hint">Send manual reports to your Google Chat webhook anytime.</p>

                        <div className="report-actions">
                            <button
                                className="btn-report-today"
                                onClick={() => handleReport('today')}
                                disabled={isGeneratingReport || !localWebhook}
                            >
                                {isGeneratingReport ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
                                Today's Insights
                            </button>

                            <div className="monthly-report-box">
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                    className="month-select"
                                >
                                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => (
                                        <option key={m} value={i}>{m} {new Date().getFullYear()}</option>
                                    ))}
                                </select>
                                <button
                                    className="btn-report-month"
                                    onClick={() => handleReport('month')}
                                    disabled={isGeneratingReport || !localWebhook}
                                >
                                    Send Wrap-up
                                </button>
                            </div>
                        </div>
                        {reportStatus && <p className={`test-status ${reportStatus.type}`}>{reportStatus.msg}</p>}
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

                    {/* Danger Zone */}
                    <div className="danger-zone">
                        <h3>Danger Zone</h3>
                        <button className="btn-sanitize" onClick={() => setIsSanitizeOpen(true)}>
                            Sanitize (Delete Everything)
                        </button>
                    </div>
                </div>
            </div>

            {isSanitizeOpen && <SanitizeModal onClose={() => setIsSanitizeOpen(false)} />}
        </div>
    );
};

export default ProfileModal;
