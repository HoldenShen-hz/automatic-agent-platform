export type PlatformAppKind = "api" | "console" | "worker";
export interface PlatformAppManifest {
    appId: string;
    kind: PlatformAppKind;
    entryModule: string;
    defaultPort: number | null;
    healthEndpoint: string | null;
    capabilities: string[];
}
export declare const API_APP_MANIFEST: PlatformAppManifest;
