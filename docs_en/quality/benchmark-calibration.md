# Benchmark Calibration Plan

## Objective

Align Family-level external benchmarks with the current platform's internal evidence, release gate, and claim gate - preventing "reference benchmarks" from being misrepresented as "passed claims".

## Calibration Principles

- External benchmarks only define reference coordinates and do not directly equate to internal claim conclusions.
- Internal metrics must be mappable to `EvidencePackage`, `ScenarioCard`, `EvalDatasetCard`, `RedTeam`, or release evidence.
- Claim level upgrades must simultaneously consider capability, safety, evidence, and operation - a single leaderboard may not substitute for governance conclusions.
- The release gate consumes "whether governance assertions are satisfied"; the claim review consumes "whether evidence is sufficient to support external claims".

## Calibration Matrix

| Family | External benchmark | Internal metric / evidence artifact | Owner | Refresh cadence | Release gate / claim review consumption |
|---|---|---|---|---|---|
| Engineering | SWE-bench Verified / BFCL / agentic PR studies | `patch_correctness`, `pr_acceptance`, `awi_redteam`, `eval://divisions/coding/*` | Engineering Eval Owner + Eng Platform Owner | monthly | release gate focuses on correctness / rollback / unsafe command; claim review focuses on heldout scale, PR acceptance rate, and red-team results |
| Knowledge / Research | citation grounding / OTel GenAI spans / source-grounded QA studies | `citation_verifier`, `source_reliability`, `claim_evidence_graph`, `stale_doc_detector` | Knowledge Eval Owner + Knowledge Governance Owner | bi-weekly | release gate focuses on stale source / evidence completeness; claim review focuses on citation sample size and conclusion traceability |
| Enterprise Ops | tau-bench / policy adherence / workflow handoff studies | `policy_adherence`, `handoff_audit`, `sla_dashboard`, `roi_report` | Ops Eval Owner + Service Ops Owner | bi-weekly | release gate focuses on policy fail-close / handoff / SLA; claim review focuses on real pilot tasks and ROI |
| GTM / Content | brand safety / copyright / commerce action benchmarks | `brand_safety_eval`, `copyright_risk_eval`, `crm_action_safety`, `campaign_roi` | GTM Governance Owner + Growth Ops Owner | monthly | release gate focuses on unreviewed publishing and critical CRM writes; claim review focuses on human review pass rate and copyright risk closure |
| Creative / Production | OSWorld / WebArena / VisualWebArena / visual grounding studies | `visual_grounding_eval`, `visual_regression`, `asset_provenance`, `copyright_risk_eval` | Creative Eval Owner + Design Systems Owner | monthly | release gate focuses on asset provenance and visual regression; claim review focuses on multimodal evidence completeness and human creative review |
| Regulated | NIST / OWASP / CSA agentic governance profiles | `hitl_coverage`, `audit_export_completeness`, `data_residency`, `restricted_data_redteam` | Policy Owner + Security Owner | monthly or on policy change | release gate directly consumes no-autonomy guard; claim review only permits external statements within advisory / audit / evidence acceleration scope |

## Operating Steps

1. Declare benchmark refs and internal metric mappings for each Family in `benchmark-map.yaml`.
2. Bind owner, evidence artifact, and refresh cadence to each mapping.
3. Establish replayable heldout / red-team for areas where external benchmarks differ significantly from internal real tasks.
4. Explicitly write governance assertions that the release gate must consume into gate criteria - do not rely on documentation implications.
5. Solidify evidence completeness, freshness, and owner signoff that the claim review must check into the operator workflow.

## v3.2 Baseline Conclusion

- `benchmark-map.yaml` has provided machine-readable benchmark refs and internal mapping foundation.
- This document now supplements owner, refresh cadence, and release gate / claim review consumption paths.
- When adding new benchmarks in the future, this document and `config/division-coverage/benchmark-map.yaml` must both be updated - otherwise calibration cannot be claimed as complete.