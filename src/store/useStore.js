import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Helper to get spending message
const getSpendingMessage = (spending, income) => {
  if (income === 0) return { text: "Expense tracking only - add Income transactions to see balance", type: "neutral" };
  const ratio = spending / income;
  if (ratio > 0.9) return { text: "🚨 Spending is critical! Time to review.", type: "danger" };
  if (ratio > 0.7) return { text: "⚠️ High spending detected this period", type: "warning" };
  if (ratio > 0.5) return { text: "⚖️ Balanced spending - keep it up!", type: "neutral" };
  if (ratio > 0.3) return { text: "💪 Great control on spending!", type: "success" };
  return { text: "✨ Excellent savings rate!", type: "success" };
};

const useStore = create(
  persist(
    (set, get) => ({
      // Auth State - ONLY store minimal session info
      user: null,
      isAuthenticated: false,

      // Sheet State - sheetId persists, but DATA does NOT persist
      sheetId: null,
      sheetData: [], // This is now runtime only, not persisted
      isLoading: false,
      error: null,
      needsSheet: false, // True when no sheet found

      // UI State
      currentView: 'onboarding',
      isAIModalOpen: false,
      isQuickAddOpen: false,
      isHelpModalOpen: false,
      isAddModalOpen: false,
      editingTransaction: null,

      // Settings
      budget: 11000, // Default monthly budget
      webhookUrl: '', // Google Chat Webhook URL
      lastAlertLevel: 0, // Last alert level sent (0, 25, 50, 75, 90, 100)

      // Profile
      monthlySalary: 0,
      otherGains: 0,
      currentBalance: 0,
      invested: 0, // Amount invested in stocks, SIPs, etc.

      // Gemini AI
      geminiApiKey: '',
      geminiRequestCount: 0, // For model rotation

      // Actions - Auth
      setUser: (user) => set({
        user,
        isAuthenticated: !!user,
      }),

      logout: () => {
        // Clear everything on logout
        set({
          user: null,
          isAuthenticated: false,
          sheetId: null,
          sheetData: [],
          currentView: 'onboarding',
          needsSheet: false
        });
      },

      // Actions - Sheet
      setSheetId: (sheetId) => set({ sheetId }),
      setNeedsSheet: (needsSheet) => set({ needsSheet }),

      setSheetData: (sheetData) => set({ sheetData }),

      clearSheetData: () => set({ sheetData: [], sheetId: null }),

      addExpense: (expense) => set((state) => ({
        sheetData: [...state.sheetData, expense]
      })),

      addExpenses: (expenses) => set((state) => ({
        sheetData: [...state.sheetData, ...expenses]
      })),

      updateExpense: (index, updatedExpense) => set((state) => {
        const newData = [...state.sheetData];
        newData[index] = { ...newData[index], ...updatedExpense };
        return { sheetData: newData };
      }),

      deleteExpense: (index) => set((state) => ({
        sheetData: state.sheetData.filter((_, i) => i !== index)
      })),

      // Actions - UI
      setCurrentView: (view) => set({ currentView: view }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      toggleAIModal: () => set((state) => ({ isAIModalOpen: !state.isAIModalOpen })),
      toggleQuickAdd: () => set((state) => ({ isQuickAddOpen: !state.isQuickAddOpen })),
      toggleHelpModal: () => set((state) => ({ isHelpModalOpen: !state.isHelpModalOpen })),
      toggleAddModal: () => set((state) => ({ isAddModalOpen: !state.isAddModalOpen })),
      setEditingTransaction: (transaction) => set({ editingTransaction: transaction }),
      setBudget: (budget) => set({ budget }),
      setWebhookUrl: (url) => set({ webhookUrl: url }),
      setLastAlertLevel: (level) => set({ lastAlertLevel: level }),

      // Profile setters
      setMonthlySalary: (salary) => set({ monthlySalary: salary }),
      setOtherGains: (gains) => set({ otherGains: gains }),
      setCurrentBalance: (balance) => set({ currentBalance: balance }),
      setInvested: (amount) => set({ invested: amount }),
      setProfile: (profile) => set({
        monthlySalary: profile.monthlySalary ?? 0,
        otherGains: profile.otherGains ?? 0,
        currentBalance: profile.currentBalance ?? 0
      }),

      // Gemini setters
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      incrementGeminiRequestCount: () => set((state) => ({ geminiRequestCount: state.geminiRequestCount + 1 })),
      resetGeminiRequestCount: () => set({ geminiRequestCount: 0 }),

      // Computed values (getters)
      getStats: () => {
        const state = get();
        const data = state.sheetData || [];

        if (!data || data.length === 0) {
          return {
            totalExpenses: 0,
            totalIncome: 0,
            balance: 0,
            categoryBreakdown: {},
            subcategoryBreakdown: {},
            dailySpending: [],
            weeklyTrend: [],
            topCategories: [],
            recentTransactions: [],
            transactionCount: 0,
            message: { text: "No transactions yet. Use AI Quick-Add to import expenses!", type: "neutral" }
          };
        }

        // Calculate totals
        const totalExpenses = data
          .filter(item => item.category !== 'Income')
          .reduce((sum, item) => sum + Math.abs(parseFloat(item.amount) || 0), 0);

        const totalIncome = data
          .filter(item => item.category === 'Income')
          .reduce((sum, item) => sum + Math.abs(parseFloat(item.amount) || 0), 0);

        // Category breakdown
        const categoryBreakdown = data
          .filter(item => item.category !== 'Income')
          .reduce((acc, item) => {
            const cat = item.category || 'Other';
            acc[cat] = (acc[cat] || 0) + Math.abs(parseFloat(item.amount) || 0);
            return acc;
          }, {});

        // Subcategory breakdown
        const subcategoryBreakdown = data
          .filter(item => item.category !== 'Income' && item.subcategory)
          .reduce((acc, item) => {
            const subcat = item.subcategory || item.item;
            acc[subcat] = (acc[subcat] || 0) + Math.abs(parseFloat(item.amount) || 0);
            return acc;
          }, {});

        // Top categories (sorted)
        const topCategories = Object.entries(categoryBreakdown)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name, amount]) => ({
            name,
            amount,
            percentage: totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : 0
          }));

        // Daily spending for chart
        const dailyMap = data.reduce((acc, item) => {
          const date = item.date;
          if (!acc[date]) acc[date] = { expense: 0, income: 0 };
          const amount = Math.abs(parseFloat(item.amount) || 0);
          if (item.category === 'Income') {
            acc[date].income += amount;
          } else {
            acc[date].expense += amount;
          }
          return acc;
        }, {});

        const dailySpending = Object.entries(dailyMap)
          .sort(([a], [b]) => new Date(a) - new Date(b))
          .slice(-30)
          .map(([date, values]) => ({
            date,
            expense: values.expense,
            income: values.income
          }));

        // Recent transactions
        const recentTransactions = [...data]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 20);

        return {
          totalExpenses,
          totalIncome,
          balance: totalIncome - totalExpenses,
          categoryBreakdown,
          subcategoryBreakdown,
          dailySpending,
          topCategories,
          recentTransactions,
          transactionCount: data.length,
          message: getSpendingMessage(totalExpenses, totalIncome || 1)
        };
      }
    }),
    {
      name: 'track-your-rupee-v2',
      // Use sessionStorage for better security - clears on tab close
      storage: {
        getItem: (name) => {
          // SECURITY FIX: Never load persisted state automatically
          // This prevents loading another user's sheetId/settings
          // GoogleAuthProvider will load fresh data after verifying user
          console.log('🔒 Storage getItem called - returning null for security (fresh load)');
          return null;
        },
        setItem: (name, value) => {
          // Only persist if we have a user
          const state = typeof value === 'string' ? JSON.parse(value).state : value.state;
          if (state?.user?.email) {
            // Use user-scoped key to prevent data leakage
            const userScopedKey = `${name}-${state.user.email}`;
            sessionStorage.setItem(userScopedKey, JSON.stringify(value));
            console.log('💾 Saved user-scoped storage for:', state.user.email);
          }
        },
        removeItem: (name) => {
          // Remove all possible user-scoped keys
          const keys = Object.keys(sessionStorage);
          keys.forEach(key => {
            if (key.startsWith(name)) {
              sessionStorage.removeItem(key);
            }
          });
          console.log('🧹 Cleared all storage with prefix:', name);
        }
      },
      // ONLY persist sheetId and user - NOT the data
      partialize: (state) => ({
        sheetId: state.sheetId,
        budget: state.budget,
        webhookUrl: state.webhookUrl,
        lastAlertLevel: state.lastAlertLevel,
        monthlySalary: state.monthlySalary,
        otherGains: state.otherGains,
        currentBalance: state.currentBalance,
        invested: state.invested,
        geminiApiKey: state.geminiApiKey,
        geminiRequestCount: state.geminiRequestCount,
        user: state.user ? { email: state.user.email, name: state.user.name, picture: state.user.picture } : null
      })
    }
  )
);

export default useStore;
