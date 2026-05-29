# Configuration Layers And Defaults Contract

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

本 contract definesconfigure分层、覆盖优先级、prompt / config / policy / flag 解耦规则，以及defaults to值注册中心。

相关文档：

- `project_structure_contract.md`
- `policy_engine_contract.md`
- `division_definition_contract.md`
- `adr/006-llm-provider-strategy.md`

## 2. configure五层

- `system config`
- `domain config`
- `division config`
- `role config`
- `runtime override`

优先级链：

`runtime override > role config > division config > domain config > system config > default registry`

## 3. 四class职责分离

- prompt：lines为倾向vstable达
- config：结构vs组织关系
- policy：强约束
- feature flag：启停控制

规则：

- 运lines时强约束不得只写进 prompt。
- feature flag 不替代permissionvs策略。
- config 不能用来偷偷覆盖 policy Decision。

## 3A. configure治理 Bundle

configure治理层via `ConfigBundle` 统一加载和校验所有configure层。当前阶段必须contains以下 6 个层：

| 层名 | 文件路径 | 职责 |
|---|-------|--------|
| `bootstrap` | `config/bootstrap/default.json` | 应用标识、phase 阶段声明、特性开关 |
| `gateways` | `config/gateways/default.json` | API 网关vs渠道适配configure |
| `domains` | `config/domains/default.json` | domain/tool bundle/plugin/namespace defaults toconfigure |
| `knowledge` | `config/knowledge/default.json` | knowledge namespace、trust、freshness configure |
| `memory` | `config/memory/default.json` | memory layer、promotion、decay configure |
| `kvcache` | `config/kvcache/default.json` | fixed prefix / domain block / variable suffix budget策略 |
| `providers` | `config/providers/default.json` | LLM provider connectvs profile 选择 |
| `runtime` | `config/runtime/default.json` | 运lines时参数：timeout、concurrent、agent rounds、tool calls |
| `security` | `config/security/default.json` | 沙箱模式、审批模式、远程 worker 注册策略 |
| `workflows` | `config/workflows/default.json` | 工作流definesvsdefaults to步骤模板 |

### 3A.1 configure版本

- 系统via对 bundle 做确定性 JSON 序列化后取 SHA256 前 16 位生成 `configVersion`。
- `configVersion` used for篡改检测：若运lines时 bundle 重新计算的版本vs已record版本inconsistent，doctor 应报告 `config.version_tampered`。

### 3A.2 验证规则

| 层 | 验证项 | 规则 |
|---|-------|--------|
| 所有层 | 存在性 | 缺失任一必须层时报 `config.missing_layer:{layerName}` |
| `runtime` | `defaultTaskTimeoutMs` | 必须为正数 |
| `runtime` | `defaultStepTimeoutMs` | 必须为正数 |
| `runtime` | `maxConcurrentTasks` | 必须为正整数 |
| `runtime` | `apiDefaultTimeoutMs` | 必须为正整数 |
| `runtime` | `apiMaxTimeoutMs` | 必须为正整数 |
| `runtime` | `maxAgentRounds` | 若声明则必须为正整数 |
| `runtime` | `maxToolCalls` | 若声明则必须为正整数 |
| `runtime` | `retryMax` | 必须为正整数 |
| `runtime` | `circuitBreaker.enabled` | 必须为布尔值 |
| `runtime` | `circuitBreaker.threshold` | 必须为正整数 |
| `runtime` | `rateLimit.enabled` | 必须为布尔值 |
| `runtime` | `rateLimit.requestsPerMinute` | 必须为正整数 |
| `runtime` | `configDriftReconciler.interval` | 必须为正整数 |
| `security` | `sandboxMode` | 必须为 `read_only \| workspace_write \| scoped_external_access \| restricted_exec` 之一 |
| `security` | `remoteWorkerRegistration.challengeTtlMs` | 必须为正数 |
| `security` | `remoteWorkerRegistration.allowedCapabilities` | 必须为非空字符串数组 |
| `providers` | provider / profile references用 | 必须在 model metadata registry 中存在匹配项 |
| `domains` | domain/tool bundle/plugin refs | 必须vs注册table一致 |
| `knowledge` | namespace / trust tier | 必须满足枚举vs边界约束 |
| `kvcache` | budget partition | fixed/domain/variable 三段budget之和必须可解释 |
| 生产环境 | `allowDestructiveActions` | 不得为 `true`（fail-closed） |

### 3A.3 JSONC supported

configure文件supported `//` linescomment、`/* */` 块comment和尾逗号。解析时先剥离comment再做 JSON parse。

### 3A.3A Schema 载体

- “versioned schema” 指存在权威且带版本的configure结构约束，不mandatory必须以内联 `$schema` 或独立 `*.schema.json` 文件形态交付。
- 允许usescode内的权威 executable schema / validator，只要其vs `configSchemaVersion` 一起受版本manage，并在 bundle 加载时强校验。

### 3A.4 Sandbox 路径约束

configure文件加载路径必须位于 config 根目录内，禁止via `../` 等路径遍历读取 config 目录外的文件。

## 4. defaults to值注册中心

至少统一manage：

- timeout defaults to值
- retry defaults to值
- queue limit defaults to值
- cost guard defaults to值
- heartbeat defaults to值

## 5. Provider / Model 元data注册table

涉及模型选择、budget、上下文限制、modalities、provider authentication方式的元data，不得散落在call点hardcodes。

最少应有统一 registry manage：

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
| `coding` | code生成vs编辑任务 |
| `balanced` | 通用任务，能力vs成本平衡 |
| `fast` | 低delayresponse优先的轻量任务 |

### 5.2 Metadata Source 优先级

- 系统内置 `bundled_snapshot`（带快照日期，如 `2026-04-05.bundled`）作为离线基线。
- 本地 `config/providers/models.json` 存在时覆盖内置快照（`local_override`）。
- 远端刷新为未来扩展预留（`remote_refresh`）。
- 本地文件don't exist时静默回退到内置快照，不报错。

规则：

- registry 可supported本地快照、离线uses、远端刷新，但 authoritative 字段形状必须稳定。
- 运lines时不得via字符串 contains 判断替代正式 capability metadata，除非belongs to短期兼容层。
- UI、CLI、server、policy、budget 和 provider routing 应优先消费统一 registry，而不iseach维护模型清单。

## 6. 收口Conclusion

configure体系最大的风险不is“configure项太多”，而isdefaults to值、提示词、YAML 和策略互相抢权；这份 contract 就is把它们的层级hardcoded。
