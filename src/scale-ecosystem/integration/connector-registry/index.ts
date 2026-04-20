import { z } from "zod";

export const ConnectorManifestSchema = z.object({
  connectorId: z.string().min(1),
  provider: z.string().min(1),
  capabilities: z.array(z.string()).default([]),
  lifecycleState: z.enum(["registered", "configured", "verified", "enabled", "disabled", "revoked"]),
});

export type ConnectorManifest = z.infer<typeof ConnectorManifestSchema>;

export function listEnabledConnectors(connectors: readonly ConnectorManifest[]): ConnectorManifest[] {
  return connectors.filter((item) => item.lifecycleState === "enabled");
}
