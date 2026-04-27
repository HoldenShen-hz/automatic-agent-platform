# Operations

> `operations/` only retains plans, progress, operations, and validation documents that still have execution value.

## 1. Current Document Index

| Document | Role | Update Frequency |
| --- | --- | --- |
| [`implementation_plan.md`](./implementation_plan.md) | Phase and scope master plan | On phase boundary changes |
| [`operations-roadmap.md`](./operations-roadmap.md) | Development sequence, architecture upgrade, production readiness, and improvement roadmap | On batch switching |
| [`project_progress_tracker.md`](./project_progress_tracker.md) | Current project progress snapshot | After milestones |
| [`current_todo_list.md`](./current_todo_list.md) | Current active execution list | On current priority changes |
| [`operations-checklist.md`](./operations-checklist.md) | Pre-coding check, pre-release check, documentation completion gate | Before release |
| [`operations-tracker.md`](./operations-tracker.md) | Lightweight index page | Less frequent updates |
| [`runbook.md`](./runbook.md) | Operations runbook entry point | On playbook changes |
| [`runbooks/incident-response-playbook.md`](./runbooks/incident-response-playbook.md) | Incident response | On playbook changes |
| [`runbooks/runbook-plugin-failure.md`](./runbooks/runbook-plugin-failure.md) | Plugin failure handling | On playbook changes |
| [`runbooks/runbook-high-error-rate.md`](./runbooks/runbook-high-error-rate.md) | High error rate handling | On playbook changes |
| [`runbooks/runbook-database-issues.md`](./runbooks/runbook-database-issues.md) | Database issues handling | On playbook changes |
| [`runbooks/runbook-memory-pressure.md`](./runbooks/runbook-memory-pressure.md) | Memory pressure handling | On playbook changes |
| [`src_module_test_matrix.md`](./src_module_test_matrix.md) | Source module test matrix | On test structure changes |
| [`test_coverage_baseline_gate.md`](./test_coverage_baseline_gate.md) | Coverage baseline threshold | On coverage rule changes |
| [`capacity-planning.md`](./capacity-planning.md) | Capacity planning | On planning cycle updates |
| [`cross-region-validation.md`](./cross-region-validation.md) | Cross-region validation | On plan adjustments |
| [`hot-upgrade-validation.md`](./hot-upgrade-validation.md) | Hot upgrade validation | On plan adjustments |

## 2. Find Entry Point by Task

| Task | Recommended Entry Point |
| --- | --- |
| See current progress | `project_progress_tracker.md` |
| See what to do next | `current_todo_list.md` |
| See what phase is currently allowed | `implementation_plan.md` |
| See development sequence and dependencies | `operations-roadmap.md` |
| Pre-coding checks | `operations-checklist.md` |
| See operations handling entry | `runbook.md` |
| See test coverage baseline | `test_coverage_baseline_gate.md` |

## 3. Writing Rules

- Operations documents serve execution, they do not replace master plans, ADRs, and contracts.
- Operational documents should remain timely; outdated content should be directly deleted or consolidated, no dummy entry points kept.
- Phase boundary changes first modify `implementation_plan.md`, batch sequence changes then modify `operations-roadmap.md`.
- Actual state changes are uniformly written back to `project_progress_tracker.md`.

## 4. Boundaries with Other Directories

- `operations/` is responsible for "how to push forward, how to verify, how to run".
- `architecture/` is responsible for "what the overall system is".
- `contracts/` is responsible for "what implementations must comply with".
- `analysis/` is responsible for "what the current coverage is".
