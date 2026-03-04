// ============================================================
//  API CLIENT — connects to Cloudflare Worker
// ============================================================

const BASE = import.meta.env.VITE_API_URL || 'https://calorie-app-api.lucatuille.workers.dev';

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la petición');
  return data;
}

export const api = {
  // Auth
  register: (body)          => request('POST', '/api/auth/register', body),
  login:    (body)          => request('POST', '/api/auth/login', body),

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

  // Advanced analytics
  getAdvancedAnalytics: (period, token) => request('GET', `/api/progress/advanced?period=${period}`, null, token),
};
