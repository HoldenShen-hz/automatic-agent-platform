import { z } from "zod";

export const ConnectorCapabilityProfileSchema = z.object({
  actionRiskProfiles: z.record(z.enum(["low", "medium", "high", "critical"])).default({}),
  permissionProbes: z.array(z.object({
    permission: z.string().min(1),
    probeType: z.enum(["read", "write", "admin"]),
    required: z.boolean().default(false),
  })).default([]),
  quotaProbes: z.array(z.object({
    quotaKey: z.string().min(1),
    limit: z.number().nonnegative(),
    window: z.enum(["second", "minute", "hour", "day"]),
  })).default([]),
  credentialRotationPolicy: z.object({
    rotationDays: z.number().int().positive(),
    autoRotate: z.boolean().default(false),
    gracePeriodDays: z.number().int().nonnegative().default(7),
  }).default({ rotationDays: 90, autoRotate: false, gracePeriodDays: 7 }),
});

export type ConnectorCapabilityProfile = z.infer<typeof ConnectorCapabilityProfileSchema>;

export const ConnectorManifestSchema = z.object({
  connectorId: z.string().min(1),
  provider: z.string().min(1),
  capabilities: z.array(z.string()).default([]),
  capabilityProfile: ConnectorCapabilityProfileSchema.default({}),
  authMode: z.string().default("oauth2"),
  rateLimits: z.record(z.string(), z.number().nonnegative()).default({}),
  supportedEvents: z.array(z.string()).default([]),
  lifecycleState: z.enum(["registered", "configured", "verified", "enabled", "disabled", "revoked"]),
});

export type ConnectorManifest = z.input<typeof ConnectorManifestSchema>;
export type NormalizedConnectorManifest = z.output<typeof ConnectorManifestSchema>;

export function listEnabledConnectors(connectors: readonly ConnectorManifest[]): ConnectorManifest[] {
  return connectors.filter((item) => item.lifecycleState === "enabled");
}
