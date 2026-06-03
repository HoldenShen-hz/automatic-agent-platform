# Family Governance Competitive Calibration

## Goal

Turn the external platform comparisons referenced in `automatic_agent_platform_v3_2_final_release.md` from slogans into fixed governance inputs. Define what we compare, what we do not compare, and how those calibrations feed family benchmarks and claim review.

## Competitive Calibration Matrix

| Platform | Primary benchmarked family | Governance signal we adopt | What we do not copy directly | Repository consumption path |
| --- | --- | --- | --- | --- |
| Gemini Enterprise | Knowledge / Research, Regulated | citation grounding, workspace evidence, audit traceability | treating “connected to enterprise search” as direct proof of leadership | `benchmark-map.yaml` + `benchmark-calibration.yaml` + claim review `evidenceRefs` |
| Copilot Studio | Engineering, Enterprise Ops | connector governance, tool-calling discipline, approval boundaries | turning connector count into a capability score | benchmark calibration / release gate policy and rollback consumption |
| Agentforce | Enterprise Ops, GTM / Content | workflow orchestration, handoff, customer-facing policy adherence | allowing customer-visible writes to pass directly under autonomy | `family-expansion.yaml` + no-go policy + tool risk |
| watsonx Orchestrate | Enterprise Ops, Regulated | runbook / approval / audit export compliance | using traditional BPM coverage as a substitute for agent safety | regulated no-autonomy guard + audit export completeness |

## Reconciliation Rules

1. Competitive platforms are benchmark coordinates only; they are not direct evidence for `industry_leading`.
2. Every calibration conclusion must map to the family’s `internalMappings`, `minimum-leading-evidence`, or claim `evidenceRefs`.
3. If an external platform emphasizes platform breadth, we only absorb governance constraints that can be machine-checked; marketing claims must not become internal claims.
4. When a calibrated platform is added or replaced, update all of the following together:
   - `config/division-coverage/benchmark-map.yaml`
   - `config/division-coverage/benchmark-calibration.yaml`
   - this document

## Current Status

- v3.2 already has benchmark refs, a claim scanner, no-go policy, and a release-console baseline.
- This document fixes Gemini Enterprise / Copilot Studio / Agentforce / watsonx Orchestrate as reviewable governance inputs instead of leaving them as review-note commentary.
