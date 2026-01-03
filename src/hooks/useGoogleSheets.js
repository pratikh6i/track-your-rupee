import { useCallback } from 'react';
import useStore from '../store/useStore';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const REQUIRED_HEADERS = ['Date', 'Item', 'Category', 'Amount', 'Payment Method', 'Notes', 'Month'];

export const useGoogleSheets = () => {
    const { accessToken, sheetId, setSheetData, setLoading, setError, addExpenses } = useStore();

    // Extract Sheet ID from URL or use as-is
    const parseSheetId = useCallback((input) => {
        if (!input) return null;

        // If it's a full URL, extract the ID
        const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (urlMatch) return urlMatch[1];

        // If it looks like an ID already
        if (/^[a-zA-Z0-9-_]+$/.test(input)) return input;

        return null;
    }, []);

    // Check if headers are valid
    const validateHeaders = useCallback((headers) => {
        const headerStr = headers.join(',').toLowerCase();
        const required = REQUIRED_HEADERS.map(h => h.toLowerCase());
        return required.every(h => headerStr.includes(h));
    }, []);

    // Initialize headers for a new/empty sheet
    const initializeSheet = useCallback(async (sheetIdToInit) => {
        if (!accessToken) throw new Error('Not authenticated');

        const response = await fetch(
            `${SHEETS_API_BASE}/${sheetIdToInit}/values/A1:G1?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    values: [REQUIRED_HEADERS]
                })
            }
        );

        if (!response.ok) {
            throw new Error('Failed to initialize sheet headers');
        }

        return true;
    }, [accessToken]);

    // Validate and connect to a sheet
    const connectSheet = useCallback(async (sheetUrl) => {
        setLoading(true);
        setError(null);

        try {
            const id = parseSheetId(sheetUrl);
            if (!id) {
                throw new Error('Invalid sheet URL or ID');
            }

            // Try to read the sheet
            const response = await fetch(
                `${SHEETS_API_BASE}/${id}/values/A1:G1000`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    }
                }
            );

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Sheet not found. Please check the URL.');
                }
                if (response.status === 403) {
                    throw new Error('Access denied. Make sure you have edit access to this sheet.');
                }
                throw new Error('Failed to access sheet');
            }

            const data = await response.json();
            const values = data.values || [];

            // Scenario A: Empty sheet
            if (values.length === 0) {
                await initializeSheet(id);
                return { status: 'initialized', message: 'Initializing Thrusters... Sheet formatted successfully! 🚀' };
            }

            // Check headers
            const headers = values[0];

            // Scenario B: Valid format
            if (validateHeaders(headers)) {
                // Parse and store data
                const rows = values.slice(1).map(row => ({
                    date: row[0] || '',
                    item: row[1] || '',
                    category: row[2] || '',
                    amount: parseFloat(row[3]) || 0,
                    paymentMethod: row[4] || '',
                    notes: row[5] || '',
                    month: row[6] || ''
                }));

                setSheetData(rows);
                return { status: 'connected', message: 'Orbit achieved. Loading your dashboard... 🛰️' };
            }

            // Scenario C: Wrong format
            return {
                status: 'invalid_format',
                message: 'This sheet doesn\'t look like an Anti-Gravity sheet.',
                canCreateTab: true
            };

        } catch (error) {
            setError(error.message);
            return { status: 'error', message: error.message };
        } finally {
            setLoading(false);
        }
    }, [accessToken, parseSheetId, validateHeaders, initializeSheet, setSheetData, setLoading, setError]);

    // Add new expenses to the sheet
    const appendExpenses = useCallback(async (expenses) => {
        if (!accessToken || !sheetId) {
            throw new Error('Not connected to a sheet');
        }

        setLoading(true);

        try {
            const rows = expenses.map(exp => [
                exp.date,
                exp.item,
                exp.category,
                exp.amount,
                exp.payment_method || exp.paymentMethod || '',
                exp.notes || '',
                exp.date ? new Date(exp.date).toLocaleString('default', { month: 'long' }) : ''
            ]);

            const response = await fetch(
                `${SHEETS_API_BASE}/${sheetId}/values/A:G:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ values: rows })
                }
            );

            if (!response.ok) {
                throw new Error('Failed to append expenses');
            }

            // Update local state
            const newExpenses = expenses.map(exp => ({
                date: exp.date,
                item: exp.item,
                category: exp.category,
                amount: parseFloat(exp.amount) || 0,
                paymentMethod: exp.payment_method || exp.paymentMethod || '',
                notes: exp.notes || '',
                month: exp.date ? new Date(exp.date).toLocaleString('default', { month: 'long' }) : ''
            }));

            addExpenses(newExpenses);

            return { success: true, count: expenses.length };
        } catch (error) {
            setError(error.message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [accessToken, sheetId, addExpenses, setLoading, setError]);

    // Create a new sheet in user's Drive
    const createNewSheet = useCallback(async () => {
        if (!accessToken) throw new Error('Not authenticated');

        setLoading(true);

        try {
            const response = await fetch(SHEETS_API_BASE, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    properties: {
                        title: `Anti-Gravity Finance Tracker - ${new Date().toLocaleDateString()}`
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create new sheet');
            }

            const data = await response.json();
            const newSheetId = data.spreadsheetId;

            // Initialize with headers
            await initializeSheet(newSheetId);

            return {
                sheetId: newSheetId,
                url: `https://docs.google.com/spreadsheets/d/${newSheetId}`,
                message: 'New Anti-Gravity sheet created! 🎉'
            };
        } catch (error) {
            setError(error.message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [accessToken, initializeSheet, setLoading, setError]);

    // Refresh data from sheet
    const refreshData = useCallback(async () => {
        if (!accessToken || !sheetId) return;

        setLoading(true);

        try {
            const response = await fetch(
                `${SHEETS_API_BASE}/${sheetId}/values/A2:G1000`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    }
                }
            );

            if (!response.ok) throw new Error('Failed to refresh data');

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
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [accessToken, sheetId, setSheetData, setLoading, setError]);

    return {
        parseSheetId,
        connectSheet,
        appendExpenses,
        createNewSheet,
        refreshData,
        initializeSheet
    };
};

export default useGoogleSheets;
