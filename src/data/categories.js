// Category definitions with subcategories for Track your Rupee

export const CATEGORIES = {
    Food: {
        color: '#FF6B35',
        icon: '🍽️',
        subcategories: [
            'Lunch',
            'Dinner',
            'Breakfast',
            'Fruits',
            'Milk',
            'Dates',
            'Cashew',
            'Almond',
            'Snacks',
            'Beverages',
            'Coffee',
            'Tea',
            'Groceries',
            'Vegetables',
            'Rice/Wheat',
            'Other Food'
        ]
    },
    'Transportation': {
        color: '#4ECDC4',
        icon: '🚗',
        subcategories: ['Petrol', 'Auto', 'Cab', 'Bus', 'Train', 'Metro', 'Parking', 'Toll']
    },
    'Essentials/Personal Care': {
        color: '#45B7D1',
        icon: '🧴',
        subcategories: ['Toiletries', 'Medicine', 'Haircut', 'Laundry', 'Other']
    },
    'Telecommunications': {
        color: '#96CEB4',
        icon: '📱',
        subcategories: ['Mobile Recharge', 'Internet', 'DTH', 'Subscriptions']
    },
    'Family Spent': {
        color: '#DDA0DD',
        icon: '👨‍👩‍👧',
        subcategories: ['Parents', 'Siblings', 'Kids', 'Relatives', 'Other']
    },
    'Gifts/Donations': {
        color: '#FFD93D',
        icon: '🎁',
        subcategories: ['Birthday', 'Wedding', 'Charity', 'Religious', 'Other']
    },
    'Trip/Entry Fees': {
        color: '#6BCB77',
        icon: '✈️',
        subcategories: ['Travel', 'Hotel', 'Entry Tickets', 'Activities', 'Food on Trip']
    },
    'Medical': {
        color: '#FF6B6B',
        icon: '🏥',
        subcategories: ['Doctor', 'Medicine', 'Tests', 'Insurance', 'Other']
    },
    'BRIBE': {
        color: '#C0C0C0',
        icon: '💸',
        subcategories: []
    },
    'Entertainment': {
        color: '#A855F7',
        icon: '🎬',
        subcategories: ['Movies', 'OTT', 'Games', 'Events', 'Other']
    },
    'Shopping': {
        color: '#EC4899',
        icon: '🛍️',
        subcategories: ['Clothes', 'Electronics', 'Home', 'Books', 'Other']
    },
    'Bills & Utilities': {
        color: '#F59E0B',
        icon: '💡',
        subcategories: ['Electricity', 'Water', 'Gas', 'Rent', 'Maintenance']
    },
    'Income': {
        color: '#10B981',
        icon: '💰',
        subcategories: ['Salary', 'Freelance', 'Investment', 'Refund', 'Other']
    }
};

// Get all category names
export const getCategoryNames = () => Object.keys(CATEGORIES);

// Get subcategories for a category
export const getSubcategories = (category) => CATEGORIES[category]?.subcategories || [];

// Get category color
export const getCategoryColor = (category) => CATEGORIES[category]?.color || '#6B7280';

// Get category icon
export const getCategoryIcon = (category) => CATEGORIES[category]?.icon || '📦';

// Get all colors for charts
export const getCategoryColors = () => Object.values(CATEGORIES).map(c => c.color);

export default CATEGORIES;
