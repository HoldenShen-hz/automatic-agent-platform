export type PlatformAppKind = "api" | "console" | "worker";

export interface PlatformAppManifest {
  appId: string;
  kind: PlatformAppKind;
  entryModule: string;
  defaultPort: number | null;
  healthEndpoint: string | null;
  capabilities: string[];
}

export const API_APP_MANIFEST: PlatformAppManifest = {
  appId: "automatic-agent-api",
  kind: "api",
  entryModule: "src/platform/interface/api/http-api-server.ts",
  defaultPort: 8004,
  healthEndpoint: "/health",
  capabilities: ["http_api", "approval_queue", "inspect", "dashboard"],
};
