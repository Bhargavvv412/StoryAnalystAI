import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // During dev, proxy API calls to backend
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          firebase:     ["firebase/app", "firebase/auth", "firebase/firestore"],
          framer:       ["framer-motion"],
          vendor:       ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
