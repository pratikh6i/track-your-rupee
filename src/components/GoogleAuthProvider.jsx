import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { GoogleOAuthProvider, useGoogleLogin, googleLogout } from '@react-oauth/google';
import useStore from '../store/useStore';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const APP_SHEET_PREFIX = 'Track your Rupee';
const TOKEN_STORAGE_KEY = 'tyr_access_token';
const TOKEN_EXPIRY_KEY = 'tyr_token_expiry';
const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour session

// Generate unique sheet name using user email
const getUniqueSheetName = (email) => {
    const emailPrefix = email ? email.split('@')[0] : 'user';
    return `${APP_SHEET_PREFIX} - ${emailPrefix}`;
};

// Session storage helpers - using sessionStorage for better security
const saveSession = (token) => {
    const expiry = Date.now() + SESSION_DURATION_MS;
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
    console.log('✓ Session saved (sessionStorage), expires in 1 hour or when tab closes');
};

const getStoredSession = () => {
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);

    if (!token || !expiry) return null;

    if (Date.now() > parseInt(expiry)) {
        console.log('✗ Stored session expired');
        clearSession();
        return null;
    }

    console.log('✓ Found valid stored session');
    return token;
};

const clearSession = () => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
};

const GoogleAuthContext = createContext(null);

export const useGoogleAuth = () => {
    const context = useContext(GoogleAuthContext);
    if (!context) {
        throw new Error('useGoogleAuth must be used within GoogleAuthProvider');
    }
    return context;
};

const GoogleAuthProviderInner = ({ children }) => {
    const store = useStore();
    const {
        setUser,
        logout: storeLogout,
        setSheetId,
        setCurrentView,
        setLoading,
        setSheetData,
        setNeedsSheet
    } = store;

    const [isLoading, setAuthLoading] = useState(true); // Start true for session restore
    const [authError, setAuthError] = useState(null);
    const [accessToken, setAccessToken] = useState(null);

    // Verify if a specific sheet exists and is accessible
    const verifySheetAccess = useCallback(async (token, sheetIdToVerify) => {
        if (!sheetIdToVerify) return false;
        try {
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetIdToVerify}?fields=spreadsheetId,properties.title`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.ok) {
                const data = await response.json();
                console.log('✓ Verified existing sheet:', data.properties?.title, sheetIdToVerify);
                return true;
            }
            console.log('✗ Sheet not accessible:', sheetIdToVerify);
            return false;
        } catch (error) {
            console.error('Error verifying sheet:', error);
            return false;
        }
    }, []);

    // Find sheets owned by user - first try exact user-specific name, then fallback
    const findExistingSheets = useCallback(async (token, userEmail) => {
        try {
            // First try to find sheet with unique user-specific name
            const uniqueName = getUniqueSheetName(userEmail);
            console.log('Searching for sheet:', uniqueName);

            const exactQuery = encodeURIComponent(`mimeType='application/vnd.google-apps.spreadsheet' and name='${uniqueName}' and trashed=false`);
            let response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${exactQuery}&fields=files(id,name,modifiedTime,owners)&orderBy=modifiedTime desc`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.files && data.files.length > 0) {
                    console.log('✓ Found exact match sheet:', data.files[0].name);
                    return data.files;
                }
            }

            // Fallback: search for any sheet with our app prefix (for migration from old versions)
            console.log('No exact match, searching for any Track your Rupee sheets...');
            const fallbackQuery = encodeURIComponent(`mimeType='application/vnd.google-apps.spreadsheet' and name contains '${APP_SHEET_PREFIX}' and trashed=false`);
            response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${fallbackQuery}&fields=files(id,name,modifiedTime,owners)&orderBy=modifiedTime desc`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!response.ok) {
                console.error('Drive API error:', response.status);
                return [];
            }

            const data = await response.json();
            console.log('Found sheets (fallback):', data.files?.length || 0);
            return data.files || [];
        } catch (error) {
            console.error('Error searching for sheets:', error);
            return [];
        }
    }, []);

    // Create a new sheet with proper headers and unique user name
    const createNewSheet = useCallback(async (token, userEmail) => {
        try {
            const sheetName = getUniqueSheetName(userEmail);
            console.log('Creating new sheet:', sheetName);

            const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    properties: { title: sheetName }
                })
            });

            if (!response.ok) throw new Error('Failed to create sheet');
            const data = await response.json();
            const newSheetId = data.spreadsheetId;

            // Initialize with headers
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${newSheetId}/values/A1:H1?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        values: [['Date', 'Item', 'Category', 'Subcategory', 'Amount', 'Payment Method', 'Notes', 'Month']]
                    })
                }
            );

            console.log('✓ Created new sheet:', sheetName, newSheetId);
            return newSheetId;
        } catch (error) {
            console.error('Error creating sheet:', error);
            throw error;
        }
    }, []);

    // Load sheet data from a specific sheet
    const loadSheetData = useCallback(async (token, sheetIdToLoad) => {
        try {
            setLoading(true);
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetIdToLoad}/values/A2:H1000`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!response.ok) {
                console.error('Failed to load sheet data:', response.status);
                throw new Error('Failed to load sheet data');
            }

            const data = await response.json();
            const values = data.values || [];

            const rows = values.map((row, index) => ({
                id: index,
                date: row[0] || '',
                item: row[1] || '',
                category: row[2] || '',
                subcategory: row[3] || '',
                amount: parseFloat(row[4]) || 0,
                paymentMethod: row[5] || 'UPI',
                notes: row[6] || '',
                month: row[7] || ''
            }));

            console.log('Loaded', rows.length, 'rows from sheet');
            setSheetData(rows);
            return rows;
        } catch (error) {
            console.error('Error loading sheet data:', error);
            setSheetData([]);
            return [];
        } finally {
            setLoading(false);
        }
    }, [setSheetData, setLoading]);

    // Refresh data from current sheet AND settings
    const refreshData = useCallback(async () => {
        const currentSheetId = useStore.getState().sheetId;
        if (!accessToken || !currentSheetId) {
            console.error('Cannot refresh: no token or sheetId');
            return;
        }

        // Refresh transaction data
        await loadSheetData(accessToken, currentSheetId);

        // Also refresh settings from Sheet (Budget, Webhook, Gemini Key)
        try {
            const settingsRes = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${currentSheetId}/values/Settings!A2:B4`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (settingsRes.ok) {
                const settingsData = await settingsRes.json();
                const rows = settingsData.values || [];
                if (rows[0] && rows[0][1]) useStore.getState().setBudget(parseInt(rows[0][1]) || 11000);
                if (rows[1] && rows[1][1]) useStore.getState().setWebhookUrl(rows[1][1]);
                if (rows[2] && rows[2][1]) useStore.getState().setGeminiApiKey(rows[2][1]);
                console.log('✓ Settings refreshed from Sheet');
            }
        } catch (e) {
            console.log('Settings sheet may not exist');
        }

        // Also refresh profile data
        try {
            const profileRes = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${currentSheetId}/values/Profile!A2:B4`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (profileRes.ok) {
                const profileData = await profileRes.json();
                const rows = profileData.values || [];
                if (rows[0] && rows[0][1]) useStore.getState().setMonthlySalary(parseInt(rows[0][1]) || 0);
                if (rows[1] && rows[1][1]) useStore.getState().setOtherGains(parseInt(rows[1][1]) || 0);
                if (rows[2] && rows[2][1]) useStore.getState().setCurrentBalance(parseInt(rows[2][1]) || 0);
                console.log('✓ Profile refreshed from Sheet');
            }
        } catch (e) {
            console.log('Profile sheet may not exist');
        }
    }, [accessToken, loadSheetData]);

    // Add expense to sheet with duplicate detection
    const addExpense = useCallback(async (expense) => {
        const { sheetId: currentSheetId, sheetData } = useStore.getState();

        if (!accessToken) {
            console.error('Cannot add expense: no access token');
            return false;
        }
        if (!currentSheetId) {
            console.error('Cannot add expense: no sheet ID');
            return false;
        }

        // Duplicate Check Hash: Date + Amount + Item (normalized)
        const normalize = (str) => str ? str.toLowerCase().trim() : '';
        const newHash = `${expense.date}-${expense.amount}-${normalize(expense.item)}`;

        const isDuplicate = sheetData.some(existing => {
            const existingHash = `${existing.date}-${existing.amount}-${normalize(existing.item)}`;
            return existingHash === newHash;
        });

        if (isDuplicate) {
            console.warn('Duplicate expense detected, skipping:', expense.item);
            return false; // Silently skip or notify caller
        }

        try {
            const row = [
                expense.date,
                expense.item,
                expense.category,
                expense.subcategory || '',
                expense.amount,
                expense.paymentMethod || 'UPI',
                expense.notes || '',
                expense.month || new Date(expense.date).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
            ];

            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${currentSheetId}/values/A:H:append?valueInputOption=USER_ENTERED`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ values: [row] })
                }
            );

            if (!response.ok) throw new Error('API request failed');

            useStore.getState().addExpense({ ...expense, id: sheetData.length });

            // --- BUDGET ALERT LOGIC ---
            const state = useStore.getState();
            const { budget, webhookUrl, lastAlertLevel } = state;

            // Calculate new total expense including this one
            const currentTotal = sheetData
                .filter(item => item.category !== 'Income')
                .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) + parseFloat(expense.amount);

            if (budget > 0 && webhookUrl) {
                const percentage = (currentTotal / budget) * 100;
                let alertLevel = 0;

                if (percentage >= 100) alertLevel = 100;
                else if (percentage >= 90) alertLevel = 90;
                else if (percentage >= 75) alertLevel = 75;
                else if (percentage >= 50) alertLevel = 50;
                else if (percentage >= 25) alertLevel = 25;

                // Only alert if we crossed a NEW threshold upwards
                if (alertLevel > lastAlertLevel) {
                    console.log(`Triggering budget alert: ${alertLevel}%`);

                    const message = alertLevel === 100
                        ? `🚨 **CRITICAL ALERT**: You have utilized **100%** of your budget (₹${budget})!`
                        : `⚠️ **Spending Alert**: You have used **${alertLevel}%** of your monthly budget.`;

                    // Send Webhook (Fire & Forget)
                    fetch(webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: message })
                    }).catch(err => console.error('Webhook failed', err));

                    // Update local state to prevent spam
                    state.setLastAlertLevel(alertLevel);
                }
            }
            // --------------------------

            return true;
        } catch (error) {
            console.error('Error adding expense:', error);
            return false;
        }
    }, [accessToken]);

    // Update expense in sheet
    const updateExpense = useCallback(async (rowIndex, expense) => {
        const currentSheetId = useStore.getState().sheetId;
        if (!accessToken || !currentSheetId) return false;

        try {
            const sheetRow = rowIndex + 2;
            const row = [
                expense.date,
                expense.item,
                expense.category,
                expense.subcategory || '',
                expense.amount,
                expense.paymentMethod || 'UPI',
                expense.notes || '',
                expense.month || ''
            ];

            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${currentSheetId}/values/A${sheetRow}:H${sheetRow}?valueInputOption=USER_ENTERED`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ values: [row] })
                }
            );

            useStore.getState().updateExpense(rowIndex, expense);
            return true;
        } catch (error) {
            console.error('Error updating expense:', error);
            return false;
        }
    }, [accessToken]);

    // Create sheet (called from UI when user confirms)
    const createSheet = useCallback(async () => {
        const userEmail = useStore.getState().user?.email;
        if (!accessToken) return false;
        try {
            setLoading(true);
            const newSheetId = await createNewSheet(accessToken, userEmail);
            setSheetId(newSheetId);
            setSheetData([]);
            setNeedsSheet(false);
            return true;
        } catch (error) {
            console.error('Error creating sheet:', error);
            return false;
        } finally {
            setLoading(false);
        }
    }, [accessToken, createNewSheet, setSheetId, setSheetData, setNeedsSheet, setLoading]);

    // Main login handler
    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setAuthLoading(true);
            setAuthError(null);
            setLoading(true);

            try {
                const token = tokenResponse.access_token;
                setAccessToken(token);
                saveSession(token); // Save session for persistence

                // Get user info
                const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!userInfoResponse.ok) throw new Error('Failed to get user info');
                const userInfo = await userInfoResponse.json();

                setUser({
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    sub: userInfo.sub,
                });

                // Step 1: Check if we have a persisted sheetId that's still valid
                const persistedSheetId = useStore.getState().sheetId;
                if (persistedSheetId) {
                    console.log('Checking persisted sheet ID:', persistedSheetId);
                    const isValid = await verifySheetAccess(token, persistedSheetId);
                    if (isValid) {
                        console.log('✓ Using persisted sheet ID');
                        await loadSheetData(token, persistedSheetId);
                        setNeedsSheet(false);
                        setCurrentView('dashboard');
                        return; // Exit early - we have a valid sheet
                    } else {
                        console.log('✗ Persisted sheet ID is invalid, will search Drive');
                    }
                }

                // Step 2: Search Drive for existing sheets with user's email
                console.log('Searching Drive for existing sheets...');
                const existingSheets = await findExistingSheets(token, userInfo.email);

                if (existingSheets.length > 0) {
                    // Use the most recently modified sheet
                    const latestSheet = existingSheets[0];
                    console.log('✓ Using existing sheet:', latestSheet.name, latestSheet.id);
                    setSheetId(latestSheet.id);
                    await loadSheetData(token, latestSheet.id);
                    setNeedsSheet(false);
                    setCurrentView('dashboard');
                } else {
                    // No sheet found - prompt user to create
                    console.log('No existing sheet found - will prompt to create');
                    setNeedsSheet(true);
                    setSheetData([]);
                    setCurrentView('dashboard');
                }

            } catch (error) {
                console.error('Login error:', error);
                setAuthError(error.message);
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
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
    });

    // Restore session on mount
    useEffect(() => {
        const restoreSession = async () => {
            const token = getStoredSession();
            if (!token) {
                setAuthLoading(false);
                return;
            }

            try {
                // Verify token and get user info
                const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!userInfoResponse.ok) {
                    throw new Error('Session expired');
                }

                const userInfo = await userInfoResponse.json();
                setAccessToken(token);
                setUser({
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    sub: userInfo.sub,
                });

                // Load data using validated token
                const storedSheetId = useStore.getState().sheetId;
                if (storedSheetId) {
                    const isValid = await verifySheetAccess(token, storedSheetId);
                    if (isValid) {
                        await loadSheetData(token, storedSheetId);
                        setCurrentView('dashboard');
                    } else {
                        // If persisted sheet invalid, search Drive
                        const existingSheets = await findExistingSheets(token, userInfo.email);
                        if (existingSheets.length > 0) {
                            const latestSheetId = existingSheets[0].id;
                            setSheetId(latestSheetId);
                            setLoading(true);
                            await loadSheetData(token, latestSheetId);

                            // Load Settings (Budget, Webhook, Gemini Key)
                            try {
                                const settingsRes = await fetch(
                                    `https://sheets.googleapis.com/v4/spreadsheets/${latestSheetId}/values/Settings!A2:B4`,
                                    { headers: { Authorization: `Bearer ${token}` } }
                                );
                                if (settingsRes.ok) {
                                    const settingsData = await settingsRes.json();
                                    const rows = settingsData.values || [];
                                    if (rows.length > 0) {
                                        // Row 2 (Index 0): Budget
                                        if (rows[0] && rows[0][1]) {
                                            useStore.getState().setBudget(parseInt(rows[0][1]) || 11000);
                                        }
                                        // Row 3 (Index 1): Webhook
                                        if (rows[1] && rows[1][1]) {
                                            useStore.getState().setWebhookUrl(rows[1][1]);
                                        }
                                        // Row 4 (Index 2): Gemini API Key
                                        if (rows[2] && rows[2][1]) {
                                            useStore.getState().setGeminiApiKey(rows[2][1]);
                                        }
                                    }
                                }
                            } catch (e) {
                                console.log('Settings sheet may not exist yet');
                            }

                            setCurrentView('dashboard');
                        } else {
                            setSheetData([]);
                            setNeedsSheet(true);
                        }
                    }
                } else {
                    // No stored sheet ID, search Drive
                    const existingSheets = await findExistingSheets(token, userInfo.email);
                    if (existingSheets.length > 0) {
                        const latestSheetId = existingSheets[0].id;
                        setSheetId(latestSheetId);
                        setLoading(true);
                        await loadSheetData(token, latestSheetId);

                        // Load Settings
                        try {
                            const settingsRes = await fetch(
                                `https://sheets.googleapis.com/v4/spreadsheets/${latestSheetId}/values/Settings!A2:B4`,
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                            if (settingsRes.ok) {
                                const settingsData = await settingsRes.json();
                                const rows = settingsData.values || [];
                                if (rows[0] && rows[0][1]) useStore.getState().setBudget(parseInt(rows[0][1]) || 11000);
                                if (rows[1] && rows[1][1]) useStore.getState().setWebhookUrl(rows[1][1]);
                                if (rows[2] && rows[2][1]) useStore.getState().setGeminiApiKey(rows[2][1]);
                            }
                        } catch (e) { console.log('Settings load failed'); }

                        setCurrentView('dashboard');
                    } else {
                        setNeedsSheet(true);
                    }
                }
            } catch (error) {
                console.error('Session restore failed:', error);
                clearSession();
                storeLogout();
            } finally {
                setAuthLoading(false);
            }
        };

        restoreSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const logout = useCallback(() => {
        googleLogout();
        setAccessToken(null);
        clearSession();
        storeLogout();
    }, [storeLogout]);

    // Search for all spreadsheets (limit 20, recent first)
    const searchAllSpreadsheets = useCallback(async () => {
        if (!accessToken) return [];
        try {
            console.log('Fetching recent spreadsheets...');
            const query = encodeURIComponent(`mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=20&fields=files(id,name,modifiedTime,owners)&orderBy=modifiedTime desc`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (!response.ok) throw new Error('Failed to fetch spreadsheets');
            const data = await response.json();
            return data.files || [];
        } catch (error) {
            console.error('Error searching spreadsheets:', error);
            return [];
        }
    }, [accessToken]);

    // Validate and use a specific sheet ID
    const validateAndSetSheet = useCallback(async (sheetId) => {
        if (!accessToken) return { success: false, error: 'Not authenticated' };

        try {
            setLoading(true);
            const isValid = await verifySheetAccess(accessToken, sheetId);

            if (isValid) {
                setSheetId(sheetId);
                await loadSheetData(accessToken, sheetId);
                setNeedsSheet(false);
                setLoading(false);
                return { success: true };
            } else {
                setLoading(false);
                return { success: false, error: 'Cannot access this sheet. Please check permissions.' };
            }
        } catch (error) {
            console.error('Error validating sheet:', error);
            setLoading(false);
            return { success: false, error: error.message };
        }
    }, [accessToken, verifySheetAccess, setSheetId, loadSheetData, setNeedsSheet, setLoading]);

    const value = {
        user: useStore.getState().user,
        isAuthenticated: !!accessToken,
        isLoading,
        authError,
        login,
        logout,
        refreshData,
        addExpense,
        updateExpense,
        createSheet,
        searchAllSpreadsheets,
        validateAndSetSheet,
        accessToken,
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
                textAlign: 'center',
                background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
                color: 'white'
            }}>
                <div>
                    <h2 style={{ marginBottom: '1rem' }}>Configuration Required</h2>
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
