# Operations

> `operations/` 只保留当前执行需要看的文档。
> 新平台不再保留旧系统的评审归档链路，这里只保留当前仍有执行价值的文档。

## 1. 当前文档索引

| 文档 | 角色 | 更新频率 |
|------|------|---------|
| [`implementation_plan.md`](./implementation_plan.md) | 阶段与范围主计划（Phase 1a→4） | 里程碑变更时 |
| [`operations-roadmap.md`](./operations-roadmap.md) | 路线图统一文档（开发顺序、架构升级、生产就绪、系统改进） | 批次或路线调整时 |
| [`operations-checklist.md`](./operations-checklist.md) | 清单统一文档（发布硬清单、编码前检查、文档完成门控） | 版本发布前 |
| [`gap-analysis.md`](./gap-analysis.md) | 模块缺口、稳定性计划与历史差距入口 | 结构调整时 |
| [`project_progress_tracker.md`](./project_progress_tracker.md) | 当前项目进度快照 | 里程碑后 |
| [`current_todo_list.md`](./current_todo_list.md) | 当前活跃待办 | 当前优先级变化时 |
| [`operations-tracker.md`](./operations-tracker.md) | 轻量索引页 | 很少更新 |
| [`module_remediation_backlog.md`](./module_remediation_backlog.md) | 按模块分类的缺陷与修复 backlog | 发现即录入 |

## 2. 按任务找入口

| 任务 | 推荐入口 |
|------|---------|
| 看项目总体推进到了哪里 | `project_progress_tracker.md` |
| 看当前最近该做什么 | `current_todo_list.md` |
| 开始编码前的检查 | `operations-checklist.md` § 2 Pre-Coding Checklist |
| 上线前的 Top 20 硬清单 | `operations-checklist.md` § 1 Pre-Launch Checklist |
| 看 Phase 1a 落地顺序 | `implementation_plan.md`、`phases/phase-1a-foundation.md` |
| 看开发批次顺序与依赖 | `operations-roadmap.md` § 1 Development Sequence |
| 看长期架构升级线 | `operations-roadmap.md` § 2 Architecture Upgrade |
| 看工业级生产就绪路线 | `operations-roadmap.md` § 3 Industrial Production Readiness |
| 看系统改进优先级 | `operations-roadmap.md` § 4 System Improvement |
| 看按模块拆开的整改 backlog | `module_remediation_backlog.md` |
| 看模块缺口与历史差距 | `gap-analysis.md` |
| 看所有阶段推进文档 | `phases/README.md` |

## 3. 编写规则

- operations 文档服务执行，不替代总纲、ADR 和 contract。
- 每项执行计划都应尽量关联目标 contract、主干文档或 ADR。
- 操作类文档应保持时效性，过时内容应直接删除或收敛进当前文档。
- 已完成的大段流水账不继续堆在活跃入口文件中。
- 若执行中发现架构事实源不足，应先补主干文档或 contract，再继续推进。
- 发现主干架构、阶段边界或验收标准变化时，先更新 `implementation_plan.md`，再同步 roadmap 和 checklist。

## 4. 与其他目录的边界

- `operations/` 负责"怎么推进"。
- `automatic_agent_platform/`、`01` ~ `07` 与 `contracts/` 负责"当前应该是什么"。
- `contracts/` 负责"实现必须遵守什么"。
- `01` ~ `07` 负责"系统整体是什么"。
