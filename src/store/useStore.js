import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Helper to get spending message
const getSpendingMessage = (spending, income) => {
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
      // Auth State
      user: null,
      accessToken: null,
      isAuthenticated: false,

      // Sheet State
      sheetId: null,
      sheetData: [],
      isLoading: false,
      error: null,

      // UI State
      currentView: 'onboarding', // 'onboarding' | 'dashboard'
      isAIModalOpen: false,
      isHelpModalOpen: false,

      // Actions - Auth
      setUser: (user, accessToken) => set({
        user,
        accessToken,
        isAuthenticated: !!user,
        currentView: user ? (get().sheetId ? 'dashboard' : 'onboarding') : 'onboarding'
      }),

      logout: () => set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        sheetId: null,
        sheetData: [],
        currentView: 'onboarding'
      }),

      // Actions - Sheet
      setSheetId: (sheetId) => set({ sheetId }),

      setSheetData: (sheetData) => set({ sheetData }),

      addExpense: (expense) => set((state) => ({
        sheetData: [...state.sheetData, expense]
      })),

      addExpenses: (expenses) => set((state) => ({
        sheetData: [...state.sheetData, ...expenses]
      })),

      // Actions - UI
      setCurrentView: (view) => set({ currentView: view }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      toggleAIModal: () => set((state) => ({ isAIModalOpen: !state.isAIModalOpen })),
      toggleHelpModal: () => set((state) => ({ isHelpModalOpen: !state.isHelpModalOpen })),

      // Computed values (getters)
      getStats: () => {
        const state = get();
        const data = state.sheetData;

        if (!data || data.length === 0) {
          return {
            totalExpenses: 0,
            totalIncome: 0,
            balance: 0,
            categoryBreakdown: {},
            dailySpending: [],
            message: getSpendingMessage(0, 1)
          };
        }

        const totalExpenses = data
          .filter(item => item.amount < 0 || item.category !== 'Income')
          .reduce((sum, item) => sum + Math.abs(item.amount), 0);

        const totalIncome = data
          .filter(item => item.category === 'Income' || item.amount > 0)
          .reduce((sum, item) => sum + Math.abs(item.amount), 0);

        const categoryBreakdown = data
          .filter(item => item.category !== 'Income')
          .reduce((acc, item) => {
            const cat = item.category || 'Uncategorized';
            acc[cat] = (acc[cat] || 0) + Math.abs(item.amount);
            return acc;
          }, {});

        // Daily spending for velocity chart
        const dailyMap = data.reduce((acc, item) => {
          const date = item.date;
          if (!acc[date]) acc[date] = 0;
          if (item.category !== 'Income') {
            acc[date] += Math.abs(item.amount);
          }
          return acc;
        }, {});

        const dailySpending = Object.entries(dailyMap)
          .sort(([a], [b]) => new Date(a) - new Date(b))
          .slice(-30)
          .map(([date, amount]) => ({ date, amount }));

        return {
          totalExpenses,
          totalIncome,
          balance: totalIncome - totalExpenses,
          categoryBreakdown,
          dailySpending,
          message: getSpendingMessage(totalExpenses, totalIncome || 1)
        };
      }
    }),
    {
      name: 'track-your-rupee-storage',
      partialize: (state) => ({
        sheetId: state.sheetId,
        // Don't persist sensitive data
      })
    }
  )
);

export default useStore;
