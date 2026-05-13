# Test Quality Report
**Date:** 2026-05-13  
**Total Tests:** 58382  
**Passed:** 56762  
**Failed:** 1620

## Failing Test Files (21 files)

| # | File | Path |
|---|------|------|
| 1 | cost-management-service.test.ts | tests/unit/platform/cost-management/ |
| 2 | index.test.ts (cost-management) | tests/unit/platform/cost-management/ |
| 3 | execution-dispatch-service-async.test.ts | tests/unit/platform/execution/dispatcher/ |
| 4 | nodeRunId-canonization.test.ts | tests/unit/platform/execution/execution-engine/ |
| 5 | runtime-plan-executor.test.ts | tests/unit/platform/execution/oapeflir/ |
| 6 | worker-pool-comprehensive.test.ts | tests/unit/platform/execution/worker-pool/ |
| 7 | access-model.test.ts | tests/unit/platform/five-plane-control-plane/iam/ |
| 8 | field-encryption.test.ts | tests/unit/platform/five-plane-control-plane/iam/ |
| 9 | budget-allocator.test.ts | tests/unit/platform/five-plane-execution/ |
| 10 | web-fetch.test.ts | tests/unit/platform/five-plane-execution/tool-executor/ |
| 11 | worker-drain-protocol.test.ts | tests/unit/platform/five-plane-execution/ |
| 12 | r20-05-parallelism-limit.test.ts | tests/unit/platform/five-plane-orchestration/planner/ |
| 13 | node-run-checkpoint-migration.test.ts | tests/unit/platform/five-plane-state-evidence/checkpoints/ |
| 14 | channel-gateway-service-coverage.test.ts | tests/unit/platform/interface/channel-gateway/ |
| 15 | execution-adapter.test.ts | tests/unit/platform/orchestration/oapeflir/ |
| 16 | durable-event-bus-async.test.ts | tests/unit/platform/state-evidence/events/ |
| 17 | multi-region-cdc-replication.test.ts | tests/unit/scale-ecosystem/ |
| 18 | durable-event-bus-async.test.ts | tests/unit/scale-ecosystem/runtime-services/ |
| 19 | api-client.test.ts | tests/unit/sdk/ |
| 20 | dlq-manager-operations-2282-2283.test.ts | tests/unit/sdk/cli/ |

## Failure Summary by Area

- **Cost Management:** 2 files
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
- **Scale Ecosystem:** 2 files
- **SDK:** 2 files