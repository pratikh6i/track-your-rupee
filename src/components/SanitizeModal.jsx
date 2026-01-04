import React, { useState } from 'react';
import { Trash2, AlertTriangle, Loader2, X, Download } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import './SanitizeModal.css';

const SanitizeModal = ({ onClose }) => {
    const { user, deleteAppResources } = useGoogleAuth();
    const { sheetId } = useStore();
    const [step, setStep] = useState(1);
    const [emailInput, setEmailInput] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState(null);

    const handleConfirm = async () => {
        if (emailInput !== user.email) {
            setError('Email does not match');
            return;
        }

        setIsDeleting(true);
        setError(null);
        try {
            await deleteAppResources();
            // App will reload/logout automatically after deletion
        } catch (err) {
            console.error(err);
            setError('Failed to delete resources: ' + err.message);
            setIsDeleting(false);
        }
    };

    const handleDownload = () => {
        if (sheetId) {
            window.open(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`, '_blank');
        }
    };

    return (
        <div className="sanitize-modal-overlay">
            <div className="sanitize-modal">
                <button className="close-btn" onClick={onClose} disabled={isDeleting}>
                    <X size={24} />
                </button>

                <div className="sanitize-header">
                    <div className="icon-wrapper">
                        <Trash2 size={32} />
                    </div>
                    <h2>Sanitize Account</h2>
                </div>

                {step === 1 && (
                    <div className="step-content">
                        <div className="alert-box">
                            <AlertTriangle size={20} />
                            <p>This will permanently delete ALL data created by Track Your Rupee.</p>
                        </div>
                        <p className="warning-text">
                            This includes your Expense Sheet, Settings, and all uploaded Bill Images in functionality.
                            <br /><strong>This action cannot be undone.</strong>
                        </p>

                        <div className="action-buttons">
                            <button className="btn-download" onClick={handleDownload}>
                                <Download size={18} /> Download Backup
                            </button>
                            <button className="btn-next" onClick={() => setStep(2)}>
                                I understand, proceed
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="step-content">
                        <p>To confirm deletion, please type your email address:</p>
                        <code className="email-display">{user?.email}</code>

                        <input
                            type="email"
                            placeholder="Enter your email"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            className="email-input"
                            disabled={isDeleting}
                        />

                        {error && <p className="error-msg">{error}</p>}

                        <button
                            className="btn-delete"
                            onClick={handleConfirm}
                            disabled={!emailInput || isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 size={18} className="spinner" /> Deleting Everything...
                                </>
                            ) : (
                                'Permanently Delete Everything'
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SanitizeModal;
