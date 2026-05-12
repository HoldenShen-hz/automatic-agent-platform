import { TokenManager } from "./token-manager";
import type { AuthIdentity, AuthSession } from "./types";

export class AuthService {
  public constructor(private readonly tokenManager: TokenManager = new TokenManager()) {}

  public login(accessToken: string, refreshToken: string, ttlSeconds = 3600): AuthSession {
    const session: AuthSession = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
    this.tokenManager.setSession(session);
    return session;
  }

  public logout(): void {
    this.tokenManager.clear();
  }

  public getSession(): AuthSession | null {
    return this.tokenManager.getSession();
  }

  public isAuthenticated(now = Date.now()): boolean {
    return this.tokenManager.hasActiveSession(now);
  }

  public resolveIdentity(params: URLSearchParams): AuthIdentity {
    return {
      locale: params.get("locale") ?? "zh-CN",
      displayName: params.get("display_name") ?? "Platform Operator",
    };
  }

  public async handleSsoCallback(params: URLSearchParams): Promise<AuthSession> {
    if (params.has("access_token") || params.has("refresh_token")) {
      throw new Error("auth.redirecting");
    }
    throw new Error("auth.redirecting");
  }
}
