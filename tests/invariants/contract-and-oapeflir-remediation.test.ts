import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const CONTRACT_FILE_BY_ISSUE: Readonly<Record<string, string>> = {
  "T-1": "runtime_state_machine_contract.md",
  "T-2": "side-effect-reconciliation-contract.md",
  "T-3": "budget-ledger-contract.md",
  "T-4": "version-lock-contract.md",
  "T-5": "event-envelope-contract.md",
  "T-6": "task_lease_and_fencing_contract.md",
  "T-7": "harness-run-contract.md",
  "T-8": "plan-graph-patch-contract.md",
  "T-9": "approval_and_hitl_contract.md",
  "T-10": "model_gateway_routing_contract.md",
  "T-11": "domain_descriptor_and_onboarding_contract.md",
  "T-12": "state_transition_matrix_contract.md",
  "T-13": "oapeflir_loop_contract.md",
  "T-14": "execution_plane_contract.md",
  "T-15": "runtime_execution_contract.md",
  "T-16": "sandbox_and_auth_contract.md",
  "T-17": "policy_engine_contract.md",
  "T-18": "context_propagation_contract.md",
  "T-19": "tool_and_provider_execution_contract.md",
  "T-20": "executable_unit_contract.md",
  "T-21": "lifecycle_and_termination_contract.md",
  "T-22": "task_and_workflow_contract.md",
  "T-23": "supervisor_contract.md",
  "T-24": "governance_control_plane_contract.md",
  "T-25": "proactive_agent_and_autonomy_contract.md",
  "T-26": "platform_panic_and_resume_contract.md",
  "T-27": "agent_contract.md",
  "T-28": "domain_descriptor_and_onboarding_contract.md",
  "T-29": "data_classification_and_prompt_handling_contract.md",
  "T-30": "compliance_report_generation_contract.md",
  "T-31": "distributed_locking_contract.md",
  "T-32": "transition_service_contract.md",
  "T-33": "storage_schema_contract.md",
  "T-34": "storage_schema_contract.md",
  "T-35": "monetization_metering_plane_contract.md",
  "T-36": "marketplace_catalog_and_revenue_contract.md",
  "T-37": "idempotency_and_recovery_matrix_contract.md",
  "T-38": "plugin_spi_contract.md",
  "T-39": "trace_and_root_cause_observability_contract.md",
  "T-40": "billing_and_tenant_contract.md",
  "T-41": "cost_and_budget_contract.md",
  "T-42": "cross_region_routing_and_data_residency_contract.md",
  "T-43": "marketplace_catalog_and_revenue_contract.md",
  "T-44": "sso_scim_and_identity_sync_contract.md",
  "T-45": "edge_runtime_and_sync_contract.md",
  "T-46": "node-run-attempt-receipt-contract.md",
  "T-47": "observability_contract.md",
  "T-48": "token_budget_allocation_contract.md",
  "T-49": "supply_chain_and_dependency_security_contract.md",
  "T-50": "enterprise_secret_management_contract.md",
  "T-51": "tenant_isolation_and_shared_worker_safety_contract.md",
  "T-52": "tool_output_sanitization_contract.md",
  "T-53": "cost_attribution_and_optimization_contract.md",
  "T-54": "approval_and_hitl_contract.md",
  "T-55": "monetization_metering_plane_contract.md",
  "T-56": "runtime_repository_and_migration_contract.md",
};

test("contract remediation sections directly cover T-1 through T-56", () => {
  for (let index = 1; index <= 56; index += 1) {
    const issueId = `T-${index}`;
    const filename = CONTRACT_FILE_BY_ISSUE[issueId];
    assert.equal(typeof filename, "string", `missing contract map for ${issueId}`);
    const file = join("docs_zh/contracts", filename);
    assert.equal(existsSync(file), true, `missing contract file for ${issueId}: ${file}`);
    const text = readFileSync(file, "utf8");
    assert.match(text, /## v4\.3 Architecture Remediation/);
    assert.match(text, new RegExp(`- ${issueId}:`));
    assert.match(text, /PlanGraphBundle/);
    assert.match(text, /RuntimeStateMachine\.transition/);
  }
});

test("OAPEFLIR executable spec remediation directly covers F-1 through F-25", () => {
  const text = readFileSync("docs_zh/architecture/oapeflir-v4.4-executable-spec.md", "utf8");
  assert.match(text, /## v4\.3 Canonical Compatibility Override/);
  assert.match(text, /HarnessRuntime 是唯一执行入口/);
  assert.match(text, /OAPEFLIR 只产生 `oapeflir\.view\.\*`/);
  for (let index = 1; index <= 25; index += 1) {
    assert.match(text, new RegExp(`- F-${index}:`));
  }
});
