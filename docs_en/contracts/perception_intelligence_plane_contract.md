# Perception Intelligence Plane Contract

> Compatibility note: Filename is kept to maintain historical reference stability; current target-state semantics align with `ObserveHub + AssessHub` dual stages, not a single perception plane.

## 1. Scope

This contract defines the Observe / Assess target-state plane, including source ingestion, dedupe, context build, assessment, and controlled suggestion output.

It extends `perception_contract.md` to answer "how the system continuously collects signals, forms `TaskSituation`, and provides structured assessment suggestions in the Assess stage."

## 2. Goals

- Elevate Observe and Assess from loosely auxiliary capabilities to independent stage planes.
- Ensure signal flow is decoupled from the main task chain but can be connected to execution chain through authorization.
- Make cost, authorization, duplicate information, and assessment quality first-class capabilities.

## 3. Key Components

- `SourceIngestionPipeline`
- `SignalNormalizer`
- `DeduplicationService`
- `TaskSituationBuilder`
- `AssessmentEngine`

## 4. Key Objects

- `ObserveSource`
- `ObserveSignal`
- `SignalCluster`
- `TaskSituation`
- `UnifiedAssessment`

## 5. UnifiedAssessment Minimum Fields

- `assessment_id`
- `task_id`
- `loop_iteration`
- `task_situation_ref`
- `failure_modes`
- `success_criteria`
- `recommended_path`
- `generated_at`

## 6. Behavioral Constraints

- Observe / Assess by default only produce signals, situations, and suggestions and do not directly modify the main task chain.
- Before actively triggering tasks, must pass authorization, budget, and governance verification.
- Duplicate content must go through dedupe / cluster processing.
- Assessment products must be traceable to signal ref / task situation ref.

## 7. Relationship with Existing Documents

- `perception_contract.md` retains the Observe minimum object model.
- This contract defines Observe + Assess as the complete form of an independent plane.
- `governance_control_plane_contract.md` should constrain the authorization path for action proposal / assessment recommendation.

## 8. Phased Introduction

- Phase 3: source ingestion + task situation + assessment MVP.
- Phase 4: enterprise sources, team sharing, and multi-tenant Observe/Assess boundaries.

## 9. Supplementary Rules

- Ranking at minimum synthesizes: relevance, importance, timeliness, source credibility, and post-deduplication coverage.
- Source trust scoring at minimum divides: `low | medium | high | verified`.
- Assessment freshness should define SLA by source type, e.g., short window for high-frequency sources, long window for low-frequency sources.
