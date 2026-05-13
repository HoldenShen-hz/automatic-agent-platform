# Platform Architecture Implementation Consistency Audit Round

> 2026-04-29 per-number re-audit results are available at:
> [platform-architecture-implementation-consistency-audit_round_reaudit.md](/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/reviews/platform-architecture-implementation-consistency-audit_round_reaudit.md)
>
> Note:
> - This file is preserved as an append-only historical snapshot and does not directly represent the current active defect list.
> - Per-number "current conclusion / root cause / evidence / this round action items" use `audit_round_reaudit.md` as the authoritative source.

### 7. AI Operations Layer Code vs Architecture (§15-§23)

| #     | Severity   | Code Location                                         | Issue                                                                                                |
| ----- | -------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| R2-1  | CRITICAL | model-gateway/unified-chat-provider.ts           | ChatCompletionRequest missing required fields traceId/tenantId/costTag, architecture §15.2 explicitly requires                     |
| R2-2  | CRITICAL | model-gateway/unified-chat-provider.ts stream()  | No AbortSignal / incremental budget deduction / partial response validation, architecture §15.4 requires streaming budget real-time control        |
| R2-3  | CRITICAL | prompt-engine/prompt-injection-guard.ts          | PromptInjectionDefenseChain is single-layer regex, architecture §20.3 requires multi-layer chain orchestrator(regex→classifier→LLM judge) |
| R2-4  | CRITICAL | prompt-engine/eval/                              | EvalDataset missing minimum sample count validation by risk level, architecture §21.5 requires critical≥200/high≥100/medium≥50             |
| R2-5  | CRITICAL | plugins/builtin-plugin-registry.ts               | Plugin system has no DataTaintPropagation tracking, architecture §23.4 requires cross-plugin data taint label propagation                         |
| R2-6  | HIGH     | model-gateway/cost-tracker/budget-guard.ts       | BudgetPolicy only supports task-level budget, missing architecture §18 required platform/pack/step three-level budget hierarchy                  |
| R2-7  | HIGH     | model-gateway/cost-tracker/chargeback-service.ts | ChargebackAllocation missing fx_rate/cost_source fields, architecture §18.7 requires multi-currency attribution                         |
| R2-8  | HIGH     | prompt-engine/registry/                          | Prompt lifecycle missing deprecated phase, architecture §20.6 defines draft→active→deprecated→archived four stages        |
| R2-9  | HIGH     | plugins/builtin-plugin-registry.ts               | No BundleRevocationSeverity mechanism, architecture §23.6 requires plugin revocation severity classification                                 |
| R2-10 | HIGH     | prompt-engine/eval/                              | LLM-as-Judge lacks independence enforcement by risk level (high-risk requires external independent review), architecture §21.7 explicitly requires                    |
| R2-11 | HIGH     | plugins/ PluginContext                           | No call_depth/delegation_depth tracking, architecture §23.2 requires preventing infinite plugin recursive delegation                            |
| R2-12 | HIGH     | prompt-engine/eval/                              | critical_case_pass==100% only adds finding without blocking release, architecture §21.5 requires it as a hard gate                         |

### 8. Remaining Contract vs Architecture

| #     | Severity | File                                                    | Issue                                                                                                                                      |
| ----- | ------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| R2-13 | HIGH   | runtime_state_machine_contract.md                       | §6 ExecutionStatus 8-state machine conflicts with architecture §25.8 NodeRun 14-state lifecycle, missing admitted/planning/ready/pausing/replanning/compensating                 |
| R2-14 | HIGH   | runtime_state_machine_contract.md                       | §3 WorkflowStatus 7-state missing architecture 13-state HarnessRun's created/admitted/planning/ready/pausing/replanning/compensating/aborted                    |
| R2-15 | HIGH   | cost_and_budget_contract.md                             | §4 CostEvent uses task_id as required but harness_run_id as optional, architecture §18 uses HarnessRun as budget subject                                                 |
| R2-16 | HIGH   | cost_and_budget_contract.md                             | §7.4 implicit cost attribution still uses deprecated execution_id, should be node_run_id/attempt_id                                                                       |
| R2-17 | MEDIUM | cost_and_budget_contract.md                             | §4 CostEvent missing budget_reservation_id, architecture §18.3 requires reserve-before-execute link                                                        |
| R2-18 | MEDIUM | task_and_workflow_contract.md                           | §6-§7 WorkflowStep/StepOutput uses step_id as primary key, should be node_run_id                                                                         |
| R2-19 | MEDIUM | policy_engine_contract.md                               | §3.1 PolicyDecisionRequest uses deprecated execution_id                                                                                            |
| R2-20 | MEDIUM | execution_plane_contract.md                             | §8 ExecutionTicket isolation_level uses deprecated standard/hardened/strict, should be read_only/workspace_write/scoped_external_access/restricted_exec |
| R2-21 | MEDIUM | model_gateway_routing_contract.md                       | ModelRouteRequest missing harness_run_id/node_run_id, cannot satisfy INV-BUDGET-001 budget gate                                                         |
| R2-22 | MEDIUM | observability_contract.md                               | §3 LogEvent missing harness_run_id/node_run_id required fields                                                                                      |
| R2-23 | LOW    | plugin_spi_contract.md vs tool_skill_plugin_contract.md | Lifecycle hook naming conflicts with each other (initialize/activate vs onLoad/onActivate)                                                                      |
| R2-24 | MEDIUM | runtime_state_machine_contract.md                       | Uses ExecutionStatus name instead of canonical NodeRun.status                                                                                      |

### 9. Architecture Document Internal Consistency

| #     | Severity | Location            | Issue                                                                       |
| ----- | ------ | --------------- | -------------------------------------------------------------------------- |
| R2-25 | HIGH   | §45.13 vs §25.8 | HarnessRun state count conflict: §45.13 defines 6 states, §25.8 defines 13 states                    |
| R2-26 | HIGH   | §45.13 vs §58.6 | finalDecision value conflict: §45.13 allows 4 values, §58.6 HarnessDecision lists 6 values    |
| R2-27 | HIGH   | §58.6           | Title says "six types of decisions" but table actually lists 10, self-contradictory                              |
| R2-28 | MEDIUM | §45.7 vs §58.6  | LoopController decision types: §45.7 lists 5 types, §58.6 requires 6 types (missing downgrade_mode) |
| R2-29 | MEDIUM | §45.9           | Generator WorkProduct still uses deprecated step_id field                                |
| R2-30 | MEDIUM | §59.2           | ExplanationRequest uses deprecated workflow_id/step_id                              |
| R2-31 | MEDIUM | §35             | contracts/ directory structure contains deprecated naming subdirectories (execution-plan/, workflow-run/)      |
| R2-32 | LOW    | §36.3           | Still uses Phase 1-9 as canonical success criteria, conflicts with Ring 1/2/3 system             |

### 11. Harness Runtime Deep Implementation Gaps (§45)

| #     | Severity   | File                                         | Issue                                                                                                                                    |
| ----- | -------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R3-1  | CRITICAL | orchestration/harness/guardrail-engine.ts    | Guardrails only have policy/risk/tool/evidence/budget 5 layers; §45.20 requires Input(injection defense)/Planning/Tool/Memory/Output five layers—Input and Memory guardrails completely missing |
| R3-2  | CRITICAL | orchestration/harness/hitl-runtime.ts        | Only supports open/resolve(approve/reject); §45.18 requires 5 types of HITL: Inspect/Patch/Override/Takeover/Resume with complete state machine                          |
| R3-3  | CRITICAL | orchestration/harness/index.ts               | HumanResponsibilityRecord(§45.27) not implemented—each HITL operation needs to produce actor/action/scope/rationale/beforeRef/afterRef/expiresAt/auditRef       |
| R3-4  | HIGH     | orchestration/harness/index.ts               | autonomyMode uses manual/supervised/auto/full_auto; §42.1 requires suggestion/supervised/semi_auto/full_auto                                  |
| R3-5  | HIGH     | orchestration/harness/index.ts               | HarnessRun missing §45.13 required 7 fields: tenantId/goal/mode/riskLevel/ownership/auditRefs/traceId                                              |
| R3-6  | HIGH     | orchestration/harness/index.ts               | HarnessStep missing §45.13 required 8 fields: nodeRunRefs/rationale/evidenceRefs/toolCalls/latency/cost/error/nextAction                           |
| R3-7  | HIGH     | orchestration/harness/index.ts               | HarnessDecision only has 6 values; §58.6 requires adding quarantine/revoke_approval/pause_for_external/require_revalidation                               |
| R3-8  | HIGH     | orchestration/harness/toolbelt-assembler.ts  | Only does allowed/blocked set intersection; §45.4 requires 6-step assembly: domain→constraint→risk→budget→security→reliability                                   |
| R3-9  | HIGH     | orchestration/harness/recovery-controller.ts | Only handles 3 failure types; §45.11 requires 5 types including llm_provider_unavailable/budget_exhausted/platform_panic                                              |
| R3-10 | HIGH     | orchestration/harness/memory-manager.ts      | Namespace run/domain/shared has no governance; §45.16 requires Working/Long-term/Shared with promotion/demotion strategy + anti-self-reinforcement                                      |
| R3-11 | HIGH     | orchestration/harness/index.ts               | assertInvariants only checks budget/state; §45.21 defines 10 invariants (INV-1~INV-10) none are enforced                                                    |
| R3-12 | HIGH     | orchestration/harness/index.ts               | PromptExecutionRecord(§45.24) not implemented—needs to freeze promptVersion/modelRoute/inputHash/outputHash/contextSnapshotRef/guardrailResult/usage     |
| R3-13 | HIGH     | orchestration/harness/index.ts               | DecisionInputBundle(§45.25) not implemented—needs to freeze evaluator/policy/budget/risk/node/sideEffect/hitl/guardrail state before decision                       |
| R3-14 | MEDIUM   | orchestration/harness/context-assembler.ts   | Directly copies source object; §45.5 requires token budget trimming + relevance scoring + freshness scoring + trust filtering                              |
| R3-15 | MEDIUM   | orchestration/harness/index.ts               | ContextAssemblyContract(§45.23) not implemented—needs per-role context isolation with taintPolicy/rankingPolicy/redactionPolicy                            |

### 12. Organization Governance + Scale Ecosystem Deep Gaps (§46-§57)

| #     | Severity   | File                                                          | Issue                                                                                                                                                                    |
| ----- | -------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-16 | CRITICAL | scale-ecosystem/multi-region/region-router/                   | RegionDescriptor missing provider/endpoints/dataResidencyPolicy; status uses active/degraded/disabled instead of architecture required active/standby/draining                                     |
| R3-17 | CRITICAL | scale-ecosystem/multi-region/failover-controller/             | No fencing epoch; §52.3 requires failover increment epoch, old leader can only rejoin as follower                                                                                    |
| R3-18 | CRITICAL | scale-ecosystem/integration/connector-registry/               | ConnectorManifest missing entire ConnectorCapabilityProfile(§57.1): actionRiskProfiles/permissionProbes/quotaProbes/credentialRotationPolicy                                    |
| R3-19 | HIGH     | scale-ecosystem/sla-engine/tier-resolver/                     | SlaTierSchema missing §54.1 required: availability/externalP95/internalP99/approvalLatencySlo/incidentResponseSlo/costMultiplier/supportLevel                                   |
| R3-20 | HIGH     | scale-ecosystem/sla-engine/sla-operations-service.ts          | No per-workflow-class SLA splitting (§54.3 requires deterministic/LLM-assisted/HITL-waiting 分别承诺）                                                                             |
| R3-21 | HIGH     | scale-ecosystem/marketplace/catalog/                          | Uses listingId instead of §55.2 entryId, missing packId/rating/installCount; certificationStatus enum mismatch                                                                          |
| R3-22 | HIGH     | org-governance/compliance-engine/framework-catalog.ts         | auditRequirements is string[] instead of §49.1 required AuditSpec[] (with frequency/evidenceType/retentionPeriod)                                                                |
| R3-23 | HIGH     | org-governance/compliance-engine/inheritance/                 | No PolicyStrictnessComparator(§49.2); incomparable policies silently fallback to Math.min instead of entering compliance approval                                                                              |
| R3-24 | HIGH     | org-governance/approval-routing/route-engine/                 | applySodPolicy doesn't prevent same-chain mutual approval(§47.1)—two people in same approval chain can approve each other's requests                                                                                                  |
| R3-25 | HIGH     | org-governance/knowledge-boundary/chinese-wall-access-saga.ts | Missing §50.3 two-phase commit (prepare lock→atomic commit→failure reconciliation); only does simple pass/fail classification                                                                       |
| R3-26 | HIGH     | scale-ecosystem/resource-manager/quota-enforcer/              | QuotaPolicy single dimension; §53.2 requires 7-dimension MultiResourceQuotaVector (worker_concurrency/tool_qps/model_tpm/model_rpm/budget_amount/approval_capacity/storage_io) all pass to admit |
| R3-27 | MEDIUM   | org-governance/delegated-governance/                          | GovernanceDelegationRevocationSaga missing cascade scope(§51.1): needs to cover pending approval/active session/secret lease/worker lease/scheduled trigger                                |
| R3-28 | MEDIUM   | org-governance/org-model/org-governance-saga.ts               | §46.3 requires fixed commit order (identity→approval→budget→domain→agent) with OrgGovernanceSagaReceipt; actually no order no receipt                                                          |
| R3-29 | MEDIUM   | org-governance/sso-scim/identity-sync-service.ts              | DLQ only records no retry; §48.2 requires retry/backoff + daily reconciliation + IdentityReconciliationReport                                                                                    |
| R3-30 | MEDIUM   | scale-ecosystem/multi-region/cross-region-routing-service.ts  | Cross-border transmission only boolean allowCrossBorder; §52.4 requires 5-step chain: JurisdictionClassifier→TransferImpactAssessor→MechanismSelector→DataMinimizer→OutputScanner                      |
| R3-31 | MEDIUM   | scale-ecosystem/billing/types.ts                              | RecordUsageInput single metricType; §53.2 requires multi-dimensional admission guard                                                                                                                  |
| R3-32 | MEDIUM   | org-governance/knowledge-boundary/sharing-gate/               | evaluateKnowledgeShare returns boolean; §50.3 requires CrossBoundaryTransform (desensitization/summarization/field filtering)                                                                          |

### 13. Operations Maturity + SDK Gaps (§51-§69)

| #     | Severity | File                                                        | Issue                                                                                                                                    |
| ----- | ------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R3-33 | HIGH   | ops-maturity/explainability/explanation-pipeline-service.ts | StageRationale missing §59.3: rationaleId/alternatives/confidence/decisionInputRef/versionLockRef/visibilityLabels/renderedExplanation     |
| R3-34 | HIGH   | ops-maturity/emergency/platform-panic-service.ts            | PlatformPanicDirective missing §60.1: severity(full/partial)/reconfirmationAfterSeconds/rollbackStrategy                                      |
| R3-35 | HIGH   | ops-maturity/agent-lifecycle/agent-registry/                | AgentLifecycleState missing removed state(§61.3 requires 9 states); transitions missing archived→removed and paused→canary                                      |
| R3-36 | HIGH   | ops-maturity/edge-runtime/edge-runtime-sync-service.ts      | EdgeRuntimeProfile missing §62.2: deviceId/offlineMaxDuration/keyLease/risk_level≤medium gate                                                 |
| R3-37 | HIGH   | ops-maturity/edge-runtime/sync-queue/                       | EdgeSyncEnvelope missing §62.3: device_id/sequence_no/prev_hash/side_effect_dependency_refs/signature/local_time_offset                       |
| R3-38 | HIGH   | sdk/client-sdk/api-client.ts                                | Not sending §22.2 required X-Platform-Version/X-SDK-Version/X-Contract-Version version handshake headers                                                      |
| R3-39 | HIGH   | sdk/cli/index.ts                                            | Missing §22.3 required pack create/test/validate/publish CLI commands                                                                              |
| R3-40 | MEDIUM | ops-maturity/edge-runtime/                                  | Conflict resolution includes accept_edge; §62.3 requires central wins + generate Incident for human review                                                                |
| R3-41 | MEDIUM | sdk/pack-sdk/pack-manifest.ts                               | BusinessPackManifest missing §22.2: sdk_semver/platform_min_version/platform_max_version/contract_test_generator                              |
| R3-42 | MEDIUM | ops-maturity/cost-optimizer/                                | CostAttributionRecord uses single amountUsd; §64.1 requires 7-dimension breakdown(llm/tool/compute/storage/egress/humanReview/total)                           |
| R3-43 | MEDIUM | ops-maturity/compliance-reporter/                           | Missing ControlCoverageReport + GapAnalyzer(§66.2); evidence-to-control mapping missing controlId/freshness/owner/exception                       |
| R3-44 | MEDIUM | ops-maturity/chaos/                                         | Missing PanicDrillReport(§60.4): ingress_block_time/execution_quiescence_time/plane_ack_success_rate etc                                      |
| R3-45 | MEDIUM | ops-maturity/multimodal/                                    | MultimodalInputPart missing §68.2 provenance(C2PA/watermark/hash/license)/artifactRef; SafetyFinding missing confidence/policyDecision/appealPath |
| R3-46 | MEDIUM | ops-maturity/drift-detection/cross-agent-analyzer/          | Doesn't produce CrossAgentDriftAlert(§63.4); missing alert severity + anti-gaming distinction                                                                |
| R3-47 | MEDIUM | ops-maturity/platform-ops-agent/                            | OpsAgentDefinition missing §69.1 ops_data_boundary declaration (platform metrics/logs/config only, prohibited business payload)                                            |
| R3-48 | LOW    | ops-maturity/capacity-planner/                              | failoverReservePercent hardcoded 15%; §67.2 requires dynamic N+1 per SLA tier                                                                       |
| R3-49 | LOW    | sdk/harness-sdk/                                            | Missing traceReplay/sideEffectReconciliation methods(§22)                                                                                       |
| R3-50 | LOW    | sdk/admin-sdk/                                              | Missing triggerPanic/resumePanic/manageAgentLifecycle/rotateSecrets(§22.1)                                                                   |

### 14. ADR and Architecture Conflicts (Newly Discovered)

| #     | Severity | ADR     | Issue                                                                                                                                                 |
| ----- | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-51 | HIGH   | ADR-060 | Defines Plan DTO + RuntimeExecuteBridge as P3→P4 contract; §5.3/INV-GRAPH-001 requires PlanGraphBundle as sole canonical P3→P4 handover                     |
| R3-52 | HIGH   | ADR-061 | Lifecycle 6 states(draft/testing/staging/production/deprecated/retired); §61.3 requires 9 states, missing canary/active/paused/archived/removed, extra production/retired |
| R3-53 | HIGH   | ADR-054 | Platinum commits 99.99%; §54.2 limits to 99.95% (99.99% only separately committed for dedicated deployment)                                                                             |
| R3-54 | HIGH   | ADR-042 | Autonomy levels supervised/assisted/partial_auto/high_auto/full_auto(5 levels); §42.1 only has suggestion/supervised/semi_auto/full_auto(4 levels)                          |
| R3-55 | HIGH   | ADR-083 | Another set of autonomy naming manual_only/suggest_only/supervised_execute/trusted_auto_execute——third incompatible set                                                      |
| R3-56 | MEDIUM | ADR-058 | GlobalCircuitBreaker.open_duration_ms implies TTL auto-release; §60.3 explicitly prohibits Panic TTL auto-release, recovery requires manual two-person confirmation                                       |
| R3-57 | MEDIUM | ADR-022 | Exposes /api/v1/workflow-runs as canonical API; §5.5 declares workflow_run as query projection only                                                            |
| R3-58 | MEDIUM | ADR-065 | Uses WorkflowDAGView/StepInspector all as deprecated concepts, no v4.3 remediation                                                                                   |
| R3-59 | MEDIUM | ADR-040 | Goal decomposition MAX_DEPTH=5 doesn't reference global call_depth hard cap=8 and anti-multiplication rule(§19.2)                                                                      |
| R3-60 | MEDIUM | ADR-062 | Edge sync lists last_write_wins as valid strategy; §25.11 truth data requires single-primary write, LWW violates invariant                                                                   |
| R3-61 | MEDIUM | ADR-060 | References §L.6/§H.2 sections——architecture v4.3 has no such section numbers, cross-refs invalid                                                                                                |
| R3-62 | LOW    | ADR-003 | Title "Six-Layer" filename "seven-layers" actual architecture and ADR-020 both are six-layer——naming completely chaotic                                                                              |
| R3-63 | LOW    | ADR-075 | ImprovementCandidate 12-state machine has no architecture support; §56.4 LearningCandidate only has quarantine/approved/rejected/released                                              |
| R3-64 | LOW    | ADR-019 | Claims source section §12 "Agent Handoff"; actually §12 is "Exception Event Handling Architecture"——section ref error                                                                        |

### 15. Remaining Contract Deep Gaps

| #     | Severity | File                                               | Issue                                                                                                                                                |
| ----- | ------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-65 | HIGH   | typed_event_bus_contract.md                        | OAPEFLIR event payload all uses task_id/workflow_id/execution_id; §5.5 requires harnessRunId/nodeRunId/planGraphId                                         |
| R3-66 | HIGH   | typed_event_bus_contract.md                        | PlanCreatedPayload uses step_count implying linear steps; §5 requires PlanGraph(graph structure)                                                                            |
| R3-67 | HIGH   | typed_event_bus_contract.md                        | ExecutionCompletedPayload defines execution_id/outcome/output_refs as execution result model; conflicts with §5 NodeAttemptReceipt(receiptId/nodeRunId/attemptId/status) |
| R3-68 | HIGH   | explainability_and_stage_rationale_contract.md     | StageRationale only 7 fields; §59.3 requires 11 fields(missing rationaleId/decisionInputRef/versionLockRef/visibilityLabels/confidence/alternatives)                 |
| R3-69 | HIGH   | workflow_debugger_contract.md                      | BreakpointDefinition uses workflow_id/step_selector; §5.5 should be harnessRunId/nodeRunId                                                                 |
| R3-70 | HIGH   | startup_consistency_and_recovery_drill_contract.md | Consistency matrix uses current_step_index/workflow_state; should be HarnessRun.status/NodeRun.status/PlanGraph                                                     |
| R3-71 | MEDIUM | budget-ledger-contract.md                          | BudgetReservation.resourceKind enum missing §18 required: storage/bandwidth/memory                                                                           |
| R3-72 | MEDIUM | naming_and_engineering_boundary_contract.md        | §2 lists WorkflowExecutor as canonical engineering name; §5 canonical entry is HarnessRuntime                                                                      |
| R3-73 | MEDIUM | admin_console_and_human_takeover_contract.md       | Takeover operation uses step language (modify next step/skip step/retry step); §5.5 operation granularity is NodeRun                                                                      |
| R3-74 | MEDIUM | nl_entry_and_goal_decomposition_contract.md        | IntentParseResult contains suggested_workflow_id; §5 all execution is HarnessRun, NL should suggest domain/pack/recipe                                                  |
| R3-75 | MEDIUM | typed_event_bus_contract.md                        | OAPEFLIR payload missing derivedFromEventId; event-envelope-contract §4 requires declaring derivation source                                                       |
| R3-76 | MEDIUM | governance_control_plane_contract.md               | §15A release_transition_gate values off/suggest/shadow don't map to §61.3 lifecycle 9 states                                                                     |
| R3-77 | MEDIUM | explainability_and_stage_rationale_contract.md     | ExplanationDepth uses brief/standard/audit; §59.4 requires L1 Summary/L2 Reasoning/L3 Forensic                                                            |
| R3-78 | LOW    | typed_event_bus_contract.md                        | ReplanTriggeredPayload uses old_version/new_version not referencing GraphPatch(baseGraphVersion→newGraphVersion)                                               |
| R3-79 | LOW    | capacity_planning_contract.md                      | Missing CapacityAlert output object(§67.2 requires output when forecast exceeds threshold)                                                                                         |
| R3-80 | LOW    | explainability_and_stage_rationale_contract.md     | No remediation section; doesn't reference §59 "explanation immutability incorporated into Evidence Plane" + "explanation must be permission-aware"         |

### 17. Platform Contracts Layer Fundamental Issues

| #     | Severity   | File                                           | Issue                                                                                                                                                   |
| ----- | -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R4-1  | CRITICAL | platform/contracts/control-directive/          | ControlDirective still used as first-level active consumption; §5.2 explicitly deprecated, canonical replacement OperationalDirective/DecisionDirective doesn't exist in codebase                         |
| R4-2  | CRITICAL | platform/contracts/execution-plan/             | ExecutionPlan uses linear steps[] as active contract; §5.3 prohibits linear steps, PlanGraphBundle(graph nodes/edges) is sole P3→P4 handover                              |
| R4-3  | CRITICAL | platform/contracts/execution-receipt/          | ExecutionReceipt uses stepId as primary key still active contract; §5.5 canonical is NodeAttemptReceipt(nodeRunId+attemptId)                                          |
| R4-4  | CRITICAL | platform/contracts/types/platform-contracts.ts | Same file contains second set of ExecutionPlan + ExecutionReceipt + ControlDirective definitions——two sets of deprecated contracts coexist in parallel                                                    |
| R4-5  | CRITICAL | platform/five-plane-*/                        | Architecture §4 requires five-plane directory (P1-P5), **actually no five-plane-* directory exists**——plane separation not structurally enforceable                                                                 |
| R4-6  | HIGH     | platform/contracts/executable-contracts/       | NodeAttemptReceipt missing harnessRunId/planGraphId/graphVersion/duration/error_detail(§5.3 required)                                                           |
| R4-7  | HIGH     | platform/contracts/request-envelope/           | RequestEnvelope missing confirmedTaskSpecId/principal(typed)/idempotencyKey/priority(§5.3 intake pipeline)                                                  |
| R4-8  | HIGH     | platform/contracts/state-command/              | StateCommand missing leaseId/fencingToken/event/principal——cannot satisfy INV-STATE-001                                                                           |
| R4-9  | HIGH     | platform/contracts/                            | Missing EventAppendCommand/AuditAppendCommand/ArtifactWriteCommand three §5.3 inter-plane contract modules                                                           |
| R4-10 | HIGH     | platform/contracts/types/platform-contracts.ts | SideEffectRecord only 4 states(proposed/committed/rolled_back/failed); executable-contracts defines 16 states——two sets coexist in conflict                                           |
| R4-11 | MEDIUM   | platform/contracts/executable-contracts/       | LEGACY_CONTRACT_NAMES list has no enforcement mechanism——no deprecation warning/re-export guard/CI lint to prevent new code importing deprecated modules                                            |
| R4-12 | MEDIUM   | platform/contracts/index.ts                    | Barrel export prefers deprecated type(requestEnvelopeContract) over executable-contracts——incentivizes consuming deprecated interface                                                            |
| R4-13 | MEDIUM   | platform/contracts/executable-contracts/       | EventEnvelope missing required runId(§28.1); replayBehavior is optional(§28.1 requires explicitly declared); eventVersion is string instead of §28.1 numeric schemaVersion |
| R4-14 | MEDIUM   | platform/control-plane/                        | P2 module has no OperationalDirective/DecisionDirective emission or consumption——P2→P3/P4 governance gate structurally missing                                                           |

### 18. Execution + State-Evidence Plane Gaps (§13-§14)

| #     | Severity | File                                                   | Issue                                                                                                                          |
| ----- | ------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| R4-15 | HIGH   | execution/state-transition/transition-service.ts       | Parallel legacy TransitionService directly operates task/workflow/session/execution state, completely bypassing RuntimeStateMachine——INV-STATE-001 bypass |
| R4-16 | HIGH   | execution/runtime-state-machine.ts                     | RuntimeTransitionCommand missing commandId(UUID)/entityType/entityId/principal(§5.3 required)                                          |
| R4-17 | HIGH   | execution/recovery/                                    | No RecoveryCadence/RecoveryReport type; §14.7 requires each Recovery Worker to declare check interval+output report                                  |
| R4-18 | HIGH   | state-evidence/checkpoints/workflow-step-checkpoint.ts | Checkpoint uses stepId/workflowId/executionId instead of harnessRunId/nodeRunId/planGraphId                                           |
| R4-19 | MEDIUM | execution/state-transition/state-transition-machine.ts | Allows no-op transition(current==next silently returns); RuntimeStateMachine explicitly rejects——two machine behaviors矛盾                                 |
| R4-20 | MEDIUM | execution/recovery/replay-boundary-guard.ts            | Only implements trace_replay/reexecution_replay two modes; §28.5 defines three types including projection_replay                                           |
| R4-21 | MEDIUM | execution/run-termination-cleanup.ts                   | Always returns complete:true without actual cleanup; §14.10 requires emitting cleanup_completed/cleanup_failed events                                      |
| R4-22 | MEDIUM | execution/run-termination-cleanup.ts                   | CleanupResourceKind missing callback type(§14.10 cleanup sequence includes "cancel pending callbacks")                                             |
| R4-23 | MEDIUM | execution/budget-allocator.ts                          | reserve() doesn't go through RuntimeStateMachine.transition(); §25.9 budget changes require same CAS+event transaction path                                        |
| R4-24 | MEDIUM | execution/queue/bounded-dispatch-event.ts              | BoundedDispatchEvent missing nodeRunId/tenantId/traceId/ordering_policy_version/queue_class(§14.9)                                 |

### 19. Core Invariants Not Enforced (Most Severe System Issue)

| #     | Severity   | Invariant                                               | Bypass Evidence                                                                                                                                                                              |
| ----- | -------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4-25 | CRITICAL | INV-BUDGET-001 reserve-before-execute                | single-task-happy-path and multi-step-agent-round-loop all LLM/Tool calls have no BudgetReservation; BudgetAllocator.reserve() exists but never called in execution path; only AdmissionController does coarse-grained estimation |
| R4-26 | CRITICAL | INV-GRAPH-001 PlanGraphBundle as sole P3→P4 contract  | Actual execution path(single-task-happy-path/multi-step-orchestration) creates TaskRecord+WorkflowState+linear steps and executes directly, no PlanGraphBundle; RuntimeEntryGuard exists but never called                  |
| R4-27 | CRITICAL | INV-RUN-001 HarnessRuntime as sole execution entry              | Both main execution paths don't create HarnessRun; use legacy TaskRecord/ExecutionRecord directly; RuntimeEntryGuard not connected to any dispatch path                                                          |
| R4-28 | CRITICAL | INV-STATE-001 Truth mutation must append event in same transaction | single-task-happy-path inserts task/workflow/execution without appending PlatformFactEvent; uses legacy TransitionService instead of RuntimeStateMachine                                                 |
| R4-29 | CRITICAL | INV-REPLAY-001 Replay must not produce real side effects             | ReplayWorker delegates to replayService but doesn't call ReplayBoundaryGuard; no ReplaySandboxPolicy implementation                                                                                             |
| R4-30 | HIGH     | INV-FENCING fencing token on state writes            | RuntimeStateMachine.assertLeaseAndFencing() only checks NodeRun; HarnessRun/SideEffectRecord/BudgetLedger skip fencing; legacy path completely bypassed                                                |
| R4-31 | HIGH     | INV-SANDBOX no sandbox no execute                        | executeToolCall()/executeAgentRoundLoop() have no sandbox policy check; todo_write hardcoded empty policy {allow:[],deny:[]} never enforced                                                             |
| R4-32 | HIGH     | INV-APPROVAL risk-proportional approval              | single-task-happy-path hardcoded requiresApproval:0; multi-step-supervisor same; PolicyEngine not connected to execution path                                                                               |
| R4-33 | HIGH     | INV-SIDEEFFECT-001 ambiguous→reconciliation          | No execution path creates SideEffectRecord; web_fetch/web_search produce real side effects but not recorded/tracked/reconciled                                                                                                |
| R4-34 | HIGH     | INV-POLICY-001 deny-by-default                       | executeToolCall uses hardcoded switch-case dispatch, no PolicyEngine/CapabilityGate pre-check                                                                                                |
| R4-35 | HIGH     | All decisions→immutable evidence                     | LLM calls and tool execution don't produce EvidenceRecord/DecisionInputBundle/HarnessDecision                                                                                                         |
| R4-36 | MEDIUM   | INV-SINGLE-LEADER                                    | Main execution path directly SQLite store.* writes without leader check; HACoordinator not connected                                                                                                              |

### 20. Security/Observability/Error Handling Cross-Cutting Concerns

| #     | Severity   | File/Domain                                           | Issue                                                                               |
| ----- | -------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| R4-37 | CRITICAL | control-plane/iam/network-egress-policy.ts          | Default mode="audit_only"——egress violations only log without blocking(§11.5 requires deny as formal security event)    |
| R4-38 | CRITICAL | interaction/dashboard/dashboard-websocket-server.ts | registerClient() has no auth/no tenantId/no principal(§11.1 requires all operations associated with principal) |
| R4-39 | HIGH     | Entire src/                                             | DataTaintPropagation(§11.6) zero implementation——taint_label never appears in code                   |
| R4-40 | HIGH     | model-gateway/unified-chat-provider.ts              | LLM calls lack principal/tenantId/audit/PolicyOutcome(§11.1-11.2)                      |
| R4-41 | HIGH     | model-gateway/circuit-breaker.ts                    | State changes only write logs without sending event bus events(§9.4)                                          |
| R4-42 | HIGH     | shared/observability/runtime-metrics-registry.ts    | 10+ canonical harness.* metrics only 1 recorded(§12.4)                                   |
| R4-43 | HIGH     | shared/observability/structured-logger.ts           | Missing crosscutting_fabric field(§12.4 requires reliability/security/governance classification)       |
| R4-44 | HIGH     | execution/plugin-executor/adapter-executor.ts       | Retry uses fixed delay no exponential backoff no jitter no idempotency check(§9.3)                  |
| R4-45 | MEDIUM   | interaction/ux/conversation-history-service.ts      | Tenant isolation relies on client-side filter instead of query-level isolation(§9.1)                        |
| R4-46 | MEDIUM   | model-gateway/unified-chat-provider.ts              | createChatCompletion doesn't propagate traceId/spanId(§12.7 broken chain)                             |
| R4-47 | MEDIUM   | model-gateway/degradation-controller.ts             | Degradation switch doesn't send OperationalDirective doesn't interact with mode synthesis chain(§9.5)                       |
| R4-48 | MEDIUM   | execution/plugin-executor/adapter-executor.ts       | Retry exhausted silently returns error no incident/DLQ/error_code(§12.1)                         |
| R4-49 | LOW      | model-gateway/circuit-breaker.ts                    | Failure rate formula has no success count denominator——threshold comparison math error                                    |

### 21. Test/Configuration/Bootstrap Alignment

| #     | Severity   | File/Domain                          | Issue                                                                                                                                                                                                                               |
| ----- | -------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4-50 | RESOLVED | tests/invariants/                  | §2.4 requires 9 invariant test files——**already exists** (truth-event-atomicity/harness-run-authority/plan-graph-only-dispatch/budget-reserve-before-execute/no-side-effect-in-replay/side-effect-ambiguous-reconciles/deny-by-default 等)                                                                                                                    |
| R4-51 | RESOLVED | tests/invariants/budget-reserve-before-execute.test.ts | INV-BUDGET-001 test coverage exists                                                                                                                                                                                                          |
| R4-52 | RESOLVED | tests/invariants/no-side-effect-in-replay.test.ts      | INV-REPLAY-001 test coverage exists                                                                                                                                                                                                          |
| R4-53 | RESOLVED | tests/invariants/side-effect-ambiguous-reconciles.test.ts | INV-SIDEEFFECT-001 test coverage exists                                                                                                                                                                                                      |
| R4-54 | RESOLVED | tests/invariants/deny-by-default.test.ts               | INV-POLICY-001 test coverage exists                                                                                                                                                                                                          |
| R4-55 | RESOLVED | config/runtime/default.json        | Removed deprecated defaultStepTimeoutMs; canonical RuntimeStateMachine/five-plane configuration complete (87 fields)                                                                                                                                              |
| R4-56 | RESOLVED | config/risk/default.json           | Removed deprecated stepTypeRisk/stepTypeRiskValues; §28 Event Registry/DLQ model aligned                                                                                      |
| R4-57 | HIGH     | config/domains/*.json             | Domain workflow configuration uses linear steps[] + stepName——§13/§45 requires PlanGraph                                                                                                                                                                  |
| R4-58 | HIGH     | config/domains/*.json             | No DomainRiskSpec(advisory_only/human_accountable/deterministic_hot_path_only)——quant-trading high-risk domain has no risk declaration                                                                                                                     |
| R4-59 | HIGH     | platform-architecture-bootstrap.ts | Registered as flat directory no enforced startup order(§7 requires P5→X1→P2→P3→P4→P1)                                                                                                                                                                              |
| R4-60 | MEDIUM   | platform-architecture-types.ts     | No canonical runtime object types(HarnessRun/NodeRun/PlanGraphBundle/BudgetReservation)——only infrastructure types                                                                                                                                |
| R4-61 | MEDIUM   | domains-runtime-catalog.ts         | Still uses phase9a-9f old phasing(§33 explicitly "historical mapping only", canonical is Ring 1/2/3)                                                                                                                                                              |
| R4-62 | MEDIUM   | index.ts                           | main() no architecture startup invariant check(ArchitectureInvariantRegistry/NonOverridableInvariantRegistry §2.4)                                                                                                                                    |
| R4-63 | MEDIUM   | index.ts                           | runPlatformRootDemo uses snapshot.workflow.currentStepIndex/stepOutputs deprecated objects as main output                                                                                                                                           |
| R4-64 | MEDIUM   | tests/                             | No contract-naming-consistency.test.ts(§6.4 requires CI lint scan for deprecated terms)     |

### 23. OAPEFLIR Orchestration Loop Implementation Gaps (§13/§45/§58)

| #     | Severity   | File                                            | Issue                                                                                                                    |
| ----- | -------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| R5-1  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | Plan stage produces linear Plan{steps[]}——not PlanGraphBundle(§13.7 "Plan must be Graph")                                         |
| R5-2  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | run() is one-way pipeline(O→A→P→E→F→L→I→R→return); replanDecision computed but no re-entry——not a loop(§45.7 requires reentrant Plan/Execute)            |
| R5-3  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | Not integrated with StageTransitionFSM——FSM is dead code; stage transitions have no validation                                                                 |
| R5-4  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | Not integrated with HarnessLoopController——no max-iteration/max-replan/max-duration/max-cost guard                                    |
| R5-5  | HIGH     | orchestration/harness/index.ts decide()         | No downgrade_mode decision branch(§58.6 requires 6 basic decisions)                                                                      |
| R5-6  | HIGH     | orchestration/oapeflir/assessment-service.ts    | Assess doesn't consume/produce ConstraintPack/EffectivePolicySnapshot/RiskAssessment(§13.1.1)                                       |
| R5-7  | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Evaluator produces ExecutionOutcomeEvaluation instead of §45.10 EvaluationReport(passed/score/issues[]/recommendation/confidence) |
| R5-8  | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Release stage calls PolicyRolloutService.start() no EvaluationGate/approval/canary/rollback(§13.14)                          |
| R5-9  | HIGH     | orchestration/planner/plan-builder.ts           | No Graph Normalization/Validation/Risk Propagation/Worst-Path Analysis(§13.9-13.12)                                     |
| R5-10 | HIGH     | orchestration/oapeflir/stage-transition-fsm.ts  | FSM prohibits all backward transitions——replan structurally impossible(§45.7/§13.4 requires feedback→plan)                                             |
| R5-11 | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Observer only merges TaskSituation+SystemSituation; missing event stream/goal decomposition/memory/previous run context(§45.8)                             |
| R5-12 | MEDIUM   | orchestration/oapeflir/oapeflir-loop-service.ts | Replan no GraphPatch output(§13.13 requires baseGraphVersion+operations[]+compatibilityReport)                                |
| R5-13 | MEDIUM   | orchestration/oapeflir/oapeflir-loop-service.ts | Execute uses flat ExecuteBridge no subgraph/child-run support(§13.7 requires subtask/delegation explicit modeling)                                 |
| R5-14 | LOW      | orchestration/oapeflir/oapeflir-loop-service.ts | OapeflirLoopResult missing HarnessDecision field——OAPEFLIR layer disconnected from Harness decision model                                          |

### 24. NL Entry + Goal Decomposition + Proactive Agent Gaps (§8/§19/§40-§42)

| #     | Severity   | File                                           | Issue                                                                                           |
| ----- | -------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| R5-15 | CRITICAL | interaction/nl-gateway/index.ts                | pending_user_confirmation state still emits RequestEnvelope(§39.2 requires only confirmed TaskSpec can produce) |
| R5-16 | CRITICAL | interaction/nl-gateway/index.ts                | No independent classify_risk pipeline stage(§39.2 requires as independent admission gate)                                      |
| R5-17 | HIGH     | interaction/nl-gateway/index.ts                | DetectedIntent.intentType missing "why"(§39 new explanation query type)                                       |
| R5-18 | HIGH     | interaction/goal-decomposer/index.ts           | No delegation chain depth limit(§19.2 max=3) and global call_depth hard cap(=8); no anti-multiplication guard                          |
| R5-19 | HIGH     | interaction/goal-decomposer/index.ts           | No proportional budget allocation to subtasks(§40.2); no risk propagation to subtasks                                            |
| R5-20 | HIGH     | interaction/goal-decomposer/index.ts           | GoalLifecycleState missing partially_completed(§40.5)                                               |
| R5-21 | HIGH     | interaction/autonomy/index.ts                  | TrustScore range 0-100; §42.1 requires 0-1000                                                       |
| R5-22 | HIGH     | interaction/autonomy/index.ts                  | Promotion rules no time-window incident-free check(§42.2 requires 30d/60d/90d zero events)                           |
| R5-23 | HIGH     | interaction/autonomy/index.ts                  | No cost over budget 200% demotion rule(§42.2)                                                              |
| R5-24 | HIGH     | interaction/proactive-agent/index.ts           | medium risk proactive actions can auto_execute(§41.1 prohibits medium+ direct execute)                                |
| R5-25 | HIGH     | interaction/proactive-agent/trigger-engine/    | resolveTriggerActionMode() also returns auto_execute for medium/high(§41.1 violation)                    |
| R5-26 | MEDIUM   | interaction/autonomy/index.ts                  | TrustDecayWorker no 180d no execution→suggestion demotion(§42.3); no 30d frozen promotion                        |
| R5-27 | MEDIUM   | interaction/autonomy/index.ts                  | Autonomy level not linked with proactive triggers(§42.5 requires semi_auto and above to allow auto-execute)                            |
| R5-28 | MEDIUM   | interaction/goal-decomposer/index.ts           | No capability verification(§40.2 requires verifying DomainCapability exposed by target domain); no permission narrowing propagation                      |
| R5-29 | MEDIUM   | interaction/proactive-agent/index.ts           | batch_window configuration exists but evaluate() no event batch aggregation(§41.4)                                       |
| R5-30 | MEDIUM   | interaction/nl-gateway/index.ts                | ClarificationState no rounds/maxRounds tracking——may cause infinite clarification loop(§39.5)                           |
| R5-31 | LOW      | interaction/ux/conversation-history-service.ts | restricted/regulated dialogue data writes to long-term memory(§39.6 requires only session memory)              |
| R5-32 | LOW      | interaction/nl-gateway/index.ts                | UserConfirmationReceipt missing scope/time/riskPreviewVersion(§39.3 audit matching requirements)                   |

### 25. Event Stream + API Surface Gaps (§6/§28)

| #     | Severity   | File                                             | Issue                                                                                                                                                          |
| ----- | -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R5-33 | CRITICAL | platform/contracts/types/domain/session-types.ts | EventRecord missing §28.1 required fields: schemaVersion/aggregateId/runId/sequence/replayBehavior/principal/evidenceRefs                                                 |
| R5-34 | CRITICAL | platform/state-evidence/events/event-registry.ts | Two non-interoperating event registries coexist: legacy task:_ colon namespace vs canonical platform._ dot namespace; platform.* has no Tier-1 routing/Zod validation/typed payload                |
| R5-35 | CRITICAL | platform/interface/api/http-server/              | No /api/v1/harness-runs and sub-resource routes(§6 canonical API); only has legacy /v1/tasks                                                                                 |
| R5-36 | HIGH     | platform/interface/api/http-server/              | Missing /api/v1/replay-sessions(§28.5 MVP); admin routes missing all write methods(PUT config/POST panic-directives/POST resume-directives)                                     |
| R5-37 | HIGH     | state-evidence/events/durable-event-bus.ts       | publish() doesn't persist aggregateId/runId/sequence/schemaVersion——replay ordering impossible(§28.5)                                                                    |
| R5-38 | HIGH     | state-evidence/events/event-types.ts             | Tier-1 list includes non-architecture events(delegation:_/prompt:_/tenant:_) but missing architecture core facts(platform.harness_run._/platform.node*run.*/platform.side*effect.*/platform.budget.*) |
| R5-39 | MEDIUM   | platform/interface/api/http-server/              | WebSocket bound to /ws instead of §6 required /ws/v1/stream; task-routes uses /v1/tasks without /api/ prefix                                                                       |
| R5-40 | MEDIUM   | state-evidence/events/event-registry.ts          | replayBehavior uses simulate_projection instead of §28.1 canonical simulate                                                                                           |
| R5-41 | MEDIUM   | state-evidence/events/typed-event-bus.ts         | TypedEventPayloadMap doesn't include platform._/oapeflir._ events——compile-time type check silently excludes all canonical runtime events                                                         |

### 26. Delegation + Version Lock + Memory + Truth Deep Gaps (§19/§24/§25/§29)

| #     | Severity | File                                                           | Issue                                                                                                        |
| ----- | ------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R5-42 | HIGH   | orchestration/agent-delegation/delegation-types.ts             | DelegationResult missing §19.1 required: summary/artifact_refs/trust_level/taint_labels/evidence_refs/policy_outcome |
| R5-43 | HIGH   | orchestration/agent-delegation/collaboration-protocol/types.ts | ACP message missing §19.1 required: delegationId/childRunId/capabilityIntersection/budgetCap/dataBoundary/deadline       |
| R5-44 | HIGH   | state-evidence/truth/runtime-truth-repository.ts               | transition() has no lease/fencing validation for HarnessRun(§25.3)                                                     |
| R5-45 | HIGH   | orchestration/agent-delegation/delegation-types.ts             | DelegationResult missing taint_labels/data_class——cross-delegation data classification chain broken                                           |
| R5-46 | MEDIUM | orchestration/agent-delegation/call-depth-budget.ts            | Uses Math.max() not summation——global depth limit=8 actually ineffective(§19.2)                                                        |
| R5-47 | MEDIUM | orchestration/agent-delegation/delegation-manager.service.ts   | delegate() doesn't call CallDepthBudget.evaluate()——direct delegation bypasses depth check                                            |
| R5-48 | MEDIUM | state-evidence/truth/runtime-truth-repository.ts               | transaction() memory clone-and-rollback without database transaction——truth+event atomicity has no crash safety(§25.6)                     |
| R5-49 | MEDIUM | state-evidence/knowledge/knowledge-query-service.ts            | Query has no tenant/domain boundary validation(§45.16+§50)                                                                   |
| R5-50 | MEDIUM | state-evidence/memory/memory-decay-service.ts                  | working/procedural apply exponential decay——§29.2 prohibits silently dropping working, prohibits dropping procedural                            |
| R5-51 | MEDIUM | orchestration/agent-delegation/delegation-types.ts             | Only pipeline/negotiation modes; missing §19.1 broadcast+AggregationPolicy                                          |
| R5-52 | MEDIUM | orchestration/agent-delegation/delegation-types.ts             | DelegationStatus missing discovery/bid/awarded(§19.1 bidding)                                                       |
| R5-53 | MEDIUM | interface/api/middleware/sdk-version-handshake.ts              | Missing platform_min_version compatibility check(§24)                                                                       |
| R5-54 | LOW    | control-plane/config-center/config-versioning-service.ts       | Emits config.version.created not §24.2 config.changed hot-reload event                                                |

### 27. ADR and Architecture Conflicts (Second Batch)

| #     | Severity   | ADR                 | Issue                                                                                                                  |
| ----- | -------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| R5-55 | CRITICAL | ADR-026             | Risk factor model(8 factors/weights/18-point system) completely incompatible with §10.2 canonical(impact×4/irreversibility×4/…)                             |
| R5-56 | CRITICAL | ADR-001             | Maps OAPEFLIR as active orchestration loop(OapeflirLoopService orchestrates 8 stages); §13/§45 explicitly states OAPEFLIR is only StageRationale/Audit View |
| R5-57 | HIGH     | ADR-039             | Defines cancel_task intent; §6.3 explicitly removes——callers must use abort/pause/panic kill                                           |
| R5-58 | HIGH     | ADR-001             | Three-layer CEO/VP architecture as Accepted decision no remediation; v4.3 §4 uses five-plane+X1 instead                                          |
| R5-59 | HIGH     | ADR-002             | "Division" YAML division model no remediation; v4.3 uses DomainDescriptor+BusinessPack+DomainRiskSpec                       |
| R5-60 | HIGH     | ADR-004             | Workflow data passing still uses WorkflowState/StepOutput(§5.5 deprecated) no remediation                                               |
| R5-61 | HIGH     | ADR-034             | ADR freeze rule "cannot directly modify frozen content"——v4.3 remediation process directly modified 30+ ADRs violating this rule                           |
| R5-62 | HIGH     | ADR-041             | TriggerAction.create_task directly creates task bypassing §5.3 intake pipeline(TaskDraft→ConfirmedTaskSpec→RequestEnvelope)          |
| R5-63 | MEDIUM   | ADR-006/008/005/002 | Source section references all point to old section numbers(§7/§8/§2)——v4.3 corresponding sections completely replaced; cross-refs batch invalid                                         |
| R5-64 | MEDIUM   | ADR-028             | Trace span uses "service→operation→step"——step is deprecated term(§5.5)                                                         |
| R5-65 | MEDIUM   | ADR-066             | References non-existent §B/§G appendix; v4.3 has no such appendices                                                                            |
| R5-66 | MEDIUM   | ADR-046             | Uses CEO/VP as governance hierarchy——v4.3 §46-§51 uses OrgNode hierarchy                                                                  |
| R5-67 | MEDIUM   | ADR-047             | auto_action timeout auto-execute has no risk level guard(§10.3 high/critical default deny)     |

### 29. Intake Admission + Dispatcher Scheduling Gaps (§5.3/§14/§25.4)

| #     | Severity | File                                                      | Issue                                                                                                     |
| ----- | ------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| R6-1  | HIGH   | orchestration/harness/runtime/intake-admission-service.ts | §5.3 ClarificationSession stage completely missing; admit() directly RawTaskInput→TaskDraft→ConfirmedTaskSpec no clarification loop |
| R6-2  | HIGH   | orchestration/harness/runtime/intake-admission-service.ts | high/critical tasks don't enforce UserConfirmationReceipt(§39.6)——confirmationReceipt optional and still passes at critical level    |
| R6-3  | HIGH   | execution/dispatcher/admission-controller.ts              | Missing §14.2 scheduling factors: no risk-class isolation routing/no tenant-quota/no sandbox matching/no capability-class gate       |
| R6-4  | HIGH   | execution/dispatcher/                                     | No deterministic graph scheduler(§14.9)——should schedule by priority/risk_class/critical_path_rank/created_order/scheduler_seed   |
| R6-5  | HIGH   | execution/dispatcher/                                     | Missing §14.9 emergency lane(critical NodeRun independent channel)                                                       |
| R6-6  | HIGH   | execution/dispatcher/                                     | Missing dispatch_backpressure_rejected event+DLQ integration(§14.9)                                                   |
| R6-7  | HIGH   | execution/dispatcher/                                     | §14.9 scheduler events missing ready_set/selected_node_ids/ordering_policy_version/worker_pool_snapshot_ref   |
| R6-8  | MEDIUM | execution/dispatcher/admission-controller.ts              | priority uses "urgent" instead of §5.3 canonical "critical"                                                      |
| R6-9  | MEDIUM | execution/dispatcher/                                     | No budget reservation existence verification before dispatch(§14.2 no active reservation cannot schedule)                          |
| R6-10 | MEDIUM | execution/worker-pool/worker-registry-service.ts          | No heartbeat staleness detection(§14: gap>30s triggers worker_heartbeat_missing event+lease_reclaim)               |
| R6-11 | MEDIUM | orchestration/routing/intake-router.ts                    | Only keyword matching no LLM intent extraction/confidence threshold(0.80)/AmbiguityResolver(§39.3)                 |
| R6-12 | MEDIUM | orchestration/harness/runtime/intake-admission-service.ts | policyGuard.allowed hardcoded true——§25.4/§45.2 admission policy/capability/risk check is a no-op                              |

### 30. Type System + API Serialization + Shared Layer Issues

| #     | Severity   | File                                                       | Issue                                                                                                             |
| ----- | -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| R6-13 | CRITICAL | harness/index.ts vs contracts/executable-contracts/        | Two conflicting HarnessRun interfaces(runId+steps[] vs harnessRunId+confirmedTaskSpecId+currentSeq)——no unified re-export/adapter |
| R6-14 | CRITICAL | contracts/control-directive/ + types/platform-contracts.ts | Two incompatible ControlDirective(kind enum vs type enum)——deprecated type dual existence with no canonical replacement                         |
| R6-15 | CRITICAL | contracts/execution-plan/ + types/platform-contracts.ts    | Two ExecutionPlans(both linear steps[])——deprecated type dual constructible without @deprecated annotation                                        |
| R6-16 | CRITICAL | interface/api/http-server/task-routes.ts                   | POST /v1/tasks accepts {title,priority,source} completely bypassing §5.3 intake pipeline                                        |
| R6-17 | HIGH     | interface/api/http-server/schemas.ts                       | Task status enum(queued/pending/in_progress/done/failed/cancelled) cannot represent canonical 13-state HarnessRunStatus       |
| R6-18 | HIGH     | Entire src/                                                    | OperationalDirective/DecisionDirective zero implementation/zero schema/zero import——§5.2 contract matrix completely unimplemented                  |
| R6-19 | HIGH     | Entire src/ 870+ places                                            | stepId still universal execution identifier(plugin-spi/domain registration/presenter/migration/SDK)——§5.5 only allows as legacy projection              |
| R6-20 | HIGH     | harness/index.ts:174                                       | HarnessRun has steps:HarnessStep[] as first-level field——§5.5 HarnessStep is only semantic projection, embedding makes violation naturalized      |
| R6-21 | MEDIUM   | execution/lease/execution-lease-service-async.ts:502       | `as any` cast in lease audit critical path——bypasses type safety                                                              |
| R6-22 | MEDIUM   | ops-maturity/edge-runtime/edge-orchestrator/               | EdgeExecutionPlan uses linear orderedTaskIds instead of PlanGraph(§4.4)                                                     |
| R6-23 | MEDIUM   | contracts/executable-contracts/schemas.ts:650              | validateExecutableContract() returns unknown——no type narrowing after validation                                                      |
| R6-24 | MEDIUM   | orchestration/harness/runtime/runtime-entry-guard.ts       | assertNoLegacyTruthWrite() only runtime interception——no compile-time @deprecated/no import enforcement                                     |

### 31. Test System Encoding Error Model (Blocking Migration)

| #     | Severity   | File                                                | Issue                                                                                                                       |
| ----- | -------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| R6-25 | CRITICAL | tests/unit/platform/contracts/execution-plan/       | 400+ lines validating createExecutionPlan/ExecutionPlanStep+stepId as correct behavior——takes deprecated contract as correctness baseline                        |
| R6-26 | CRITICAL | tests/e2e/multi-step-workflow-comprehensive.test.ts | All 7 scenarios drive WorkflowState CRUD linear step model——migration to canonical will break all e2e                                           |
| R6-27 | CRITICAL | tests/e2e/multi-step-task-execution.test.ts         | 18+ WorkflowState calls asserting linear step progression——encoding deprecated execution model as correct                                                                 |
| R6-28 | CRITICAL | tests/e2e/critical-workflows.test.ts                | 16+ WorkflowState calls asserting deprecated state transitions(running→paused→completed)                                                           |
| R6-29 | CRITICAL | tests/unit/platform/contracts/control-directive/    | 50+ assertions validating createControlDirective as correct——deprecated contract has complete regression protection                                                   |
| R6-30 | HIGH     | tests/integration/platform/contracts/               | Integration tests import and validate createExecutionPlan+createControlDirective flow——regression gate preventing deprecated deletion                                 |
| R6-31 | HIGH     | tests/golden/workflow-validation.test.ts            | Golden snapshot encodes linear steps[]+stepId+dependsOnStepIds——PlanGraph migration will break snapshot                                         |
| R6-32 | HIGH     | tests/helpers/fixtures/base.ts+composite.ts         | All fixture factories produce TaskRecord+ExecutionRecord no HarnessRun/NodeRun/PlanGraphBundle/BudgetReservation                   |
| R6-33 | HIGH     | tests/e2e/oapeflir-full-loop.test.ts                | E2E uses stepId-based PlanStep/StepResult driving OAPEFLIR as execution runtime(§2.4 OAPEFLIR not truth source)                        |
| R6-34 | HIGH     | tests/e2e/ All                                     | Zero e2e tests go through canonical intake pipeline; zero e2e tests verify BudgetReservation前置; zero e2e tests verify SideEffectRecord lifecycle |

### 32. Remaining Contract Batch Gaps

| #     | Severity   | File                                                                                                | Issue                                                                                                                   |
| ----- | -------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| R6-35 | CRITICAL | event_bus_contract.md                                                                               | Event names task.status*changed/workflow.step_completed/execution.* conflict with architecture platform.harness*run.*/platform.node_run.* |
| R6-36 | CRITICAL | event_registry_and_ops_threshold_contract.md                                                        | Threshold rules binding execution._ deprecated event types——ops alerts cannot capture canonical platform._ events                                      |
| R6-37 | CRITICAL | result_envelope_contract.md                                                                         | buildTaskResultEnvelope(task, stepOutputs, artifacts) completely based on pre-v4.3 model                                           |
| R6-38 | CRITICAL | debug_inspect_health_backpressure_contract.md                                                       | TaskInspectView.executions[] + /executions/:executionId/inspect all deprecated entities                                           |
| R6-39 | HIGH     | data_plane_contract.md                                                                              | ArtifactRef.source_execution_id should be source_harness_run_id/source_node_run_id                                          |
| R6-40 | HIGH     | app_error_contract.md                                                                               | AppError.execution_id uses legacy identifier                                                                                 |
| R6-41 | HIGH     | audit_lineage_and_retention_contract.md                                                             | Audit records use execution_id no harness_run_id/node_run_id——lineage chain broken                                                      |
| R6-42 | HIGH     | context_compaction_and_overflow_contract.md                                                         | CompactionRecord uses session_id/task_id no harness_run_id/node_run_id                                                   |
| R6-43 | HIGH     | workflow_io_compatibility_precheck_contract.md                                                      | Main fields workflow_id/step_id no PlanGraphBundle/NodeRun                                                                  |
| R6-44 | HIGH     | knowledge_spi_contract.md                                                                           | No harness_run_id integration; TrustLevel 4 levels not referencing §29 knowledge boundary rules                                                          |
| R6-45 | MEDIUM   | sla_tier_contract.md / quota_preemption / multimodal_gateway / org_hierarchy / feedback_improvement | All less than 60 lines, missing ContractEnvelope compliance + remediation section                                                      |

### 33. ADR and Architecture Conflicts (Third Batch)

| #     | Severity   | ADR     | Issue                                                                                                                  |
| ----- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| R6-46 | CRITICAL | ADR-079 | FeedbackSignal uses taskId+executionId as correlation keys; v4.3 canonical is harnessRunId/nodeRunId——learning objects cannot join truth      |
| R6-47 | CRITICAL | ADR-080 | FailurePattern/EvidenceRef uses executionId——same as R6-46, Learning subsystem disconnected from truth                                     |
| R6-48 | CRITICAL | ADR-033 | Status Accepted defines Phase 1-7 as canonical roadmap with evaluatePhaseAdvance() gate; §33 explicitly only historical mapping——should be Superseded |
| R6-49 | HIGH     | ADR-038 | Canary stages CANARY_5/20/50/100 conflict with ADR-075 canonical rollout states(canary_5/partial_25/50/75/stable)               |
| R6-50 | HIGH     | ADR-009 | Uses src/core/ as canonical directory+workflow_state as recovery table——v4.3 §35 uses src/platform/ + harness_runs                  |
| R6-51 | HIGH     | ADR-007 | "Supervisor" has restart/pause/upgrade/terminate Agent permissions——v4.3 §45 puts all lifecycle control under HarnessRuntime                         |
| R6-52 | HIGH     | ADR-070 | Status Accepted lists Phase 1-7 + "OAPEFLIR loop invariant" without v4.3 qualification(only projection)——should be Superseded                         |
| R6-53 | HIGH     | ADR-041 | TriggerAction.create_task bypasses §5.3 intake pipeline                                                                   |
| R6-54 | MEDIUM   | ADR-069 | OpsCapability includes restart_service/scale_up_down direct execution——not through HarnessRuntime+PlanGraphBundle                          |
| R6-55 | MEDIUM   | ADR-072 | Test matrix organized by OAPEFLIR module directory not v4.3 canonical runtime modules                                                      |
| R6-56 | MEDIUM   | ADR-078 | Knowledge TrustLevel no §10 risk model inherent_risk+trust_score separation mapping——may implicitly reduce risk                           |


### 35. UI Monorepo Implementation vs UI Architecture Specification (§1-§7)

| #     | Severity | File/Domain                                        | Issue                                                                                           |
| ----- | ------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| R7-1  | P0     | ui/apps/web/src/feature-registry.ts              | 27 features all eager import no code split; §4.4.1 requires except / and /login all React.lazy      |
| R7-2  | P0     | ui/vitest.config.ts                              | Coverage threshold(lines:30%/branches:20%) far below §7.2.6(shared≥90%/ui-core≥80%/features≥70%/apps≥50%) |
| R7-3  | P0     | ui/scripts/perf-budget.mjs                       | JS chunk 550KB/total 1200KB——§7.3.1 requires main<200KB gz/lazy chunk<100KB gz(over 2.75-5.5x)       |
| R7-4  | P1     | ui/apps/web/src/app-shell.tsx                    | Routes are flat single path——no §4.4.1 L2-L5 nested drill-down routes(/tasks/:id/evidence etc)                         |
| R7-5  | P1     | ui/packages/features/                            | Missing feature-flags module(§4.1 Admin has independent route /admin/feature-flags)                              |
| R7-6  | P1     | ui/packages/features/settings/                   | Settings has no sub-route navigation——§4.2.9 defines 8 sub-pages all missing                                             |
| R7-7  | P1     | ui/packages/shared/api-client/                   | Missing /api/v1/meta/contract-version endpoint(§1.8 contract version negotiation)                                       |
| R7-8  | P1     | ui/packages/shared/api-client/ws-event-router.ts | Missing nl.clarification_needed event mapping(§5.3)                                                      |
| R7-9  | P1     | ui/ root                                         | Missing Playwright/Detox/Spectron/axe-core dependencies(§7.2.4 E2E+accessibility testing)                              |
| R7-10 | P1     | ui/packages/shared/i18n/                         | Only 4 translation keys/2 locale——§6.4 requires full module coverage                                                   |
| R7-11 | P2     | ui/packages/ui-core/src/design-tokens/           | No primitive/semantic token layering(§6.3.1)                                                       |
| R7-12 | P2     | ui/apps/web/src/app-shell.tsx                    | Route guard hardcoded demo permissions——§4.4.3 requires 5-layer dynamic guard chain                                      |
| R7-13 | P2     | ui/packages/shared/api-client/rest-client.ts     | Missing Idempotency-Key header support(§5.6.4)                                                         |
| R7-14 | P2     | ui/pnpm-workspace.yaml + turbo.json              | Conflicts with npm workspaces selected by §2.2 ADR——vestigial configuration                                         |

### 36. Backend UI Service vs UI Architecture Specification (§4-§5)

| #     | Severity | File/Domain                                              | Issue                                                                                                                 |
| ----- | ------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| R7-15 | P0     | src/interaction/dashboard/dashboard-projection-service | Only outputs totalTasks/tasksByStatus etc 4 fields; UI spec §4.7.7 requires success_rate/avg_duration_ms/active_agents etc 10+ fields |
| R7-16 | P0     | src/interaction/dashboard/dashboard-websocket-server   | WS message types dashboard_delta/snapshot don't match UI spec task.status_changed/approval.resolved domain event model     |
| R7-17 | P0     | src/interaction/dashboard/dashboard-websocket-server   | Subscription model is dashboard-ID-based; UI spec requires channel-based (global/task:{id}/approvals/admin)                         |
| R7-18 | P1     | src/interaction/dashboard/                             | DashboardProjectionService and DashboardWebSocketServer not integrated (has TODO)                                             |
| R7-19 | P1     | src/interaction/dashboard/metric-aggregator/           | Only covers ~15% of required metrics; UI spec 4-layer 28-panel requires complete metric set                                                           |
| R7-20 | P1     | src/interaction/dashboard/health-scorer/               | Returns single value; UI spec StabilityPanelView requires 8 fields(uptime/error_rate/p99 etc)                                      |
| R7-21 | P1     | src/interaction/dashboard/alert-router/                | Only sorts; no real-time routing/overlay/push/haptic notification                                                                          |
| R7-22 | P1     | src/platform/interface/api/mission-control-service     | MissionControlSnapshot DTO doesn't match UI spec Dashboard wireframe fields                                                 |
| R7-23 | P1     | src/platform/interface/api/mission-control-service     | getWorkflowCockpit() returns inspect-oriented shape not UI spec presentation shape                                     |
| R7-24 | P1     | src/platform/interface/api/mission-control-service     | getStabilityPanel() returns array not UI spec required scalar count                                                              |
| R7-25 | P1     | src/interaction/ux/workflow-builder-service            | Only internal methods no REST endpoint; UI spec requires CRUD + validate + publish API                                                   |
| R7-26 | P1     | src/interaction/ux/conversation-history-service        | Missing clarificationState/riskPreview/actionOptions[] fields                                                               |
| R7-27 | P1     | src/interaction/ux/conversation-history-service        | No WS event emission; UI spec requires nl.clarification_needed real-time push                                                        |
| R7-28 | P2     | src/interaction/ux/ux-event-tracking-service           | Hardcoded "test:many_events" event type; no §5.4 standard event taxonomy                                           |
| R7-29 | P2     | src/interaction/ux/platform-workbench-snapshot-service | Route doesn't match UI spec §4.4.1 /workbench/:view                                                                        |
| R7-30 | P2     | src/interaction/dashboard/                             | DashboardAggregationService and DashboardProjectionService two parallel not integrated                                             |

### 37. UI-Related Contract/ADR vs UI Architecture Conflicts

| #     | Severity | File/Domain                                                     | Issue                                                                                         |
| ----- | ------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| R7-31 | P0     | docs_zh/contracts/ui_console_and_cockpit_contract             | TaskCockpit uses task_id/task_status/current_step——all deprecated terms (should be harness_run_id/NodeRun) |
| R7-32 | P0     | docs_zh/contracts/ui_console_and_cockpit_contract             | WorkflowCockpit uses workflow_id/steps/current_step_index——deprecated linear model                        |
| R7-33 | P0     | docs_zh/contracts/ui_console_and_cockpit_contract             | AdminTakeoverConsole uses retry_step/skip_step/override_step_output——deprecated operations                  |
| R7-34 | P1     | docs_zh/contracts/admin_console_and_human_takeover_contract   | Also uses step terminology(step_id/step_status) not PlanGraph NodeRun                                  |
| R7-35 | P1     | docs_zh/contracts/ui_console_and_cockpit_contract             | Contract navigation only 4 groups; UI spec has Extended/Shared Features with 12+ modules                         |
| R7-36 | P1     | docs_zh/contracts/gateway_message_contract                    | No console WebSocket push protocol definition                                                            |
| R7-37 | P1     | docs_zh/contracts/dashboard_and_operator_experience_contract  | WorkflowBuilderDraft.steps uses linear model——should be DAG nodes/edges                                  |
| R7-38 | P1     | docs_zh/contracts/hitl_experience_and_explainability_contract | Uses deprecated step terminology(step_id/step_output/step_retry)                                           |
| R7-39 | P2     | ui/docs/adr/                                                  | Only placeholder README; UI spec referenced ADR-UI-001~009 all don't exist                              |
| R7-40 | P2     | docs_zh/contracts/sdk_surface_contract                        | No MissionControlService typed endpoint definition                                                      |

### 38. Remaining Platform Gaps (API Gateway/Security/Reliability)

| #     | Severity | File/Domain                                    | Issue                                                                         |
| ----- | ------ | -------------------------------------------- | ---------------------------------------------------------------------------- |
| R7-41 | P0     | src/platform/interface/api/middleware/       | No rate-limiting middleware; §9.2 requires per-endpoint-class rate limiting           |
| R7-42 | P0     | src/platform/interface/api/middleware/       | No Idempotency-Key middleware; §6.2 requires idempotency guarantee                             |
| R7-43 | P0     | src/platform/interface/api/http-server/      | Response missing X-Trace-Id header; §6.2 requires full链路 tracking propagation                            |
| R7-44 | P0     | src/platform/contracts/                      | No inter-plane ContractEnvelope signature verification; §5.2 requires signature+version verification             |
| R7-45 | P0     | src/platform/                                | No bulkhead isolation pattern; §9.1 requires inter-plane fault isolation                       |
| R7-46 | P0     | src/platform/control-plane/iam/              | SAML implementation missing X.509 trust-chain validation/C14N/encrypted assertion (security critical TODO) |
| R7-47 | P1     | src/platform/interface/api/                  | No API version routing/negotiation mechanism; §6.4 requires Accept-Version header routing               |
| R7-48 | P1     | src/platform/stability/                      | Only rehearsal runner no reusable reliability library (circuit-breaker/retry/timeout all missing) |
| R7-49 | P1     | src/platform/interface/api/middleware/       | CORS default allowedOrigins:["*"] + credentials:true——security anti-pattern                |
| R7-50 | P1     | src/platform/execution/worker-pool/          | WorkerDrainProtocol 40-line stub missing §8.2 drain-quiesce-terminate three-phase behavior     |
| R7-51 | P1     | src/org-governance/                          | Governance console missing persistent audit log + RBAC check (marked TODO)                            |
| R7-52 | P2     | src/platform/shared/stability/ vs stability/ | Duplicate module tree; responsibility boundary unclear                                                     |

### 40. Platform Core Deep Gaps (Model Gateway / Planner / Recovery / Evidence)

| #     | Severity | File/Domain                                                             | Issue                                                                                                                                |
| ----- | ------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| R8-01 | P0     | src/platform/model-gateway/cost-tracker/budget-guard.ts               | Budget check is stateless comparison; §18.3 requires atomic reserve→execute→settle + BudgetReservation state machine; concurrent can overspend                               |
| R8-02 | P0     | src/platform/execution/recovery/runtime-recovery-service.ts           | Recovery service is read-only——classifies faults and suggests actions but never executes; no saga rollback/compensation executor/CompensationRecord                          |
