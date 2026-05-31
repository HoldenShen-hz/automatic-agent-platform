import { TokenManager } from "./token-manager.js";
import type { AuthIdentity, AuthSession } from "./types.js";

export interface AuthServiceOptions {
  readonly authorizationEndpoint?: string;
  readonly clientId?: string;
  readonly exchangeCodeForTokens?: (params: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }) => Promise<AuthSession>;
}

interface PendingCodeFlow {
  readonly state: string;
  readonly redirectUri: string;
  readonly codeVerifier: string;
}

const PENDING_CODE_FLOW_STORAGE_KEY = "aa.auth.pending-code-flow";

export class AuthService {
  private pendingCodeFlow: PendingCodeFlow | null = null;

  public constructor(
    private readonly tokenManager: TokenManager = new TokenManager(),
    private readonly options: AuthServiceOptions = {},
  ) {}

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
    const roles = params.get("roles");
    const permissions = params.get("permissions");
    return {
      locale: params.get("locale") ?? "zh-CN",
      displayName: params.get("display_name") ?? "Platform Operator",
      userId: params.get("user_id") ?? "platform-operator",
      tenantId: params.get("tenant_id") ?? "default-tenant",
      roles: roles == null || roles.length === 0 ? ["operator"] : roles.split(",").map((role) => role.trim()).filter((role) => role.length > 0),
      permissions: permissions == null || permissions.length === 0 ? [] : permissions.split(",").map((permission) => permission.trim()).filter((permission) => permission.length > 0),
    };
  }

  public async initiateCodeFlow(redirectUri: string): Promise<string> {
    const state = generateId();
    const codeVerifier = createCodeVerifier();
    const codeChallenge = await deriveCodeChallenge(codeVerifier);
    this.persistPendingCodeFlow({
      state,
      redirectUri,
      codeVerifier,
    });

    const params = new URLSearchParams({
      client_id: this.options.clientId ?? "automatic-agent-platform-ui",
      redirect_uri: redirectUri,
      response_type: "code",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    });

    return `${this.options.authorizationEndpoint ?? "https://auth.example.com/oauth/authorize"}?${params.toString()}`;
  }

  public async handleAuthorizationCallback(params: URLSearchParams): Promise<AuthSession> {
    if (params.has("error")) {
      throw new Error("auth.authorization_failed");
    }

    const pendingFlow = this.getPendingCodeFlow();
    if (pendingFlow == null) {
      throw new Error("auth.no_pending_flow");
    }

    const state = params.get("state");
    if (state !== pendingFlow.state) {
      throw new Error("auth.state_mismatch");
    }

    const code = params.get("code");
    if (code == null || code.length === 0) {
      throw new Error("auth.missing_code");
    }

    if (this.options.exchangeCodeForTokens == null) {
      throw new Error("auth.token_exchange_not_configured");
    }

    const session = await this.options.exchangeCodeForTokens({
      code,
      redirectUri: pendingFlow.redirectUri,
      codeVerifier: pendingFlow.codeVerifier,
    });
    this.tokenManager.setSession(session);
    this.persistPendingCodeFlow(null);
    return session;
  }

  public async handleSsoCallback(params: URLSearchParams): Promise<AuthSession> {
    if (params.has("access_token") || params.has("refresh_token")) {
      clearAuthorizationArtifactsFromHistory();
      throw new Error("auth.redirecting");
    }
    if (params.has("code") || params.has("state") || params.has("error")) {
      const session = await this.handleAuthorizationCallback(params);
      clearAuthorizationArtifactsFromHistory();
      return session;
    }
    throw new Error("auth.redirecting");
  }

  private getPendingCodeFlow(): PendingCodeFlow | null {
    if (this.pendingCodeFlow != null) {
      return this.pendingCodeFlow;
    }
    const storage = getSessionStorage();
    if (storage == null) {
      return null;
    }
    const raw = storage.getItem(PENDING_CODE_FLOW_STORAGE_KEY);
    if (raw == null) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<PendingCodeFlow>;
      if (
        typeof parsed.state !== "string"
        || typeof parsed.redirectUri !== "string"
        || typeof parsed.codeVerifier !== "string"
      ) {
        storage.removeItem(PENDING_CODE_FLOW_STORAGE_KEY);
        return null;
      }
      this.pendingCodeFlow = {
        state: parsed.state,
        redirectUri: parsed.redirectUri,
        codeVerifier: parsed.codeVerifier,
      };
      return this.pendingCodeFlow;
    } catch {
      storage.removeItem(PENDING_CODE_FLOW_STORAGE_KEY);
      return null;
    }
  }

  private persistPendingCodeFlow(flow: PendingCodeFlow | null): void {
    this.pendingCodeFlow = flow;
    const storage = getSessionStorage();
    if (storage == null) {
      return;
    }
    if (flow == null) {
      try {
        storage.removeItem(PENDING_CODE_FLOW_STORAGE_KEY);
      } catch {
        // Ignore storage cleanup failures in restricted browser contexts.
      }
      return;
    }
    try {
      storage.setItem(PENDING_CODE_FLOW_STORAGE_KEY, JSON.stringify(flow));
    } catch {
      // Ignore storage persistence failures in restricted browser contexts.
    }
  }
}

async function deriveCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = new Uint8Array(await getCryptoApi().subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier)));
  return base64UrlEncodeBytes(digest);
}

function createCodeVerifier(): string {
  const bytes = new Uint8Array(48);
  getCryptoApi().getRandomValues(bytes);
  return base64UrlEncodeBytes(bytes);
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function getCryptoApi(): Crypto {
  if (globalThis.crypto == null) {
    throw new Error("auth.crypto_unavailable");
  }
  return globalThis.crypto;
}

function generateId(): string {
  const cryptoApi = getCryptoApi();
  if (typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function clearAuthorizationArtifactsFromHistory(): void {
  if (typeof window === "undefined" || typeof window.history?.replaceState !== "function") {
    return;
  }
  const url = new URL(window.location.href);
  url.hash = "";
  for (const key of ["code", "state", "session_state", "access_token", "refresh_token", "error", "error_description"]) {
    url.searchParams.delete(key);
  }
  window.history.replaceState(null, document.title, `${url.pathname}${url.search}`);
}
