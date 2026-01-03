// Category definitions with subcategories for Track your Rupee
// Using vibrant, distinct colors for better visualization

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
    'Essentials': {
        color: '#2196F3', // Blue
        icon: '🧴',
        subcategories: ['Toiletries', 'Medicine', 'Haircut', 'Laundry', 'Personal Care', 'Stationery', 'Household', 'Other']
    },
    'Telecommunications': {
        color: '#9C27B0', // Purple
        icon: '📱',
        subcategories: ['Mobile Recharge', 'Internet', 'DTH', 'Subscriptions']
    },
    'Family': {
        color: '#E91E63', // Pink
        icon: '👨‍👩‍👧',
        subcategories: ['Parents', 'Siblings', 'Kids', 'Relatives', 'Other']
    },
    'Gifts & Donations': {
        color: '#FFEB3B', // Yellow
        icon: '🎁',
        subcategories: ['Birthday', 'Wedding', 'Charity', 'Religious', 'Other']
    },
    'Travel': {
        color: '#4CAF50', // Green
        icon: '✈️',
        subcategories: ['Travel', 'Hotel', 'Entry Tickets', 'Activities', 'Food on Trip']
    },
    'Health': {
        color: '#F44336', // Red
        icon: '🏥',
        subcategories: ['Doctor', 'Medicine', 'Tests', 'Insurance', 'Healthcare', 'Other']
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

// Generate a consistent, vibrant color for a string
const generateColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // High saturation (65-85%), Lightness (45-60%) for visibility
    const h = Math.abs(hash % 360);
    const s = 75;
    const l = 55;
    return `hsl(${h}, ${s}%, ${l}%)`;
};

// Flatten subcategories map for quick lookup
const subCategoryMap = {};
Object.entries(CATEGORIES).forEach(([cat, data]) => {
    data.subcategories.forEach(sub => {
        subCategoryMap[sub] = data.color;
    });
});

// Get all category names
export const getCategoryNames = () => Object.keys(CATEGORIES);

// Get subcategories for a category
export const getSubcategories = (category) => CATEGORIES[category]?.subcategories || [];

// Get category color with smart fallback
export const getCategoryColor = (category) => {
    if (!category) return '#94A3B8'; // Slate 400

    // 1. Direct match
    if (CATEGORIES[category]) return CATEGORIES[category].color;

    // 2. Subcategory match
    if (subCategoryMap[category]) return subCategoryMap[category];

    // 3. Known mappings (normalize)
    const normalized = category.toLowerCase().trim();
    if (normalized.includes('food') || normalized.includes('grocery')) return CATEGORIES.Food.color;
    if (normalized.includes('health') || normalized.includes('medical')) return CATEGORIES.Health.color;
    if (normalized.includes('travel') || normalized.includes('trip')) return CATEGORIES.Travel.color;
    if (normalized.includes('bill') || normalized.includes('utility')) return CATEGORIES['Bills & Utilities'].color;
    if (normalized.includes('essential')) return CATEGORIES.Essentials.color;

    // 4. Fallback: Generate consistent vibrant color
    return generateColor(category);
};

// Get category icon
export const getCategoryIcon = (category) => {
    if (CATEGORIES[category]) return CATEGORIES[category].icon;
    // Basic heuristics for unknown categories
    const lower = category?.toLowerCase() || '';
    if (lower.includes('food') || lower.includes('eat')) return '🍽️';
    if (lower.includes('travel') || lower.includes('trip')) return '✈️';
    if (lower.includes('health') || lower.includes('med')) return '🏥';
    if (lower.includes('shop')) return '🛍️';
    if (lower.includes('bill')) return '💡';
    return '₹';
};

// Get all colors for charts
export const getCategoryColors = () => Object.values(CATEGORIES).map(c => c.color);

export default CATEGORIES;
