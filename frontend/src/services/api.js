import axios from "axios";
import { auth, isFirebaseConfigured } from "./firebase";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/** Get current auth token (Local JWT preferred over Firebase) */
async function getToken() {
  const localToken = localStorage.getItem("token");
  if (localToken) return localToken;

  if (!isFirebaseConfigured || !auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

/** Axios instance */
const api = axios.create({ baseURL: BASE_URL, timeout: 180000 });

/** Attach auth token to every request */
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Uniform error handling */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      "Network error. Please check your connection.";
    return Promise.reject(new Error(message));
  }
);

// ─── Auth Endpoints ───────────────────────────────────────────────────────────
export const authSignup = (data) =>
  api.post("/api/auth/signup", data).then((r) => r.data);

export const authLogin = (data) =>
  api.post("/api/auth/login", data).then((r) => r.data);

export const authFirebaseLogin = (token) =>
  api.post("/api/auth/firebase-login", { token }).then((r) => r.data);

// ─── AI Endpoints ─────────────────────────────────────────────────────────────
export const generateStory = (requirement) =>
  api.post("/api/ai/generate-story", { requirement }).then((r) => r.data);

export const exploreWebsite = (url, depth = 1) =>
  api.post("/api/ai/explore-website", { url, depth }).then((r) => r.data);

export const generateCombined = (requirement, url, depth = 1) =>
  api.post("/api/ai/combined", { requirement, url, depth }).then((r) => r.data);

// ─── Test Endpoints ───────────────────────────────────────────────────────────
export const executeTests = (testCases, headless = true) =>
  api.post("/api/tests/execute", { test_cases: testCases, headless }).then((r) => r.data);

export const startTestJob = (testCases, workers = 1) =>
  api.post("/api/tests/start", { test_cases: testCases, workers }).then((r) => r.data);

export const pollTestJob = (jobId) =>
  api.get(`/api/tests/status/${jobId}`).then((r) => r.data);

// ─── Report Endpoints ─────────────────────────────────────────────────────────
export const saveReport = (type, results, summary, metadata = {}) =>
  api.post("/api/reports/save", { type, results, summary, metadata }).then((r) => r.data);

export const listReports = () =>
  api.get("/api/reports/list").then((r) => r.data);

export const deleteReport = (id) =>
  api.delete(`/api/reports/${id}`).then((r) => r.data);

export const generateHtmlReport = (results, summary) =>
  api.post("/api/reports/generate-html", { results, summary }, { responseType: 'text' }).then((r) => r.data);

export const getDownloadHtmlUrl = () => `${BASE_URL}/api/reports/download-html`;

// ─── Payment Endpoints ────────────────────────────────────────────────────────
export const createRazorpayOrder = (plan) =>
  api.post("/api/payments/razorpay/create-order", { plan }).then((r) => r.data);

export const verifyRazorpayPayment = (data) =>
  api.post("/api/payments/razorpay/verify", data).then((r) => r.data);

// ─── Contact ──────────────────────────────────────────────────────────────────
export const submitContact = (data) =>
  api.post("/api/contact", data).then((r) => r.data);

export default api;
