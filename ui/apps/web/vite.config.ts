import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import type { Plugin } from "vite";
import {
  selectManualChunk,
  WEB_BUILD_TARGET,
  WEB_CHUNK_WARNING_LIMIT_KB,
  WEB_MINIFY_MODE,
} from "./build-config";

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
    target: WEB_BUILD_TARGET,
    sourcemap: false,
    // Issue #1939 P2: No terser/esbuild minify config - default behavior is ambiguous.
    // Explicitly set minify to esbuild (Vite default) to ensure consistent production builds.
    minify: WEB_MINIFY_MODE,
    // Issue #1934 P1: keep the build warning threshold aligned with the 200KB raw chunk budget.
    chunkSizeWarningLimit: WEB_CHUNK_WARNING_LIMIT_KB,
    rollupOptions: {
      output: {
        manualChunks: selectManualChunk,
      },
    },
  },
});
