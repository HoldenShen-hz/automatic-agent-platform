import { SignedXml } from "xml-crypto";
import { z } from "zod";
import { newId, nowIso } from "../../../platform/contracts/types/ids.js";

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
 * Phase 2 hardening scope (R7-46):
 * - R7-46: Add X.509 certificate validation with proper trust chain verification
 * - R7-46: Implement XML signature canonicalization (C14N) validation
 * - R7-46: Add replay attack prevention with assertion ID tracking
 * - R7-46: Support for encrypted assertions
 * - R7-46: Implement X.509 trust-chain validation per §11.3
 */

export const SAML_SIGNATURE_ALGORITHMS = ["http://www.w3.org/2001/04/xmldsig-more#rsa-sha256", "http://www.w3.org/2000/09/xmldsig#rsa-sha1"] as const;
export type SamlSignatureAlgorithm = (typeof SAML_SIGNATURE_ALGORITHMS)[number];
const ASSERTION_REPLAY_TTL_MS = 5 * 60 * 1000;

interface SignedXmlValidationErrors {
  readonly validationErrors?: readonly string[];
}

/**
 * Validates XML signature using xml-crypto library
 * @param signature - The XML signature to validate
 * @param xml - The raw XML document to verify against
 * @param options - Optional configuration for key resolution
 * @returns Validation result with detailed error if failed
 */
export function validateXmlSignature(
  signature: string,
  xml: string,
  options: {
    signatureAlgorithm?: string;
    keyProviderFn?: (keyInfo: string | object) => string | null;
  } = {},
): { valid: boolean; error?: string } {
  try {
    const signedXmlOptions: ConstructorParameters<typeof SignedXml>[0] = {
      signatureAlgorithm: options.signatureAlgorithm ?? "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    };
    if (options.keyProviderFn) {
      signedXmlOptions.getCertFromKeyInfo = (keyInfo) => options.keyProviderFn?.(keyInfo ?? "") ?? null;
    }
    const sig = new SignedXml(signedXmlOptions);

    sig.loadSignature(signature);

    const isValid = sig.checkSignature(xml);
    if (!isValid) {
      const err = (sig as SignedXmlValidationErrors).validationErrors;
      return {
        valid: false,
        error: Array.isArray(err) ? err.join("; ") : "Signature validation failed",
      };
    }

    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Unknown signature validation error",
    };
  }
}

export const SamlProviderConfigSchema = z.object({
  providerId: z.string().min(1),
  entryPoint: z.string().min(1),
  issuer: z.string().min(1),
  certificateFingerprint: z.string().min(1),
  entityId: z.string().min(1).optional(),
  acsUrl: z.string().min(1).optional(),
  allowedAudiences: z.array(z.string().min(1)).optional(),
  allowUnsignedAssertions: z.boolean().default(false),
  attributeMapping: z.record(z.string()).optional(),
});

export type SamlProviderConfig = z.input<typeof SamlProviderConfigSchema>;
type NormalizedSamlProviderConfig = z.output<typeof SamlProviderConfigSchema>;

export interface SamlLoginRequest {
  readonly requestId: string;
  readonly providerId: string;
  readonly redirectUrl: string;
  readonly relayState: string | null;
  readonly audience: string;
  readonly issuedAt: string;
}

export interface SamlAssertionInput {
  readonly assertionId?: string;
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
  readonly recipient?: string;
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

export function buildSamlAudience(config: SamlProviderConfig): string {
  return `${config.issuer}:${config.providerId}`;
}

function encodeSamlPayload(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function isAssertionTimeValid(assertion: SamlAssertionInput, now: Date): boolean {
  if (assertion.notBefore && now < new Date(assertion.notBefore)) {
    return false;
  }
  if (assertion.notOnOrAfter && now >= new Date(assertion.notOnOrAfter)) {
    return false;
  }
  return true;
}

export class SamlService {
  private readonly providers = new Map<string, NormalizedSamlProviderConfig>();
  private readonly consumedAssertionIds = new Map<string, string>();

  private pruneConsumedAssertionIds(now: Date): void {
    const cutoff = now.getTime() - ASSERTION_REPLAY_TTL_MS;
    for (const [replayKey, consumedAt] of this.consumedAssertionIds.entries()) {
      if (new Date(consumedAt).getTime() <= cutoff) {
        this.consumedAssertionIds.delete(replayKey);
      }
    }
  }

  public registerProvider(config: SamlProviderConfig): void {
    this.providers.set(config.providerId, SamlProviderConfigSchema.parse(config));
  }

  public getProvider(providerId: string): SamlProviderConfig | null {
    return this.providers.get(providerId) ?? null;
  }

  public buildLoginRequest(
    providerId: string,
    options: {
      relayState?: string | null;
      requestId?: string;
    } = {},
  ): SamlLoginRequest {
    const provider = this.requireProvider(providerId);
    const issuedAt = nowIso();
    const requestId = options.requestId ?? newId("saml_req");
    const audience = buildSamlAudience(provider);
    const payload = encodeSamlPayload({
      requestId,
      issuer: provider.entityId ?? provider.issuer,
      audience,
      acsUrl: provider.acsUrl ?? `${provider.issuer}/saml/acs`,
      issuedAt,
    });

    const params = new URLSearchParams({
      SAMLRequest: payload,
      ...(options.relayState ? { RelayState: options.relayState } : {}),
    });

    return {
      requestId,
      providerId,
      redirectUrl: `${provider.entryPoint}?${params.toString()}`,
      relayState: options.relayState ?? null,
      audience,
      issuedAt,
    };
  }

  public consumeAssertion(
    providerId: string,
    assertion: SamlAssertionInput,
    now = new Date(),
  ): SamlSession {
    const provider = this.requireProvider(providerId);
    if (assertion.issuer !== provider.issuer) {
      throw new Error(`saml.invalid_issuer:${providerId}`);
    }
    if (assertion.fingerprint !== provider.certificateFingerprint) {
      throw new Error(`saml.invalid_fingerprint:${providerId}`);
    }
    const allowedAudiences = provider.allowedAudiences ?? [buildSamlAudience(provider)];
    if (!allowedAudiences.includes(assertion.audience)) {
      throw new Error(`saml.invalid_audience:${providerId}`);
    }
    if (provider.acsUrl && assertion.recipient && assertion.recipient !== provider.acsUrl) {
      throw new Error(`saml.invalid_recipient:${providerId}`);
    }
    if (assertion.nameId.trim().length === 0) {
      throw new Error(`saml.invalid_subject:${providerId}`);
    }
    if (!isAssertionTimeValid(assertion, now)) {
      throw new Error(`saml.assertion_expired:${providerId}`);
    }
    if (provider.allowUnsignedAssertions !== true) {
      if (!assertion.xmlSignature || !assertion.rawXml) {
        throw new Error(`saml.signature_required:${providerId}`);
      }
    }
    if (assertion.xmlSignature && assertion.rawXml) {
      // Production SAML: Always validate XML signatures when present.
      const result = validateXmlSignature(assertion.xmlSignature, assertion.rawXml);
      if (!result.valid) {
        throw new Error(`saml.invalid_signature:${providerId}:${result.error ?? "validation failed"}`);
      }
    }
    if (assertion.assertionId) {
      this.pruneConsumedAssertionIds(now);
      const replayKey = `${providerId}:${assertion.assertionId}`;
      if (this.consumedAssertionIds.has(replayKey)) {
        throw new Error(`saml.assertion_replayed:${providerId}`);
      }
      this.consumedAssertionIds.set(replayKey, now.toISOString());
    }

    return {
      sessionId: newId("saml_session"),
      providerId,
      subjectId: assertion.nameId,
      issuer: assertion.issuer,
      audience: assertion.audience,
      sessionIndex: assertion.sessionIndex ?? null,
      attributes: assertion.attributes ?? {},
      createdAt: now.toISOString(),
      expiresAt: assertion.notOnOrAfter ?? null,
    };
  }

  public buildLogoutRequest(
    providerId: string,
    session: Pick<SamlSession, "sessionId" | "subjectId" | "sessionIndex">,
    relayState?: string | null,
  ): SamlLogoutRequest {
    const provider = this.requireProvider(providerId);
    const requestId = newId("saml_logout");
    const payload = encodeSamlPayload({
      requestId,
      sessionId: session.sessionId,
      nameId: session.subjectId,
      sessionIndex: session.sessionIndex,
    });
    const params = new URLSearchParams({
      SAMLRequest: payload,
      ...(relayState ? { RelayState: relayState } : {}),
    });

    return {
      requestId,
      providerId,
      redirectUrl: `${provider.entryPoint}?${params.toString()}`,
      relayState: relayState ?? null,
    };
  }

  private requireProvider(providerId: string): NormalizedSamlProviderConfig {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`saml.provider_not_found:${providerId}`);
    }
    return provider;
  }
}
