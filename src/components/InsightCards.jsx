import { useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Sparkles, Percent } from 'lucide-react';
import './InsightCards.css';

const InsightCards = ({ stats }) => {
    const insights = useMemo(() => {
        const cards = [];
        const { categoryBreakdown, totalExpenses, totalIncome, balance } = stats;

        // Find top spending category
        if (Object.keys(categoryBreakdown).length > 0) {
            const sortedCategories = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);
            const [topCategory, topAmount] = sortedCategories[0];
            const percentage = ((topAmount / totalExpenses) * 100).toFixed(0);

            cards.push({
                id: 'top-category',
                icon: <TrendingUp />,
                color: 'blue',
                title: 'Top Spending',
                message: `${topCategory} is your biggest spend at ₹${topAmount.toLocaleString('en-IN')}`,
                detail: `${percentage}% of total expenses`
            });
        }

        // Savings insight
        if (totalIncome > 0) {
            const savingsRate = ((balance / totalIncome) * 100).toFixed(0);
            if (savingsRate > 20) {
                cards.push({
                    id: 'savings',
                    icon: <Sparkles />,
                    color: 'green',
                    title: 'Great Savings!',
                    message: `You're saving ${savingsRate}% of your income`,
                    detail: 'Keep up the anti-gravity momentum!'
                });
            } else if (savingsRate > 0) {
                cards.push({
                    id: 'savings',
                    icon: <Percent />,
                    color: 'yellow',
                    title: 'Moderate Savings',
                    message: `You're saving ${savingsRate}% of your income`,
                    detail: 'Try to aim for 20%+ for financial stability'
                });
            } else {
                cards.push({
                    id: 'overspend',
                    icon: <AlertTriangle />,
                    color: 'red',
                    title: 'Over Budget',
                    message: 'You\'ve spent more than you earned!',
                    detail: 'Time to check some expenses'
                });
            }
        }

        // Transaction frequency
        if (stats.dailySpending.length > 5) {
            const avgDaily = totalExpenses / stats.dailySpending.length;
            cards.push({
                id: 'velocity',
                icon: <TrendingDown />,
                color: 'purple',
                title: 'Daily Average',
                message: `You spend ₹${Math.round(avgDaily).toLocaleString('en-IN')} per day`,
                detail: `Based on ${stats.dailySpending.length} days of data`
            });
        }

        return cards;
    }, [stats]);

    if (insights.length === 0) return null;

    return (
        <section className="insight-cards-section">
            <h3 className="section-title">Insights</h3>
            <div className="insight-cards-grid">
                {insights.map((insight, index) => (
                    <div
                        key={insight.id}
                        className={`insight-card glass-card animate-slideUp stagger-${index + 1}`}
                    >
                        <div className={`insight-icon ${insight.color}`}>
                            {insight.icon}
                        </div>
                        <div className="insight-content">
                            <span className="insight-title">{insight.title}</span>
                            <p className="insight-message">{insight.message}</p>
                            <span className="insight-detail">{insight.detail}</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default InsightCards;
