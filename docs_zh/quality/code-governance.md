# 代码治理规则

本文档用于承接无法通过单次小补丁安全完成的长期源码治理项。

## 治理项

- 巨型文件拆分。
- 全局 `console.*` 替换。
- 全局 `TODO/FIXME/HACK` 清理。
- 全局 `any`、`as unknown as`、`@ts-ignore` 清理。
- 过深 import 路径治理。
- Barrel 文件数量治理。
- 重复代码检测和循环依赖检测。

## 关闭规则

- 具体 bug、测试失败、安全缺陷必须用代码修复和定向测试关闭。
- 规模治理项必须先记录边界、owner、准入规则和后续拆分策略。
- 不允许把“已登记治理项”写成“代码已全部重构完成”。

## 新增代码准入

- 新文件应有单一职责。
- 新公共 API 应从明确 barrel 或 package export 暴露。
- 新 TODO 必须带 owner 或追踪说明。
- 新 `any` 和 `@ts-ignore` 必须说明原因。

## 可执行审计

- `scripts/ci/audit-codebase-inventory.mjs` 负责输出当前大文件、`process.env`、`any`、`@ts-ignore`、双转型和根目录临时文件统计。
- `scripts/ci/audit-review-batch-resource-contracts.mjs` 负责验证本轮 review 已落地的代码、UI、安全和文档契约。
- 重复代码和循环依赖不允许只写人工结论；新增治理项必须补充脚本统计或点名定向测试证据。
