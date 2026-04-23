import assert from "node:assert/strict";
import test from "node:test";
import { IdentitySyncService } from "../../../src/org-governance/sso-scim/identity-sync-service.js";
test("IdentitySyncService bootstraps OIDC, SAML, and SCIM state", () => {
    const service = new IdentitySyncService();
    const snapshot = service.bootstrap({
        providerId: "oidc_main",
        issuer: "https://id.example.com",
        clientId: "client_1",
        redirectUri: "https://app.example.com/callback",
        scopes: ["openid", "profile"],
    }, {
        providerId: "saml_main",
        entryPoint: "https://id.example.com/saml",
        issuer: "app.example.com",
        certificateFingerprint: "sha256:abc",
    }, [
        {
            eventId: "evt_1",
            action: "user_created",
            subjectId: "user_a",
            occurredAt: "2026-04-20T00:00:00.000Z",
        },
        {
            eventId: "evt_2",
            action: "user_disabled",
            subjectId: "user_b",
            occurredAt: "2026-04-20T00:01:00.000Z",
        },
    ]);
    assert.match(snapshot.oidcAuthorizationUrl, /authorize/);
    assert.match(snapshot.samlAudience, /app\.example\.com:saml_main/);
    assert.deepEqual(snapshot.activeSubjects, ["user_a"]);
});
//# sourceMappingURL=identity-sync-service.test.js.map