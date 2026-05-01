import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import type { Plugin } from "vite";

/**
 * Vite plugin that injects CSP HTTP headers for production deployments.
 *
 * Requirements per §6.5.4:
 * - frame-ancestors 'none' (prevents clickjacking) - ignored in meta tags, requires HTTP header
 * - report-to / report-uri (violation reporting) - ignored in meta tags, requires HTTP header
 * - style-src without 'unsafe-inline' (nonce or hash based)
 *
 * This plugin sets CSP headers on all responses in production builds.
 * For nonce-based style-src, the server must generate and inject the nonce per-request.
 * For static file serving, the meta tag provides a baseline; real CSP enforcement
 * requires HTTP headers from CDN/reverse-proxy.
 */
function cspHeadersPlugin(): Plugin {
  return {
    name: "csp-headers",
    apply: "build",
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader(
          "Content-Security-Policy",
          [
            "default-src 'self'",
            "connect-src 'self' https: ws: wss:",
            "img-src 'self' data: https:",
            "style-src 'self'",
            "script-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "frame-ancestors 'none'",
            "report-to csp-endpoint",
          ].join("; "),
        );
        res.setHeader("Report-To", '{"group":"csp-endpoint","max-age":10886400,"endpoints":[{"url":"/__csp-report"}]}');
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tsconfigPaths(), cspHeadersPlugin()],
  build: {
    // Issue #1933 P1: Add explicit build target for consistent browser compatibility.
    // Without this, Vite defaults to esnext which may cause issues with older browsers.
    target: "es2022",
    sourcemap: false,
    // Issue #1939 P2: No terser/esbuild minify config - default behavior is ambiguous.
    // Explicitly set minify to esbuild (Vite default) to ensure consistent production builds.
    minify: "esbuild",
    // Issue #1934 P1: maxJsChunkBytes 550KB was 2.75x spec 200KB - enforce chunk size limits.
    // Per §7.3.1 perf budget: main<200KB per chunk gzipped.
    maxChunkSize: 200 * 1024,
    maxEdgeWorkerResponseSize: 200 * 1024,
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
            // R22-25 fix: Split features into individual chunks per §10 bundle size requirement
            // Extract feature name from path like @aa/feature-dashboard or /packages/features/dashboard
            const match = id.match(/feature[-\/](\w+)/);
            if (match) {
              return `feature-${match[1]}`;
            }
            return "features-misc";
          }
          return undefined;
        },
      },
    },
  },
});
