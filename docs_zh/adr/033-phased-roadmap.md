# ADR-033 分阶段落地路线（历史相位版，已被 Ring 路线取代）

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

### 历史路线图服务（兼容说明）

- `domains/roadmap/roadmap-service.ts` (124 行)
- 历史阶段追踪和状态管理
- 完成记录投影

### 历史阶段门禁（兼容投影）

- SuccessCriteriaService 支持 ring gate 注册；旧 `evaluatePhaseAdvance()` 只允许作为历史 milestone 投影，不再定义 canonical 推进条件
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
- R8-63 / R6-48: 历史 `evaluatePhaseAdvance()` 与 `Phase 1-7` 门禁不再是 active canonical 路线。正文现明确本 ADR 为 superseded 历史映射，现行推进边界以 `Ring 1 / Ring 2 / Ring 3` 与 ADR-112 为准。

## 现行权威

- Ring 1：核心执行面可用
- Ring 2：稳定性、治理与恢复 readiness
- Ring 3：业务域、生态与多 region 扩展

历史 `Phase 1-7` 如需在旧报告中展示，必须标注为 migration alias，不得再作为新 gate 或新 contract 的依据。

## 来源章节

- `§33` 分阶段落地路线
