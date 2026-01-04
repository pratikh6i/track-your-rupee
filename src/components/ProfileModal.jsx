import { useState, useEffect } from 'react';
import { X, Save, Loader2, User, DollarSign, TrendingUp, Wallet } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import './ProfileModal.css';

const ProfileModal = ({ onClose }) => {
    const { accessToken } = useGoogleAuth();
    const {
        sheetId,
        monthlySalary, otherGains, currentBalance,
        setMonthlySalary, setOtherGains, setCurrentBalance
    } = useStore();

    const [localSalary, setLocalSalary] = useState(monthlySalary || 0);
    const [localGains, setLocalGains] = useState(otherGains || 0);
    const [localBalance, setLocalBalance] = useState(currentBalance || 0);

    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);

    useEffect(() => {
        setLocalSalary(monthlySalary || 0);
        setLocalGains(otherGains || 0);
        setLocalBalance(currentBalance || 0);
    }, [monthlySalary, otherGains, currentBalance]);

    const handleSave = async () => {
        if (!accessToken || !sheetId) {
            setSaveStatus('error');
            return;
        }

        setIsSaving(true);
        setSaveStatus(null);

        try {
            // Check if Profile sheet exists, create if not
            const metaResponse = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            const metaData = await metaResponse.json();
            const sheets = metaData.sheets || [];
            const profileSheetExists = sheets.some(s => s.properties.title === 'Profile');

            if (!profileSheetExists) {
                // Create Profile sheet
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
                                    properties: { title: 'Profile' }
                                }
                            }]
                        })
                    }
                );

                // Initialize headers
                await fetch(
                    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Profile!A1:B1?valueInputOption=RAW`,
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

            // Save profile data (rows 2-4)
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Profile!A2:B4?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        values: [
                            ['monthlySalary', localSalary],
                            ['otherGains', localGains],
                            ['currentBalance', localBalance]
                        ]
                    })
                }
            );

            setMonthlySalary(localSalary);
            setOtherGains(localGains);
            setCurrentBalance(localBalance);

            setSaveStatus('success');
            setTimeout(() => onClose(), 1000);
        } catch (error) {
            console.error('Error saving profile:', error);
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
                    <h2><User size={20} /> Edit Profile</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="profile-content">
                    <p className="profile-intro">
                        Enter your income details to get accurate balance calculations.
                    </p>

                    <div className="profile-group">
                        <label>
                            <DollarSign size={18} />
                            Monthly Salary
                        </label>
                        <div className="currency-input">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                value={localSalary}
                                onChange={(e) => setLocalSalary(parseInt(e.target.value) || 0)}
                                min={0}
                                step={1000}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div className="profile-group">
                        <label>
                            <TrendingUp size={18} />
                            Other Gains (Freelance, Interest, etc.)
                        </label>
                        <div className="currency-input">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                value={localGains}
                                onChange={(e) => setLocalGains(parseInt(e.target.value) || 0)}
                                min={0}
                                step={500}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div className="profile-group">
                        <label>
                            <Wallet size={18} />
                            Current Bank Balance
                        </label>
                        <div className="currency-input">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                value={localBalance}
                                onChange={(e) => setLocalBalance(parseInt(e.target.value) || 0)}
                                step={1000}
                                placeholder="0"
                            />
                        </div>
                        <p className="field-hint">Your current total balance across all accounts</p>
                    </div>

                    <div className="profile-summary">
                        <div className="summary-row">
                            <span>Total Monthly Income</span>
                            <span className="summary-value">{formatCurrency(totalIncome)}</span>
                        </div>
                    </div>

                    {saveStatus === 'success' && (
                        <div className="status-msg success">✓ Profile saved!</div>
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
                                Save Profile
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
