# Operations

> `operations/` retains only plans, progress, and operational/validation documents that still have execution value.

## 1. Current Document Index

| Document | Role | Update Frequency |
| --- | --- | --- |
| [`implementation_plan.md`](./implementation_plan.md) | Phase and scope master plan | On phase boundary changes |
| [`operations-roadmap.md`](./operations-roadmap.md) | Development sequence, architecture upgrades, production readiness and improvement roadmap | On batch iteration switches |
| [`project_progress_tracker.md`](./project_progress_tracker.md) | Current project progress snapshot | After milestones |
| [`current_todo_list.md`](./current_todo_list.md) | Current active execution list | On current priority changes |
| [`operations-checklist.md`](./operations-checklist.md) | Pre-coding checks, pre-release checks, documentation completion gate | Before release |
| [`review-prevention-plan.md`](./review-prevention-plan.md) | Prevention plan to convert high-frequency review issues into continuous gates | On review pattern changes |
| [`operations-tracker.md`](./operations-tracker.md) | Lightweight index page | Less frequent updates |
| [`runbook.md`](./runbook.md) | Operations runbook main entry | On playbook changes |
| [`runbooks/incident-response-playbook.md`](./runbooks/incident-response-playbook.md) | Incident response | On playbook changes |
| [`runbooks/runbook-plugin-failure.md`](./runbooks/runbook-plugin-failure.md) | Plugin failure handling | On playbook changes |
| [`runbooks/runbook-high-error-rate.md`](./runbooks/runbook-high-error-rate.md) | High error rate handling | On playbook changes |
| [`runbooks/runbook-database-issues.md`](./runbooks/runbook-database-issues.md) | Database issue handling | On playbook changes |
| [`runbooks/runbook-memory-pressure.md`](./runbooks/runbook-memory-pressure.md) | Memory pressure handling | On playbook changes |
| [`src_module_test_matrix.md`](./src_module_test_matrix.md) | Source module test matrix | On test structure changes |
| [`test_coverage_baseline_gate.md`](./test_coverage_baseline_gate.md) | Coverage baseline threshold | On coverage rule changes |
| [`capacity-planning.md`](./capacity-planning.md) | Capacity planning | On planning cycle updates |
| [`cross-region-validation.md`](./cross-region-validation.md) | Cross-region validation | On plan adjustments |
| [`hot-upgrade-validation.md`](./hot-upgrade-validation.md) | Hot-upgrade validation | On plan adjustments |

## 2. Entry Points by Task

| Task | Recommended Entry |
| --- | --- |
| View current progress | `project_progress_tracker.md` |
| View upcoming specific tasks | `current_todo_list.md` |
| View current allowed phase | `implementation_plan.md` |
| View development sequence and dependencies | `operations-roadmap.md` |
| Pre-coding checks | `operations-checklist.md` |
| View how to prevent review class issues recurrence | `review-prevention-plan.md` |
| View operations handling entry | `runbook.md` |
| View test coverage baseline | `test_coverage_baseline_gate.md` |

## 3. Writing Rules

- Operations documents serve execution, not replace overall guidelines, ADR and contracts.
- Operational documents should remain current; outdated content should be directly deleted or consolidated, no dummy entries kept.
- On phase boundary changes, first modify `implementation_plan.md`; on batch iteration sequence changes, then modify `operations-roadmap.md`.
- Actual status changes should be written back to `project_progress_tracker.md`.

## 4. Boundaries with Other Directories

- `operations/` is responsible for "how to advance, how to verify, how to operate".
- `architecture/` is responsible for "what the overall system is".
- `contracts/` is responsible for "what implementations must comply with".
- `analysis/` is responsible for "what extent is currently covered".