import { useState, useMemo } from 'react';
import useStore from '../store/useStore';
import { useGoogleAuth } from './GoogleAuthProvider';
import './Dashboard.css';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    BarChart, Bar
} from 'recharts';
import {
    Plus, RefreshCw, TrendingUp, TrendingDown, FileSpreadsheet,
    Link as LinkIcon, XCircle, Target, LogOut, Camera, User, Sparkles, Mic
} from 'lucide-react';
import AddExpenseModal from './AddExpenseModal';
import AIQuickAdd from './AIQuickAdd';
import HelpModal from './HelpModal';
import SheetPickerModal from './SheetPickerModal';
import SettingsModal from './SettingsModal';
import ProfileModal from './ProfileModal';
import BillScanner from './BillScanner';
import VoiceScanner from './VoiceScanner';
import { getCategoryColor, getCategoryIcon } from '../data/categories';
import Skeleton from './Skeleton';

const Dashboard = () => {
    const { sheetData, needsSheet, budget, user, monthlySalary, otherGains, currentBalance } = useStore();
    const { logout, refreshData, createSheet, validateAndSetSheet, isLoading } = useGoogleAuth();

    // UI State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAIOpen, setIsAIOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSheetPickerOpen, setIsSheetPickerOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isVoiceScannerOpen, setIsVoiceScannerOpen] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    // Link Input State
    const [sheetLinkInput, setSheetLinkInput] = useState('');
    const [linkError, setLinkError] = useState(null);
    const [isValidatingLink, setIsValidatingLink] = useState(false);

    // --- Logic ---

    const handleLinkSubmit = async (e) => {
        e.preventDefault();
        setLinkError(null);

        const match = sheetLinkInput.match(/\/d\/([a-zA-Z0-9-_]+)/);
        const extractedId = match ? match[1] : sheetLinkInput;

        if (!extractedId || extractedId.length < 10) {
            setLinkError('Invalid Google Sheet Link');
            return;
        }

        setIsValidatingLink(true);
        const result = await validateAndSetSheet(extractedId);
        setIsValidatingLink(false);

        if (!result.success) {
            setLinkError(result.error);
        }
    };

    const stats = useMemo(() => {
        // Get current month
        const now = new Date();
        const currentMonth = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

        // Total Expenses this month (excluding Income category)
        const totalExpenses = sheetData
            .filter(item => item.category !== 'Income' && item.month === currentMonth)
            .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        // Income = Monthly Salary + Other Gains (from Profile, default 0)
        const income = (monthlySalary || 0) + (otherGains || 0);

        // Opening Balance = User's account balance at start of month
        const openingBalance = currentBalance || 0;

        // Closing Balance = Opening Balance - Total Expenses
        const closingBalance = openingBalance - totalExpenses;

        // Savings = Budget - Spent (how much from budget is saved)
        const savings = (budget || 0) - totalExpenses;

        return {
            income,
            totalExpenses,
            openingBalance,
            closingBalance,
            savings,
            spent: totalExpenses
        };
    }, [sheetData, monthlySalary, otherGains, currentBalance, budget]);

    // Calculate current month's expenses for budget
    const currentMonthExpense = useMemo(() => {
        const now = new Date();
        const currentMonth = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

        return sheetData
            .filter(item => item.category !== 'Income' && item.month === currentMonth)
            .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    }, [sheetData]);

    const budgetPercentage = Math.min(Math.round((currentMonthExpense / budget) * 100), 100);
    const budgetStatus = budgetPercentage >= 90 ? 'critical' : budgetPercentage >= 70 ? 'warning' : 'good';

    const categoryData = useMemo(() => {
        const expenses = sheetData.filter(item => item.category !== 'Income');
        const grouped = expenses.reduce((acc, item) => {
            const cat = item.category || 'Uncategorized';
            acc[cat] = (acc[cat] || 0) + (parseFloat(item.amount) || 0);
            return acc;
        }, {});

        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [sheetData]);

    const dailyTrendData = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const today = now.getDate();

        // Create array for all days from 1st to today
        const allDays = [];
        for (let day = 1; day <= today; day++) {
            const date = new Date(currentYear, currentMonth, day);
            allDays.push({
                date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                fullDate: date.toISOString().split('T')[0],
                amount: 0
            });
        }

        // Sum expenses by date
        sheetData
            .filter(item => item.category !== 'Income')
            .forEach(item => {
                if (!item.date) return;
                const itemDate = new Date(item.date);
                if (itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear) {
                    const dayIndex = itemDate.getDate() - 1;
                    if (allDays[dayIndex]) {
                        allDays[dayIndex].amount += parseFloat(item.amount) || 0;
                    }
                }
            });

        return allDays;
    }, [sheetData]);

    const filteredTransactions = useMemo(() => {
        if (!selectedCategory) return sheetData;
        return sheetData.filter(t => t.category === selectedCategory);
    }, [sheetData, selectedCategory]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    // --- Render: No Sheet Prompt ---
    if (needsSheet) {
        return (
            <div className="dashboard">
                <header className="header">
                    <div className="header-left">
                        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="logo-icon" />
                        <span className="logo-text">Track your Rupee</span>
                    </div>
                    <div className="header-right">
                        {user?.picture && (
                            <img src={user.picture} alt="" className="user-avatar" referrerPolicy="no-referrer" />
                        )}
                        <button className="btn-icon logout" onClick={logout} title="Sign out">
                            <LogOut size={18} />
                        </button>
                    </div>
                </header>

                <main className="no-sheet-container">
                    <div className="empty-state">
                        <div className="empty-icon">
                            <FileSpreadsheet size={48} />
                        </div>
                        <h2>No Expense Sheet Found</h2>
                        <p>Create a new Google Sheet to start tracking your expenses.</p>

                        <button className="btn-create" onClick={createSheet} disabled={isLoading}>
                            {isLoading ? 'Creating...' : 'Create New Sheet'}
                        </button>

                        <div className="or-divider">
                            <span>or</span>
                        </div>

                        <div className="alt-options">
                            <button className="btn-outline" onClick={() => setIsSheetPickerOpen(true)} disabled={isLoading}>
                                <FileSpreadsheet size={16} />
                                Browse Existing Sheets
                            </button>

                            <form onSubmit={handleLinkSubmit} className="link-form">
                                <div className="link-input-group">
                                    <LinkIcon size={16} className="link-icon" />
                                    <input
                                        type="text"
                                        placeholder="Paste Sheet Link..."
                                        value={sheetLinkInput}
                                        onChange={(e) => setSheetLinkInput(e.target.value)}
                                        disabled={isValidatingLink}
                                    />
                                </div>
                                <button type="submit" className="btn-link" disabled={!sheetLinkInput || isValidatingLink}>
                                    {isValidatingLink ? '...' : 'Link'}
                                </button>
                            </form>
                            {linkError && <p className="error-msg">{linkError}</p>}
                        </div>
                    </div>
                </main>

                {isSheetPickerOpen && <SheetPickerModal onClose={() => setIsSheetPickerOpen(false)} />}
            </div>
        );
    }

    // --- Render: Main Dashboard ---
    return (
        <div className="dashboard">
            <header className="header">
                <div className="header-left">
                    <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="logo-icon" />
                    <span className="logo-text">Dashboard</span>
                </div>
                <div className="header-right">
                    <button className="btn-quick-add" onClick={() => setIsAIOpen(true)} title="Quick Add with AI">
                        <Sparkles size={16} />
                        <span>Quick Add</span>
                    </button>
                    <button className="btn-icon" onClick={refreshData} title="Refresh Data">
                        <RefreshCw size={18} />
                    </button>
                    {user?.picture && (
                        <div className="avatar-wrapper">
                            <img
                                src={user.picture}
                                alt=""
                                className="user-avatar clickable"
                                referrerPolicy="no-referrer"
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                            />
                            {showProfileMenu && (
                                <div className="profile-dropdown">
                                    <div className="profile-info">
                                        <strong>{user.name}</strong>
                                        <span>{user.email}</span>
                                    </div>
                                    <button onClick={() => { setIsProfileOpen(true); setShowProfileMenu(false); }}>
                                        <User size={14} /> Edit Profile & Settings
                                    </button>
                                    <hr />
                                    <button onClick={logout} className="logout-btn">
                                        <LogOut size={14} /> Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    <button className="btn-icon logout" onClick={logout} title="Sign out">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main className="dashboard-main">
                {/* Stats Grid - 5 Cards */}
                <div className="stats-grid">
                    {[
                        { label: 'Opening Balance', key: 'openingBalance', color: '' },
                        { label: 'Income', key: 'income', color: '' },
                        { label: 'Spent', key: 'spent', color: '' },
                        { label: 'Savings', key: 'savings', color: '' },
                        { label: 'Closing Balance', key: 'closingBalance', color: '' }
                    ].map((stat, idx) => (
                        <div key={idx} className={`stat-card ${stat.key === 'savings' ? '' : stat.key}`}>
                            {isLoading ? (
                                <Skeleton width="80px" height="24px" className="mb-8" />
                            ) : (
                                <div className="stat-value" style={stat.key === 'savings' ? { color: stats.savings >= 0 ? '#10B981' : '#EF4444' } : {}}>
                                    {formatCurrency(stat.key === 'savings' ? Math.abs(stats.savings) : stats[stat.key])}
                                </div>
                            )}
                            <div className="stat-label">{stat.key === 'savings' && stats.savings < 0 ? 'Overspent' : stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Budget Progress */}
                <div className="budget-card">
                    <div className="budget-header">
                        <div className="budget-title">
                            <Target size={18} />
                            <span>Monthly Budget</span>
                        </div>
                        {isLoading ? (
                            <Skeleton width="120px" height="18px" />
                        ) : (
                            <span className={`budget-amount ${budgetStatus}`}>
                                {formatCurrency(currentMonthExpense)} / {formatCurrency(budget)}
                            </span>
                        )}
                    </div>
                    <div className="budget-bar">
                        {isLoading ? (
                            <Skeleton width="100%" height="8px" borderRadius="10px" />
                        ) : (
                            <div className={`budget-fill ${budgetStatus}`} style={{ width: `${budgetPercentage}%` }}></div>
                        )}
                    </div>
                    <div className="budget-footer">
                        {isLoading ? (
                            <><Skeleton width="60px" height="14px" /><Skeleton width="80px" height="14px" /></>
                        ) : (
                            <>
                                <span>{budgetPercentage}% used</span>
                                <span>{formatCurrency(budget - currentMonthExpense)} remaining</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Charts */}
                <div className="charts-grid">
                    <div className="chart-card">
                        <h3>Spending by Category</h3>
                        {selectedCategory && (
                            <button className="clear-filter" onClick={() => setSelectedCategory(null)}>
                                Clear <XCircle size={14} />
                            </button>
                        )}
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={3}
                                        dataKey="value"
                                        onClick={(d) => setSelectedCategory(selectedCategory === d.name ? null : d.name)}
                                        cursor="pointer"
                                    >
                                        {categoryData.map((entry, i) => (
                                            <Cell
                                                key={i}
                                                fill={getCategoryColor(entry.name)}
                                                opacity={selectedCategory && selectedCategory !== entry.name ? 0.3 : 1}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v) => formatCurrency(v)} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="legend">
                            {categoryData.slice(0, 5).map((cat, i) => (
                                <div key={i} className="legend-item" onClick={() => setSelectedCategory(cat.name)}>
                                    <span className="dot" style={{ background: getCategoryColor(cat.name) }}></span>
                                    <span className="name">{cat.name}</span>
                                    <span className="amt">{formatCurrency(cat.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="chart-card">
                        <h3>Daily Trend</h3>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={280}>
                                <AreaChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={(v) => formatCurrency(v)} />
                                    <Area type="monotone" dataKey="amount" stroke="#3B82F6" strokeWidth={2} fill="url(#colorAmt)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="chart-card wide">
                        <h3>Top Categories</h3>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={categoryData.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={(v) => formatCurrency(v)} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                        {categoryData.slice(0, 5).map((e, i) => (
                                            <Cell key={i} fill={getCategoryColor(e.name)} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Transactions */}
                <div className="transactions-card">
                    <div className="transactions-header">
                        <h3>Recent Transactions</h3>
                        {selectedCategory && <span className="filter-badge">{selectedCategory}</span>}
                    </div>
                    <div className="transactions-list">
                        {isLoading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="transaction-row skeleton">
                                    <Skeleton width="40px" height="40px" borderRadius="12px" />
                                    <div className="t-info" style={{ flex: 1, marginLeft: '12px' }}>
                                        <Skeleton width="40%" height="16px" className="mb-4" />
                                        <Skeleton width="30%" height="12px" />
                                    </div>
                                    <Skeleton width="60px" height="20px" />
                                </div>
                            ))
                        ) : filteredTransactions.length === 0 ? (
                            <div className="no-transactions">No transactions found</div>
                        ) : (
                            filteredTransactions.slice().reverse().slice(0, 10).map((item, i) => (
                                <div key={i} className="transaction-row">
                                    <div className="t-icon" style={{ background: `${getCategoryColor(item.category)}20`, color: getCategoryColor(item.category) }}>
                                        {getCategoryIcon(item.category)}
                                    </div>
                                    <div className="t-info">
                                        <span className="t-name">{item.item}</span>
                                        <span className="t-meta">{item.category} • {item.date}</span>
                                    </div>
                                    <span className={`t-amount ${item.category === 'Income' ? 'income' : ''}`}>
                                        {item.category === 'Income' ? '+' : '-'}{formatCurrency(item.amount)}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>

            {/* FABs */}
            <button className="fab fab-voice" onClick={() => setIsVoiceScannerOpen(true)} title="Voice Input (Marathi)">
                <Mic size={22} />
            </button>
            <button className="fab fab-scan" onClick={() => setIsScannerOpen(true)} title="Scan Bill">
                <Camera size={22} />
            </button>
            <button className="fab" onClick={() => setIsAddModalOpen(true)}>
                <Plus size={24} />
            </button>

            {/* Modals */}
            {isAddModalOpen && <AddExpenseModal onClose={() => setIsAddModalOpen(false)} />}
            {isAIOpen && <AIQuickAdd onClose={() => setIsAIOpen(false)} />}
            {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}
            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
            {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
            {isScannerOpen && <BillScanner onClose={() => setIsScannerOpen(false)} />}
            {isVoiceScannerOpen && <VoiceScanner onClose={() => setIsVoiceScannerOpen(false)} onExpensesAdded={(count) => console.log(`Added ${count} expenses via voice`)} />}
        </div>
    );
};

export default Dashboard;
