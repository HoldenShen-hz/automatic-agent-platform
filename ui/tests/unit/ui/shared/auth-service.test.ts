import { describe, expect, it, vi } from "vitest";
import { AuthService, TokenManager } from "@aa/shared-auth";
import type { AuthIdentity } from "@aa/shared-auth";

describe("AuthService", () => {
  it("login creates session and token manager stores it", () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    const session = authService.login("access-token-123", "refresh-token-456", 3600);

    expect(session.accessToken).toBe("access-token-123");
    expect(session.refreshToken).toBe("refresh-token-456");
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    expect(tokenManager.getSession()?.accessToken).toBe("access-token-123");
  });

  it("logout clears the session", () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    authService.login("access-token", "refresh-token", 3600);
    expect(authService.isAuthenticated()).toBe(true);

    authService.logout();
    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.getSession()).toBeNull();
  });

  it("isAuthenticated returns false for expired session", () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    authService.login("access-token", "refresh-token", 0); // Already expired
    expect(authService.isAuthenticated()).toBe(false);
  });

  it("resolveIdentity extracts locale and displayName from params", () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    const params = new URLSearchParams("locale=en-US&display_name=TestUser");
    const identity = authService.resolveIdentity(params);

    expect(identity.locale).toBe("en-US");
    expect(identity.displayName).toBe("TestUser");
  });

  it("resolveIdentity uses defaults when params are missing", () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    const params = new URLSearchParams();
    const identity = authService.resolveIdentity(params);

    expect(identity.locale).toBe("zh-CN");
    expect(identity.displayName).toBe("Platform Operator");
  });

  it("initiateCodeFlow returns authorization URL with code challenge and state", async () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    const authUrl = await authService.initiateCodeFlow("https://app.example.com/auth/callback");

    expect(authUrl).toContain("code_challenge=");
    expect(authUrl).toContain("state=");
    expect(authUrl).toContain("redirect_uri=");
  });

  it("initiateCodeFlow generates unique state for each call", async () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    const url1 = await authService.initiateCodeFlow("https://app.example.com/auth/callback");
    const url2 = await authService.initiateCodeFlow("https://app.example.com/auth/callback");

    const state1 = new URLSearchParams(url1.split("?")[1]!).get("state");
    const state2 = new URLSearchParams(url2.split("?")[1]!).get("state");

    expect(state1).not.toBe(state2);
  });

  it("handleAuthorizationCallback rejects when no pending flow", async () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    const params = new URLSearchParams("state=test&code=auth-code");

    await expect(authService.handleAuthorizationCallback(params)).rejects.toThrow(/auth.no_pending_flow/);
  });

  it("handleAuthorizationCallback rejects when state does not match", async () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    await authService.initiateCodeFlow("https://app.example.com/auth/callback");

    const params = new URLSearchParams("state=wrong-state&code=auth-code");

    await expect(authService.handleAuthorizationCallback(params)).rejects.toThrow(/auth.state_mismatch/);
  });

  it("handleAuthorizationCallback rejects when auth code is missing", async () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    await authService.initiateCodeFlow("https://app.example.com/auth/callback");

    const authUrl = await authService.initiateCodeFlow("https://app.example.com/auth/callback");
    const state = new URLSearchParams(authUrl.split("?")[1]!).get("state")!;

    const params = new URLSearchParams(`state=${state}`); // No code

    await expect(authService.handleAuthorizationCallback(params)).rejects.toThrow(/auth.missing_code/);
  });

  it("handleAuthorizationCallback completes successfully with valid params", async () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    await authService.initiateCodeFlow("https://app.example.com/auth/callback");

    const authUrl = await authService.initiateCodeFlow("https://app.example.com/auth/callback");
    const state = new URLSearchParams(authUrl.split("?")[1]!).get("state")!;

    const params = new URLSearchParams(`state=${state}&code=valid-auth-code`);
    const session = await authService.handleAuthorizationCallback(params);

    expect(session.accessToken).toMatch(/^mock-access-token-/);
    expect(session.refreshToken).toMatch(/^mock-refresh-token-/);
  });

  it("handleAuthorizationCallback clears code flow state after success", async () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    await authService.initiateCodeFlow("https://app.example.com/auth/callback");

    const authUrl = await authService.initiateCodeFlow("https://app.example.com/auth/callback");
    const state = new URLSearchParams(authUrl.split("?")[1]!).get("state")!;
    await authService.handleAuthorizationCallback(new URLSearchParams(`state=${state}&code=auth-code`));

    const params = new URLSearchParams(`state=${state}&code=auth-code`);
    await expect(authService.handleAuthorizationCallback(params)).rejects.toThrow(/auth.no_pending_flow/);
  });

  it("handleSsoCallback redirects to authorization server - does NOT accept token in URL (Issue #2069)", async () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    const paramsWithTokens = new URLSearchParams("access_token=leaked-token&refresh_token=leaked-refresh");

    await expect(authService.handleSsoCallback(paramsWithTokens)).rejects.toThrow(/auth.redirecting/);
  });

  it("handleAuthorizationCallback rejects authorization error from server", async () => {
    const tokenManager = new TokenManager();
    const authService = new AuthService(tokenManager);

    await authService.initiateCodeFlow("https://app.example.com/auth/callback");

    const params = new URLSearchParams("error=access_denied&error_description=User+denied+access");

    await expect(authService.handleAuthorizationCallback(params)).rejects.toThrow(/auth.authorization_failed/);
  });

  it("refreshes only once for concurrent callers when token is inside the 60s window", async () => {
    const refreshFn = vi.fn(async (refreshToken: string) => ({
      accessToken: `${refreshToken}-next`,
      refreshToken: `${refreshToken}-rotated`,
      expiresIn: 3600,
    }));
    const tokenManager = new TokenManager({ refreshFn });
    tokenManager.setSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 30_000,
    });

    const [first, second] = await Promise.all([
      tokenManager.getAccessTokenWithRefresh(),
      tokenManager.getAccessTokenWithRefresh(),
    ]);

    expect(first).toBe("refresh-token-next");
    expect(second).toBe("refresh-token-next");
    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(tokenManager.getSession()?.refreshToken).toBe("refresh-token-rotated");
  });

  it("clears the session and invokes the unauthorized handler when expired refresh fails", async () => {
    const onUnauthorized = vi.fn(async () => undefined);
    const refreshFn = vi.fn(async () => {
      throw new Error("refresh failed");
    });
    const tokenManager = new TokenManager({ refreshFn, onUnauthorized });
    tokenManager.setSession({
      accessToken: "expired-token",
      refreshToken: "expired-refresh",
      expiresAt: Date.now() - 1000,
    });

    await expect(tokenManager.getAccessTokenWithRefresh()).resolves.toBeNull();

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(tokenManager.getSession()).toBeNull();
  });
});
