export const API_APP_MANIFEST = {
    appId: "automatic-agent-api",
    kind: "api",
    entryModule: "src/platform/interface/api/http-api-server.ts",
    defaultPort: 8004,
    healthEndpoint: "/health",
    capabilities: ["http_api", "approval_queue", "inspect", "dashboard"],
};
//# sourceMappingURL=index.js.map