import { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Search, Link as LinkIcon, Check, Loader2 } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import './SheetPickerModal.css';

const SheetPickerModal = ({ onClose }) => {
    const { searchAllSpreadsheets, validateAndSetSheet } = useGoogleAuth();
    const [sheets, setSheets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [validatingId, setValidatingId] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadSheets = async () => {
            setLoading(true);
            const files = await searchAllSpreadsheets();
            setSheets(files);
            setLoading(false);
        };
        loadSheets();
    }, [searchAllSpreadsheets]);

    const handleSelect = async (sheetId) => {
        setValidatingId(sheetId);
        setError(null);

        const result = await validateAndSetSheet(sheetId);

        if (result.success) {
            onClose();
        } else {
            setError(result.error || 'Failed to access sheet');
            setValidatingId(null);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        }).format(date);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content sheet-picker-modal">
                <div className="modal-header">
                    <h2>Select Existing Sheet</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="sheet-picker-content">
                    {error && (
                        <div className="message error">
                            {error}
                        </div>
                    )}

                    <div className="sheet-list">
                        {loading ? (
                            <div className="picker-loading">
                                <Loader2 size={32} className="spin" />
                                <p>Loading your spreadsheets...</p>
                            </div>
                        ) : sheets.length === 0 ? (
                            <div className="empty-picker">
                                <FileSpreadsheet size={48} />
                                <p>No Google Sheets found.</p>
                            </div>
                        ) : (
                            sheets.map(sheet => (
                                <button
                                    key={sheet.id}
                                    className="sheet-item"
                                    onClick={() => handleSelect(sheet.id)}
                                    disabled={validatingId !== null}
                                >
                                    <div className="sheet-icon">
                                        <FileSpreadsheet size={24} color="#10B981" />
                                    </div>
                                    <div className="sheet-info">
                                        <span className="sheet-name">{sheet.name}</span>
                                        <span className="sheet-meta">
                                            Last modified: {formatDate(sheet.modifiedTime)}
                                        </span>
                                    </div>
                                    {validatingId === sheet.id ? (
                                        <Loader2 size={18} className="spin text-primary" />
                                    ) : (
                                        <div className="btn-select">Select</div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SheetPickerModal;
