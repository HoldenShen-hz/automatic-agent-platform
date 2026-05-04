import type { AuthSession } from "./types";

const DEFAULT_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry
const SESSION_STORAGE_KEY = "aa.auth.session";

/**
 * Secure storage interface for token persistence.
 * Allows different implementations (memory, platform-native, etc.)
 */
export interface SecureTokenStorage {
  readSession(): AuthSession | null;
  writeSession(session: AuthSession): void;
  clearSession(): void;
}

/**
 * In-memory storage fallback when secure storage is unavailable.
 * Note: Tokens will be lost on page refresh with this implementation.
 */
class InMemoryTokenStorage implements SecureTokenStorage {
  private session: AuthSession | null = null;

  readSession(): AuthSession | null {
    return this.session;
  }

  writeSession(session: AuthSession): void {
    this.session = session;
  }

  clearSession(): void {
    this.session = null;
  }
}

/**
 * SessionStorage-based persistence for development/testing.
 * Uses sessionStorage which persists across page refreshes but not across tabs.
 * This is a step up from pure in-memory but not production-secure.
 * Production should use platform-native secure storage (Keychain/Keystore).
 */
class SessionStorageTokenStorage implements SecureTokenStorage {
  readSession(): AuthSession | null {
    try {
      const stored = globalThis.sessionStorage?.getItem(SESSION_STORAGE_KEY);
      if (stored == null) return null;
      return JSON.parse(stored) as AuthSession;
    } catch {
      return null;
    }
  }

  writeSession(session: AuthSession): void {
    try {
      globalThis.sessionStorage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage full or unavailable - fail silently
    }
  }

  clearSession(): void {
    try {
      globalThis.sessionStorage?.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Storage unavailable - fail silently
    }
  }
}

export class TokenManager {
  private session: AuthSession | null = null;
  private refreshPromise: Promise<AuthSession | null> | null = null;
  private readonly storage: SecureTokenStorage;

  public constructor(storage?: SecureTokenStorage) {
    // R22-01 FIX: Use provided storage or default to sessionStorage for persistence.
    // SessionStorage persists across page refreshes (unlike pure in-memory).
    // Production deployments should provide platform-native secure storage via PlatformAdapter.
    this.storage = storage ?? new SessionStorageTokenStorage();
    // Load any existing session from persistent storage
    this.session = this.storage.readSession();
  }

  public setSession(session: AuthSession): void {
    this.session = session;
    // R22-01 FIX: Persist session to secure storage for cross-refresh persistence
    this.storage.writeSession(session);
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
    // R22-01 FIX: Clear session from persistent storage on logout
    this.storage.clearSession();
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
      // R22-01 FIX: Persist refreshed session to secure storage
      this.storage.writeSession(newSession);
      return newSession;
    } catch {
      // Refresh failed - keep existing session
      return this.session;
    }
  }
}
