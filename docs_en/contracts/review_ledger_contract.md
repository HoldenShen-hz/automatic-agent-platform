# Review Ledger Contract

## Purpose

`review-ledger` is the minimum public contract for restoring the manual findings under `docs_zh/reviews/` into machine-consumable assurance artifacts.

It currently serves three consumers:

- `assurance:review-import`
- `assurance:full`
- `rc:check`

## Required Artifacts

Implementations must emit at least these four files:

```text
artifacts/assurance/review-ledger.raw.jsonl
artifacts/assurance/review-ledger.normalized.jsonl
artifacts/assurance/review-source-coverage-report.json
artifacts/assurance/review-conflict-resolution-report.jsonl
```

`assurance:full` must also emit:

```text
artifacts/assurance/assurance-full-report.json
```

That report makes the currently integrated assurance scope explicit, instead of letting the entrypoint name imply capabilities that have not been wired yet.

## Field Requirements

The minimum schema is defined by [review-ledger.schema.json](/Users/holden/Project/automatic_agent/automatic_agent_platform/schemas/review-ledger.schema.json).

Key field semantics:

- `reviewSourceId`: unique identifier for the raw review finding.
- `sourceFile`: source file path, for example `docs_zh/reviews/platforme-full-review-e.md`.
- `rowId`: original row or issue identifier inside the source file, such as `1439`, `SYS-004`, or `GAP-01`.
- `canonicalIssueId`: normalized issue id; it may be null in the raw ledger, but must be stable in the normalized ledger.
- `status`: normalized current finding status.
- `category`: issue family, such as `test_quality.hard_wait`.
- `sourceKind`: source type, such as `review_table` or `manual_sample`.
- `sourceRefs`: minimum trace-back locations to the original review text.
- `evidenceRefs`: code, test, doc, or command evidence tied to the finding.
- `freshness`: whether the review conclusion is still current.

## Allowed Status Values

```text
todo
fixed
done
partial
accepted_risk
stale
needs_revalidation
```

## Non-goals

This contract does not:

- replace the code-level `issue-ledger`
- decide the final release verdict
- guarantee perfect auto-structuring for every narrative review document

Those responsibilities remain shared across `assurance:full`, conflict resolution, and human revalidation.
