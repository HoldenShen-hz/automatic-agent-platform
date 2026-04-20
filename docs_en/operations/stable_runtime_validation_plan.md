# Stable Runtime Validation Plan

## 1. Goal

This document defines the validation plan and minimum evidence required for the "stable operation" phase.

It answers:

- What tests must be done.
- What operational evidence must be retained.
- What conditions must be met before claiming Stable Core has stabilized.

## 2. Test Groups

### 2.1 Recovery and Interruption

- `kill -9` recovery test.
- Tool call interruption recovery test.
- LLM `timeout/429/500` recovery test.
- SQLite `BUSY` and lock conflict recovery test.
- Half-written state recovery test.

### 2.2 Concurrency and Consistency

- Multi-execution concurrent advancement conflict test.
- File lock competition test.
- Duplicate approval response test.
- Duplicate event delivery test.
- Event out-of-order test.
- Unconsumed event startup resend test.

### 2.3 Tool and Security

- `bash/write/edit/MCP` parameter and path validation test.
- stdout/stderr sanitization test.
- Output purification and control character cleanup test.
- Prompt injection/tool result pollution baseline test.
- Cancel propagation and child process tree cleanup test.

### 2.4 Operations and Observability

- `/healthz` and inspect baseline test.
- Structured log field integrity test.
- Key metrics collection test.
- Trace chain through-test.
- Backup, recovery, and `integrity_check` drill.

### 2.5 Long-Run and Stress

- `24h` soak test.
- `72h` soak test.
- Batch task stress test.
- High concurrency queuing and backpressure test.
- Periodic fault injection test.

## 3. Minimum Operational Evidence

At least retain following evidence:

- Test report for each fault injection type.
- Backup recovery drill report.
- Success rate, failure rate, retry rate, and resource curves during soak test.
- Trace sample for key tasks.
- One successful human takeover closed-loop sample.

## 4. Stable Operation Determination

Only when all following conditions are met simultaneously can Stable Core be judged as approaching stable operation:

- All P0 blockers closed.
- All mandatory test groups passed.
- `24h` soak test passed.
- `72h` soak test passed.
- No fatal issues like state drift, duplicate advancement, uncleared child processes, unrecoverable tasks.

## 5. Recommended Related Documents

- [../reviews/stable_runtime_blockers_checklist.md](../reviews/stable_runtime_blockers_checklist.md)
- [../reviews/pre_stable_launch_blockers_checklist.md](../reviews/pre_stable_launch_blockers_checklist.md)
- [./stable_core_scope.md](./stable_core_scope.md)
- [./stable_launch_execution_plan.md](./stable_launch_execution_plan.md)
- [../contracts/startup_consistency_and_recovery_drill_contract.md](../contracts/startup_consistency_and_recovery_drill_contract.md)
- [../contracts/debug_inspect_health_backpressure_contract.md](../contracts/debug_inspect_health_backpressure_contract.md)
- [../contracts/quality_engineering_and_chaos_testing_contract.md](../contracts/quality_engineering_and_chaos_testing_contract.md)
