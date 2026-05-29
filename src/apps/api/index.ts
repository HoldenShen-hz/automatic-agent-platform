import * as apiEntrypointModule from "../../platform/five-plane-interface/api/http-api-server.js";

import type { PlatformAppManifest } from "../../platform-architecture-types.js";

void apiEntrypointModule;

export const API_APP_ENTRY_MODULE = "src/platform/five-plane-interface/api/http-api-server.ts";

export const API_APP_MANIFEST: PlatformAppManifest = {
  appId: "automatic-agent-api",
  kind: "api",
  entryModule: API_APP_ENTRY_MODULE,
  defaultPort: 8004,
  healthEndpoint: "/health",
  capabilities: ["http_api", "approval_queue", "inspect", "dashboard"],
  requiredLayers: ["platform", "domains", "interaction", "org-governance", "scale-ecosystem", "ops-maturity", "plugins", "sdk", "apps"],
  startupCommand: "npm run api",
  startupMode: "daemon",
};
