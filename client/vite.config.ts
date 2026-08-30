import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  const clerkPk =
    env.VITE_CLERK_PUBLISHABLE_KEY || env.CLERK_PUBLISHABLE_KEY || "";

  return {
    envDir: "..",
    define: {
      "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(clerkPk),
    },
    server: {
      port: 5173,
      open: true,
      fs: { allow: [resolve(__dirname, "..")] },
      proxy: {
        "/plots": { target: "http://localhost:3001", changeOrigin: true },
        "/connections": { target: "http://localhost:3001", changeOrigin: true },
        "/integrations": { target: "http://localhost:3001", changeOrigin: true },
        "/internal": { target: "http://localhost:3001", changeOrigin: true },
        "/health": { target: "http://localhost:3001", changeOrigin: true },
        "/socket.io": {
          target: "http://localhost:3001",
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
