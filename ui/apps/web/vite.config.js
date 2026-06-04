import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import testTarget from "../../test-target.json";
import { selectManualChunk, WEB_BUILD_TARGET, WEB_CHUNK_WARNING_LIMIT_KB, WEB_MINIFY_MODE, } from "./build-config";
const uiRoot = new URL("../../", import.meta.url);
function fromUiRoot(relativePath) {
    return fileURLToPath(new URL(relativePath, uiRoot));
}
const sharedPackageAliases = {
    "@aa/shared-types": fromUiRoot("packages/shared/types/src/index.ts"),
    "@aa/shared-api-client": fromUiRoot("packages/shared/api-client/src/index.ts"),
    "@aa/shared-auth": fromUiRoot("packages/shared/auth/src/index.ts"),
    "@aa/shared-state": fromUiRoot("packages/shared/state/src/index.ts"),
    "@aa/shared-sync": fromUiRoot("packages/shared/sync/src/index.ts"),
    "@aa/shared-domain": fromUiRoot("packages/shared/domain/src/index.ts"),
    "@aa/shared-platform": fromUiRoot("packages/shared/platform/src/index.ts"),
    "@aa/shared-i18n": fromUiRoot("packages/shared/i18n/src/index.ts"),
    "@aa/shared-telemetry": fromUiRoot("packages/shared/telemetry/src/index.ts"),
    "@aa/shared-nl-client": fromUiRoot("packages/shared/nl-client/src/index.ts"),
    "@aa/ui-core": fromUiRoot("packages/ui-core/src/index.tsx"),
    "@aa/ui-mobile": fromUiRoot("packages/ui-mobile/src/index.ts"),
};
const featurePackageAliases = Object.fromEntries([
    "agent-manager",
    "alerts",
    "analytics",
    "approval",
    "audit",
    "compliance",
    "conversation",
    "cost-center",
    "dashboard",
    "dispatch",
    "division-inventory",
    "domain-wizard",
    "explainability",
    "feature-flags",
    "governance-compliance",
    "health",
    "hitl",
    "incidents",
    "inspect",
    "marketplace",
    "memory-review",
    "mission-console",
    "policy",
    "queues",
    "release-console",
    "settings",
    "stability",
    "takeover",
    "task-cockpit",
    "trace-explorer",
    "workers",
    "workflow-builder",
    "workflow-cockpit",
    "workflow-debugger",
].map((featureName) => [
    `@aa/feature-${featureName}`,
    fromUiRoot(`packages/features/${featureName}/src/index.tsx`),
]));
function resolveConnectSrcOrigins(env) {
    const candidates = [env.VITE_API_BASE_URL, env.VITE_WS_URL, env.VITE_OTLP_ENDPOINT]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .map((value) => {
        const url = new URL(value);
        if (url.protocol === "ws:" || url.protocol === "wss:") {
            return `${url.protocol}//${url.host}`;
        }
        return url.origin;
    });
    return Array.from(new Set(candidates));
}
export function buildCspHeader(env, options = {}) {
    const connectSrc = ["'self'", ...resolveConnectSrcOrigins(env)].join(" ");
    const scriptSrc = options.allowInlineDevScript ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'";
    return [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline'",
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
function resolveBundleAssetPath(value) {
    return value.replace(/^\.?\//, "").replace(/[?#].*$/u, "");
}
function resolveIntegrity(source) {
    return `sha384-${createHash("sha384").update(source).digest("base64")}`;
}
export function applySubresourceIntegrity(bundle) {
    const integrityLookup = new Map();
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
    indexHtml.source = indexHtml.source.replace(/<(script|link)\b([^>]*?)\b(src|href)="([^"]+)"([^>]*)>/g, (full, tagName, before, attributeName, assetPath, after) => {
        if (/\bintegrity=/.test(before) || /\bintegrity=/.test(after)) {
            return full;
        }
        const rel = full.match(/\brel="([^"]+)"/i)?.[1]?.toLowerCase() ?? "";
        if (tagName === "link" && (rel === "modulepreload" || rel === "preload")) {
            return /\bcrossorigin=/.test(before) || /\bcrossorigin=/.test(after)
                ? full
                : `<${tagName}${before} ${attributeName}="${assetPath}" crossorigin="anonymous"${after}>`;
        }
        const resolvedAssetPath = resolveBundleAssetPath(assetPath);
        const integrity = integrityLookup.get(resolvedAssetPath);
        if (integrity == null) {
            return full;
        }
        const hasCrossOrigin = /\bcrossorigin=/.test(before) || /\bcrossorigin=/.test(after);
        const crossOriginAttribute = hasCrossOrigin ? "" : ' crossorigin="anonymous"';
        return `<${tagName}${before} ${attributeName}="${assetPath}" integrity="${integrity}"${crossOriginAttribute}${after}>`;
    });
}
function attachCspHeader(response, cspHeader) {
    response.setHeader("Content-Security-Policy", cspHeader);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
}
function createCspHeadersPlugin(cspHeader) {
    return {
        name: "csp-headers",
        generateBundle(_, bundle) {
            applySubresourceIntegrity(bundle);
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
    const cspHeader = buildCspHeader(env, { allowInlineDevScript: mode !== "production" });
    const uiHost = env.AA_UI_HOST ?? testTarget.host;
    const uiPreviewPort = Number.parseInt(env.AA_UI_PORT ?? String(testTarget.port), 10);
    const uiDevPort = Number.parseInt(env.AA_UI_DEV_PORT ?? String(uiPreviewPort + 1000), 10);
    return {
        plugins: [react(), tsconfigPaths(), createCspHeadersPlugin(cspHeader)],
        define: {
            "process.env.NODE_ENV": JSON.stringify(mode),
        },
        resolve: {
            extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
            alias: {
                ...sharedPackageAliases,
                ...featurePackageAliases,
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
