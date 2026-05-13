# Test Quality Report
**Date:** 2026-05-13  
**Total Tests:** 58382  
**Passed:** 56762  
**Failed:** 1620

## Failing Test Files (14 files - previously 21, 7 resolved)

| # | File | Path |
|---|------|------|
| 1 | execution-dispatch-service-async.test.ts | tests/unit/platform/execution/dispatcher/ |
| 2 | nodeRunId-canonization.test.ts | tests/unit/platform/execution/execution-engine/ |
| 3 | runtime-plan-executor.test.ts | tests/unit/platform/execution/oapeflir/ |
| 4 | worker-pool-comprehensive.test.ts | tests/unit/platform/execution/worker-pool/ |
| 5 | access-model.test.ts | tests/unit/platform/five-plane-control-plane/iam/ |
| 6 | field-encryption.test.ts | tests/unit/platform/five-plane-control-plane/iam/ |
| 7 | budget-allocator.test.ts | tests/unit/platform/five-plane-execution/ |
| 8 | web-fetch.test.ts | tests/unit/platform/five-plane-execution/tool-executor/ |
| 9 | worker-drain-protocol.test.ts | tests/unit/platform/five-plane-execution/ |
| 10 | r20-05-parallelism-limit.test.ts | tests/unit/platform/five-plane-orchestration/planner/ |
| 11 | node-run-checkpoint-migration.test.ts | tests/unit/platform/five-plane-state-evidence/checkpoints/ |
| 12 | channel-gateway-service-coverage.test.ts | tests/unit/platform/interface/channel-gateway/ |
| 13 | execution-adapter.test.ts | tests/unit/platform/orchestration/oapeflir/ |
| 14 | durable-event-bus-async.test.ts | tests/unit/platform/state-evidence/events/ |

## Resolved Files (7 files)
- cost-management-service.test.ts
- index.test.ts (cost-management)
- multi-region-cdc-replication.test.ts
- durable-event-bus-async.test.ts (scale-ecosystem/runtime-services)
- api-client.test.ts
- dlq-manager-operations-2282-2283.test.ts

## Failure Summary by Area

- **Execution/Dispatcher:** 1 file
- **Execution/Engine:** 1 file
- **Execution/OAPEFLIR:** 1 file
- **Execution/Worker Pool:** 1 file
- **IAM:** 2 files
- **Five-Plane Execution:** 3 files
- **Five-Plane Orchestration:** 1 file
- **Five-Plane State Evidence:** 1 file
- **Interface/Channel Gateway:** 1 file
- **Orchestration/OAPEFLIR:** 1 file
- **State Evidence/Events:** 1 file