# Sync/Async 服务对边界

本说明用于收口 review 中“同步/异步服务对可能存在死代码”的不确定性。

## 结论

- `human-takeover-service.ts` 是同步状态与动作实现；`human-takeover-service-async.ts` 是带队列、超时、升级和事件发射的异步编排层。
- `execution-dispatch-service.ts` 是调度核心实现；`execution-dispatch-service-async.ts` 是 `runtime-factory` 使用的 async facade。
- `execution-worker-handshake-service.ts` 是握手核心实现；`execution-worker-handshake-service-async.ts` 是 `runtime-factory` 使用的 async facade。
- `execution-worker-writeback-service.ts` 是写回核心实现；`execution-worker-writeback-service-async.ts` 是 `runtime-factory` 使用的 async facade。

## 判定规则

- sync 文件必须被对应 async 文件依赖，说明 async 不是平行重写而是包裹现有权威实现。
- sync 文件必须仍被其他 `src/` 调用，说明它不是只为 async façade 保留的孤儿实现。
- async 文件必须仍被其他 `src/` 调用，说明它不是仅测试覆盖的死包装层。
- 两侧都必须有定向测试，防止“存在引用但无回归保护”。

## 固化审计

- 审计脚本：`node scripts/ci/audit-sync-async-service-pairs.mjs`
- 当前覆盖的 review 点名服务对：
  - `human-takeover-service.ts` / `human-takeover-service-async.ts`
  - `execution-dispatch-service.ts` / `execution-dispatch-service-async.ts`
  - `execution-worker-handshake-service.ts` / `execution-worker-handshake-service-async.ts`
  - `execution-worker-writeback-service.ts` / `execution-worker-writeback-service-async.ts`

如果后续将 sync 核心彻底迁移为真正 async 实现，应同步删除旧文件并更新该审计脚本，而不是让两套实现长期并存且失去边界说明。
