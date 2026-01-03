import useStore from './store/useStore';
import { GoogleAuthProvider, useGoogleAuth } from './components/GoogleAuthProvider';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import './App.css';

function AppContent() {
  const { sheetId, sheetData, user } = useStore();
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

  // Check if we have user data and sheet - show dashboard
  // Data persists in localStorage, so refresh should retain state
  const hasSession = user && sheetId;

  return (
    <div className="app">
      {hasSession ? <Dashboard /> : <Onboarding />}
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
