export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}

export class TokenManager {
  private session: AuthSession | null = null;

  public setSession(session: AuthSession): void {
    this.session = session;
  }

  public getSession(): AuthSession | null {
    return this.session;
  }

  public isExpired(now = Date.now()): boolean {
    return this.session == null || this.session.expiresAt <= now;
  }

  public clear(): void {
    this.session = null;
  }
}

export class SessionGuard {
  public constructor(private readonly tokenManager: TokenManager = new TokenManager()) {}

  public requireAuthenticated(): AuthSession {
    const session = this.tokenManager.getSession();
    if (session == null || this.tokenManager.isExpired()) {
      throw new Error("auth.session_required");
    }
    return session;
  }
}

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
