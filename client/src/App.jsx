import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import InstallPrompt from './components/InstallPrompt';
import AdminOverlay from './components/AdminOverlay';
import WelcomeDisclaimer from './components/WelcomeDisclaimer';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Calculator from './pages/Calculator';
import Progress from './pages/Progress';
import Profile from './pages/Profile';
import History from './pages/History';
import Privacy from './pages/Privacy';

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
  const [adminOpen, setAdminOpen] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(
    () => user && !localStorage.getItem('lucaeats_disclaimer_v1')
  );

  // Re-evaluate when user logs in/registers
  useEffect(() => {
    if (user && !localStorage.getItem('lucaeats_disclaimer_v1')) {
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user]);

  if (user && showDisclaimer) {
    return (
      <WelcomeDisclaimer onAccept={() => {
        localStorage.setItem('lucaeats_disclaimer_v1', 'true');
        setShowDisclaimer(false);
      }} />
    );
  }

  return (
    <>
      {user && <Navbar />}
      <InstallPrompt />
      {user?.is_admin === 1 && (
        <AdminOverlay isOpen={adminOpen} onClose={() => setAdminOpen(false)} />
      )}
      <Routes>
        <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/privacy"  element={<Privacy />} />
        <Route path="/"         element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/calculator" element={<ProtectedRoute><Calculator /></ProtectedRoute>} />
        <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
        <Route path="/history"  element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/profile"  element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
