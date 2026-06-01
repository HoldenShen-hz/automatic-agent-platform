# Current Todo List

> 2026-05-14 复核：`docs_zh/reviews/issues-table.md` 是 design review 问题收口的权威逐行状态表；本文件只保留当前运行批次入口，不再承载历史全量失败清单。
> 历史长清单已归档到 `docs_zh/operations/archive/current_todo_list-history-2026-05-14.md`，需要回溯 A1-A9 批次证据时从归档读取。

## 当前权威入口

- Review issue 逐行状态：`docs_zh/reviews/issues-table.md`
- 本轮架构同步入口：`docs_zh/architecture/README.md`
- 环境配置说明：`docs_zh/reference/environment-configuration.md`
- 运维运行手册：`docs_zh/operations/`

## 历史基线归档清单

- `docs_zh/operations/archive/current_todo_list-history-2026-05-14.md`
- 历史基线已归档：历史全量失败基线只作为审计和对账材料，不作为当前活跃任务队列。
- 历史未运行已归档：未运行批次保留在归档文件中，重新验证时必须产生新的目标日志和结论。

| 批次 | 状态 | 归档说明 |
| --- | --- | --- |
| A1 | 已归档 | 见历史归档文件 |
| A2 | 已归档 | 见历史归档文件 |
| A3 | 已归档 | 见历史归档文件 |
| A4 | 已归档 | 见历史归档文件 |
| A5 | 已归档 | 见历史归档文件 |
| A6 | 已归档 | 见历史归档文件 |
| A7 | 已归档 | 见历史归档文件 |
| A8 | 已归档 | 见历史归档文件 |
| A9 | 已归档 | 见历史归档文件 |
| B1 | 已归档 | 见历史归档文件 |
| B2 | 已归档 | 见历史归档文件 |
| B3 | 已归档 | 见历史归档文件 |
| B4 | 已归档 | 见历史归档文件 |
| B5 | 已归档 | 见历史归档文件 |
| B6 | 已归档 | 见历史归档文件 |
| B7 | 已归档 | 见历史归档文件 |

## 当前执行规则

- 新增 review 修复必须回写 `docs_zh/reviews/issues-table.md` 的状态、结论、根因和证据列。
- 历史全量测试失败基线只作为对账材料，不能替代当前定向验证证据。
- 长期批次记录进入 `docs_zh/operations/archive/`，主文件保持为短索引，避免再次膨胀。
- 2026-05-26 之后新增的治理文档（如 `docs_zh/architecture/sync-async-service-pairs.md`）属于归档后补充资产，统一进入当前 review/architecture 索引，不回填为历史 A/B 活跃批次。

## 当前活跃待办

### V3.2 Final Release 文档复核回写（2026-06-01）

来源：

- `docs_zh/reference/automatic_agent_platform_v3_2_final_release.md`
- `docs_en/reference/automatic_agent_platform_v3_2_final_release.md`

复核结论：

- `§11 v3.2 TodoList` 中列出的 P0/P1 主任务，代码与主要工件已落地，当前未发现需要重新打开的主链实现缺口。
- 但 `§14 附录 A：已落地目录与后续扩展位` 仍有若干“文档声称已落地、仓库实际不存在或结构不一致”的问题，需要作为当前活跃待办收口。

| 批次 | 优先级 | 状态 | 任务 | 证据 / 根因 | 目标产物 |
| --- | --- | --- | --- | --- | --- |
| V32-R1 | P0 | `todo` | 收口 v3.2 附录 A 的 claims 目录口径 | 文档写的是 `config/division-coverage/claims/{engineering,knowledge-research,...}.yaml`，仓库实际只有 `config/division-coverage/claims/allowlist.yaml` 和 `config/division-coverage/claims/records.yaml`。需要二选一：补齐 family claim YAML，或把中英文 v3.2 文档改回当前 authoritative 结构。 | `docs_zh/reference/automatic_agent_platform_v3_2_final_release.md`、`docs_en/reference/automatic_agent_platform_v3_2_final_release.md` 与 `config/division-coverage/claims/` 结构一致 |
| V32-R2 | P0 | `todo` | 补齐或改写 `docs_zh/divisions/family-readiness.md` 引用 | 中文 v3.2 附录 A 声称该文件“已落地”，但仓库中不存在该文件。 | 新增 `docs_zh/divisions/family-readiness.md`，或回写 v3.2 文档删除该错误落地声明 |
| V32-R3 | P0 | `todo` | 补齐或改写 `docs_zh/divisions/leadership-claims.md` 引用 | 中文 v3.2 附录 A 声称该文件“已落地”，但仓库中不存在该文件。 | 新增 `docs_zh/divisions/leadership-claims.md`，或回写 v3.2 文档删除该错误落地声明 |
| V32-R4 | P0 | `todo` | 同步修复英文版附录 A 的缺失引用 | 英文版 `docs_en/reference/automatic_agent_platform_v3_2_final_release.md` 同样引用了不存在的 `docs_en/divisions/family-readiness.md`、`docs_en/divisions/leadership-claims.md`，且 claims 目录口径也与仓库不一致。 | `docs_en/reference/automatic_agent_platform_v3_2_final_release.md` 与实际目录一致，必要时补英文对应文件 |
| V32-R5 | P1 | `todo` | 为 v3.2 文档增加“已复核/未复核”实现证据回写段 | 当前 `§11` 只写了 `done`，但没有记录本次 2026-06-01 逐条复核的真实证据与残余差异，后续容易再次漂移。 | 在中英文 v3.2 文档中追加 implementation re-audit 说明或 evidence note |
