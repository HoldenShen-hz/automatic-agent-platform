import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/reactflow")) {
            return "flow-canvas";
          }
          if (id.includes("react-router-dom") || id.includes("/react/") || id.includes("/react-dom/")) {
            return "react";
          }
          if (id.includes("@tanstack/react-query") || id.includes("/zustand/")) {
            return "query";
          }
          if (id.includes("/packages/features/")) {
            return "features";
          }
          return undefined;
        },
      },
    },
  },
});
