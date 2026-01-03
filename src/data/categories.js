// Category definitions with subcategories for Track your Rupee
// Using vibrant, distinct colors for better visualization

export const CATEGORIES = {
    Food: {
        color: '#FF5722', // Vibrant Orange
        icon: '🍽️',
        subcategories: [
            'Lunch', 'Dinner', 'Breakfast', 'Fruits', 'Milk',
            'Dates', 'Cashew', 'Almond', 'Snacks', 'Beverages',
            'Coffee', 'Tea', 'Groceries', 'Vegetables', 'Rice/Wheat', 'Other Food'
        ]
    },
    'Transportation': {
        color: '#00BCD4', // Cyan
        icon: '🚗',
        subcategories: ['Petrol', 'Auto', 'Cab', 'Bus', 'Train', 'Metro', 'Parking', 'Toll']
    },
    'Essentials/Personal Care': {
        color: '#2196F3', // Blue
        icon: '🧴',
        subcategories: ['Toiletries', 'Medicine', 'Haircut', 'Laundry', 'Other']
    },
    'Telecommunications': {
        color: '#9C27B0', // Purple
        icon: '📱',
        subcategories: ['Mobile Recharge', 'Internet', 'DTH', 'Subscriptions']
    },
    'Family Spent': {
        color: '#E91E63', // Pink
        icon: '👨‍👩‍👧',
        subcategories: ['Parents', 'Siblings', 'Kids', 'Relatives', 'Other']
    },
    'Gifts/Donations': {
        color: '#FFEB3B', // Yellow
        icon: '🎁',
        subcategories: ['Birthday', 'Wedding', 'Charity', 'Religious', 'Other']
    },
    'Trip/Entry Fees': {
        color: '#4CAF50', // Green
        icon: '✈️',
        subcategories: ['Travel', 'Hotel', 'Entry Tickets', 'Activities', 'Food on Trip']
    },
    'Medical': {
        color: '#F44336', // Red
        icon: '🏥',
        subcategories: ['Doctor', 'Medicine', 'Tests', 'Insurance', 'Other']
    },
    'BRIBE': {
        color: '#607D8B', // Blue Grey
        icon: '💸',
        subcategories: []
    },
    'Entertainment': {
        color: '#673AB7', // Deep Purple
        icon: '🎬',
        subcategories: ['Movies', 'OTT', 'Games', 'Events', 'Other']
    },
    'Shopping': {
        color: '#FF4081', // Pink Accent
        icon: '🛍️',
        subcategories: ['Clothes', 'Electronics', 'Home', 'Books', 'Other']
    },
    'Bills & Utilities': {
        color: '#FF9800', // Orange
        icon: '💡',
        subcategories: ['Electricity', 'Water', 'Gas', 'Rent', 'Maintenance']
    },
    'Income': {
        color: '#00E676', // Green Accent
        icon: '💰',
        subcategories: ['Salary', 'Freelance', 'Investment', 'Refund', 'Other']
    }
};

// Get all category names
export const getCategoryNames = () => Object.keys(CATEGORIES);

// Get subcategories for a category
export const getSubcategories = (category) => CATEGORIES[category]?.subcategories || [];

// Get category color
export const getCategoryColor = (category) => CATEGORIES[category]?.color || '#78909C';

// Get category icon
export const getCategoryIcon = (category) => CATEGORIES[category]?.icon || '📦';

// Get all colors for charts
export const getCategoryColors = () => Object.values(CATEGORIES).map(c => c.color);

export default CATEGORIES;
