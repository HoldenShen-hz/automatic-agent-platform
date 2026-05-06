# Test Failure Buglist

Generated: 2026-05-02
Total Failures: 399 out of 4582 tests

---

## Category 1: SQLite Schema Missing Column (schema_version)

**Root Cause:** SQLite database schema doesn't include `schema_version` column in events table

**Error:** `table events has no column named schema_version`

**Affected Tests:** 5 failures
- Likely in event repository or truth layer tests that try to access schema_version column

**Fix Required:** Add `schema_version` column to events table in SQLite schema definition

---

## Category 2: Domain Registration/Activation State Machine

**Root Cause:** Domain activation requires `canary` state transition before `active`

**Error:** `Domains can only activate from canary state. Use canary=true first.` (22 failures)
**Error:** `Domain smoke test failed during registration.` (81 failures)

**Affected Tests:** 103 failures
- DomainOnboardingService tests
- DomainRegistryService tests
- PluginBindingSchema tests
- DomainManifestSchema tests
- StepTemplateConfigSchema tests
- WorkflowConfigSchema tests
- ToolBundleConfigSchema tests
- DomainDefinitionSchema tests
- DomainDescriptorBundleSchema tests
- DomainRiskSpecSchema tests
- DomainGovernancePolicySchema tests
- createDomainModulePreset tests
- getPluginBindings tests
- register tests
- activate tests

**Fix Required:** Domain activation state machine in src needs to properly transition through canary state

---

## Category 3: Runtime Truth Event Validation

**Root Cause:** Runtime truth writes require backing platform.* fact events

**Error:** `Runtime truth writes must be backed by platform.* fact events.` (19 failures)

**Affected Tests:** 19 failures
- Likely tests in platform/state-evidence/truth/ that write directly without proper event sourcing

**Fix Required:** Use proper event sourcing pattern - write events first, then update truth

---

## Category 4: ProposalExecutor Missing for Eval Version Compliance

**Root Cause:** §56.4 eval version compliance requires ProposalExecutor

**Error:** `ProposalExecutor required for §56.4 eval version compliance` (10 failures)

**Affected Tests:** 10 failures in SimpleBenchmarkRunner tests

**Fix Required:** Provide ProposalExecutor implementation for benchmark runner

---

## Category 5: TypeError - Undefined Property Access

**Root Cause:** Attempting to read property of undefined

**Errors:**
- `Cannot read properties of undefined (reading 'riskProfile')` (11 failures)
- `Cannot read properties of undefined (reading 'length')` (1 failure)
- `Cannot assign to read only property 'domainId'` (1 failure)
- `status is not defined` (1 failure)

**Affected Tests:** 14 failures
- trust-scorer tests (17 calculateTrustScore + 15 mapTrustLevel)
- DomainDescriptorOrchestrationService tests
- Various domain schema tests

**Fix Required:** Add null checks or initialize properties properly

---

## Category 6: Missing Expected Exception

**Root Cause:** Tests expect exceptions to be thrown but they aren't

**Error:** `Missing expected exception.` (6 failures)

**Affected Tests:** 6 failures

**Fix Required:** Either implement missing validation logic or fix test expectations

---

## Category 7: Domain Recipe/Workflow Execution Issues

**Root Cause:** RecipeExecutor and workflow execution failures

**Error:** `ProposalExecutor required` + various RecipeExecutor failures (27 failures for RecipeExecutor, 20 for RecipeExecutor.execute)

**Affected Tests:** 47+ failures
- RecipeExecutor tests
- oapeflir plan tests
- runMultiStepOrchestration tests (16 failures)

**Fix Required:** RecipeExecutor implementation or mock injection

---

## Category 8: State Machine / Rollback Issues

**Root Cause:** Incorrect state transitions or rollback in non-rollbackable states

**Errors:**
- `Cannot rollback plan in rolled_back state.` (2 failures)
- `Cannot rollback plan in planned state.` (1 failure)

**Affected Tests:** 3 failures
- PackMigrationService rollback tests

**Fix Required:** State validation logic fix

---

## Category 9: Test Infrastructure Issues

**Root Cause:** Test setup or assertion issues

**Errors:**
- `test failed` (5 failures)
- `should have initial + 2 updates` (1 failure)
- `2 subtests failed` (1 failure)
- `1 subtest failed` (1 failure)

**Affected Tests:** 8 failures

**Fix Required:** Fix test setup or assertions

---

## Category 10: ExecutionOutcomeEvaluator Issues

**Root Cause:** Eval service returning incorrect verdicts

**Error:** Various ExecutionOutcomeEvaluator.evaluate failures (11 failures)

**Affected Tests:** 11 failures
- LlmEvalService tests
- ExecutionOutcomeEvaluator tests

**Fix Required:** Evaluation logic fix

---

## Category 11: Dispatch/EventBus Performance Tests

**Root Cause:** DurableEventBus subscribe/unsubscribe behavior differences

**Error:** [SYS-PERF-3.1] DurableEventBus tests (5 failures)

**Affected Tests:** 5 failures in performance tests

**Fix Required:** EventBus implementation alignment with test expectations

---

## Category 12: ProgressiveAutonomyService Issues

**Root Cause:** Autonomy service failures

**Error:** 3 failures in ProgressiveAutonomyService tests

**Fix Required:** Service implementation fix

---

## Category 13: Missing Domain Registration

**Root Cause:** Domain not found in registry

**Error:** `domain_registry.domain_not_found: Domain coding not found.` (2 failures)

**Affected Tests:** Domain registration/activation tests

**Fix Required:** Register domain before tests that depend on it

---

## Category 14: Workflow/Plugin Not Found

**Root Cause:** Referenced workflow or plugin doesn't exist

**Errors:**
- `workflow coding.primary should exist` (1 failure)
- `bundle coding.default should exist` (1 failure)
- `domain should be registered` (1 failure)

**Affected Tests:** Domain preset and plugin binding tests

**Fix Required:** Proper test fixture setup

---

## Category 15: Schema Validation Edge Cases

**Root Cause:** Zod schema validation behaving differently than expected

**Error:** Various schema validation tests (DomainManifestSchema, PluginBindingSchema, StepTemplateConfigSchema, WorkflowConfigSchema, ToolBundleConfigSchema, etc.) - 30+ failures

**Affected Tests:** Schema validation tests

**Fix Required:** Either fix schema definitions or adjust test expectations

---

## Summary by Root Cause

| Category | Count | Root Cause |
|----------|-------|-----------|
| Domain state machine (canary → active) | ~103 | Domain activation requires canary state |
| RecipeExecutor/ProposalExecutor missing | ~57 | ProposalExecutor not implemented |
| Runtime truth event validation | 19 | Writes without platform.* fact events |
| SQLite schema missing column | 5 | events table missing schema_version |
| TypeError undefined access | ~14 | Missing null checks |
| Schema validation edge cases | ~30 | Zod schema behavior differences |
| ExecutionOutcomeEvaluator issues | 11 | Eval service logic errors |
| State machine rollback issues | 3 | Invalid state for rollback |
| EventBus performance tests | 5 | Subscribe/unsubscribe behavior |
| Test infrastructure | 8 | Test setup/assertion issues |
| Missing domain/workflow reference | 5 | Domain/workflow not registered |
| **TOTAL** | **~260** | |

**Note:** ~140 failures are variations of the same root causes listed above.

---

## Files Requiring src Modifications (Cannot Fix Without)

1. `src/platform/state-evidence/truth/sqlite/` - Add schema_version column
2. `src/domains/registry/` - Domain activation state machine
3. `src/ops-maturity/drift-detection/benchmark-runner.ts` - ProposalExecutor requirement
4. `src/platform/orchestration/` - RecipeExecutor implementation
5. `src/domains/onboarding/` - DomainOnboardingService state transitions
6. Various schema definition files - Zod schema adjustments
