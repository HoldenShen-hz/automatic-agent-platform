import type { PlatformAppManifest } from "../../platform-architecture-types.js";

export const API_APP_MANIFEST: PlatformAppManifest = {
  appId: "automatic-agent-api",
  kind: "api",
  entryModule: "src/platform/five-plane-interface/api/http-api-server.ts",
  defaultPort: 8004,
  healthEndpoint: "/health",
  capabilities: ["http_api", "approval_queue", "inspect", "dashboard"],
  requiredLayers: ["platform", "domains", "interaction", "org-governance", "scale-ecosystem", "ops-maturity", "plugins", "sdk", "apps"],
  startupCommand: "npm run api",
  startupMode: "daemon",
};
