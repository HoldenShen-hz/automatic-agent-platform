import assert from "node:assert/strict";
import test from "node:test";

import { getEventSchema } from "../../../../src/platform/five-plane-state-evidence/events/event-registry.js";
import type { TypedEventPayloadMap } from "../../../../src/platform/five-plane-state-evidence/events/typed-event-bus.js";
import type {
  AuthProviderBinding,
  AuthSession,
  SandboxCapabilityProfile,
  SandboxPolicy,
} from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { OidcOAuthService } from "../../../../src/platform/five-plane-interface/api/oidc-oauth-service.js";

test("typed event contracts expose OAPEFLIR payloads and plugin isolation payload uses phase", () => {
  const observePayload: TypedEventPayloadMap["observe:signals_collected"] = {
    runId: "run-1",
    loopIteration: 1,
    signalCount: 2,
    sourceTypes: ["telemetry"],
    collectedAt: "2026-05-09T00:00:00.000Z",
  };
  const pluginIsolationPayload: TypedEventPayloadMap["plugin:error_isolated"] = {
    pluginId: "plugin-1",
    domainId: "domain-1",
    spiType: "tool",
    phase: "execute",
    lifecycleState: "isolated",
    occurredAt: "2026-05-09T00:00:00.000Z",
  };

  assert.equal(observePayload.signalCount, 2);
  assert.equal(pluginIsolationPayload.phase, "execute");
});

test("event registry exposes producer consumer and compatibility metadata for stage events", () => {
  const schema = getEventSchema("observe:signals_collected");

  assert.equal(schema.producer, "oapeflir_orchestrator");
  assert.deepEqual(schema.consumers, ["oapeflir_projection", "truth_projector"]);
  assert.equal(schema.compatibilityPolicy, "backward_compatible_additive");
  assert.match(schema.payloadSchemaRef, /observe\/signals_collected\/v1$/);
});

test("sandbox IAM contract exports canonical sandbox auth types", () => {
  const policy: SandboxPolicy = {
    policyId: "policy-1",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/workspace/secrets"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    timeLimitMs: 1_000,
    memoryLimitBytes: 1024,
    cpuLimitFraction: 0.5,
    filesystem_rules: [{ rule: "allow", pathPattern: "/workspace/**", operations: ["read", "write"] }],
    network_rules: [{ rule: "deny", hostPattern: "*", protocol: "any" }],
    process_rules: [{ rule: "allow", execPattern: "/usr/bin/env" }],
    created_at: "2026-05-09T00:00:00.000Z",
  };
  const profile: SandboxCapabilityProfile = {
    profileId: "profile-1",
    name: "operator",
    description: "operator sandbox",
    filesystem: {
      maxPathDepth: 8,
      allowSymlinks: false,
      allowedExecExtensions: [".sh"],
      maxFileSizeBytes: 4096,
      readOnly: false,
    },
    network: {
      allowNetwork: false,
      allowedHosts: [],
      allowedPorts: [],
      allowOutbound: false,
    },
    process: {
      maxProcesses: 2,
      maxCpuTimeMs: 1_000,
      maxMemoryBytes: 1024,
      allowedExecPaths: ["/usr/bin/env"],
    },
    ipc: {
      allowIpc: false,
      allowedIpcPaths: [],
    },
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
  };
  const binding: AuthProviderBinding = {
    providerBindingId: "binding-1",
    providerId: "oidc",
    tenantId: "tenant-1",
    clientId: "client-1",
    redirectUri: "https://example.com/callback",
    scopes: ["openid", "profile"],
    pkceRequired: true,
    tokenEndpointAuthMethod: "client_secret_basic",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
  };
  const session: AuthSession = {
    sessionId: "session-1",
    providerBindingId: binding.providerBindingId,
    actorId: "user-1",
    tenantId: "tenant-1",
    status: "pending",
    scopes: binding.scopes,
    accessTokenRef: null,
    refreshTokenRef: null,
    codeVerifierRef: "secret://pkce-verifier",
    expiresAt: null,
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
  };

  assert.equal(policy.filesystem_rules?.length, 1);
  assert.equal(profile.process.maxProcesses, 2);
  assert.equal(binding.pkceRequired, true);
  assert.equal(session.providerBindingId, binding.providerBindingId);
});

test("OIDC OAuth service uses PKCE challenge parameters by default", () => {
  const service = new OidcOAuthService();
  const verifier = service.generateCodeVerifier();
  const challenge = service.generateCodeChallenge(verifier);
  const url = service.buildAuthorizationUrl({
    issuer: "https://issuer.example.com",
    authorizationEndpoint: "https://issuer.example.com/authorize",
    tokenEndpoint: "https://issuer.example.com/token",
    jwksUri: "https://issuer.example.com/jwks",
    scopes: ["openid", "profile"],
    allowedRedirectUris: ["https://example.com/callback"],
  }, "client-1", "https://example.com/callback", "state-1", challenge);
  const parsed = new URL(url);

  assert.equal(verifier.length > 20, true);
  assert.equal(parsed.searchParams.get("code_challenge"), challenge);
  assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
});
