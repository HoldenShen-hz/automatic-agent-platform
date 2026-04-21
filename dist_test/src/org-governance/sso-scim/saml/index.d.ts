import { z } from "zod";
export declare const SamlProviderConfigSchema: z.ZodObject<{
    providerId: z.ZodString;
    entryPoint: z.ZodString;
    issuer: z.ZodString;
    certificateFingerprint: z.ZodString;
    entityId: z.ZodOptional<z.ZodString>;
    acsUrl: z.ZodOptional<z.ZodString>;
    attributeMapping: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    providerId: string;
    issuer: string;
    entryPoint: string;
    certificateFingerprint: string;
    entityId?: string | undefined;
    acsUrl?: string | undefined;
    attributeMapping?: Record<string, string> | undefined;
}, {
    providerId: string;
    issuer: string;
    entryPoint: string;
    certificateFingerprint: string;
    entityId?: string | undefined;
    acsUrl?: string | undefined;
    attributeMapping?: Record<string, string> | undefined;
}>;
export type SamlProviderConfig = z.infer<typeof SamlProviderConfigSchema>;
export interface SamlLoginRequest {
    readonly requestId: string;
    readonly providerId: string;
    readonly redirectUrl: string;
    readonly relayState: string | null;
    readonly audience: string;
    readonly issuedAt: string;
}
export interface SamlAssertionInput {
    readonly issuer: string;
    readonly audience: string;
    readonly nameId: string;
    readonly fingerprint: string;
    readonly attributes?: Readonly<Record<string, string>>;
    readonly sessionIndex?: string;
    readonly notBefore?: string;
    readonly notOnOrAfter?: string;
}
export interface SamlSession {
    readonly sessionId: string;
    readonly providerId: string;
    readonly subjectId: string;
    readonly issuer: string;
    readonly audience: string;
    readonly sessionIndex: string | null;
    readonly attributes: Readonly<Record<string, string>>;
    readonly createdAt: string;
    readonly expiresAt: string | null;
}
export interface SamlLogoutRequest {
    readonly requestId: string;
    readonly providerId: string;
    readonly redirectUrl: string;
    readonly relayState: string | null;
}
export declare function buildSamlAudience(config: SamlProviderConfig): string;
export declare class SamlService {
    private readonly providers;
    registerProvider(config: SamlProviderConfig): void;
    getProvider(providerId: string): SamlProviderConfig | null;
    buildLoginRequest(providerId: string, options?: {
        relayState?: string | null;
        requestId?: string;
    }): SamlLoginRequest;
    consumeAssertion(providerId: string, assertion: SamlAssertionInput, now?: Date): SamlSession;
    buildLogoutRequest(providerId: string, session: Pick<SamlSession, "sessionId" | "subjectId" | "sessionIndex">, relayState?: string | null): SamlLogoutRequest;
    private requireProvider;
}
