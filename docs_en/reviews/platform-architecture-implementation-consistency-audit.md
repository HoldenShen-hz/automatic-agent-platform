# 00-platform-architecture.md Implementation Consistency Audit Re-examination

> Reopened examination date: 2026-04-28
> Handling principle: Keep original audit issue details, do not delete issue descriptions; the previous version's "fixed/closed evidence" conclusions are all withdrawn, reverting to `unfixed` and `pending supplement` first, then fixing each item individually.
> Important note: `src/platform/architecture/implementation-consistency-closure.ts` can only prove "ID exists" and "historical index exists", and cannot serve as proof of being fixed.

## 0. Item-by-Item Re-examination and Closure Evidence Index

Each issue row in this report retains the original deviation description, and retains historical indices via `ImplementationConsistencyClosureRegistry:<issue number>`. The review conclusion has been corrected: `ImplementationConsistencyClosureRegistry` is not a closure record, only a problem ID directory; all 238 items are treated as `unfixed` until direct code, contract, ADR, spec, or test evidence is verified item by item. This section only retains the mapping from ID prefix to historical index position; historical indices alone cannot serve as closure evidence.

| ID Range | Issue Category | Current Conclusion | Review Notes |
| --- | --- | --- | --- |
| C-1..C-7 | Code vs architecture deviations | Unfixed | Historical indices require item-by-item re-review; can no longer use state machine/guard generalization to prove closure |
| T-1..T-56 | Contract docs vs architecture deviations | Unfixed | Historical indices require item-by-item re-review; can no longer use contract remediation section generalization to prove closure |
| A-1..A-37 | ADR vs architecture deviations | Unfixed | Historical indices require item-by-item re-review; can no longer use supersession ADR generalization to prove closure |
| G-1..G-9 | Config/code vs architecture deviations | Unfixed | Historical indices require item-by-item re-review; can no longer use invariant guard generalization to prove closure |
| O-1..O-24 | org-governance vs architecture deviations | Unfixed | Historical indices require item-by-item re-review; can no longer use remediation summary module generalization to prove closure |
| S-1..S-20 | scale-ecosystem vs architecture deviations | Unfixed | Historical indices require item-by-item re-review; can no longer use remediation summary module generalization to prove closure |
| M-1..M-20 | ops-maturity vs architecture deviations | Unfixed | Historical indices require item-by-item re-review; can no longer use remediation summary module generalization to prove closure |
| F-1..F-25 | OAPEFLIR spec vs architecture deviations | Unfixed | Historical indices require item-by-item re-review; can no longer use compatibility override generalization to prove closure |
| I-1..I-20 | interaction vs architecture deviations | Unfixed | Historical indices require item-by-item re-review; can no longer use remediation summary module generalization to prove closure |
| D-1..D-20 | domains/SDK vs architecture deviations | Unfixed | Historical indices require item-by-item re-review; can no longer use remediation summary module generalization to prove closure |

Review gate: no aggregate closure test is retained as closure evidence; an item can be marked fixed only through direct implementation evidence, direct contract text, or direct targeted tests on the actual target file(s). The historical registry is explicitly prohibited from being used as proof that "all are fixed".

## 1. Code vs Architecture (7 items)

| #   | Severity | Location                                              | Deviation Description | Status | Closure Evidence |
| --- | ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| C-1 | HIGH   | `src/platform/five-plane-orchestration/harness/index.ts`     | HarnessRunStatus has only 7 states (idle/planning/executing/paused/sleeping/completed/failed), architecture §25.8 defines 13 states; missing initializing/awaiting_approval/compensating/rolling_back/suspended/draining etc. 9 states; excess sleeping/idle/planning 3 non-canonical states | Unfixed | Pending |
| C-2 | HIGH   | Same as above                                       | HarnessRun interface has no `planGraphBundle` field, runLoop never generates/validates PlanGraphBundle, architecture §25 requires each run to hold immutable execution plan graph | Unfixed | Pending |
| C-3 | HIGH   | `src/platform/five-plane-execution/runtime-state-machine.ts` | RuntimeStateMachine lists `compensating` as a legitimate reachable state for NodeRun, architecture §14.3 explicitly models compensation as independent CompensationRun, not NodeRun sub-state | Unfixed | Pending |
| C-4 | MED    | Same as above                                       | NodeRun code added `blocked`/`queued` two non-canonical states, architecture NodeRun status enum does not exist | Unfixed | Pending |
| C-5 | MED    | Same as above                                       | `assertTransitionAllowed` silently allows self-transition for from===to, bypassing architecture-required CAS/lease/fencing token validation | Unfixed | Pending |
| C-6 | MED    | `src/platform/contracts/index.ts`                 | Barrel re-exports 4 deprecated contract types (LegacyRolloutContract etc.), architecture v4.0 has removed corresponding concepts | Unfixed | Pending |
| C-7 | LOW    | `src/platform/five-plane-execution/budget-allocator.ts`      | `settle()` hardcoded `hardCapSatisfied: true`, skips architecture §18 required actual hard cap validation | Unfixed | Pending |

## 2. Contract Docs vs Architecture (11 items)

| #    | Severity | Contract File                         | Deviation Description | Status | Closure Evidence |
| ---- | ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| T-1 | HIGH   | `runtime_state_machine_contract`      | ExecutionStatus uses running/paused/cancelled/completed/failed 5 states, architecture NodeRun uses pending/ready/running/blocked/succeeded/failed/skipped/cancelled/timed_out 9 states; WorkflowStatus 6 states vs HarnessRun 13 states | Unfixed | Pending |
| T-2 | HIGH   | `side-effect-reconciliation-contract` | State machine pending→executing→reconciling→settled 4-step linear, architecture §14.11 requires pending→claimed→executing→awaiting_confirmation→settled/compensating with branches | Unfixed | Pending |
| T-3 | MED    | `budget-ledger-contract`              | Uses "settle" verb to describe budget consumption, architecture §18 uniformly uses "consume"; resourceKind enum only token/api_call/compute, architecture additionally defines storage/bandwidth/memory | Unfixed | Pending |
| T-4 | MED    | `version-lock-contract`               | Only supports 3 locking strategies (pinned/floating/range), architecture §22.4 defines 4 types including digest-locked | Unfixed | Pending |
| T-5 | MED    | `event-envelope-contract`             | Missing 5 required fields from architecture ContractEnvelope: schema_version/idempotency_key/causation_id/partition_key/ttl | Unfixed | Pending |
| T-6 | MED    | `task_lease_and_fencing_contract`     | Uses deprecated term execution_id, architecture v4.0 uniformly uses node_run_id | Unfixed | Pending |
| T-7 | MED    | `harness-run-contract`                | Contract §45.13 defines 6 states vs architecture §25.8 defines 13 states, architecture docs internally inconsistent (§25.4 lists 7 states vs §25.8 lists 13 states) | Unfixed | Pending |
| T-8 | MED    | `plan-graph-contract`                 | Contract defines PlanGraph as mutable (supports appendNode), architecture §25 explicitly requires PlanGraphBundle as immutable snapshot | Unfixed | Pending |
| T-9 | MED    | `approval-routing-contract`           | Missing architecture §31 required fields escalation_chain and timeout_auto_action | Unfixed | Pending |
| T-10 | LOW    | `model-routing-contract`              | Routing strategy enum cost_optimized/latency_optimized/quality_optimized 3 types, architecture §19 defines 5 types including compliance_constrained/hybrid | Unfixed | Pending |
| T-11 | LOW    | `domain-recipe-contract`              | Recipe structure missing architecture §38 required references risk_profile_ref and guardrail_overlay | Unfixed | Pending |

## 3. ADR vs Architecture (12 items)

| #    | Severity | ADR         | Deviation Description | Status | Closure Evidence |
| ---- | ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| A-1 | HIGH   | ADR-016     | Defines OAPEFLIR as core execution orchestrator (OapeflirLoopService as run entry), directly violates architecture v4.3 core invariant: HarnessRuntime is the only execution entry point, OAPEFLIR is only a cognitive loop framework | Unfixed | Pending |
| A-2 | HIGH   | ADR-029     | Continues ADR-016 route, HarnessRuntime demoted to OAPEFLIR sub-service, contrary to architecture hierarchy | Unfixed | Pending |
| A-3 | HIGH   | ADR-030     | Defines execution recovery protocol without mentioning RuntimeStateMachine as the only state change API, directly operates storage layer | Unfixed | Pending |
| A-4 | MED    | ADR-012     | Uses legacy term "step" instead of architecture v4.0 "NodeRun" | Unfixed | Pending |
| A-5 | MED    | ADR-091     | References "Rollout" concept, architecture v4.0 has renamed to "Release" | Unfixed | Pending |
| A-6 | MED    | ADR-109     | Sandbox escape protection has 3 layers, architecture §16 defines 4 layers (one more hardware isolation layer) | Unfixed | Pending |
| A-7 | MED    | ADR-110     | ContextWindow compression policy does not reference architecture §20 MemoryTier layered model | Unfixed | Pending |
| A-8 | MED    | ADR-111     | Plugin lifecycle uses install/enable/disable/uninstall 4 states, architecture §23 uses registered/validated/active/suspended/deprecated 5 states | Unfixed | Pending |
| A-9 | MED    | ADR-112     | Multi-region replication uses eventual consistency model, architecture §36 requires causal consistency with bounded staleness | Unfixed | Pending |
| A-10 | LOW    | ADR-016/029 | DTO names use OapeflirInput/OapeflirOutput, architecture uniformly uses CognitiveFrameInput/CognitiveFrameOutput | Unfixed | Pending |
| A-11 | LOW    | ADR-030     | Recovery timeout hardcoded 30s, architecture §14.7 requires dynamic configuration by NodeType (LLM node 120s, tool node 30s, human node unlimited) | Unfixed | Pending |
| A-12 | LOW    | ADR-091     | Still references v3 DeploymentSlot concept, architecture v4.0 uses ReleaseChannel | Unfixed | Pending |

## 4. Code Config vs Architecture (9 items)

| #   | Severity | Location                                                   | Deviation Description | Status | Closure Evidence |
| --- | ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| G-1 | HIGH   | `src/interaction/autonomy/index.ts`                    | ConstraintPack.autonomyMode only "manual"/"auto" two values, architecture §28 defines AutonomyLevel as "suggestion"/"semi_auto"/"frozen" three levels + dynamic升降 | Unfixed | Pending |
| G-2 | HIGH   | `src/platform/five-plane-orchestration/harness/index.ts`          | Uses "sleeping" state to indicate pause, architecture uniformly uses "paused" (short-term)/"hibernated" (long-term), semantics completely different | Unfixed | Pending |
| G-3 | HIGH   | `config/domains/quant-trading.json`                    | JSON fields (latencyBudgetMs/riskTier/allowedModels) completely mismatch DomainDefinitionSchema Zod validation fields in `src/domains/registry/domain-model.ts`, config cannot pass its own validation | Unfixed | Pending |
| G-4 | HIGH   | `src/interaction/autonomy/index.ts`                    | Autonomy level upgrade (`escalateAutonomy`) has no domain risk gate check, high-risk domains (healthcare/finance) can be upgraded to full_auto, violating architecture §28.5 security constraint | Unfixed | Pending |
| G-5 | MED    | `src/platform/five-plane-state-evidence/index.ts`                 | Only implements snapshot/timeline/audit three sub-modules, missing architecture required reconciliation/side-effect-ledger/outbox/compaction four sub-modules | Unfixed | Pending |
| G-6 | MED    | `src/platform/prompt-engine/prompt-injection-guard.ts` | Only implements single-layer regex filtering, missing architecture §17 required 4-layer defense chain: lexical→semantic→behavioral→consensus | Unfixed | Pending |
| G-7 | MED    | `config/runtime/default.json`                          | maxConcurrentRuns=50, architecture §14.2 requires default value to link with domain quota, not global hardcoded | Unfixed | Pending |
| G-8 | MED    | `config/risk/default.json`                             | riskCategories only defines operational/financial/compliance 3 types, architecture §30 defines 6 types including reputational/safety/strategic | Unfixed | Pending |
| G-9 | LOW    | `src/platform/model-gateway/index.ts`                  | Routing degradation only try/catch single retry, architecture §19.6 requires circuit-breaker + 3-level degradation gradient (same-provider fallback→cross-provider→offline model) | Unfixed | Pending |

---

## Original First Batch Statistical Summary (historical snapshot, currently unfixed)

The following statistics are severity summaries of the original audit's first batch of 39 issues, retained for traceability; the previous version's "fixed" determinations have been all withdrawn; current status is based on the `unfixed` in each table above, and the `closure evidence` column has also been cleared to `pending supplement`.

| Category              | HIGH   | MED    | LOW   | Total   |
| ----------------- | ------ | ------ | ----- | ------ |
| Code vs architecture      | 3      | 3      | 1     | 7      |
| Contract vs architecture  | 2      | 7      | 2     | 11     |
| ADR vs architecture       | 3      | 6      | 3     | 12     |
| Config/code vs architecture | 4      | 4      | 1     | 9      |
| **Total**          | **12** | **20** | **7** | **39** |

## Original Systemic Themes (historical snapshot, currently unfixed)

The following themes are the original audit's induction of systemic deviations, retained for traceability; these themes currently still represent open tasks; the previous version's reliance on direct contract remediation, ADR supersession, runtime guard, architecture remediation modules, and invariant tests is no longer treated as completed proof.

1. **State machine definition fragmentation**: Architecture, contracts, ADRs, and code each define different status enums, no single source of truth
2. **OAPEFLIR positioning contradiction**: ADRs treat it as orchestration core, architecture treats it as cognitive framework, code implementation is somewhere in between
3. **Terminology drift not cleaned up**: v3→v4 renames (step→NodeRun, Rollout→Release, execution_id→node_run_id) not uniformly updated in ADRs and contracts
4. **Config-validation disconnect**: Domain config JSON fields mismatch Zod schema, meaning config may never have been schema-validated
5. **Insufficient defense depth**: Multiple places only implement single-layer security/stability mechanisms, architecture requires multi-layer defense-in-depth not implemented

---

## 5. org-governance Code vs Architecture (24 items)

| #    | Severity | Location                                              | Deviation Description | Status | Closure Evidence |
| ---- | ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| O-1 | HIGH   | org-model/org-node/index.ts                       | OrgNodeType enum has extra `member`, §46.1 only defines company/division/department/team | Unfixed | Pending |
| O-2 | MED    | org-model/org-node/index.ts                       | Field naming mismatch: code orgNodeId/nodeType/displayName vs architecture nodeId/type/name | Unfixed | Pending |
| O-3 | HIGH   | org-model/                                        | `LegalEntityBoundary` (cross-legal-entity/cross-border data and approval control) required by §46.2 completely missing | Unfixed | Pending |
| O-4 | HIGH   | org-model/hierarchy/index.ts                      | §46.3 requires org changes generate OrgMergeConflictReport/ApprovalRerouteOnOrgChange/OrphanAgentFreezePolicy/IdentityDeprovisioningReport, code only emits basic events with no downstream execution | Unfixed | Pending |
| O-5 | HIGH   | approval-routing/route-engine/index.ts            | `applySodPolicy` only checks requester≠approver, §47.1 requires coverage of conflict of interest, same-chain mutual review, budget owner vs executor conflict | Unfixed | Pending |
| O-6 | HIGH   | approval-routing/                                 | §47.3 requires `ApprovalRouteSnapshot` creation to freeze (org version/approver set/SoD/COI/FX snapshot/strategy version/evidence references), not implemented | Unfixed | Pending |
| O-7 | MED    | approval-routing/route-engine/index.ts            | §47.2 amount matrix uses CNY, code uses `amountUsd` with no multi-currency/FX snapshot support | Unfixed | Pending |
| O-8 | MED    | approval-routing/                                 | §47.3 requires re-validation on approval expiry/revocation/submission, none implemented | Unfixed | Pending |
| O-9 | MED    | approval-routing/delegation/index.ts              | §47.3 requires peer delegation must pass ConflictOfInterestFilter, code has no COI check | Unfixed | Pending |
| O-10 | HIGH   | compliance-engine/framework-catalog.ts            | §49.1 requires ComplianceFramework to contain type enum (GDPR/SOC2/PIPL/HIPAA/SOX/PCI_DSS)/auditRequirements/reportTemplate, code only has bare frameworkId | Unfixed | Pending |
| O-11 | MED    | compliance-engine/inheritance/index.ts            | §49.2 requires PolicyStrictnessComparator to compare by policy type, code uses naive heuristic (boolean OR/number MAX), may silently relax policy | Unfixed | Pending |
| O-12 | MED    | compliance-engine/                                | §49.3 requires ComplianceExceptionWorkflow/EvidenceQualityScore/ControlCoverageReport, none implemented | Unfixed | Pending |
| O-13 | HIGH   | knowledge-boundary/boundary-manager/index.ts      | §50.1 accessPolicy should be strict/controlled, code uses defaultVisibility: private/shared/public, completely different semantics | Unfixed | Pending |
| O-14 | MED    | knowledge-boundary/boundary-manager/index.ts      | §50.1 requires `auditOnAccess: boolean (default true)` field, missing | Unfixed | Pending |
| O-15 | HIGH   | knowledge-boundary/chinese-wall-policy.ts         | §50.3 requires WallExpiryPolicy/compliance officer approval reset/cooling period/data residue scan, code wall is permanent and irrevocable | Unfixed | Pending |
| O-16 | MED    | knowledge-boundary/knowledge-federator.ts         | §50.3 requires CrossBoundaryTransform (desensitization/summary/field filtering), code directly returns raw excerpt | Unfixed | Pending |
| O-17 | HIGH   | delegated-governance/scope-manager/index.ts:82-84 | `evaluateGuardrail` returns allowed:true for unknown guardrail types, violating §2.3 default-deny principle, security vulnerability | Unfixed | Pending |
| O-18 | MED    | delegated-governance/scope-manager/index.ts       | §51.3 gives department_admin medium/low risk domain onboarding permissions, code gives team_lead zero operations, but architecture §51.1 gives it daily operations configuration rights | Unfixed | Pending |
| O-19 | MED    | delegated-governance/delegation-registry/index.ts | §51.1 permissions use level enum (view/operate/admin/super_admin)+delegatable, code uses flat capability strings without hierarchy | Unfixed | Pending |
| O-20 | MED    | delegated-governance/                             | §51.1 requires expired/revoked delegation to cascade revoke all derived permissions, code only revokes single one without cascade | Unfixed | Pending |
| O-21 | MED    | sso-scim/index.ts                                 | api-key-service.ts exists but not exported from index.ts, module public API unreachable | Unfixed | Pending |
| O-22 | MED    | sso-scim/                                         | §48.2 requires identity_sync_dlq to handle sync exceptions/SCIM conflict reports, not implemented, sync failures silently lost | Unfixed | Pending |
| O-23 | MED    | sso-scim/                                         | §48.3 requires session revocation SLO (normal <5min, security <60s) and freeze Agent on deprovisioning, not implemented | Unfixed | Pending |
| O-24 | LOW    | compliance-engine/inheritance/index.ts            | Boolean merge uses OR (child true overrides parent false), §49.2 requires child cannot relax parent constraint, deny type applies AND | Unfixed | Pending |

## 6. scale-ecosystem Code vs Architecture (20 items)

| #    | Severity | Location                                          | Deviation Description | Status | Closure Evidence |
| ---- | ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| S-1 | HIGH   | marketplace/catalog/index.ts                  | MarketplaceCatalogEntry missing contract required fields: publisher_id/artifact_type/artifact_ref/pricing_model/capabilities/version | Unfixed | Pending |
| S-2 | HIGH   | billing/                                      | RevenueSharePolicy (policy_id/gross_split/tax_handling/refund_policy/settlement_cycle) completely not implemented | Unfixed | Pending |
| S-3 | HIGH   | billing/billing-payment-gateway.ts            | Only has createCheckoutSession/fetchPaymentSessionStatus, missing contract required create_subscription/update_plan/capture_invoice/mark_payment_failed/cancel_subscription | Unfixed | Pending |
| S-4 | HIGH   | billing/billing-service.ts                    | No refund/adjustment mechanism, contract requires refund expressed as independent adjustment record, cannot modify usage ledger | Unfixed | Pending |
| S-5 | HIGH   | (missing)                                        | CapacityPlanning module completely does not exist, contract requires CapacitySignal/CapacityForecast/CapacityScenario/CapacityRecommendation | Unfixed | Pending |
| S-6 | HIGH   | (missing)                                        | CostAttribution module missing, contract requires CostAttributionRecord/OptimizationRecommendation/CostSimulationScenario | Unfixed | Pending |
| S-7 | HIGH   | multi-region/                                 | Remote session state machine missing, contract requires connecting/connected/reconnecting/degraded/failed/viewer_only 6 states, code only has RegionHealthStatus | Unfixed | Pending |
| S-8 | HIGH   | marketplace/                                  | ListingDependency object and dependency compatibility check missing, contract requires "dependencies must be explicitly declared and pass compatibility check" | Unfixed | Pending |
| S-9 | MED    | sla-engine/breach-detector/index.ts           | Only classifies latency/success_rate/queue_wait, missing execution timeout and dependency unavailability violation types | Unfixed | Pending |
| S-10 | MED    | resource-manager/fair-queue/index.ts          | Only uses tenantId+priority+ageMs sorting, contract requires 5 dimensions: tenant/org/domain/sla_tier/priority | Unfixed | Pending |
| S-11 | MED    | marketplace/marketplace-governance-service.ts | deprecatePackage has no migration_target or alternative suggestion field | Unfixed | Pending |
| S-12 | MED    | multi-region/cross-region-routing-service.ts  | Cross-region routing decision has no audit record, contract requires explicit policy and audit trail | Unfixed | Pending |
| S-13 | MED    | billing/billing-service.ts                    | BillingAccountRecord missing contract §4 required balance_snapshot field | Unfixed | Pending |
| S-14 | MED    | integration/connectors/*.ts                  | Connector implementations have no secret management integration, contract requires to be constrained by policy/secret management | Unfixed | Pending |
| S-15 | MED    | sla-engine/sla-operations-service.ts          | No starvation protection or preemption ceiling, contract requires "low tier cannot starve high tier, high tier cannot indefinitely preempt global resources" | Unfixed | Pending |
| S-16 | MED    | feedback-loop/feedback-improvement-service.ts | candidateType value does not align with contract candidate_type, proposed_change uses bare strings without structured object | Unfixed | Pending |
| S-17 | LOW    | resource-manager/quota-enforcer/index.ts      | Uses scopeId but contract specifies scope, naming mismatch | Unfixed | Pending |
| S-18 | LOW    | marketplace/catalog/index.ts                  | trustLevel enum sandboxed/verified/enterprise vs governance uses ExtensionTrustLevel including internal, two vocabularies in same domain | Unfixed | Pending |
| S-19 | LOW    | multi-region/region-health-check-service.ts   | performHealthCheck uses Math.random() to simulate metrics, if accidentally deployed will generate meaningless health data | Unfixed | Pending |
| S-20 | LOW    | multi-region/data-replicator/index.ts         | `private emit?` declared as optional method without implementation, event emission path silently empty operation | Unfixed | Pending |

## 7. Contract Docs vs Architecture (continued, 20 items)

| #    | Severity | Contract File                                    | Deviation Description | Status | Closure Evidence |
| ---- | ------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| T-12 | HIGH   | state_transition_matrix_contract                 | Uses tasks.status/workflow_state.status/executions.status as authoritative objects, architecture §5.5 uses HarnessRun/NodeRun, entire state mapping table is v3 legacy | Unfixed | Pending |
| T-13 | HIGH   | oapeflir_loop_contract                           | OapeflirLoopService.run() treats OAPEFLIR as execution engine returning finalOutcome, architecture §13.1 explicitly states "OAPEFLIR is not an execution engine, does not create independent Run, does not directly drive state migration"; Stage 8 still uses Rollout not Release | Unfixed | Pending |
| T-14 | HIGH   | execution_plane_contract                         | §8A defines Plan DTO containing steps[]+dag as P3→P4 input, architecture §4.4/§13.6 mandates PlanGraphBundle as the only P3→P4 contract; output uses DualChannelStepOutput/FeedbackSignal not architecture's NodeAttemptReceipt | Unfixed | Pending |
| T-15 | HIGH   | runtime_execution_contract                       | ExecutionEnvelope contains stage (OAPEFLIR stage) as a first-class execution field driving runtime behavior, violating §13.1 (stage is only a projection) | Unfixed | Pending |
| T-16 | HIGH   | sandbox_and_auth_contract                        | Isolation levels standard/hardened/strict, architecture §11.4 defines read_only/workspace_write/scoped_external_access/restricted_exec completely different 4 layers | Unfixed | Pending |
| T-17 | HIGH   | policy_engine_contract                           | mode field uses supervised/auto/full-auto 3 values, architecture §9.5 defines 8 canonical modes including 5 degradation modes | Unfixed | Pending |
| T-18 | HIGH   | context_propagation_contract                     | RuntimeContextSnapshot carries task_id/execution_id/workflow_id, missing v4.3 canonical identifiers: harnessRunId/nodeRunId/planGraphId/graphVersion/attemptId | Unfixed | Pending |
| T-19 | HIGH   | tool_and_provider_execution_contract             | All use task_id/execution_id/agent_id, architecture §5.3 mandates harnessRunId/nodeRunId/attemptId; BudgetCheckResult is simple boolean, architecture requires complete BudgetReservation lifecycle | Unfixed | Pending |
| T-20 | MED    | executable_unit_contract                         | Defines ExecutableUnit containing unit_kind (workflow_step/skill_step/tool_call), architecture §14.10/§5.5 uses NodeRun/NodeAttempt as canonical minimum execution unit, contract has no reference | Unfixed | Pending |
| T-21 | MED    | lifecycle_and_termination_contract               | Generic lifecycle template initial/active/paused/blocked/failed/terminal, missing architecture HarnessRun's admitted/planning/replanning/compensating/aborted and NodeRun's leased/retry_wait/awaiting_hitl/reconciling states | Unfixed | Pending |
| T-22 | MED    | task_and_workflow_contract                       | §6A defines PlanDTO containing strategy/execution_graph as "authoritative handover object", architecture only recognizes PlanGraphBundle; WorkflowState.current_stage holds OAPEFLIR stage as authoritative state violating §13.1 | Unfixed | Pending |
| T-23 | MED    | supervisor_contract                              | AgentRuntimeInstance carries current_step_id, architecture §5.5 says HarnessStep is only semantic projection; Alert severity info/warning/critical 3 levels vs architecture SEV1-4 | Unfixed | Pending |
| T-24 | MED    | governance_control_plane_contract                | Uses DecisionRequest/DecisionResult, architecture §5.2 establishes OperationalDirective/DecisionDirective as canonical P2→P3/P4 directives | Unfixed | Pending |
| T-25 | MED    | proactive_agent_and_autonomy_contract            | Autonomy levels manual_only/suggest_only/supervised_execute/trusted_auto_execute have no mapping to architecture §9.5 runtime modes, trusted_auto_execute has no counterpart | Unfixed | Pending |
| T-26 | MED    | platform_panic_and_resume_contract               | Panic scope includes workflow but architecture §9.5 ModeScope is platform>region>tenant>domain>run>node, missing region/run/node; ResumePlan has no architecture-required human confirmation constraint | Unfixed | Pending |
| T-27 | MED    | agent_contract                                   | Uses division_id as main organization unit, architecture v4.3 uses domain-centered model (domain_id/DomainDescriptor); DispatchMode.worker_dispatch does not reference PlanGraphDispatch | Unfixed | Pending |
| T-28 | LOW    | domain_descriptor_and_onboarding_contract        | DomainRiskProfile is referenced but required fields not defined, architecture §3.2 requires high-risk domains to declare advisory_only/human_accountable/deterministic_hot_path_only | Unfixed | Pending |
| T-29 | LOW    | data_classification_and_prompt_handling_contract | Missing architecture §11.6 DataTaintPropagation hard rule: output data_class cannot be lower than highest input data_class unless there is explicit desensitization proof | Unfixed | Pending |
| T-30 | LOW    | compliance_report_generation_contract            | Does not reference architecture's EvidenceRecord (P3→P5)/EventEnvelope/AuditAppendCommand as evidence source | Unfixed | Pending |
| T-31 | LOW    | distributed_locking_contract                     | Lock state machine pending→active→renewed→released/expired→reclaimed does not explicitly belong to RuntimeStateMachine single change entry | Unfixed | Pending |

## 8. ops-maturity Code vs Architecture (20 items)

| #    | Severity | Location                                                      | Deviation Description | Status | Closure Evidence |
| ---- | ------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| M-1 | HIGH   | emergency/platform-panic-service.ts                       | PanicAcknowledgment.status uses ack/nack, §60.2 requires ack/failed/timeout, missing failure/timeout distinction causes panic_incomplete P0 event detection failure | Unfixed | Pending |
| M-2 | HIGH   | emergency/platform-panic-service.ts                       | PlatformPanicDirective.scope is plain string, §60.1 requires enum global/tenant/domain, no scope validation | Unfixed | Pending |
| M-3 | HIGH   | emergency/platform-panic-service.ts                       | requiredApprovers is number, §60.1 specifies string[], min 2, approver identity lost causing two-person audit unverifiable | Unfixed | Pending |
| M-4 | HIGH   | emergency/resume-protocol/index.ts                        | ResumePlan.approvedBy accepts single string, §60.3 requires ≥2 platform_admin approvers with role verification | Unfixed | Pending |
| M-5 | HIGH   | drift-detection/fingerprint-builder/index.ts              | BehaviorFingerprintInput missing window/tool_usage_distribution/success_rate/risk_distribution/driftScore fields (§63.1) | Unfixed | Pending |
| M-6 | HIGH   | drift-detection/changepoint-detector/index.ts             | Severity enum SEV3/none, §63.3 requires low/medium/high corresponding to graded response (alert→require_review→pause agent) | Unfixed | Pending |
| M-7 | MED    | agent-lifecycle/agent-registry/index.ts                   | Canary allows transition to paused, §61.3 state machine does not define canary→paused, only active→paused legal | Unfixed | Pending |
| M-8 | MED    | agent-lifecycle/agent-registry/index.ts                   | AgentDefinition missing §61.1 required ConnectorBindings component (§57 connector framework) | Unfixed | Pending |
| M-9 | MED    | explainability/explanation-pipeline-service.ts            | StageRationale uses taskId instead of §59.3 stageId (OAPEFLIR stage ID); missing decision field | Unfixed | Pending |
| M-10 | MED    | explainability/explanation-pipeline-service.ts            | Explanation cache has no TTL enforcement, §59.6 requires L1/L2 TTL=24h, L3 must not be cached | Unfixed | Pending |
| M-11 | MED    | cost-optimizer/cost-optimization-service.ts               | CostAttributionRecord missing humanReviewCost/egressCost/computeCost/storageCost details and qualityRisk (§64.1) | Unfixed | Pending |
| M-12 | MED    | workflow-debugger/workflow-debugger-service.ts            | Production breakpoint guard uses boolean canDebugProduction, §65.3 requires breakpoints only exist in ReplaySandbox, production runs prohibit breakpoints | Unfixed | Pending |
| M-13 | MED    | edge-runtime/edge-runtime-sync-service.ts                 | SyncEnvelope.signature is deterministic string concatenation not cryptographic signature, §62.3 requires signature appends queue containing prev_hash chain integrity | Unfixed | Pending |
| M-14 | MED    | compliance-reporter/compliance-report-pipeline-service.ts | status only complete/partial, §66.2 requires generated→HumanSignoff→attested lifecycle containing EvidenceQualityScore | Unfixed | Pending |
| M-15 | MED    | multimodal/multimodal-gateway-service.ts                  | MultimodalInputPart missing §68.2 ContentPart required provenance/safetyLabels/mimeType/costKey | Unfixed | Pending |
| M-16 | MED    | platform-ops-agent/platform-ops-agent-service.ts          | OpsActionType missing §69.1 restart_service and failover tools | Unfixed | Pending |
| M-17 | LOW    | platform-ops-agent/self-healing-service.ts                | performHealingOperation uses Math.random() to simulate success/failure, §69.3 requires all write operations bind runbook+approval | Unfixed | Pending |
| M-18 | LOW    | drift-detection/index.ts                                  | Module header says "Evolution Engine" focused on self-improvement, §63 defines "behavior drift detection", terminology misleading | Unfixed | Pending |
| M-19 | LOW    | emergency/forensic-snapshot/index.ts                      | ForensicSnapshot missing plane evidence references, §60.2 requires each plane to return PanicAcknowledgment containing plane/localStopState/evidenceRef | Unfixed | Pending |
| M-20 | LOW    | capacity-planner/capacity-planning-service.ts             | CapacityRecommendation missing §67.2 required SLA tier/queue delay/budget/approval capacity/provider quota/Region failover reserve | Unfixed | Pending |

---

## 9. OAPEFLIR v4.4 Spec vs Main Architecture Document (25 items)

| #    | Severity | Spec Section vs Architecture Section              | Deviation Description | Status | Closure Evidence |
| ---- | ------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| F-1 | HIGH   | Spec§0 vs Arch§13.1           | Spec positions OAPEFLIR as "production-grade Agent Runtime" containing independent OapeflirRuntime; architecture explicitly states "OAPEFLIR is not an execution engine" only cognitive/governance semantic framework | Unfixed | Pending |
| F-2 | HIGH   | Spec§4.1 vs Arch§45.22/§5.5   | Spec defines OapeflirRun as canonical run entity with complete status/budget; architecture declares HarnessRun as the only authoritative Run, OapeflirRun listed in Appendix H deprecated aliases | Unfixed | Pending |
| F-3 | HIGH   | Spec§4.2 vs Arch§13.1 invariant #4 | Spec defines OAPEFLIR-owned RunStatus 15 states driving execution; architecture forbids OAPEFLIR from owning run status/lease/retry counter/side effect commit/budget state | Unfixed | Pending |
| F-4 | HIGH   | Spec§3 vs Arch§45.1           | Spec presents "OAPEFLIR Runtime" as top-level execution runtime; architecture says HarnessRuntime is the only executable runtime entry | Unfixed | Pending |
| F-5 | HIGH   | Spec§14 vs Arch§28            | Spec uses run._/node._/side_effect._ as OAPEFLIR events; architecture mandates OAPEFLIR only uses oapeflir.view._/oapeflir.rationale.* | Unfixed | Pending |
| F-6 | HIGH   | Spec§12 vs Arch§14/§45        | Spec places Graph Scheduler inside OAPEFLIR Runtime; architecture places it under P4 execution plane HarnessRuntime jurisdiction | Unfixed | Pending |
| F-7 | HIGH   | Spec§20.2 vs Arch§8           | Spec assumes LLM can deterministically replay (reexecute_with_same_seed); architecture explicitly "does not assume LLM can deterministically replay", default Trace Replay | Unfixed | Pending |
| F-8 | HIGH   | Spec§34 vs Arch§6.2/§58       | Spec uses OAPEFLIR.* error code namespace; architecture mandates PLATFORM.{plane}.{component}.{category} and forbids OAPEFLIR from entering error code namespace | Unfixed | Pending |
| F-9 | MED    | Spec§5.2 vs Arch§14           | Spec defines 13 NodeRunStatuses including compensating/compensated under OAPEFLIR jurisdiction; architecture canonical definition is under HarnessRuntime, ownership conflict | Unfixed | Pending |
| F-10 | MED    | Spec§7.3 vs Arch§13.8         | PlanNode field name Spec uses type (14 types), architecture uses kind | Unfixed | Pending |
| F-11 | MED    | Spec§15 vs Arch§18.3          | Spec places BudgetLedger under OAPEFLIR ownership with direct reservation semantics; architecture BudgetReservation belongs to P5/Budget service | Unfixed | Pending |
| F-12 | MED    | Spec§16 vs Arch§14.11         | Spec places SideEffectManager inside OAPEFLIR Runtime; architecture places it under P4 execution plane HarnessRuntime governance | Unfixed | Pending |
| F-13 | MED    | Spec§39 vs Arch§35            | Spec suggests all runtime code in src/platform/oapeflir/; architecture recommends Harness-centered directory structure, OAPEFLIR is only trace/projection adapter | Unfixed | Pending |
| F-14 | MED    | Spec§42 vs Arch§8 version         | Spec claims v4.4 is core Runtime design baseline; architecture v4.3 demotes v4.4 Spec to "migration input" not authoritative baseline | Unfixed | Pending |
| F-15 | MED    | Spec§24 vs Arch§45.25         | Spec's DecisionInputBundle missing hitlState/nodeState; architecture additionally contains riskState/guardrailFindings | Unfixed | Pending |
| F-16 | MED    | Spec§19 vs Arch§45.24         | Spec contains observe/summarizer prompt roles; architecture only recognizes Planner/Generator/Evaluator | Unfixed | Pending |
| F-17 | MED    | Spec§25 vs Arch§14.8/§42      | Spec defines 5 RuntimeProfile levels (core/durable/governed/enterprise/learning) as OAPEFLIR built-in; architecture §14.8/§42 are independent definitions | Unfixed | Pending |
| F-18 | LOW    | Spec§26 vs Arch§45.27         | Spec lists 6 HITL capabilities; architecture §45.27 additionally contains reject | Unfixed | Pending |
| F-19 | LOW    | Spec§23 vs Arch§45.20         | Both define 5 Guardrail layers but Spec places under OAPEFLIR governance, architecture places under Harness §45.20 + P2 control plane | Unfixed | Pending |
| F-20 | LOW    | Spec§22 vs Arch§45.16         | Spec defines 6 Memory scopes; architecture uses 3-layer model (Working/Long-term/Shared Knowledge), different taxonomy | Unfixed | Pending |
| F-21 | LOW    | Spec§35 vs Arch§58.1          | Spec uses oapeflir.run._ metric prefix; architecture uses harness.run._ | Unfixed | Pending |
| F-22 | LOW    | Spec§40 vs Arch§33            | Spec uses 4-stage delivery (A-D); architecture uses 3-ring model (MVP/Hardening/Enterprise) | Unfixed | Pending |
| F-23 | LOW    | Spec§7.1 vs Arch§5.3/§13.8    | Spec contains generatedBy containing repair_worker; architecture PlanGraphBundle has no such field, source tracked through evidence refs | Unfixed | Pending |
| F-24 | LOW    | Spec§30 vs Arch§45.3          | Spec lists 9 policy priority levels; architecture ConstraintPack uses 4-level merge (platform<tenant<business domain<task) | Unfixed | Pending |
| F-25 | LOW    | Spec§2 Execute output            | Spec Execute phase outputs ExecutionReceipt; architecture marks as deprecated, canonical is NodeAttemptReceipt | Unfixed | Pending |

## 10. interaction Code vs Architecture (20 items)

| #    | Severity | Location                              | Deviation Description | Status | Closure Evidence |
| ---- | ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| I-1 | HIGH   | nl-gateway/index.ts               | No TaskDraft/ClarificationState/UserConfirmationReceipt pre-entry objects, buildTask() directly jumps to RequestEnvelope bypassing §39.2 entry pipeline | Unfixed | Pending |
| I-2 | HIGH   | nl-gateway/index.ts:414           | Default clarification threshold 0.7, §39.3 mandates intent_confidence_threshold=0.80/slot_confidence_threshold=0.85 | Unfixed | Pending |
| I-3 | HIGH   | nl-gateway/index.ts               | No multi-turn conversation state machine (Idle→IntentParsing→Clarifying→Building→Confirming→Executing→Reporting) §39.5 requires | Unfixed | Pending |
| I-4 | HIGH   | nl-gateway/                       | NL pipeline has no Prompt Injection defense, violating §39.6 security constraint (referencing §16.5) | Unfixed | Pending |
| I-5 | HIGH   | nl-gateway/index.ts               | Missing §39.3 required ContextEnricher/ResponseFormatter components | Unfixed | Pending |
| I-6 | HIGH   | nl-gateway/index.ts:71            | DetectedIntent.intentType contains "system_config" with no architecture counterpart definition | Unfixed | Pending |
| I-7 | MED    | goal-decomposer/index.ts          | No GoalLifecycleState state machine (draft→decomposing→decomposed→executing→completed…) §40.5 requires | Unfixed | Pending |
| I-8 | MED    | goal-decomposer/index.ts          | Outputs tasks/dependencyGraph but does not produce §40.2 required GoalGraphDraft/TaskGraphDraft, no draft→planner handover | Unfixed | Pending |
| I-9 | MED    | goal-decomposer/index.ts          | Decomposition has no budget/risk/permission/capability constraint propagation (§40.2), only post-hoc buildRiskSummary | Unfixed | Pending |
| I-10 | HIGH   | proactive-agent/index.ts:5        | TriggerDefinition.type uses "threshold" not architecture "condition" (§41.2: schedule/event/condition/webhook); "webhook_inbound" vs "webhook" | Unfixed | Pending |
| I-11 | MED    | proactive-agent/index.ts          | No ProactiveBudgetPool or UserInitiatedReserveRatio (≥60%) enforcement (§41.4) | Unfixed | Pending |
| I-12 | MED    | proactive-agent/index.ts          | No feedback loop detection between triggers (§41.4 requires detection of mutual trigger loops and creating incident) | Unfixed | Pending |
| I-13 | MED    | proactive-agent/index.ts:43       | TriggerDefinition missing §41.2 required maxFireCount/boundAgentId fields | Unfixed | Pending |
| I-14 | HIGH   | dashboard/                        | No MetricRegistry containing metric_owner/freshness_slo/stale_behavior/redaction (§43.1) | Unfixed | Pending |
| I-15 | MED    | dashboard/                        | NL summary generation has no evidence_refs/freshness/confidence/redaction_policy/source_projection_version metadata (§43.6) | Unfixed | Pending |
| I-16 | MED    | dashboard/                        | No dashboard operation risk gate (§43.6): buttons should not directly trigger high-risk commands | Unfixed | Pending |
| I-17 | MED    | autonomy/trust-scorer/index.ts:14 | TrustLevel 6-value enum has no formal mapping bridge to architecture §42.2 autonomy levels (suggestion/supervised/semi_auto/full_auto) | Unfixed | Pending |
| I-18 | MED    | autonomy/                         | No TrustDecayWorker or daily decay mechanism (§42.3); no AutonomyChangeImpactReport before degradation (§42.4) | Unfixed | Pending |
| I-19 | MED    | ux/workflow-builder-service.ts    | Visual workflow builder does not execute §44.3 required PlanGraph Normalize/Validate/RiskPropagation/WorstPathAnalysis before saving | Unfixed | Pending |
| I-20 | LOW    | nl-gateway/index.ts               | deriveUrgency maps "critical" keyword to "high" not "critical", underestimating urgency | Unfixed | Pending |

## 11. domains + SDK Code vs Architecture (20 items)

| #    | Severity | Location                                                  | Deviation Description | Status | Closure Evidence |
| ---- | ------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| D-1 | HIGH   | domains/canonical-meta-model/types.ts                 | Meta-model only 12 questions (Q1-Q12), architecture §37.11 requires 15 questions (missing Q13 liability_owner/Q14 compensation_model/Q15 adversarial_scenarios) | Unfixed | Pending |
| D-2 | HIGH   | sdk/pack-sdk/pack-manifest.ts                         | BusinessPackManifest missing §30.2 mandatory fields: domain_id (uses domain)/side_effects/data_classes/max_risk_class/tools/connectors/plugins/eval_requirements/compatibility | Unfixed | Pending |
| D-3 | HIGH   | domains/registry/domain-model.ts:77                   | Domain status enum draft/testing/active/deprecated does not match §37.10 lifecycle Draft/Validated/Registered/Active/Updating/Deprecated/Archived | Unfixed | Pending |
| D-4 | HIGH   | domains/(missing)                                        | Architecture §37.2 v4.3 decomposition specification (DomainCoreDescriptor/DomainExecutionProfile/DomainRiskSpec/DomainKnowledgeSpec/DomainEvalSpec/DomainGovernanceSpec/DomainInteractionSpec) has no type implementation | Unfixed | Pending |
| D-5 | HIGH   | sdk/(missing)                                            | Architecture §22.1 requires 4-layer SDK; Admin SDK completely missing | Unfixed | Pending |
| D-6 | HIGH   | domains/domain-descriptor-orchestration-service.ts:15 | lifecycleState enum contains validating/certified/canary not in §37.10 state machine; missing registered/updating/archived | Unfixed | Pending |
| D-7 | MED    | sdk/plugin-sdk/plugin-definition.ts:9                 | PluginType contains "presenter" not in architecture §22.1 (tool/adapter/retriever/evaluator) | Unfixed | Pending |
| D-8 | MED    | domains/registry/domain-model.ts:60                   | PluginBinding.pluginType enum retriever/validator/planner/presenter/adapter does not match architecture tool/adapter/retriever/evaluator | Unfixed | Pending |
| D-9 | MED    | domains/recipes/index.ts:3                            | DomainRecipe missing archetype field, architecture §37.7 defines 12 recipe archetypes without enum or type | Unfixed | Pending |
| D-10 | MED    | sdk/client-sdk/api-client.ts                          | No typed methods for canonical API endpoints (/api/v1/harness-runs, /api/v1/packs, abort/pause per §6) | Unfixed | Pending |
| D-11 | MED    | domains/governance/domain-governance-policy.ts        | Missing §37.9 governance fields: slo_profile/budget_constraints/max_hibernation_renewals/compliance_rules/recertification/waiver | Unfixed | Pending |
| D-12 | MED    | domains/operations/index.ts:3                         | Onboarding stages modeling/development_validation/security_certification/canary_launch do not align with §37.10+§38 runbook | Unfixed | Pending |
| D-13 | MED    | sdk/pack-sdk/pack-manifest.ts:3                       | BusinessPackCapability uses informal maturity field instead of architecture §30.2 PackCapabilityProfile structure | Unfixed | Pending |
| D-14 | MED    | domains/(missing)                                        | No execution_mode/hot_path_mode/planning_mode fields, §37.2 requires for deterministic hot path enforcement | Unfixed | Pending |
| D-15 | MED    | sdk/pack-sdk/pack-manifest.ts:17                      | validateBusinessPackManifest does not validate domain_id points to Active DomainDescriptor (§30.2) | Unfixed | Pending |
| D-16 | LOW    | sdk/workbench/index.ts:134                            | Preview URL uses old /tasks and /approvals paths not canonical /harness-runs (§6) | Unfixed | Pending |
| D-17 | LOW    | sdk/plugin-sdk/plugin-definition.ts:29                | PluginDefinition missing §22.4 PluginManifest fields: spiTypes/domainIds/SBOM/signing | Unfixed | Pending |
| D-18 | LOW    | sdk/pack-sdk/pack-scaffold-service.ts                 | Scaffold does not generate domain lint/domain validate integration, §37 requires passing domain lint before Gate 2 | Unfixed | Pending |
| D-19 | LOW    | sdk/harness-sdk/index.ts:16                           | HarnessSdkAppendStepInput uses old stage/inputs/outputs terminology not canonical nodeRunId/planGraphId (§5/§45) | Unfixed | Pending |
| D-20 | LOW    | domains/registry/domain-registry-service.ts:64        | activate() transitions from any state directly to active, missing §37.10 required Draft→Validated→Registered→Active path guard | Unfixed | Pending |

## 12. Contract Docs vs Architecture (3rd batch, 25 items)

| #    | Severity | Contract File                                      | Deviation Description | Status | Closure Evidence |
| ---- | ------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| T-32 | HIGH   | transition_service_contract                        | TransitionCommand.entity_kind uses pre-v4.3 types (task/workflow/session/approval/execution), architecture §5.3 uses harness_run/node_run/side_effect/budget_reservation | Unfixed | Pending |
| T-33 | HIGH   | storage_schema_contract                            | Core tables (tasks/workflow_state/executions) have no mapping to v4.3 canonical objects (HarnessRun/NodeRun/PlanGraphBundle), missing corresponding tables or migration paths | Unfixed | Pending |
| T-34 | HIGH   | storage_schema_contract                            | memories table DDL omits contract's own §13 declared minimum columns: layer_level/token_budget/freshness_state/source_refs_json | Unfixed | Pending |
| T-35 | HIGH   | monetization_metering_plane_contract               | Introduces BillingLedger/LedgerEntry but architecture §18 uses BudgetLedger/BudgetSettlement as frozen contract (§1.5), naming collision | Unfixed | Pending |
| T-36 | HIGH   | marketplace_catalog_and_revenue_contract           | Defines RevenueSharePolicy containing settlement/split fields, architecture §55.4 explicitly states "revenue sharing/billing settlement is not part of core runtime architecture" prohibits affecting Pack execution/security | Unfixed | Pending |
| T-37 | HIGH   | idempotency_and_recovery_matrix_contract           | Entire document uses "workflow step"/"step" terminology (§4 Step-level matrix), architecture v4.3 §5.5 declares NodeRun/NodeAttempt as canonical, stepId is only legacy projection | Unfixed | Pending |
| T-38 | MED    | plugin_spi_contract                                | DomainPlannerPlugin.plan() returns Plan not canonical PlanGraphBundle; §7 OAPEFLIR table uses "Rollout" not "Release" | Unfixed | Pending |
| T-39 | MED    | trace_and_root_cause_observability_contract        | "One task = one trace", architecture §5.5 declares HarnessRun as canonical run truth; should be "one HarnessRun = one trace" | Unfixed | Pending |
| T-40 | MED    | billing_and_tenant_contract                        | Uses UsageMeter not architecture §18.1 UsageRecord; does not reference frozen BudgetLedger/BudgetReservation | Unfixed | Pending |
| T-41 | MED    | cost_and_budget_contract                           | BudgetPolicy only has max_task/daily/monthly_cost_usd, architecture §18.3 mandates multi-dimensional: max_cost/max_model_tokens/max_context_tokens/max_output_tokens/max_steps/max_duration_ms | Unfixed | Pending |
| T-42 | MED    | cross_region_routing_and_data_residency_contract   | RegionDescriptor missing provider/endpoints/dataResidencyPolicy (§52.1); missing write boundary rules CAS/Lease/Fencing (§52.3) | Unfixed | Pending |
| T-43 | MED    | marketplace_catalog_and_revenue_contract           | lifecycle_state uses draft/submitted/certified/published/deprecated/retired, architecture §55.5 uses active/deprecated/sunset/removed, incompatible | Unfixed | Pending |
| T-44 | MED    | sso_scim_and_identity_sync_contract                | Missing architecture §48.2 required identity_sync_dlq; omits SAML 2.0 (architecture marks as "required") | Unfixed | Pending |
| T-45 | MED    | edge_runtime_and_sync_contract                     | Missing architecture §8.3 required EdgeRuntime declarations stateful=true/lease_migration_supported/checkpoint_required_before_preempt | Unfixed | Pending |
| T-46 | MED    | node-run-attempt-receipt-contract                  | Receipt primary key field is nodeAttemptReceiptId, architecture §5.3 NodeAttemptReceipt uses receiptId | Unfixed | Pending |
| T-47 | MED    | observability_contract                             | RuntimeMetricsSummary uses oapeflirMetrics.convergenceRate as top-level metric, architecture §5.5/§13 declares OAPEFLIR is only projection/trace not truth | Unfixed | Pending |
| T-48 | MED    | token_budget_allocation_contract                   | Defines 10 budget dimensions including KV cache partition but does not reference frozen BudgetReservation state machine (reserved→settled→released) | Unfixed | Pending |
| T-49 | MED    | supply_chain_and_dependency_security_contract      | Missing architecture §11.7 PluginTrustStore requirements: trust root/signing key rotation/revocation list/security advisory/quarantine/tenant impact | Unfixed | Pending |
| T-50 | LOW    | enterprise_secret_management_contract              | Mentions short-term credentials but does not enforce architecture §11.3 hard TTL ceiling "secret injection short-term valid (TTL≤300s)" | Unfixed | Pending |
| T-51 | LOW    | tenant_isolation_and_shared_worker_safety_contract | No architecture §9.1 automatic isolation threshold (failure rate >30% + min_sample_size), only qualitative rules without quantitative trigger | Unfixed | Pending |
| T-52 | LOW    | tool_output_sanitization_contract                  | Uses "Phase 1a" terminology, architecture §1.4/§33 declares "old Phase 1-9 only as historical schedule mapping" deprecated | Unfixed | Pending |
| T-53 | LOW    | cost_attribution_and_optimization_contract         | CostAttributionRecord.decision_ref is generic string, architecture requires traceable to HarnessRun/NodeRun/BudgetSettlement | Unfixed | Pending |
| T-54 | LOW    | approval_and_hitl_contract                         | Still uses OapeflirStage as first-class stage_ref field, architecture §5.5 invariant "oapeflir.* events must not be used as truth source" | Unfixed | Pending |
| T-55 | LOW    | monetization_metering_plane_contract               | UsageEvent.source enum (runtime/api/gateway/admin) missing tool/model/side_effect, architecture §18.1 cost_source includes provider_invoice/internal_compute/human_review/storage/egress | Unfixed | Pending |
| T-56 | LOW    | runtime_repository_and_migration_contract          | Repository methods (markExecutionStarted etc.) directly operate executions table, architecture §5.3 mandates all state transitions through RuntimeStateMachine.transition() | Unfixed | Pending |

## 13. ADR vs Architecture (2nd batch, 25 items)

| #    | Severity | ADR            | Deviation Description | Status | Closure Evidence |
| ---- | ------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| A-13 | HIGH   | ADR-021        | Uses deprecated ControlDirective as canonical P2→P3 contract; architecture §5.2 splits into OperationalDirective/DecisionDirective | Unfixed | Pending |
| A-14 | HIGH   | ADR-021        | Uses deprecated ExecutionPlan containing linear steps[] as P3→P4 contract; architecture §5.3 mandates PlanGraphBundle | Unfixed | Pending |
| A-15 | HIGH   | ADR-021        | Uses deprecated ExecutionReceipt as P4→P3 result; architecture §5.3 mandates NodeAttemptReceipt (attemptId+nodeRunId) | Unfixed | Pending |
| A-16 | HIGH   | ADR-027        | Principal types include pack/tenant instead of worker/plugin; architecture §11.1 canonical set is user/service/agent/worker/plugin/system | Unfixed | Pending |
| A-17 | HIGH   | ADR-027        | Sandbox levels SANDBOX_NONE/SANDBOX_READonly/SANDBOX_NETWORK_ISOLATED/SANDBOX_FULL completely different from architecture §11.4; SANDBOX_NONE violates default-deny | Unfixed | Pending |
| A-18 | HIGH   | ADR-026        | Risk model 6 factors (stepTypeRisk/targetSystemRisk etc.) names and weights all differ from architecture §10.2 8 factors | Unfixed | Pending |
| A-19 | HIGH   | ADR-025        | PolicyMode contains supervised/degraded/maintenance/emergency which do not exist in architecture §9.5/§14.8 canonical set | Unfixed | Pending |
| A-20 | HIGH   | ADR-073        | Uses tasks/workflow/execution/ExecutionEnvelope as canonical resources; architecture §5.5 mandates HarnessRun/NodeRun/PlanGraphBundle | Unfixed | Pending |
| A-21 | HIGH   | ADR-004        | Uses v3 "VP Operations/VP Orchestration/Business Unit/Lead Agent/CEO" agent hierarchy; architecture v4.3 replaces with five planes + HarnessRuntime | Unfixed | Pending |
| A-22 | MED    | ADR-005        | Runtime modes supervised/auto/full-auto do not match architecture §14.8 canonical 8-type enum | Unfixed | Pending |
| A-23 | MED    | ADR-064        | CostDimension uses deprecated workflow_id/step_id; architecture §12.4/§5.5 mandates harnessRunId/nodeRunId | Unfixed | Pending |
| A-24 | MED    | ADR-052        | Lists sync replication mode RPO=0; architecture §25.11 explicitly "v4.2 does not commit to multi-master truth writes" only async | Unfixed | Pending |
| A-25 | MED    | ADR-058        | Emergency stop levels L0-L4 do not reference PlatformPanicDirective or OperationalDirective(type=kill) architecture §5.2/§60 formal mechanism | Unfixed | Pending |
| A-26 | MED    | ADR-098        | Uses waiting_hitl as NodeRun state; architecture §14.10/§25.8 canonical is awaiting_hitl | Unfixed | Pending |
| A-27 | MED    | ADR-066-plugin | DomainPlannerPlugin.plan() returns Promise<Plan>; architecture mandates PlanGraphBundle | Unfixed | Pending |
| A-28 | MED    | ADR-040        | Goal lifecycle 9 states does not align with HarnessRun §25.8 13-state state machine | Unfixed | Pending |
| A-29 | MED    | ADR-073        | Entire document uses "phase1-4"; architecture §33 declares old Phase naming is only historical mapping, mandates Ring 1/2/3 | Unfixed | Pending |
| A-30 | MED    | ADR-094        | References "phase 8b" as delivery gate; same phase naming contradiction | Unfixed | Pending |
| A-31 | MED    | ADR-099        | References "phase 8c"; same as above | Unfixed | Pending |
| A-32 | MED    | ADR-037        | DomainClass only 7 types; architecture §1/§30 covers 24 vertical domains, missing 17 domain classifications | Unfixed | Pending |
| A-33 | LOW    | ADR-092        | Uses "step"/"decision" to record timeline; architecture canonical is NodeRun/NodeAttempt, HarnessStep is only semantic projection | Unfixed | Pending |
| A-34 | LOW    | ADR-042        | Autonomy level 4 full_auto implies unrestricted; architecture §3.2 prohibits high-risk domains from full_auto unless explicit DomainRiskSpec | Unfixed | Pending |
| A-35 | LOW    | ADR-075        | Rollout L1 naming shadow conflicts with deprecated ADR-018 L2 shadow, level numbering inconsistent | Unfixed | Pending |
| A-36 | LOW    | ADR-066-plugin | Plugin isolation described as Worker threads; architecture §11.7 requires untrusted plugins use separate process + IPC boundary | Unfixed | Pending |
| A-37 | LOW    | ADR-093        | ConstraintPack only contains risk_policy+output_policy; architecture §13.4/§14.2 requires containing budget envelope/sandbox requirement/approval requirement | Unfixed | Pending |

## Original Final Systemic Themes (historical snapshot, currently unfixed)

The following themes are the original final audit's risk induction, retained for historical traceability; currently all corresponding IDs have been reopened, uniformly marked as `unfixed`, direct evidence paths require item-by-item completion.

1. **OAPEFLIR Identity Crisis (Most Severe)**: v4.4 Spec treats it as complete Runtime owning Run/Status/Budget/Events/ErrorCodes/GraphScheduler/SideEffectManager; main architecture explicitly demotes it to cognitive projection layer. ADRs/contracts/code each take sides, entire system has no consensus on "who drives execution"
2. **v3→v4 Terminology Migration Not Executed**: ~60% of contracts and ~40% of ADRs still use v3 terms task/workflow/execution/step/Rollout/ControlDirective/ExecutionPlan/ExecutionReceipt, architecture has renamed all
3. **State Machine Fragmentation**: HarnessRun defined as 5/6/7/13/15 states in different locations; NodeRun has 5/9/13 state variants; no single source of truth
4. **Critical Security Default-Allow**: delegated-governance unknown types allowed, sandbox tier includes NONE, autonomy upgrade has no risk gate, panic recovery lacks two-person verification
5. **Complete Modules/Field Groups Missing**: Admin SDK, CapacityPlanning, CostAttribution, LegalEntityBoundary, RevenueShare implementation, DomainRiskSpec 7 sub-specs, 15-question meta-model, etc.
6. **Systematic Insufficient Defense Depth**: prompt injection/sandbox/drift/compliance/edge-sync all only implement single layer, architecture requires 3-5 layers
7. **Config-schema-architecture Three-way Disconnect**: domain config JSON fields, Zod schema, architecture definition all mutually mismatched
8. **Contract Internal Inconsistency**: storage_schema memories table DDL omits its own §13 declared columns; harness-run-contract internal §45.13 vs §25.8 state count differs
9. **Canonical Object Identifiers Not Unified**: context/trace/billing/cost each use different keys (task_id/execution_id/workflow_id vs harnessRunId/nodeRunId/attemptId)
10. **Delivery Milestone Terminology Divided**: some documents use Phase 1-9, some use Ring 1/2/3, some use A/B/C/D, three naming systems coexist
