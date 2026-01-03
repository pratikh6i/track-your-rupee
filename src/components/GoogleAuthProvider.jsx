import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { GoogleOAuthProvider, useGoogleLogin, googleLogout } from '@react-oauth/google';
import useStore from '../store/useStore';

// Google Cloud Console Client ID
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// App-specific sheet name prefix for auto-detection
const APP_SHEET_PREFIX = 'Track your Rupee';

const GoogleAuthContext = createContext(null);

export const useGoogleAuth = () => {
    const context = useContext(GoogleAuthContext);
    if (!context) {
        throw new Error('useGoogleAuth must be used within GoogleAuthProvider');
    }
    return context;
};

const GoogleAuthProviderInner = ({ children }) => {
    const {
        user,
        isAuthenticated,
        setUser,
        logout: storeLogout,
        setSheetId,
        setCurrentView,
        setLoading,
        setSheetData
    } = useStore();
    const [isLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState(null);

    // Find existing sheets in user's Drive
    const findExistingSheets = useCallback(async (accessToken) => {
        try {
            // Search for sheets with our app prefix in the name
            const query = encodeURIComponent(`name contains '${APP_SHEET_PREFIX}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                console.warn('Could not search Drive for existing sheets');
                return [];
            }

            const data = await response.json();
            return data.files || [];
        } catch (error) {
            console.error('Error searching for sheets:', error);
            return [];
        }
    }, []);

    // Create a new sheet
    const createNewSheet = useCallback(async (accessToken) => {
        try {
            const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    properties: {
                        title: `${APP_SHEET_PREFIX} - ${new Date().toLocaleDateString('en-IN')}`
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create new sheet');
            }

            const data = await response.json();
            const newSheetId = data.spreadsheetId;

            // Initialize with headers
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${newSheetId}/values/A1:G1?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        values: [['Date', 'Item', 'Category', 'Amount', 'Payment Method', 'Notes', 'Month']]
                    })
                }
            );

            return newSheetId;
        } catch (error) {
            console.error('Error creating sheet:', error);
            throw error;
        }
    }, []);

    // Load sheet data
    const loadSheetData = useCallback(async (accessToken, sheetId) => {
        try {
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A2:G1000`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load sheet data');
            }

            const data = await response.json();
            const values = data.values || [];

            const rows = values.map(row => ({
                date: row[0] || '',
                item: row[1] || '',
                category: row[2] || '',
                amount: parseFloat(row[3]) || 0,
                paymentMethod: row[4] || '',
                notes: row[5] || '',
                month: row[6] || ''
            }));

            setSheetData(rows);
            return rows;
        } catch (error) {
            console.error('Error loading sheet data:', error);
            return [];
        }
    }, [setSheetData]);

    // Main login handler
    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setAuthLoading(true);
            setAuthError(null);
            setLoading(true);

            try {
                // Get user info
                const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: {
                        Authorization: `Bearer ${tokenResponse.access_token}`,
                    },
                });

                if (!userInfoResponse.ok) {
                    throw new Error('Failed to get user info');
                }

                const userInfo = await userInfoResponse.json();

                // Save user to store
                setUser({
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    sub: userInfo.sub,
                }, tokenResponse.access_token);

                // Check for existing sheets
                const existingSheets = await findExistingSheets(tokenResponse.access_token);

                if (existingSheets.length > 0) {
                    // Use the most recently modified sheet
                    const latestSheet = existingSheets[0];
                    console.log('Found existing sheet:', latestSheet.name);

                    setSheetId(latestSheet.id);
                    await loadSheetData(tokenResponse.access_token, latestSheet.id);
                    setCurrentView('dashboard');
                } else {
                    // First time user - create a new sheet
                    console.log('No existing sheet found, creating new one');
                    const newSheetId = await createNewSheet(tokenResponse.access_token);

                    setSheetId(newSheetId);
                    setSheetData([]);
                    setCurrentView('dashboard');
                }

            } catch (error) {
                console.error('Login error:', error);
                setAuthError(error.message);
                throw error;
            } finally {
                setAuthLoading(false);
                setLoading(false);
            }
        },
        onError: (error) => {
            console.error('Google login error:', error);
            setAuthLoading(false);
            setAuthError('Failed to sign in with Google. Please try again.');
        },
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly',
    });

    const logout = useCallback(() => {
        googleLogout();
        storeLogout();
    }, [storeLogout]);

    // Check if user needs to re-authenticate on mount
    useEffect(() => {
        // If we have a stored user but no access token, they need to re-login
        if (user && !useStore.getState().accessToken) {
            storeLogout();
        }
    }, [user, storeLogout]);

    const value = {
        user,
        isAuthenticated,
        isLoading: isLoading,
        authError,
        login,
        logout,
        findExistingSheets,
        createNewSheet,
        loadSheetData,
    };

    return (
        <GoogleAuthContext.Provider value={value}>
            {children}
        </GoogleAuthContext.Provider>
    );
};

export const GoogleAuthProvider = ({ children }) => {
    if (!GOOGLE_CLIENT_ID) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                padding: '2rem',
                textAlign: 'center'
            }}>
                <div>
                    <h2>Configuration Required</h2>
                    <p>Please set VITE_GOOGLE_CLIENT_ID in your .env file</p>
                </div>
            </div>
        );
    }

    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <GoogleAuthProviderInner>{children}</GoogleAuthProviderInner>
        </GoogleOAuthProvider>
    );
};

export default GoogleAuthProvider;
