# Project Structure Contract

---

## OAPEFLIR 关联

本 contract 参vs OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集vs聚合
- **Assess**：执lines前评估vs风险判断
- **Plan**：任务分解vs DAG 构建
- **Execute**：步骤执linesvs容错
- **Feedback**：信号收集vs预handle
- **Learn**：模式检测vs知识提取
- **Improve**：改进候选评估vs rollout
- **Release**：受控发布vs回滚

---

## 1. 范围

本 contract defines当前仓库的顶层目录、源码分层、configure分层和事业部目录约定。

## 2. 顶层目录

当前 authoritative 顶层目录：

- `docs_zh/` / `docs_en/`: 文档体系vs规范
- `src/`: 平台源码
- `config/`: 运lines时vs平台级configure
- `divisions/`: 事业部definesvs角色素材
- `tests/`: 测试codevs fixture
- `scripts/`: 开发、迁移、运维辅助脚本
- `data/`: 本地开发期 SQLite、artifact、临时持久化目录

禁止事项：

- 不在 `src/` 下混入 `.venv`、`node_modules`、cache和运lines产物。
- 不把平台级 YAML/JSON configure散落到 `src/` 内。
- 不把事业部 prompt directlyhardcoded在 runtime code中。

## 3. `src/` authoritative 结构

当前实现结构：

```text
src/
  core/                          # 兼容性运lines时（only保留旧code迁移路径）
    runtime/
  platform/                      # 权威平台核心code
    control-plane/               # IAM, configure中心, 审批中心, 事件控制
    execution/                   # 调度器, 执linesreferences擎, 恢复, Worker池
    orchestration/               # OAPEFLIR, 路由,  planner, HITL
    state-evidence/              # Truth, Events, Checkpoints, Artifacts, Knowledge, Memory
    interface/                   # API, Channel Gateway, Ingress, Scheduler
    shared/                      # 可观测性, 稳定性, cache, 通用基础设施
    model-gateway/               # 模型网关, 成本追踪
    prompt-engine/               # Prompt 渲染、版本、评测、发布
    compliance/                  # 合规案例编排vsdata治理
    agent-delegation/            # 代理委托
    cost-management/             # 成本manage
    prompt-registry/             # Prompt 注册table
  interaction/                   # NL入口, 目标分解, 主动Agent, 仪table盘, UX
  org-governance/                # 组织层级, SSO/SCIM, 合规
  ops-maturity/                  # 可解释性, 漂移检测, 边缘计算, 成本, 混沌工程
  scale-ecosystem/               # 多区域, 公平调度, SLA, connect器, 市场
  sdk/                           # CLI, Pack SDK, Plugin SDK, Client SDK
  domains/                       # 领域Description符, 接入, 注册table
  plugins/                       # 插件系统
  testing/                       # 测试工具
  benchmarks/                    # 性能基准测试
  apps/                         # 应用入口
```

规则：

- `src/platform/` is权威code目录，contains所有核心运lines时逻辑
- `src/core/` onlyused for向后兼容，不新增canonical运lines时逻辑
- `src/platform/` 内部按Five-PlaneArchitecture组织：control-plane, execution, orchestration, state-evidence, interface
- 上层业务能力在对应上层目录（interaction, org-governance, ops-maturity等）

Description：

- `src/platform/` is权威平台核心目录。
- `src/core/` only保留兼容vs迁移收口，不新增 canonical 平台能力。
- `src/domains/`、`src/interaction/`、`src/org-governance/`、`src/scale-ecosystem/`、`src/ops-maturity/` 为Architecture v2.7 上层能力域。
- 若未来需要references入新的顶层域目录，必须先更新本 contract，再做迁移。

## 4. `config/` authoritative 结构

```text
config/
  bootstrap/
  conversation/
  cost-alert/
  domains/
  dr/
  environments/
  exception-recovery/
  gateways/
  knowledge/
  nl-gateway/
  plugins/
  product/
  providers/
  quality/
  risk/
  runtime/
  security/
  workflows/
```

含义：

- `bootstrap/`: 平台启动时必须加载的基础configure。
- `conversation/`: 对话模板、线程vs UX 相关configure。
- `cost-alert/`: 成本thresholdvs告警策略。
- `domains/`: 领域Description符、接入vsdefaults to治理configure。
- `dr/`: 跨 region / 故障恢复参数。
- `environments/`: 环境级开关vs promote 门槛。
- `exception-recovery/`: panic / resume / replay / repair 相关策略。
- `runtime/`: concurrent、timeout、重试、队列等运lines参数。
- `security/`: permission、审批threshold、危险操作策略。
- `providers/`: LLM provider、模型路由、降级策略。
- `gateways/`: CLI/Web/Telegram 等渠道configure。
- `knowledge/`: knowledge / semantic backend / retention configure。
- `nl-gateway/`: 自然语言入口、歧义澄清vs分解门禁。
- `plugins/`: 插件、pack、connect器defaults toconfigure。
- `product/`: 计费、市场、租户产品面configure。
- `quality/`: eval、quality gate vs回归基线。
- `risk/`: 风控评估vs deny/approve configure。
- `workflows/`: HQ 级共享 workflow 模板。

补充Description：

- configure四层优先级、prompt / config / policy / flag 解耦、defaults to值注册中心以下钻文档 `configuration_layers_and_defaults_contract.md` 为准。

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
- `roles/` 只保存角色提示vs角色Description，不保存运lines时Status。
- `workflows/` 只保存声明式流程defines。
- `schemas/` 保存该事业部输入输出、artifact 或table单的结构约束。

## 6. `data/` 结构约束

本地开发环境可采用：

```text
data/
  sqlite/
  artifacts/
  logs/
```

规则：

- SQLite 文件、artifact 和日志物理隔离。
- `data/` onlyused for本地或单机开发环境，不作为长期生产设计事实源。

## 7. 所有权vs变更约束

- 目录结构变更应先改本 contract，再改 `docs_zh/architecture/00-04`、`operations/` vs对应实现。
- 若需要references入 `apps/` 多进程结构，应新增 ADR，并更新本 contract。
- 当前阶段不references入过早的微服务拆分。

## 8. 补充规则

- `src/platform/five-plane-interface/api/http-server/` 下的 route 模块应按资源命名，如 `task-routes.ts`、`approval-routes.ts`、`health-routes.ts`，避免按 HTTP 动词拆分。
- `tests/` 最少分为 `unit/`、`integration/`、`e2e/` 三层，fixture vs replay 资源单独放在共享目录。
- 生产环境不relies on本地 `data/`，应替换为data库、对象storage和集中日志/审计后端。
