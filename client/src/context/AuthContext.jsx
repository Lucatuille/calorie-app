import { createContext, useContext, useState, useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { setLogoutHandler } from '../api.js';
import { calculateMacros } from '../utils/tdee';

const BASE = import.meta.env.VITE_API_URL || 'https://calorie-app-api.lucatuille.workers.dev';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLogoutHandler(logout);
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (!t || !u) { setReady(true); return; }

    const storedUser = JSON.parse(u);

    // Siempre refrescar el token desde la BD al cargar.
    // Garantiza que cambios de rol hechos desde el admin se reflejen
    // sin que el usuario tenga que desloguearse.
    fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    })
      .then(async r => {
        if (r.ok) {
          const data = await r.json();
          if (data?.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            setToken(data.token);
            setUser(data.user);
            Sentry.setUser({ id: String(data.user.id), email: data.user.email });
            backfillMacros(data.user, data.token);
            return;
          }
        }

        if (r.status === 401) {
          // Token expirado o inválido — forzar logout limpio.
          // NO usar el token caducado como fallback; causaría "No autorizado"
          // en cada llamada a la API hasta que el usuario recargue o reinicie sesión.
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          // setUser y setToken permanecen null → app redirige a /login
          return;
        }

        // Error de servidor (5xx) o respuesta inesperada — modo offline:
        // storedUser es igual de fresco que el JWT (se actualizan juntos) y
        // puede ser MÁS fresco si updateUser() fue llamado después del último login.
        setToken(t);
        setUser(storedUser);
      })
      .catch(() => {
        // Sin red — usar datos almacenados (offline mode)
        setToken(t);
        setUser(storedUser);
      })
      .finally(() => setReady(true));
  }, []);

  // Backfill macros for users who completed onboarding before macro saving was added
  function backfillMacros(userData, authToken) {
    if (!userData.target_calories || userData.target_protein) return;
    const goal = userData.tdee
      ? (userData.target_calories < userData.tdee - 50 ? 'lose'
        : userData.target_calories > userData.tdee + 50 ? 'gain' : 'maintain')
      : 'maintain';
    const macros = calculateMacros(userData.target_calories, goal);
    const patched = { ...userData, target_protein: macros.protein, target_carbs: macros.carbs, target_fat: macros.fat };
    localStorage.setItem('user', JSON.stringify(patched));
    setUser(patched);
    fetch(`${BASE}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ target_protein: macros.protein, target_carbs: macros.carbs, target_fat: macros.fat }),
    }).catch(() => {});
  }

  function login(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(token);
    setUser(user);
    Sentry.setUser({ id: String(user.id), email: user.email });
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    Sentry.setUser(null);
  }

  function updateUser(updatedUser) {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, ready, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
