import type { ApiResponsePayload } from "./types.js";
export interface CorsConfig {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    maxAgeSeconds: number;
    credentials: boolean;
}
export declare const DEFAULT_CORS_CONFIG: CorsConfig;
export declare function parseAllowedOrigins(raw: string | undefined): string[];
export declare function normalizeCorsConfig(config: Partial<CorsConfig> | null | undefined): CorsConfig;
export declare function isOriginAllowed(origin: string | undefined, config: CorsConfig): boolean;
export declare function buildPreflightHeaders(origin: string | undefined, config: CorsConfig): Record<string, string>;
export declare function decorateResponseHeaders(payload: ApiResponsePayload, origin: string | undefined, corsConfig: CorsConfig): ApiResponsePayload;
