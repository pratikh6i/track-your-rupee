import { useEffect } from 'react';
import {
    Wallet, LogOut, RefreshCw, Zap, HelpCircle,
    TrendingDown, TrendingUp, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import useGoogleSheets from '../hooks/useGoogleSheets';
import AIQuickAdd from './AIQuickAdd';
import GravityMeter from './GravityMeter';
import InsightCards from './InsightCards';
import HelpModal from './HelpModal';
import './Dashboard.css';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler);

const Dashboard = () => {
    const { user, logout } = useGoogleAuth();
    const {
        sheetData, isLoading, getStats,
        isAIModalOpen, toggleAIModal,
        isHelpModalOpen, toggleHelpModal
    } = useStore();
    const { refreshData } = useGoogleSheets();
    const stats = getStats();

    useEffect(() => {
        refreshData();
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Category chart data
    const categoryColors = [
        '#2962FF', '#00C853', '#FF6D00', '#AA00FF',
        '#00B8D4', '#FFD600', '#FF1744', '#64DD17'
    ];

    const categoryData = {
        labels: Object.keys(stats.categoryBreakdown),
        datasets: [{
            data: Object.values(stats.categoryBreakdown),
            backgroundColor: categoryColors.slice(0, Object.keys(stats.categoryBreakdown).length),
            borderWidth: 0,
            hoverOffset: 10,
        }]
    };

    const categoryOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    font: { family: 'Inter', size: 12 }
                }
            }
        }
    };

    // Velocity chart data
    const velocityData = {
        labels: stats.dailySpending.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        }),
        datasets: [{
            label: 'Daily Spending',
            data: stats.dailySpending.map(d => d.amount),
            fill: true,
            backgroundColor: 'rgba(41, 98, 255, 0.1)',
            borderColor: '#2962FF',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#2962FF',
        }]
    };

    const velocityOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { font: { family: 'Inter', size: 11 }, color: '#6E6E73' }
            },
            y: {
                grid: { color: 'rgba(0,0,0,0.04)' },
                ticks: {
                    font: { family: 'Inter', size: 11 },
                    color: '#6E6E73',
                    callback: (value) => '₹' + value.toLocaleString()
                }
            }
        }
    };

    return (
        <div className="dashboard">
            {/* Header */}
            <header className="dashboard-header glass-card-static">
                <div className="header-left">
                    <div className="logo-mini">
                        <Wallet size={24} />
                    </div>
                    <span className="logo-text-mini">Track your Rupee</span>
                </div>

                <div className="header-right">
                    <button className="btn btn-secondary" onClick={toggleHelpModal}>
                        <HelpCircle size={18} />
                        <span className="hide-mobile">AI Prompts</span>
                    </button>
                    <button className="btn btn-primary" onClick={toggleAIModal}>
                        <Zap size={18} />
                        <span className="hide-mobile">Quick-Add</span>
                    </button>
                    <button className="btn-icon-ghost" onClick={refreshData} disabled={isLoading}>
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <div className="user-menu">
                        {user?.picture && <img src={user.picture} alt={user.name} className="user-avatar" />}
                        <button className="btn-icon-ghost" onClick={logout}>
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="dashboard-main container">
                {/* Welcome Section */}
                <section className="welcome-section animate-slideDown">
                    <h1>Welcome back, {user?.name?.split(' ')[0]}! 👋</h1>
                    <p className="welcome-subtitle">{stats.message.text}</p>
                </section>

                {/* Stats Cards */}
                <section className="stats-grid">
                    <div className="stat-card glass-card animate-slideUp stagger-1">
                        <div className="stat-icon income">
                            <TrendingUp size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Total Income</span>
                            <span className="stat-value text-green">{formatCurrency(stats.totalIncome)}</span>
                        </div>
                        <ArrowUpRight className="stat-arrow text-green" size={20} />
                    </div>

                    <div className="stat-card glass-card animate-slideUp stagger-2">
                        <div className="stat-icon expense">
                            <TrendingDown size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Total Expenses</span>
                            <span className="stat-value text-red">{formatCurrency(stats.totalExpenses)}</span>
                        </div>
                        <ArrowDownRight className="stat-arrow text-red" size={20} />
                    </div>

                    <div className="stat-card glass-card animate-slideUp stagger-3">
                        <div className="stat-icon balance">
                            <Wallet size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Balance</span>
                            <span className={`stat-value ${stats.balance >= 0 ? 'text-green' : 'text-red'}`}>
                                {formatCurrency(stats.balance)}
                            </span>
                        </div>
                    </div>
                </section>

                {/* Spending Meter */}
                <GravityMeter income={stats.totalIncome} expenses={stats.totalExpenses} />

                {/* Charts Section */}
                <section className="charts-grid">
                    <div className="chart-card glass-card-static animate-slideUp stagger-4">
                        <h3 className="chart-title">Spending by Category</h3>
                        <div className="chart-container donut-chart">
                            {Object.keys(stats.categoryBreakdown).length > 0 ? (
                                <Doughnut data={categoryData} options={categoryOptions} />
                            ) : (
                                <div className="empty-chart">
                                    <p>No expenses yet. Start tracking!</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="chart-card glass-card-static animate-slideUp stagger-5">
                        <h3 className="chart-title">Spending Trend</h3>
                        <div className="chart-container line-chart">
                            {stats.dailySpending.length > 0 ? (
                                <Line data={velocityData} options={velocityOptions} />
                            ) : (
                                <div className="empty-chart">
                                    <p>Add some expenses to see your spending trend.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Insight Cards */}
                <InsightCards stats={stats} />

                {/* Recent Transactions */}
                <section className="transactions-section glass-card-static animate-slideUp">
                    <h3 className="section-title">Recent Transactions</h3>
                    {sheetData.length > 0 ? (
                        <div className="transactions-list">
                            {sheetData.slice(-10).reverse().map((item, index) => (
                                <div key={index} className="transaction-item">
                                    <div className="transaction-info">
                                        <span className="transaction-name">{item.item}</span>
                                        <span className="transaction-category">{item.category}</span>
                                    </div>
                                    <div className="transaction-details">
                                        <span className={`transaction-amount ${item.category === 'Income' ? 'income' : 'expense'}`}>
                                            {item.category === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(item.amount))}
                                        </span>
                                        <span className="transaction-date">{item.date}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>No transactions yet. Use the Quick-Add button to add your first expense!</p>
                        </div>
                    )}
                </section>
            </main>

            {/* Modals */}
            {isAIModalOpen && <AIQuickAdd onClose={toggleAIModal} />}
            {isHelpModalOpen && <HelpModal onClose={toggleHelpModal} />}
        </div>
    );
};

export default Dashboard;
