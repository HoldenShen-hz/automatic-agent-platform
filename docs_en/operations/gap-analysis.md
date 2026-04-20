# Gap Analysis

> This document only keeps three types of content: module-level gaps, stability-related entries, and historical gap archive index.

## 1. Module Acceptance Matrix

**Main Document**: `module_remediation_backlog.md`

Source: `module_acceptance_criteria_matrix.md` (archived)

Known defects and items to fix by module:

| Module | Typical Issues | Priority |
|--------|---------------|----------|
| `phase1a-store` | delegating core still has significant type bridging, legacy compat still large | P1 |
| `phase1b-orchestration` | 2172-line giant monolith | P1 |
| `authoritative-task-store-legacy-compat` | methods files deleted, but legacy compat still carries significant compatibility semantics, needs continued convergence to each Repository | P1 |
| `event-ops-service` | Incomplete retry/dead letter | P2 |
| `memory-service` | Missing write gate / no deduplication | P2 |
| `experience-cache-service` | No TTL eviction | P2 |
| `gateway-delivery-service` | 1129 lines, too many responsibilities | P2 |
| `http-api-server` | No route table abstraction | P2 |

See `module_remediation_backlog.md` for the complete fix list.

## 2. Stability Hardening Plan

Current stability-related entries:

| Document | Purpose |
|----------|---------|
| `archive/stability_hardening_plan.md` | Overall stability hardening plan |
| `archive/stable_core_scope.md` | Stable Core scope definition |
| `archive/stable_launch_execution_plan.md` | Pre-launch rehearsal execution plan |
| `archive/stable_runtime_validation_plan.md` | Runtime validation plan |
| `archive/process_safety_and_observablility.md` | Process safety and observability |
| `../reviews/readiness_review.md` | Current stable operation blockers and pre-launch hard blockers |

## 3. System Gap Analysis History

Source archived files: `archive/system_gap_analysis.md`, `archive/system_gap_analysis_20260412.md`, `archive/system_gap_analysis_20260412a.md`

| Source File | Date | Main Content |
|-------------|------|-------------|
| `archive/system_gap_analysis.md` | 2026-04-12 early | System-level initial gap analysis |
| `archive/system_gap_analysis_20260412.md` | 2026-04-12 | Second round gap analysis, wrapping up build/test separation, stable-runner-factory expanded adoption, etc. |
| `archive/system_gap_analysis_20260412a.md` | 2026-04-12a | Third round gap analysis, completing cache orchestration, agent team, memory plane layering, etc. |

See each archived file for detailed gap analysis content.

## 4. Boundaries with Tracking Documents

- **Progress tracking** → See `project_progress_tracker.md`
- **Phase and scope plan** → See `implementation_plan.md`
- **Current Sprint todo** → See `current_todo_list.md`
- **Overall status overview** → See `../reviews/current_status_and_gap_analysis.md`
- **This document's responsibilities** → Module-level defect analysis, stability hardening plan, historical gap analysis archiving

## 5. Archived File Index

| Original File | Archive Reason |
|---------------|---------------|
| `system_gap_analysis_20260412.md` | Integrated into this document Section 3 |
| `system_gap_analysis_20260412a.md` | Integrated into this document Section 3 |
| `module_acceptance_criteria_matrix.md` | Integrated into `module_remediation_backlog.md` |
| `stability_hardening_plan.md` | Archived to `archive/` |
| `stable_core_scope.md` | Archived to `archive/` |
| `stable_launch_execution_plan.md` | Archived to `archive/` |
| `stable_runtime_validation_plan.md` | Archived to `archive/` |
| `process_safety_and_observablility.md` | Archived to `archive/` |

## 6. Document Maintenance Rules

- Find new defect → Enter in `module_remediation_backlog.md`
- Stability drill completed → Update `project_progress_tracker.md` / `current_status_and_gap_analysis.md`, archive when necessary
- Sprint todo → Update `current_todo_list.md`
- Major milestone → Update `project_progress_tracker.md`
- This document records module-level gap analysis and historical archiving; does not maintain active progress
