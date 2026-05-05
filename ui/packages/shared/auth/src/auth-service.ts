import { TokenManager } from "./token-manager";
import type { AuthIdentity, AuthSession } from "./types";

/**
 * Authorization code flow state for PKCE per §5.4.4.
 */
export interface AuthCodeFlowState {
  readonly codeVerifier: string;
  readonly codeChallenge: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly createdAt: number;
}

export class AuthService {
  private codeFlowState: AuthCodeFlowState | null = null;
  private readonly codeVerifierChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  public constructor(private readonly tokenManager: TokenManager = new TokenManager()) {
    this.tokenManager.setUnauthorizedHandler(() => this.redirectToAuthorizationFlow());
  }

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

  /**
   * Initiates authorization code flow with PKCE per §5.4.4.
   * Returns the authorization URL to redirect to.
   */
  public async initiateCodeFlow(redirectUri: string): Promise<string> {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = this.generateState();

    this.codeFlowState = {
      codeVerifier,
      codeChallenge,
      redirectUri,
      state,
      createdAt: Date.now(),
    };

    // In production, this would construct the actual OAuth authorization URL
    // For now, return a placeholder that the app shell would use
    return `/authorize?code_challenge=${encodeURIComponent(codeChallenge)}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  /**
   * Completes authorization code flow per §5.4.4.
   * Exchanges authorization code for tokens using the code verifier.
   * Does NOT accept tokens directly from URL query parameters.
   */
  public async handleAuthorizationCallback(params: URLSearchParams): Promise<AuthSession> {
    const state = params.get("state");
    const authCode = params.get("code");
    const error = params.get("error");

    // Validate state to prevent CSRF
    if (this.codeFlowState === null) {
      throw new Error("auth.no_pending_flow:No pending authorization code flow");
    }

    if (error !== null) {
      throw new Error(`auth.authorization_failed:${error}`);
    }

    if (state !== this.codeFlowState.state) {
      throw new Error("auth.state_mismatch:State parameter mismatch - possible CSRF attack");
    }

    // Check for expired flow (10 minute window)
    if (Date.now() - this.codeFlowState.createdAt > 10 * 60 * 1000) {
      this.codeFlowState = null;
      throw new Error("auth.flow_expired:Authorization code flow expired");
    }

    if (authCode === null) {
      throw new Error("auth.missing_code:Authorization code not provided");
    }

    // In production, this would exchange the code with the authorization server
    // using the code verifier. The server returns access_token and refresh_token.
    // We simulate this with a mock response for now.
    const session = await this.exchangeCodeForTokens(authCode, this.codeFlowState.codeVerifier, this.codeFlowState.redirectUri);
    this.codeFlowState = null;
    return session;
  }

  /**
   * Handles SSO callback - redirects to authorization server for code flow per §5.4.4.
   * Does NOT accept tokens directly from URL query (prevents token leakage).
   */
  public async handleSsoCallback(_params: URLSearchParams): Promise<never> {
    await this.redirectToAuthorizationFlow();
    // This function should not return - we navigate away
    throw new Error("auth.redirecting:Redirecting to authorization server");
  }

  private async exchangeCodeForTokens(code: string, _codeVerifier: string, _redirectUri: string): Promise<AuthSession> {
    // In production: POST to /oauth/token with code, code_verifier, redirect_uri
    // Server validates and returns { access_token, refresh_token, expires_in }
    // For mock purposes, we return a simulated session
    void code; // Will be used in real implementation
    return this.login(`mock-access-token-${Date.now()}`, `mock-refresh-token-${Date.now()}`, 3600);
  }

  private async redirectToAuthorizationFlow(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }
    const redirectUri = `${window.location.origin}/auth/callback`;
    const authUrl = await this.initiateCodeFlow(redirectUri);
    window.location.href = authUrl;
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => this.codeVerifierChars[byte % this.codeVerifierChars.length]).join("");
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  private generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
}
