import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import AdminOverlay from './components/AdminOverlay';
import WelcomeDisclaimer from './components/WelcomeDisclaimer';
import WhatsNew from './components/WhatsNew';
import WaitlistScreen from './components/WaitlistScreen';
import { useWhatsNew } from './hooks/useWhatsNew';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Calculator from './pages/Calculator';
import Progress from './pages/Progress';
import Profile from './pages/Profile';
import History from './pages/History';
import Privacy from './pages/Privacy';
import Assistant from './pages/Assistant';
import Onboarding from './pages/Onboarding';
import Upgrade from './pages/Upgrade';

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
          fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.5px',
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
      {user && <Navbar />}
      {user && <BottomNav />}
      <InstallPrompt />
      {user?.is_admin === 1 && (
        <AdminOverlay isOpen={adminOpen} onClose={() => setAdminOpen(false)} forceWhatsNew={whatsNew.forceOpen} />
      )}
      {user && whatsNew.isOpen && whatsNew.releaseToShow && (
        <WhatsNew
          release={whatsNew.releaseToShow}
          onDismiss={whatsNew.dismiss}
          isClosing={whatsNew.isClosing}
        />
      )}
      <Routes>
        <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/privacy"  element={<Privacy />} />
        <Route path="/"         element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/calculator" element={<ProtectedRoute><Calculator /></ProtectedRoute>} />
        <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
        <Route path="/history"  element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/profile"    element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/asistente" element={<ProtectedRoute><Assistant /></ProtectedRoute>} />
        <Route path="/upgrade"   element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/app">
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
