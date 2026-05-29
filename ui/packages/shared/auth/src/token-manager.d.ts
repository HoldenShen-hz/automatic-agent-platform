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
export declare class TokenManager {
    private readonly options;
    private session;
    private inFlightRefresh;
    constructor(options?: TokenManagerOptions);
    setSession(session: AuthSession): void;
    getSession(): AuthSession | null;
    isExpired(now?: number): boolean;
    hasActiveSession(now?: number): boolean;
    getAccessToken(): string | null;
    getToken(): string | null;
    shouldRefresh(now?: number): boolean;
    getAccessTokenWithRefresh(now?: number): Promise<string | null>;
    handleUnauthorized(): Promise<void>;
    clear(): void;
}
