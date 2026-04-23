import type { FederatedTokenClaims } from "./types.js";
export declare function decodeJwtJsonSegment(segment: string, kind: "header" | "payload"): unknown;
export declare function parseJwtHeader(value: unknown): {
    kid?: string;
    alg?: string;
};
export declare function parseFederatedTokenClaims(value: unknown): FederatedTokenClaims;
