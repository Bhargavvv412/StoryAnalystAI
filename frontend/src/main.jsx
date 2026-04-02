import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/globals.css";

// Polyfill for matchMedia to prevent 'addListener of undefined' from external SDKs
if (typeof window !== "undefined" && window.matchMedia) {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = (query) => {
    const mql = originalMatchMedia(query);
    if (!mql.addListener) {
      mql.addListener = (cb) => mql.addEventListener("change", cb);
    }
    if (!mql.removeListener) {
      mql.removeListener = (cb) => mql.removeEventListener("change", cb);
    }
    return mql;
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
