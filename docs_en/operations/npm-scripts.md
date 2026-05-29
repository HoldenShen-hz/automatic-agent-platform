# NPM Scripts 维护规范

`package.json` 中contains构建、测试、运lines时、CI 辅助和稳定性相关脚本。本文件used for约束脚本增长方式，避免脚本区演化成不可审计的命令堆。

## 分class

- 构建class：`build`、`build:*`
- 测试class：`test`、`test:*`、各class `tsx --test` 定向命令
- 运lines时class：`doctor`、`inspect`、`dispatch-*`、worker/runtime 命令
- 本地联调class：`dev:stack`、`dev:stack:stop`
- 稳定性vs证据class：`*:stable`、rehearsal、evidence report
- CI 辅助class：包装 `scripts/ci/*` 的脚本

## 维护规则

- 只有在人、CI 或文档会repeatsuses时，才新增 `package.json` 脚本。
- 一iterations性逻辑优先放到 `scripts/`，并在文档中登记入口，不把长命令directly塞进 `package.json`。
- 会修改环境或产生副作用的脚本，名称必须显式table达风险。
- 新增稳定性、发布或运维脚本时，必须synchronous更新对应 operations 文档。
- 本地联调脚本必须固定defaults toport，并显式输出日志位置，避免“port被旧进程占用但看不出来”。

## 验证要求

- only改脚本时，至少运lines对应脚本或 dry-run/inspection 命令。
- 只有脚本本身覆盖full测试时，才要求把 `npm test` 当作唯一验证方式。

## 常用入口

- `npm run dev:stack`
  作用：一键启动本地 API、metrics 和 Web UI，并自动清理当前仓库残留的旧进程。
- `npm run dev:stack:stop`
  作用：停止 `dev:stack` 拉起的本地服务。

defaults toaddress：

- UI：`http://localhost:5173`
- API：`http://127.0.0.1:4000`
- Metrics：`http://127.0.0.1:4001/metrics`

## 关联文档

- [operations-checklist.md](./operations-checklist.md)
- [test_coverage_baseline_gate.md](./test_coverage_baseline_gate.md)
