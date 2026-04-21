import { z } from "zod";
export const ConnectorManifestSchema = z.object({
    connectorId: z.string().min(1),
    provider: z.string().min(1),
    capabilities: z.array(z.string()).default([]),
    authMode: z.string().default("oauth2"),
    rateLimits: z.record(z.string(), z.number().nonnegative()).default({}),
    supportedEvents: z.array(z.string()).default([]),
    lifecycleState: z.enum(["registered", "configured", "verified", "enabled", "disabled", "revoked"]),
});
export function listEnabledConnectors(connectors) {
    return connectors.filter((item) => item.lifecycleState === "enabled");
}
//# sourceMappingURL=index.js.map