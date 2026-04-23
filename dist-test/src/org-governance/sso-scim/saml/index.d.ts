import { z } from "zod";
/**
 * SAML XML Signature Verification - Production Hardening
 *
 * This module implements SAML 2.0 XML Signature validation for production use.
 *
 * Security considerations:
 * 1. Always validate XML signatures on SAML responses using xml-crypto
 * 2. Use a trusted certificate store for signature verification
 * 3. Reject responses with invalid or missing signatures when required by policy
 * 4. Validate the certificate fingerprint against known IdP certificates
 * 5. Check signature algorithm to prevent algorithm confusion attacks
 *
 * TODO (SAML production hardening - Phase 2):
 * - Add X.509 certificate validation with proper trust chain verification
 * - Implement XML signature canonicalization (C14N) validation
 * - Add replay attack prevention with assertion ID tracking
 * - Support for encrypted assertions
 */
export declare const SAML_SIGNATURE_ALGORITHMS: readonly ["http://www.w3.org/2001/04/xmldsig-more#rsa-sha256", "http://www.w3.org/2000/09/xmldsig#rsa-sha1"];
export type SamlSignatureAlgorithm = (typeof SAML_SIGNATURE_ALGORITHMS)[number];
/**
 * Validates XML signature using xml-crypto library
 * @param signature - The XML signature to validate
 * @param xml - The raw XML document to verify against
 * @param options - Optional configuration for key resolution
 * @returns Validation result with detailed error if failed
 */
export declare function validateXmlSignature(signature: string, xml: string, options?: {
    signatureAlgorithm?: string;
    keyProviderFn?: (keyInfo: string | object) => string | null;
}): {
    valid: boolean;
    error?: string;
};
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
    readonly xmlSignature?: string;
    readonly rawXml?: string;
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
