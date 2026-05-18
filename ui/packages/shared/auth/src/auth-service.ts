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
    const state = crypto.randomUUID();
    const codeVerifier = crypto.randomUUID().replace(/-/g, "");
    const codeChallenge = await deriveCodeChallenge(codeVerifier);
    this.pendingCodeFlow = {
      state,
      redirectUri,
      codeVerifier,
    };

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

    const pendingFlow = this.pendingCodeFlow;
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
    this.pendingCodeFlow = null;
    return session;
  }

  public async handleSsoCallback(params: URLSearchParams): Promise<AuthSession> {
    if (params.has("access_token") || params.has("refresh_token")) {
      throw new Error("auth.redirecting");
    }
    throw new Error("auth.redirecting");
  }
}

async function deriveCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return Buffer.from(digest)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
