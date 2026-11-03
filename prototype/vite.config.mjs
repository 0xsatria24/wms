import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const apiTarget = process.env.WMS_API_TARGET || "http://127.0.0.1:5080";

export default defineConfig({
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/chart.js")) return "charts";
          if (id.includes("node_modules/@microsoft/signalr")) return "realtime";
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/auth": { target: apiTarget, changeOrigin: true },
      "/hubs": { target: apiTarget, changeOrigin: true, ws: true },
    },
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
  },
  plugins: [react()],
});
