import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // REST API proxy
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      // Socket.IO WebSocket proxy — CRITICAL for real-time sync to work.
      // Without this, the browser connects to :4000 directly, but the auth
      // cookie is scoped to :5173, so socket auth silently fails.
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
