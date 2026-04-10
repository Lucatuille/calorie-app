import { useState, useEffect, lazy, Suspense } from 'react';
import * as Sentry from '@sentry/react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
const AdminOverlay = lazy(() => import('./components/AdminOverlay'));
import WelcomeDisclaimer from './components/WelcomeDisclaimer';
import WhatsNew from './components/WhatsNew';
import WaitlistScreen from './components/WaitlistScreen';
import { useWhatsNew } from './hooks/useWhatsNew';
const HelpModal = lazy(() => import('./components/HelpModal'));
import RouteErrorBoundary from './components/RouteErrorBoundary';
import { isNative } from './utils/platform';

// Eager: login/register (first screen), dashboard (most visited)
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

// Lazy: loaded on demand when user navigates
const Calculator = lazy(() => import('./pages/Calculator'));
const Progress   = lazy(() => import('./pages/Progress'));
const Profile    = lazy(() => import('./pages/Profile'));
const History    = lazy(() => import('./pages/History'));
const Assistant  = lazy(() => import('./pages/Assistant'));
const Privacy    = lazy(() => import('./pages/Privacy'));
const Terms      = lazy(() => import('./pages/Terms'));
const Onboarding     = lazy(() => import('./pages/Onboarding'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword'));
const Upgrade    = lazy(() => import('./pages/Upgrade'));
const NotFound   = lazy(() => import('./pages/NotFound'));

function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return !user ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [adminOpen, setAdminOpen] = useState(false);
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const whatsNew = useWhatsNew();

  // Detectar retorno desde Stripe con ?upgraded=true
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('upgraded') === 'true') {
      setShowUpgradedBanner(true);
      navigate('/', { replace: true });
      setTimeout(() => setShowUpgradedBanner(false), 6000);
    }
  }, []);
  const [showDisclaimer, setShowDisclaimer] = useState(
    () => user && !localStorage.getItem('caliro_disclaimer_v1')
  );

  // Re-evaluate when user logs in/registers
  useEffect(() => {
    if (user && !localStorage.getItem('caliro_disclaimer_v1')) {
      setShowDisclaimer(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user?.is_admin) return;
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setAdminOpen(prev => !prev);
      }
    };
    const handleOpenAdmin = () => setAdminOpen(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-admin', handleOpenAdmin);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-admin', handleOpenAdmin);
    };
  }, [user]);

  if (user && user.access_level === 0) {
    return <WaitlistScreen />;
  }

  if (user && showDisclaimer) {
    return (
      <WelcomeDisclaimer onAccept={() => {
        localStorage.setItem('caliro_disclaimer_v1', 'true');
        setShowDisclaimer(false);
      }} />
    );
  }

  if (user && !user.onboarding_completed) {
    return <Onboarding />;
  }

  return (
    <>
      {import.meta.env.VITE_ENV === 'preview' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          background: '#e76f51', color: 'white',
          textAlign: 'center', fontSize: '12px', fontWeight: 600,
          padding: '4px', zIndex: 99999,
          fontFamily: 'var(--font-sans)', letterSpacing: '0.5px',
        }}>
          ⚗️ PREVIEW — Los cambios aquí no afectan a caliro.dev
        </div>
      )}
      {showUpgradedBanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
          background: 'var(--accent)',
          color: 'white',
          textAlign: 'center',
          padding: '12px 16px',
          fontSize: 14,
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
          cursor: 'pointer',
        }} onClick={() => setShowUpgradedBanner(false)}>
          ¡Bienvenido a Pro! Tu cuenta ya tiene acceso completo.
        </div>
      )}
      {user && <Navbar onHelpOpen={() => setHelpOpen(true)} />}
      {user && <BottomNav />}
      <InstallPrompt />
      {user?.is_admin === 1 && (
        <Suspense fallback={null}>
          <AdminOverlay isOpen={adminOpen} onClose={() => setAdminOpen(false)} forceWhatsNew={whatsNew.forceOpen} />
        </Suspense>
      )}
      {user && whatsNew.isOpen && whatsNew.releaseToShow && (
        <WhatsNew
          release={whatsNew.releaseToShow}
          onDismiss={whatsNew.dismiss}
          isClosing={whatsNew.isClosing}
        />
      )}
      {helpOpen && (
        <Suspense fallback={null}>
          <HelpModal onClose={() => setHelpOpen(false)} />
        </Suspense>
      )}

      <main>
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>}>
        <Routes>
          <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy"  element={<Privacy />} />
          <Route path="/terms"    element={<Terms />} />
          <Route path="/"           element={<ProtectedRoute><RouteErrorBoundary><Dashboard /></RouteErrorBoundary></ProtectedRoute>} />
          <Route path="/calculator" element={<ProtectedRoute><RouteErrorBoundary><Calculator /></RouteErrorBoundary></ProtectedRoute>} />
          <Route path="/progress"   element={<ProtectedRoute><RouteErrorBoundary><Progress /></RouteErrorBoundary></ProtectedRoute>} />
          <Route path="/history"    element={<ProtectedRoute><RouteErrorBoundary><History /></RouteErrorBoundary></ProtectedRoute>} />
          <Route path="/profile"    element={<ProtectedRoute><RouteErrorBoundary><Profile /></RouteErrorBoundary></ProtectedRoute>} />
          <Route path="/asistente"  element={<ProtectedRoute><RouteErrorBoundary><Assistant /></RouteErrorBoundary></ProtectedRoute>} />
          <Route path="/upgrade"    element={<ProtectedRoute><RouteErrorBoundary><Upgrade /></RouteErrorBoundary></ProtectedRoute>} />
          <Route path="*"           element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
    </>
  );
}

function AppFallback() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 28, color: 'var(--accent)', marginBottom: 16 }}>
        Caliro
      </div>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>
        Algo salió mal
      </p>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
        El error ha sido reportado automáticamente.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 24px', background: 'var(--accent)', color: 'white',
          border: 'none', borderRadius: 'var(--radius-full)',
          fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}
      >
        Reintentar
      </button>
    </div>
  );
}

export default function App() {
  // En web la app vive en /app/* (Cloudflare Pages routing).
  // En Capacitor nativo vive en root (capacitor://localhost/).
  const basename = isNative() ? '/' : '/app';
  return (
    <Sentry.ErrorBoundary fallback={<AppFallback />}>
      <AuthProvider>
        <BrowserRouter basename={basename}>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  );
}
