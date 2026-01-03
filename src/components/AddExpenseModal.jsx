import { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import { getCategoryNames, getSubcategories, getCategoryIcon } from '../data/categories';
import './AddExpenseModal.css';

const AddExpenseModal = ({ onClose }) => {
    const { addExpense } = useGoogleAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        item: '',
        category: 'Food',
        subcategory: '',
        amount: '',
        paymentMethod: 'UPI',
        notes: ''
    });

    const categories = getCategoryNames();
    const subcategories = getSubcategories(formData.category);
    const paymentMethods = ['UPI', 'Cash', 'Card', 'Bitcoin'];

    const handleChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            // Reset subcategory when category changes
            if (field === 'category') {
                updated.subcategory = '';
            }
            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.item || !formData.amount) {
            setError('Please fill in item and amount');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const expense = {
                ...formData,
                amount: parseFloat(formData.amount),
                month: new Date(formData.date).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
            };

            const result = await addExpense(expense);
            if (result) {
                setSuccess(true);
                // Reset form for next entry
                setFormData({
                    ...formData,
                    item: '',
                    amount: '',
                    notes: '',
                    subcategory: ''
                });
                setTimeout(() => setSuccess(false), 2000);
            } else {
                setError('Failed to add expense. Please try again.');
            }
        } catch {
            setError('Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Add Expense</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="expense-form">
                    {/* Date */}
                    <div className="form-group">
                        <label>Date</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => handleChange('date', e.target.value)}
                            className="form-input"
                        />
                    </div>

                    {/* Item */}
                    <div className="form-group">
                        <label>Item / Description</label>
                        <input
                            type="text"
                            value={formData.item}
                            onChange={(e) => handleChange('item', e.target.value)}
                            placeholder="What did you spend on?"
                            className="form-input"
                            autoFocus
                        />
                    </div>

                    {/* Amount */}
                    <div className="form-group">
                        <label>Amount (₹)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={formData.amount}
                            onChange={(e) => {
                                // Only allow numbers and decimal
                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                handleChange('amount', val);
                            }}
                            placeholder="0"
                            className="form-input amount-input"
                        />
                    </div>

                    {/* Category */}
                    <div className="form-group">
                        <label>Category</label>
                        <div className="category-grid">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    className={`category-btn ${formData.category === cat ? 'active' : ''}`}
                                    onClick={() => handleChange('category', cat)}
                                >
                                    <span className="cat-icon">{getCategoryIcon(cat)}</span>
                                    <span className="cat-name">{cat}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subcategory (if available) */}
                    {subcategories.length > 0 && (
                        <div className="form-group">
                            <label>Subcategory</label>
                            <select
                                value={formData.subcategory}
                                onChange={(e) => handleChange('subcategory', e.target.value)}
                                className="form-input"
                            >
                                <option value="">Select...</option>
                                {subcategories.map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Payment Method */}
                    <div className="form-group">
                        <label>Payment Method</label>
                        <select
                            value={formData.paymentMethod}
                            onChange={(e) => handleChange('paymentMethod', e.target.value)}
                            className="form-input"
                        >
                            {paymentMethods.map(method => (
                                <option key={method} value={method}>{method}</option>
                            ))}
                        </select>
                    </div>

                    {/* Notes */}
                    <div className="form-group">
                        <label>Notes (optional)</label>
                        <input
                            type="text"
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            placeholder="Any additional notes..."
                            className="form-input"
                        />
                    </div>

                    {/* Error/Success Messages */}
                    {error && <div className="message error">{error}</div>}
                    {success && <div className="message success">✓ Expense added!</div>}

                    {/* Submit Button */}
                    <button type="submit" className="btn-submit" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 size={18} className="spin" />
                                Adding...
                            </>
                        ) : (
                            <>
                                <Plus size={18} />
                                Add Expense
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddExpenseModal;
