# Multi Process And Multi App Evolution Assessment

## 1. Goal

This document assesses when the project should evolve from the current modular monolith to multi-process or multi-app structure, and the boundaries during evolution.

## 2. Current Assessment

- Phase 1a/1b should still prioritize single-repo, modular monolith.
- Multi-process evaluation only begins when execution plane, queue, gateway, and admin/ops surfaces show independent scaling needs.

## 3. Separable Units

- `control-plane-api`
- `execution-worker`
- `gateway-runtime`
- `admin-console-api`
- `ops-repair-job`

## 4. Evolution Triggers

- queue/worker lifecycle is independent
- coordinator needs HA
- Different interface surfaces need independent scaling
- Audit, repair, ops tasks start affecting main chain latency

## 5. Reasons Not to Split Early

- State machine, repository, contract mapping are still in rapid closure period.
- Early process splitting changes problems from "module boundary" to "distributed consistency".

## 6. Closure Conclusion

Multi-process/multi-app is an evolution tool after platformization, and should not be rushed before documentation is stable and main chain is working.
