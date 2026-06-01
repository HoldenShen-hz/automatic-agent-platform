# Current Todo List

> 2026-05-14 Review: `docs_zh/reviews/issues-table.md` is the authoritative row-by-row status table for design review issue closure; this file only retains the current running batch entry, no longer承载历史全量失败清单.
> The historical long list has been archived to `docs_zh/operations/archive/current_todo_list-history-2026-05-14.md`; refer to the archive when tracing batch evidence for A1-A9.

## Current Authoritative Entry Points

- Review issue row-by-row status: `docs_zh/reviews/issues-table.md`
- Current round architecture sync entry: `docs_zh/architecture/README.md`
- Environment configuration description: `docs_zh/reference/environment-configuration.md`
- Operations runbook: `docs_zh/operations/`

## Historical Baseline Archive List

- `docs_zh/operations/archive/current_todo_list-history-2026-05-14.md`
- Historical baseline archived: Historical full failure baseline only serves as audit and reconciliation material, not as current active task queue.
- Historical unrun archived: Unrun batches retained in archive files; when re-validating, must produce new target logs and conclusions.

| Batch | Status | Archive Description |
| --- | --- | --- |
| A1 | Archived | See historical archive file |
| A2 | Archived | See historical archive file |
| A3 | Archived | See historical archive file |
| A4 | Archived | See historical archive file |
| A5 | Archived | See historical archive file |
| A6 | Archived | See historical archive file |
| A7 | Archived | See historical archive file |
| A8 | Archived | See historical archive file |
| A9 | Archived | See historical archive file |
| B1 | Archived | See historical archive file |
| B2 | Archived | See historical archive file |
| B3 | Archived | See historical archive file |
| B4 | Archived | See historical archive file |
| B5 | Archived | See historical archive file |
| B6 | Archived | See historical archive file |
| B7 | Archived | See historical archive file |

## Current Execution Rules

- New review fixes must write back status, conclusion, root cause and evidence columns to `docs_zh/reviews/issues-table.md`.
- Historical full test failure baseline only serves as reconciliation material, cannot replace current targeted verification evidence.
- Long-term batch records enter `docs_zh/operations/archive/`; main file remains as short index to avoid re-swelling.
- Governance documents added after 2026-05-26 (such as `docs_zh/architecture/sync-async-service-pairs.md`) belong to post-archive supplementary assets, uniformly enter current review/architecture index, not backfilled as historical A/B active batches.

## Current Active Todo

### V3.2 Final Release Re-audit Writeback (2026-06-01)

Sources:

- `docs_zh/reference/automatic_agent_platform_v3_2_final_release.md`
- `docs_en/reference/automatic_agent_platform_v3_2_final_release.md`

Review conclusion:

- The main P0/P1 tasks listed in `§11 v3.2 TodoList` are materially implemented in code and artifacts; no reopened primary implementation gap was found in that section.
- However, `§14 Appendix A: Landed directories and extension slots` still contains several “document says landed, repository does not actually match” inconsistencies. Those are now tracked as active remediation items.

| Batch | Priority | Status | Task | Evidence / Root Cause | Target Artifact |
| --- | --- | --- | --- | --- | --- |
| V32-R1 | P0 | `todo` | Reconcile the v3.2 Appendix A claim directory contract | The appendix lists `config/division-coverage/claims/{engineering,knowledge-research,...}.yaml`, while the repository currently exposes only `config/division-coverage/claims/allowlist.yaml` and `config/division-coverage/claims/records.yaml`. Either land family-scoped claim YAML files or rewrite the zh/en appendix to the current authoritative structure. | `docs_zh/reference/automatic_agent_platform_v3_2_final_release.md`, `docs_en/reference/automatic_agent_platform_v3_2_final_release.md`, and `config/division-coverage/claims/` aligned |
| V32-R2 | P0 | `todo` | Restore or rewrite the `docs_zh/divisions/family-readiness.md` reference | The Chinese v3.2 appendix claims this file is landed, but the repository does not contain it. | Add `docs_zh/divisions/family-readiness.md`, or remove the incorrect landed claim from the v3.2 doc |
| V32-R3 | P0 | `todo` | Restore or rewrite the `docs_zh/divisions/leadership-claims.md` reference | The Chinese v3.2 appendix claims this file is landed, but the repository does not contain it. | Add `docs_zh/divisions/leadership-claims.md`, or remove the incorrect landed claim from the v3.2 doc |
| V32-R4 | P0 | `todo` | Fix the same missing Appendix A references in the English release doc | `docs_en/reference/automatic_agent_platform_v3_2_final_release.md` points to non-existent `docs_en/divisions/family-readiness.md` and `docs_en/divisions/leadership-claims.md`, and its claim directory description also diverges from the repository. | `docs_en/reference/automatic_agent_platform_v3_2_final_release.md` aligned to actual directories, with English files added if kept as required deliverables |
| V32-R5 | P1 | `todo` | Add explicit re-audit evidence notes to the v3.2 release docs | `§11` currently says `done`, but does not preserve the 2026-06-01 re-audit evidence or residual mismatches, which makes future drift likely. | Implementation re-audit/evidence note appended to the zh/en v3.2 release docs |
