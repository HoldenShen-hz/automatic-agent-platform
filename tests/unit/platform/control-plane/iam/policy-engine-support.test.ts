import assert from "node:assert/strict";
import test from "node:test";

import {
  MUTATING_POLICY_ACTIONS,
  normalizePolicyMode,
  ACTION_REQUIRED_ROLES,
  ACTION_REQUIRED_CAPABILITIES,
  LEGACY_CAPABILITY_ALIASES,
  LEGACY_CAPABILITY_TO_CANONICAL,
  resolveSubjectRoles,
  resolveSubjectCapabilities,
  validateSubjectPermissions,
  validatePolicyRequest,
  type PolicyAction,
} from "../../../../../src/platform/five-plane-control-plane/iam/policy-engine-support.js";

test("MUTATING_POLICY_ACTIONS contains expected write and execution actions", () => {
  const expectedMutatingActions: PolicyAction[] = [
    "invoke_tool",
    "write_file",
    "exec_command",
    "install_extension",
    "org_change",
    "dispatch_execution",
    "set_isolation_level",
    "promote_improvement",
    "advance_rollout",
    "modify_knowledge_trust",
    "promote_memory_layer",
  ];

  assert.deepEqual(MUTATING_POLICY_ACTIONS, expectedMutatingActions);
  assert.ok(MUTATING_POLICY_ACTIONS.includes("write_file"));
  assert.ok(MUTATING_POLICY_ACTIONS.includes("org_change"));
  assert.ok(!MUTATING_POLICY_ACTIONS.includes("invoke_model"));
});

test("normalizePolicyMode converts supervised to supervised_auto", () => {
  assert.equal(normalizePolicyMode("supervised"), "supervised_auto");
});

test("normalizePolicyMode converts auto to supervised_auto", () => {
  assert.equal(normalizePolicyMode("auto"), "supervised_auto");
});

test("normalizePolicyMode passes through unified runtime modes", () => {
  assert.equal(normalizePolicyMode("full_automation"), "full_automation");
  assert.equal(normalizePolicyMode("human_in_the_loop"), "human_in_the_loop");
});

test("ACTION_REQUIRED_ROLES maps actions to required roles", () => {
  assert.deepEqual(ACTION_REQUIRED_ROLES.invoke_model, ["model_invoker", "agent"]);
  assert.deepEqual(ACTION_REQUIRED_ROLES.invoke_tool, ["tool_executor", "agent"]);
  assert.deepEqual(ACTION_REQUIRED_ROLES.org_change, ["org_admin", "admin"]);
  assert.deepEqual(ACTION_REQUIRED_ROLES.install_extension, ["extension_manager", "admin"]);
});

test("ACTION_REQUIRED_CAPABILITIES maps actions to required capabilities", () => {
  assert.deepEqual(ACTION_REQUIRED_CAPABILITIES.invoke_model, ["model:invoke"]);
  assert.deepEqual(ACTION_REQUIRED_CAPABILITIES.exec_command, ["exec:command"]);
  assert.deepEqual(ACTION_REQUIRED_CAPABILITIES.org_change, ["org:change"]);
  assert.deepEqual(ACTION_REQUIRED_CAPABILITIES.network_access, ["network:access"]);
});

test("LEGACY_CAPABILITY_ALIASES contains expected mappings", () => {
  assert.deepEqual(LEGACY_CAPABILITY_ALIASES["model:invoke"], ["model.call"]);
  assert.deepEqual(LEGACY_CAPABILITY_ALIASES["exec:command"], ["command.execute", "command.execute.shell"]);
  assert.deepEqual(LEGACY_CAPABILITY_ALIASES["fs:write"], ["file.write"]);
});

test("LEGACY_CAPABILITY_TO_CANONICAL resolves aliases to canonical form", () => {
  assert.equal(LEGACY_CAPABILITY_TO_CANONICAL.get("model.call"), "model:invoke");
  assert.equal(LEGACY_CAPABILITY_TO_CANONICAL.get("command.execute"), "exec:command");
  assert.equal(LEGACY_CAPABILITY_TO_CANONICAL.get("file.write"), "fs:write");
  assert.equal(LEGACY_CAPABILITY_TO_CANONICAL.get("extension.install"), "extension:install");
  assert.equal(LEGACY_CAPABILITY_TO_CANONICAL.get("command.execute.shell"), "exec:command");
});

test("resolveSubjectRoles returns subjectRoles when provided", () => {
  const roles = resolveSubjectRoles({
    decisionId: "d1",
    taskId: "t1",
    subjectType: "agent",
    subjectId: "a1",
    action: "invoke_tool",
    riskCategory: "sensitive_data",
    mode: "auto",
    subjectRoles: ["custom_role", "agent"],
  });

  assert.deepEqual(roles, ["custom_role", "agent"]);
});

test("resolveSubjectRoles falls back to ACTION_REQUIRED_ROLES when not provided", () => {
  const roles = resolveSubjectRoles({
    decisionId: "d1",
    taskId: "t1",
    subjectType: "agent",
    subjectId: "a1",
    action: "org_change",
    riskCategory: "org_changing",
    mode: "auto",
  });

  assert.deepEqual(roles, ["org_admin", "admin"]);
});

test("resolveSubjectCapabilities returns normalized capabilities", () => {
  const caps = resolveSubjectCapabilities({
    decisionId: "d1",
    taskId: "t1",
    subjectType: "agent",
    subjectId: "a1",
    action: "exec_command",
    riskCategory: "sensitive_data",
    mode: "auto",
    subjectCapabilities: ["command.execute", "command.execute.shell"],
  });

  assert.ok(caps.includes("exec:command"));
  assert.ok(caps.includes("command.execute"));
  assert.ok(caps.includes("command.execute.shell"));
});

test("resolveSubjectCapabilities deduplicates legacy and canonical forms", () => {
  const caps = resolveSubjectCapabilities({
    decisionId: "d1",
    taskId: "t1",
    subjectType: "agent",
    subjectId: "a1",
    action: "exec_command",
    riskCategory: "sensitive_data",
    mode: "auto",
    subjectCapabilities: ["exec:command", "command.execute"],
  });

  assert.ok(caps.includes("exec:command"));
  const execCommandCount = caps.filter((c) => c === "exec:command").length;
  assert.equal(execCommandCount, 1, "Should deduplicate canonical form");
});

test("resolveSubjectCapabilities falls back to required capabilities when not provided", () => {
  const caps = resolveSubjectCapabilities({
    decisionId: "d1",
    taskId: "t1",
    subjectType: "agent",
    subjectId: "a1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
  });

  assert.deepEqual(caps, ["model:invoke"]);
});

test("validateSubjectPermissions passes for subject with required role", () => {
  assert.doesNotThrow(() => {
    validateSubjectPermissions({
      decisionId: "d1",
      taskId: "t1",
      subjectType: "agent",
      subjectId: "a1",
      action: "invoke_tool",
      riskCategory: "sensitive_data",
      mode: "auto",
      subjectRoles: ["tool_executor", "agent"],
      subjectCapabilities: ["tool:invoke"],
    });
  });
});

test("validateSubjectPermissions passes for subject with required capability", () => {
  assert.doesNotThrow(() => {
    validateSubjectPermissions({
      decisionId: "d1",
      taskId: "t1",
      subjectType: "agent",
      subjectId: "a1",
      action: "invoke_model",
      riskCategory: "cost_sensitive",
      mode: "auto",
      subjectRoles: ["model_invoker"],
      subjectCapabilities: ["model:invoke"],
    });
  });
});

test("validateSubjectPermissions throws when subject lacks required roles", () => {
  assert.throws(
    () => {
      validateSubjectPermissions({
        decisionId: "d1",
        taskId: "t1",
        subjectType: "agent",
        subjectId: "a1",
        action: "org_change",
        riskCategory: "org_changing",
        mode: "auto",
        subjectRoles: ["viewer"],
        subjectCapabilities: [],
      });
    },
    (err: any) => {
      return err.code === "policy.subject_missing_roles" && err.message.includes("org_admin");
    },
  );
});

test("validateSubjectPermissions throws when subject lacks required capabilities", () => {
  assert.throws(
    () => {
      validateSubjectPermissions({
        decisionId: "d1",
        taskId: "t1",
        subjectType: "agent",
        subjectId: "a1",
        action: "exec_command",
        riskCategory: "sensitive_data",
        mode: "auto",
        subjectRoles: ["command_executor"],
        subjectCapabilities: ["fs:write"],
      });
    },
    (err: any) => {
      return err.code === "policy.subject_missing_capabilities" && err.message.includes("exec:command");
    },
  );
});

test("validatePolicyRequest throws for empty decisionId", () => {
  assert.throws(
    () => {
      validatePolicyRequest({
        decisionId: "",
        taskId: "t1",
        subjectType: "agent",
        subjectId: "a1",
        action: "invoke_tool",
        riskCategory: "sensitive_data",
        mode: "auto",
      });
    },
    (err: any) => err.code === "policy.invalid_decision_id",
  );
});

test("validatePolicyRequest throws for empty taskId", () => {
  assert.throws(
    () => {
      validatePolicyRequest({
        decisionId: "d1",
        taskId: "",
        subjectType: "agent",
        subjectId: "a1",
        action: "invoke_tool",
        riskCategory: "sensitive_data",
        mode: "auto",
      });
    },
    (err: any) => err.code === "policy.invalid_task_id",
  );
});

test("validatePolicyRequest throws for empty subjectId", () => {
  assert.throws(
    () => {
      validatePolicyRequest({
        decisionId: "d1",
        taskId: "t1",
        subjectType: "agent",
        subjectId: "",
        action: "invoke_tool",
        riskCategory: "sensitive_data",
        mode: "auto",
      });
    },
    (err: any) => err.code === "policy.invalid_subject_id",
  );
});

test("validatePolicyRequest throws for invalid action", () => {
  assert.throws(
    () => {
      validatePolicyRequest({
        decisionId: "d1",
        taskId: "t1",
        subjectType: "agent",
        subjectId: "a1",
        action: "" as PolicyAction,
        riskCategory: "sensitive_data",
        mode: "auto",
      });
    },
    (err: any) => err.code === "policy.invalid_action",
  );
});

test("validatePolicyRequest throws for invalid riskCategory", () => {
  assert.throws(
    () => {
      validatePolicyRequest({
        decisionId: "d1",
        taskId: "t1",
        subjectType: "agent",
        subjectId: "a1",
        action: "invoke_tool",
        riskCategory: "",
        mode: "auto",
      });
    },
    (err: any) => err.code === "policy.invalid_risk_category",
  );
});

test("validatePolicyRequest throws for invalid mode", () => {
  assert.throws(
    () => {
      validatePolicyRequest({
        decisionId: "d1",
        taskId: "t1",
        subjectType: "agent",
        subjectId: "a1",
        action: "invoke_tool",
        riskCategory: "sensitive_data",
        mode: "",
      });
    },
    (err: any) => err.code === "policy.invalid_mode",
  );
});

test("validatePolicyRequest passes for valid request", () => {
  assert.doesNotThrow(() => {
    validatePolicyRequest({
      decisionId: "d1",
      taskId: "t1",
      subjectType: "agent",
      subjectId: "a1",
      action: "invoke_tool",
      riskCategory: "sensitive_data",
      mode: "auto",
    });
  });
});

test("validatePolicyRequest passes for request with all optional fields", () => {
  assert.doesNotThrow(() => {
    validatePolicyRequest({
      decisionId: "decision-123",
      taskId: "task-456",
      subjectType: "user",
      subjectId: "user-789",
      action: "org_change",
      riskCategory: "org_changing",
      mode: "supervised",
      subjectRoles: ["org_admin"],
      subjectCapabilities: ["org:change"],
      resourceRef: "resource-001",
      stageViewRef: "execute",
      estimatedCostUsd: 10,
      metadata: { key: "value" },
    });
  });
});

test("validateSubjectPermissions error details contain expected fields", () => {
  try {
    validateSubjectPermissions({
      decisionId: "d1",
      taskId: "t1",
      subjectType: "agent",
      subjectId: "agent-001",
      action: "install_extension",
      riskCategory: "governance_sensitive",
      mode: "auto",
      subjectRoles: ["viewer"],
      subjectCapabilities: [],
    });
    assert.fail("Expected ValidationError to be thrown");
  } catch (err: any) {
    assert.equal(err.code, "policy.subject_missing_roles");
    assert.ok(err.details);
    assert.equal(err.details.subjectId, "agent-001");
    assert.equal(err.details.action, "install_extension");
    assert.ok(Array.isArray(err.details.missingRoles));
    assert.ok(Array.isArray(err.details.requiredRoles));
  }
});

test("LEGACY_CAPABILITY_TO_CANONICAL contains all legacy aliases", () => {
  const legacyAliases = [
    "model.call",
    "tool.execute",
    "file.write",
    "command.execute",
    "command.execute.shell",
    "network.access",
    "extension.install",
    "org.change",
    "execution.dispatch",
    "improvement.promote",
    "rollout.advance",
    "knowledge.trust.modify",
    "memory.promote",
  ];

  for (const alias of legacyAliases) {
    assert.ok(
      LEGACY_CAPABILITY_TO_CANONICAL.has(alias),
      `Expected ${alias} to be in LEGACY_CAPABILITY_TO_CANONICAL`,
    );
  }
});

test("resolveSubjectCapabilities returns empty array when explicitly set to empty", () => {
  // When subjectCapabilities is explicitly set to empty array, it means
  // "no capabilities granted" - the explicit empty takes precedence over defaults
  const caps = resolveSubjectCapabilities({
    decisionId: "d1",
    taskId: "t1",
    subjectType: "agent",
    subjectId: "a1",
    action: "network_access",
    riskCategory: "sensitive_data",
    mode: "auto",
    subjectCapabilities: [],
  });

  // Empty array is returned as-is when explicitly provided
  assert.deepEqual(caps, []);
});

test("resolveSubjectCapabilities falls back to required capabilities only when undefined", () => {
  // When subjectCapabilities is undefined, fall back to defaults
  const caps = resolveSubjectCapabilities({
    decisionId: "d1",
    taskId: "t1",
    subjectType: "agent",
    subjectId: "a1",
    action: "network_access",
    riskCategory: "sensitive_data",
    mode: "auto",
    // subjectCapabilities not provided (undefined)
  });

  assert.ok(caps.includes("network:access"));
});

test("ACTION_REQUIRED_ROLES covers all PolicyAction values", () => {
  const actions: PolicyAction[] = [
    "invoke_model",
    "invoke_tool",
    "write_file",
    "exec_command",
    "network_access",
    "install_extension",
    "org_change",
    "dispatch_execution",
    "set_isolation_level",
    "promote_improvement",
    "advance_rollout",
    "modify_knowledge_trust",
    "promote_memory_layer",
  ];

  for (const action of actions) {
    assert.ok(
      action in ACTION_REQUIRED_ROLES,
      `Expected ${action} to have required roles defined`,
    );
    assert.ok(Array.isArray(ACTION_REQUIRED_ROLES[action]));
  }
});

test("ACTION_REQUIRED_CAPABILITIES covers all PolicyAction values", () => {
  const actions: PolicyAction[] = [
    "invoke_model",
    "invoke_tool",
    "write_file",
    "exec_command",
    "network_access",
    "install_extension",
    "org_change",
    "dispatch_execution",
    "set_isolation_level",
    "promote_improvement",
    "advance_rollout",
    "modify_knowledge_trust",
    "promote_memory_layer",
  ];

  for (const action of actions) {
    assert.ok(
      action in ACTION_REQUIRED_CAPABILITIES,
      `Expected ${action} to have required capabilities defined`,
    );
    assert.ok(Array.isArray(ACTION_REQUIRED_CAPABILITIES[action]));
  }
});