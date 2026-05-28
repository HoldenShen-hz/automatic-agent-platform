import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import testTarget from "../../test-target.json";
import {
  selectManualChunk,
  WEB_BUILD_TARGET,
  WEB_CHUNK_WARNING_LIMIT_KB,
  WEB_MINIFY_MODE,
} from "./build-config";

function resolveConnectSrcOrigins(env: Record<string, string | undefined>): readonly string[] {
  const candidates = [env.VITE_API_BASE_URL, env.VITE_WS_URL, env.VITE_OTLP_ENDPOINT]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => {
      const url = new URL(value);
      if (url.protocol === "ws:" || url.protocol === "wss:") {
        return `${url.protocol}//${url.host}`;
      }
      return url.origin;
    });
  return Array.from(new Set(candidates));
}

export function buildCspHeader(env: Record<string, string | undefined>): string {
  const connectSrc = ["'self'", ...resolveConnectSrcOrigins(env)].join(" ");
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

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
      if (/\bintegrity=/.test(before) || /\bintegrity=/.test(after)) {
        return full;
      }
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

function attachCspHeader(response: { setHeader(name: string, value: string): void }, cspHeader: string): void {
  response.setHeader("Content-Security-Policy", cspHeader);
}

function createCspHeadersPlugin(cspHeader: string): Plugin {
  return {
    name: "csp-headers",
    generateBundle(_, bundle) {
      applySubresourceIntegrity(bundle as Record<string, { type: "asset" | "chunk"; source?: string | Uint8Array; code?: string; fileName: string }>);
      this.emitFile({
        type: "asset",
        fileName: "_headers",
        source: [
          "/*",
          `  Content-Security-Policy: ${cspHeader}`,
          "",
        ].join("\n"),
      });
    },
    configureServer(server) {
      server.middlewares.use((_request, response, next) => {
        attachCspHeader(response, cspHeader);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((_request, response, next) => {
        attachCspHeader(response, cspHeader);
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const cspHeader = buildCspHeader(env);
  const uiHost = env.AA_UI_HOST ?? testTarget.host;
  const uiPreviewPort = Number.parseInt(env.AA_UI_PORT ?? String(testTarget.port), 10);
  const uiDevPort = Number.parseInt(env.AA_UI_DEV_PORT ?? String(uiPreviewPort + 1000), 10);
  return {
    plugins: [react(), tsconfigPaths(), createCspHeadersPlugin(cspHeader)],
    define: {
      "process.env": "{}",
    },
    resolve: {
      alias: {
        "react-native": fileURLToPath(new URL("./src/react-native-web-stub.tsx", import.meta.url)),
      },
    },
    server: {
      host: uiHost,
      port: uiDevPort,
      strictPort: true,
    },
    preview: {
      host: uiHost,
      port: uiPreviewPort,
      strictPort: true,
    },
    build: {
      target: WEB_BUILD_TARGET,
      minify: WEB_MINIFY_MODE,
      chunkSizeWarningLimit: WEB_CHUNK_WARNING_LIMIT_KB,
      sourcemap: mode === "production" ? false : true,
      rollupOptions: {
        output: {
          manualChunks: selectManualChunk,
        },
      },
    },
  };
});
