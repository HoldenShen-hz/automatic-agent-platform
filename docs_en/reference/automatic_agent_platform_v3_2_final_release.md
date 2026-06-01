# Automatic Agent Platform v3.2 — Family Leadership Readiness & Claim Gate — Final Governance Baseline

> **Version**: v3.2
> **Status**: Final Governance Baseline
> **Inherited Baseline**: v3.1 Division Execution, Evidence & Operating Model Baseline
> **Filename Note**: File path retains `final_release` historical naming; current body status matches filename, indicating governance baseline is released.
> **Objective**: On the basis of v3.1 SOT, Lifecycle, RACI, CoverageCard, ScenarioCard, EvalDatasetCard, RedTeam, ROI, ToolRisk, Budget, Admin Console, and Regression Protection, further answer one core question: **whether each Family can achieve industry leadership, and under what conditions it is permissible to claim industry leadership**. This version completes Release Scope, industry evidence appendix, Claim self-restraint, version change summary, Claim Scanner allowlist, No-go exception tightening, Admin Console DoD, and Release Owner, and provides subsequent evolution checklist.
> **Current Repository Implementation Status**: Machine-readable Family Readiness / Benchmark / Minimum Evidence / Claim schema / allowlist / records / No-go Policy configuration, CI Claim Scanner, governance data, Admin API / OpenAPI, Release Console Leadership Claims subpage and review request submission process have been landed in the repository.
> **Core Conclusion**: Every Family can pursue industry leadership, but they cannot use the same "leadership" definition. Engineering and Knowledge / Research should prioritize capability and evidence leadership; Enterprise Ops should lead locally in customer-service/support; GTM / Content and Creative / Production should lead in governance and evidence first; Regulated Family must be defined as safety governance leadership, not autonomous execution leadership. No Family or Division may claim "industry leading" in README, UI, sales materials, or release notes unless the Evidence Package passes the Leadership Claim Gate. **This document releases a governance baseline and Claim Gate, and does not certify that any current Family or Division is industry leading.**

---

## Release Scope

This version is **the formal governance baseline for Family Leadership Readiness & Claim Gate**. It defines the claim governance, scanner, configuration, and console integration boundaries currently effective in the repository; but it is still not an industry leadership certification for any Family or Division.

The target content defined in this document:

```text
1. Define Family-level readiness, benchmark map, minimum leading evidence, no-go policy, and leadership claim gate.
2. Specify under what circumstances it is permissible to claim designed / pilot_ready / local_leader / industry_comparable / industry_leading.
3. Specify the differentiated leadership paths for the six Family types: Engineering, Knowledge / Research, Enterprise Ops, GTM / Content, Creative / Production, Regulated.
4. Specify that without EvidencePackage and LeadershipClaimRecord, industry leadership may not be claimed in README, docs, UI, release notes, or sales materials.
```

What this document does NOT currently state or authorize:

```text
1. Do not claim any Family is already industry_leading.
2. Do not claim any Division is production_ready unless there is an independent CoverageCard and EvidencePackage.
3. Do not authorize any high-risk actions to execute automatically.
4. Do not relax v3.1-defined SOT, Lifecycle, RACI, ToolRisk, EvalDatasetCard, RedTeam, ROI, DataRevocation, Budget, and RegressionProtection requirements.
```

"In this document, "can achieve industry leadership," "can pursue industry leadership," and "has the foundation for leadership" all denote **leadership path / readiness assessment** and do not constitute an approved `LeadershipClaimRecord`.

---

## Terminology Alignment with Current SOT

The current machine-checkable family / division authoritative source in the repository remains:

- `docs_zh/governance/source_of_truth.md`
- `docs_zh/reference/division-catalog.md`
- `config/quality/division-catalog.json`

The `Engineering / Knowledge / Research / Enterprise Ops / GTM / Content / Creative / Production / Regulated` used in this document are **governance planning groupings**, used for discussing readiness, benchmark, and claim gate - they are NOT a replacement for the `family` field in the existing `division-catalog.json`.

Until these governance groupings are promoted to canonical fields in `division-catalog.json` or independently governed configurations enforce them via contract / CI, the Family groupings in this document may not be directly used for:

- Runtime routing
- CI strong validation
- Division ownership rewriting
- UI external claims

To avoid dual SOT, this document adopts the following bridging relationships:

| This Document's Governance Grouping | Current Canonical Family / Division Reference | Note |
|---|---|---|
| Engineering | `engineering`, `data`, `operations` related `coding`, `data-engineering`, `devops`, `engineering_ops`, `quality-assurance` under delivery | This is only a governance coordination surface and does not change each division's canonical family in the catalog |
| Knowledge / Research | `knowledge`, `research`, `analytics` under `knowledge-base`, `academic-research`, `industry-research`, `research`, `analytics` | `Knowledge` and `Research` are still separate catalog families at runtime |
| Enterprise Ops | `customer-ops`, `operations`, `delivery`, `people` under `customer-service`, `support`, `user-operations`, `project-management`, partial `operations` division | Can only aggregate by scenario; cannot merge `engineering_ops` / `general_ops` / `operations` / `it-operations` into one machine family |
| GTM / Content | `growth`, `content`, `commerce` under `advertising`, `content`, `ecommerce` | Only represents business governance coordination surface |
| Creative / Production | `product`, `media`, partial `content` under `design`, `live-streaming`, etc. | Does not add or replace existing product/media family definitions |
| Regulated | `legal`, `finance`, `healthcare`, `security` | Represents a high-governance constraint set, not a single runtime family |

If this document is to be upgraded to a stronger canonical baseline, the bridge relationships above must first clarify which fields enter `division-catalog`, which fields continue to be stored independently in governance configurations, and which fields truly participate in contract / CI / runtime mandatory determination.

### Terminology Supplement

`FamilyPolicy` appearing frequently in this document refers to a **policy package** for a governance grouping regarding readiness / benchmark / no-go / claim gate, at minimum including:

- Applicable canonical family / division scope
- Readiness determination rules
- Benchmark mapping
- Minimum evidence requirements
- No-go and exception boundaries
- Claim review owner / expiry / revocation rules

In the current repository, `FamilyPolicy` is neither an existing runtime schema field nor a current field in `division-catalog.json`; it is currently carried through independent governance configuration but should still be treated as a governance configuration concept, not a canonical runtime family field.

---

## Relationship with Current System

| Category | Conclusion | Note |
|---|---|---|
| Direction consistent with improvements | `done` | family-specific benchmark, claim governance, no-go policy, and regulated no-autonomy have filled current governance gaps |
| Core governance design implemented | `done` | FamilyReadiness config, LeadershipClaim schema, ClaimScanner, Leadership Claims page and API have artifacts in repository |
| Originally had potential conflicts with status quo, but bridge化解 resolved | `done` | Through `division-catalog` / `source_of_truth` bridging and independent governance configuration, avoided forming a second set of machine SOT |
| Implementation boundaries still requiring subsequent convergence | `done` | Family expansion reports, benchmark calibration, claim review / revoke / expiry operator workflow, and regulated no-autonomy guard have been filled; subsequent v3.3 only needs to expand more families and finer-grained evidence binding |

### Suggested Implementation Sequence

If extending this baseline capability, suggested sequence to avoid recurrence of "document claims completion, code does not yet exist":

1. First confirm main document, terminology, and SOT bridging.
2. Then supplement contract / ADR, clarifying `FamilyPolicy`, `LeadershipClaimRecord`, claim review lifecycle, and directory ownership.
3. Then add machine-readable config / schema.
4. Then integrate Claim Scanner, ReleaseGate, and No-go enforcement into CI / runtime validation.
5. Finally supplement Admin Console pages and operator workflow.

---

## v3.1 → v3.2 Governance Baseline Change Summary

| Type | v3.2 Governance Baseline Added / Fixed Content |
|---|---|
| Release Scope | Clarified this document is governance and assessment baseline, does not certify current system is industry leading |
| Claim Self-Restraint | Clarified "can lead" is a readiness judgment, not a formal claim |
| Family Readiness | Added readiness status, target stage, and upgrade conditions for 6 Families |
| Benchmark Map | Added Family-specific external benchmark / framework mapping |
| Minimum Evidence | Added Minimum Viable Leading Evidence for each Family |
| No-go Policy | Added global and Family-specific prohibited automation action lists |
| Claim Gate | Added claim level, claim schema, scanner, allowlist, expiry/revocation |
| Expansion Path | Added expansion path from P0 pilot to all Family / Division |
| Release Checklist | Added document/implementation status checklist, distinguishing "defined" from "implemented" |
| Industry Appendix | Added industry evidence appendix covering SWE-bench, BFCL, τ-bench, MCP, OTel, OWASP, NIST, CSA, OSWorld, WebArena, Copilot, Claude Code, Devin, Enterprise Agent Platforms |
| Admin Console | Supplemented Leadership Claims page target DoD and clarified current implemented page boundaries and subsequent evolution items |
| Owner / RACI | Added release criteria owner to avoid checklist with no owner |

---

## Document / Implementation Status Checklist

Status legend:

- `done`: Document statement is consistent with current repository facts, can be referenced as implemented capability.
- `todo`: Repository lacks corresponding configuration, code, CI, UI, or contract artifacts, cannot be referenced as implemented capability.

| Checklist Item | Current Status | Evidence Location / Note |
|---|---|---|
| Release Scope clarified | `done` | `Release Scope / 发布范围` |
| Document does not certify any current Family as industry leading | `done` | Release Scope + Leadership Claim Gate |
| "Can lead" has been restricted to readiness assessment | `done` | Release Scope |
| Family governance buckets bridged to current SOT | `done` | `Terminology Alignment with Current SOT` |
| Family Readiness Table completed | `done` | §2 |
| Benchmark Map completed | `done` | §3 |
| Minimum Leading Evidence documented | `done` | §4 |
| No-go Policy documented | `done` | §6 |
| Leadership Claim target schema documented | `done` | §7.4 |
| Claim scanner design documented | `done` | §7.5–§7.7 |
| Claim scanner implemented in CI | `done` | `scripts/ci/audit-leadership-claims.mjs` + `package.json#audit:leadership-claims` |
| Claim scanner allowlist / false positive handling implemented | `done` | `config/division-coverage/claims/allowlist.yaml` + scan report / review request data flow |
| Industry references appendix added | `done` | §13 |
| Release criteria owner added | `done` | §10.1 |
| Admin Console DoD documented | `done` | §10.2 |
| Admin Console Leadership Claims page implemented | `done` | `ui/packages/features/release-console` subpage + shared API client + i18n integrated |
| Machine-readable family readiness / benchmark / evidence config landed | `done` | `config/division-coverage/{family-readiness,benchmark-map,minimum-leading-evidence}.yaml` |
| No-go Policy config landed | `done` | `config/policy/no-go-actions.yaml` |
| Regulated not pursuing high autonomy clarified | `done` | §8.6 |

Current determination: **May be released as v3.2 Final Governance Baseline; but it does not equal any Family having obtained industry-leading certification.**

2026-06-01 re-audit addendum:

- The authoritative structure of `config/division-coverage/claims/` has been re-confirmed as `records.yaml + allowlist.yaml`; the older Appendix A wording about family-scoped claim YAML files was not the current repository truth.
- `docs_zh/divisions/family-readiness.md` and `docs_zh/divisions/leadership-claims.md` have been added to anchor the Chinese release doc references.
- `docs_en/divisions/family-readiness.md` and `docs_en/divisions/leadership-claims.md` have also been added, and the English appendix path has been corrected to `docs_en/divisions/`.
- Claim scanner allowlist parity has been restored for the English governance counterparts, so governance-only wording in the v3.2 / v3.3 governance docs is no longer misclassified as an external leadership claim.


## 0. v3.2 One-Page Conclusion

> The following judgments are governance objectives and readiness assessments, not current runtime or market external status.

### 0.1 Does the current system have the foundation for industry leadership?

Has the foundation, but cannot have all Families lead comprehensively at once.

| Family | Current Feasibility | Recommended Leadership Type | Recommended Stage | Main Reason |
|---|---:|---|---|---|
| Engineering | High | Capability leadership + Evidence leadership + Safety leadership | P0 | Industry benchmarks are clear, ROI is explicit, easy to form closed loop |
| Knowledge / Research | High | Evidence leadership + Data flywheel leadership + Decision closure leadership | P0 | Strong alignment with knowledge base, research platform, and experiment platform; is a differentiated direction |
| Enterprise Ops | Medium-High | Process leadership + SLA leadership + Policy Adherence leadership | P0/P1 | customer-service/support can be small切入点 landed |
| GTM / Content | Medium | Controlled content leadership + Brand/copyright governance leadership + ROI attribution leadership | P1 | Deep business action risk is high; start with draft-only |
| Creative / Production | Medium-Low to Medium | Multimodal evidence leadership + Asset governance leadership | P1/P2 | Multimodal, UI, and asset pipeline difficulty is high |
| Regulated | Medium-High | Safety governance leadership + Audit leadership + HITL leadership | P1/P2 | Should not pursue high autonomy, should pursue controllable, auditable, revocable |

### 0.2 v3.2 New Content

v3.2 adds 6 key modules on the basis of v3.1:

| # | New Module | Problem Solved |
|---:|---|---|
| 1 | Family-level Leadership Readiness Table | Determine whether each Family is truly ready to pursue industry leadership |
| 2 | Pilot-to-Family Expansion Path | Explain how P0 pilots expand to all divisions |
| 3 | Family-specific External Benchmark Map | Each Family aligns with which external benchmarks / industry frameworks |
| 4 | Minimum Viable Leading Evidence | Minimum evidence required for each Family to claim leadership |
| 5 | No-go List | Clarify which actions currently must not be automated |
| 6 | Leadership Claim Gate | Block external claims of "industry leading" when standards are not met |

---

## 1. Unified Definition of Industry Leadership

v3.2 no longer treats "industry leadership" as a single capability score, but splits it into five types.

| Leadership Type | Definition | Typical Families |
|---|---|---|
| Capability Leadership | Task success rate, automation capability, and end-to-end closure exceed industry or internal baselines | Engineering, Enterprise Ops |
| Safety Leadership | High-risk actions are controllable, critical red-team success = 0 | Regulated, Engineering, GTM |
| Evidence Leadership | All key conclusions, actions, tool calls, and training data have evidenceRefs | Knowledge, Regulated, Creative |
| Operation Leadership | Has SLO, ROI, incident, adoption, and human acceptance data | Enterprise Ops, Engineering, GTM |
| Flywheel Leadership | Runtime data can be converted to memory, skill, eval, and training data, with demonstrated model/system benefits | Knowledge, Engineering |

The unified scoring formula continues from v3.1, but v3.2 clarifies that different Family weights may differ:

```text
Family Leadership Score =
  Capability Score × W1
+ Safety Score × W2
+ Evidence Score × W3
+ Operation Score × W4
+ Flywheel Score × W5
```

Default weights:

| Family | Capability | Safety | Evidence | Operation | Flywheel |
|---|---:|---:|---:|---:|---:|
| Engineering | 30% | 25% | 20% | 15% | 10% |
| Knowledge / Research | 15% | 15% | 35% | 15% | 20% |
| Enterprise Ops | 25% | 25% | 15% | 25% | 10% |
| GTM / Content | 20% | 35% | 15% | 25% | 5% |
| Creative / Production | 20% | 25% | 35% | 15% | 5% |
| Regulated | 10% | 45% | 30% | 10% | 5% |

---

## 2. Family-level Leadership Readiness Table

### 2.1 Readiness Status

| Status | Meaning |
|---|---|
| `not_ready` | Missing core SOT, CoverageCard, eval, or red-team |
| `governance_ready` | Governance structure is complete, but capability/business closure is insufficient |
| `pilot_ready` | Can enter real pilot, but cannot claim industry leadership |
| `local_leadership_ready` | Can claim internal leadership or local leadership in partial scenarios |
| `industry_leadership_ready` | Evidence package meets industry leadership claim threshold |

### 2.2 Current Recommended Ratings

| Family | Current Target Rating | v3.2 Recommended Judgment | Must Complete Before Upgrading |
|---|---|---|---|
| Engineering | `local_leadership_ready` | Can pursue industry leadership fastest | issue-to-PR, SWE-style heldout, patch correctness, AWI red-team, PR acceptance |
| Knowledge / Research | `local_leadership_ready` | Most suitable for differentiated leadership | citation verifier, source reliability, experiment linker, stale doc detector |
| Enterprise Ops | `pilot_ready` | Can lead locally in customer-service/support | τ-style eval, real ticket/order/refund API, SLA dashboard |
| GTM / Content | `governance_ready` | First do controlled content and brand safety leadership | CRM/ecommerce connector, brand policy DSL, copyright gate, ROI attribution |
| Creative / Production | `governance_ready` | First do multimodal evidence and asset governance leadership | Figma/DOM/screenshot evidence, visual diff, asset provenance |
| Regulated | `governance_ready` | Can do safety governance leadership, not autonomous leadership | audit export, data residency, mandatory HITL, no autonomous high-impact actions |

### 2.2.1 Readiness Rating Basis

| Family | Rating Basis |
|---|---|
| Engineering | External SWE-style benchmark is clear; internal ROI is direct; tools, tests, PR, and CI can all form evidence; risks mainly in patch correctness, AWI, and production write actions |
| Knowledge / Research | Highly aligned with internal Wiki / Research / Experiment / Decision processes; EvidenceGraph and Data Flywheel have differentiation; risks mainly in citation, source poisoning, and stale docs |
| Enterprise Ops | customer-service/support can build closure with τ-style eval; but operations scope is too broad, must first converge to ticket/order/refund/complaint scenarios |
| GTM / Content | Generation and review are easy to land, but automatically writing CRM, ad budgets, and customer commitments are high-risk; should first do draft-only, brand/copyright gate, and ROI attribution |
| Creative / Production | Multimodal evidence and Figma/DOM/screenshot/asset provenance are reasonable entry points; but automatic production and publishing assets are difficult, first do evidence/provenance leadership |
| Regulated | Can lead in HITL, audit, data residency, evidence, and revocation; should not use automation rate as leadership metric |

### 2.3 Readiness Gate

The following gates are **target implementation conditions**. Only when machine-readable configuration, CI, and claim artifacts actually exist in the repository and are integrated into validation can they be treated as mandatory rules.

```text
industry_leadership_ready requires:
  - Family governance policy exists in canonical config or approved ADR
  - all P0 divisions have CoverageCard v1.1+
  - at least one production-grade ScenarioCard
  - eval suite executed with dataset card
  - red-team suite executed with severity model
  - ROI measurement exists with confidence >= medium
  - evidenceRefs non-empty and not stale
  - Leadership Claim Gate passed
```

---

## 3. Family-specific External Benchmark Map

### 3.1 Benchmark Map Summary Table

| Family | External benchmark / framework | Internal mapping method |
|---|---|---|
| Engineering | SWE-bench Verified, SWE-style tasks, Agentic PR studies, BFCL for tools | internal SWE-style heldout, issue-to-PR, PR acceptance, patch correctness |
| Knowledge / Research | RAG citation eval, source grounding eval, OpenTelemetry GenAI tracing | citation/source eval, ClaimEvidenceGraph, ExperimentLinker |
| Enterprise Ops | τ-bench, τ²/telecom-style policy tasks, enterprise workflow benchmarks | customer-service τ-style eval, support ticket eval |
| GTM / Content | τ-bench retail, CRM workflow eval, brand safety/copyright eval | CRM action safety, brand/copyright gate, campaign ROI |
| Creative / Production | OSWorld, WebArena, VisualWebArena, visual regression eval | Figma/DOM/screenshot evidence, visual grounding eval |
| Regulated | NIST AI RMF / GenAI Profile, OWASP AI Agent Security, CSA Agentic NIST AI RMF | control mapping, red-team severity, audit export, HITL coverage |

### 3.2 ToolGateway Horizontal Benchmark

ToolGateway is the common substrate for all Families and must additionally align:

```text
BFCL-style:
  - tool selection accuracy
  - argument correctness
  - irrelevant tool refusal
  - parallel/nested/multi-turn tool use

MCP-style:
  - Protected Resource Metadata
  - resource/audience binding
  - scope mismatch detection
  - tool attestation
  - tool output injection defense

τ-style:
  - tool use under dynamic user interaction
  - domain policy adherence
  - hidden state / changing API state handling
```

### 3.3 Observability Horizontal Benchmark

All Families should integrate OTel GenAI / agent spans semantic mapping:

```text
Required spans:
  - agent.run
  - model.call
  - tool.call
  - guardrail.check
  - handoff.request
  - memory.read
  - memory.write
  - eval.case
  - redteam.case
  - approval.decision
  - prepared_action.commit
```

---

## 4. Family-specific Minimum Viable Leading Evidence

### 4.1 Engineering Family

Required before claiming industry leadership:

```text
1. Engineering FamilyPolicy
2. coding CoverageCard v1.1+
3. issue-to-patch ScenarioCard
4. ci-failure-analysis ScenarioCard
5. internal SWE-style heldout >= 50 tasks for MVP, >= 200 tasks for leadership claim
6. patch correctness report
7. PR acceptance / human edit distance report
8. AWI red-team report
9. ToolAction R0-R5 for GitHub/CI/shell/test tools
10. Engineering ROI report
```

Minimum leading evidence:

| Evidence | MVP | Leadership Claim |
|---|---:|---:|
| Internal SWE-style tasks | ≥50 | ≥200 |
| AWI red-team cases | ≥30 | ≥100 |
| Real pilot PRs | ≥10 | ≥50 |
| Human reviewer feedback | required | required |
| Patch correctness report | required | required |

### 4.2 Knowledge / Research Family

Required before claiming industry leadership:

```text
1. Knowledge FamilyPolicy
2. knowledge-base CoverageCard
3. research CoverageCard
4. citation/source eval >= 100 cases for MVP, >= 500 for leadership claim
5. SourceReliabilityScorer report
6. CitationVerifier report
7. ClaimEvidenceGraph report
8. ExperimentLinker report
9. stale doc detector report
10. knowledge reuse / decision impact report
```

Minimum leading evidence:

| Evidence | MVP | Leadership Claim |
|---|---:|---:|
| Citation eval cases | ≥100 | ≥500 |
| Source reliability categories | ≥5 | ≥10 |
| Experiment-linked conclusions | ≥20 | ≥100 |
| Stale doc checks | required | automated |
| Knowledge reuse dashboard | required | required |

### 4.3 Enterprise Ops Family

Required before claiming industry leadership:

```text
1. EnterpriseOps FamilyPolicy
2. customer-service CoverageCard
3. support CoverageCard if included in claim
4. refund/order/complaint ScenarioCards
5. τ-style eval >= 100 cases for MVP, >= 500 for leadership claim
6. policy adherence report
7. tool action safety report
8. SLA / handoff / CSAT dashboard
9. customer data redaction policy
10. ROI report
```

Minimum leading evidence:

| Evidence | MVP | Leadership Claim |
|---|---:|---:|
| τ-style cases | ≥100 | ≥500 |
| Policy test cases | ≥50 | ≥300 |
| Pilot tasks | ≥50 | ≥500 |
| SLA measurement | required | required |
| Handoff audit | required | required |

### 4.4 GTM / Content Family

Required before claiming industry leadership:

```text
1. GTM FamilyPolicy
2. content/advertising/ecommerce CoverageCards as applicable
3. brand safety eval
4. copyright risk eval
5. CRM/ecommerce action safety report
6. customer data protection report
7. content human acceptance report
8. campaign ROI attribution report
```

Minimum leading evidence:

| Evidence | MVP | Leadership Claim |
|---|---:|---:|
| Brand safety cases | ≥100 | ≥1000 |
| Copyright risk cases | ≥50 | ≥500 |
| CRM/ecommerce action cases | ≥50 | ≥500 |
| Human review samples | required | required |
| ROI attribution | campaign-level optional | campaign-level required |

### 4.5 Creative / Production Family

Required before claiming industry leadership:

```text
1. Creative FamilyPolicy
2. design CoverageCard or selected production division CoverageCard
3. multimodal evidence schema
4. Figma/DOM/screenshot connector report
5. visual grounding eval
6. design token compliance report
7. visual regression report
8. asset provenance report
9. copyright risk report
```

Minimum leading evidence:

| Evidence | MVP | Leadership Claim |
|---|---:|---:|
| Visual grounding cases | ≥50 | ≥300 |
| Visual regression cases | ≥50 | ≥300 |
| Asset provenance samples | ≥50 | ≥500 |
| Human creative review | required | required |
| Copyright risk eval | required | required |

### 4.6 Regulated Family

Required before claiming industry leadership:

```text
1. Regulated FamilyPolicy
2. selected high-risk CoverageCard
3. mandatory HITL policy
4. no autonomous high-impact action policy
5. audit export report
6. data residency report
7. restricted data red-team report
8. bias/fairness report if applicable
9. data revocation/tombstone report
10. external model routing report
```

Minimum leading evidence:

| Evidence | MVP | Leadership Claim |
|---|---:|---:|
| High-impact action HITL coverage | 100% | 100% |
| Critical red-team success | 0 | 0 |
| Audit export completeness | ≥98% | ≥99.9% |
| Data residency violation | 0 | 0 |
| Restricted data leakage | 0 | 0 |

---

## 5. Pilot-to-Family Expansion Path

### 5.1 P0 Pilot Scope

v3.2 continues converging to 3 main lines:

| Pilot | Covered Family | First Division | Target |
|---|---|---|---|
| Engineering Pilot | Engineering | coding + qa/devops/security sub-capabilities | issue-to-PR, CI failure, patch correctness |
| Knowledge Pilot | Knowledge / Research | knowledge-base + research | citation/source/evidence/experiment trace |
| Customer Service Pilot | Enterprise Ops | customer-service + support sub-capabilities | τ-style policy agent, SLA, handoff, ROI |

### 5.2 Expansion Path

```text
Phase P0-A:
  Build SOT, CoverageCard, ScenarioCard, EvalDatasetCard, ToolRisk, RedTeam, ROI.

Phase P0-B:
  Three pilots run real tasks and generate evidence packages.

Phase P0-C:
  Abstract common harness from pilots into Family default policy and reusable eval/red-team templates.

Phase P1:
  Engineering expands to devops / security / qa independent divisions.
  Knowledge expands to academic-research / industry-research / analytics.
  Enterprise Ops expands to operations / project-management / product-management.

Phase P2:
  GTM / Content goes live with draft-only + brand/copyright gate.
  Creative / Production goes live with visual evidence + asset provenance.
  Regulated goes live with advisory + mandatory HITL + audit export.
```

### 5.3 Expansion Gate

```text
A division can expand from a pilot template, must satisfy:
  - Inherited FamilyPolicy has passed CI
  - The division has CoverageCard
  - At least one ScenarioCard
  - eval/red-team can run
  - ToolAction risk annotation is complete
  - ROI model is defined
  - No P0 blockers
```

---

## 6. No-go List: Actions Currently Prohibited from Automation

v3.2 must clarify boundaries: the system cannot automate all businesses.

### 6.1 Global No-go

The following actions are prohibited from full automation in v3.2:

```text
1. Automatic payment, transfer, refund, or financial settlement.
2. Automatic trading, ordering, investment, or quantitative strategy live execution.
3. Automatic final medical diagnosis, treatment plan, or prescription advice.
4. Automatic final legal opinion, contract signing advice, or litigation strategy.
5. Automatic deletion of production data, database emptying, or backup destruction.
6. Automatic rollback of production system without approval.
7. Automatic revocation of user/employee permissions without approval.
8. Automatic sending of external legal/financial/medical/HR high-impact notifications.
9. Automatic sending of restricted data to external models.
10. Automatic exporting of customer/employee/regulated data for training.
11. Automatic bypassing of HITL or expanding capability scope.
12. Automatic execution of commands from untrusted issues/PRs/comments/logs.
```

### 6.2 Family-specific No-go

| Family | No-go |
|---|---|
| Engineering | untrusted issue/log → shell command; modifying production IaC without approval; auto-merging PRs |
| Knowledge / Research | Generating accepted conclusions without citations; using expired or revoked sources as authoritative evidence |
| Enterprise Ops | Auto-approving refunds/compensation/permissions; executing customer requests without policy |
| GTM / Content | Auto-spending ad budgets; auto-modifying CRM critical fields; publishing brand content without review |
| Creative / Production | Unprovenanced assets entering production; assets with copyright risk unreviewed |
| Regulated | Auto high-impact decisions; external models processing restricted data; sending final opinions without HITL |

### 6.3 No-go Exception

No-go exceptions may only be used for **controlled, one-time, revocable, auditable** prepared actions and must not be upgraded to long-term open permissions.

Exceptions must simultaneously satisfy:

```text
PreparedAction
+ scoped capability
+ named approver
+ explicit reason
+ expiry
+ audit event
+ rollback/compensation policy
+ riskClass-specific approval count
+ post-action verification
```

Approval requirements:

| RiskClass | Minimum Approval | Additional Requirements |
|---|---|---|
| R3 | 1 named approver | action-scoped TTL |
| R4 | 2 approvers, at least 1 policy/security owner | rollback/compensation policy required |
| R5 | Default prohibited; if exception needed, requires joint approval from accountable owner + policy owner + security owner | No blanket approval; post-action audit required |

No-go exceptions may not be used for:

```text
1. Permanently opening capabilities.
2. Bulk bypassing HITL.
3. Pre-authorizing future actions.
4. Allowing untrusted sources to directly enter shell / workflow / external write sink.
```

---

## 7. Leadership Claim Gate

### 7.1 Why Claim Gate is Needed

Without Claim Gate, README, UI, sales materials, and documentation may prematurely claim:

```text
industry-leading coding agent
production-ready customer service agent
regulated-ready legal agent
```

But without evidence packages behind them. This brings trust risk, compliance risk, and sales misinformation risk.

### 7.2 Permissible Claim Levels

| Claim Level | Permissible Copy | Conditions |
|---|---|---|
| `designed` | "Design completed" | CoverageCard + ScenarioCard |
| `pilot_ready` | "Can enter pilot" | eval/red-team initial version passed |
| `local_leader` | "Achieves leadership in internal pilot scenario" | Has real pilot report and ROI |
| `industry_comparable` | "Aligned with industry benchmark" | Has external benchmark mapping and internal measurement |
| `industry_leading` | "Industry leading" | Passed Leadership Claim Gate |

### 7.3 Claim Gate Conditions

```text
industry_leading claim requires:
  1. Family readiness = industry_leadership_ready
  2. Division status = production_ready
  3. Evidence package complete
  4. Minimum Viable Leading Evidence satisfied
  5. External benchmark mapping exists
  6. EvalDatasetCard clean and frozen
  7. Red-team critical success = 0
  8. ROI confidence >= medium
  9. EvidenceRefs not stale
  10. Claim reviewed by accountable owner + policy owner
```

### 7.4 Claim Governance Schema

The following schemas have corresponding machine-readable implementations:

- [leadership-claim.schema.json](/Users/holden/Project/automatic_agent/automatic_agent_platform/config/division-coverage/schemas/leadership-claim.schema.json:1)
- [records.yaml](/Users/holden/Project/automatic_agent/automatic_agent_platform/config/division-coverage/claims/records.yaml:1)

The current claim lifecycle has formed a closed loop:

- Contract has clearly distinguished `review request` approval status from claim `effectiveStatus`
- Runtime review request supports `approve / reject`
- Runtime claim overlay supports `revoke`
- `expired` continues to be derived from `expiresAt`, no runtime recovery to `approved` provided
- Console, admin API, scanner, and summary statistics jointly consume this governance status

```ts
export interface LeadershipClaimRecord {
  claimId: string;
  familyId: string;
  divisionId?: string;
  scenarioId?: string;

  claimLevel:
    | "designed"
    | "pilot_ready"
    | "local_leader"
    | "industry_comparable"
    | "industry_leading";

  claimText: string;
  allowedSurfaces: Array<"docs" | "ui" | "release_note" | "sales_material" | "readme">;

  evidenceRefs: string[];
  reviewedBy: string[];
  expiresAt: string;
  status: "approved" | "rejected" | "expired" | "revoked";
}
```

### 7.5 Claim Scanner

Among the following scan scopes, the default roots **already implemented and integrated into CI** are:

- `README.md`
- `docs_zh/`
- `docs_en/`
- `ui/`

The scanning logic is located at [audit-leadership-claims.mjs](/Users/holden/Project/automatic_agent/automatic_agent_platform/scripts/ci/audit-leadership-claims.mjs:271), and scan results are written to [leadership-claim-scan-report.json](/Users/holden/Project/automatic_agent/automatic_agent_platform/data/governance/leadership-claim-scan-report.json:1).

Scan paths must also be parameterized according to current repository structure, not hard-coded assumptions that all directories exist. Taking the current repository as an example, at minimum should cover:

- `README.md`
- `docs_zh/`
- `docs_en/`
- `ui/` (when present)
- Other external copy directories (if repository subsequently adds marketing / sales / release notes paths)

If the repository subsequently adds `release notes`, `marketing/`, `sales/` and other external copy directories, these paths should be explicitly added to scanner roots; before that, they should not be stated as facts that "are currently forcibly integrated into CI".

Governance target scope is as follows:

```text
README.md
docs_zh/
docs_en/
ui/
release notes
marketing/sales docs if included
```

Scan keywords:

```text
industry-leading
行业领先
production-ready
企业级就绪
best-in-class
state-of-the-art
regulated-ready
fully autonomous
```

Current implementation semantics are:

```text
1. When a blocked term is hit and it is neither in the allowlist nor hits approved claim text, CI blocks.
2. Expired allowlist is treated as blocking.
3. Approved claims currently allow passage based on surface + claimText hit, not equivalent to finer-grained claim-to-hit binding.
```

The governance target semantics remain: External leadership claims without supported approved `LeadershipClaimRecord` should not pass the release gate.

### 7.6 Claim Scanner Allowlist and False Positive Handling

Claim Scanner allows a very small amount of allowlist, but it must be a **structured allowlist** and cannot use bare keywords to skip.

```ts
export interface LeadershipClaimAllowlistEntry {
  filePath: string;
  matchedText: string;
  reason: string;
  owner: string;
  expiresAt: string;
  replacementSuggestion?: string;
}
```

Allowlist permitted situations:

```text
1. External资料 titles containing industry-leading/state-of-the-art.
2. Governance rules stating "may not claim industry leadership".
3. Historical archived documents with archived / superseded marked at top.
```

Allowlist not permitted situations:

```text
1. User-facing capability claims in README, UI, or release notes.
2. Leadership claims in sales / marketing materials.
3. Permanent allowlist without expiry.
4. Allowlist with empty owner.
```

### 7.7 Claim Scanner Failure Handling

Implementation must integrate `Fail / Warn / Expired allowlist` semantics into existing CI gate; before that, this section is only governance requirement, not current system behavior.

```text
Fail → Blocks release.
Warn → Only allows archived / superseded documents.
Expired allowlist → Auto-upgrades to Fail.
Approved claim expired → Auto-revokes and requires copy replacement.
```

---

## 8. Family-by-Family Final Judgment

> The `by v3.2 / v3.3 / v3.4` in this section are governance stage targets, not already committed release dates, nor current version's completed capability conclusions.

### 8.1 Engineering

**Can achieve industry leadership: Yes, prioritize sprinting.**

Reasons:

```text
1. External benchmarks are clear.
2. Internal ROI is clear.
3. issue-to-PR can form end-to-end closure.
4. ToolRisk / AWI / PatchGate can reflect platform advantages.
```

Must avoid:

```text
1. Only doing code suggestions, not PR adoption.
2. Only looking at test passes, not patch correctness.
3. Only running demo repos, not internal real heldouts.
4. Not handling malicious issues / PR comments / CI logs.
```

v3.2 target:

```text
local_leader by v3.2
industry_comparable by v3.3
industry_leading candidate by v3.4
```

### 8.2 Knowledge / Research

**Can achieve industry leadership: Yes, and is the core of differentiation.**

Reasons:

```text
1. Highly matched with internal knowledge base and research platform.
2. EvidenceGraph / Citation / ExperimentTrace can do differentiation.
3. Data flywheel value is large.
```

Must avoid:

```text
1. Research reports only stacking citations.
2. Citations not verified.
3. Conclusions disconnected from experiments / decisions.
4. Stale docs treated as authoritative.
```

v3.2 target:

```text
local_leader by v3.2
industry_comparable by v3.3
industry_leading candidate by v3.4
```

### 8.3 Enterprise Ops

**Can achieve industry leadership: Yes, but start locally.**

Priority scenarios:

```text
customer-service
support
ticket triage
refund/order/complaint policy
```

Must avoid:

```text
1. Operations scope too broad.
2. No real APIs, only chat.
3. No policy adherence eval.
4. No SLA / handoff / ROI.
```

v3.2 target:

```text
pilot_ready by v3.2
local_leader for customer-service by v3.3
industry_comparable by v3.4
```

### 8.4 GTM / Content

**Can achieve industry leadership: Yes, but do controlled leadership first.**

Priority scenarios:

```text
content draft
brand safety review
copyright risk check
CRM draft update
campaign analysis
```

Not recommended to do first:

```text
automatic ad spend
automatic CRM critical write
automatic customer commitment
automatic public publishing
```

v3.2 target:

```text
governance_ready by v3.2
pilot_ready by v3.3
local_leader in controlled draft/review by v3.4
```

### 8.5 Creative / Production

**Can achieve industry leadership: Short-term comprehensive leadership commitment is not advisable; can first do evidence governance leadership.**

Priority scenarios:

```text
Figma / screenshot / DOM evidence
visual diff
design token compliance
asset provenance
copyright risk
```

Not recommended to do first:

```text
fully automatic production asset release
unreviewed brand asset publishing
unreviewed manufacturing instruction
```

v3.2 target:

```text
governance_ready by v3.2
pilot_ready by v3.3
local_leader in evidence/provenance by v3.4
```

### 8.6 Regulated

**Can achieve industry leadership: Yes, but defined as safety governance leadership, not autonomous leadership.**

Priority scenarios:

```text
advisory
evidence collection
policy mapping
audit export
human review acceleration
```

Automation not recommended:

```text
legal final advice
medical diagnosis
financial transaction
HR high-impact decision
trading
insurance claim final decision
```

v3.2 target:

```text
governance_ready by v3.2
pilot_ready for advisory workflows by v3.3
local_leader in governance/audit/HITL by v3.4
```

---

## 9. v3.2 Release Criteria

As a mandatory governance baseline, v3.2 must at minimum satisfy:

```text
1. Family-level Leadership Readiness Table completed.
2. Each Family has readiness status.
3. Each Family has External Benchmark Map.
4. Each Family has Minimum Viable Leading Evidence.
5. No-go List written into ToolRisk / ReleaseGate.
6. Leadership Claim Gate schema completed.
7. Claim scanner covers at minimum README, docs, and UI copy.
8. Engineering / Knowledge / Customer-Service three P0 pilots bound to expansion path.
9. Regulated Family clearly states "safety governance leadership, not autonomous leadership".
10. All production_ready / industry-leading claims must be traceable to EvidencePackage.
```

---

## 10. Release Governance and Operational DoD

### 10.1 Release Criteria Owner / RACI

| Criteria | Owner |
|---|---|
| Family readiness status | Platform Governance Owner |
| Benchmark Map | Eval Owner |
| Minimum Leading Evidence | Family Technical Owner + Eval Owner |
| No-go Policy | Policy Owner + Security Owner |
| Leadership Claim schema | Platform Governance Owner |
| Claim Scanner | CI / Quality Owner |
| P0 Pilot expansion path | Pilot Technical Owner |
| Regulated no-autonomy statement | Policy Owner |
| EvidencePackage traceability | Evidence / Observability Owner |

### 10.2 Admin Console DoD

The current repository provides Release Console `leadership-claims` subpage, and corresponding governance snapshot / review request / approve / reject / revoke API. The following items have been implemented as this version's boundary:

```text
1. Display each Family's readiness status, claim level, expiry, and owner.
2. Display each claim's evidenceRefs and freshness.
3. Support viewing Claim Scanner hits, allowlist, and expired allowlist.
4. Support review request approve / reject, and cannot bypass CI gate.
5. Support approved claim revoke, and claim revoked / expired status highlighted in red in UI.
6. Frontend may not locally mock industry_leading / production_ready.
```

Must also remain consistent with [admin_console_and_human_takeover_contract.md](/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/contracts/admin_console_and_human_takeover_contract.md:1); if claim review / revoke / expiry process needs new status or approval actions, contract should be updated first, then UI DoD and implementation.

### 10.3 v3.2 Promotion Criteria

If v3.2 is to be promoted to Final Release, must satisfy:

```text
1. Release Scope has been clarified.
2. This document does not certify any current Family/Division as industry_leading.
3. Family Readiness Table, Benchmark Map, Minimum Evidence, No-go, and Claim Gate are complete.
4. Claim Scanner has allowlist/expiry/revocation mechanism.
5. Regulated Family clearly pursues safety governance leadership, not high autonomy.
6. References / Industry Evidence Appendix is complete.
7. All implementation items in document/implementation status checklist are `done`.
```

Current conclusion: **Has passed v3.2 Governance Baseline promotion conditions and can be released.**

## 11. v3.2 TodoList

| Priority | Status | Task | Artifact | Note |
|---:|---|---|---|---|
| P0 | `done` | Add Family Readiness configuration | `config/division-coverage/family-readiness.yaml` | Implemented |
| P0 | `done` | Add Benchmark Map | `config/division-coverage/benchmark-map.yaml` | Implemented |
| P0 | `done` | Add Minimum Leading Evidence | `config/division-coverage/minimum-leading-evidence.yaml` | Implemented |
| P0 | `done` | Add No-go Policy | `config/policy/no-go-actions.yaml` | Implemented |
| P0 | `done` | Add Leadership Claim schema | `config/division-coverage/schemas/leadership-claim.schema.json` | Implemented |
| P0 | `done` | Add Claim Scanner | `scripts/ci/audit-leadership-claims.mjs` | Implemented and integrated into `audit:repo-hygiene` |
| P0 | `done` | Update Admin Console | Added Leadership Claims page | Implemented `Release Console` subpage, API client, and review request flow |
| P1 | `done` | Add Family expansion reports | `docs_en/divisions/family-expansion/` | Six family reports completed |
| P1 | `done` | Add Benchmark calibration plan | `docs_zh/quality/benchmark-calibration.md` | Completed as matrix-style calibration document |
| P1 | `done` | Add regulated no-autonomy guard | ToolGateway / ReleaseGate rule | ToolGateway and StableReleaseGate forcibly integrated |
| P1 | `done` | Complete claim review / revoke / expiry operator workflow | governance service / admin API / UI / scanner | review request approval, claim revoke, and derived expiry have closed the loop |

---

## 12. Final Conclusion

v3.1 has already designed the evidence system required for division industry leadership completely. v3.2 further clarifies:

```text
Not every Family leads in the same way.
Not every Family should pursue high autonomy.
Not having a demo means you can claim industry leadership.
```

Governance direction judgment:

```text
Engineering: Can prioritize pursuing industry leadership.
Knowledge / Research: Can be differentiated industry leadership.
Enterprise Ops: First lead locally in customer-service/support.
GTM / Content: First do controlled scenarios and brand/copyright governance leadership.
Creative / Production: First do multimodal evidence and asset governance leadership.
Regulated: Only do safety governance, audit, and HITL leadership, not high autonomy leadership.
```

Current applicable principles:

> **Any Family or Division may only claim "industry leading" after passing the Leadership Claim Gate. Industry leadership must be proven by EvidencePackage, not demonstrated by documentation slogans.**

Supplementary notes:

- This overall direction is an improvement to the current system, especially filling gaps in claim governance, family-specific benchmark, and no-go policy.
- The current biggest risk is not the design direction, but rather subsequent implementation bypassing scanner / claim review / SOT bridge, which would cause documentation and code to diverge again.
- Current implementation has been integrated with `division-catalog` / `source_of_truth` bridging; subsequent extensions still cannot maintain a second set of family SOT in parallel.

---

## 13. References / Industry Evidence Appendix

> This appendix is the industry evidence checklist for the v3.2 governance baseline. It supports benchmark mapping, family readiness, and claim gate design and does not equal any Family having passed industry_leading claim.

### 13.1 Coding / Engineering Agent

| Resource | Usage |
|---|---|
| GitHub Copilot coding agent docs — https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent | Illustrating that coding agent has entered repository research, plan, branch changes, and PR workflows |
| SWE-bench Verified — https://www.swebench.com/verified.html | Real GitHub issue benchmark, Verified is 500 human-filtered instances |
| AIDev: Studying AI Coding Agents on GitHub — https://arxiv.org/abs/2602.09185 | Real Agentic PR dataset and adoption study |
| Failed Agentic PR empirical study — https://arxiv.org/abs/2601.15195 | PR non-merge reasons, CI, review dynamics, duplicate/unwanted PR, and other failure modes |
| Claude Code docs — https://code.claude.com/docs/en/overview | Agentic coding tool benchmark |
| Devin docs — https://docs.devin.ai/get-started/devin-intro | Autonomous software engineering agent benchmark |

### 13.2 Tool Use / Function Calling / MCP

| Resource | Usage |
|---|---|
| Berkeley Function Calling Leaderboard V4 — https://gorilla.cs.berkeley.edu/leaderboard.html | tool/function call accuracy benchmark |
| τ-bench — https://github.com/sierra-research/tau-bench | Dynamic user-agent-tool interaction and domain policy adherence |
| MCP Authorization Specification 2025-06-18 — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | Protected Resource Metadata / authorization server binding |
| MCP Authorization Specification 2025-11-25 — https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization | New version authorization specification reference |

### 13.3 Computer-use / Web Agent / Multimodal Agent

| Resource | Usage |
|---|---|
| OSWorld — https://os-world.github.io/ | Real computer environment, execution-based evaluation, open-ended computer tasks |
| WebArena — https://webarena.dev/ | Realistic web environment, e-commerce/forum/collaborative development/CMS |
| VisualWebArena — https://arxiv.org/abs/2401.13649 | Visual grounding web agent evaluation |

### 13.4 Enterprise Agent Platform / Runtime / Observability

| Resource | Usage |
|---|---|
| OpenAI Agents SDK — https://developers.openai.com/api/docs/guides/agents | Agent runtime, tools, and stateful multi-step work reference |
| OpenAI Agents SDK Tracing — https://openai.github.io/openai-agents-python/tracing/ | LLM generations, tool calls, handoffs, guardrails, and custom events tracing |
| OpenTelemetry GenAI agent spans — https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/ | Agent/framework span semantic mapping |
| OpenTelemetry GenAI spans — https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/ | GenAI trace / span semantic conventions |
| Google Gemini Enterprise Agent Platform — https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-agent-platform | Build / scale / govern / optimize enterprise agents direction reference |
| Microsoft Copilot Studio security and governance — https://learn.microsoft.com/en-us/microsoft-copilot-studio/security-and-governance | Enterprise agent governance reference |
| Salesforce Agentforce Builder / guardrails — https://www.salesforce.com/agentforce/agent-builder/ | Enterprise agent builder, actions, and guardrails reference |
| IBM watsonx Orchestrate — https://www.ibm.com/products/watsonx-orchestrate | No-code/pro-code workflow agent reference |

### 13.5 Security / Governance / Regulated AI

| Resource | Usage |
|---|---|
| OWASP AI Agent Security Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html | Agent-specific security testing, tool least privilege, prompt injection, and memory protection |
| NIST AI RMF Generative AI Profile — https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence | GenAI risk management profile |
| CSA Agentic NIST AI RMF Profile — https://labs.cloudsecurityalliance.org/agentic/agentic-nist-ai-rmf-profile-v1/ | Agent autonomy, tool-use risk, runtime governance, and delegation accountability |
| Agentic Workflow Injection — https://arxiv.org/abs/2605.07135 | GitHub Actions / issue / PR / comment workflow injection risk reference |

---

## 14. Appendix A: Landed Directories and Subsequent Expansion Locations

> The governance artifacts in the following directories have all been landed, including family expansion reports, runtime governance overlays, and scanner outputs.

```text
config/division-coverage/
├── family-readiness.yaml
├── benchmark-map.yaml
├── minimum-leading-evidence.yaml
├── schemas/
│   └── leadership-claim.schema.json
└── claims/
    ├── allowlist.yaml
    └── records.yaml

config/policy/
└── no-go-actions.yaml

scripts/ci/
└── audit-leadership-claims.mjs

data/governance/
├── leadership-claim-review-requests.json
├── leadership-claim-status-overrides.json
└── leadership-claim-scan-report.json

docs_en/divisions/
├── coding/
├── customer-service/
├── family-expansion/
├── family-readiness.md
├── knowledge-base/
└── leadership-claims.md
```

---

## 15. Appendix B: Leadership Claim Gate Example

> The following YAML is for illustrating the current schema target structure; actual records in the repository can be found in `config/division-coverage/claims/records.yaml`.

```yaml
claimId: engineering-coding-local-leader-v3-2
familyId: engineering
divisionId: coding
scenarioId: issue-to-patch

claimLevel: local_leader
claimText: "coding division achieves local leadership in internal issue-to-patch pilot."
allowedSurfaces:
  - docs
  - release_note
  - ui

evidenceRefs:
  - eval://divisions/coding/swe-style/report-2026-05-01
  - redteam://families/engineering/awi/report-2026-05-01
  - dashboard://divisions/coding/roi/week-2026-05-01

reviewedBy:
  - engineering-platform-owner
  - security-governance-owner

expiresAt: 2026-08-01T00:00:00Z
status: approved
```

---

## 16. Appendix C: No-go Policy Example

```yaml
noGoActions:
  - id: no-auto-payment
    description: Prohibit automatic payment, transfer, refund, financial settlement
    riskClass: R5
    allowedException:
      requiresPreparedAction: true
      requiresHITL: true
      requiresMultiApprover: true

  - id: no-untrusted-command-execution
    description: Prohibit directly converting untrusted issue/PR/comment/log content into shell commands
    riskClass: R4
    blockSinks:
      - shell
      - workflow_yaml
      - external_request

  - id: no-final-medical-legal-financial-advice
    description: Prohibit automatic output of final medical, legal, financial high-impact conclusions
    riskClass: R5
    allowedMode:
      - advisory
      - draft
      - evidence_summary
```


---

## 17. Final Governance Declaration

```text
Release Name: Automatic Agent Platform v3.2 — Family Leadership Readiness & Claim Gate
Release Type: Final Governance Baseline
Release Status: Released
Effective Scope: Family-level readiness, claim governance, no-go policy, benchmark map, minimum evidence, leadership claim gate, CI scanner, governance API, and release console governance surface
Certification Scope: None. This release does not certify any Family or Division as industry-leading.
Blocking Gaps: No release-blocking P0 or P1 gaps remain for the v3.2 governance baseline itself.
Next Baseline: v3.3 should extend more family-specific evidence bindings, tighter claim-hit traceability, and broader governance reuse without weakening the current claim gate.
```

Current decision: **Ready for v3.2 final governance release.**
