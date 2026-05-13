# Perception Intelligence Plane Contract

---

## OAPEFLIR Relevance

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

> **Compatibility Note**: The filename is preserved to maintain historical reference stability; the current target-state semantics are aligned with `ObserveHub + AssessHub` dual stages, not a single perception plane.

## 1. Scope

This contract defines the Observe / Assess target-state plane, including source ingestion, deduplication, context building, assessment, and controlled suggestion output.

It extends `perception_contract.md` to answer "how the system continuously collects signals, forms `TaskSituation`, and provides structured assessment suggestions during the Assess stage".

## 2. Goals

- Elevate Observe and Assess from loosely coupled auxiliary capabilities to independent stage planes.
- Ensure signal flow is decoupled from the main task chain, but can be authorized to connect to the execution chain.
- Make cost, authorization, duplicate information, and assessment quality first-class capabilities.

## 3. Key Components

- `SourceIngestionPipeline`
- `SignalNormalizer`
- `DeduplicationService`
- `TaskSituationBuilder`
- `SystemSituationBuilder`
- `ObservationAggregator`
- `AssessmentEngine`
- `ExecutionOutcomeEvaluator`

## 4. Key Objects

- `ObserveSource`
- `ObserveSignal`
- `SignalCluster`
- `TaskSituation`
- `SystemSituation`
- `UnifiedObservation`
- `UnifiedAssessment`
- `ExecutionAssessment`

## 5. UnifiedAssessment Minimum Fields

- `assessment_id`
- `task_id`
- `loop_iteration`
- `task_situation_ref`
- `failure_modes`
- `success_criteria`
- `recommended_path`
- `generated_at`

## 5.1 ExecutionAssessment Minimum Fields (Post-Execution Assessment)

`ExecutionAssessment` is a four-dimensional assessment after Execute stage completion:

- `execution_id`
- `correctness_score`: Failure category ratio in feedback.signals (0-1)
- `completeness_score`: steps completed / total steps (0-1)
- `efficiency_score`: actual tokens / expected budget ratio (0-1)
- `safety_score`: tool permission denial / sandbox violation signals (0-1)
- `overall_score`: Weighted average (correctness:0.3, completeness:0.3, efficiency:0.2, safety:0.2)
- `verdict`: `pass (≥0.7) | marginal (0.5-0.7) | fail (<0.5)`
- `generated_at`

When verdict is `fail`, Replan is automatically triggered.

## 6. Behavioral Constraints

- Observe / Assess only produces signals, situations, and suggestions by default, without directly modifying the main task chain.
- Active task triggering before execution must pass authorization, budget, and governance validation.
- Duplicate content must go through dedupe / cluster processing.
- Assessment products must be traceable to signal ref / task situation ref.

## 7. Relationship with Existing Documents

- `perception_contract.md` preserves the Observe minimum object model.
- This contract defines Observe + Assess as the complete form of an independent plane.
- `governance_control_plane_contract.md` should constrain the authorization path for action proposals / assessment recommendations.

## 8. Phased Introduction

- Phase 3: Source ingestion + task situation + assessment MVP.
- Phase 4: Enterprise sources, team sharing, and multi-tenant Observe/Assess boundaries.

## 9. Supplementary Rules

- Ranking must comprehensively consider: relevance, importance, timeliness, source trustworthiness, post-deduplication coverage.
- Source trust scoring must at minimum distinguish: `low | medium | high | verified`.
- Assessment freshness should define SLA by source type, such as short windows for high-frequency sources and long windows for low-frequency sources.