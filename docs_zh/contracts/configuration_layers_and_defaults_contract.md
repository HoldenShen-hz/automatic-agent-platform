# Configuration Layers And Defaults Contract

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

本 contract 定义配置分层、覆盖优先级、prompt / config / policy / flag 解耦规则，以及默认值注册中心。

相关文档：

- `project_structure_contract.md`
- `policy_engine_contract.md`
- `division_definition_contract.md`
- `adr/006-llm-provider-strategy.md`

## 2. 配置五层

- `system config`
- `domain config`
- `division config`
- `role config`
- `runtime override`

优先级链：

`runtime override > role config > division config > domain config > system config > default registry`

## 3. 四类职责分离

- prompt：行为倾向与表达
- config：结构与组织关系
- policy：强约束
- feature flag：启停控制

规则：

- 运行时强约束不得只写进 prompt。
- feature flag 不替代权限与策略。
- config 不能用来偷偷覆盖 policy 决策。

## 3A. 配置治理 Bundle

配置治理层通过 `ConfigBundle` 统一加载和校验所有配置层。当前阶段必须包含以下 6 个层：

| 层名 | 文件路径 | 职责 |
| --- | --- | --- |
| `bootstrap` | `config/bootstrap/default.json` | 应用标识、phase 阶段声明、特性开关 |
| `gateways` | `config/gateways/default.json` | API 网关与渠道适配配置 |
| `domains` | `config/domains/default.json` | domain/tool bundle/plugin/namespace 默认配置 |
| `knowledge` | `config/knowledge/default.json` | knowledge namespace、trust、freshness 配置 |
| `memory` | `config/memory/default.json` | memory layer、promotion、decay 配置 |
| `kvcache` | `config/kvcache/default.json` | fixed prefix / domain block / variable suffix 预算策略 |
| `providers` | `config/providers/default.json` | LLM provider 连接与 profile 选择 |
| `runtime` | `config/runtime/default.json` | 运行时参数：timeout、并发、agent rounds、tool calls |
| `security` | `config/security/default.json` | 沙箱模式、审批模式、远程 worker 注册策略 |
| `workflows` | `config/workflows/default.json` | 工作流定义与默认步骤模板 |

### 3A.1 配置版本

- 系统通过对 bundle 做确定性 JSON 序列化后取 SHA256 前 16 位生成 `configVersion`。
- `configVersion` 用于篡改检测：若运行时 bundle 重新计算的版本与已记录版本不一致，doctor 应报告 `config.version_tampered`。

### 3A.2 验证规则

| 层 | 验证项 | 规则 |
| --- | --- | --- |
| 所有层 | 存在性 | 缺失任一必须层时报 `config.missing_layer:{layerName}` |
| `runtime` | `defaultTaskTimeoutMs` | 必须为正数 |
| `runtime` | `defaultStepTimeoutMs` | 必须为正数 |
| `runtime` | `maxConcurrentTasks` | 必须为正整数 |
| `security` | `sandboxMode` | 必须为 `read_only \| workspace_write \| danger_full_access` 之一 |
| `security` | `remoteWorkerRegistration.challengeTtlMs` | 必须为正数 |
| `security` | `remoteWorkerRegistration.allowedCapabilities` | 必须为非空字符串数组 |
| `providers` | provider / profile 引用 | 必须在 model metadata registry 中存在匹配项 |
| `domains` | domain/tool bundle/plugin refs | 必须与注册表一致 |
| `knowledge` | namespace / trust tier | 必须满足枚举与边界约束 |
| `kvcache` | budget partition | fixed/domain/variable 三段预算之和必须可解释 |
| 生产环境 | `allowDestructiveActions` | 不得为 `true`（fail-closed） |

### 3A.3 JSONC 支持

配置文件支持 `//` 行注释、`/* */` 块注释和尾逗号。解析时先剥离注释再做 JSON parse。

### 3A.4 Sandbox 路径约束

配置文件加载路径必须位于 config 根目录内，禁止通过 `../` 等路径遍历读取 config 目录外的文件。

## 4. 默认值注册中心

至少统一管理：

- timeout 默认值
- retry 默认值
- queue limit 默认值
- cost guard 默认值
- heartbeat 默认值

## 5. Provider / Model 元数据注册表

涉及模型选择、预算、上下文限制、modalities、provider 认证方式的元数据，不得散落在调用点硬编码。

最少应有统一 registry 管理：

- `provider_id`
- `model_id`
- `capability_labels`
- `context_limit`
- `max_output_limit`
- `pricing`
- `modalities`
- `auth_methods`
- `status` (`active | degraded | disabled | deprecated`)
- `metadata_source` (`bundled_snapshot | local_override | remote_refresh`)
- `tier` (`reasoning | coding | balanced | fast`)
- `kv_cache_support` (`none | prefix_only | segmented`)

### 5.1 Model Tier 语义

| tier | 适用场景 |
| --- | --- |
| `reasoning` | 需要深度推理的复杂任务 |
| `coding` | 代码生成与编辑任务 |
| `balanced` | 通用任务，能力与成本平衡 |
| `fast` | 低延迟响应优先的轻量任务 |

### 5.2 Metadata Source 优先级

- 系统内置 `bundled_snapshot`（带快照日期，如 `2026-04-05.bundled`）作为离线基线。
- 本地 `config/providers/models.json` 存在时覆��内置快照（`local_override`）。
- 远端刷新为未来扩展预留（`remote_refresh`）。
- 本地文件不存在时静默回退到内置快照，不报错。

规则：

- registry 可支持本地快照、离线使用、远端刷新，但 authoritative 字段形状必须稳定。
- 运行时不得通过字符串 contains 判断替代正式 capability metadata，除非属于短期兼容层。
- UI、CLI、server、policy、budget 和 provider routing 应优先消费统一 registry，而不是各自维护模型清单。

## 6. 收口结论

配置体系最大的风险不是“配置项太多”，而是默认值、提示词、YAML 和策略互相抢权；这份 contract 就是把它们的层级写死。
