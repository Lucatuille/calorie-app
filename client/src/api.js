// ============================================================
//  API CLIENT — connects to Cloudflare Worker
// ============================================================

const BASE = import.meta.env.VITE_API_URL || 'https://calorie-app-api.lucatuille.workers.dev';

// Centralised 401 handler — set by AuthContext on mount.
// Any expired/invalid token triggers logout app-wide automatically.
let _on401 = null;
export function setLogoutHandler(fn) { _on401 = fn; }

async function request(method, path, body, token) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({ error: `Error del servidor (${res.status})` }));
  if (!res.ok) {
    if (res.status === 401) _on401?.();
    const err = new Error(data.error || 'Error en la petición');
    err.data   = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  register:       (body) => request('POST', '/api/auth/register', body),
  login:          (body) => request('POST', '/api/auth/login', body),
  forgotPassword: (body) => request('POST', '/api/auth/forgot-password', body),
  resetPassword:  (body) => request('POST', '/api/auth/reset-password', body),

  // Profile
  getProfile:    (token)        => request('GET',  '/api/profile', null, token),
  updateProfile: (body, token)  => request('PUT',  '/api/profile', body, token),

  // Entries
  getAllEntries:    (limit, token)    => request('GET',    `/api/entries?limit=${limit}`, null, token),
  getTodayEntries: (token)           => request('GET',    '/api/entries/today', null, token),
  saveEntry:       (body, token)     => request('POST',   '/api/entries', body, token),
  updateEntry:     (id, body, token) => request('PUT',    `/api/entries/${id}`, body, token),
  deleteEntry:     (id, token)       => request('DELETE', `/api/entries/${id}`, null, token),

  // Progress
  getSummary:   (token)        => request('GET',  '/api/progress/summary', null, token),
  getChart:     (days, token)  => request('GET',  `/api/progress/chart?days=${days}`, null, token),

  // AI photo analysis
  analyzePhoto: (body, token)  => request('POST', '/api/analyze', body, token),
  analyzeText:  (body, token)  => request('POST', '/api/entries/analyze-text', body, token),

  // Advanced analytics
  getAdvancedAnalytics: (period, token) => request('GET', `/api/progress/advanced?period=${period}`, null, token),

  // Supplements
  getSupplementsToday: (date, token)       => request('GET',    `/api/supplements/today?date=${date}`, null, token),
  addSupplement:       (body, token)       => request('POST',   '/api/supplements', body, token),
  deleteSupplement:    (id, token)         => request('DELETE', `/api/supplements/${id}`, null, token),
  toggleSupplement:    (id, body, token)   => request('POST',   `/api/supplements/${id}/toggle`, body, token),

  // Weight
  getWeightToday:  (token)       => request('GET',  '/api/weight/today', null, token),
  getWeightRecent: (token)       => request('GET',  '/api/weight/recent', null, token),
  saveWeight:      (body, token) => request('POST', '/api/weight', body, token),

  // Admin
  getAdminOverview:   (token) => request('GET', '/api/admin/overview',   null, token),
  getAdminUsers:      (token) => request('GET', '/api/admin/users',      null, token),
  getAdminEngagement: (token) => request('GET', '/api/admin/engagement', null, token),
  getAdminAIStats:    (token) => request('GET', '/api/admin/ai-stats',   null, token),
  updateUserRole: (userId, accessLevel, token) =>
    request('PUT', `/api/admin/users/${userId}/role`, { access_level: accessLevel }, token),

  // Calibración
  saveAiCorrection:      (body, token) => request('POST',   '/api/calibration/correction', body, token),
  getCalibrationProfile: (token)       => request('GET',    '/api/calibration/profile',    null, token),
  resetCalibration:      (token)       => request('DELETE', '/api/calibration/profile',    null, token),

  // Asistente (Pro)
  sendAssistantMessage:      (body, token)    => request('POST', '/api/assistant/chat', body, token),
  getAssistantUsage:         (token)          => request('GET',  '/api/assistant/usage', null, token),
  getAssistantConversations: (token)          => request('GET',  '/api/assistant/conversations', null, token),
  getConversationMessages:   (convId, token)  => request('GET',  `/api/assistant/conversations/${convId}`, null, token),
  getAssistantDigest:        (token)          => request('GET',  '/api/assistant/digest', null, token),

  // Stripe
  createCheckoutSession: (priceId, token) => request('POST', '/api/create-checkout-session', { priceId }, token),
  createPortalSession: (token) => request('POST', '/api/create-portal-session', {}, token),
  trackUpgradeEvent: (event, token) => request('POST', '/api/track-upgrade-event', { event }, token).catch(() => {}),
};
