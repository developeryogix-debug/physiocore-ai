import { Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.js';
import { UserProfileProvider, useUserProfile } from './hooks/useUserProfile.js';
import Navigation from './components/Navigation.js';
import ConsentScreen from './components/ConsentScreen.js';
import Landing from './pages/Landing.js';
import Login from './pages/Login.js';
import Dashboard from './pages/Dashboard.js';
import Session from './pages/Session.js';
import Assessment from './pages/Assessment.js';
import Nutrition from './pages/Nutrition.js';
import Clinician from './pages/Clinician.js';
import Behavior from './pages/Behavior.js';
import Gym from './pages/Gym.js';
import History from './pages/History.js';
import Outcomes from './pages/Outcomes.js';
import Settings from './pages/Settings.js';
import Trainer from './pages/Trainer.js';
import PostureAssessment from './pages/PostureAssessment.js';
import PainMap from './pages/PainMap.js';
import ROMAssessment from './pages/ROMAssessment.js';
import OnboardingWizard from './components/OnboardingWizard.js';
import Admin from './pages/Admin.js';
import OrgDashboard from './pages/OrgDashboard.js';
import Pricing from './pages/Pricing.js';

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg-void)',
      flexDirection: 'column', gap: '16px',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '10px',
        background: 'linear-gradient(135deg, var(--teal-500), var(--blue-400))',
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', fontFamily: "'Space Mono', monospace" }}>
        Loading…
      </span>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, hasConsented } = useAuth();
  const { onboardingDone } = useUserProfile();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasConsented) return <ConsentScreen />;
  if (!onboardingDone) return <Navigate to="/onboard" replace />;

  return <>{children}</>;
}

/** Guards the /clinician route — redirects patients to dashboard */
function ClinicianRoute() {
  const { userRole } = useAuth();
  if (userRole !== 'clinician' && userRole !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return <Clinician />;
}

/** Preserves ?invite= query param when redirecting /signup → /login */
function SignupRedirect() {
  const [searchParams] = useSearchParams();
  const invite = searchParams.get('invite');
  return <Navigate to={invite ? `/login?invite=${invite}` : '/login'} replace />;
}

/** Guards /admin — super-admin only */
function AdminRoute() {
  const { userRole } = useAuth();
  if (userRole !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Admin />;
}

/** Guards /org-dashboard — org_admin or admin */
function OrgAdminRoute() {
  const { userRole } = useAuth();
  if (userRole !== 'org_admin' && userRole !== 'admin') return <Navigate to="/dashboard" replace />;
  return <OrgDashboard />;
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const { onboardingDone } = useUserProfile();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  const hideNav = ['/', '/login'].includes(location.pathname) || location.pathname === '/onboard';

  return (
    <>
      {!hideNav && user && onboardingDone && <Navigation />}
      <main>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/signup" element={<SignupRedirect />} />

          {/* Onboarding — requires auth + consent */}
          <Route
            path="/onboard"
            element={
              !user ? <Navigate to="/login" replace /> :
              onboardingDone ? <Navigate to="/dashboard" replace /> :
              <OnboardingWizard />
            }
          />

          {/* Protected app routes */}
          <Route path="/dashboard"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/session"    element={<ProtectedRoute><Session /></ProtectedRoute>} />
          <Route path="/assessment" element={<ProtectedRoute><Assessment /></ProtectedRoute>} />
          <Route path="/nutrition"  element={<ProtectedRoute><Nutrition /></ProtectedRoute>} />
          <Route path="/clinician"      element={<ProtectedRoute><ClinicianRoute /></ProtectedRoute>} />
          <Route path="/org-dashboard"  element={<ProtectedRoute><OrgAdminRoute /></ProtectedRoute>} />
          <Route path="/admin"          element={<ProtectedRoute><AdminRoute /></ProtectedRoute>} />
          <Route path="/behavior"   element={<ProtectedRoute><Behavior /></ProtectedRoute>} />
          <Route path="/gym"        element={<ProtectedRoute><Gym /></ProtectedRoute>} />
          <Route path="/history"   element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/outcomes"  element={<ProtectedRoute><Outcomes /></ProtectedRoute>} />
          <Route path="/settings"  element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/trainer"   element={<ProtectedRoute><Trainer /></ProtectedRoute>} />
          <Route path="/posture"    element={<ProtectedRoute><PostureAssessment /></ProtectedRoute>} />
          <Route path="/pain-map"  element={<ProtectedRoute><PainMap /></ProtectedRoute>} />
          <Route path="/rom-assessment" element={<ProtectedRoute><ROMAssessment /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <UserProfileProvider>
        <AppContent />
      </UserProfileProvider>
    </AuthProvider>
  );
}
