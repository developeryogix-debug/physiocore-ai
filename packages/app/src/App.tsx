import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { UserProfileProvider, useUserProfile } from './hooks/useUserProfile.js';
import Navigation from './components/Navigation.js';
import Landing from './pages/Landing.js';
import Dashboard from './pages/Dashboard.js';
import Session from './pages/Session.js';
import Assessment from './pages/Assessment.js';
import Nutrition from './pages/Nutrition.js';
import Clinician from './pages/Clinician.js';
import Behavior from './pages/Behavior.js';
import Gym from './pages/Gym.js';
import OnboardingWizard from './components/OnboardingWizard.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { onboardingDone } = useUserProfile();
  return onboardingDone ? <>{children}</> : <Navigate to="/" replace />;
}

function AppContent() {
  const { onboardingDone, isLoading } = useUserProfile();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
        Loading...
      </div>
    );
  }

  const hideNav = location.pathname === '/' || location.pathname === '/onboard';

  return (
    <>
      {!hideNav && onboardingDone && <Navigation />}
      <main style={{ minHeight: hideNav ? '100vh' : 'calc(100vh - 60px)' }}>
        <Routes>
          <Route path="/" element={onboardingDone ? <Navigate to="/dashboard" replace /> : <Landing />} />
          <Route path="/onboard" element={onboardingDone ? <Navigate to="/dashboard" replace /> : <OnboardingWizard />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/session" element={<ProtectedRoute><Session /></ProtectedRoute>} />
          <Route path="/assessment" element={<ProtectedRoute><Assessment /></ProtectedRoute>} />
          <Route path="/nutrition" element={<ProtectedRoute><Nutrition /></ProtectedRoute>} />
          <Route path="/clinician" element={<ProtectedRoute><Clinician /></ProtectedRoute>} />
          <Route path="/behavior" element={<ProtectedRoute><Behavior /></ProtectedRoute>} />
          <Route path="/gym" element={<ProtectedRoute><Gym /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <UserProfileProvider>
      <AppContent />
    </UserProfileProvider>
  );
}
