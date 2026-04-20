# Project Structure Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 rollout
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义进入 Phase 1a-4 实现时的顶层目录、源码分层、配置分层和事业部目录约定。

## 2. 顶层目录

Phase 1a 允许并推荐存在以下顶层目录：

- `doc/`: 文档体系与规范
- `src/`: 平台源码
- `config/`: 运行时与平台级配置
- `divisions/`: 事业部定义与角色素材
- `tests/`: 测试代码与 fixture
- `scripts/`: 开发、迁移、运维辅助脚本
- `data/`: 本地开发期 SQLite、artifact、临时持久化目录

禁止事项：

- 不在 `src/` 下混入 `.venv`、`node_modules`、缓存和运行产物。
- 不把平台级 YAML/JSON 配置散落到 `src/` 内。
- 不把事业部 prompt 直接写死在 runtime 代码中。

## 3. `src/` authoritative 结构

Phase 1a 的推荐结构：

```text
src/
  core/
    api/
    artifacts/
    config/
    divisions/
    events/
    memory/
    observability/
    providers/
    runtime/
    security/
    storage/
    tools/
    workflow/
    types/
    approvals/
    agent-loop/
    assessment/
    feedback/
    improvement/
    learning/
    planning/
    cost/
    queue/
  gateway/
    stream/
    targets/
  cli/
```

规则：

- `core/` 只放平台核心域模型和运行逻辑。
- `gateway/` 负责渠道适配，不拥有任务编排语义。
- API、tools、providers、division loader 在当前实现中统一收敛在 `src/core/` 下，而不是拆成 `src/server/` / `src/tools/` / `src/providers/` 顶层目录。
- `src/core/divisions/` 只负责加载定义，不承载事业部业务内容本身。

可预留但非 Phase 1a 必做目录：

```text
src/
  core/
    memory/
  supervisor/
  plugins/
  domains/
```

说明：

- `memory/`、`supervisor/`、`plugins/`、`domains/` 可以为后续阶段预留目录，但不应被误判为 Phase 1a 当前必做交付物。
- 当前 Observe 语义优先收敛在 `src/core/observability/`、`src/core/agent-loop/` 与 `src/core/assessment/`，而不是新增顶层 `perception/` 目录。
- 若未来需要把 `api` / `tools` / `providers` 从 `src/core/` 进一步拆到顶层目录，必须先更新本 contract，再做迁移。

## 4. `config/` authoritative 结构

```text
config/
  bootstrap/
  runtime/
  security/
  providers/
  gateways/
  workflows/
```

含义：

- `bootstrap/`: 平台启动时必须加载的基础配置。
- `runtime/`: 并发、超时、重试、队列等运行参数。
- `security/`: 权限、审批阈值、危险操作策略。
- `providers/`: LLM provider、模型路由、降级策略。
- `gateways/`: CLI/Web/Telegram 等渠道配置。
- `workflows/`: HQ 级共享 workflow 模板。

补充说明：

- 配置四层优先级、prompt / config / policy / flag 解耦、默认值注册中心以下钻文档 `configuration_layers_and_defaults_contract.md` 为准。

## 5. `divisions/` authoritative 结构

```text
divisions/
  <division-id>/
    division.yaml
    roles/
      <role-id>.prompt.md
    workflows/
      *.yaml
    schemas/
      *.json
```

规则：

- 每个事业部必须有唯一 `division.yaml` 作为入口。
- `roles/` 只保存角色提示与角色说明，不保存运行时状态。
- `workflows/` 只保存声明式流程定义。
- `schemas/` 保存该事业部输入输出、artifact 或表单的结构约束。

## 6. `data/` 结构约束

Phase 1a 本地开发可采用：

```text
data/
  sqlite/
  artifacts/
  logs/
```

规则：

- SQLite 文件、artifact 和日志物理隔离。
- `data/` 仅用于本地或单机开发环境，不作为长期生产设计事实源。

## 7. 所有权与变更约束

- 目录结构变更应先改本 contract，再改 `01` ~ `07`、`operations/` 与对应实现。
- 若需要引入 `apps/` 多进程结构，应新增 ADR，并更新本 contract。
- Phase 1a 不引入过早的微服务拆分。

## 8. 补充规则

- `server/api` 目录按资源命名，如 `tasks/`、`approvals/`、`health/`，避免按 HTTP 动词拆分。
- `tests/` 最少分为 `unit/`、`integration/`、`e2e/` 三层，fixture 与 replay 资源单独放在共享目录。
- 生产环境不依赖本地 `data/`，应替换为数据库、对象存储和集中日志/审计后端。
