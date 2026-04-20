# Platform Promote Criteria Contract

## 1. Scope

This contract defines the promote criteria that modules must satisfy when being elevated from "existing design or partial implementation" to "formal platform capability".

It answers the question: a module cannot be judged complete simply because "it has a service, has code, has a contract"; what freeze, testing, observability, runbook, rollback, and ownership conditions must also be satisfied.

Related documents:

- `doc/operations/operations-checklist.md`
- `release_rollout_and_rollback_contract.md`
- `slo_alerting_and_runbook_contract.md`
- `quality_engineering_and_chaos_testing_contract.md`

## 2. Goals

- Unify criteria for judging "from partial to platform-ready".
- Avoid false completion judgments of module maturity such as "service exists", "tests are placeholders", "has dashboard but no alerts".
- Make promote and rollback have formal evidence chains.

## 3. Promote Criteria

`PromoteCriteria` minimum fields:

- `component_id`
- `current_status`
- `target_status`
- `required_criteria`
- `optional_criteria`
- `overall_verdict`
- `blockers?`

`current_status` recommended enum:

- `draft`
- `partial`
- `contract_frozen`
- `canary`
- `production_ready`

`overall_verdict` recommended enum:

- `promote_approved`
- `promote_blocked`
- `conditional`

## 4. Required Criteria

| Criteria | Minimum Requirement |
| --- | --- |
| `contracts_frozen` | Related main documents, contracts, and ADRs are frozen and mutually non-conflicting |
| `conformance_tests` | Corresponding conformance / integration / recovery tests have passed |
| `telemetry_instrumented` | Metrics, traces, and alerts are at least in place for current stage requirements |
| `runbooks_documented` | Deployment, rollback, and incident runbooks exist |
| `rollback_tested` | At least one successful rollback rehearsal or drill |
| `ownership_defined` | Owner, backup, and incident contact are clear |
| `oapeflir_loop_tested` | OAPEFLIR loop and stage timeline have coverage |
| `knowledge_plane_tested` | If knowledge is enabled, namespace / trust / freshness have been verified |
| `memory_promotion_tested` | If memory promotion is enabled, promotion/demotion/revocation have been verified |
| `plugin_spi_conformance` | If plugin SPI is enabled, shared contract suite has passed |
| `rollout_rehearsed` | Release / rollback drill has passed |

## 5. Optional Criteria

- `performance_benchmarks`
- `load_test_results`
- `security_review`
- `chaos_drill_results`

Rules:

- Optional items cannot substitute required items.
- If target status is `production_ready`, it is recommended to at least add `performance_benchmarks` and `security_review`.

## 6. Promote Stage Requirements

| Path | Minimum Requirement |
| --- | --- |
| `draft -> partial` | Contract draft, happy path tests, minimum owner defined |
| `partial -> contract_frozen` | All current-stage contracts frozen, tests passed, boundaries clear |
| `contract_frozen -> canary` | Telemetry, runbook, ownership, and rollback path in place |
| `canary -> production_ready` | Rollback rehearsal, alerting, benchmarks, and security review in place |

## 7. Anti-Patterns

The following situations must not be used as promotion basis:

- `service_exists_only`
- `tests_without_assertions`
- `telemetry_without_alerts`
- `runbook_without_rehearsal`
- `owner_without_backup`
- `contract_exists_but_not_consumed`

## 8. Evidence Package

`PromoteEvidencePackage` minimum fields:

- `package_id`
- `component_id`
- `contract_refs`
- `test_result_refs`
- `telemetry_refs`
- `runbook_refs`
- `rollback_rehearsal_refs`
- `ownership_ref`
- `oapeflir_evidence_refs?`
- `rollout_refs?`
- `created_at`

## 9. Closure Conclusion

Platform maturity cannot be judged simply by "looks done".

Only when contracts, tests, observability, runbooks, rollback, and owner close together does a module qualify to be promoted from "partial capability" to "formal platform capability".
