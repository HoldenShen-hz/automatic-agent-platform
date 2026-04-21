# ADR-033 分阶段落地路线

- 状态：Accepted
- 决策日期：2026-04-17

## 背景

平台建设是一个渐进过程，需要明确的阶段划分和阶段门禁，确保每个阶段交付可用功能。

## 决策

### 7 期路线图

| 阶段 | 目标 | 关键交付物 |
|------|------|-----------|
| Phase 1 | 核心执行面 | 基础 Workflow、Plugin、状态管理 |
| Phase 2 | 稳定性增强 | 恢复机制、监控告警 |
| Phase 3 | AI 运营层 | LLM 抽象、Prompt 治理、成本管理 |
| Phase 4 | 业务域接入 | DomainDescriptor、Pack SDK |
| Phase 5 | 智能交互 | NL 入口、目标分解、主动 Agent |
| Phase 6 | 组织治理 | 租户隔离、SSO、权限管理 |
| Phase 7 | 规模化生态 | 多 Region、Marketplace |

### 路线图服务

- `domains/roadmap/roadmap-service.ts` (124 行)
- 阶段追踪和状态管理
- 完成记录

### 阶段门禁

- SuccessCriteriaService 支持 phase gate 注册
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

## 来源章节

- `§33` 分阶段落地路线
