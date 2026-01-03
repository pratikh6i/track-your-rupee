import { useState, useEffect } from 'react';
import {
    Wallet, LogOut, RefreshCw, Plus, HelpCircle,
    TrendingDown, TrendingUp, PieChart, BarChart3,
    Calendar, Edit3, Check, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler, BarElement } from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import { getCategoryColor, getCategoryIcon, getCategoryNames, getSubcategories } from '../data/categories';
import AddExpenseModal from './AddExpenseModal';
import HelpModal from './HelpModal';
import './Dashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler, BarElement);

const Dashboard = () => {
    const { user, logout, refreshData, updateExpense } = useGoogleAuth();
    const { sheetData, isLoading, getStats, isHelpModalOpen, toggleHelpModal, isAddModalOpen, toggleAddModal } = useStore();
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({});
    const [showAllTransactions, setShowAllTransactions] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    const stats = getStats();
    const hasIncome = stats.totalIncome > 0;

    useEffect(() => {
        if (sheetData.length === 0) {
            refreshData?.();
        }
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Start editing a transaction
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

    // Save edit
    const saveEdit = async (index) => {
        const transaction = sheetData[index];
        await updateExpense(index, { ...transaction, ...editValues });
        setEditingId(null);
        setEditValues({});
    };

    // Cancel edit
    const cancelEdit = () => {
        setEditingId(null);
        setEditValues({});
    };

    // Category chart with premium colors
    const categoryData = {
        labels: Object.keys(stats.categoryBreakdown),
        datasets: [{
            data: Object.values(stats.categoryBreakdown),
            backgroundColor: Object.keys(stats.categoryBreakdown).map(cat => getCategoryColor(cat)),
            borderWidth: 0,
            hoverOffset: 8,
            borderRadius: 4,
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleFont: { family: 'Inter', size: 13, weight: '600' },
                bodyFont: { family: 'Inter', size: 12 },
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (ctx) => ` ${formatCurrency(ctx.raw)}`
                }
            }
        }
    };

    // Spending trend chart
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
                gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
                gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
                return gradient;
            },
            borderColor: '#EF4444',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#EF4444',
        }]
    };

    const trendOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: {
                grid: { display: false },
                ticks: { font: { family: 'Inter', size: 10 }, color: '#9CA3AF', maxRotation: 0 }
            },
            y: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                    font: { family: 'Inter', size: 10 },
                    color: '#9CA3AF',
                    callback: (value) => '₹' + (value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value)
                }
            }
        }
    };

    // Category bar chart
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
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                    font: { family: 'Inter', size: 10 },
                    color: '#9CA3AF',
                    callback: (value) => '₹' + (value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value)
                }
            },
            y: {
                grid: { display: false },
                ticks: { font: { family: 'Inter', size: 11 }, color: '#E5E7EB' }
            }
        }
    };

    const displayedTransactions = showAllTransactions
        ? stats.recentTransactions
        : stats.recentTransactions.slice(0, 5);

    return (
        <div className="dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-left">
                    <div className="logo-mini">💰</div>
                    <span className="logo-text">Track your Rupee</span>
                </div>
                <div className="header-right">
                    <button className="btn-icon" onClick={refreshData} disabled={isLoading} title="Refresh">
                        <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
                    </button>
                    <button className="btn-icon" onClick={toggleHelpModal} title="AI Prompts">
                        <HelpCircle size={18} />
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
                            <TrendingDown size={20} />
                            <span>Total Expenses</span>
                        </div>
                        <div className="stat-value">{formatCurrency(stats.totalExpenses)}</div>
                        <div className="stat-meta">{stats.transactionCount || 0} transactions</div>
                    </div>

                    {hasIncome && (
                        <>
                            <div className="stat-card income">
                                <div className="stat-header">
                                    <TrendingUp size={20} />
                                    <span>Total Income</span>
                                </div>
                                <div className="stat-value">{formatCurrency(stats.totalIncome)}</div>
                            </div>

                            <div className={`stat-card ${stats.balance >= 0 ? 'positive' : 'negative'}`}>
                                <div className="stat-header">
                                    <Wallet size={20} />
                                    <span>Balance</span>
                                </div>
                                <div className="stat-value">{formatCurrency(stats.balance)}</div>
                                <div className="stat-meta">
                                    {((stats.totalExpenses / stats.totalIncome) * 100).toFixed(0)}% spent
                                </div>
                            </div>
                        </>
                    )}
                </section>

                {/* Charts Section */}
                <section className={`charts-section ${activeTab !== 'overview' ? 'hide-mobile' : ''}`}>
                    {/* Category Breakdown */}
                    <div className="chart-card">
                        <h3 className="chart-title">
                            <PieChart size={18} /> Spending by Category
                        </h3>
                        <div className="chart-content">
                            {Object.keys(stats.categoryBreakdown).length > 0 ? (
                                <>
                                    <div className="donut-container">
                                        <Doughnut data={categoryData} options={chartOptions} />
                                        <div className="donut-center">
                                            <span className="donut-total">{formatCurrency(stats.totalExpenses)}</span>
                                            <span className="donut-label">Total</span>
                                        </div>
                                    </div>
                                    <div className="category-legend">
                                        {stats.topCategories.map((cat, i) => (
                                            <div key={i} className="legend-item">
                                                <span className="legend-dot" style={{ background: getCategoryColor(cat.name) }}></span>
                                                <span className="legend-icon">{getCategoryIcon(cat.name)}</span>
                                                <span className="legend-name">{cat.name}</span>
                                                <span className="legend-value">{formatCurrency(cat.amount)}</span>
                                                <span className="legend-percent">{cat.percentage}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="empty-chart">
                                    <p>No expenses yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Spending Trend */}
                    <div className="chart-card">
                        <h3 className="chart-title">
                            <BarChart3 size={18} /> Daily Spending Trend
                        </h3>
                        <div className="chart-content trend-chart">
                            {stats.dailySpending.length > 0 ? (
                                <Line data={trendData} options={trendOptions} />
                            ) : (
                                <div className="empty-chart">
                                    <p>Add expenses to see trend</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Categories Bar */}
                    <div className="chart-card full-width">
                        <h3 className="chart-title">
                            <BarChart3 size={18} /> Top Spending Categories
                        </h3>
                        <div className="chart-content bar-chart">
                            {stats.topCategories.length > 0 ? (
                                <Bar data={barData} options={barOptions} />
                            ) : (
                                <div className="empty-chart">
                                    <p>No data yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Transactions Section */}
                <section className={`transactions-section ${activeTab !== 'transactions' ? 'hide-mobile' : ''}`}>
                    <div className="section-header">
                        <h3><Calendar size={18} /> Recent Transactions</h3>
                        {stats.recentTransactions.length > 5 && (
                            <button className="btn-text" onClick={() => setShowAllTransactions(!showAllTransactions)}>
                                {showAllTransactions ? 'Show Less' : 'Show All'}
                                {showAllTransactions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        )}
                    </div>

                    {displayedTransactions.length > 0 ? (
                        <div className="transactions-list">
                            {displayedTransactions.map((item, idx) => {
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
                                                        placeholder="Item name"
                                                    />
                                                    <input
                                                        type="number"
                                                        value={editValues.amount}
                                                        onChange={(e) => setEditValues({ ...editValues, amount: parseFloat(e.target.value) })}
                                                        className="edit-input amount"
                                                        placeholder="Amount"
                                                    />
                                                </div>
                                                <div className="edit-actions">
                                                    <button className="btn-icon save" onClick={() => saveEdit(originalIndex)}><Check size={16} /></button>
                                                    <button className="btn-icon cancel" onClick={cancelEdit}><X size={16} /></button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="transaction-icon" style={{ background: getCategoryColor(item.category) }}>
                                                    {getCategoryIcon(item.category)}
                                                </div>
                                                <div className="transaction-info">
                                                    <span className="transaction-name">{item.item}</span>
                                                    <span className="transaction-meta">
                                                        {item.category} {item.subcategory && `› ${item.subcategory}`} • {item.date}
                                                    </span>
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
                            })}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>No transactions yet. Tap + to add your first expense!</p>
                        </div>
                    )}
                </section>
            </main>

            {/* Floating Add Button */}
            <button className="fab" onClick={toggleAddModal}>
                <Plus size={24} />
            </button>

            {/* Modals */}
            {isAddModalOpen && <AddExpenseModal onClose={toggleAddModal} />}
            {isHelpModalOpen && <HelpModal onClose={toggleHelpModal} />}
        </div>
    );
};

export default Dashboard;
