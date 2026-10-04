import { defineConfig } from "vite";

// The browser client lives in src/client and imports the shared simulation
// from src/shared. In development, Vite proxies the API and WebSocket to the
// Node server on :8080.
export default defineConfig({
  root: "src/client",
  build: { outDir: "../../dist/client", emptyOutDir: true, target: "es2022" },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/readme": "http://localhost:8080",
      "/ws": { target: "ws://localhost:8080", ws: true },
    },
  },
});
