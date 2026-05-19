# ADR-033 分阶段落地路线

- 状态：Superseded by ADR-112
- 决策日期：2026-04-17

## 背景

平台建设是一个渐进过程，需要明确的阶段划分和阶段门禁，确保每个阶段交付可用功能。

## 决策

### 3 Ring 路线图

| 阶段 | 目标 | 关键交付物 |
|------|------|-----------|
| Ring 1 | 核心执行面 | HarnessRuntime、PlanGraphBundle、状态管理 |
| Ring 2 | 稳定性增强 | 恢复机制、监控告警、治理与耐久 |
| Ring 3 | 业务域与生态 | DomainDescriptor、Pack SDK、Marketplace、多 Region |

### 路线图服务

- `domains/roadmap/roadmap-service.ts` (124 行)
- 阶段追踪和状态管理
- 完成记录

### 阶段门禁

- SuccessCriteriaService 支持 ring gate 注册
- 指标记分
- `evaluatePhaseAdvance()` 拦截

### 特性开关

- feature flag 治理在 config-override-governance
- gray-release-rehearsal 支持金丝雀发布

## 后果

优点：

- 阶段化降低交付风险
- 阶段门禁确保质量
- 特性开关支持渐进式发布

代价：

- 路线图维护需要持续投入
- 阶段边界可能需要调整

## 交叉引用

- [ADR-075 六级受控发布与 Rollout 状态机](./075-controlled-rollout-release.md)
- [ADR-090 Runtime、数据可靠性与运维治理](./090-runtime-data-reliability-and-operations.md)

## v4.3 ADR Remediation

- A-64: 本 ADR 原先把 `Phase 1-7` 作为 canonical 路线图，根因是落地路线 ADR 形成时主架构尚未统一到 ring 口径。修复：正文现改为 `Ring 1/2/3`，历史 phase 仅允许作为旧里程碑映射。

## 来源章节

- `§33` 分阶段落地路线
