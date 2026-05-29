import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicTokenRequiredError, createAuthInterceptor } from "@aa/shared-api-client";
import { UiRuntimeProvider, createTieredQueryClientFactory, useAuthState } from "@aa/shared-state";
function createRequest(method = "GET") {
    return {
        path: "/api/v1/tasks",
        method,
        headers: new Headers(),
    };
}
describe("reaudit batch R26-56 / 58 / 59 / 60 / 61 / 65", () => {
    it("R26-56 auth interceptor rejects static strings, single-flights refresh, and retries 401 once", async () => {
        const staticInterceptor = createAuthInterceptor("static-token");
        await expect(staticInterceptor.onRequest?.(createRequest())).rejects.toBeInstanceOf(DynamicTokenRequiredError);
        let resolveRefresh;
        const resolver = {
            getAccessToken() {
                return "stale-token";
            },
            shouldRefresh() {
                return true;
            },
            getAccessTokenWithRefresh: vi.fn(() => new Promise((resolvePromise) => {
                resolveRefresh = resolvePromise;
            })),
            handleUnauthorized: vi.fn(async () => undefined),
        };
        const interceptor = createAuthInterceptor(resolver);
        const pendingFirst = interceptor.onRequest?.(createRequest());
        const pendingSecond = interceptor.onRequest?.(createRequest());
        resolveRefresh("fresh-token");
        const [firstResolved, secondResolved] = await Promise.all([pendingFirst, pendingSecond]);
        expect(resolver.getAccessTokenWithRefresh).toHaveBeenCalledTimes(1);
        expect(firstResolved?.headers.get("authorization")).toBe("Bearer fresh-token");
        expect(secondResolved?.headers.get("authorization")).toBe("Bearer fresh-token");
        resolver.getAccessTokenWithRefresh.mockResolvedValue("fresh-token");
        let attempts = 0;
        expect(typeof interceptor.intercept).toBe("function");
        const intercept = interceptor.intercept;
        if (intercept == null) {
            throw new Error("expected interceptor.intercept to be defined");
        }
        const response = await intercept(createRequest(), async (request) => {
            attempts += 1;
            return attempts === 1
                ? { status: 401, data: { ok: false } }
                : { status: 200, data: { ok: request.headers.get("authorization") === "Bearer fresh-token" } };
        });
        expect(attempts).toBe(2);
        expect(response).toEqual({ status: 200, data: { ok: true } });
    });
    it("R26-58 task stamping no longer depends on a turborepo manifest", () => {
        expect(() => readFileSync(resolve(process.cwd(), "turbo.json"), "utf8")).toThrow();
        const source = readFileSync(resolve(process.cwd(), "scripts/run-task-with-stamp.mjs"), "utf8");
        expect(source).toContain('join(process.cwd(), ".turbo", "tasks"');
    });
    it("R26-59 web vite config disables production sourcemaps and keeps CSP inline with explicit connect origins", () => {
        const source = readFileSync(resolve(process.cwd(), "apps/web/vite.config.ts"), "utf8");
        expect(source).toContain('sourcemap: mode === "production" ? false : true');
        expect(source).toContain("worker-src 'self' blob:");
        expect(source).toContain("resolveConnectSrcOrigins");
        expect(source).toContain('name: "csp-headers"');
    });
    it("R26-60 feature modules expose translated copy and independent route definitions", () => {
        const featureRoot = resolve(process.cwd(), "packages/features");
        const featureIds = readdirSync(featureRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
        const zhCatalog = readFileSync(resolve(process.cwd(), "packages/shared/i18n/src/catalogs/zh-CN.ts"), "utf8");
        expect(featureIds.length).toBeGreaterThanOrEqual(27);
        for (const featureId of featureIds) {
            const source = readFileSync(resolve(featureRoot, featureId, "src/index.tsx"), "utf8");
            expect(source).toContain(`translateFeatureCopy("${featureId}")`);
            expect(source).toContain("path: \"/");
            expect(zhCatalog).toContain(`"ui.feature.${featureId}.title"`);
            expect(zhCatalog).toContain(`"ui.feature.${featureId}.summary"`);
        }
    });
    it("R26-61 UiRuntimeProvider does not inject a mock token when no auth params are present", async () => {
        window.history.replaceState({}, "", "/");
        function Harness() {
            const authenticated = useAuthState((state) => state.authenticated);
            const displayName = useAuthState((state) => state.displayName);
            return createElement("div", undefined, `${String(authenticated)}:${displayName}`);
        }
        render(createElement(UiRuntimeProvider, undefined, createElement(Harness)));
        await waitFor(() => {
            expect(screen.getByText("false:Platform Operator")).toBeInTheDocument();
        });
    });
    it("R26-65 query client still supports per-tier stale time overrides", () => {
        expect(createTieredQueryClientFactory("tasks").getDefaultOptions().queries?.staleTime).toBe(300_000);
        expect(createTieredQueryClientFactory("approvals").getDefaultOptions().queries?.staleTime).toBe(300_000);
        expect(createTieredQueryClientFactory("config").getDefaultOptions().queries?.staleTime).toBe(3_600_000);
    });
});
