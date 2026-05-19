import { createHash } from "node:crypto";
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
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: ws: wss:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const REPORT_TO_HEADER = JSON.stringify({
  group: "csp-endpoint",
  max_age: 10886400,
  endpoints: [{ url: "/api/csp-report" }],
});

function resolveBundleAssetPath(value: string): string {
  return value.replace(/^\.?\//, "");
}

function resolveIntegrity(source: string | Uint8Array): string {
  return `sha384-${createHash("sha384").update(source).digest("base64")}`;
}

export function applySubresourceIntegrity(bundle: Record<string, { type: "asset" | "chunk"; source?: string | Uint8Array; code?: string; fileName: string }>): void {
  const integrityLookup = new Map<string, string>();

  for (const asset of Object.values(bundle)) {
    if (asset.type === "asset" && asset.source != null) {
      integrityLookup.set(asset.fileName, resolveIntegrity(asset.source));
      continue;
    }
    if (asset.type === "chunk" && asset.code != null) {
      integrityLookup.set(asset.fileName, resolveIntegrity(asset.code));
    }
  }

  const indexHtml = bundle["index.html"];
  if (indexHtml?.type !== "asset" || typeof indexHtml.source !== "string") {
    return;
  }

  indexHtml.source = indexHtml.source.replace(
    /<(script|link)\b([^>]*?)\b(src|href)="([^"]+)"([^>]*)>/g,
    (full, tagName: string, before: string, attributeName: string, assetPath: string, after: string) => {
      const resolvedAssetPath = resolveBundleAssetPath(assetPath);
      const integrity = integrityLookup.get(resolvedAssetPath);
      if (integrity == null) {
        return full;
      }
      const hasCrossOrigin = /\bcrossorigin=/.test(before) || /\bcrossorigin=/.test(after);
      const crossOriginAttribute = hasCrossOrigin ? "" : ' crossorigin="anonymous"';
      return `<${tagName}${before} ${attributeName}="${assetPath}" integrity="${integrity}"${crossOriginAttribute}${after}>`;
    },
  );
}

function createCspHeadersPlugin(): Plugin {
  return {
    name: "csp-headers",
    generateBundle(_, bundle) {
      applySubresourceIntegrity(bundle as Record<string, { type: "asset" | "chunk"; source?: string | Uint8Array; code?: string; fileName: string }>);
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
