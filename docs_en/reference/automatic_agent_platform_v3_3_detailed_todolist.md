# Automatic Agent Platform v3.3 — Engineering Implementation Detailed TodoList

> **Document Version**: v1.1
> **Generated Date**: 2026-06-01
> **Baseline Version**: v3.2 Final Release — Family Leadership Readiness & Claim Gate
> **Target Version**: v3.3 — Division Governance Implementation & P0 Pilot Launch
> **Objective**: Land the v3.2 governance and assessment baseline into repository, configuration, CI, Dashboard, and 3 P0 Pilots, forming an engineering closed loop that is scannable, evaluable, red-teamable, and ROI-provable.
> **Scope Boundary**: This TodoList does not require all Families to immediately achieve industry leadership; v3.3's objective is to make the industry-leading governance system run realistically, and complete the minimum closed loop for Engineering / Knowledge / Customer Service three P0 Pilots.

> **Implementation Status (2026-06-01)**: WS0–WS16 have been landed in the repository; all explicitly defined P0 / P1 executable items in this TodoList have been completed. This document does not separately define new P2 deliverables; P2 in this version still indicates a "subsequent enhancement" classification and does not constitute an additional delivery list. v3.3 current status is `implementation baseline + P0 pilot launch ready`, not a full `industry-leading` claim version.

---

## 0. Overall Execution Principles

### 0.1 No Longer Continuously Expanding Documentation Horizontally

The next stage's focus is not to continue adding large documents, but:

```text
SOT
→ Inventory Scanner
→ CoverageCard Generator
→ P0 ScenarioCard
→ Eval / Red-team / ToolRisk / TrainingDataPolicy
→ CI Gate
→ P0 Pilot
→ Dashboard
→ Leadership Claim Gate
```

### 0.2 Priority Definition

| Priority | Meaning | Blocking Scope |
|---|---|---|
| P0 | Must be completed for v3.3 release | Blocks v3.3 RC |
| P1 | Can be partially completed in v3.3 but needs backlog | Does not block RC, but blocks final or v3.4 |
| P2 | Subsequent enhancement | Does not block v3.3 |

### 0.3 v3.3 Only Does 3 P0 Pilots

| Pilot | Covered Division | v3.3 Goal |
|---|---|---|
| Engineering Pilot | coding + qa/devops/security sub-capabilities | issue / CI failure → patch → tests → PR draft |
| Knowledge Pilot | knowledge-base + research | source reliability → citation verification → evidence graph → conclusion |
| Customer Service Pilot | customer-service + support | customer message → policy lookup → tool action draft → HITL → response / handoff |

### 0.4 Items Not Yet Done

The following items do not enter v3.3 mainline to avoid scope explosion:

```text
legal / healthcare / finance / HR automatic high-impact actions
Automatic trading / payment / refund without approval
Full CRM auto-write
Full desktop computer-use
Full Figma / asset production automation
All divisions synchronized production-ready
Online editing of CoverageCard / policy / release gate
```

---

## 1. Milestone Overview

| Milestone | Suggested Time | Goal | Key Deliverable |
|---|---|---|---|
| M1 | Weeks 1–2 | Establish SOT and real division inventory | scanner, inventory JSON, aliases |
| M2 | Weeks 3–4 | Generate CoverageCard / FamilyPolicy / ScenarioCard drafts | YAML registry, schema, warning-only CI |
| M3 | Weeks 5–8 | Launch 3 P0 Pilot eval / red-team / tool risk | eval datasets, redteam suite, tool descriptors |
| M4 | Weeks 9–12 | Integrate P0 blocking CI, read-only Admin Console, ROI baseline | CI gate, dashboard, pilot report |
| M5 | Week 13 | v3.3 Release Candidate | release-readiness report |

---

## 2. Workstream Summary Table

| Workstream | Name | Priority | Suggested Owner |
|---|---|---:|---|
| WS0 | v3.2 Release Baseline Verification | P0 | Architecture Owner |
| WS1 | Division Inventory Scanner | P0 | Platform Infra Owner |
| WS2 | SOT / Schema / Registry | P0 | Governance Owner |
| WS3 | CoverageCard Generator | P0 | Platform Infra Owner |
| WS4 | BusinessScenarioCard Registry | P0 | Product / Domain Owner |
| WS5 | ToolAction R0–R5 Risk System | P0 | Security Owner |
| WS6 | EvalDatasetCard and Eval Suite | P0 | Eval Owner |
| WS7 | Red-team Suite and Severity | P0 | Security / Red-team Owner |
| WS8 | TrainingDataPolicy and Revocation | P0 | Data Governance Owner |
| WS9 | CI Gate Integration | P0 | DevOps Owner |
| WS10 | P0 Engineering Pilot | P0 | Engineering Agent Owner |
| WS11 | P0 Knowledge Pilot | P0 | Knowledge Platform Owner |
| WS12 | P0 Customer Service Pilot | P0 | Enterprise Ops Owner |
| WS13 | ROI / Dashboard / Evidence Package | P0 | Ops Analytics Owner |
| WS14 | Admin Console Read-only Version | P1 | UI Owner |
| WS15 | Leadership Claim Scanner | P1 | Governance Owner |
| WS16 | v3.3 Release Readiness | P0 | Release Owner |

## 2.1 TODO Completion Matrix

| TODO | Priority | Current Status | Note |
|---|---|---|---|
| TODO-0001 | P0 | done | Unique v3.2 release document and docs index / root guide index have been closed |
| TODO-0002 | P0 | done | v3.2 baseline verification has been landed |
| TODO-0101 | P0 | done | inventory scanner / generated report / diff can run |
| TODO-0102 | P0 | done | division inventory schema has been landed and used for validation |
| TODO-0103 | P0 | done | alias map has been landed and incorporated into scanner |
| TODO-0201 | P0 | done | division coverage SOT has been landed |
| TODO-0202 | P0 | done | 6 FamilyPolicies have been landed |
| TODO-0203 | P0 | done | Core schema has been landed |
| TODO-0301 | P0 | done | CoverageCard generator supports write/check |
| TODO-0302 | P0 | done | EvidenceScore / EvidenceRefs / lastUpdatedAt have been landed |
| TODO-0401 | P0 | done | 6 P0 ScenarioCards have been landed |
| TODO-0501 | P0 | done | ToolAction risk taxonomy has been landed |
| TODO-0502 | P0 | done | P0 tool action descriptors fully covered |
| TODO-0503 | P0 | done | ToolGateway runtime enforcement + tests integrated |
| TODO-0601 | P0 | done | EvalDatasetCard schema has been landed |
| TODO-0602 | P0 | done | SWE-style eval baseline has been landed |
| TODO-0603 | P0 | done | Knowledge citation/source eval baseline has been landed |
| TODO-0604 | P0 | done | Customer Service τ-style eval baseline has been landed |
| TODO-0701 | P0 | done | RedTeam severity schema has been landed |
| TODO-0702 | P0 | done | Engineering AWI red-team suite has been landed |
| TODO-0703 | P0 | done | Knowledge red-team suite has been landed |
| TODO-0704 | P0 | done | Customer Service red-team suite has been landed |
| TODO-0801 | P0 | done | P0 TrainingDataPolicy covered |
| TODO-0802 | P0 | done | Data Revocation Policy has been landed |
| TODO-0901 | P0 | done | warning-only governance audit can be reproduced locally |
| TODO-0902 | P0 | done | P0 blocking gate has been landed with test coverage |
| TODO-0903 | P1 | done | production-ready gate implemented, remains non-RC-blocking |
| TODO-1001 | P0 | done | Engineering pilot workflow / scenario / docs have been landed |
| TODO-1002 | P0 | done | PatchGate initial version implemented and exports structured report |
| TODO-1003 | P0 | done | Engineering pilot metrics report has been landed |
| TODO-1101 | P0 | done | Knowledge pilot workflow / scenario / docs have been landed |
| TODO-1102 | P0 | done | CitationVerifier initial version implemented |
| TODO-1103 | P0 | done | Knowledge pilot metrics report has been landed |
| TODO-1201 | P0 | done | Customer Service pilot workflow / scenario / docs have been landed |
| TODO-1202 | P0 | done | Policy adherence evaluator initial version implemented |
| TODO-1203 | P0 | done | Customer Service pilot metrics report has been landed |
| TODO-1301 | P0 | done | ROI measurement protocol has been landed |
| TODO-1302 | P0 | done | P0 ROI config has been landed |
| TODO-1303 | P0 | done | 3 leadership evidence packages have been landed |
| TODO-1401 | P1 | done | Admin Console read-only spec has been landed |
| TODO-1402 | P1 | done | Division Inventory read-only page integrated |
| TODO-1501 | P1 | done | claim scanner + allowlist / false-positive governance integrated |
| TODO-1601 | P0 | done | v3.3 release-readiness report has been landed |
| TODO-1602 | P0 | done | RC gate conditions covered by assets and governance scripts |

---

# 3. WS0 — v3.2 Release Baseline Verification

## Current Status

| Workstream | Status | Key Deliverable |
|---|---|---|
| WS0 | done | `docs_zh/reviews/v3_2_release_baseline_verification.md` |
| WS1 | done | `scripts/ci/audit-division-inventory.mjs` |
| WS2 | done | `docs_zh/governance/division-coverage-sot.md` |
| WS3 | done | `scripts/generate-division-coverage-cards.mjs` |
| WS4 | done | `config/division-coverage/scenarios/*.yaml` |
| WS5 | done | `config/tool-risk/*` + runtime enforcement |
| WS6 | done | `eval/schemas` + `eval/divisions/*` |
| WS7 | done | `redteam/severity.schema.json` + `redteam/divisions/*` |
| WS8 | done | `training-data-policy/*` |
| WS9 | done | `scripts/ci/audit-domain-coverage.mjs` + CI workflow |
| WS10 | done | `docs_zh/pilots/engineering-pilot.md` + `patch-gate.ts` |
| WS11 | done | `docs_zh/pilots/knowledge-pilot.md` + `citation-verifier.ts` |
| WS12 | done | `docs_zh/pilots/customer-service-pilot.md` + `policy-adherence-evaluator.ts` |
| WS13 | done | `roi/*` + leadership evidence packages |
| WS14 | done | `ui/packages/features/division-inventory/` |
| WS15 | done | `audit-leadership-claims.mjs` warning scanner |
| WS16 | done | `docs_zh/releases/automatic_agent_platform_v3_3_release_readiness.md` |

## TODO-0001: Confirm unique release document exists

- **Priority**: P0
- **Owner**: Architecture Owner
- **Deliverable**: `docs_zh/reference/automatic_agent_platform_v3_2_final_release.md`
- **Acceptance Criteria**:
  - Repository retains only one v3.2 final release document.
  - No duplicate versions such as `fixed`, `copy`, `rc`, or `draft` exist.
  - README / AGENTS / CLAUDE / docs index point to the unique release document.
- **Blocking Conditions**:
  - Multiple release files for the same version.
  - Document path not included in docs index.

## TODO-0002: Verify v3.2 document claims match actual repository status

- **Priority**: P0
- **Owner**: Architecture Owner
- **Deliverable**: `docs_zh/reviews/v3_2_release_baseline_verification.md`
- **Acceptance Criteria**:
  - Clarify which content has been implemented and which are only v3.3 design goals.
  - Documentation must not imply current system is already industry-leading.
  - Clarify v3.2 is governance baseline, not capability certification.
- **Check Items**:
  - Release Scope exists.
  - Claim self-restraint exists.
  - No-go Policy exists.
  - Leadership Claim Gate exists.
  - References Appendix exists.

---

# 4. WS1 — Division Inventory Scanner

## TODO-0101: Implement division inventory scanner

- **Priority**: P0
- **Owner**: Platform Infra Owner
- **File**: `scripts/ci/audit-division-inventory.mjs`
- **Scan Sources**:
  - `divisions/`
  - `config/domains/`
  - `config/quality/division-catalog.json`
  - `src/domains/`
  - `src/plugins/`
  - `docs_zh/`
  - `docs_en/`
  - `tests/`
  - `ui/packages/features/`
- **Outputs**:
  - `config/division-coverage/inventory/division-inventory.generated.json`
  - `config/division-coverage/inventory/division-inventory.summary.md`
  - `config/division-coverage/inventory/division-inventory.diff.json`
- **Acceptance Criteria**:
  - Can list all divisionIds.
  - Can discover orphan / duplicate / alias / missing owner / missing eval / missing red-team.
  - Can run in CI.
  - Output JSON schema validatable.
- **Blocking Conditions**:
  - Scanner only scans partial directories.
  - Scanner results cannot be stably reproduced.
  - Output contains timestamps but no deterministic mode.

## TODO-0102: Define DivisionInventoryRecord schema

- **Priority**: P0
- **Owner**: Governance Owner
- **File**: `config/division-coverage/schemas/division-inventory.schema.json`
- **Required Fields**:
  - `divisionId`
  - `normalizedDivisionId`
  - `familyId`
  - `status`
  - `riskLevel`
  - `hasDivisionYaml`
  - `hasCoverageCard`
  - `hasScenarioCard`
  - `hasEval`
  - `hasRedTeam`
  - `hasTrainingPolicy`
  - `hasOwner`
  - `blockers`
- **Acceptance Criteria**:
  - Scanner output validatable by schema.
  - CI errors on missing fields.
  - `blockers` uses enumeration, not free text.

## TODO-0103: Generate alias map

- **Priority**: P0
- **Owner**: Governance Owner
- **File**: `config/division-coverage/aliases.yaml`
- **Must Handle**:
  - `qa` vs `quality-assurance`
  - `game-dev` vs `gaming`
  - `livestream` vs `live-streaming`
  - `it-ops` vs `it-operations`
  - `finance-accounting` vs `financial-services`
  - `research` vs `academic-research` vs `industry-research`
- **Acceptance Criteria**:
  - Alias has `canonical`, `mode`, `removalTargetVersion`.
  - Deprecated alias not permitted for new code references.
  - Docs can only use canonical ID.

---

# 5. WS2 — SOT / Schema / Registry

## TODO-0201: Establish division coverage SOT document

- **Priority**: P0
- **Owner**: Governance Owner
- **File**: `docs_zh/governance/division-coverage-sot.md`
- **Content Must Include**:
  - familyId SOT
  - divisionId SOT
  - scenarioId SOT
  - toolId/actionId SOT
  - riskLevel SOT
  - status SOT
  - eval/red-team/training policy SOT
- **Acceptance Criteria**:
  - Clearly state "configuration is SOT, documentation is explanation, code is implementation, CI is referee".
  - Each object type has unique authoritative path.
  - Docs do not permit repeated declaration of production-ready.

## TODO-0202: Define 6 FamilyPolicies

- **Priority**: P0
- **Owner**: Governance Owner
- **Files**:
  - `config/division-coverage/families/engineering.yaml`
  - `config/division-coverage/families/knowledge-research.yaml`
  - `config/division-coverage/families/enterprise-ops.yaml`
  - `config/division-coverage/families/gtm-content.yaml`
  - `config/division-coverage/families/creative-production.yaml`
  - `config/division-coverage/families/regulated.yaml`
- **Each File Must Include**:
  - `familyId`
  - `defaultRiskLevel`
  - `defaultAutonomyBoundary`
  - `requiredEvalSuites`
  - `requiredRedTeamSuites`
  - `defaultToolPolicyRef`
  - `defaultMemoryPolicyRef`
  - `defaultTrainingDataPolicyRef`
  - `defaultReleaseGateRef`
  - `leadershipTargetsRef`
- **Acceptance Criteria**:
  - All 6 Families covered.
  - Regulated family defaults `noAutonomousHighImpactAction=true`.
  - High-risk override clarifies external model routing and training export strategy.

## TODO-0203: Define core schema

- **Priority**: P0
- **Owner**: Governance Owner
- **Files**:
  - `config/division-coverage/schemas/domain-family-policy.schema.json`
  - `config/division-coverage/schemas/division-coverage-card.schema.json`
  - `config/division-coverage/schemas/business-scenario-card.schema.json`
  - `config/division-coverage/schemas/division-raci.schema.json`
  - `config/division-coverage/schemas/division-lifecycle.schema.json`
  - `config/division-coverage/schemas/division-training-data-policy.schema.json`
- **Acceptance Criteria**:
  - Schema validatable by CI.
  - No free text status enumeration.
  - risk/autonomy/tool/action all use enumeration.

---

# 6. WS3 — CoverageCard Generator

## TODO-0301: Implement CoverageCard auto-generator

- **Priority**: P0
- **Owner**: Platform Infra Owner
- **File**: `scripts/generate-division-coverage-cards.mjs`
- **Inputs**:
  - inventory generated JSON
  - family policy
  - aliases map
- **Output**:
  - `config/division-coverage/divisions/<divisionId>.yaml`
- **Acceptance Criteria**:
  - All divisions have CoverageCard.
  - Unknown fields use `TBD` or blocker, no missing cards.
  - Manually maintained cards not overwritten without protection.
  - Generator supports `--check` and `--write`.
- **Blocking Conditions**:
  - Division without CoverageCard.
  - Generator produces non-deterministic diff on each run.

## TODO-0302: Supplement EvidenceScore / EvidenceRefs

- **Priority**: P0
- **Owner**: Governance Owner
- **File**: `config/division-coverage/schemas/division-coverage-card.schema.json`
- **Fields**:
  - `evidence.design`
  - `evidence.implementation`
  - `evidence.evaluation`
  - `evidence.operation`
  - `evidence.flywheel`
  - Each item includes `score`, `refs`, `lastUpdatedAt`, `evaluator`, `confidence`
- **Acceptance Criteria**:
  - `production_ready` card does not allow empty evidence refs.
  - `confidence=low` not permitted to enter pilot and above status.
  - CI fails when evidence ref points to non-existent artifact.

---

# 7. WS4 — BusinessScenarioCard Registry

## TODO-0401: Define P0 ScenarioCards

- **Priority**: P0
- **Owner**: Product / Domain Owner
- **Files**:
  - `config/division-coverage/scenarios/issue-to-patch.yaml`
  - `config/division-coverage/scenarios/ci-failure-analysis.yaml`
  - `config/division-coverage/scenarios/knowledge-citation-answer.yaml`
  - `config/division-coverage/scenarios/research-conclusion-to-experiment.yaml`
  - `config/division-coverage/scenarios/customer-refund-policy.yaml`
  - `config/division-coverage/scenarios/customer-complaint-escalation.yaml`
- **Each ScenarioCard Must Include**:
  - `scenarioId`
  - `divisionId`
  - `familyId`
  - `userGoal`
  - `canonicalWorkflow`
  - `supportedAgentTasks`
  - `inputDataTypes`
  - `outputActions`
  - `toolActions`
  - `riskLevel`
  - `autonomyAllowed`
  - `evalSuiteRef`
  - `redTeamSuiteRef`
  - `successMetrics`
  - `safetyMetrics`
  - `roiMetrics`
  - `releaseGateRef`
- **Acceptance Criteria**:
  - All P0 pilots have ScenarioCard.
  - When `outputActions` contains write action, must bind ToolAction risk.
  - `riskLevel >= high` must have red-team suite.

---

# 8. WS5 — ToolAction R0–R5 Risk System

## TODO-0501: Define ToolAction Risk Taxonomy

- **Priority**: P0
- **Owner**: Security Owner
- **File**: `config/tool-risk/taxonomy.yaml`
- **Risk Levels**:
  - R0 Read-only
  - R1 Draft-only
  - R2 Internal Write
  - R3 External Write
  - R4 Destructive
  - R5 Regulated / Financial / Legal
- **Acceptance Criteria**:
  - Each level has definition, examples, and default policy.
  - R3+ defaults require HITL or PreparedAction.
  - R5 defaults prohibit automatic execution.

## TODO-0502: Annotate P0 tool action descriptors

- **Priority**: P0
- **Owner**: Security Owner
- **Files**:
  - `config/tool-risk/tool-action-descriptors/github.yaml`
  - `config/tool-risk/tool-action-descriptors/shell.yaml`
  - `config/tool-risk/tool-action-descriptors/test-runner.yaml`
  - `config/tool-risk/tool-action-descriptors/knowledge-search.yaml`
  - `config/tool-risk/tool-action-descriptors/order.yaml`
  - `config/tool-risk/tool-action-descriptors/refund.yaml`
  - `config/tool-risk/tool-action-descriptors/ticket.yaml`
- **Each Action Must Include**:
  - `toolId`
  - `actionId`
  - `riskClass`
  - `sideEffect`
  - `reversible`
  - `requiresHITL`
  - `requiresPreparedAction`
  - `rollbackPolicyRef`
  - `dataClassesTouched`
  - `allowedFamilies`
- **Acceptance Criteria**:
  - P0 scenario referenced tool actions 100% have descriptors.
  - R4/R5 without HITL directly CI fail.
  - shell / GitHub write actions default not permitted to be directly driven by untrusted source.

## TODO-0503: ToolGateway enforcement design integration

- **Priority**: P0
- **Owner**: Execution / ToolGateway Owner
- **Files**:
  - `src/platform/.../tool-gateway/tool-risk-enforcer.ts`
  - `tests/unit/.../tool-risk-enforcer.test.ts`
- **Acceptance Criteria**:
  - Runtime calls tools after reading ToolActionDescriptor.
  - R3+ without HITL/preparedAction refused.
  - R5 automatic execution always refused.
  - Refusal produces structured receipt and audit event.

---

# 9. WS6 — EvalDatasetCard and Eval Suite

## TODO-0601: Define EvalDatasetCard schema

- **Priority**: P0
- **Owner**: Eval Owner
- **File**: `eval/schemas/eval-dataset-card.schema.json`
- **Fields**:
  - `datasetId`
  - `divisionId`
  - `scenarioId`
  - `version`
  - `source`
  - `taskCount`
  - `split`
  - `contaminationStatus`
  - `privacyStatus`
  - `labelingMethod`
  - `allowedForTraining`
  - `allowedForReleaseGate`
  - `retentionPolicyRef`
  - `frozenHash`
- **Acceptance Criteria**:
  - P0 eval datasets all have card.
  - release / heldout split defaults no-train.
  - contaminationStatus=unknown not permitted for release gate.

## TODO-0602: Engineering SWE-style eval initial version

- **Priority**: P0
- **Owner**: Engineering Eval Owner
- **Directory**: `eval/datasets/swe-style/`
- **Requirements**:
  - internal heldout tasks ≥ 50.
  - Each task has issue, repo snapshot, expected test, and baseline result.
  - heldout no-train.
  - frozenHash fixed.
- **Metrics**:
  - patch apply success
  - targeted test pass
  - human edit distance
  - P2P preservation
  - failure taxonomy
- **Acceptance Criteria**:
  - eval runner can run.
  - Output report can be referenced by EvidenceRefs.

## TODO-0603: Knowledge citation/source eval initial version

- **Priority**: P0
- **Owner**: Knowledge Eval Owner
- **Directory**: `eval/datasets/citation-source/`
- **Requirements**:
  - eval cases ≥ 100.
  - Cover source reliability, citation correctness, source freshness, and hallucinated claim.
  - Distinguish internal and public materials by privacyStatus.
- **Acceptance Criteria**:
  - CitationVerifier initial version can run.
  - Output citation coverage/correctness.
  - stale source detector has report.

## TODO-0604: Customer Service τ-style eval initial version

- **Priority**: P0
- **Owner**: Enterprise Ops Eval Owner
- **Directory**: `eval/datasets/tau-style/`
- **Requirements**:
  - scenario cases ≥ 100.
  - Cover order/refund/complaint/escalation.
  - Each case has policy reference and expected tool action.
- **Acceptance Criteria**:
  - Output task completion, policy violation, tool argument correctness, and handoff correctness.
  - refund/write action without HITL must fail.

---

# 10. WS7 — Red-team Suite and Severity

## TODO-0701: Define RedTeam Severity schema

- **Priority**: P0
- **Owner**: Red-team Owner
- **File**: `redteam/severity.schema.json`
- **Severity**:
  - Critical
  - High
  - Medium
  - Low
- **Acceptance Criteria**:
  - Each red-team result must have severity.
  - Critical success > 0 blocks release.
  - High success > 0 blocks high-risk division release.

## TODO-0702: Engineering AWI red-team

- **Priority**: P0
- **Owner**: Security Owner
- **File**: `redteam/divisions/coding/redteam-suite.yaml`
- **Covered Attacks**:
  - malicious issue body
  - malicious PR comment
  - CI log injection
  - tool output injection
  - secret exfiltration request
  - model-derived shell command injection
- **Requirements**:
  - cases ≥ 30.
  - critical success = 0.
  - All cases have evidenceRefs.

## TODO-0703: Knowledge source/citation poisoning red-team

- **Priority**: P0
- **Owner**: Security + Knowledge Owner
- **File**: `redteam/divisions/knowledge-base/redteam-suite.yaml`
- **Covered Attacks**:
  - fake citation
  - source poisoning
  - stale document trap
  - citation laundering
  - conclusion overclaim
- **Requirements**:
  - cases ≥ 30.
  - fake citation critical/high success = 0.

## TODO-0704: Customer Service policy bypass red-team

- **Priority**: P0
- **Owner**: Enterprise Ops Security Owner
- **File**: `redteam/divisions/customer-service/redteam-suite.yaml`
- **Covered Attacks**:
  - malicious customer message
  - policy bypass request
  - fake identity / fake entitlement
  - tool argument injection
  - refund escalation bypass
- **Requirements**:
  - cases ≥ 30.
  - refund/write action bypass = 0.

---

# 11. WS8 — TrainingDataPolicy and Revocation

## TODO-0801: Define P0 TrainingDataPolicy

- **Priority**: P0
- **Owner**: Data Governance Owner
- **Files**:
  - `training-data-policy/divisions/coding.yaml`
  - `training-data-policy/divisions/knowledge-base.yaml`
  - `training-data-policy/divisions/research.yaml`
  - `training-data-policy/divisions/customer-service.yaml`
  - `training-data-policy/divisions/support.yaml`
- **Policies**:
  - coding: allowed / redacted_only; secrets/logs must be redacted.
  - knowledge-base: public allowed; internal restricted.
  - customer-service: redacted_only.
  - regulated: no_train.
- **Acceptance Criteria**:
  - P0 divisions 100% have policy.
  - Any production-derived data defaults require DataBatchCard.
  - heldout eval defaults no-train.

## TODO-0802: Define Data Revocation Policy

- **Priority**: P0
- **Owner**: Data Governance Owner
- **File**: `training-data-policy/revocation.yaml`
- **affectedStores**:
  - memory
  - eval
  - training_export
  - analytics
  - evidence_projection
  - dashboard_cache
- **Acceptance Criteria**:
  - customer-service deletion requests must propagate to memory/dashboard/training export.
  - stale/invalid source must affect citation eval.
  - high-risk division defaults requiresModelDataTombstone=true.

---

# 12. WS9 — CI Gate Integration

## TODO-0901: Integrate warning-only CI

- **Priority**: P0
- **Owner**: DevOps Owner
- **Files**:
  - `scripts/ci/audit-domain-coverage.mjs`
  - `.github/workflows/ci.yml`
- **Warning-only Checks**:
  - division inventory
  - coverage card
  - family policy
  - tool risk
  - training data policy
  - eval dataset card
  - red-team severity
- **Acceptance Criteria**:
  - CI outputs report but does not block non-P0.
  - Report uploaded as artifact.
  - Local command can reproduce.

## TODO-0902: Integrate P0 blocking CI

- **Priority**: P0
- **Owner**: DevOps Owner
- **Blocking Scope**:
  - coding
  - knowledge-base
  - research
  - customer-service
  - support
- **Blocking Conditions**:
  - P0 division without CoverageCard.
  - P0 scenario without ScenarioCard.
  - P0 tool action without riskClass.
  - P0 eval dataset without DatasetCard.
  - P0 red-team without severity.
  - P0 training policy missing.
  - critical red-team success > 0.
- **Acceptance Criteria**:
  - PR breaking P0 gate fails.
  - Blocking rules have test coverage.

## TODO-0903: Integrate production-ready blocking gate

- **Priority**: P1
- **Owner**: DevOps Owner
- **Blocking Conditions**:
  - Any division declares production_ready but evidence insufficient.
  - leadership claim without LeadershipClaimRecord.
  - R3+ tool action without HITL.
  - eval/red-team results expired.
- **Acceptance Criteria**:
  - Does not block v3.3 RC but must enter v3.3 backlog.

---

# 13. WS10 — P0 Engineering Pilot

## TODO-1001: Define Engineering Pilot workflow

- **Priority**: P0
- **Owner**: Engineering Agent Owner
- **Process**:

```text
GitHub Issue / CI Failure
→ Repo Map
→ Fault Localization
→ Plan
→ Patch
→ Targeted Tests
→ PR Draft
→ Reviewer Feedback
→ Evidence Package
```

- **Deliverables**:
  - `config/division-coverage/scenarios/issue-to-patch.yaml`
  - `eval/divisions/coding/eval-suite.yaml`
  - `docs_zh/pilots/engineering-pilot.md`
- **Acceptance Criteria**:
  - dry-run can pass through.
  - Each step has receipt.
  - Failures enter failure taxonomy.

## TODO-1002: Implement PatchGate initial version

- **Priority**: P0
- **Owner**: Engineering Agent Owner
- **Capabilities**:
  - patch apply check
  - targeted tests
  - P2P preservation subset
  - unsafe file path check
  - secret diff scan
  - generated command check
- **Acceptance Criteria**:
  - Patch not generating PR draft without passing gate.
  - Gate outputs structured report.
  - Report can serve as EvidenceRef.

## TODO-1003: Engineering Pilot metrics report

- **Priority**: P0
- **Owner**: Engineering Eval Owner
- **Metrics**:
  - heldout tasks ≥ 50
  - patch apply success
  - targeted test pass
  - human edit distance
  - PR draft rate
  - AWI critical success
- **v3.3 Initial Targets**:
  - patch apply success ≥ 80%
  - targeted test pass ≥ 40%
  - PR draft generated ≥ 70%
  - AWI critical success = 0
- **Acceptance Criteria**:
  - Metrics calculable, does not require immediate industry leadership.
  - Output pilot report.

---

# 14. WS11 — P0 Knowledge Pilot

## TODO-1101: Define Knowledge Pilot workflow

- **Priority**: P0
- **Owner**: Knowledge Platform Owner
- **Process**:

```text
User research question
→ Source collection
→ Source reliability scoring
→ Claim extraction
→ Citation verification
→ Evidence graph
→ Conclusion
→ Experiment suggestion
→ Decision record
```

- **Deliverables**:
  - `config/division-coverage/scenarios/knowledge-citation-answer.yaml`
  - `eval/divisions/knowledge-base/eval-suite.yaml`
  - `docs_zh/pilots/knowledge-pilot.md`
- **Acceptance Criteria**:
  - CitationVerifier can run.
  - SourceReliabilityScorer can run.
  - ClaimEvidenceGraph can output.

## TODO-1102: CitationVerifier initial version

- **Priority**: P0
- **Owner**: Knowledge Eval Owner
- **Capabilities**:
  - claim-to-source alignment
  - citation existence check
  - stale source detection
  - unsupported claim flag
- **Acceptance Criteria**:
  - eval cases ≥ 100.
  - citation coverage / correctness calculable.
  - hallucinated claim rate calculable.

## TODO-1103: Knowledge Pilot metrics report

- **Priority**: P0
- **Owner**: Knowledge Platform Owner
- **v3.3 Initial Targets**:
  - citation eval cases ≥ 100
  - citation coverage ≥ 90%
  - citation correctness ≥ 80%
  - source freshness 100% recorded
  - stale source detector initial version can run
- **Acceptance Criteria**:
  - Output pilot report.
  - Output failure taxonomy.

---

# 15. WS12 — P0 Customer Service Pilot

## TODO-1201: Define Customer Service Pilot workflow

- **Priority**: P0
- **Owner**: Enterprise Ops Owner
- **Process**:

```text
Customer message
→ Intent
→ Policy lookup
→ Tool planning
→ API action draft
→ HITL if needed
→ Response
→ Handoff / escalation
→ SLA / CSAT / ROI tracking
```

- **Deliverables**:
  - `config/division-coverage/scenarios/customer-refund-policy.yaml`
  - `config/division-coverage/scenarios/customer-complaint-escalation.yaml`
  - `eval/divisions/customer-service/eval-suite.yaml`
  - `docs_zh/pilots/customer-service-pilot.md`
- **Acceptance Criteria**:
  - τ-style eval can run.
  - refund/write action without HITL blocked.
  - handoff/escalation has receipt.

## TODO-1202: Policy adherence evaluator initial version

- **Priority**: P0
- **Owner**: Enterprise Ops Eval Owner
- **Capabilities**:
  - policy lookup
  - action legality check
  - tool argument validation
  - handoff correctness
- **Acceptance Criteria**:
  - scenario cases ≥ 100.
  - policy violation critical = 0.
  - tool argument correctness ≥ 80%.

## TODO-1203: Customer Service Pilot metrics report

- **Priority**: P0
- **Owner**: Enterprise Ops Owner
- **Metrics**:
  - task completion
  - policy violation
  - handoff accuracy
  - SLA improvement
  - HITL coverage
  - malicious message red-team result
- **Acceptance Criteria**:
  - Output pilot report.
  - Output ROI baseline.

---

# 16. WS13 — ROI / Dashboard / Evidence Package

## TODO-1301: Define ROI Measurement Protocol

- **Priority**: P0
- **Owner**: Ops Analytics Owner
- **File**: `roi/measurement-protocol.md`
- **Methods**:
  - before_after
  - ab_test
  - assisted_vs_manual
  - cohort_comparison
- **Acceptance Criteria**:
  - P0 pilot uses at least one ROI baseline method.
  - ROI not only records timeSaved, but also costDelta, qualityDelta, and riskDelta.

## TODO-1302: Define P0 ROI config

- **Priority**: P0
- **Owner**: Ops Analytics Owner
- **Files**:
  - `roi/divisions/coding.yaml`
  - `roi/divisions/knowledge-base.yaml`
  - `roi/divisions/customer-service.yaml`
- **Acceptance Criteria**:
  - Each pilot has ROI metrics, sampling window, and sample size requirements.
  - confidence calculable.

## TODO-1303: Generate Leadership Evidence Package

- **Priority**: P0
- **Owner**: Release Owner
- **Directories**:
  - `docs_zh/divisions/coding/leadership-evidence/`
  - `docs_zh/divisions/knowledge-base/leadership-evidence/`
  - `docs_zh/divisions/customer-service/leadership-evidence/`
- **Must Include**:
  - coverage-card.yaml
  - scenario-index.md
  - eval-report.md
  - redteam-report.md
  - roi-report.md
  - risk-report.md
  - release-readiness.md
- **Acceptance Criteria**:
  - Each report has EvidenceRefs.
  - May not claim industry-leading unless Claim Gate passes.

---

# 17. WS14 — Admin Console Read-only Version

## TODO-1401: Define Admin Console page spec

- **Priority**: P1
- **Owner**: UI Owner
- **File**: `docs_zh/ui/admin-console-division-governance.md`
- **Pages**:
  - Division Inventory
  - CoverageCard Viewer
  - Scenario Registry
  - Eval & Red-team Reports
  - ROI Dashboard
  - Release Gate Board
  - Evidence Explorer
  - Tool Risk Registry
  - Budget Monitor
- **Acceptance Criteria**:
  - v3.3 only requires read-only.
  - UI data must come from SOT / generated reports.
  - UI not permitted to mock production_ready.

## TODO-1402: Implement Division Inventory read-only page

- **Priority**: P1
- **Owner**: UI Owner
- **Suggested Files**:
  - `ui/packages/features/division-inventory/`
  - `ui/apps/web/src/feature-registry.ts`
- **Acceptance Criteria**:
  - Can display generated inventory.
  - Can filter by family/status/risk/blocker.
  - No online editing.

---

# 18. WS15 — Leadership Claim Scanner

## TODO-1501: Implement claim scanner

- **Priority**: P1
- **Owner**: Governance Owner
- **File**: `scripts/ci/audit-leadership-claims.mjs`
- **Scan Scope**:
  - README
  - docs_zh / docs_en
  - UI copy
  - release notes
  - marketing docs
- **Scan Keywords**:
  - industry-leading
  - 行业领先
  - best-in-class
  - production-ready
  - benchmark-leading
  - fully autonomous
- **Acceptance Criteria**:
  - Without LeadershipClaimRecord, may not use formal claim.
  - Supports allowlist and false positive records.
  - v3.3 can be warning-only, v3.4 blocking.

---

# 19. WS16 — v3.3 Release Readiness

## TODO-1601: Write v3.3 release-readiness report

- **Priority**: P0
- **Owner**: Release Owner
- **File**: `docs_zh/releases/automatic_agent_platform_v3_3_release_readiness.md`
- **Must Include**:
  - v3.2 → v3.3 change summary
  - inventory scanner status
  - CoverageCard generation status
  - P0 pilot status
  - eval/red-team status
  - CI gate status
  - blocker list
  - Whether v3.3 RC permitted
- **Acceptance Criteria**:
  - May not claim current system is industry-leading.
  - Clearly state v3.3 is implementation baseline + P0 pilot launch.

## TODO-1602: v3.3 Release Candidate Gate

- **Priority**: P0
- **Owner**: Release Owner
- **v3.3 RC Must Satisfy**:
  - Division Inventory Scanner can run.
  - All existing divisions have CoverageCard draft.
  - All 6 Families have FamilyPolicy.
  - 3 P0 pilots have ScenarioCard.
  - 3 P0 pilots have eval suite initial version.
  - 3 P0 pilots have red-team suite initial version.
  - P0 tool actions have R0–R5 riskClass.
  - P0 eval datasets have EvalDatasetCard.
  - P0 divisions have TrainingDataPolicy.
  - warning-only CI integrated.
  - P0 blocking CI integrated.
  - P0 pilot report initial version exists.

---

# 20. 30 / 60 / 90 Day Schedule

## 20.1 First 30 Days: Governance Foundation

| Week | Task | Deliverable |
|---|---|---|
| Week 1 | Division Inventory Scanner | inventory generated JSON |
| Week 1 | Alias Map | aliases.yaml |
| Week 2 | FamilyPolicy + Schema | families/*.yaml + schemas |
| Week 2 | CoverageCard Generator | divisions/*.yaml |
| Week 3 | P0 ScenarioCard | scenarios/*.yaml |
| Week 3 | ToolAction Taxonomy | tool-risk/*.yaml |
| Week 4 | Warning-only CI | audit reports |
| Week 4 | First blocker report | division-inventory.summary.md |

## 20.2 Days 31–60: P0 Pilot Minimum Closed Loop

| Pilot | Task | Deliverable |
|---|---|---|
| Engineering | SWE-style heldout ≥ 50 | eval/datasets/swe-style |
| Engineering | issue-to-patch dry run | engineering pilot report |
| Knowledge | citation/source eval ≥ 100 | citation eval report |
| Knowledge | CitationVerifier initial version | knowledge pilot report |
| Customer Service | τ-style eval ≥ 100 | customer-service eval report |
| Customer Service | policy adherence evaluator | policy eval report |

## 20.3 Days 61–90: Operationalization and RC

| Task | Deliverable |
|---|---|
| P0 red-team reports | redteam reports |
| P0 ROI baseline | roi reports |
| P0 blocking CI | CI gate |
| Admin Console read-only page spec | UI spec |
| Leadership Claim scanner warning-only | claim report |
| v3.3 release-readiness | release-readiness.md |

---

# 21. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| All divisions start simultaneously | Scope out of control | Only do 3 P0 Pilots |
| UI before SOT | Document/code drift again | Scanner first, then UI |
| Eval dataset quality low | Metrics meaningless | EvalDatasetCard + frozenHash + contamination scan |
| ToolRisk only in config, not in runtime enforcement | Security gate fails | ToolGateway calls must check before tool call |
| ROI no baseline | Cannot prove business value | before/after or assisted_vs_manual |
| P0 blocking CI too early and strict | Affects development efficiency | warning-only first, then P0 blocking |
| Leadership claim abused | External commitment risk | Claim scanner + ClaimRecord |
| Data revocation not propagating | Compliance risk | DataRevocationPolicy |

---

# 22. Minimum Success Criteria

v3.3 success is not "every family is already industry leading", but:

```text
1. System knows which divisions it has.
2. Every division has CoverageCard.
3. P0 scenarios have real eval/red-team/tool-risk/training-policy.
4. P0 pilot can run reproducible reports.
5. CI can block most critical non-compliant states.
6. Dashboard / report can display real blockers.
7. industry-leading claims without evidence are blocked.
```

---

# 23. Final Recommendations

The current repository has completed the governance implementation required for v3.3. The next step is not to continue supplementing foundational assets, but:

```text
1. Maintain inventory / coverage / domain coverage CI gates
2. Advance RC verification according to release-readiness report
3. In v3.4, decide whether production-ready blocking scope is expanded
```