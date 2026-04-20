# Platform Promote Criteria Contract

## 1. Scope

This contract defines the promote criteria that a module must satisfy when being promoted from "existing design or partial implementation" to "formal platform capability."

It answers the question: A module cannot be judged complete just because "there is a service, there is code, there is a contract"; additionally, what freeze, test, observability, runbook, rollback, and ownership conditions must be satisfied.

Related documents:

- `module_acceptance_criteria_matrix.md`
- `release_rollout_and_rollback_contract.md`
- `slo_alerting_and_runbook_contract.md`
- `quality_engineering_and_chaos_testing_contract.md`

## 2. Goals

- Unify "from partial to platform-ready" judgment criteria.
- Avoid judging module maturity by fake completion like "service exists," "tests are placeholders," "dashboard exists but no alert."
- Make promote and rollback have formal evidence chain.

## 3. Promote Criteria

`PromoteCriteria` minimum fields:

- `component_id`
- `current_status`
- `target_status`
- `required_criteria`
- `optional_criteria`
- `overall_verdict`
- `blockers?`

`current_status` recommended enumeration:

- `draft`
- `partial`
- `contract_frozen`
- `canary`
- `production_ready`

`overall_verdict` recommended enumeration:

- `promote_approved`
- `promote_blocked`
- `conditional`

## 4. Required Criteria

| criteria | Minimum Requirement |
| --- | --- |
| `contracts_frozen` | Related main documents, contracts, ADRs are frozen and not conflicting |
| `conformance_tests` | Corresponding conformance / integration / recovery tests have passed |
| `telemetry_instrumented` | Metrics, trace, alerts at minimum in place for current phase requirements |
| `runbooks_documented` | Deployment, rollback, incident runbook exists |
| `rollback_tested` | At least one successful rollback rehearsal or drill |
| `ownership_defined` | Owner, backup, incident contact are clear |

## 5. Optional Criteria

- `performance_benchmarks`
- `load_test_results`
- `security_review`
- `chaos_drill_results`

Rules:

- Optional items cannot replace required items.
- If target status is `production_ready`, recommended to at least supplement `performance_benchmarks` and `security_review`.

## 6. Promote Phase Requirements

| Path | Minimum Requirement |
| --- | --- |
| `draft -> partial` | Contract initial version, happy path tests, minimum owner clear |
| `partial -> contract_frozen` | All current phase contracts frozen, tests pass, boundaries clear |
| `contract_frozen -> canary` | Telemetry, runbook, ownership, rollback path in place |
| `canary -> production_ready` | Rollback rehearsed, alerting, benchmarks, security review in place |

## 7. Anti-Patterns

The following situations must not be used as promote basis:

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
- `created_at`

## 9. Closure Conclusion

Platform maturity cannot be judged just by "looks finished."

Only when contract, test, observability, runbook, rollback, and owner close together does a module qualify for promotion from "partial capability" to "formal platform capability."
