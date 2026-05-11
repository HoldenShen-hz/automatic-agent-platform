import type { AuthSession } from "./types";

export interface TokenRefreshResult {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: number;
  readonly expiresIn?: number;
}

export interface TokenManagerOptions {
  readonly refreshWindowMs?: number;
  readonly refreshFn?: (refreshToken: string) => Promise<TokenRefreshResult>;
  readonly onUnauthorized?: () => void | Promise<void>;
}

export class TokenManager {
  private session: AuthSession | null = null;
  private inFlightRefresh: Promise<string | null> | null = null;

  public constructor(private readonly options: TokenManagerOptions = {}) {}

  public setSession(session: AuthSession): void {
    this.session = session;
  }

  public getSession(): AuthSession | null {
    return this.session;
  }

  public isExpired(now = Date.now()): boolean {
    return this.session == null || this.session.expiresAt <= now;
  }

  public hasActiveSession(now = Date.now()): boolean {
    return !this.isExpired(now);
  }

  public getAccessToken(): string | null {
    return this.session?.accessToken ?? null;
  }

  public getToken(): string | null {
    return this.getAccessToken();
  }

  public shouldRefresh(now = Date.now()): boolean {
    if (this.session == null) {
      return false;
    }
    return this.session.expiresAt - now <= (this.options.refreshWindowMs ?? 60_000);
  }

  public async getAccessTokenWithRefresh(now = Date.now()): Promise<string | null> {
    if (this.session == null) {
      return null;
    }

    if (!this.shouldRefresh(now)) {
      return this.session.accessToken;
    }

    if (this.options.refreshFn == null) {
      if (this.isExpired(now)) {
        await this.handleUnauthorized();
        return null;
      }
      return this.session.accessToken;
    }

    if (this.inFlightRefresh != null) {
      return await this.inFlightRefresh;
    }

    const previousSession = this.session;
    this.inFlightRefresh = this.options.refreshFn(previousSession.refreshToken)
      .then((result) => {
        const refreshedSession: AuthSession = {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken ?? previousSession.refreshToken,
          expiresAt: result.expiresAt ?? Date.now() + (result.expiresIn ?? 3600) * 1000,
        };
        this.session = refreshedSession;
        return refreshedSession.accessToken;
      })
      .catch(async () => {
        if (this.isExpired(now)) {
          await this.handleUnauthorized();
          return null;
        }
        return this.session?.accessToken ?? null;
      })
      .finally(() => {
        this.inFlightRefresh = null;
      });

    return await this.inFlightRefresh;
  }

  public async handleUnauthorized(): Promise<void> {
    this.clear();
    await this.options.onUnauthorized?.();
  }

  public clear(): void {
    this.session = null;
  }
}
