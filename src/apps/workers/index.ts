import * as workerEntrypointModule from "../../platform/five-plane-execution/worker-pool/execution-worker-writeback-service.js";

import type { PlatformAppManifest } from "../../platform-architecture-types.js";

void workerEntrypointModule;

export const WORKER_APP_ENTRY_MODULE = "src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service.ts";

export const WORKER_APP_MANIFEST: PlatformAppManifest = {
  appId: "automatic-agent-worker",
  kind: "worker",
  entryModule: WORKER_APP_ENTRY_MODULE,
  defaultPort: null,
  healthEndpoint: null,
  capabilities: ["dispatch_execution", "writeback", "lease_heartbeat"],
  requiredLayers: ["platform", "domains", "interaction", "org-governance", "scale-ecosystem", "ops-maturity", "apps"],
  startupCommand: "npm run worker-writeback",
  startupMode: "job",
};
