import { z } from "zod";
export declare const ConnectorManifestSchema: z.ZodObject<{
    connectorId: z.ZodString;
    provider: z.ZodString;
    capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    authMode: z.ZodDefault<z.ZodString>;
    rateLimits: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    supportedEvents: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    lifecycleState: z.ZodEnum<["registered", "configured", "verified", "enabled", "disabled", "revoked"]>;
}, "strip", z.ZodTypeAny, {
    provider: string;
    lifecycleState: "disabled" | "revoked" | "verified" | "enabled" | "registered" | "configured";
    capabilities: string[];
    connectorId: string;
    authMode: string;
    rateLimits: Record<string, number>;
    supportedEvents: string[];
}, {
    provider: string;
    lifecycleState: "disabled" | "revoked" | "verified" | "enabled" | "registered" | "configured";
    connectorId: string;
    capabilities?: string[] | undefined;
    authMode?: string | undefined;
    rateLimits?: Record<string, number> | undefined;
    supportedEvents?: string[] | undefined;
}>;
export type ConnectorManifest = z.input<typeof ConnectorManifestSchema>;
export type NormalizedConnectorManifest = z.output<typeof ConnectorManifestSchema>;
export declare function listEnabledConnectors(connectors: readonly ConnectorManifest[]): ConnectorManifest[];
