import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import NavBar         from "./components/NavBar";
import ProtectedRoute from "./components/ProtectedRoute";
import ToastContainer from "./components/Toast";
import ErrorBoundary  from "./components/ErrorBoundary";

import Home         from "./pages/Home";
import HowItWorks   from "./pages/HowItWorks";
import Auth         from "./pages/Auth";
import Dashboard    from "./pages/Dashboard";
import Contact      from "./pages/Contact";
import Subscription from "./pages/Subscription";

import useStore from "./state/store";

function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/"             element={<Home />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/auth"         element={<Auth />} />
        <Route path="/contact"      element={<Contact />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* Catch-all */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center text-center px-4">
              <div>
                <p className="font-display font-bold text-8xl gradient-text mb-4">404</p>
                <p className="text-white/50 mb-6">Page not found</p>
                <a href="/" className="btn-primary">Go Home</a>
              </div>
            </div>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const initAuth = useStore((s) => s.initAuth);

  useEffect(() => {
    const unsubscribe = initAuth();
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, []);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <NavBar />
        <main>
          <AppRoutes />
        </main>
        <ToastContainer />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
