import { useState, useEffect } from 'react';
import { X, Save, Loader2, Wallet } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import './SettingsModal.css';

const SettingsModal = ({ onClose }) => {
    const { accessToken } = useGoogleAuth();
    const { sheetId, budget, setBudget } = useStore();
    const [localBudget, setLocalBudget] = useState(budget || 11000);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);

    useEffect(() => {
        setLocalBudget(budget || 11000);
    }, [budget]);

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

            setBudget(localBudget);
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
