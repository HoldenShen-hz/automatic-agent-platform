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
export declare class AuthService {
    private readonly tokenManager;
    private readonly options;
    private pendingCodeFlow;
    constructor(tokenManager?: TokenManager, options?: AuthServiceOptions);
    login(accessToken: string, refreshToken: string, ttlSeconds?: number): AuthSession;
    logout(): void;
    getSession(): AuthSession | null;
    isAuthenticated(now?: number): boolean;
    resolveIdentity(params: URLSearchParams): AuthIdentity;
    initiateCodeFlow(redirectUri: string): Promise<string>;
    handleAuthorizationCallback(params: URLSearchParams): Promise<AuthSession>;
    handleSsoCallback(params: URLSearchParams): Promise<AuthSession>;
    private getPendingCodeFlow;
    private persistPendingCodeFlow;
}
