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
    Plus, RefreshCw, LogOut, TrendingUp, TrendingDown, LayoutDashboard,
    Link as LinkIcon, FileSpreadsheet, XCircle
} from 'lucide-react';
import AddExpenseModal from './AddExpenseModal';
import AIQuickAdd from './AIQuickAdd';
import HelpModal from './HelpModal';
import SheetPickerModal from './SheetPickerModal';
import { getCategoryColor, getCategoryIcon } from '../data/categories';

const Dashboard = () => {
    const { sheetData, needsSheet } = useStore();
    const { logout, refreshData, createSheet, validateAndSetSheet, isLoading } = useGoogleAuth();

    // UI State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAIOpen, setIsAIOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isSheetPickerOpen, setIsSheetPickerOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);

    // Link Input State
    const [sheetLinkInput, setSheetLinkInput] = useState('');
    const [linkError, setLinkError] = useState(null);
    const [isValidatingLink, setIsValidatingLink] = useState(false);

    // --- Logic ---

    // Handle manual link submission
    const handleLinkSubmit = async (e) => {
        e.preventDefault();
        setLinkError(null);

        // Extract ID from URL
        // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit...
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
        const income = sheetData
            .filter(item => item.category === 'Income')
            .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        const expense = sheetData
            .filter(item => item.category !== 'Income')
            .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        return { income, expense, balance: income - expense };
    }, [sheetData]);

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
        const expenses = sheetData.filter(item => item.category !== 'Income');
        const grouped = expenses.reduce((acc, item) => {
            const date = item.date ? new Date(item.date).toLocaleDateString('en-GB') : 'Unknown';
            acc[date] = (acc[date] || 0) + (parseFloat(item.amount) || 0);
            return acc;
        }, {});

        // Take last 14 active days
        return Object.entries(grouped)
            .map(([date, amount]) => ({ date, amount }))
            .slice(0, 14)
            .reverse();
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
            <div className="dashboard-container">
                <header className="dashboard-header glass-header">
                    <div className="logo-section">
                        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="logo-icon" />
                        <h1>Track your Rupee</h1>
                    </div>
                    <button className="btn-icon" onClick={logout}>
                        <LogOut size={20} />
                    </button>
                </header>

                <div className="no-sheet-prompt">
                    <div className="prompt-card glass-card">
                        <div className="prompt-icon">
                            <LayoutDashboard size={48} />
                        </div>
                        <h2>Let's Get Started</h2>
                        <p>We couldn't automatically find your expense sheet. Choose an option below:</p>

                        <div className="sheet-options">
                            {/* Option 1: Create New */}
                            <div className="option-block">
                                <button className="btn-primary create-btn" onClick={createSheet} disabled={isLoading}>
                                    {isLoading ? 'Creating...' : 'Create New Sheet'}
                                </button>
                                <span className="option-desc">Start fresh with a new template</span>
                            </div>

                            <div className="divider"><span>OR</span></div>

                            {/* Option 2: Browse Existing */}
                            <div className="option-block">
                                <button
                                    className="btn-secondary browse-btn"
                                    onClick={() => setIsSheetPickerOpen(true)}
                                    disabled={isLoading}
                                >
                                    <FileSpreadsheet size={18} />
                                    Browse Existing Sheets
                                </button>
                            </div>

                            {/* Option 3: Paste Link */}
                            <form onSubmit={handleLinkSubmit} className="link-form">
                                <div className="input-group">
                                    <LinkIcon size={16} className="input-icon" />
                                    <input
                                        type="text"
                                        placeholder="Paste Google Sheet Link..."
                                        value={sheetLinkInput}
                                        onChange={(e) => setSheetLinkInput(e.target.value)}
                                        className="link-input"
                                        disabled={isValidatingLink}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="btn-link-submit"
                                    disabled={!sheetLinkInput || isValidatingLink}
                                >
                                    {isValidatingLink ? 'Checking...' : 'Link'}
                                </button>
                            </form>
                            {linkError && <p className="error-text">{linkError}</p>}
                        </div>
                    </div>
                </div>

                {isSheetPickerOpen && (
                    <SheetPickerModal onClose={() => setIsSheetPickerOpen(false)} />
                )}
            </div>
        );
    }

    // --- Render: Main Dashboard ---
    return (
        <div className="dashboard-container">
            <header className="dashboard-header glass-header">
                <div className="logo-section">
                    <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="logo-icon" />
                    <h1>Dashboard</h1>
                </div>
                <div className="header-actions">
                    <button className="btn-icon" onClick={refreshData} title="Refresh Data">
                        <RefreshCw size={20} />
                    </button>
                    <button className="btn-icon" onClick={logout} title="Logout">
                        <LogOut size={20} />
                    </button>
                    <button className="btn-help" onClick={() => setIsHelpOpen(true)}>
                        AI Tips
                    </button>
                </div>
            </header>

            <main className="dashboard-content">
                {/* Stats Grid */}
                <div className="stats-grid">
                    <div className="stat-card glass-card balance">
                        <div className="stat-header">
                            <span className="stat-label">Total Balance</span>
                            <div className="trend up">
                                <TrendingUp size={16} />
                                <span>+2.5%</span>
                            </div>
                        </div>
                        <div className="stat-value">{formatCurrency(stats.balance)}</div>
                    </div>
                    <div className="stat-card glass-card income">
                        <div className="stat-header">
                            <span className="stat-label">Income</span>
                            <div className="icon-bg">
                                <TrendingUp size={20} />
                            </div>
                        </div>
                        <div className="stat-value">{formatCurrency(stats.income)}</div>
                    </div>
                    <div className="stat-card glass-card expense">
                        <div className="stat-header">
                            <span className="stat-label">Expenses</span>
                            <div className="icon-bg">
                                <TrendingDown size={20} />
                            </div>
                        </div>
                        <div className="stat-value">{formatCurrency(stats.expense)}</div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="charts-grid">
                    {/* Donut Chart - Categories */}
                    <div className="chart-card glass-card">
                        <div className="chart-header">
                            <h3>
                                <PieChart size={18} className="text-primary" style={{ display: 'inline', marginRight: 8 }} />
                                Spending by Category
                            </h3>
                            {selectedCategory && (
                                <button className="clear-filter-btn" onClick={() => setSelectedCategory(null)}>
                                    Clear Filter <XCircle size={14} />
                                </button>
                            )}
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        onClick={(data) => {
                                            setSelectedCategory(selectedCategory === data.name ? null : data.name);
                                        }}
                                        cursor="pointer"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={getCategoryColor(entry.name)}
                                                stroke="none"
                                                opacity={selectedCategory && selectedCategory !== entry.name ? 0.3 : 1}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => formatCurrency(value)}
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="chart-total">
                                        {formatCurrency(stats.expense)}
                                        <tspan x="50%" dy="20" fontSize="12" fill="#9CA3AF">TOTAL</tspan>
                                    </text>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="chart-legend">
                            {categoryData.slice(0, 4).map((cat, i) => (
                                <div
                                    key={i}
                                    className={`legend-item ${selectedCategory === cat.name ? 'active' : ''} ${selectedCategory && selectedCategory !== cat.name ? 'dimmed' : ''}`}
                                    onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                                >
                                    <span className="dot" style={{ backgroundColor: getCategoryColor(cat.name) }}></span>
                                    <span className="name">{cat.name}</span>
                                    <span className="amount">{formatCurrency(cat.value)}</span>
                                    <span className="percent">{Math.round((cat.value / stats.expense) * 100)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Area Chart - Daily Trend */}
                    <div className="chart-card glass-card">
                        <div className="chart-header">
                            <h3>
                                <TrendingUp size={18} className="text-primary" style={{ display: 'inline', marginRight: 8 }} />
                                Daily Trend
                            </h3>
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                                    <Tooltip
                                        formatter={(value) => formatCurrency(value)}
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none' }}
                                    />
                                    <Area type="monotone" dataKey="amount" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Bar Chart - Top Categories */}
                    <div className="chart-card glass-card full-width">
                        <div className="chart-header">
                            <h3>
                                <BarChart size={18} className="text-primary" style={{ display: 'inline', marginRight: 8 }} />
                                Top Categories
                            </h3>
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={categoryData.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                        {categoryData.slice(0, 5).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getCategoryColor(entry.name)} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Transactions List */}
                <div className="transactions-section glass-card">
                    <div className="section-header">
                        <h2>Recent Transactions</h2>
                        {selectedCategory && (
                            <span className="filter-badge">
                                Filtered by: <strong>{selectedCategory}</strong>
                            </span>
                        )}
                        <button className="btn-link">View All</button>
                    </div>
                    <div className="transactions-list">
                        {filteredTransactions.length === 0 ? (
                            <div className="empty-state">
                                <p>No transactions found for this selection.</p>
                            </div>
                        ) : (
                            filteredTransactions.slice().reverse().map((item, index) => (
                                <div key={index} className="transaction-item">
                                    <div className="t-icon" style={{ backgroundColor: `${getCategoryColor(item.category)}20`, color: getCategoryColor(item.category) }}>
                                        {getCategoryIcon(item.category)}
                                    </div>
                                    <div className="t-details">
                                        <div className="t-main">
                                            <span className="t-item">{item.item}</span>
                                            <span className="t-cat">{item.category}</span>
                                        </div>
                                        <div className="t-sub">
                                            <span className="t-date">{item.date}</span>
                                            {item.notes && <span className="t-notes">• {item.notes}</span>}
                                        </div>
                                    </div>
                                    <div className={`t-amount ${item.category === 'Income' ? 'positive' : ''}`}>
                                        {item.category === 'Income' ? '+' : '-'} {formatCurrency(item.amount)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>

            {/* Floating Action Button */}
            <button className="fab" onClick={() => setIsAddModalOpen(true)}>
                <Plus size={24} />
            </button>

            {/* AI Quick Add Button */}
            <button className="ai-fab" onClick={() => setIsAIOpen(true)}>
                <span className="sparkles">✨</span>
                <span className="hide-mobile">Quick Add</span>
            </button>

            <AddExpenseModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
            <AIQuickAdd isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
            <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        </div>
    );
};

export default Dashboard;
