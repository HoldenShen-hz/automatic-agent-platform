# ADR-033 分阶段落地路线

- Status：Superseded by ADR-112
- Decision日期：2026-04-17

## Background

平台建设is一个渐进过程，需要明确的阶段划分和阶段门禁，确保每个阶段交付可用功能。

## Decision

### 3 Ring 路线图

| 阶段 | 目标 | 关键交付物 |
|------|------|-----------|
| Ring 1 | 核心Execution Plane | HarnessRuntime、PlanGraphBundle、Statusmanage |
| Ring 2 | 稳定性增强 | 恢复机制、监控告警、治理vs耐久 |
| Ring 3 | 业务域vs生态 | DomainDescriptor、Pack SDK、Marketplace、多 Region |

### 路线图服务

- `domains/roadmap/roadmap-service.ts` (124 lines)
- 阶段追踪和Statusmanage
- 完成record

### 阶段门禁

- SuccessCriteriaService supported ring gate 注册
- 指标记分
- `evaluatePhaseAdvance()` 拦截

### 特性开关

- feature flag 治理在 config-override-governance
- gray-release-rehearsal supported金丝雀发布

## Consequences

优点：

- 阶段化降低交付风险
- 阶段门禁确保质量
- 特性开关supported渐进式发布

代价：

- 路线图维护需要持续投入
- 阶段边界可能需要调整

## 交叉references用

- [ADR-075 六级受控发布vs Rollout Status机](./075-controlled-rollout-release.md)
- [ADR-090 Runtime、data可靠性vs运维治理](./090-runtime-data-reliability-and-operations.md)

## v4.3 ADR Remediation

- A-64: 本 ADR 原先把 `Phase 1-7` 作为 canonical 路线图，Root cause: 落地路线 ADR 形成时主Architecture尚未统一到 ring 口径。修复：正文现改为 `Ring 1/2/3`，历史 phase only允许作为旧里程碑映射。

## 来源章节

- `§33` 分阶段落地路线
