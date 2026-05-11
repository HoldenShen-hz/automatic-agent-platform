import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import {
  selectManualChunk,
  WEB_BUILD_TARGET,
  WEB_CHUNK_WARNING_LIMIT_KB,
  WEB_MINIFY_MODE,
} from "./build-config";

const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const REPORT_TO_HEADER = JSON.stringify({
  group: "csp-endpoint",
  max_age: 10886400,
  endpoints: [{ url: "/api/csp-report" }],
});

function createCspHeadersPlugin(): Plugin {
  return {
    name: "csp-headers",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "_headers",
        source: [
          "/*",
          `  Content-Security-Policy: ${CSP_HEADER}`,
          `  Report-To: ${REPORT_TO_HEADER}`,
          "",
        ].join("\n"),
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((_request, response, next) => {
        response.setHeader("Content-Security-Policy", CSP_HEADER);
        response.setHeader("Report-To", REPORT_TO_HEADER);
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tsconfigPaths(), createCspHeadersPlugin()],
  resolve: {
    alias: {
      "react-native": new URL("./src/react-native-web-stub.tsx", import.meta.url).pathname,
    },
  },
  build: {
    target: WEB_BUILD_TARGET,
    minify: WEB_MINIFY_MODE,
    chunkSizeWarningLimit: WEB_CHUNK_WARNING_LIMIT_KB,
    sourcemap: mode === "production" ? "hidden" : true,
    rollupOptions: {
      output: {
        manualChunks: selectManualChunk,
      },
    },
  },
}));
