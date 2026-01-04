import { useState, useRef, useEffect } from 'react';
import { User, Settings, Download, HelpCircle, LogOut, ChevronDown } from 'lucide-react';
import { useGoogleAuth } from './GoogleAuthProvider';
import useStore from '../store/useStore';
import './ProfileMenu.css';

const ProfileMenu = ({ onOpenSettings, onOpenHelp }) => {
    const { user, logout } = useGoogleAuth();
    const { sheetData } = useStore();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleExportCSV = () => {
        if (!sheetData || sheetData.length === 0) {
            alert('No data to export');
            return;
        }

        const headers = ['Date', 'Item', 'Category', 'Subcategory', 'Amount', 'Payment Method', 'Notes', 'Month'];
        const csvContent = [
            headers.join(','),
            ...sheetData.map(row =>
                [row.date, row.item, row.category, row.subcategory, row.amount, row.paymentMethod, row.notes, row.month]
                    .map(val => `"${String(val || '').replace(/"/g, '""')}"`)
                    .join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `track-your-rupee-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        setIsOpen(false);
    };

    const getInitials = () => {
        if (!user?.name) return '?';
        return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className="profile-menu" ref={menuRef}>
            <button className="profile-trigger" onClick={() => setIsOpen(!isOpen)}>
                {user?.picture ? (
                    <img src={user.picture} alt="" className="profile-avatar" referrerPolicy="no-referrer" />
                ) : (
                    <div className="profile-initials">{getInitials()}</div>
                )}
                <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
            </button>

            {isOpen && (
                <div className="profile-dropdown">
                    <div className="profile-header">
                        {user?.picture ? (
                            <img src={user.picture} alt="" className="profile-avatar-lg" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="profile-initials-lg">{getInitials()}</div>
                        )}
                        <div className="profile-info">
                            <span className="profile-name">{user?.name || 'User'}</span>
                            <span className="profile-email">{user?.email || ''}</span>
                        </div>
                    </div>

                    <div className="menu-divider"></div>

                    <button className="menu-item" onClick={() => { onOpenSettings?.(); setIsOpen(false); }}>
                        <Settings size={18} />
                        <span>Settings</span>
                    </button>

                    <button className="menu-item" onClick={handleExportCSV}>
                        <Download size={18} />
                        <span>Export Data (CSV)</span>
                    </button>

                    <button className="menu-item" onClick={() => { onOpenHelp?.(); setIsOpen(false); }}>
                        <HelpCircle size={18} />
                        <span>Help & Tips</span>
                    </button>

                    <div className="menu-divider"></div>

                    <button className="menu-item logout" onClick={logout}>
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfileMenu;
