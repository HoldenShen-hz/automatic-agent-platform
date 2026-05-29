# 多环境配置差异说明

本文档说明 `config/environments/`、`config/runtime/`、`config/security/` 和 `.env.example` 的职责边界，以及默认值与环境覆盖的合并顺序。

## 配置来源

- `config/environments/*.json`：环境级部署参数，例如集群、命名空间、镜像仓库、发布策略。
- `config/environments/default.json`：所有环境共享的非敏感默认值；各环境文件只覆盖差异项。
- `config/runtime/*.json`：运行时默认值与环境覆盖，例如 timeout、rate limit、breaker、drift reconciler。
- `config/runtime/default.json`：运行时 canonical 默认层；`dev/test/staging/pre-prod/prod` 仅声明 override。
- `config/security/*.json`：安全策略默认值，例如 approval、sandbox、认证和能力限制。
- `.env.example`：本地环境变量模板，只允许空值或非敏感占位符。

## 合并优先级

1. `config/environments/default.json`
2. `config/environments/<env>.json`
3. `config/runtime/default.json`
4. `config/runtime/<env>.json`
5. `config/security/default.json`
6. `config/security/<env>.json`
7. 运行时环境变量

说明：

- `runtime`/`security` 以 `default + overlay` 模式合并；未覆盖字段继续继承默认值。
- 只有 `environments`、`runtime`、`security` 三个目录是环境分层；其余 `config/*` 目录默认不是多环境覆盖面。
- `configVersion` / `configSchemaVersion` 以 runtime bundle 为准，环境 overlay 可以显式重复声明，方便 drift 审计。

## 环境口径

| 环境 | 用途 | 安全要求 |
|---|---|---|
| `dev` | 本地开发 | 可使用最小本地依赖，但不得提交真实 secret |
| `test` | 自动化测试 | 行为应接近 staging，允许测试替身 |
| `staging` | 发布前验证 | 接近生产策略，保留审计和审批 |
| `pre-prod` | 生产前演练 | 与生产配置差异必须显式记录 |
| `prod` | 生产 | strict approval、真实 secret manager、完整审计 |

## 变更规则

- 新增环境变量必须同步更新 `.env.example` 和相关配置说明。
- 新增安全字段必须同步更新所有 `config/security/*.json`，不能只改生产。
- 环境差异必须在 PR 描述中说明风险和验证命令。

## 当前运行时环境变量目录

以下变量已在 `.env.example` 建档，避免代码内新增运行时开关后配置样例和文档漂移。

| 变量 | 默认口径 | 用途 |
|---|---|---|
| `AA_API_RATE_LIMIT_DISABLED` | `false` | 仅本地调试允许关闭 HTTP API 默认限流。 |
| `AA_API_RATE_LIMIT_REDIS` | 空 | 配置 API 限流使用 Redis 共享状态；生产建议启用。 |
| `AA_API_RATE_LIMIT_WINDOW_MS` | `1000` | API 限流窗口长度。 |
| `AA_API_RATE_LIMIT_MAX_CALLS` | `100` | API 限流窗口内最大请求数。 |
| `AA_DB_PATH` | `./data/sqlite/automatic-agent-demo.db`（本地示例） | SQLite 文件路径。本地栈可指向 `data/sqlite/automatic-agent-dev.db`，容器/Helm 默认通常指向 `data/sqlite/automatic-agent.db`。 |
| `AA_DLQ_PURGE_CONFIRM` | 空 | 危险 DLQ purge 操作的二次确认变量；需与 `--yes` 配合。 |
| `AA_LOGIN_TOKEN` | 空 | CLI 登录流程可读取的短期 token；仅限交互式或受控自动化场景。 |
| `AA_OPENAPI_PUBLIC` | `0` | OpenAPI JSON 默认需要认证，显式设为 `1` 才公开。 |
| `AA_MODEL_PROVIDER_FALLBACK_MODELS` | 空 | 非流式模型调用失败后的候选 fallback 模型列表。 |
| `AA_MODEL_CALL_RETRY_MAX_ATTEMPTS` | `2` | 模型调用重试最大次数。 |
| `AA_MODEL_CALL_RETRY_BASE_DELAY_MS` | `100` | 模型调用重试初始退避。 |
| `AA_ALLOW_IN_MEMORY_SESSION_STORE` | `0` | 生产环境默认禁止 IAM session 使用进程内存存储。 |
| `AA_ALLOW_IN_MEMORY_SERVICE_IDENTITY_STORE` | `0` | 生产环境默认禁止 service identity 使用进程内存存储。 |

## 命名与例外

- `config/conversation/templates.json` 是模板注册表，不是单一默认层，因此不使用 `default.json` 命名。
- `config/providers/models.json` 是本地可编辑模型目录；`models.bundled.json` 是仓库随包带出的基线快照。
- `config/validation/mission-operating-model-metric-alert-policy.yaml` 保留 YAML，是因为该文件主要由人类按策略文本维护。

## 审计证据

`scripts/ci/audit-review-batch-resource-contracts.mjs` 会校验上述变量同时出现在 `.env.example`、本说明文档和对应运行时代码中；新增变量时必须扩展该审计，不能只改单点文件。
