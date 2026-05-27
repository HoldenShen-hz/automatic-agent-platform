# Operations

> `operations/` 只保留当前仍有执行价值的计划、进度、运维与验证文档。

## 1. 当前文档索引

| 文档 | 角色 | 更新频率 |
| --- | --- | --- |
| [`implementation_plan.md`](./implementation_plan.md) | 阶段与范围主计划 | 阶段边界变化时 |
| [`operations-roadmap.md`](./operations-roadmap.md) | 开发顺序、架构升级、生产就绪与改进路线 | 批次切换时 |
| [`project_progress_tracker.md`](./project_progress_tracker.md) | 当前项目进度快照 | 里程碑后 |
| [`current_todo_list.md`](./current_todo_list.md) | 当前活跃执行清单 | 当前优先级变化时 |
| [`operations-checklist.md`](./operations-checklist.md) | 编码前检查、发布前检查、文档完成门控 | 发布前 |
| [`review-prevention-plan.md`](./review-prevention-plan.md) | 把 review 高频问题转成持续门禁的预防方案 | review 模式变化时 |
| [`operations-tracker.md`](./operations-tracker.md) | 轻量索引页 | 较少更新 |
| [`runbook.md`](./runbook.md) | 运维总 runbook 入口 | 预案变更时 |
| [`runbooks/incident-response-playbook.md`](./runbooks/incident-response-playbook.md) | 事件响应 | 预案变更时 |
| [`runbooks/runbook-plugin-failure.md`](./runbooks/runbook-plugin-failure.md) | 插件失败处理 | 预案变更时 |
| [`runbooks/runbook-high-error-rate.md`](./runbooks/runbook-high-error-rate.md) | 高错误率处理 | 预案变更时 |
| [`runbooks/runbook-database-issues.md`](./runbooks/runbook-database-issues.md) | 数据库问题处理 | 预案变更时 |
| [`runbooks/runbook-memory-pressure.md`](./runbooks/runbook-memory-pressure.md) | 内存压力处理 | 预案变更时 |
| [`src_module_test_matrix.md`](./src_module_test_matrix.md) | 源码模块测试矩阵 | 测试结构变化时 |
| [`test_coverage_baseline_gate.md`](./test_coverage_baseline_gate.md) | 覆盖率基线门槛 | 覆盖规则变化时 |
| [`capacity-planning.md`](./capacity-planning.md) | 容量规划 | 规划周期更新时 |
| [`cross-region-validation.md`](./cross-region-validation.md) | 跨区验证 | 方案调整时 |
| [`hot-upgrade-validation.md`](./hot-upgrade-validation.md) | 热升级验证 | 方案调整时 |

## 2. 按任务找入口

| 任务 | 推荐入口 |
| --- | --- |
| 看现在推进到哪里 | `project_progress_tracker.md` |
| 看接下来具体做什么 | `current_todo_list.md` |
| 看当前允许做什么阶段 | `implementation_plan.md` |
| 看开发顺序与依赖 | `operations-roadmap.md` |
| 开始编码前的检查 | `operations-checklist.md` |
| 看如何避免 review 类问题复发 | `review-prevention-plan.md` |
| 看运维处理入口 | `runbook.md` |
| 看测试覆盖基线 | `test_coverage_baseline_gate.md` |

## 3. 编写规则

- operations 文档服务执行，不替代总纲、ADR 和 contract。
- 操作类文档应保持时效性，过时内容直接删除或收敛，不保留伪入口。
- 阶段边界变化先改 `implementation_plan.md`，批次顺序变化再改 `operations-roadmap.md`。
- 实际状态变化统一回写 `project_progress_tracker.md`。

## 4. 与其他目录的边界

- `operations/` 负责“怎么推进、怎么验证、怎么运行”。
- `architecture/` 负责“系统整体是什么”。
- `contracts/` 负责“实现必须遵守什么”。
- `analysis/` 负责“当前覆盖到什么程度”。
