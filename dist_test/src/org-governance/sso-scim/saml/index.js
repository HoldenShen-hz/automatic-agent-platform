import { z } from "zod";
import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
export const SamlProviderConfigSchema = z.object({
    providerId: z.string().min(1),
    entryPoint: z.string().min(1),
    issuer: z.string().min(1),
    certificateFingerprint: z.string().min(1),
    entityId: z.string().min(1).optional(),
    acsUrl: z.string().min(1).optional(),
    attributeMapping: z.record(z.string()).optional(),
});
export function buildSamlAudience(config) {
    return `${config.issuer}:${config.providerId}`;
}
function encodeSamlPayload(payload) {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
function isAssertionTimeValid(assertion, now) {
    if (assertion.notBefore && now < new Date(assertion.notBefore)) {
        return false;
    }
    if (assertion.notOnOrAfter && now >= new Date(assertion.notOnOrAfter)) {
        return false;
    }
    return true;
}
export class SamlService {
    providers = new Map();
    registerProvider(config) {
        this.providers.set(config.providerId, SamlProviderConfigSchema.parse(config));
    }
    getProvider(providerId) {
        return this.providers.get(providerId) ?? null;
    }
    buildLoginRequest(providerId, options = {}) {
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
    consumeAssertion(providerId, assertion, now = new Date()) {
        const provider = this.requireProvider(providerId);
        if (assertion.issuer !== provider.issuer) {
            throw new Error(`saml.invalid_issuer:${providerId}`);
        }
        if (assertion.fingerprint !== provider.certificateFingerprint) {
            throw new Error(`saml.invalid_fingerprint:${providerId}`);
        }
        if (assertion.audience !== buildSamlAudience(provider)) {
            throw new Error(`saml.invalid_audience:${providerId}`);
        }
        if (assertion.nameId.trim().length === 0) {
            throw new Error(`saml.invalid_subject:${providerId}`);
        }
        if (!isAssertionTimeValid(assertion, now)) {
            throw new Error(`saml.assertion_expired:${providerId}`);
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
    buildLogoutRequest(providerId, session, relayState) {
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
    requireProvider(providerId) {
        const provider = this.providers.get(providerId);
        if (!provider) {
            throw new Error(`saml.provider_not_found:${providerId}`);
        }
        return provider;
    }
}
//# sourceMappingURL=index.js.map