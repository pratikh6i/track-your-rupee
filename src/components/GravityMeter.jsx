import { useEffect, useRef } from 'react';
import './GravityMeter.css';

const GravityMeter = ({ income, expenses }) => {
    const barRef = useRef(null);
    const ratio = income > 0 ? Math.min((expenses / income) * 100, 100) : 0;

    // Determine the status
    const getStatus = () => {
        if (ratio > 90) return { label: 'CRITICAL', color: 'var(--reentry-red)', emoji: '🚨' };
        if (ratio > 70) return { label: 'HIGH', color: '#FF6D00', emoji: '⚠️' };
        if (ratio > 50) return { label: 'BALANCED', color: '#FFD600', emoji: '⚖️' };
        if (ratio > 30) return { label: 'LOW', color: 'var(--liftoff-green)', emoji: '💪' };
        return { label: 'EXCELLENT', color: 'var(--liftoff-green)', emoji: '✨' };
    };

    const status = getStatus();

    useEffect(() => {
        if (barRef.current) {
            setTimeout(() => {
                barRef.current.style.width = `${ratio}%`;
            }, 100);
        }
    }, [ratio]);

    return (
        <div className="gravity-meter glass-card-static animate-slideUp">
            <div className="meter-header">
                <h3 className="meter-title">
                    <span className="meter-emoji">{status.emoji}</span>
                    Spending Meter
                </h3>
                <span className="meter-status" style={{ color: status.color }}>
                    {status.label}
                </span>
            </div>

            <div className="meter-bar-container">
                <div className="meter-bar-bg">
                    <div
                        ref={barRef}
                        className="meter-bar-fill"
                        style={{
                            background: `linear-gradient(90deg, var(--liftoff-green) 0%, ${status.color} 100%)`,
                            width: 0
                        }}
                    />
                </div>
                <div className="meter-labels">
                    <span>0%</span>
                    <span className="meter-percentage">{ratio.toFixed(1)}% of income spent</span>
                    <span>100%</span>
                </div>
            </div>

            <div className="meter-legend">
                <div className="legend-item">
                    <span className="legend-dot" style={{ background: 'var(--liftoff-green)' }}></span>
                    <span>Excellent (&lt;30%)</span>
                </div>
                <div className="legend-item">
                    <span className="legend-dot" style={{ background: '#FFD600' }}></span>
                    <span>Balanced (30-50%)</span>
                </div>
                <div className="legend-item">
                    <span className="legend-dot" style={{ background: '#FF6D00' }}></span>
                    <span>High (50-70%)</span>
                </div>
                <div className="legend-item">
                    <span className="legend-dot" style={{ background: 'var(--reentry-red)' }}></span>
                    <span>Critical (&gt;70%)</span>
                </div>
            </div>
        </div>
    );
};

export default GravityMeter;
