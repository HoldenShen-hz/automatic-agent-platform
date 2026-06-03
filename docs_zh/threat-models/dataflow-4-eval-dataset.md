# Dataflow 4: Eval Dataset → Runner → Judge → Report → Release Gate

> Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §32.2.

## Trust boundaries

```text
[eval dataset]  --(card+hash)-->  [runner]
                                       |
                                       v
[treatment run] --(judge)-->       [scorecard]
                                       |
                                       v
[release gate]  --(threshold)-->   [go / no-go]
```

## Threats

| ID | Threat | Boundary | Failure mode | Required gate |
|---|---|---|---|---|
| THR-4.1 | Dataset card exists but samples are missing | dataset | fake pass | `audit:eval-oracle` (rule: `dataset_card_without_samples`) |
| THR-4.2 | frozenHash is a placeholder | dataset | contamination | `eval-oracle` card+frozenHash check |
| THR-4.3 | Judge reads `submission.score` to compute its verdict | judge | self-fulfilling pass | `audit:eval-oracle` (rule: `judge_reads_self_score`) |
| THR-4.4 | Treatment/control score is a literal 0/1 | judge | fake improvement | `audit:eval-oracle` (rule: `constant_treatment_score`) |
| THR-4.5 | Expected array is empty and runner passes | runner | vacuous pass | `audit:eval-oracle` (rule: `empty_expected_passes`) |
| THR-4.6 | Scorecard text is a hardcoded string | runner | forged report | `audit:eval-oracle` (rule: `static_scorecard`) |
| THR-4.7 | expectedOutput is assigned to actualOutput | runner | identical-comparison pass | `audit:eval-oracle` (rule: `expected_as_actual`, `expected_equals_actual`) |

## Side-effect boundary

Eval runs are **read-only** with respect to production state. They may
write to the scorecard store, which is a separate namespace.

## Evidence boundary

The scorecard must carry a `frozenHash` of the dataset it ran
against, so re-runs can be re-verified. The `evidence:bundle:create`
script packages the scorecard into the release evidence bundle.

## Required gates

```text
audit:eval-oracle               # §12.1
test:golden:strict              # §12.4
test:redteam:p0                 # §12.3
evidence:bundle:create          # §16.3
evidence:bundle:verify          # §16.3
```

## Status

- audit:eval-oracle ✅
- test:golden:strict ✅
- test:redteam:p0 ✅
- evidence:bundle:* ✅
