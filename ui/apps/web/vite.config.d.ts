export declare function buildCspHeader(env: Record<string, string | undefined>): string;
export declare function applySubresourceIntegrity(bundle: Record<string, {
    type: "asset" | "chunk";
    source?: string | Uint8Array;
    code?: string;
    fileName: string;
}>): void;
declare const _default: import("vite").UserConfigFnObject;
export default _default;
