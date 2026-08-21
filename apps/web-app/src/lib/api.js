import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem("sb-access-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message || "An unexpected error occurred";
    if (
      error.response?.status === 401 &&
      !window.location.pathname.includes("/auth")
    ) {
      localStorage.removeItem("sb-access-token");
      window.location.href = "/auth?mode=login";
    }
    return Promise.reject(new Error(message));
  },
);

export const authAPI = {
  sync: (token) => api.post("/auth/sync", { token }),
  getCurrentUser: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
};

export const documentAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  list: (params) => api.get("/documents", { params }),
  getById: (id) => api.get(`/documents/${id}`),
  getStatus: (id) => api.get(`/documents/${id}/status`),
  delete: (id) => api.delete(`/documents/${id}`),
};

export const feedbackAPI = {
  getPending: (params) => api.get("/feedback/pending", { params }),
  verify: (id, notes) => api.post(`/feedback/${id}/verify`, { notes }),
  correct: (id, data) => api.post(`/feedback/${id}/correct`, data),
  bulkVerify: (ids) =>
    api.post("/feedback/bulk-verify", { classification_ids: ids }),
};

export const complianceAPI = {
  getStats: () => api.get("/compliance/dashboard/stats"),
  getRecentActivity: (limit = 10) =>
    api.get("/compliance/dashboard/recent-activity", { params: { limit } }),
  listFilings: (year) => api.get("/compliance/filings", { params: { year } }),
  getCurrentFiling: () => api.get("/compliance/filings/current"),
  getFilingDetails: (id) => api.get(`/compliance/filings/${id}`),
  getFilingDocuments: (id, params) =>
    api.get(`/compliance/filings/${id}/documents`, { params }),
  submitFiling: (id, notes) =>
    api.post(`/compliance/filings/${id}/submit`, { notes }),
  getQuarterlyReport: (year, quarter) =>
    api.get("/compliance/reports/quarterly-summary", {
      params: { year, quarter },
    }),
};

export const companyAPI = {
  getProfile: () => api.get("/company/me"),
  updateProfile: (data) => api.patch("/company", data),
  createProfile: (data) => api.post("/company", data),
};

export default api;
