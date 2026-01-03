import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { GoogleOAuthProvider, useGoogleLogin, googleLogout } from '@react-oauth/google';
import useStore from '../store/useStore';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const APP_SHEET_NAME = 'Track your Rupee';

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
        user,
        setUser,
        logout: storeLogout,
        setSheetId,
        setCurrentView,
        setLoading,
        setSheetData,
        setNeedsSheet,
        sheetId: persistedSheetId
    } = store;

    const [isLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState(null);
    const [accessToken, setAccessToken] = useState(null);

    // Validate that a sheet still exists
    const validateSheet = useCallback(async (token, sheetIdToValidate) => {
        try {
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetIdToValidate}?fields=properties.title`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.ok;
        } catch {
            return false;
        }
    }, []);

    // Find existing sheets in Drive
    const findExistingSheets = useCallback(async (token) => {
        try {
            const query = encodeURIComponent(`name contains '${APP_SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!response.ok) return [];
            const data = await response.json();
            return data.files || [];
        } catch (error) {
            console.error('Error searching for sheets:', error);
            return [];
        }
    }, []);

    // Create a new sheet
    const createNewSheet = useCallback(async (token) => {
        try {
            const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    properties: { title: APP_SHEET_NAME }
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

            return newSheetId;
        } catch (error) {
            console.error('Error creating sheet:', error);
            throw error;
        }
    }, []);

    // Load sheet data
    const loadSheetData = useCallback(async (token, sheetIdToLoad) => {
        try {
            setLoading(true);
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetIdToLoad}/values/A2:H1000`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!response.ok) throw new Error('Failed to load sheet data');
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

    // Refresh data
    const refreshData = useCallback(async () => {
        const currentSheetId = useStore.getState().sheetId;
        if (!accessToken || !currentSheetId) {
            console.error('Cannot refresh: no token or sheetId');
            return;
        }
        await loadSheetData(accessToken, currentSheetId);
    }, [accessToken, loadSheetData]);

    // Add expense to sheet
    const addExpense = useCallback(async (expense) => {
        const currentSheetId = useStore.getState().sheetId;
        if (!accessToken) {
            console.error('Cannot add expense: no access token. Please sign in again.');
            return false;
        }
        if (!currentSheetId) {
            console.error('Cannot add expense: no sheet ID');
            return false;
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

            if (!response.ok) {
                throw new Error('API request failed');
            }

            // Update local state
            useStore.getState().addExpense({ ...expense, id: useStore.getState().sheetData.length });
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

    // Create sheet (called from UI)
    const createSheet = useCallback(async () => {
        if (!accessToken) return false;
        try {
            setLoading(true);
            const newSheetId = await createNewSheet(accessToken);
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

                // Check for persisted sheetId first
                const storedSheetId = useStore.getState().sheetId;
                if (storedSheetId) {
                    const isValid = await validateSheet(token, storedSheetId);
                    if (isValid) {
                        await loadSheetData(token, storedSheetId);
                        setCurrentView('dashboard');
                        return;
                    }
                }

                // Search for existing sheets
                const existingSheets = await findExistingSheets(token);
                if (existingSheets.length > 0) {
                    const latestSheet = existingSheets[0];
                    setSheetId(latestSheet.id);
                    await loadSheetData(token, latestSheet.id);
                    setCurrentView('dashboard');
                    return;
                }

                // No sheet found - prompt user
                setNeedsSheet(true);
                setSheetData([]);
                setCurrentView('dashboard');

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
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly',
    });

    const logout = useCallback(() => {
        googleLogout();
        setAccessToken(null);
        storeLogout();
    }, [storeLogout]);

    const value = {
        user,
        isAuthenticated: !!accessToken,
        isLoading,
        authError,
        login,
        logout,
        refreshData,
        addExpense,
        updateExpense,
        createSheet,
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
                    <h2 style={{ marginBottom: '1rem' }}>⚙️ Configuration Required</h2>
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
