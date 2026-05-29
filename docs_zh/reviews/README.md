# Review 文档维护指南

`docs_zh/reviews/` 保存架构审查、实现一致性审查和问题表。问题表只能表达真实处理状态，不能把治理项伪装成已完成代码修复。

## 维护规则

- 每个问题行必须保留 `Review结论`、`根因归类`、`证据`。
- 重复问题可以归并，但证据必须指向同一个具体修复、验证命令或治理边界。
- 巨型文件拆分、全局 `any` 清理、全局 TODO 清理、目录规模治理等长期项应标为治理项。
- 点名失败测试必须用点名定向测试证明，不使用全量测试结果替代。
- `npm audit` 类问题以当前 lockfile 的审计输出为准。

## 本轮状态口径

- `已解决（本轮落地）`: 本轮有明确文件改动或定向验证。
- `已复核关闭`: 经过复核后确认属于边界澄清、历史兼容或风险接受，不能冒充代码修复。
- `已处理（归并）`: 已复核并归并到修复簇、重复问题或治理边界。
- `治理项`: 不是单次小补丁能完成的结构改造，必须后续拆分实施。

## 当前入口

- `platforme-full-review-d.md`：当前主批次问题表
- `platforme-full-review-c.md`：前一批次问题表
- `platforme-full-review-b.md`：当前持续收口的大表
- `platforme-full-review-a.md`：前一批次问题总表
- `platforme-full-review.md`：历史长表与复核结论归档
- `issues-table.md`：design review 行级证据表

运营入口见 `docs_zh/operations/review-closure-board.md`。
