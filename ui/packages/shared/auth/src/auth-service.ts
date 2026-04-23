import { TokenManager } from "./token-manager";
import type { AuthSession } from "./types";

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

  public handleSsoCallback(params: URLSearchParams): AuthSession {
    const accessToken = params.get("access_token") ?? "mock-access-token";
    const refreshToken = params.get("refresh_token") ?? "mock-refresh-token";
    return this.login(accessToken, refreshToken);
  }
}
