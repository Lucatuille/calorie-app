import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { setLogoutHandler } from '../api.js';
import { calculateMacros } from '../utils/tdee';

const BASE = import.meta.env.VITE_API_URL || 'https://calorie-app-api.lucatuille.workers.dev';

// ── Types ──────────────────────────────────────────────────
export interface User {
  id: number;
  name: string;
  email: string;
  is_admin?: number;
  access_level: number;
  onboarding_completed?: number;
  age?: number | null;
  weight?: number | null;
  height?: number | null;
  gender?: string | null;
  target_calories?: number | null;
  target_protein?: number | null;
  target_carbs?: number | null;
  target_fat?: number | null;
  goal_weight?: number | null;
  tdee?: number | null;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  ready: boolean;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,  setUser]  = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLogoutHandler(logout);
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (!t || !u) { setReady(true); return; }

    const storedUser: User = JSON.parse(u);

    // Siempre refrescar el token desde la BD al cargar.
    // Garantiza que cambios de rol hechos desde el admin se reflejen
    // sin que el usuario tenga que desloguearse.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
      signal: controller.signal,
    })
      .then(async r => {
        clearTimeout(timeout);
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
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          return;
        }

        setToken(t);
        setUser(storedUser);
      })
      .catch(() => {
        setToken(t);
        setUser(storedUser);
      })
      .finally(() => setReady(true));
  }, []);

  function backfillMacros(userData: User, authToken: string) {
    if (!userData.target_calories || userData.target_protein) return;
    const goal = userData.tdee
      ? (userData.target_calories < userData.tdee - 50 ? 'lose'
        : userData.target_calories > userData.tdee + 50 ? 'gain' : 'maintain')
      : 'maintain';
    const macros = calculateMacros(userData.target_calories, goal);
    const patched: User = { ...userData, target_protein: macros.protein, target_carbs: macros.carbs, target_fat: macros.fat };
    localStorage.setItem('user', JSON.stringify(patched));
    setUser(patched);
    fetch(`${BASE}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ target_protein: macros.protein, target_carbs: macros.carbs, target_fat: macros.fat }),
    }).catch(() => {});
  }

  function login(t: string, u: User) {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
    Sentry.setUser({ id: String(u.id), email: u.email });
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Limpiar cachés privadas de Chef y otras features por-usuario.
    // Crítico para privacidad: sin esto, el próximo user en el navegador
    // podía ver planes cacheados del user anterior.
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('caliro_day_plan') || k.startsWith('caliro_week_plan'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch { /* silent */ }
    setToken(null);
    setUser(null);
    Sentry.setUser(null);
  }

  function updateUser(updatedUser: User) {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, ready, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext) as AuthContextValue;
