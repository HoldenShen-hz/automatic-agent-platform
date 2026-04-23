export const WORKER_APP_MANIFEST = {
    appId: "automatic-agent-worker",
    kind: "worker",
    entryModule: "src/platform/execution/worker-pool/execution-worker-writeback-service.ts",
    defaultPort: null,
    healthEndpoint: null,
    capabilities: ["dispatch_execution", "writeback", "lease_heartbeat"],
    requiredLayers: ["platform", "domains", "scale-ecosystem", "ops-maturity", "apps"],
    startupCommand: "npm run worker-writeback",
    startupMode: "job",
};
//# sourceMappingURL=index.js.map