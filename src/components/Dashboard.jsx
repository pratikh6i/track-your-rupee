import { useState, useEffect, useMemo } from 'react';
import {
    LogOut, RefreshCw, Plus, Zap,
    TrendingDown, TrendingUp, PieChart, BarChart3,
    Calendar, Edit3, Check, X, ChevronDown, ChevronUp, FileText, ArrowRight, XCircle
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler, BarElement, Title } from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import { getCategoryColor, getCategoryIcon } from '../data/categories';
import AddExpenseModal from './AddExpenseModal';
import AIQuickAdd from './AIQuickAdd';
import HelpModal from './HelpModal';
import './Dashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler, BarElement, Title);

const Dashboard = () => {
    const { user, logout, refreshData, updateExpense, createSheet, isAuthenticated } = useGoogleAuth();
    const {
        sheetData, isLoading, getStats,
        isHelpModalOpen, toggleHelpModal,
        isAddModalOpen, toggleAddModal,
        isQuickAddOpen, toggleQuickAdd,
        needsSheet
    } = useStore();
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({});
    const [showAllTransactions, setShowAllTransactions] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedCategory, setSelectedCategory] = useState(null);

    const stats = getStats();
    const hasIncome = stats.totalIncome > 0;
    const hasData = sheetData && sheetData.length > 0;

    // Load data on mount if authenticated
    useEffect(() => {
        if (isAuthenticated && !needsSheet && sheetData.length === 0) {
            refreshData?.();
        }
    }, [isAuthenticated, needsSheet]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Edit functions
    const startEdit = (transaction, index) => {
        setEditingId(index);
        setEditValues({
            date: transaction.date,
            item: transaction.item,
            amount: transaction.amount,
            paymentMethod: transaction.paymentMethod,
            notes: transaction.notes
        });
    };

    const saveEdit = async (index) => {
        const transaction = sheetData[index];
        await updateExpense(index, { ...transaction, ...editValues });
        setEditingId(null);
        setEditValues({});
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValues({});
    };

    // --- Chart Data Preparation ---

    // 1. Spending by Category (Donut)
    const categoryData = {
        labels: Object.keys(stats.categoryBreakdown),
        datasets: [{
            data: Object.values(stats.categoryBreakdown),
            backgroundColor: Object.keys(stats.categoryBreakdown).map(cat => getCategoryColor(cat)),
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 8,
        }]
    };

    const donutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        onClick: (event, elements) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                const category = Object.keys(stats.categoryBreakdown)[index];
                setSelectedCategory(category === selectedCategory ? null : category);
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#1E293B',
                bodyColor: '#475569',
                borderColor: '#E2E8F0',
                borderWidth: 1,
                titleFont: { family: 'Inter', size: 13, weight: '600' },
                bodyFont: { family: 'Inter', size: 12 },
                padding: 12,
                cornerRadius: 8,
                callbacks: { label: (ctx) => ` ${formatCurrency(ctx.raw)}` }
            }
        }
    };

    // 2. Daily Trend (Line)
    const trendData = {
        labels: stats.dailySpending.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        }),
        datasets: [{
            label: 'Expenses',
            data: stats.dailySpending.map(d => d.expense),
            fill: true,
            backgroundColor: (ctx) => {
                const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
                gradient.addColorStop(0, 'rgba(14, 165, 233, 0.2)');
                gradient.addColorStop(1, 'rgba(14, 165, 233, 0)');
                return gradient;
            },
            borderColor: '#0EA5E9',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#0EA5E9',
        }]
    };

    const trendOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: {
                grid: { display: false },
                ticks: { font: { family: 'Inter', size: 10 }, color: '#94A3B8', maxRotation: 0 }
            },
            y: {
                grid: { color: '#F1F5F9' },
                ticks: {
                    font: { family: 'Inter', size: 10 },
                    color: '#94A3B8',
                    callback: (value) => '₹' + (value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value)
                }
            }
        }
    };

    // 3. Top Categories (Bar)
    const barData = {
        labels: stats.topCategories.map(c => c.name),
        datasets: [{
            data: stats.topCategories.map(c => c.amount),
            backgroundColor: stats.topCategories.map(c => getCategoryColor(c.name)),
            borderRadius: 6,
            barThickness: 24,
        }]
    };

    const barOptions = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: {
                grid: { color: '#F1F5F9' },
                ticks: {
                    font: { family: 'Inter', size: 10 },
                    color: '#94A3B8',
                    callback: (value) => '₹' + (value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value)
                }
            },
            y: {
                grid: { display: false },
                ticks: { font: { family: 'Inter', size: 11 }, color: '#475569' }
            }
        }
    };

    // Filtered transactions based on selection
    const filteredTransactions = useMemo(() => {
        let txs = sheetData;
        if (selectedCategory) {
            txs = txs.filter(t => t.category === selectedCategory);
        }
        // Sort by date desc
        return txs.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [sheetData, selectedCategory]);

    const displayedTransactions = showAllTransactions || selectedCategory
        ? filteredTransactions
        : filteredTransactions.slice(0, 5);

    // No Sheet Prompt
    if (needsSheet) {
        return (
            <div className="dashboard">
                <header className="dashboard-header">
                    <div className="header-left">
                        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="logo-icon" />
                        <span className="logo-text">Track your Rupee</span>
                    </div>
                    <div className="header-right">
                        {user?.picture && <img src={user.picture} alt="" className="user-avatar" />}
                        <button className="btn-icon logout" onClick={logout} title="Logout">
                            <LogOut size={18} />
                        </button>
                    </div>
                </header>
                <div className="no-sheet-prompt">
                    <FileText size={48} />
                    <h2>No Expense Sheet Found</h2>
                    <p>Create a new Google Sheet to start tracking your expenses.</p>
                    <button className="btn-create-sheet" onClick={createSheet} disabled={isLoading}>
                        {isLoading ? 'Creating...' : 'Create New Sheet'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-left">
                    <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="logo-icon" />
                    <span className="logo-text">Track your Rupee</span>
                </div>
                <div className="header-right">
                    <button className="btn-quick-add" onClick={toggleQuickAdd} title="AI Quick-Add">
                        <Zap size={16} /> <span className="hide-mobile">Quick Add</span>
                    </button>
                    <button className="btn-icon" onClick={toggleHelpModal} title="AI Prompts">
                        <FileText size={18} />
                    </button>
                    <button className="btn-icon" onClick={refreshData} disabled={isLoading} title="Refresh">
                        <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
                    </button>
                    {user?.picture && <img src={user.picture} alt="" className="user-avatar" />}
                    <button className="btn-icon logout" onClick={logout} title="Logout">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Mobile Tabs */}
            <div className="mobile-tabs">
                <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                    <PieChart size={16} /> Overview
                </button>
                <button className={`tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>
                    <BarChart3 size={16} /> Transactions
                </button>
            </div>

            {/* Main Content */}
            <main className="dashboard-main">
                {/* Quick Stats */}
                <section className={`stats-section ${activeTab !== 'overview' ? 'hide-mobile' : ''}`}>
                    <div className="stat-card expense">
                        <div className="stat-header">
                            <TrendingDown size={20} className="text-red" />
                            <span>Total Expenses</span>
                        </div>
                        <div className="stat-value">{formatCurrency(stats.totalExpenses)}</div>
                        <div className="stat-meta">{stats.transactionCount || 0} transactions</div>
                    </div>

                    {hasIncome && (
                        <>
                            <div className="stat-card income">
                                <div className="stat-header">
                                    <TrendingUp size={20} className="text-green" />
                                    <span>Total Income</span>
                                </div>
                                <div className="stat-value">{formatCurrency(stats.totalIncome)}</div>
                            </div>
                            <div className={`stat-card ${stats.balance >= 0 ? 'positive' : 'negative'}`}>
                                <div className="stat-header">
                                    <TrendingUp size={20} />
                                    <span>Balance</span>
                                </div>
                                <div className="stat-value" style={{ color: stats.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                    {formatCurrency(stats.balance)}
                                </div>
                            </div>
                        </>
                    )}
                </section>

                {/* Charts Section */}
                {hasData && (
                    <section className={`charts-section ${activeTab !== 'overview' ? 'hide-mobile' : ''}`}>
                        <div className="chart-card">
                            <h3 className="chart-title">
                                <PieChart size={18} className="text-primary" /> Spending by Category
                            </h3>
                            <div className="chart-content">
                                <div className="donut-container">
                                    <Doughnut data={categoryData} options={donutOptions} />
                                    <div className="donut-center">
                                        <span className="donut-total">{formatCurrency(stats.totalExpenses)}</span>
                                        <span className="donut-label">Total</span>
                                    </div>
                                </div>
                                <div className="category-legend">
                                    {stats.topCategories.map((cat, i) => (
                                        <div
                                            key={i}
                                            className="legend-item"
                                            onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                                            style={{
                                                opacity: selectedCategory && selectedCategory !== cat.name ? 0.5 : 1,
                                                background: selectedCategory === cat.name ? '#E2E8F0' : undefined
                                            }}
                                        >
                                            <span className="legend-dot" style={{ background: getCategoryColor(cat.name) }}></span>
                                            <span className="legend-name">{cat.name}</span>
                                            <span className="legend-value">{formatCurrency(cat.amount)}</span>
                                            <span className="legend-percent">{cat.percentage}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="chart-card">
                            <h3 className="chart-title">
                                <TrendingUp size={18} className="text-primary" /> Daily Trend
                            </h3>
                            <div className="chart-content trend-chart">
                                <Line data={trendData} options={trendOptions} />
                            </div>
                        </div>

                        {stats.topCategories.length > 2 && (
                            <div className="chart-card full-width">
                                <h3 className="chart-title">
                                    <BarChart3 size={18} className="text-primary" /> Top Categories
                                </h3>
                                <div className="chart-content bar-chart">
                                    <Bar data={barData} options={barOptions} />
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Empty State */}
                {!hasData && (
                    <div className="empty-state-large">
                        <Zap size={48} />
                        <h3>No Expenses Yet</h3>
                        <p>Use AI Quick-Add to import expenses in seconds</p>
                        <button className="btn-quick-add-large" onClick={toggleQuickAdd}>
                            <Zap size={20} /> AI Quick-Add
                        </button>
                        <button className="btn-prompts" onClick={toggleHelpModal}>
                            View AI Prompts
                        </button>
                    </div>
                )}

                {/* Transactions Section */}
                {hasData && (
                    <section className={`transactions-section ${activeTab !== 'transactions' ? 'hide-mobile' : ''}`}>
                        <div className="section-header">
                            <h3>
                                <Calendar size={18} className="text-primary" />
                                {selectedCategory ? `${selectedCategory} Transactions` : 'Recent Transactions'}
                            </h3>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {selectedCategory && (
                                    <button className="btn-text" onClick={() => setSelectedCategory(null)}>
                                        <XCircle size={16} /> Clear Filter
                                    </button>
                                )}

                                {filteredTransactions.length > 5 && (
                                    <button className="btn-text" onClick={() => setShowAllTransactions(!showAllTransactions)}>
                                        {showAllTransactions ? 'Show Less' : 'Show All'}
                                        {showAllTransactions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="transactions-list">
                            {displayedTransactions.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                                    No transactions found.
                                </p>
                            ) : (
                                displayedTransactions.map((item, idx) => {
                                    const originalIndex = sheetData.findIndex(d => d.id === item.id);
                                    const isEditing = editingId === originalIndex;

                                    return (
                                        <div key={idx} className={`transaction-row ${isEditing ? 'editing' : ''}`}>
                                            {isEditing ? (
                                                <>
                                                    <div className="edit-fields">
                                                        <input
                                                            type="date"
                                                            value={editValues.date}
                                                            onChange={(e) => setEditValues({ ...editValues, date: e.target.value })}
                                                            className="edit-input"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editValues.item}
                                                            onChange={(e) => setEditValues({ ...editValues, item: e.target.value })}
                                                            className="edit-input"
                                                        />
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={editValues.amount}
                                                            onChange={(e) => setEditValues({ ...editValues, amount: e.target.value })}
                                                            className="edit-input amount"
                                                        />
                                                    </div>
                                                    <div className="edit-actions">
                                                        <button className="btn-icon save" onClick={() => saveEdit(originalIndex)}><Check size={16} /></button>
                                                        <button className="btn-icon cancel" onClick={cancelEdit}><X size={16} /></button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="transaction-icon" style={{ color: getCategoryColor(item.category) }}>
                                                        {getCategoryIcon(item.category)}
                                                    </div>
                                                    <div className="transaction-info">
                                                        <span className="transaction-name">{item.item}</span>
                                                        <span className="transaction-meta">
                                                            {item.category} • {item.date}
                                                        </span>
                                                        {item.notes && (
                                                            <span className="transaction-meta" style={{ display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>
                                                                {item.notes}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="transaction-amount">
                                                        <span className={item.category === 'Income' ? 'income' : 'expense'}>
                                                            {item.category === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(item.amount))}
                                                        </span>
                                                    </div>
                                                    <button className="btn-icon edit" onClick={() => startEdit(item, originalIndex)}>
                                                        <Edit3 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>
                )}
            </main>

            {/* Floating Add Button */}
            <button className="fab" onClick={toggleAddModal}>
                <Plus size={24} />
            </button>

            {/* Modals */}
            {isAddModalOpen && <AddExpenseModal onClose={toggleAddModal} />}
            {isQuickAddOpen && <AIQuickAdd onClose={toggleQuickAdd} />}
            {isHelpModalOpen && <HelpModal onClose={toggleHelpModal} />}
        </div>
    );
};

export default Dashboard;
