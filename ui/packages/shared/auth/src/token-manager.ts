import type { AuthSession } from "./types";

const DEFAULT_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry

export class TokenManager {
  private session: AuthSession | null = null;
  private refreshPromise: Promise<AuthSession | null> | null = null;

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

  /**
   * Returns access token, refreshing if needed per §5.4.4.
   * Uses refresh lock to prevent concurrent refresh requests.
   */
  public async getAccessTokenWithRefresh(refreshFn?: () => Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>): Promise<string | null> {
    if (this.session === null) {
      return null;
    }

    // Check if token needs refresh (within 5 minute threshold)
    if (this.session.expiresAt - Date.now() < DEFAULT_REFRESH_THRESHOLD_MS) {
      if (this.refreshPromise === null && refreshFn !== undefined) {
        this.refreshPromise = this.refreshSession(refreshFn);
      }

      if (this.refreshPromise !== null) {
        const newSession = await this.refreshPromise;
        this.refreshPromise = null;
        return newSession?.accessToken ?? null;
      }
    }

    return this.session.accessToken;
  }

  public clear(): void {
    this.session = null;
    this.refreshPromise = null;
  }

  private async refreshSession(refreshFn: () => Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>): Promise<AuthSession | null> {
    if (this.session === null) {
      return null;
    }

    try {
      const tokens = await refreshFn();
      const newSession: AuthSession = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + tokens.expiresIn * 1000,
      };
      this.session = newSession;
      return newSession;
    } catch {
      // Refresh failed - keep existing session
      return this.session;
    }
  }
}
