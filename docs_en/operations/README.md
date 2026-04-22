# Operations

> `operations/` only keeps documents needed for current execution.
> The new platform does not keep the old-system review/archive chain; this folder keeps only documents with current execution value.

## 1. Current Document Index

| Document | Role | Update Frequency |
|----------|-------|-----------------|
| [`implementation_plan.md`](./implementation_plan.md) | Phase and scope master plan (Phase 1a→4) | On milestone change |
| [`operations-roadmap.md`](./operations-roadmap.md) | Roadmap unified document (development order, architecture upgrade, production readiness, system improvement) | On batch or roadmap adjustment |
| [`operations-checklist.md`](./operations-checklist.md) | Checklist unified document (release hard checklist, pre-coding checklist, documentation completion gate) | Before version release |
| [`gap-analysis.md`](./gap-analysis.md) | Module gaps, stability plan, and historical gap entry | On structure adjustment |
| [`project_progress_tracker.md`](./project_progress_tracker.md) | Current project progress snapshot | After milestone |
| [`current_todo_list.md`](./current_todo_list.md) | Current active todos | When current priorities change |
| [`operations-tracker.md`](./operations-tracker.md) | Lightweight index page | Rarely updated |
| [`module_remediation_backlog.md`](./module_remediation_backlog.md) | Defect and fix backlog by module | Discovered and entered |
| [`runbook.md`](./runbook.md) | Operations runbook entry | On playbook change |
| [`runbooks/incident-response-playbook.md`](./runbooks/incident-response-playbook.md) | Incident response | On playbook change |
| [`runbooks/runbook-plugin-failure.md`](./runbooks/runbook-plugin-failure.md) | Plugin failure handling | On playbook change |
| [`runbooks/runbook-high-error-rate.md`](./runbooks/runbook-high-error-rate.md) | High error rate handling | On playbook change |
| [`runbooks/runbook-database-issues.md`](./runbooks/runbook-database-issues.md) | Database issues handling | On playbook change |
| [`runbooks/runbook-memory-pressure.md`](./runbooks/runbook-memory-pressure.md) | Memory pressure handling | On playbook change |
| [`src_module_test_matrix.md`](./src_module_test_matrix.md) | Source module test matrix | On test structure change |
| [`test_coverage_baseline_gate.md`](./test_coverage_baseline_gate.md) | Coverage baseline threshold | On coverage rule change |
| [`capacity-planning.md`](./capacity-planning.md) | Capacity planning | On planning cycle update |
| [`cross-region-validation.md`](./cross-region-validation.md) | Cross-region validation | On plan adjustment |
| [`hot-upgrade-validation.md`](./hot-upgrade-validation.md) | Hot upgrade validation | On plan adjustment |

## 2. Finding Entry Point by Task

| Task | Recommended Entry |
|------|-------------------|
| See overall project progress | `project_progress_tracker.md` |
| See what to do next | `current_todo_list.md` |
| Pre-coding checks before starting | `operations-checklist.md` § 2 Pre-Coding Checklist |
| Top 20 hard checklist before launch | `operations-checklist.md` § 1 Pre-Launch Checklist |
| See Phase 1a landing order | `implementation_plan.md`, `phases/phase-1a-foundation.md` |
| See development batch order and dependencies | `operations-roadmap.md` § 1 Development Sequence |
| See long-term architecture upgrade line | `operations-roadmap.md` § 2 Architecture Upgrade |
| See industrial production readiness roadmap | `operations-roadmap.md` § 3 Industrial Production Readiness |
| See system improvement priorities | `operations-roadmap.md` § 4 System Improvement |
| See remediation backlog broken down by module | `module_remediation_backlog.md` |
| See module gaps and historical gaps | `gap-analysis.md` |
| See all phase progression documents | `phases/README.md` |

## 3. Writing Rules

- Operations documents serve execution, do not replace main outline, ADR, and contract.
- Each execution plan should try to associate with target contract, main document, or ADR.
- Operational documents should remain timely; outdated content should be deleted or folded into current documents.
- Completed long-form running logs should not continue to pile up in active entry documents.
- If architectural factual source is found insufficient during execution, should first supplement main document or contract, then continue.
- When finding main architecture, phase boundary, or acceptance criteria changes, first update `implementation_plan.md`, then synchronize roadmap and checklist.

## 4. Boundary with Other Directories

- `operations/` is responsible for "how to push forward".
- `automatic_agent_platform/`, `01` ~ `07`, and `contracts/` define "what the platform should be".
- `contracts/` is responsible for "what must implementation abide by".
- `01` ~ `07` is responsible for "what is the overall system".
