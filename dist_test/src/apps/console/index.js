export const CONSOLE_APP_MANIFEST = {
    appId: "automatic-agent-console",
    kind: "console",
    entryModule: "src/platform/interface/console-backend/index.ts",
    defaultPort: 3000,
    healthEndpoint: "/api/health",
    capabilities: ["operator_console", "takeover_planning", "tenant_dashboard"],
};
//# sourceMappingURL=index.js.map