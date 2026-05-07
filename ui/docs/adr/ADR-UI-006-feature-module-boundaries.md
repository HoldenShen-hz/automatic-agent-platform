# ADR-UI-006 Feature Module 与 Shared Package 边界

- 状态：Accepted
- 决策日期：2026-05-07

## 决策

UI monorepo 采用 `apps / features / shared / ui-core` 分层。

- `features/*` 只能依赖 `shared/*` 与 `ui-core/*`。
- `shared/*` 不得反向依赖任何 feature。
- auth、api-client、telemetry、i18n 属于 shared。

## 后果

- 复用能力与业务 feature 解耦。
- feature 间不会通过隐式 import 形成环依赖。
