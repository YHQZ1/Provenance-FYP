import axios from "axios";
import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

// Always use the live Supabase session so refreshed tokens are picked up.
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      (error.code === "ERR_NETWORK"
        ? "Can't reach the Provenance server. Check that the backend is running."
        : "Something went wrong. Please try again.");

    if (status === 401) {
      await supabase.auth.signOut();
      if (!window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth?mode=login&expired=1";
      }
    }

    return Promise.reject(new ApiError(message, status, error.response?.data?.details));
  },
);

export const authAPI = {
  sync: (token) => api.post("/auth/sync", { token }),
  me: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
};

export const documentAPI = {
  upload: (file, documentType) => {
    const formData = new FormData();
    formData.append("document_type", documentType);
    formData.append("file", file);
    return api.post("/documents/upload", formData);
  },
  list: (params) => api.get("/documents", { params }),
  get: (id) => api.get(`/documents/${id}`),
  update: (id, data) => api.patch(`/documents/${id}`, data),
  retry: (id) => api.post(`/documents/${id}/retry`),
  remove: (id) => api.delete(`/documents/${id}`),
};

export const reviewAPI = {
  queue: (params) => api.get("/feedback/queue", { params }),
  approve: (id, notes) => api.post(`/feedback/${id}/approve`, { notes }),
  correct: (id, data) => api.post(`/feedback/${id}/correct`, data),
  exclude: (id, reason) => api.post(`/feedback/${id}/exclude`, { reason }),
  approveSuggested: (documentId) =>
    api.post("/feedback/approve-suggested", { document_id: documentId }),
};

export const filingAPI = {
  get: (fy) => api.get("/compliance/filing", { params: { fy } }),
  finalize: (fy, notes) => api.post("/compliance/filing/finalize", { fy, notes }),
  reopen: (fy) => api.post("/compliance/filing/reopen", { fy }),
  regulatoryReview: (fy) =>
    api.post("/compliance/filing/regulatory-review", { fy }),
};

export const companyAPI = {
  get: () => api.get("/company/me"),
  update: (data) => api.patch("/company", data),
};

export const systemAPI = {
  status: () => api.get("/system/status"),
};

export const regulatoryAPI = {
  query: (query) => api.post("/regulatory/query", { query }),
  sources: () => api.get("/regulatory/sources"),
};

export const activityAPI = {
  list: (params) => api.get("/activity", { params }),
};

export const obligationAPI = {
  get: (fy, basis) => api.get("/obligations", { params: { fy, basis } }),
  update: (fy, category, values) => api.put(`/obligations/${category}`, { fy, ...values }),
};

export const materialsAPI = {
  library: () => api.get("/materials"),
  addTradeName: (data) => api.post("/materials/trade-names", data),
  removeTradeName: (id) => api.delete(`/materials/trade-names/${id}`),
};

export default api;
