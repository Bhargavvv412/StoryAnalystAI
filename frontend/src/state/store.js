import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authLogin, authSignup, authFirebaseLogin } from "../services/api";
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "../services/firebase";

// Decode JWT manually to get user data across reloads
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// ─── Zustand Store ────────────────────────────────────────────────────────────
const useStore = create(
  persist(
    (set, get) => ({
      // ── Auth State ────────────────────────────────────────────────────────────
      user: null,
      plan: "free",
      usageCount: 0,
      authLoading: true,
      authError: null,

      // ── UI State ──────────────────────────────────────────────────────────────
      theme: "dark",
      toasts: [],

      // ── Generation State ──────────────────────────────────────────────────────
      storyOutput: null,
      explorerOutput: null,
      combinedOutput: null,
      testResults: null,
      generatedTests: [],
      executedResults: [],
      generationLoading: false,
      generationError: null,
      activeReports: [],

      // ── Auth Actions ──────────────────────────────────────────────────────────
      initAuth: () => {
        // 1. Try Local JWT first
        const token = localStorage.getItem("token");
        if (token) {
          const payload = parseJwt(token);
          if (payload && payload.exp * 1000 > Date.now()) {
            set({
              user: { uid: payload.uid, email: payload.email, displayName: payload.name },
              plan: payload.plan || "free",
              usageCount: payload.usageCount || 0,
              authLoading: false,
            });
            return () => {}; // return empty unsubscribe
          } else {
            localStorage.removeItem("token");
          }
        }

        // 2. Fallback to Firebase checking
        if (isFirebaseConfigured) {
          const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
              set({
                user: {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  displayName: firebaseUser.displayName,
                  photoURL: firebaseUser.photoURL,
                },
                plan: "free",
                usageCount: 0,
                authLoading: false,
              });
            } else {
              set({ user: null, plan: "free", usageCount: 0, authLoading: false });
            }
          });
          return unsubscribe;
        }

        // 3. No auth configured
        set({ user: null, authLoading: false });
        return () => {};
      },

      signup: async (email, password, name) => {
        set({ authLoading: true, authError: null });
        try {
          const { user, token } = await authSignup({ email, password, name });
          localStorage.setItem("token", token);
          set({
            user: { uid: user.uid, email: user.email, displayName: user.name },
            plan: user.plan || "free",
            authLoading: false,
          });
        } catch (err) {
          set({ authLoading: false, authError: err.message });
          throw err;
        }
      },

      login: async (email, password) => {
        set({ authLoading: true, authError: null });
        try {
          const { user, token } = await authLogin({ email, password });
          localStorage.setItem("token", token);
          set({
            user: { uid: user.uid, email: user.email, displayName: user.name },
            plan: user.plan || "free",
            authLoading: false,
          });
        } catch (err) {
          set({ authLoading: false, authError: err.message });
          throw err;
        }
      },

      loginWithGoogle: async () => {
        if (!isFirebaseConfigured) {
          set({ authError: "Google sign-in is not configured." });
          throw new Error("Not configured");
        }
        set({ authLoading: true, authError: null });
        try {
          const { user } = await signInWithPopup(auth, googleProvider);
          const token = await user.getIdToken();
          // Sync with backend local DB if needed via authFirebaseLogin, or just rely on Firebase token
          await authFirebaseLogin(token); 
          set({ authLoading: false });
        } catch (err) {
          set({ authLoading: false, authError: "Google authentication failed." });
          throw err;
        }
      },

      logout: async () => {
        localStorage.removeItem("token");
        if (isFirebaseConfigured && auth.currentUser) {
          await firebaseSignOut(auth);
        }
        set({
          user: null, plan: "free", usageCount: 0,
          storyOutput: null, explorerOutput: null, combinedOutput: null, testResults: null
        });
      },

      setPlan: (plan) => set({ plan }),
      setUsageCount: (count) => set({ usageCount: count }),

      // ── UI Actions ────────────────────────────────────────────────────────────
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      addToast: (message, type = "info") => {
        const id = Date.now();
        set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
        setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, 4000);
      },

      removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      // ── Generation Actions ────────────────────────────────────────────────────
      setStoryOutput: (data) => set({ storyOutput: data }),
      setExplorerOutput: (data) => set({ explorerOutput: data }),
      setCombinedOutput: (data) => set({ combinedOutput: data }),
      setTestResults: (data) => set({ testResults: data }),
      setGeneratedTests: (tests) => set({ generatedTests: tests }),
      setExecutedResults: (results) => set({ executedResults: results }),
      setGenerationLoading: (v) => set({ generationLoading: v }),
      setGenerationError: (e) => set({ generationError: e }),
      clearGenerationState: () => set({ 
        storyOutput: null, explorerOutput: null, combinedOutput: null, 
        testResults: null, generatedTests: [], executedResults: [], generationError: null 
      }),

      addReport: (report) => set((s) => ({ activeReports: [report, ...s.activeReports].slice(0, 50) })),
      setReports: (reports) => set({ activeReports: reports }),
    }),
    {
      name: "storyanalyst-store",
      partialize: (s) => ({ theme: s.theme }),
    }
  )
);

export default useStore;
