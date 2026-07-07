// Thin fetch wrapper around the PlacementDesk API. Attaches the stored JWT,
// parses JSON, and throws a helpful Error on non-2xx responses.

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TOKEN_KEY = "pd_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, auth = false, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } };

  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  if (auth) {
    const token = getToken();
    if (token) opts.headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch (err) {
    console.error("Network error:", err);
    throw new ApiError("Can't reach the server. Is the backend running?", 0);
  }

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  let data = null;
  
  try {
    if (isJson) {
      data = await res.json();
    }
  } catch (parseErr) {
    console.error("JSON parse error:", parseErr);
    // If JSON parsing fails, data remains null
    if (!res.ok) {
      throw new ApiError(`Request failed (${res.status})`, res.status);
    }
  }

  if (!res.ok) {
    const message = data?.message || data?.error || data?.details?.message || `Request failed (${res.status})`;
    console.error(`API Error ${res.status}:`, { path, method, message, data });
    throw new ApiError(message, res.status);
  }
  
  return data;
}

export const api = {
  // auth
  authConfig: () => request("/api/auth/config"),
  me: () => request("/api/auth/me", { auth: true }),
  devLogin: (email, name) => request("/api/auth/dev-login", { method: "POST", body: { email, name } }),
  demoAdmin: () => request("/api/auth/demo-admin", { method: "POST" }),

  // rooms
  listRooms: () => request("/api/rooms"),
  listAllRooms: () => request("/api/rooms/all", { auth: true }),
  getRoom: (slug) => request(`/api/rooms/${slug}`),
  createRoom: (payload) => request("/api/rooms", { method: "POST", body: payload, auth: true }),
  updateRoom: (id, payload) => request(`/api/rooms/${id}`, { method: "PATCH", body: payload, auth: true }),
  deleteRoom: (id) => request(`/api/rooms/${id}`, { method: "DELETE", auth: true }),

  // uploads
  uploadCompanyLogo: (formData) => {
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return fetch(`${API_BASE}/api/upload/company-logo`, { method: 'POST', headers, body: formData })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text().catch(() => null);
          throw new ApiError(txt || `Upload failed (${res.status})`, res.status);
        }
        return res.json();
      });
  },
  uploadRoomLogo: (roomId, formData) => {
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return fetch(`${API_BASE}/api/rooms/${roomId}/logo`, { method: 'POST', headers, body: formData })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text().catch(() => null);
          throw new ApiError(txt || `Upload failed (${res.status})`, res.status);
        }
        return res.json();
      });
  },
  publishRoomLogo: (roomId, visible) => request(`/api/rooms/${roomId}/logo/publish`, { method: 'PATCH', body: { visible }, auth: true }),

  // messages / experiences
  listMessages: (slug, city) => request(`/api/rooms/${slug}/messages${city ? `?city=${encodeURIComponent(city)}` : ""}`),
  sendMessage: (slug, text, city) => request(`/api/rooms/${slug}/messages`, { method: "POST", body: { text, city }, auth: true }),
  postExperience: (slug, payload) => request(`/api/rooms/${slug}/experiences`, { method: "POST", body: payload, auth: true }),
  pendingExperiences: () => request("/api/rooms/pending", { auth: true }),
  moderate: (id, status) => request(`/api/rooms/moderate/${id}`, { method: "PATCH", body: { status }, auth: true }),

  // feedback
  submitFeedback: (payload) => request("/api/feedback", { method: "POST", body: payload }),
  listFeedback: (status) => request(`/api/feedback${status && status !== "All" ? `?status=${encodeURIComponent(status)}` : ""}`, { auth: true }),
  updateFeedback: (id, status) => request(`/api/feedback/${id}`, { method: "PATCH", body: { status }, auth: true }),

  // users (admin)
  listUsers: () => request("/api/users", { auth: true }),
  updateUser: (id, payload) => request(`/api/users/${id}`, { method: "PATCH", body: payload, auth: true }),
};
