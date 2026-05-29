# 中英文文档同步规则

`docs_zh/` 是中文主文档集合，`docs_en/` 保存英文材料。两者允许有发布时间差，但关键契约和操作文档不能长期漂移。

## 必须同步的内容

- 平台架构总览和五层边界。
- 合同/契约文档，包括 `docs_zh/contracts/` 与 `docs_en/contracts/`。
- ADR 中影响运行时、发布、安全和兼容性的决策。
- 运维 runbook、安全流程和恢复流程。
- API/SDK 版本说明。

## 同步流程

1. 中文或英文任一侧发生关键变更时，在 PR 中标注是否需要同步。
2. 先判断所属目录：
   - `docs_zh/contracts/` -> `docs_en/contracts/`
   - `docs_zh/adr/` -> `docs_en/adr/`
   - `docs_zh/operations/` -> `docs_en/operations/`
   - `docs_zh/reference/` -> `docs_en/reference/`
3. 如果暂不翻译，必须写明原因和追踪项。
4. 版本冻结、重大发布和安全变更前，必须抽查两侧关键文档。

## 最小检查清单

- 关键中文变更是否有对应英文 sibling。
- contract / ADR / runbook 的链接是否仍指向同语种目录。
- README/索引是否已经纳入新文件或新的 canonical 路径。
- 若只有中文权威页，是否在英文侧补了 alias、stub 或待同步说明。

## 证据

- PR 链接。
- 对应文档路径。
- 同步状态说明。
