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

test("canonical contract text directly encodes the first unresolved contract fixes", () => {
  const eventEnvelope = readFileSync("docs_zh/contracts/event-envelope-contract.md", "utf8");
  assert.match(eventEnvelope, /schema_version/);
  assert.match(eventEnvelope, /idempotency_key/);
  assert.match(eventEnvelope, /partition_key/);
  assert.match(eventEnvelope, /ttl/);

  const lease = readFileSync("docs_zh/contracts/task_lease_and_fencing_contract.md", "utf8");
  assert.match(lease, /node_run_id/);
  assert.match(lease, /attempt_id/);
  assert.match(lease, /legacy queue \/ repository 字段；v4\.3 规范对象应映射为 `node_run_id`/);

  const planGraph = readFileSync("docs_zh/contracts/plan-graph-patch-contract.md", "utf8");
  assert.match(planGraph, /不可变快照/);
  assert.match(planGraph, /appendNode/);
  assert.match(planGraph, /任意语义变更都必须表达为 `GraphPatch/);

  const approval = readFileSync("docs_zh/contracts/approval_and_hitl_contract.md", "utf8");
  assert.match(approval, /timeout_auto_action/);
  assert.match(approval, /escalation_chain/);
  assert.match(approval, /stage_view_ref/);
  assert.match(approval, /harness_run_id/);

  const modelRouting = readFileSync("docs_zh/contracts/model_gateway_routing_contract.md", "utf8");
  assert.match(modelRouting, /compliance_constrained/);
  assert.match(modelRouting, /hybrid/);
  assert.match(modelRouting, /routingStrategy/);

  const domainDescriptor = readFileSync("docs_zh/contracts/domain_descriptor_and_onboarding_contract.md", "utf8");
  assert.match(domainDescriptor, /guardrail_overlay/);
  assert.match(domainDescriptor, /advisory_only/);
  assert.match(domainDescriptor, /human_accountable/);
  assert.match(domainDescriptor, /deterministic_hot_path_only/);

  const stateTransition = readFileSync("docs_zh/contracts/state_transition_matrix_contract.md", "utf8");
  assert.match(stateTransition, /HarnessRun\.status/);
  assert.match(stateTransition, /NodeRun\.status/);
  assert.match(stateTransition, /任务\/工作流\/execution 读模型/);

  const oapeflirLoop = readFileSync("docs_zh/contracts/oapeflir_loop_contract.md", "utf8");
  assert.match(oapeflirLoop, /OAPEFLIR 不是执行引擎/);
  assert.match(oapeflirLoop, /NodeAttemptReceipt/);
  assert.match(oapeflirLoop, /ReleaseProposal/);
  assert.doesNotMatch(oapeflirLoop, /finalOutcome: ExecutionOutcome/);

  const executionPlane = readFileSync("docs_zh/contracts/execution_plane_contract.md", "utf8");
  assert.match(executionPlane, /plan_graph_bundle_id/);
  assert.match(executionPlane, /node_run_id/);
  assert.match(executionPlane, /NodeAttemptReceipt/);
  assert.match(executionPlane, /DualChannelStepOutput.*用户展示投影/s);

  const runtimeExecution = readFileSync("docs_zh/contracts/runtime_execution_contract.md", "utf8");
  assert.match(runtimeExecution, /harness_run_id/);
  assert.match(runtimeExecution, /node_run_id/);
  assert.match(runtimeExecution, /attempt_id/);
  assert.match(runtimeExecution, /stage_view_ref/);
  assert.doesNotMatch(runtimeExecution, /\| `stage` \|/);

  const contextPropagation = readFileSync("docs_zh/contracts/context_propagation_contract.md", "utf8");
  assert.match(contextPropagation, /harness_run_id/);
  assert.match(contextPropagation, /node_run_id/);
  assert.match(contextPropagation, /plan_graph_id/);
  assert.match(contextPropagation, /graph_version/);
  assert.match(contextPropagation, /attempt_id/);

  const toolProvider = readFileSync("docs_zh/contracts/tool_and_provider_execution_contract.md", "utf8");
  assert.match(toolProvider, /BudgetReservationDecision/);
  assert.match(toolProvider, /reservation_id/);
  assert.match(toolProvider, /reserved \| rejected \| review_required/);
  assert.match(toolProvider, /harness_run_id/);
  assert.match(toolProvider, /node_run_id/);

  const taskWorkflow = readFileSync("docs_zh/contracts/task_and_workflow_contract.md", "utf8");
  assert.match(taskWorkflow, /WorkflowState 投影字段/);
  assert.match(taskWorkflow, /current_stage_view/);
  assert.match(taskWorkflow, /`PlanGraphBundle` 是 plan 阶段到 execute 阶段的唯一权威交接对象/);
  assert.match(taskWorkflow, /`PlanDTO` 仅允许作为 legacy 调试视图或导入输入/);

  const sandbox = readFileSync("docs_zh/contracts/sandbox_and_auth_contract.md", "utf8");
  assert.match(sandbox, /read_only/);
  assert.match(sandbox, /workspace_write/);
  assert.match(sandbox, /scoped_external_access/);
  assert.match(sandbox, /restricted_exec/);
  assert.match(sandbox, /deprecated migration aliases/);

  const policyEngine = readFileSync("docs_zh/contracts/policy_engine_contract.md", "utf8");
  assert.match(policyEngine, /full_auto/);
  assert.match(policyEngine, /supervised_auto/);
  assert.match(policyEngine, /incident-mode/);
  assert.match(policyEngine, /legacy 输入并在入口归一化/);

  const executableUnit = readFileSync("docs_zh/contracts/executable_unit_contract.md", "utf8");
  assert.match(executableUnit, /`ExecutableUnit` 不是 runtime truth/);
  assert.match(executableUnit, /harness_run_id/);
  assert.match(executableUnit, /node_run_id/);
  assert.match(executableUnit, /attempt_id/);
  assert.match(executableUnit, /unit_kind` 只能作为导入映射/);

  const lifecycle = readFileSync("docs_zh/contracts/lifecycle_and_termination_contract.md", "utf8");
  assert.match(lifecycle, /`HarnessRun\.status` canonical states/);
  assert.match(lifecycle, /`NodeRun\.status` canonical states/);
  assert.match(lifecycle, /created_like/);
  assert.match(lifecycle, /waiting_like/);

  const supervisor = readFileSync("docs_zh/contracts/supervisor_contract.md", "utf8");
  assert.match(supervisor, /harness_run_id/);
  assert.match(supervisor, /node_run_id/);
  assert.match(supervisor, /attempt_id/);
  assert.match(supervisor, /SEV1/);
  assert.match(supervisor, /SEV2/);
  assert.match(supervisor, /SEV3/);
  assert.match(supervisor, /SEV4/);
  assert.match(supervisor, /current_node_view_ref/);

  const governance = readFileSync("docs_zh/contracts/governance_control_plane_contract.md", "utf8");
  assert.match(governance, /OperationalDirective/);
  assert.match(governance, /DecisionDirective/);
  assert.match(governance, /P2 -> P3 \/ P4 的常规控制必须通过 `OperationalDirective` 或 `DecisionDirective` 下发/);
  assert.match(governance, /PolicyDecisionRequest/);

  const autonomy = readFileSync("docs_zh/contracts/proactive_agent_and_autonomy_contract.md", "utf8");
  assert.match(autonomy, /RuntimeModeEnvelope/);
  assert.match(autonomy, /full_auto/);
  assert.match(autonomy, /supervised_auto/);
  assert.match(autonomy, /manual_only/);
  assert.match(autonomy, /incident-mode/);

  const panicResume = readFileSync("docs_zh/contracts/platform_panic_and_resume_contract.md", "utf8");
  assert.match(panicResume, /`scope` canonical enum/);
  assert.match(panicResume, /platform/);
  assert.match(panicResume, /region/);
  assert.match(panicResume, /run/);
  assert.match(panicResume, /node/);
  assert.match(panicResume, /approved_by/);
  assert.match(panicResume, /compatibility_check_ref/);

  const agent = readFileSync("docs_zh/contracts/agent_contract.md", "utf8");
  assert.match(agent, /DomainBinding/);
  assert.match(agent, /domain_id/);
  assert.match(agent, /domain_descriptor_ref/);
  assert.match(agent, /PlanGraphDispatch \(PlanGraphBundle\)/);
  assert.match(agent, /role_kind` \(`platform \| domain`\)/);

  const dataClassification = readFileSync("docs_zh/contracts/data_classification_and_prompt_handling_contract.md", "utf8");
  assert.match(dataClassification, /DataTaintPropagationRecord/);
  assert.match(dataClassification, /max_input_data_class/);
  assert.match(dataClassification, /output_data_class/);
  assert.match(dataClassification, /redaction_report_ref/);
  assert.match(dataClassification, /desensitization_evidence_ref/);

  const complianceReport = readFileSync("docs_zh/contracts/compliance_report_generation_contract.md", "utf8");
  assert.match(complianceReport, /EvidenceRecord/);
  assert.match(complianceReport, /AuditAppendCommand/);
  assert.match(complianceReport, /event_envelope_ref/);
  assert.match(complianceReport, /source_event_type/);
  assert.match(complianceReport, /required_event_types/);

  const distributedLocking = readFileSync("docs_zh/contracts/distributed_locking_contract.md", "utf8");
  assert.match(distributedLocking, /LockTransitionCommand/);
  assert.match(distributedLocking, /execution_lease/);
  assert.match(distributedLocking, /RuntimeStateMachine\.transition\(command\)/);
  assert.match(distributedLocking, /不能成为旁路状态机/);
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
