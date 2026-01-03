import useStore from './store/useStore';
import { GoogleAuthProvider, useGoogleAuth } from './components/GoogleAuthProvider';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import './App.css';

function AppContent() {
  const { isAuthenticated, isLoading } = useGoogleAuth();

  // Show loading state during authentication
  if (isLoading) {
    return (
      <div className="app loading-screen">
        <div className="loading-content">
          <img src="/logo.svg" alt="" className="loading-logo" />
          <div className="loading-spinner"></div>
          <p>Preparing your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {isAuthenticated ? <Dashboard /> : <Onboarding />}
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
