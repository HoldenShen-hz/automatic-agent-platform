import assert from "node:assert/strict";
import test from "node:test";
import { PolicyCenterService, toUnifiedRuntimeMode } from "../../../../../src/platform/control-plane/policy-center/index.js";
// ---------------------------------------------------------------------------
// toUnifiedRuntimeMode exported function
// ---------------------------------------------------------------------------
test("toUnifiedRuntimeMode maps supervised to manual_only", () => {
    const result = toUnifiedRuntimeMode("supervised");
    assert.equal(result, "manual_only");
});
test("toUnifiedRuntimeMode maps auto to supervised_auto", () => {
    const result = toUnifiedRuntimeMode("auto");
    assert.equal(result, "supervised_auto");
});
test("toUnifiedRuntimeMode maps read-only to read_only", () => {
    const result = toUnifiedRuntimeMode("read-only");
    assert.equal(result, "read_only");
});
test("toUnifiedRuntimeMode maps full-auto to full_auto", () => {
    const result = toUnifiedRuntimeMode("full-auto");
    assert.equal(result, "full_auto");
});
test("toUnifiedRuntimeMode maps maintenance to no_rollout", () => {
    const result = toUnifiedRuntimeMode("maintenance");
    assert.equal(result, "no_rollout");
});
test("toUnifiedRuntimeMode maps incident-mode to incident_mode", () => {
    const result = toUnifiedRuntimeMode("incident-mode");
    assert.equal(result, "incident_mode");
});
test("toUnifiedRuntimeMode maps degraded to no_external_call", () => {
    const result = toUnifiedRuntimeMode("degraded");
    assert.equal(result, "no_external_call");
});
test("toUnifiedRuntimeMode maps emergency to no_write", () => {
    const result = toUnifiedRuntimeMode("emergency");
    assert.equal(result, "no_write");
});
// ---------------------------------------------------------------------------
// PolicyCenterService.toUnifiedRuntimeMode static method
// ---------------------------------------------------------------------------
test("PolicyCenterService.toUnifiedRuntimeMode maps maintenance mode", () => {
    const result = PolicyCenterService.toUnifiedRuntimeMode("maintenance");
    assert.equal(result, "no_rollout");
});
test("PolicyCenterService.toUnifiedRuntimeMode maps incident-mode", () => {
    const result = PolicyCenterService.toUnifiedRuntimeMode("incident-mode");
    assert.equal(result, "incident_mode");
});
// ---------------------------------------------------------------------------
// PolicyCenterOptions defaults
// ---------------------------------------------------------------------------
test("PolicyCenterService defaults budgetWarningCostUsd to null", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_cost_null",
        taskId: "task_1",
        subjectType: "user",
        subjectId: "user_1",
        action: "invoke_model",
        riskCategory: "cost_sensitive",
        mode: "auto",
        stage: "execute",
        estimatedCostUsd: 100.0,
    });
    // No budget exceeded because maxEstimatedCostUsd defaults to null
    assert.equal(result.decision, "allow");
});
test("PolicyCenterService defaults maxEstimatedCostUsd to null", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_max_null",
        taskId: "task_1",
        subjectType: "user",
        subjectId: "user_1",
        action: "invoke_model",
        riskCategory: "cost_sensitive",
        mode: "auto",
        stage: "execute",
        estimatedCostUsd: 1_000_000.0,
    });
    // No budget exceeded because maxEstimatedCostUsd defaults to null
    assert.equal(result.decision, "allow");
});
// ---------------------------------------------------------------------------
// Mutating actions in read-only mode
// ---------------------------------------------------------------------------
test("PolicyCenterService denies invoke_tool in read-only mode", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_readonly_tool",
        taskId: "task_1",
        subjectType: "user",
        subjectId: "user_1",
        action: "invoke_tool",
        riskCategory: "cost_sensitive",
        mode: "read-only",
        stage: "execute",
    });
    assert.equal(result.decision, "deny");
    assert.equal(result.reasonCode, "policy.read_only_mode_denied");
});
test("PolicyCenterService denies exec_command in read-only mode", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_readonly_cmd",
        taskId: "task_1",
        subjectType: "user",
        subjectId: "user_1",
        action: "exec_command",
        riskCategory: "destructive",
        mode: "read-only",
        stage: "execute",
    });
    assert.equal(result.decision, "deny");
    assert.equal(result.reasonCode, "policy.read_only_mode_denied");
});
test("PolicyCenterService denies dispatch_execution in read-only mode", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_readonly_dispatch",
        taskId: "task_1",
        subjectType: "user",
        subjectId: "user_1",
        action: "dispatch_execution",
        riskCategory: "prod_affecting",
        mode: "read-only",
        stage: "execute",
    });
    assert.equal(result.decision, "deny");
    assert.equal(result.reasonCode, "policy.read_only_mode_denied");
});
// ---------------------------------------------------------------------------
// Maintenance mode specific blocked actions
// ---------------------------------------------------------------------------
test("PolicyCenterService denies org_change in maintenance mode", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_maint_org",
        taskId: "task_1",
        subjectType: "agent",
        subjectId: "agent_1",
        action: "org_change",
        riskCategory: "org_changing",
        mode: "maintenance",
        stage: "execute",
    });
    assert.equal(result.decision, "deny");
    assert.equal(result.reasonCode, "policy.maintenance_mode_denied");
});
test("PolicyCenterService denies install_extension in maintenance mode", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_maint_ext",
        taskId: "task_1",
        subjectType: "agent",
        subjectId: "agent_1",
        action: "install_extension",
        riskCategory: "prod_affecting",
        mode: "maintenance",
        stage: "execute",
    });
    assert.equal(result.decision, "deny");
    assert.equal(result.reasonCode, "policy.maintenance_mode_denied");
});
// ---------------------------------------------------------------------------
// Emergency mode escalation
// ---------------------------------------------------------------------------
test("PolicyCenterService emergency mode requires approval for non-system subject", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_emerg_user",
        taskId: "task_1",
        subjectType: "user",
        subjectId: "user_1",
        action: "dispatch_execution",
        riskCategory: "destructive",
        mode: "emergency",
        stage: "execute",
    });
    assert.equal(result.decision, "escalate_for_approval");
    assert.equal(result.enforcedConstraints.breakGlass, true);
    assert.equal(result.enforcedConstraints.operatorAckRequired, true);
});
test("PolicyCenterService emergency mode allows agent without approval", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_emerg_agent",
        taskId: "task_1",
        subjectType: "agent",
        subjectId: "agent_1",
        action: "dispatch_execution",
        riskCategory: "destructive",
        mode: "emergency",
        stage: "execute",
    });
    assert.equal(result.decision, "escalate_for_approval");
});
test("PolicyCenterService emergency mode allows system without approval", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_emerg_sys",
        taskId: "task_1",
        subjectType: "system",
        subjectId: "system_1",
        action: "invoke_model",
        riskCategory: "governance_sensitive",
        mode: "emergency",
        stage: "execute",
    });
    assert.equal(result.decision, "allow_with_constraints");
});
// ---------------------------------------------------------------------------
// Full-auto mode risk category escalation
// ---------------------------------------------------------------------------
test("PolicyCenterService full-auto escalates prod_affecting", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_fa_prod",
        taskId: "task_1",
        subjectType: "agent",
        subjectId: "agent_1",
        action: "invoke_model",
        riskCategory: "prod_affecting",
        mode: "full-auto",
        stage: "execute",
    });
    assert.equal(result.decision, "escalate_for_approval");
});
test("PolicyCenterService full-auto escalates org_changing", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_fa_org",
        taskId: "task_1",
        subjectType: "agent",
        subjectId: "agent_1",
        action: "invoke_model",
        riskCategory: "org_changing",
        mode: "full-auto",
        stage: "execute",
    });
    assert.equal(result.decision, "escalate_for_approval");
});
test("PolicyCenterService full-auto does not escalate cost_sensitive", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_fa_cost",
        taskId: "task_1",
        subjectType: "agent",
        subjectId: "agent_1",
        action: "invoke_model",
        riskCategory: "cost_sensitive",
        mode: "full-auto",
        stage: "execute",
    });
    assert.equal(result.decision, "allow");
});
test("PolicyCenterService full-auto does not escalate irreversible", () => {
    const service = new PolicyCenterService({});
    const result = service.evaluate({
        decisionId: "dec_fa_irrev",
        taskId: "task_1",
        subjectType: "agent",
        subjectId: "agent_1",
        action: "invoke_model",
        riskCategory: "irreversible",
        mode: "full-auto",
        stage: "execute",
    });
    assert.equal(result.decision, "allow");
});
//# sourceMappingURL=to-unified-runtime-mode.test.js.map