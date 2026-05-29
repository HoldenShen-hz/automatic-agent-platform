import * as consoleEntrypointModule from "../../platform/five-plane-interface/console-backend/index.js";

import type { PlatformAppManifest } from "../../platform-architecture-types.js";

void consoleEntrypointModule;

export const CONSOLE_APP_ENTRY_MODULE = "src/platform/five-plane-interface/console-backend/index.ts";

export const CONSOLE_APP_MANIFEST: PlatformAppManifest = {
  appId: "automatic-agent-console",
  kind: "console",
  entryModule: CONSOLE_APP_ENTRY_MODULE,
  defaultPort: 3000,
  healthEndpoint: "/api/health",
  capabilities: ["operator_console", "takeover_planning", "tenant_dashboard"],
  requiredLayers: ["platform", "interaction", "org-governance", "scale-ecosystem", "ops-maturity", "apps"],
  startupCommand: "npm run api",
  startupMode: "daemon",
};
