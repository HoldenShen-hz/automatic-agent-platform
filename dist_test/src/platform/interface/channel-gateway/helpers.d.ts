import type { TrackedGatewayDeliveryPayload } from "./types.js";
export declare function parseMetadata(raw: string | null): Record<string, unknown>;
export declare function requireNonEmpty(value: string, code: string): string;
export declare function readTrackedDeliveryPayload(payload: Record<string, unknown>): TrackedGatewayDeliveryPayload | null;
