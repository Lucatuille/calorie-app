import { createContext, useContext, useState, useEffect } from 'react';

const BASE = import.meta.env.VITE_API_URL || 'https://calorie-app-api.lucatuille.workers.dev';

const AuthContext = createContext(null);

function decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return {}; }
}

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
        // usar el JWT almacenado como fallback temporal.
        const jwtPayload = decodeJWT(t);
        setToken(t);
        setUser({ ...storedUser, is_admin: jwtPayload.is_admin || 0, access_level: jwtPayload.access_level ?? storedUser.access_level ?? 1 });
      })
      .catch(() => {
        // Sin red — usar token almacenado (offline mode)
        const jwtPayload = decodeJWT(t);
        setToken(t);
        setUser({ ...storedUser, is_admin: jwtPayload.is_admin || 0, access_level: jwtPayload.access_level ?? storedUser.access_level ?? 1 });
      })
      .finally(() => setReady(true));
  }, []);

  function login(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(token);
    setUser(user);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
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
