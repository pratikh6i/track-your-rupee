import { useState } from 'react';
import { Wallet, Sparkles, Shield, Loader2 } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import './Onboarding.css';

const Onboarding = () => {
    const { login, isLoading: authLoading, authError } = useGoogleAuth();
    const { isLoading } = useStore();
    const [localError, setLocalError] = useState(null);

    const handleGoogleLogin = async () => {
        try {
            setLocalError(null);
            await login();
        } catch (error) {
            setLocalError('Failed to sign in. Please try again.');
        }
    };

    const isProcessing = authLoading || isLoading;
    const displayError = authError || localError;

    return (
        <div className="onboarding">
            {/* Background decoration */}
            <div className="onboarding-bg">
                <div className="orb orb-1"></div>
                <div className="orb orb-2"></div>
                <div className="orb orb-3"></div>
            </div>

            <div className="onboarding-container">
                {/* Logo */}
                <div className="logo animate-slideDown">
                    <div className="logo-icon">
                        <Wallet size={32} />
                    </div>
                    <span className="logo-text">Track your Rupee</span>
                </div>

                {/* Main Card */}
                <div className="onboarding-card glass-card-static animate-scaleIn">
                    <div className="card-icon">
                        <Sparkles size={48} className="text-blue" />
                    </div>

                    <h1 className="card-title">Smart Expense Tracking</h1>
                    <p className="card-subtitle">
                        Sign in with Google to start tracking your expenses. Your data stays in YOUR Google Sheet — 100% private and secure.
                    </p>

                    {displayError && (
                        <div className="status-message status-error">
                            {displayError}
                        </div>
                    )}

                    <button
                        className="btn-google"
                        onClick={handleGoogleLogin}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>{authLoading ? 'Signing in...' : 'Setting up your sheet...'}</span>
                            </>
                        ) : (
                            <>
                                <svg viewBox="0 0 24 24" width="20" height="20">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                <span>Sign in with Google</span>
                            </>
                        )}
                    </button>

                    <div className="features-list">
                        <div className="feature-item">
                            <Shield size={18} className="text-green" />
                            <span>100% Client-Side — No servers, no databases</span>
                        </div>
                        <div className="feature-item">
                            <Sparkles size={18} className="text-blue" />
                            <span>AI-Powered — Paste receipts from Gemini/ChatGPT</span>
                        </div>
                    </div>

                    <p className="privacy-note">
                        🔒 Your data is stored only in YOUR Google Drive.
                        <br />
                        We never see or store your financial information.
                    </p>
                </div>

                {/* Footer */}
                <p className="onboarding-footer animate-fadeIn stagger-3">
                    Every rupee counts. Track them all.
                </p>
            </div>
        </div>
    );
};

export default Onboarding;
