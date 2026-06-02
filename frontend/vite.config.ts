import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev the dashboard runs on :5173 and the API on :8000; the proxy makes
// same-origin "/api" calls work without CORS. In the packaged app FastAPI serves
// both, so the same relative "/api" base works there too.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
