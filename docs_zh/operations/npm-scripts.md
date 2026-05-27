# NPM Scripts 维护规范

`package.json` 中包含构建、测试、运行时、CI 辅助和稳定性相关脚本。本文件用于约束脚本增长方式，避免脚本区演化成不可审计的命令堆。

## 分类

- 构建类：`build`、`build:*`
- 测试类：`test`、`test:*`、各类 `tsx --test` 定向命令
- 运行时类：`doctor`、`inspect`、`dispatch-*`、worker/runtime 命令
- 稳定性与证据类：`*:stable`、rehearsal、evidence report
- CI 辅助类：包装 `scripts/ci/*` 的脚本

## 维护规则

- 只有在人、CI 或文档会重复使用时，才新增 `package.json` 脚本。
- 一次性逻辑优先放到 `scripts/`，并在文档中登记入口，不把长命令直接塞进 `package.json`。
- 会修改环境或产生副作用的脚本，名称必须显式表达风险。
- 新增稳定性、发布或运维脚本时，必须同步更新对应 operations 文档。

## 验证要求

- 仅改脚本时，至少运行对应脚本或 dry-run/inspection 命令。
- 只有脚本本身覆盖全量测试时，才要求把 `npm test` 当作唯一验证方式。

## 关联文档

- [operations-checklist.md](./operations-checklist.md)
- [test_coverage_baseline_gate.md](./test_coverage_baseline_gate.md)
