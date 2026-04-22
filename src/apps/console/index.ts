import type { PlatformAppManifest } from "../../platform-architecture-types.js";

export const CONSOLE_APP_MANIFEST: PlatformAppManifest = {
  appId: "automatic-agent-console",
  kind: "console",
  entryModule: "src/platform/interface/console-backend/index.ts",
  defaultPort: 3000,
  healthEndpoint: "/api/health",
  capabilities: ["operator_console", "takeover_planning", "tenant_dashboard"],
  requiredLayers: ["platform", "interaction", "org-governance", "scale-ecosystem", "ops-maturity", "apps"],
  startupCommand: "npm run api",
  startupMode: "daemon",
};
