import useStore from './store/useStore';
import { GoogleAuthProvider, useGoogleAuth } from './components/GoogleAuthProvider';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import './App.css';

function AppContent() {
  const { isAuthenticated, sheetId } = useStore();
  const { isLoading } = useGoogleAuth();

  // Show loading state during authentication
  if (isLoading) {
    return (
      <div className="app loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Preparing your dashboard...</p>
        </div>
      </div>
    );
  }

  // Strict auth check - must be authenticated AND have a sheet
  const showDashboard = isAuthenticated && sheetId;

  return (
    <div className="app">
      {showDashboard ? <Dashboard /> : <Onboarding />}
    </div>
  );
}

function App() {
  return (
    <GoogleAuthProvider>
      <AppContent />
    </GoogleAuthProvider>
  );
}

export default App;
