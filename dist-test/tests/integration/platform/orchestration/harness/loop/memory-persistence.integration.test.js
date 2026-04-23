/**
 * Integration Test: Harness Memory Persistence
 *
 * Tests memory persistence across run lifecycle:
 * - writeMemory/readMemory across run lifecycle
 * - Memory namespaces (run, domain, shared)
 * - Memory persistence and restoration
 * - Memory in context of full loop
 *
 * Uses in-memory SQLite and temp directories for integration testing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createIntegrationContext } from "../../../../../helpers/integration-context.js";
import { HarnessRuntimeService, } from "../../../../../../src/platform/orchestration/harness/index.js";
function createConstraintPack(overrides = {}) {
    return {
        policyIds: ["policy.memory.test"],
        approvalMode: "required",
        autonomyMode: "supervised",
        toolPolicy: {
            allowedTools: ["read", "write", "bash"],
        },
        risk_policy: {
            maxRiskScore: 70,
            escalationThreshold: 55,
        },
        output_policy: {
            requiredEvidence: ["risk_profile"],
            redactSensitiveData: true,
        },
        budget: {
            maxSteps: 12,
            maxCost: 5.0,
            maxDurationMs: 120_000,
        },
        ...overrides,
    };
}
test("writeMemory and readMemory work across run namespace", () => {
    const ctx = createIntegrationContext("aa-memory-run-");
    try {
        const service = new HarnessRuntimeService();
        const run = service.runLoop({
            taskId: "task-memory-run-001",
            domainId: "coding",
            constraintPack: createConstraintPack(),
            plannerOutput: { planId: "plan-memory-001" },
            generatorOutput: { artifact: "code.diff" },
            evaluatorOutput: { verdict: "pass" },
            evaluatorScore: 0.88,
            producedEvidenceRefs: ["risk_profile"],
        });
        // Write memory entries to run namespace
        service.writeMemory(run, "run", "release_ticket", "CHG-12345");
        service.writeMemory(run, "run", "reviewer", "eng_lead");
        service.writeMemory(run, "run", "attempt_count", 3);
        // Read back from run namespace
        assert.equal(service.readMemory(run, "run", "release_ticket"), "CHG-12345");
        assert.equal(service.readMemory(run, "run", "reviewer"), "eng_lead");
        assert.equal(service.readMemory(run, "run", "attempt_count"), 3);
        // Read non-existent key returns null
        assert.equal(service.readMemory(run, "run", "nonexistent"), null);
    }
    finally {
        ctx.cleanup();
    }
});
test("writeMemory and readMemory work across domain namespace", () => {
    const ctx = createIntegrationContext("aa-memory-domain-");
    try {
        const service = new HarnessRuntimeService();
        const run = service.runLoop({
            taskId: "task-memory-domain-001",
            domainId: "security",
            constraintPack: createConstraintPack(),
            plannerOutput: { planId: "plan-sec-001" },
            generatorOutput: { artifact: "security-config.json" },
            evaluatorOutput: { verdict: "pass" },
            evaluatorScore: 0.85,
            producedEvidenceRefs: ["risk_profile"],
        });
        // Write memory entries to domain namespace
        service.writeMemory(run, "domain", "last_release_owner", "security_admin");
        service.writeMemory(run, "domain", "scan_threshold", 95);
        service.writeMemory(run, "domain", "enabled_features", ["firewall", "ids"]);
        // Read back from domain namespace
        assert.equal(service.readMemory(run, "domain", "last_release_owner"), "security_admin");
        assert.equal(service.readMemory(run, "domain", "scan_threshold"), 95);
        assert.deepEqual(service.readMemory(run, "domain", "enabled_features"), ["firewall", "ids"]);
        // Read non-existent key returns null
        assert.equal(service.readMemory(run, "domain", "nonexistent"), null);
    }
    finally {
        ctx.cleanup();
    }
});
test("writeMemory and readMemory work across shared namespace", () => {
    const ctx = createIntegrationContext("aa-memory-shared-");
    try {
        const service = new HarnessRuntimeService();
        const run = service.runLoop({
            taskId: "task-memory-shared-001",
            domainId: "global",
            constraintPack: createConstraintPack(),
            plannerOutput: { planId: "plan-global-001" },
            generatorOutput: { artifact: "global-config.json" },
            evaluatorOutput: { verdict: "pass" },
            evaluatorScore: 0.9,
            producedEvidenceRefs: ["risk_profile"],
        });
        // Write memory entries to shared (global) namespace
        service.writeMemory(run, "shared", "platform_version", "2.5.0");
        service.writeMemory(run, "shared", "global_timeout_ms", 30000);
        service.writeMemory(run, "shared", "fallback_domains", ["us-east-1", "eu-west-1"]);
        // Read back from shared namespace
        assert.equal(service.readMemory(run, "shared", "platform_version"), "2.5.0");
        assert.equal(service.readMemory(run, "shared", "global_timeout_ms"), 30000);
        assert.deepEqual(service.readMemory(run, "shared", "fallback_domains"), ["us-east-1", "eu-west-1"]);
        // Read non-existent key returns null
        assert.equal(service.readMemory(run, "shared", "nonexistent"), null);
    }
    finally {
        ctx.cleanup();
    }
});
test("Memory persists across multiple iterations of a run", () => {
    const ctx = createIntegrationContext("aa-memory-iter-");
    try {
        const service = new HarnessRuntimeService();
        const run = service.createRun({
            taskId: "task-memory-iter-001",
            domainId: "coding",
            constraintPack: createConstraintPack({
                budget: {
                    maxSteps: 9, // Allow multiple iterations
                    maxCost: 5,
                    maxDurationMs: 60_000,
                },
            }),
        });
        // Write memory before steps
        service.writeMemory(run, "run", "start_time", Date.now());
        service.writeMemory(run, "run", "iteration_count", 0);
        // Append steps (simulating iterations)
        let currentRun = service.appendStep(run, {
            role: "planner",
            stage: "plan",
            inputs: {},
            outputs: { planId: "plan-1" },
            iteration: 1,
        });
        currentRun = service.appendStep(currentRun, {
            role: "generator",
            stage: "execute",
            inputs: {},
            outputs: { artifact: "draft-1.diff" },
            iteration: 1,
        });
        // Update memory between iterations
        service.writeMemory(currentRun, "run", "iteration_count", 1);
        service.writeMemory(currentRun, "run", "current_draft", "draft-1.diff");
        // Verify memory is still accessible
        assert.equal(service.readMemory(currentRun, "run", "iteration_count"), 1);
        assert.equal(service.readMemory(currentRun, "run", "current_draft"), "draft-1.diff");
    }
    finally {
        ctx.cleanup();
    }
});
test("Memory is isolated between different runs", () => {
    const ctx = createIntegrationContext("aa-memory-isolate-");
    try {
        const service = new HarnessRuntimeService();
        // Create first run
        const run1 = service.runLoop({
            taskId: "task-memory-iso-001",
            domainId: "coding",
            constraintPack: createConstraintPack(),
            plannerOutput: { planId: "plan-iso-001" },
            generatorOutput: { artifact: "code1.diff" },
            evaluatorOutput: { verdict: "pass" },
            evaluatorScore: 0.88,
            producedEvidenceRefs: ["risk_profile"],
        });
        // Create second run
        const run2 = service.runLoop({
            taskId: "task-memory-iso-002",
            domainId: "coding",
            constraintPack: createConstraintPack(),
            plannerOutput: { planId: "plan-iso-002" },
            generatorOutput: { artifact: "code2.diff" },
            evaluatorOutput: { verdict: "pass" },
            evaluatorScore: 0.90,
            producedEvidenceRefs: ["risk_profile"],
        });
        // Write different memory to each run
        service.writeMemory(run1, "run", "run1_specific", "value_from_run1");
        service.writeMemory(run2, "run", "run2_specific", "value_from_run2");
        // Verify isolation
        assert.equal(service.readMemory(run1, "run", "run1_specific"), "value_from_run1");
        assert.equal(service.readMemory(run1, "run", "run2_specific"), null);
        assert.equal(service.readMemory(run2, "run", "run2_specific"), "value_from_run2");
        assert.equal(service.readMemory(run2, "run", "run1_specific"), null);
    }
    finally {
        ctx.cleanup();
    }
});
test("Domain memory is shared across runs in same domain", () => {
    const ctx = createIntegrationContext("aa-memory-domain-share-");
    try {
        const service = new HarnessRuntimeService();
        // Create first run in domain
        const run1 = service.runLoop({
            taskId: "task-domain-share-001",
            domainId: "shared_domain",
            constraintPack: createConstraintPack(),
            plannerOutput: { planId: "plan-share-001" },
            generatorOutput: { artifact: "code1.diff" },
            evaluatorOutput: { verdict: "pass" },
            evaluatorScore: 0.88,
            producedEvidenceRefs: ["risk_profile"],
        });
        // Write domain-level memory
        service.writeMemory(run1, "domain", "domain_counter", 1);
        service.writeMemory(run1, "domain", "last_task", "task-domain-share-001");
        // Create second run in same domain
        const run2 = service.runLoop({
            taskId: "task-domain-share-002",
            domainId: "shared_domain",
            constraintPack: createConstraintPack(),
            plannerOutput: { planId: "plan-share-002" },
            generatorOutput: { artifact: "code2.diff" },
            evaluatorOutput: { verdict: "pass" },
            evaluatorScore: 0.90,
            producedEvidenceRefs: ["risk_profile"],
        });
        // Read domain memory from second run
        assert.equal(service.readMemory(run2, "domain", "domain_counter"), 1);
        assert.equal(service.readMemory(run2, "domain", "last_task"), "task-domain-share-001");
    }
    finally {
        ctx.cleanup();
    }
});
test("runLoop writes guardrail assessment to memory", () => {
    const ctx = createIntegrationContext("aa-memory-guardrail-");
    try {
        const service = new HarnessRuntimeService();
        const run = service.runLoop({
            taskId: "task-memory-guardrail-001",
            domainId: "security",
            constraintPack: createConstraintPack(),
            plannerOutput: { planId: "plan-guardrail-001" },
            generatorOutput: { artifact: "secure-code.diff" },
            evaluatorOutput: { verdict: "pass" },
            evaluatorScore: 0.85,
            producedEvidenceRefs: ["risk_profile"],
        });
        // runLoop internally writes last_guardrail_assessment to run memory
        const guardrailAssessment = service.readMemory(run, "run", "last_guardrail_assessment");
        assert.ok(guardrailAssessment);
        assert.equal(typeof guardrailAssessment, "object");
    }
    finally {
        ctx.cleanup();
    }
});
test("runLoop writes evaluator score to domain memory", () => {
    const ctx = createIntegrationContext("aa-memory-eval-score-");
    try {
        const service = new HarnessRuntimeService();
        const run = service.runLoop({
            taskId: "task-memory-eval-001",
            domainId: "coding",
            constraintPack: createConstraintPack(),
            plannerOutput: { planId: "plan-eval-001" },
            generatorOutput: { artifact: "code.diff" },
            evaluatorOutput: { verdict: "pass" },
            evaluatorScore: 0.92,
            producedEvidenceRefs: ["risk_profile"],
        });
        // runLoop internally writes last_evaluator_score to domain memory
        const evaluatorScore = service.readMemory(run, "domain", "last_evaluator_score");
        assert.equal(evaluatorScore, 0.92);
    }
    finally {
        ctx.cleanup();
    }
});
test("Memory with complex nested objects", () => {
    const ctx = createIntegrationContext("aa-memory-complex-");
    try {
        const service = new HarnessRuntimeService();
        const run = service.createRun({
            taskId: "task-memory-complex-001",
            domainId: "coding",
            constraintPack: createConstraintPack(),
        });
        const complexObject = {
            nested: {
                deep: {
                    value: 42,
                    array: [1, 2, 3],
                },
            },
            timestamp: new Date().toISOString(),
            metadata: {
                tags: ["integration", "test", "memory"],
                config: {
                    enabled: true,
                    threshold: 0.75,
                },
            },
        };
        service.writeMemory(run, "run", "complex_data", complexObject);
        service.writeMemory(run, "domain", "domain_config", {
            regions: ["us-east-1", "eu-west-1", "ap-southeast-1"],
            defaults: { timeout: 30000, retries: 3 },
        });
        // Read back and verify deep equality
        const retrievedComplex = service.readMemory(run, "run", "complex_data");
        assert.deepEqual(retrievedComplex, complexObject);
        const retrievedDomain = service.readMemory(run, "domain", "domain_config");
        assert.deepEqual(retrievedDomain, {
            regions: ["us-east-1", "eu-west-1", "ap-southeast-1"],
            defaults: { timeout: 30000, retries: 3 },
        });
    }
    finally {
        ctx.cleanup();
    }
});
test("Memory with various primitive types", () => {
    const ctx = createIntegrationContext("aa-memory-types-");
    try {
        const service = new HarnessRuntimeService();
        const run = service.createRun({
            taskId: "task-memory-types-001",
            domainId: "coding",
            constraintPack: createConstraintPack(),
        });
        // Write various primitive types
        service.writeMemory(run, "run", "string_val", "hello world");
        service.writeMemory(run, "run", "number_val", 42);
        service.writeMemory(run, "run", "float_val", 3.14159);
        service.writeMemory(run, "run", "boolean_val", true);
        service.writeMemory(run, "run", "null_val", null);
        service.writeMemory(run, "run", "array_val", ["a", "b", "c"]);
        // Read back and verify
        assert.equal(service.readMemory(run, "run", "string_val"), "hello world");
        assert.equal(service.readMemory(run, "run", "number_val"), 42);
        assert.equal(service.readMemory(run, "run", "float_val"), 3.14159);
        assert.equal(service.readMemory(run, "run", "boolean_val"), true);
        assert.equal(service.readMemory(run, "run", "null_val"), null);
        assert.deepEqual(service.readMemory(run, "run", "array_val"), ["a", "b", "c"]);
    }
    finally {
        ctx.cleanup();
    }
});
test("Memory can be updated (overwritten) with new values", () => {
    const ctx = createIntegrationContext("aa-memory-update-");
    try {
        const service = new HarnessRuntimeService();
        const run = service.createRun({
            taskId: "task-memory-update-001",
            domainId: "coding",
            constraintPack: createConstraintPack(),
        });
        // Initial write
        service.writeMemory(run, "run", "counter", 0);
        assert.equal(service.readMemory(run, "run", "counter"), 0);
        // Update to new value
        service.writeMemory(run, "run", "counter", 1);
        assert.equal(service.readMemory(run, "run", "counter"), 1);
        // Update again
        service.writeMemory(run, "run", "counter", 42);
        assert.equal(service.readMemory(run, "run", "counter"), 42);
        // Update to different type
        service.writeMemory(run, "run", "counter", "forty-two");
        assert.equal(service.readMemory(run, "run", "counter"), "forty-two");
    }
    finally {
        ctx.cleanup();
    }
});
test("Multiple namespaces can have different values for same key", () => {
    const ctx = createIntegrationContext("aa-memory-multi-ns-");
    try {
        const service = new HarnessRuntimeService();
        const run = service.createRun({
            taskId: "task-memory-multi-001",
            domainId: "coding",
            constraintPack: createConstraintPack(),
        });
        // Write same key to different namespaces
        service.writeMemory(run, "run", "shared_key", "run_value");
        service.writeMemory(run, "domain", "shared_key", "domain_value");
        service.writeMemory(run, "shared", "shared_key", "shared_value");
        // Each namespace has its own value
        assert.equal(service.readMemory(run, "run", "shared_key"), "run_value");
        assert.equal(service.readMemory(run, "domain", "shared_key"), "domain_value");
        assert.equal(service.readMemory(run, "shared", "shared_key"), "shared_value");
    }
    finally {
        ctx.cleanup();
    }
});
test("Memory read returns null for uninitialized scope", () => {
    const ctx = createIntegrationContext("aa-memory-null-");
    try {
        const service = new HarnessRuntimeService();
        // Create a run but never write to memory
        const run = service.createRun({
            taskId: "task-memory-null-001",
            domainId: "coding",
            constraintPack: createConstraintPack(),
        });
        // Read from run namespace - should return null
        assert.equal(service.readMemory(run, "run", "any_key"), null);
        // Read from domain namespace - should return null
        assert.equal(service.readMemory(run, "domain", "any_key"), null);
        // Read from shared namespace - should return null
        assert.equal(service.readMemory(run, "shared", "any_key"), null);
    }
    finally {
        ctx.cleanup();
    }
});
//# sourceMappingURL=memory-persistence.integration.test.js.map