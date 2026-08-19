import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.REACT_APP_BACKEND_URL || env.VITE_BACKEND_URL || "http://localhost:8000";

  return {
    plugins: [react()],
    envPrefix: ["VITE_", "REACT_APP_"],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      hmr: {
        clientPort: 443,
        protocol: "wss",
      },
      allowedHosts: true,
      proxy: {
        "/api": {
          target: backend,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: "build",
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
    },
  };
});
