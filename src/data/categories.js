// Category definitions with subcategories for Track your Rupee
// Using vibrant, maximally-distinct colors for better visualization

// Full-spectrum color palette - 20 highly distinct colors
// Rearranged to ensure common categories get very different colors
const DISTINCT_COLORS = [
    '#3B82F6', // Blue (Bills)
    '#10B981', // Emerald (Income)
    '#F97316', // Orange (Food)
    '#8B5CF6', // Violet (Teleco)
    '#EC4899', // Pink (Family)
    '#14B8A6', // Teal (Utilities)
    '#EAB308', // Yellow (Gifts)
    '#6366F1', // Indigo
    '#EF4444', // Red (Health)
    '#22C55E', // Green (Travel)
    '#A855F7', // Purple
    '#06B6D4', // Cyan (Transport)
    '#F43F5E', // Rose (Shopping)
    '#84CC16', // Lime
    '#0EA5E9', // Sky
    '#D946EF', // Fuchsia
    '#FB923C', // Light Orange
    '#2DD4BF', // Light Teal
    '#A3E635', // Yellow Green
    '#818CF8', // Light Indigo
];

export const CATEGORIES = {
    // Top Categories - Forced Distinct Colors
    'Bills': { color: '#3B82F6', icon: '🧾', subcategories: [] }, // Explicit short name
    'Bills & Utilities': { color: '#3B82F6', icon: '💡', subcategories: ['Electricity', 'Water', 'Gas', 'Rent', 'Maintenance'] },

    Food: { color: '#F97316', icon: '🍽️', subcategories: ['Lunch', 'Dinner', 'Breakfast', 'Groceries', 'Vegetables'] },

    Health: { color: '#EF4444', icon: '🏥', subcategories: ['Doctor', 'Medicine', 'Tests'] },

    Shopping: { color: '#8B5CF6', icon: '🛍️', subcategories: ['Clothes', 'Electronics', 'Home'] }, // Changed to Violet to separate from Red

    Transportation: { color: '#06B6D4', icon: '🚗', subcategories: ['Fuel', 'Cab', 'Bus', 'Train'] },

    Essentials: { color: '#14B8A6', icon: '🧴', subcategories: ['Toiletries', 'Personal Care'] }, // Changed to Teal

    Entertainment: { color: '#F59E0B', icon: '🎬', subcategories: ['Movies', 'Games', 'Events'] }, // Changed to Amber

    Travel: { color: '#22C55E', icon: '✈️', subcategories: ['Hotel', 'Flights', 'Food on Trip'] },

    Telecommunications: { color: '#6366F1', icon: '📱', subcategories: ['Mobile', 'Internet'] },

    Family: { color: '#EC4899', icon: '👨‍👩‍👧', subcategories: ['Kids', 'Parents'] },

    'Gifts': { color: '#D946EF', icon: '🎁', subcategories: [] }, // Explicit short name
    'Gifts & Donations': { color: '#D946EF', icon: '🎁', subcategories: ['Gift', 'Charity'] },

    Income: { color: '#10B981', icon: '💰', subcategories: ['Salary', 'Freelance'] }
};

// Track dynamically assigned colors for unknown categories
const dynamicColorAssignments = new Map();
let nextColorIndex = 0;  // Start from 0 to use all colors

/**
 * Generate a unique, high-contrast color for any category or subcategory
 * Uses Golden Angle distribution to maximize visual distinction
 * @param {string} category - Category/subcategory name
 * @returns {string} - Hex color code
 */
const getDistinctColor = (category) => {
    const key = category.toLowerCase().trim();

    // Check if we've already assigned a color to this category
    if (dynamicColorAssignments.has(key)) {
        return dynamicColorAssignments.get(key);
    }

    // Pick from pre-defined distinct colors if available
    if (nextColorIndex < DISTINCT_COLORS.length) {
        const color = DISTINCT_COLORS[nextColorIndex];
        dynamicColorAssignments.set(key, color);
        nextColorIndex++;
        return color;
    }

    // If we've exhausted the palette, generate using Golden Angle (137.5°)
    // This ensures maximum visual separation between consecutive colors
    const goldenAngle = 137.5;
    const hue = (nextColorIndex * goldenAngle) % 360;

    // Keep saturation high (70%) and lightness good for white bg (50%)
    const color = `hsl(${Math.round(hue)}, 70%, 50%)`;
    dynamicColorAssignments.set(key, color);
    nextColorIndex++;

    return color;
};

// Pre-assign colors to main categories so they're consistent
Object.entries(CATEGORIES).forEach(([catName, data]) => {
    dynamicColorAssignments.set(catName.toLowerCase(), data.color);
    nextColorIndex = Math.max(nextColorIndex, 12); // Reserve first 12 for main categories
});

// Get all category names
export const getCategoryNames = () => Object.keys(CATEGORIES);

// Get subcategories for a category
export const getSubcategories = (category) => CATEGORIES[category]?.subcategories || [];

// Get category color - EACH unique name gets its own color
export const getCategoryColor = (category) => {
    if (!category) return '#94A3B8'; // Slate 400 for null/undefined

    const key = category.toLowerCase().trim();

    // 1. Direct match to main category (use defined color)
    if (CATEGORIES[category]) return CATEGORIES[category].color;

    // 2. Case-insensitive category match
    for (const [catName, data] of Object.entries(CATEGORIES)) {
        if (catName.toLowerCase() === key) return data.color;
    }

    // 3. Everything else (including subcategories) gets its own unique color
    return getDistinctColor(category);
};

// Get category icon
export const getCategoryIcon = (category) => {
    if (CATEGORIES[category]) return CATEGORIES[category].icon;
    // Basic heuristics for unknown categories
    const lower = category?.toLowerCase() || '';
    if (lower.includes('food') || lower.includes('eat') || lower.includes('grocery')) return '🍽️';
    if (lower.includes('travel') || lower.includes('trip')) return '✈️';
    if (lower.includes('health') || lower.includes('med') || lower.includes('care')) return '🏥';
    if (lower.includes('shop') || lower.includes('cloth')) return '🛍️';
    if (lower.includes('bill') || lower.includes('electric')) return '💡';
    if (lower.includes('transport') || lower.includes('fuel') || lower.includes('petrol')) return '🚗';
    if (lower.includes('station')) return '📝';
    if (lower.includes('house')) return '🏠';
    return '📁';
};

// Get all colors for charts
export const getCategoryColors = () => Object.values(CATEGORIES).map(c => c.color);

export default CATEGORIES;
