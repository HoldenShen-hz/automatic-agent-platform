# Gap Analysis

> 本文件只保留三类内容：模块级缺口、稳定性相关入口、历史差距归档索引。

## 1. 模块验收矩阵

**主文档**: `module_remediation_backlog.md`

来源: `module_acceptance_criteria_matrix.md`（已归档）

按模块分类的已知缺陷与待修复项：

| 模块 | 典型问题 | 优先级 |
|------|---------|--------|
| `phase1a-store` | delegating core 仍有大量类型桥接，legacy compat 仍大 | P1 |
| `phase1b-orchestration` | 2172 行巨型单体 | P1 |
| `authoritative-task-store-legacy-compat` | methods 文件已删除，但 legacy compat 仍承载大量兼容语义，需继续向各 Repository 收敛 | P1 |
| `event-ops-service` | 重试/死信不完整 | P2 |
| `memory-service` | 写入门控缺失 / 无去重 | P2 |
| `experience-cache-service` | 无 TTL 淘汰 | P2 |
| `gateway-delivery-service` | 1129 行过多职责 | P2 |
| `http-api-server` | 无路由表抽象 | P2 |

完整修复清单见 `module_remediation_backlog.md`。

## 2. 稳定性强化计划

当前稳定性相关入口：

| 文档 | 用途 |
|------|------|
| `archive/stability_hardening_plan.md` | 稳定性强化总体计划 |
| `archive/stable_core_scope.md` | Stable Core 范围定义 |
| `archive/stable_launch_execution_plan.md` | 发布前演练执行计划 |
| `archive/stable_runtime_validation_plan.md` | 运行时验证计划 |
| `archive/process_safety_and_observablility.md` | 过程安全与可观测性 |
| `../reviews/readiness_review.md` | 当前稳定运行阻塞项与上线前硬阻塞 |

## 3. 系统差距分析历史

来源归档文件: `archive/system_gap_analysis.md`、`archive/system_gap_analysis_20260412.md`、`archive/system_gap_analysis_20260412a.md`

| 源文件 | 日期 | 主要内容 |
|--------|------|---------|
| `archive/system_gap_analysis.md` | 2026-04-12 早期 | 系统级初始差距分析 |
| `archive/system_gap_analysis_20260412.md` | 2026-04-12 | 第二轮差距分析，收尾 build/test 分离、stable-runner-factory 扩大采用等 |
| `archive/system_gap_analysis_20260412a.md` | 2026-04-12a | 第三轮差距分析，完成 cache orchestration、agent team、memory plane 分层等 |

详细差距分析内容见各归档文件。

## 4. 与追踪文档的边界

- **进度追踪** → 见 `project_progress_tracker.md`
- **阶段与范围计划** → 见 `implementation_plan.md`
- **当前 Sprint 待办** → 见 `current_todo_list.md`
- **全局状态综述** → 见 `../reviews/current_status_and_gap_analysis.md`
- **本文件职责** → 模块级缺陷分析、稳定性强化计划、历史差距分析归档

## 5. 归档文件索引

| 原文件 | 归档原因 |
|--------|---------|
| `system_gap_analysis_20260412.md` | 已整合入本文档 §3 |
| `system_gap_analysis_20260412a.md` | 已整合入本文档 §3 |
| `module_acceptance_criteria_matrix.md` | 已整合入 `module_remediation_backlog.md` |
| `stability_hardening_plan.md` | 已归档至 `archive/` |
| `stable_core_scope.md` | 已归档至 `archive/` |
| `stable_launch_execution_plan.md` | 已归档至 `archive/` |
| `stable_runtime_validation_plan.md` | 已归档至 `archive/` |
| `process_safety_and_observablility.md` | 已归档至 `archive/` |

## 6. 文档维护规则

- 发现新缺陷 → 录入 `module_remediation_backlog.md`
- 稳定性演练完成 → 更新 `project_progress_tracker.md` / `current_status_and_gap_analysis.md`，必要时补充归档
- Sprint 待办 → 更新 `current_todo_list.md`
- 重大里程碑 → 更新 `project_progress_tracker.md`
- 本文件记录模块级差距分析和历史归档，不维护活跃进度
