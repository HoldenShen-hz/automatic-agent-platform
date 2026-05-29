import { describe, expect, it } from "vitest";
import { createAuthInterceptor } from "@aa/shared-api-client";
import { AuthService, TokenManager } from "@aa/shared-auth";
import { createWebRuntimeClients } from "../../apps/web/src/runtime";
describe("sso login flow", () => {
    it("fails closed on url token callbacks, forwards bearer auth through the runtime, and refreshes expiring tokens", async () => {
        const tokenManager = new TokenManager({
            refreshFn: async (refreshToken) => ({
                accessToken: `${refreshToken}-refreshed`,
                refreshToken: `${refreshToken}-rotated`,
                expiresIn: 3600,
            }),
        });
        const authService = new AuthService(tokenManager);
        await expect(authService.handleSsoCallback(new URLSearchParams("access_token=access-1&refresh_token=refresh-1&locale=en-US"))).rejects.toThrow(/auth.redirecting/);
        const session = authService.login("access-1", "refresh-1", 3600);
        expect(session.accessToken).toBe("access-1");
        expect(authService.isAuthenticated()).toBe(true);
        const runtime = createWebRuntimeClients({
            apiBaseUrl: "https://api.example.test",
            tenantId: "tenant-123",
            tokenManager,
        });
        const interceptor = createAuthInterceptor(runtime.tokenManager);
        const initialRequest = await interceptor.onRequest({
            path: "/api/v1/tasks",
            method: "GET",
            headers: new Headers(),
        });
        expect(initialRequest.headers.get("authorization")).toBe("Bearer access-1");
        tokenManager.setSession({
            accessToken: "access-1",
            refreshToken: "refresh-1",
            expiresAt: Date.now() + 1_000,
        });
        const refreshedRequest = await interceptor.onRequest({
            path: "/api/v1/tasks",
            method: "GET",
            headers: new Headers(),
        });
        expect(refreshedRequest.headers.get("authorization")).toBe("Bearer refresh-1-refreshed");
        expect(tokenManager.getSession()?.refreshToken).toBe("refresh-1-rotated");
        expect(runtime.tokenManager).toBe(tokenManager);
    });
});
