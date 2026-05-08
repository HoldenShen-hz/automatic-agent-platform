import type { AuthSession } from "./types";

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

  public hasActiveSession(now = Date.now()): boolean {
    return !this.isExpired(now);
  }

  public getAccessToken(): string | null {
    return this.session?.accessToken ?? null;
  }

  public clear(): void {
    this.session = null;
  }
}
