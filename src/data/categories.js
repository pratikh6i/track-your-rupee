// Category definitions with subcategories for Track your Rupee
// Using vibrant, maximally-distinct colors for better visualization

// Full-spectrum color palette - 20 highly distinct colors
// Optimized for human eye distinction using Golden Angle (137.5°) distribution
const DISTINCT_COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F97316', // Orange
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#F59E0B', // Amber
    '#6366F1', // Indigo
    '#EF4444', // Red
    '#22C55E', // Green
    '#A855F7', // Purple
    '#06B6D4', // Cyan
    '#F43F5E', // Rose
    '#84CC16', // Lime
    '#0EA5E9', // Sky
    '#D946EF', // Fuchsia
    '#FB923C', // Light Orange
    '#2DD4BF', // Light Teal
    '#A3E635', // Yellow Green
    '#818CF8', // Light Indigo
];

export const CATEGORIES = {
    Food: {
        color: '#F97316', // Orange
        icon: '🍽️',
        subcategories: [
            'Lunch', 'Dinner', 'Breakfast', 'Fruits', 'Milk',
            'Dates', 'Cashew', 'Almond', 'Snacks', 'Beverages',
            'Coffee', 'Tea', 'Groceries', 'Vegetables', 'Rice/Wheat', 'Other Food'
        ]
    },
    'Transportation': {
        color: '#06B6D4', // Cyan
        icon: '🚗',
        subcategories: ['Petrol', 'Auto', 'Cab', 'Bus', 'Train', 'Metro', 'Parking', 'Toll']
    },
    'Essentials': {
        color: '#3B82F6', // Blue
        icon: '🧴',
        subcategories: ['Toiletries', 'Medicine', 'Haircut', 'Laundry', 'Personal Care', 'Stationery', 'Household', 'Other']
    },
    'Telecommunications': {
        color: '#8B5CF6', // Violet
        icon: '📱',
        subcategories: ['Mobile Recharge', 'Internet', 'DTH', 'Subscriptions']
    },
    'Family': {
        color: '#EC4899', // Pink
        icon: '👨‍👩‍👧',
        subcategories: ['Parents', 'Siblings', 'Kids', 'Relatives', 'Other']
    },
    'Gifts & Donations': {
        color: '#F59E0B', // Amber
        icon: '🎁',
        subcategories: ['Birthday', 'Wedding', 'Charity', 'Religious', 'Other']
    },
    'Travel': {
        color: '#22C55E', // Green
        icon: '✈️',
        subcategories: ['Travel', 'Hotel', 'Entry Tickets', 'Activities', 'Food on Trip']
    },
    'Health': {
        color: '#EF4444', // Red
        icon: '🏥',
        subcategories: ['Doctor', 'Medicine', 'Tests', 'Insurance', 'Healthcare', 'Other']
    },
    'Entertainment': {
        color: '#A855F7', // Purple
        icon: '🎬',
        subcategories: ['Movies', 'OTT', 'Games', 'Events', 'Other']
    },
    'Shopping': {
        color: '#F43F5E', // Rose
        icon: '🛍️',
        subcategories: ['Clothes', 'Electronics', 'Home', 'Books', 'Other']
    },
    'Bills & Utilities': {
        color: '#14B8A6', // Teal
        icon: '💡',
        subcategories: ['Electricity', 'Water', 'Gas', 'Rent', 'Maintenance']
    },
    'Income': {
        color: '#10B981', // Emerald
        icon: '💰',
        subcategories: ['Salary', 'Freelance', 'Investment', 'Refund', 'Other']
    }
};

// Track dynamically assigned colors for unknown categories
const dynamicColorAssignments = new Map();
let nextColorIndex = Object.keys(CATEGORIES).length;

/**
 * Generate a unique, high-contrast color for a new category
 * Uses Golden Angle distribution to maximize visual distinction
 * @param {string} category - Category name
 * @returns {string} - Hex color code
 */
const getNextDistinctColor = (category) => {
    // Check if we've already assigned a color to this category
    if (dynamicColorAssignments.has(category)) {
        return dynamicColorAssignments.get(category);
    }

    // Pick from pre-defined distinct colors if available
    if (nextColorIndex < DISTINCT_COLORS.length) {
        const color = DISTINCT_COLORS[nextColorIndex];
        dynamicColorAssignments.set(category, color);
        nextColorIndex++;
        return color;
    }

    // If we've exhausted the palette, generate using Golden Angle (137.5°)
    // This ensures maximum visual separation between consecutive colors
    const goldenAngle = 137.5;
    const hue = (nextColorIndex * goldenAngle) % 360;

    // Keep saturation high (70%) and lightness good for white bg (50%)
    const color = `hsl(${Math.round(hue)}, 70%, 50%)`;
    dynamicColorAssignments.set(category, color);
    nextColorIndex++;

    return color;
};

// Flatten subcategories map for quick lookup
const subCategoryMap = {};
Object.entries(CATEGORIES).forEach(([catName, data]) => {
    data.subcategories.forEach(sub => {
        subCategoryMap[sub.toLowerCase()] = data.color;
    });
});

// Get all category names
export const getCategoryNames = () => Object.keys(CATEGORIES);

// Get subcategories for a category
export const getSubcategories = (category) => CATEGORIES[category]?.subcategories || [];

// Get category color with smart fallback
export const getCategoryColor = (category) => {
    if (!category) return '#94A3B8'; // Slate 400 for null/undefined

    // 1. Direct match
    if (CATEGORIES[category]) return CATEGORIES[category].color;

    // 2. Case-insensitive category match
    const lowerCat = category.toLowerCase().trim();
    for (const [catName, data] of Object.entries(CATEGORIES)) {
        if (catName.toLowerCase() === lowerCat) return data.color;
    }

    // 3. Subcategory match
    if (subCategoryMap[lowerCat]) return subCategoryMap[lowerCat];

    // 4. Known mappings (normalize common terms)
    if (lowerCat.includes('food') || lowerCat.includes('grocery')) return CATEGORIES.Food.color;
    if (lowerCat.includes('health') || lowerCat.includes('medical')) return CATEGORIES.Health.color;
    if (lowerCat.includes('travel') || lowerCat.includes('trip')) return CATEGORIES.Travel.color;
    if (lowerCat.includes('bill') || lowerCat.includes('utility')) return CATEGORIES['Bills & Utilities'].color;
    if (lowerCat.includes('essential')) return CATEGORIES.Essentials.color;
    if (lowerCat.includes('transport') || lowerCat.includes('fuel')) return CATEGORIES.Transportation.color;
    if (lowerCat.includes('shop') || lowerCat.includes('cloth')) return CATEGORIES.Shopping.color;

    // 5. Dynamic fallback: Assign a new distinct color
    return getNextDistinctColor(category);
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
    if (lower.includes('transport') || lower.includes('fuel')) return '🚗';
    return '📁';
};

// Get all colors for charts
export const getCategoryColors = () => Object.values(CATEGORIES).map(c => c.color);

export default CATEGORIES;
