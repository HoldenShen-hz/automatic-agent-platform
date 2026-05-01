import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function stripRemediationSection(text: string, heading: string): string {
  const index = text.indexOf(heading);
  return index >= 0 ? text.slice(0, index) : text;
}

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

  const transitionService = readFileSync("docs_zh/contracts/transition_service_contract.md", "utf8");
  assert.match(transitionService, /harness_run \\\| node_run \\\| side_effect \\\| budget_reservation/);
  assert.match(transitionService, /session_projection \\\| approval_projection \\\| task_projection \\\| workflow_projection/);
  assert.match(transitionService, /truth entity kind/);
  assert.match(transitionService, /execution.*migration input/s);
  assert.match(transitionService, /transitionHarnessRun/);
  assert.match(transitionService, /transitionNodeRun/);
  assert.match(transitionService, /transitionSideEffect/);
  assert.match(transitionService, /transitionBudgetReservation/);

  const storageSchema = readFileSync("docs_zh/contracts/storage_schema_contract.md", "utf8");
  assert.match(storageSchema, /harness_runs/);
  assert.match(storageSchema, /plan_graph_bundles/);
  assert.match(storageSchema, /node_runs/);
  assert.match(storageSchema, /node_attempts/);
  assert.match(storageSchema, /node_attempt_receipts/);
  assert.match(storageSchema, /budget_ledgers/);
  assert.match(storageSchema, /budget_reservations/);
  assert.match(storageSchema, /tasks.*projection \/ interaction 表/s);
  assert.match(storageSchema, /layer_level INTEGER NOT NULL/);
  assert.match(storageSchema, /token_budget INTEGER NULL/);
  assert.match(storageSchema, /freshness_state TEXT NOT NULL DEFAULT 'fresh'/);
  assert.match(storageSchema, /source_refs_json TEXT NULL/);

  const monetization = readFileSync("docs_zh/contracts/monetization_metering_plane_contract.md", "utf8");
  assert.match(monetization, /BudgetLedgerProjector/);
  assert.match(monetization, /SettlementReadModel/);
  assert.match(monetization, /SettlementReadEntry/);
  assert.match(monetization, /BudgetLedger \/ BudgetReservation \/ BudgetSettlement.*runtime truth/s);
  assert.match(monetization, /harness_run_id/);
  assert.match(monetization, /node_run_id/);
  assert.match(monetization, /runtime \\\| api \\\| gateway \\\| admin \\\| tool \\\| model \\\| side_effect/);
  assert.match(monetization, /provider_invoice \\\| internal_compute \\\| human_review \\\| storage \\\| egress/);
  assert.match(monetization, /不得绕过 `BudgetLedger \/ BudgetReservation \/ BudgetSettlement` truth 直接写 invoice ledger 字段/);

  const marketplace = readFileSync("docs_zh/contracts/marketplace_catalog_and_revenue_contract.md", "utf8");
  assert.match(marketplace, /CommercialTermsProjection/);
  assert.match(marketplace, /revenue_share_ref/);
  assert.match(marketplace, /不得参与 Pack 执行授权、安装安全判定或 runtime sandbox 决策/);
  assert.match(marketplace, /review_status/);
  assert.match(marketplace, /active/);
  assert.match(marketplace, /sunset/);
  assert.match(marketplace, /removed/);

  const idempotencyRecovery = readFileSync("docs_zh/contracts/idempotency_and_recovery_matrix_contract.md", "utf8");
  assert.match(idempotencyRecovery, /NodeRun \/ NodeAttempt/);
  assert.match(idempotencyRecovery, /NodeAttemptReceipt/);
  assert.match(idempotencyRecovery, /step_id.*只允许作为语义标签或展示投影/s);
  assert.doesNotMatch(idempotencyRecovery, /## 4\. Workflow Step 级矩阵/);

  const pluginSpi = readFileSync("docs_zh/contracts/plugin_spi_contract.md", "utf8");
  assert.match(pluginSpi, /Promise<PlanGraphBundle>/);
  assert.match(pluginSpi, /harnessRunId/);
  assert.match(pluginSpi, /nodeRunId/);
  assert.match(pluginSpi, /attemptId/);
  assert.match(pluginSpi, /PlanGraphBundle \| NodeAttemptReceipt \| Artifact/);
  assert.match(pluginSpi, /\| Release \| DomainPresenterPlugin 格式化发布报告 \|/);

  const traceRca = readFileSync("docs_zh/contracts/trace_and_root_cause_observability_contract.md", "utf8");
  assert.match(traceRca, /一个 `HarnessRun` = 一个 `trace`/);
  assert.match(traceRca, /一个 `NodeRun` = 一个主执行 `span`/);
  assert.match(traceRca, /一个 `NodeAttempt` = 一个尝试 `span`/);
  assert.match(traceRca, /harness_run_id/);
  assert.match(traceRca, /node_run_id/);
  assert.match(traceRca, /attempt_id/);
  assert.match(traceRca, /stage_view_ref/);

  const billingTenant = readFileSync("docs_zh/contracts/billing_and_tenant_contract.md", "utf8");
  assert.match(billingTenant, /UsageRecord/);
  assert.match(billingTenant, /BudgetLedger/);
  assert.match(billingTenant, /BudgetReservation/);
  assert.match(billingTenant, /harness_run_id/);
  assert.match(billingTenant, /node_run_id/);
  assert.match(billingTenant, /只能向 billing projection 单向派生/);

  const costBudget = readFileSync("docs_zh/contracts/cost_and_budget_contract.md", "utf8");
  assert.match(costBudget, /max_cost_usd/);
  assert.match(costBudget, /max_model_tokens/);
  assert.match(costBudget, /max_context_tokens/);
  assert.match(costBudget, /max_output_tokens/);
  assert.match(costBudget, /max_steps/);
  assert.match(costBudget, /max_duration_ms/);
  assert.match(costBudget, /max_task_cost_usd \/ max_daily_cost_usd \/ max_monthly_cost_usd.*projection guardrail/s);
  assert.match(costBudget, /BudgetLedger \/ BudgetReservation \/ BudgetSettlement/);

  const crossRegion = readFileSync("docs_zh/contracts/cross_region_routing_and_data_residency_contract.md", "utf8");
  assert.match(crossRegion, /provider/);
  assert.match(crossRegion, /control_plane_endpoint/);
  assert.match(crossRegion, /data_plane_endpoint/);
  assert.match(crossRegion, /data_residency_policy/);
  assert.match(crossRegion, /CAS/);
  assert.match(crossRegion, /lease/);
  assert.match(crossRegion, /fencing token/);
  assert.match(crossRegion, /active region owner/);

  const identitySync = readFileSync("docs_zh/contracts/sso_scim_and_identity_sync_contract.md", "utf8");
  assert.match(identitySync, /oidc \| saml2 \| scim/);
  assert.match(identitySync, /IdentitySyncDlqRecord/);
  assert.match(identitySync, /identity_sync_dlq/);
  assert.match(identitySync, /人工重放/);
  assert.match(identitySync, /幂等重试/);

  const edgeRuntime = readFileSync("docs_zh/contracts/edge_runtime_and_sync_contract.md", "utf8");
  assert.match(edgeRuntime, /stateful/);
  assert.match(edgeRuntime, /lease_migration_supported/);
  assert.match(edgeRuntime, /checkpoint_required_before_preempt/);
  assert.match(edgeRuntime, /stateful = true/);
  assert.match(edgeRuntime, /活跃 `NodeRun`/);

  const receiptContract = readFileSync("docs_zh/contracts/node-run-attempt-receipt-contract.md", "utf8");
  assert.match(receiptContract, /\| `receiptId` \| `string` \| receipt ID \|/);
  assert.match(receiptContract, /nodeAttemptReceiptId.*deprecated storage-shaped key/);
  assert.doesNotMatch(receiptContract, /\| `nodeAttemptReceiptId` \| `string` \| receipt ID \|/);

  const observability = readFileSync("docs_zh/contracts/observability_contract.md", "utf8");
  assert.match(observability, /harnessRunMetrics/);
  assert.match(observability, /nodeRunMetrics/);
  assert.match(observability, /attemptMetrics/);
  assert.match(observability, /oapeflirViewMetrics/);
  assert.match(observability, /stageViewMetrics/);
  assert.match(observability, /view \/ trace \/ rationale 指标/);
  assert.match(observability, /releaseMetrics/);

  const tokenBudget = readFileSync("docs_zh/contracts/token_budget_allocation_contract.md", "utf8");
  assert.match(tokenBudget, /per_harness_run_budget/);
  assert.match(tokenBudget, /per_node_budget/);
  assert.match(tokenBudget, /与 `BudgetReservation` 状态机的绑定/);
  assert.match(tokenBudget, /reserved -> settled -> released/);
  assert.match(tokenBudget, /申请多少 reservation/);

  const supplyChain = readFileSync("docs_zh/contracts/supply_chain_and_dependency_security_contract.md", "utf8");
  assert.match(supplyChain, /PluginTrustStore/);
  assert.match(supplyChain, /trust_roots/);
  assert.match(supplyChain, /signing_key_rotation_policy/);
  assert.match(supplyChain, /revocation_list_ref/);
  assert.match(supplyChain, /security_advisory_ref/);
  assert.match(supplyChain, /quarantine_status/);
  assert.match(supplyChain, /tenant_impact_scope/);

  const secretManagement = readFileSync("docs_zh/contracts/enterprise_secret_management_contract.md", "utf8");
  assert.match(secretManagement, /TTL <= 300s/);
  assert.match(secretManagement, /ttl_seconds/);

  const tenantIsolation = readFileSync("docs_zh/contracts/tenant_isolation_and_shared_worker_safety_contract.md", "utf8");
  assert.match(tenantIsolation, /failure_rate > 30%/);
  assert.match(tenantIsolation, /min_sample_size/);
  assert.match(tenantIsolation, /默认不得低于 `20`/);
  assert.match(tenantIsolation, /自动隔离触发器/);

  const toolSanitization = readFileSync("docs_zh/contracts/tool_output_sanitization_contract.md", "utf8");
  assert.match(toolSanitization, /## 9\. Current \/ Transition 边界/);
  assert.doesNotMatch(toolSanitization, /## 9\. Phase 边界/);
  assert.doesNotMatch(toolSanitization, /Phase 1a 明确做：/);

  const costAttribution = readFileSync("docs_zh/contracts/cost_attribution_and_optimization_contract.md", "utf8");
  assert.match(costAttribution, /harness_run_id/);
  assert.match(costAttribution, /node_run_id/);
  assert.match(costAttribution, /budget_settlement_ref/);
  assert.match(costAttribution, /decision_directive_ref/);
  assert.match(costAttribution, /不得进入自动优化建议/);

  const runtimeRepository = readFileSync("docs_zh/contracts/runtime_repository_and_migration_contract.md", "utf8");
  assert.match(runtimeRepository, /TransitionRepositoryAdapter/);
  assert.match(runtimeRepository, /RuntimeStateMachine\.transition\(command\)/);
  assert.match(runtimeRepository, /markExecutionStarted/);
  assert.match(runtimeRepository, /legacy compatibility adapter/);
  assert.match(runtimeRepository, /harness_runs/);
  assert.match(runtimeRepository, /node_attempt_receipts/);
});

test("task intake and harness run contracts now require canonical domain binding", () => {
  const intake = readFileSync("docs_zh/contracts/task-intake-request-contract.md", "utf8");
  assert.match(intake, /\| `domainId` \| `string` \| 已归一化的执行域绑定/);
  assert.match(intake, /\| `priority` \| `number` \| admission \/ scheduler 优先级/);
  assert.match(intake, /`ConfirmedTaskSpec` 阶段回退为 legacy division 标识/);
  assert.match(intake, /后续 `HarnessRun`、risk overlay、knowledge boundary 与 prompt 库选择不得再从 `divisionId` 反推/);

  const harnessRun = readFileSync("docs_zh/contracts/harness-run-contract.md", "utf8");
  assert.match(harnessRun, /\| `domainId` \| `string` \| canonical 域绑定/);
  assert.match(harnessRun, /`domainId` 是 run truth 的一部分/);
  assert.match(harnessRun, /projection 若展示 `divisionId`、`domainHint` 或业务别名，必须保留 `domainId -> legacy alias` 的显式映射/);
});

test("event, workflow, release, and handoff contracts stay aligned to canonical runtime names", () => {
  const eventEnvelope = readFileSync("docs_zh/contracts/event-envelope-contract.md", "utf8");
  assert.match(eventEnvelope, /\| `schemaVersion` \| `number` \|/);
  assert.match(eventEnvelope, /\| `schema_version` \| `schemaVersion` \|/);
  assert.match(eventEnvelope, /snake_case 只允许出现在 wire adapter/);

  const eventBus = readFileSync("docs_zh/contracts/event_bus_contract.md", "utf8");
  assert.match(eventBus, /platform\.harness_run\.created/);
  assert.match(eventBus, /platform\.node_run\.status_changed/);
  assert.match(eventBus, /platform\.release\.rollout_started/);
  assert.match(eventBus, /release\.\*.*必须在边界层显式映射到 `platform\.release\.\*`/s);
  assert.match(eventBus, /platform\.harness\.run\.\*` -> `platform\.harness_run\.\*/);

  const workflow = readFileSync("docs_zh/contracts/task_and_workflow_contract.md", "utf8");
  assert.match(workflow, /\| `domain_id` \| `string` \| 归属执行域 \|/);
  assert.match(workflow, /legacy_division_alias/);
  assert.match(workflow, /不得替代 `domain_id` 参与 runtime truth 关联/);

  const release = readFileSync("docs_zh/contracts/release_rollout_and_rollback_contract.md", "utf8");
  assert.match(release, /ReleaseDecisionView/);
  assert.match(release, /ReleaseChannel/);
  assert.match(release, /channelKind/);

  const handoff = readFileSync("docs_zh/contracts/agent_handoff_contract.md", "utf8");
  assert.match(handoff, /DelegationRequest/);
  assert.match(handoff, /DelegationReceipt/);
  assert.match(handoff, /ACPMessage/);
  assert.match(handoff, /AgentHandoff/);
  assert.match(handoff, /C1 child_subset_of_parent/);
  assert.match(handoff, /NodeAttemptReceipt/);
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

test("ADR remediation directly encodes the first architecture-aligned ADR fixes", () => {
  const adr021 = readFileSync("docs_zh/adr/021-inter-plane-communication-contract.md", "utf8");
  assert.match(adr021, /OperationalDirective/);
  assert.match(adr021, /DecisionDirective/);
  assert.match(adr021, /PlanGraphBundle/);
  assert.match(adr021, /NodeAttemptReceipt/);
  assert.doesNotMatch(adr021, /control_directives: ControlDirective\[\]/);

  const adr027 = readFileSync("docs_zh/adr/027-security-architecture.md", "utf8");
  assert.match(adr027, /worker/);
  assert.match(adr027, /plugin/);
  assert.match(adr027, /read_only/);
  assert.match(adr027, /workspace_write/);
  assert.match(adr027, /scoped_external_access/);
  assert.match(adr027, /restricted_exec/);
  assert.doesNotMatch(adr027, /\| L1 \| SANDBOX_NONE \|/);

  const adr025 = readFileSync("docs_zh/adr/025-stability-architecture-seven-layers.md", "utf8");
  assert.match(adr025, /supervised_auto/);
  assert.match(adr025, /no-write/);
  assert.match(adr025, /no-external-call/);
  assert.match(adr025, /no-rollout/);
  assert.match(adr025, /manual_only/);
  assert.match(adr025, /incident-mode/);

  const adr005 = readFileSync("docs_zh/adr/005-security-model.md", "utf8");
  assert.match(adr005, /supervised_auto/);
  assert.match(adr005, /read_only/);
  assert.match(adr005, /no-write/);
  assert.match(adr005, /no-external-call/);
  assert.match(adr005, /no-rollout/);
  assert.match(adr005, /manual_only/);
  assert.match(adr005, /incident-mode/);
  assert.match(adr005, /UI 投影/);

  const adr026 = readFileSync("docs_zh/adr/026-risk-control-architecture.md", "utf8");
  assert.match(adr026, /impact × 4 \+ irreversibility × 4/);
  assert.match(adr026, /\| impact \|/);
  assert.match(adr026, /\| irreversibility \|/);
  assert.match(adr026, /二维 canonical 模型/);
  assert.doesNotMatch(adr026, /\| stepTypeRisk \|/);

  const adr073 = readFileSync("docs_zh/adr/073-unified-resource-model.md", "utf8");
  assert.match(adr073, /harness_runs/);
  assert.match(adr073, /plan_graph_bundles/);
  assert.match(adr073, /node_runs/);
  assert.match(adr073, /node_attempt_receipts/);
  assert.match(adr073, /task_projection/);
  assert.match(adr073, /workflow_projection/);
  assert.match(adr073, /projection \/ interaction 资源/);

  const adr004 = readFileSync("docs_zh/adr/004-workflow-routing.md", "utf8");
  assert.match(adr004, /P1 接口面/);
  assert.match(adr004, /P2 控制面/);
  assert.match(adr004, /P3 编排面/);
  assert.match(adr004, /HarnessRuntime/);
  assert.match(adr004, /PlanGraphBundle/);
  assert.match(adr004, /NodeAttemptReceipt/);
  assert.doesNotMatch(adr004, /VP 运营负责接收消息/);

  const adr064 = readFileSync("docs_zh/adr/064-cost-attribution-and-optimization-engine.md", "utf8");
  assert.match(adr064, /harness_run_id/);
  assert.match(adr064, /node_run_id/);
  assert.match(adr064, /budget_settlement_ref/);
  assert.match(adr064, /platform\/tenant\/harness_run\/node_run/);
  assert.doesNotMatch(adr064, /workflow_id\?: string/);

  const adr052 = readFileSync("docs_zh/adr/052-multi-region-deployment-architecture.md", "utf8");
  assert.doesNotMatch(adr052, /\| sync \| 同步复制 \| 0 \|/);
  assert.match(adr052, /不承诺多主 truth 写入/);
  assert.match(adr052, /async replication/);
  assert.match(adr052, /单 writer/);

  const adr058 = readFileSync("docs_zh/adr/058-emergency-stop-and-global-circuit-breaker.md", "utf8");
  assert.match(adr058, /PlatformPanicDirective/);
  assert.match(adr058, /OperationalDirective/);
  assert.match(adr058, /kill_run/);
  assert.match(adr058, /pause_run/);

  const adr098 = readFileSync("docs_zh/adr/098-harness-hitl-runtime.md", "utf8");
  assert.match(adr098, /awaiting_hitl/);
  assert.doesNotMatch(adr098, /run 进入 `waiting_hitl`/);

  const adr066 = readFileSync("docs_zh/adr/071-plugin-spi-framework.md", "utf8");
  assert.match(adr066, /Promise<PlanGraphBundle>/);
  assert.match(adr066, /独立进程/);
  assert.match(adr066, /IPC/);
  assert.doesNotMatch(adr066, /独立 Worker 线程，通过 `plugin-runtime-host\.ts` 管理/);

  const adr040 = readFileSync("docs_zh/adr/040-goal-decomposition-engine.md", "utf8");
  assert.match(adr040, /GoalProjection 与 HarnessRun 生命周期关系/);
  assert.match(adr040, /HarnessRun.status/);
  assert.doesNotMatch(adr040, /### 9 种目标生命周期状态/);

  assert.doesNotMatch(adr073, /phase1-4 authoritative/);
  assert.match(adr073, /Ring 1 authoritative/);
  assert.match(adr073, /Ring 2 \/ Ring 3/);

  const adr094 = readFileSync("docs_zh/adr/094-harness-durable-execution.md", "utf8");
  assert.match(adr094, /Ring 2 durable-readiness/);
  assert.doesNotMatch(adr094, /\*\*Release\*\*: Durable 能力作为 phase 8b 验收门/);

  const adr099 = readFileSync("docs_zh/adr/099-harness-async-mode.md", "utf8");
  assert.match(adr099, /Ring 2 async-readiness/);
  assert.doesNotMatch(adr099, /\*\*Release\*\*: Async Harness 作为 phase 8c 验收项/);

  const adr092 = readFileSync("docs_zh/adr/092-harness-loop-controller.md", "utf8");
  assert.match(adr092, /NodeRun \/ NodeAttempt/);
  assert.doesNotMatch(adr092, /记录 step、decision、context snapshot 与 timeline/);

  const adr042 = readFileSync("docs_zh/adr/042-progressive-autonomy-model.md", "utf8");
  assert.match(adr042, /高危域默认不得进入 `full_auto`/);
  assert.match(adr042, /DomainRiskSpec/);
  assert.match(adr042, /DomainRiskProfile/);

  const adr093 = readFileSync("docs_zh/adr/093-harness-constraint-engine.md", "utf8");
  assert.match(adr093, /budget_envelope/);
  assert.match(adr093, /sandbox_requirement/);
  assert.match(adr093, /approval_requirement/);

  const adr037 = readFileSync("docs_zh/adr/037-domain-modeling-and-onboarding.md", "utf8");
  assert.match(adr037, /24 种垂直域类型/);
  assert.match(adr037, /quant_trading/);
  assert.match(adr037, /live_streaming/);
  assert.match(adr037, /supply_chain_logistics/);
  assert.match(adr037, /healthcare/);
  assert.match(adr037, /marketing_brand/);
  assert.doesNotMatch(adr037, /### DomainClass 7 种类型/);

  const adr075 = readFileSync("docs_zh/adr/075-controlled-rollout-release.md", "utf8");
  assert.match(adr075, /L1.*`evaluate_0`/);
  assert.match(adr075, /evaluation_enabled \(L1\)/);
  assert.match(adr075, /状态改为 `evaluation_enabled`/);
  assert.doesNotMatch(adr075, /\*\*L1\*\* \| `shadow`/);

  const releaseRolloutContract = readFileSync("docs_zh/contracts/release_rollout_and_rollback_contract.md", "utf8");
  assert.match(releaseRolloutContract, /L1 \| `evaluate_0`/);
  assert.match(releaseRolloutContract, /evaluation_enabled \(L1\)/);
  assert.match(releaseRolloutContract, /ReleaseRecord\(evaluate_0 → canary → partial → stable → released\)/);
  assert.doesNotMatch(releaseRolloutContract, /L1 \| `shadow`/);

  const adr016 = readFileSync("docs_zh/adr/016-oapeflir-loop-model.md", "utf8");
  assert.match(adr016, /HarnessRuntime.*唯一执行入口/);
  assert.match(adr016, /oapeflir\.view\.\*.*oapeflir\.rationale\.\*/);
  assert.match(adr016, /PlanRationale/);
  assert.match(adr016, /ExecutionSummaryView/);
  assert.doesNotMatch(adr016, /OapeflirLoopService.*核心编排器/);

  const adr029 = readFileSync("docs_zh/adr/029-oapeflir-controlled-cognition-kernel.md", "utf8");
  assert.match(adr029, /CognitiveFrameInput/);
  assert.match(adr029, /ExecutionSummaryView/);
  assert.match(adr029, /ReleaseDecisionView/);
  assert.match(adr029, /RuntimeStateMachine\.transition\(command\)/);

  const adr030 = readFileSync("docs_zh/adr/030-runtime-execution-plane.md", "utf8");
  const adr030Canonical = stripRemediationSection(adr030, "## v4.3 ADR Remediation");
  assert.match(adr030Canonical, /RuntimeStateMachine\.transition\(command\)/);
  assert.match(adr030Canonical, /by_node_kind/);
  assert.match(adr030Canonical, /llm_node_ms/);
  assert.match(adr030Canonical, /tool_node_ms/);
  assert.match(adr030Canonical, /hitl_node_ms/);
  assert.doesNotMatch(adr030Canonical, /per_step_ms/);

  const adr012 = readFileSync("docs_zh/adr/012-sqlite-phase-1-2-primary-store.md", "utf8");
  assert.match(adr012, /harness_runs/);
  assert.match(adr012, /node_runs/);
  assert.match(adr012, /node_attempt_receipts/);
  assert.match(adr012, /ReleaseDecisionView/);

  const adr091 = readFileSync("docs_zh/adr/091-harness-eight-pillar-model.md", "utf8");
  assert.match(adr091, /ReleaseChannel/);
  assert.match(adr091, /ReleaseDecisionView/);
  assert.match(adr091, /Ring 2 release-readiness/);

  const adr109 = readFileSync("docs_zh/adr/109-contract-freeze.md", "utf8");
  assert.match(adr109, /§1\.5 v4\.3 Contract Freeze Scope/);
  assert.match(adr109, /PlanGraphBundle/);
  assert.match(adr109, /NodeAttemptReceipt/);
  assert.match(adr109, /PlatformFactEvent/);
  assert.doesNotMatch(adr109, /硬件隔离层/);

  const adr110 = readFileSync("docs_zh/adr/110-runtime-state-machine-authority.md", "utf8");
  assert.match(adr110, /RuntimeStateMachine\.transition\(command\)/);
  assert.match(adr110, /TransitionCommand/);
  assert.match(adr110, /不得直接更新 truth 表/);
  assert.doesNotMatch(adr110, /ContextWindow/);
  assert.doesNotMatch(adr110, /MemoryTier/);

  const adr111 = readFileSync("docs_zh/adr/111-platform-fact-vs-oapeflir-view-events.md", "utf8");
  assert.match(adr111, /platform\.\*/);
  assert.match(adr111, /oapeflir\.view\.\*/);
  assert.match(adr111, /projectionOnly=true/);
  assert.doesNotMatch(adr111, /install\/enable\/disable\/uninstall/);

  const adr112 = readFileSync("docs_zh/adr/112-mvp-ring-implementation-boundary.md", "utf8");
  assert.match(adr112, /Ring 1 MVP/);
  assert.match(adr112, /Ring 2 Hardening/);
  assert.match(adr112, /Ring 3 Enterprise/);
  assert.match(adr112, /NodeAttemptReceipt/);
  assert.doesNotMatch(adr112, /eventual consistency/);
});
