# Operations

> `operations/` retains only plans, progress, operations, and validation documents that still have execution value.

## 1. Current Document Index

| Document | Role | Update Frequency |
| --- | --- | --- |
| [`implementation_plan.md`](./implementation_plan.md) | Phase and scope master plan | On phase boundary changes |
| [`operations-roadmap.md`](./operations-roadmap.md) | Development order, architecture upgrade, production readiness, and improvement roadmap | On batch switching |
| [`project_progress_tracker.md`](./project_progress_tracker.md) | Current project progress snapshot | After milestones |
| [`current_todo_list.md`](./current_todo_list.md) | Current active execution checklist | On current priority changes |
| [`operations-checklist.md`](./operations-checklist.md) | Pre-coding check, pre-release check, documentation completion gate | Before release |
| [`operations-tracker.md`](./operations-tracker.md) | Lightweight index page | Less frequent updates |
| [`runbook.md`](./runbook.md) | Operations runbook entry point | On playbook changes |
| [`runbooks/incident-response-playbook.md`](./runbooks/incident-response-playbook.md) | Incident response | On playbook changes |
| [`runbooks/runbook-plugin-failure.md`](./runbooks/runbook-plugin-failure.md) | Plugin failure handling | On playbook changes |
| [`runbooks/runbook-high-error-rate.md`](./runbooks/runbook-high-error-rate.md) | High error rate handling | On playbook changes |
| [`runbooks/runbook-database-issues.md`](./runbooks/runbook-database-issues.md) | Database issue handling | On playbook changes |
| [`runbooks/runbook-memory-pressure.md`](./runbooks/runbook-memory-pressure.md) | Memory pressure handling | On playbook changes |
| [`src_module_test_matrix.md`](./src_module_test_matrix.md) | Source module test matrix | On test structure changes |
| [`test_coverage_baseline_gate.md`](./test_coverage_baseline_gate.md) | Coverage baseline threshold | On coverage rule changes |
| [`capacity-planning.md`](./capacity-planning.md) | Capacity planning | On planning cycle update |
| [`cross-region-validation.md`](./cross-region-validation.md) | Cross-region validation | On scheme adjustment |
| [`hot-upgrade-validation.md`](./hot-upgrade-validation.md) | Hot upgrade validation | On scheme adjustment |

## 2. Finding Entry Points by Task

| Task | Recommended Entry |
| --- | --- |
| See current progress | `project_progress_tracker.md` |
| See what to do next | `current_todo_list.md` |
| See current allowed phase | `implementation_plan.md` |
| See development order and dependencies | `operations-roadmap.md` |
| Pre-coding checks | `operations-checklist.md` |
| See operations handling entry | `runbook.md` |
| See test coverage baseline | `test_coverage_baseline_gate.md` |

## 3. Writing Rules

- Operations documents serve execution and do not replace master plans, ADRs, and contracts.
- Operations documents should remain current; outdated content should be deleted or consolidated, with no pseudo-entry points retained.
- Phase boundary changes first update `implementation_plan.md`; batch order changes then update `operations-roadmap.md`.
- Actual state changes are written back to `project_progress_tracker.md`.

## 4. Boundaries with Other Directories

- `operations/` is responsible for "how to advance, how to validate, how to run".
- `architecture/` is responsible for "what the overall system is".
- `contracts/` is responsible for "what implementations must comply with".
- `analysis/` is responsible for "what is currently covered and to what extent".
