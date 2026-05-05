import type { AuthSession } from "./types";

const DEFAULT_REFRESH_THRESHOLD_MS = 60 * 1000; // 60 seconds before expiry per §5.4.4
const SESSION_STORAGE_KEY = "aa.auth.session";

export interface RefreshTokenResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export interface TokenManagerOptions {
  readonly storage?: SecureTokenStorage;
  readonly refreshThresholdMs?: number;
  readonly refreshFn?: (refreshToken: string) => Promise<RefreshTokenResult>;
  readonly onUnauthorized?: () => void | Promise<void>;
}

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

function isSecureTokenStorage(value: unknown): value is SecureTokenStorage {
  return typeof value === "object"
    && value !== null
    && typeof (value as SecureTokenStorage).readSession === "function"
    && typeof (value as SecureTokenStorage).writeSession === "function"
    && typeof (value as SecureTokenStorage).clearSession === "function";
}

export class TokenManager {
  private session: AuthSession | null = null;
  private refreshPromise: Promise<AuthSession | null> | null = null;
  private readonly storage: SecureTokenStorage;
  private readonly refreshThresholdMs: number;
  private refreshFn: ((refreshToken: string) => Promise<RefreshTokenResult>) | null;
  private onUnauthorized: (() => void | Promise<void>) | null;
  private unauthorizedPromise: Promise<void> | null = null;

  public constructor(optionsOrStorage?: TokenManagerOptions | SecureTokenStorage) {
    const options = isSecureTokenStorage(optionsOrStorage)
      ? { storage: optionsOrStorage }
      : (optionsOrStorage ?? {});

    this.storage = options.storage ?? new SessionStorageTokenStorage();
    this.refreshThresholdMs = options.refreshThresholdMs ?? DEFAULT_REFRESH_THRESHOLD_MS;
    this.refreshFn = options.refreshFn ?? null;
    this.onUnauthorized = options.onUnauthorized ?? null;
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

  public shouldRefresh(now = Date.now()): boolean {
    return this.session !== null && this.session.expiresAt - now <= this.refreshThresholdMs;
  }

  public setRefreshHandler(refreshFn: ((refreshToken: string) => Promise<RefreshTokenResult>) | null): void {
    this.refreshFn = refreshFn;
  }

  public setUnauthorizedHandler(handler: (() => void | Promise<void>) | null): void {
    this.onUnauthorized = handler;
  }

  /**
   * Returns access token, refreshing if needed per §5.4.4.
   * Uses refresh lock to prevent concurrent refresh requests.
   */
  public async getAccessTokenWithRefresh(
    refreshFn?: () => Promise<RefreshTokenResult>,
  ): Promise<string | null> {
    if (this.session === null) {
      return null;
    }

    if (this.shouldRefresh()) {
      const effectiveRefresh = refreshFn ?? this.buildRefreshRequest();
      if (effectiveRefresh === undefined) {
        return this.isExpired() ? null : this.session.accessToken;
      }
      const pendingRefresh = this.refreshPromise ?? this.refreshSession(effectiveRefresh);
      this.refreshPromise = pendingRefresh;
      try {
        const newSession = await pendingRefresh;
        return newSession?.accessToken ?? null;
      } finally {
        if (this.refreshPromise === pendingRefresh) {
          this.refreshPromise = null;
        }
      }
    }

    return this.session.accessToken;
  }

  public async handleUnauthorized(): Promise<void> {
    this.clear();
    if (this.onUnauthorized == null) {
      return;
    }
    const pending = this.unauthorizedPromise ?? Promise.resolve(this.onUnauthorized());
    this.unauthorizedPromise = pending;
    try {
      await pending;
    } finally {
      if (this.unauthorizedPromise === pending) {
        this.unauthorizedPromise = null;
      }
    }
  }

  public clear(): void {
    this.session = null;
    this.refreshPromise = null;
    // R22-01 FIX: Clear session from persistent storage on logout
    this.storage.clearSession();
  }

  private buildRefreshRequest(): (() => Promise<RefreshTokenResult>) | undefined {
    if (this.refreshFn == null || this.session == null) {
      return undefined;
    }
    return () => this.refreshFn!(this.session!.refreshToken);
  }

  private async refreshSession(refreshFn: () => Promise<RefreshTokenResult>): Promise<AuthSession | null> {
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
      if (this.session !== null && this.session.expiresAt > Date.now()) {
        return this.session;
      }
      await this.handleUnauthorized();
      return null;
    }
  }
}
