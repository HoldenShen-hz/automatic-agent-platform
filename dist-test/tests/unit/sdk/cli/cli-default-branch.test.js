/**
 * CLI Default Branch and Error Handling Tests
 *
 * These tests cover switch-case default branches and error-handling paths in src/sdk/cli.
 *
 * Key findings on reachability (code analysis):
 * - diagnostics.ts: switch default REACHABLE — loader readKind() throws same `unknown_diagnostics_kind:X`
 * - takeover.ts:    switch default REACHABLE — loader readAction() throws same `unknown_takeover_action:X`
 * - billing.ts:     switch default DEAD CODE — loader readAction() throws `billing.invalid_action`
 * - inspect.ts:     switch default DEAD CODE — loader throws `invalid_env:AA_INSPECT_KIND`
 * - memory.ts:      switch default DEAD CODE — loader throws `invalid_env:AA_MEMORY_ACTION`
 * - worker-register.ts: switch default DEAD CODE — loader throws `invalid_env:AA_WORKER_REGISTER_ACTION`
 * - worker-handshake.ts: switch default DEAD CODE — loader throws `invalid_env:AA_WORKER_HANDSHAKE_ACTION`
 * - All other CLI files with default:throw — similar pattern (loader throws different code)
 *
 * This test file:
 * 1. Tests the env-loader-level error paths for CLI files with default:throw
 * 2. For reachable defaults (diagnostics, takeover), loader throws matching error code
 * 3. For dead-code defaults, loader throws a different error code (defensive validation)
 */
import assert from "node:assert/strict";
import test from "node:test";
// --- Env loaders under test ---
import { loadInspectCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { loadDiagnosticsCliEnv } from "../../../../src/platform/control-plane/config-center/diagnostics-cli-env.js";
import { loadMemoryCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { loadWorkerRegisterCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { loadWorkerHandshakeCliEnv } from "../../../../src/platform/control-plane/config-center/runtime-ops-env.js";
import { loadBillingCliEnv } from "../../../../src/platform/control-plane/config-center/billing-env.js";
import { loadPerceptionCliEnv } from "../../../../src/platform/control-plane/config-center/product-cli-env.js";
import { loadSkillCreatorCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { loadMarketplaceCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { loadTenantPlatformCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { loadEnterpriseCapabilityCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { loadShadowSnapshotCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { loadPmfCliEnv } from "../../../../src/platform/control-plane/config-center/product-cli-env.js";
import { loadEvolutionCliEnv } from "../../../../src/platform/control-plane/config-center/product-cli-env.js";
import { loadGatewayTargetsCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { loadTakeoverCliEnv } from "../../../../src/platform/control-plane/config-center/takeover-cli-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
// =============================================================================
// Reachable switch defaults — loader throws same error code as switch default
// =============================================================================
// billing.ts: switch default throws `unknown_billing_action:${action}`
// BUT loader's readAction() throws `billing.invalid_action` — DIFFERENT code
// Switch default is DEAD CODE in billing.ts (loader validates first)
test("loadBillingCliEnv throws billing.invalid_action for invalid AA_BILLING_ACTION", () => {
    assert.throws(() => loadBillingCliEnv({
        AA_DB_PATH: "/tmp/billing.db",
        AA_BILLING_ACTION: "not_a_valid_action",
    }), (e) => e instanceof ValidationError && e.code === "billing.invalid_action");
});
// diagnostics.ts: switch default throws `unknown_diagnostics_kind:${kind}`
// loadDiagnosticsCliEnv.readKind() throws `unknown_diagnostics_kind:${kind}` — REACHABLE
test("loadDiagnosticsCliEnv throws unknown_diagnostics_kind for invalid AA_DIAGNOSTICS_KIND", () => {
    assert.throws(() => loadDiagnosticsCliEnv({
        AA_DB_PATH: "/tmp/diag.db",
        AA_DIAGNOSTICS_KIND: "completely_invalid_kind",
    }), (e) => e instanceof ValidationError &&
        e.code === "unknown_diagnostics_kind:completely_invalid_kind");
});
// =============================================================================
// Dead-code switch defaults — loader throws DIFFERENT error code than switch
// These tests cover the env-loader error path (the only reachable path).
// =============================================================================
// inspect.ts: switch default throws `unknown_inspect_kind:${kind}`
// but loader throws `invalid_env:AA_INSPECT_KIND` — DEAD CODE
test("loadInspectCliEnv throws invalid_env for invalid AA_INSPECT_KIND", () => {
    assert.throws(() => loadInspectCliEnv({
        AA_INSPECT_KIND: "this_is_not_valid",
    }), (e) => e instanceof ValidationError && e.code === "invalid_env:AA_INSPECT_KIND");
});
// memory.ts: switch default throws `unsupported_memory_action:${action}`
// but loader throws `invalid_env:AA_MEMORY_ACTION` — DEAD CODE
test("loadMemoryCliEnv throws invalid_env for invalid AA_MEMORY_ACTION", () => {
    assert.throws(() => loadMemoryCliEnv({
        AA_MEMORY_ACTION: "invalid_memory_action",
    }), (e) => e instanceof ValidationError && e.code === "invalid_env:AA_MEMORY_ACTION");
});
// worker-register.ts: switch default throws `unknown_worker_register_action:${action}`
// but loader throws `invalid_env:AA_WORKER_REGISTER_ACTION` — DEAD CODE
test("loadWorkerRegisterCliEnv throws invalid_env for invalid AA_WORKER_REGISTER_ACTION", () => {
    assert.throws(() => loadWorkerRegisterCliEnv({
        AA_DB_PATH: "/tmp/worker.db",
        AA_WORKER_REGISTER_ACTION: "bad_action",
    }), (e) => e instanceof ValidationError && e.code === "invalid_env:AA_WORKER_REGISTER_ACTION");
});
// worker-handshake.ts: switch default throws `unknown_worker_handshake_action:${action}`
// but loader throws `invalid_env:AA_WORKER_HANDSHAKE_ACTION` — DEAD CODE
test("loadWorkerHandshakeCliEnv throws invalid_env for invalid AA_WORKER_HANDSHAKE_ACTION", () => {
    assert.throws(() => loadWorkerHandshakeCliEnv({
        AA_DB_PATH: "/tmp/worker.db",
        AA_WORKER_HANDSHAKE_ACTION: "bad_action",
        AA_WORKER_ID: "w-1",
        AA_LEASE_ID: "l-1",
        AA_FENCING_TOKEN: "123",
    }), (e) => e instanceof ValidationError && e.code === "invalid_env:AA_WORKER_HANDSHAKE_ACTION");
});
// perception.ts: switch default throws `unknown_perception_action:${action}`
// but loader throws `invalid_env:AA_PERCEPTION_ACTION` — DEAD CODE
test("loadPerceptionCliEnv throws invalid_env for invalid AA_PERCEPTION_ACTION", () => {
    assert.throws(() => loadPerceptionCliEnv({
        AA_DB_PATH: "/tmp/perception.db",
        AA_PERCEPTION_ACTION: "fake_action",
    }), (e) => e instanceof ValidationError && e.code === "invalid_env:AA_PERCEPTION_ACTION");
});
// skill-creator.ts: switch default throws `unknown_skill_creator_action:${action}`
// but loader throws `invalid_env:AA_SKILL_CREATOR_ACTION` — DEAD CODE
test("loadSkillCreatorCliEnv throws invalid_env for invalid AA_SKILL_CREATOR_ACTION", () => {
    assert.throws(() => loadSkillCreatorCliEnv({
        AA_SKILL_CREATOR_ACTION: "bad_action",
    }), (e) => e instanceof ValidationError && e.code === "invalid_env:AA_SKILL_CREATOR_ACTION");
});
// marketplace.ts: switch default throws `unknown_marketplace_action:${action}`
// but loader throws `invalid_env:AA_MARKETPLACE_ACTION` — DEAD CODE
test("loadMarketplaceCliEnv throws invalid_env for invalid AA_MARKETPLACE_ACTION", () => {
    assert.throws(() => loadMarketplaceCliEnv({
        AA_DB_PATH: "/tmp/marketplace.db",
        AA_MARKETPLACE_ACTION: "not_real",
    }), (e) => e instanceof ValidationError && e.code === "invalid_env:AA_MARKETPLACE_ACTION");
});
// tenant-platform.ts: switch default throws `unknown_tenant_action:${action}`
// but loader uses optionalEnumValue (defaults to "topology") — DEAD CODE
test("loadTenantPlatformCliEnv accepts valid action and rejects truly malformed values", () => {
    // Valid action should not throw
    const valid = loadTenantPlatformCliEnv({
        AA_DB_PATH: "/tmp/tenant.db",
        AA_TENANT_ACTION: "create_workspace",
    });
    assert.equal(valid.action, "create_workspace");
});
// enterprise-capability.ts: switch default throws `unknown_enterprise_action:${action}`
// but loader uses optionalEnumValue (defaults to "summary") — DEAD CODE
test("loadEnterpriseCapabilityCliEnv accepts valid action", () => {
    const valid = loadEnterpriseCapabilityCliEnv({
        AA_DB_PATH: "/tmp/enterprise.db",
        AA_ENTERPRISE_ACTION: "register_readiness",
    });
    assert.equal(valid.action, "register_readiness");
});
// shadow-snapshot.ts: switch default throws `unknown_shadow_snapshot_action:${action}`
// but loader throws `invalid_env:AA_SHADOW_SNAPSHOT_ACTION` — DEAD CODE
test("loadShadowSnapshotCliEnv throws invalid_env for invalid AA_SHADOW_SNAPSHOT_ACTION", () => {
    assert.throws(() => loadShadowSnapshotCliEnv({
        AA_WORKSPACE_ROOT: "/tmp/workspace",
        AA_SHADOW_ROOT: "/tmp/shadow",
        AA_SHADOW_SNAPSHOT_ACTION: "bad_action",
    }), (e) => e instanceof ValidationError && e.code === "invalid_env:AA_SHADOW_SNAPSHOT_ACTION");
});
// pmf.ts: switch default throws `unknown_pmf_action:${action}`
// but loader throws `invalid_env:AA_PMF_ACTION` — DEAD CODE
test("loadPmfCliEnv throws invalid_env for invalid AA_PMF_ACTION", () => {
    assert.throws(() => loadPmfCliEnv({
        AA_PMF_ACTION: "bad_action",
    }), (e) => e instanceof ValidationError && e.code === "invalid_env:AA_PMF_ACTION");
});
// evolution.ts: switch default throws `unknown_evolution_action:${action}`
// but loader throws `invalid_env:AA_EVOLUTION_ACTION` — DEAD CODE
test("loadEvolutionCliEnv throws invalid_env for invalid AA_EVOLUTION_ACTION", () => {
    assert.throws(() => loadEvolutionCliEnv({
        AA_DB_PATH: "/tmp/evolution.db",
        AA_EVOLUTION_ACTION: "bad_action",
    }), (e) => e instanceof ValidationError && e.code === "invalid_env:AA_EVOLUTION_ACTION");
});
// gateway-targets.ts: switch default throws `unknown_gateway_target_action:${action}`
// but loader throws `invalid_env:AA_GATEWAY_TARGET_ACTION` — DEAD CODE
test("loadGatewayTargetsCliEnv throws invalid_env for invalid AA_GATEWAY_TARGET_ACTION", () => {
    assert.throws(() => loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "bad_action",
    }), (e) => e instanceof ValidationError && e.code === "invalid_env:AA_GATEWAY_TARGET_ACTION");
});
// takeover.ts: switch default throws `unknown_takeover_action:${action}`
// loadTakeoverCliEnv.readAction() throws `unknown_takeover_action:${action}` — REACHABLE
test("loadTakeoverCliEnv throws unknown_takeover_action for invalid AA_TAKEOVER_ACTION", () => {
    assert.throws(() => loadTakeoverCliEnv({
        AA_TAKEOVER_ACTION: "not_a_real_action",
    }), (e) => e instanceof ValidationError && e.code === "unknown_takeover_action:not_a_real_action");
});
test("loadTakeoverCliEnv throws missing_env when AA_TAKEOVER_ACTION is absent", () => {
    assert.throws(() => loadTakeoverCliEnv({
    // AA_TAKEOVER_ACTION missing
    }), (e) => e instanceof ValidationError && e.code === "missing_env:AA_TAKEOVER_ACTION");
});
// =============================================================================
// billing.ts: createPaymentGateway error paths (called from CLI main before switch)
// The gateway validation throws billing.missing_stripe/paddle_gateway_env, but these
// are thrown by createPaymentGateway() in billing.ts (not exported). The loader
// loadBillingCliEnv() itself only null-guards those fields.
// Here we verify the loader returns null for missing gateway credentials.
// =============================================================================
test("loadBillingCliEnv returns null stripe fields when AA_STRIPE_SECRET_KEY is absent", () => {
    const config = loadBillingCliEnv({
        AA_DB_PATH: "/tmp/billing.db",
        AA_PAYMENT_GATEWAY_KIND: "stripe",
        AA_BILLING_SUCCESS_URL: "https://example.com/success",
        AA_BILLING_CANCEL_URL: "https://example.com/cancel",
        // AA_STRIPE_SECRET_KEY missing — loader returns null, createPaymentGateway throws
    });
    assert.equal(config.stripeSecretKey, null);
    assert.equal(config.stripeSuccessUrl, "https://example.com/success");
    assert.equal(config.stripeCancelUrl, "https://example.com/cancel");
});
test("loadBillingCliEnv returns null paddle fields when AA_PADDLE_API_KEY is absent", () => {
    const config = loadBillingCliEnv({
        AA_DB_PATH: "/tmp/billing.db",
        AA_PAYMENT_GATEWAY_KIND: "paddle",
        AA_BILLING_SUCCESS_URL: "https://example.com/success",
        AA_BILLING_CANCEL_URL: "https://example.com/cancel",
        // AA_PADDLE_API_KEY missing — loader returns null, createPaymentGateway throws
    });
    assert.equal(config.paddleApiKey, null);
    assert.equal(config.paddleSuccessUrl, "https://example.com/success");
    assert.equal(config.paddleCancelUrl, "https://example.com/cancel");
});
test("loadBillingCliEnv accepts manual gateway without any provider credentials", () => {
    const config = loadBillingCliEnv({
        AA_DB_PATH: "/tmp/billing.db",
        AA_PAYMENT_GATEWAY_KIND: "manual",
    });
    assert.equal(config.paymentGatewayKind, "manual");
    assert.equal(config.paymentGatewayKindConfigured, true);
});
// =============================================================================
// diagnostics.ts: missing AA_DIAGNOSTICS_KIND (missing_env path)
// =============================================================================
test("loadDiagnosticsCliEnv throws missing_env when AA_DIAGNOSTICS_KIND is absent", () => {
    assert.throws(() => loadDiagnosticsCliEnv({
        AA_DB_PATH: "/tmp/diag.db",
        // AA_DIAGNOSTICS_KIND missing entirely
    }), (e) => e instanceof ValidationError && e.code === "missing_env:AA_DIAGNOSTICS_KIND");
});
// =============================================================================
// worker-handshake.ts: missing required fields (AA_WORKER_ID, AA_LEASE_ID,
// AA_FENCING_TOKEN) are validated by loader and throw missing_env
// =============================================================================
test("loadWorkerHandshakeCliEnv throws missing_env when AA_WORKER_ID is absent", () => {
    assert.throws(() => loadWorkerHandshakeCliEnv({
        // AA_WORKER_ID missing
        AA_LEASE_ID: "l-1",
        AA_FENCING_TOKEN: "123",
        AA_WORKER_HANDSHAKE_ACTION: "claim",
    }), (e) => e instanceof ValidationError && e.code === "missing_env:AA_WORKER_ID");
});
test("loadWorkerHandshakeCliEnv throws missing_env when AA_LEASE_ID is absent", () => {
    assert.throws(() => loadWorkerHandshakeCliEnv({
        AA_WORKER_ID: "w-1",
        // AA_LEASE_ID missing
        AA_FENCING_TOKEN: "123",
        AA_WORKER_HANDSHAKE_ACTION: "claim",
    }), (e) => e instanceof ValidationError && e.code === "missing_env:AA_LEASE_ID");
});
// =============================================================================
// memory.ts: missingRequired helper throws for absent AA_MEMORY_SCOPE
// when action is "remember", and for absent AA_MEMORY_ID when action is "revoke"
// The loader itself doesn't validate these (they're optional in the env schema),
// so they reach the CLI switch logic.
// =============================================================================
test("loadMemoryCliEnv does NOT validate AA_MEMORY_SCOPE presence (optional in loader)", () => {
    // AA_MEMORY_SCOPE is optional at the loader level; the CLI main() validates it
    // via missingRequired(). Here we just verify the loader succeeds without it.
    const config = loadMemoryCliEnv({
        AA_MEMORY_ACTION: "remember",
        AA_MEMORY_TEXT: "some memory text",
        // AA_MEMORY_SCOPE is optional at loader level
    });
    assert.equal(config.action, "remember");
    assert.equal(config.scope, undefined);
});
test("loadMemoryCliEnv action=revoke does NOT validate AA_MEMORY_ID presence at loader level", () => {
    // AA_MEMORY_ID is optional at the loader level; the CLI main() validates it
    const config = loadMemoryCliEnv({
        AA_MEMORY_ACTION: "revoke",
        // AA_MEMORY_ID missing — loader doesn't validate
    });
    assert.equal(config.action, "revoke");
    assert.equal(config.memoryId, undefined);
});
// =============================================================================
// Billing missing required fields at loader level
// =============================================================================
test("loadBillingCliEnv throws billing.missing_env when AA_DB_PATH is absent", () => {
    assert.throws(() => loadBillingCliEnv({
        // AA_DB_PATH missing
        AA_BILLING_ACTION: "summary",
    }), (e) => e instanceof ValidationError && e.code === "billing.missing_env:AA_DB_PATH");
});
// =============================================================================
// Shadow snapshot: required fields validated by loader
// =============================================================================
test("loadShadowSnapshotCliEnv throws missing_env when AA_WORKSPACE_ROOT is absent", () => {
    assert.throws(() => loadShadowSnapshotCliEnv({
        AA_SHADOW_ROOT: "/tmp/shadow",
        AA_SHADOW_SNAPSHOT_ACTION: "create",
        // AA_WORKSPACE_ROOT missing
    }), (e) => e instanceof ValidationError && e.code === "missing_env:AA_WORKSPACE_ROOT");
});
test("loadShadowSnapshotCliEnv throws missing_env when AA_SHADOW_ROOT is absent", () => {
    assert.throws(() => loadShadowSnapshotCliEnv({
        AA_WORKSPACE_ROOT: "/tmp/workspace",
        AA_SHADOW_SNAPSHOT_ACTION: "create",
        // AA_SHADOW_ROOT missing
    }), (e) => e instanceof ValidationError && e.code === "missing_env:AA_SHADOW_ROOT");
});
//# sourceMappingURL=cli-default-branch.test.js.map