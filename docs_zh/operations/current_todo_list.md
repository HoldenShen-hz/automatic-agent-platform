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
- `§14 附录 A：已落地目录与后续扩展位` 中原先存在的“文档声称已落地、仓库实际不存在或结构不一致”问题，已在本轮 `V32-R1 ~ V32-R5` 中完成收口。

| 批次 | 优先级 | 状态 | 任务 | 证据 / 根因 | 目标产物 |
| --- | --- | --- | --- | --- | --- |
| V32-R1 | P0 | `done` | 收口 v3.2 附录 A 的 claims 目录口径 | 已将中英文 v3.2 附录 A 的 claims 目录改回当前权威结构 `allowlist.yaml + records.yaml`，不再虚构 family-scoped claim YAML。 | `docs_zh/reference/automatic_agent_platform_v3_2_final_release.md`、`docs_en/reference/automatic_agent_platform_v3_2_final_release.md` |
| V32-R2 | P0 | `done` | 补齐 `docs_zh/divisions/family-readiness.md` 引用 | 已新增中文 family readiness 索引页，固定机器可读配置与 division 文档目录的真实关系。 | `docs_zh/divisions/family-readiness.md` |
| V32-R3 | P0 | `done` | 补齐 `docs_zh/divisions/leadership-claims.md` 引用 | 已新增中文 leadership claims 索引页，固定 claims 目录与 governance 入口的当前权威结构。 | `docs_zh/divisions/leadership-claims.md` |
| V32-R4 | P0 | `done` | 同步修复英文版附录 A 的缺失引用 | 已新增英文对应索引页，并修正英文附录 A 中错误的 division 路径与 claims 目录描述。 | `docs_en/divisions/family-readiness.md`、`docs_en/divisions/leadership-claims.md`、`docs_en/reference/automatic_agent_platform_v3_2_final_release.md` |
| V32-R5 | P1 | `done` | 为 v3.2 文档增加“已复核/未复核”实现证据回写段 | 已在中英文 v3.2 release 文档中追加 2026-06-01 re-audit 说明，明确本次复核结论和目录真相。 | `docs_zh/reference/automatic_agent_platform_v3_2_final_release.md`、`docs_en/reference/automatic_agent_platform_v3_2_final_release.md` |
| V32-R6 | P1 | `done` | 收口英文 claim scanner allowlist 漂移 | 执行 `audit:leadership-claims` 时发现英文 governance/reference/review 文档缺少与中文对等的 allowlist 条目；现已补齐对等项并恢复治理语境白名单一致性。 | `config/division-coverage/claims/allowlist.yaml` |
