# Naming And Engineering Boundary Contract

## 1. 范围

本 contract 补充产品叙事vs工程实现的命名边界，并收口审计主体、渠道能力和运lines环境能力的统一抽象方向。

相关文档：

- `014-org-model-code-boundary.md`
- `gateway_message_contract.md`
- `execution_plane_contract.md`

## 2. 命名边界

- 对外产品叙事可uses CEO / VP / Lead
- 对内code优先uses中性工程对象：
  - `Router`
  - `Planner`
  - `DivisionCoordinator`
  - `HarnessRuntime`
  - `DecisionManager`

### 2.1 文档 canonical 写法

在主干文档、contract、ADR 和 guide 中，控制层对象统一写作：

- `strategic_governor`（业务别名：CEO）
- `intake_router`（业务别名：VP 运营）
- `workflow_planner`（业务别名：VP 编排）
- `division_lead`（业务别名：Lead Agent）

规则：

- 协议、schema、Status机、事件注册table中uses canonical id。
- 叙事 alias onlyused for产品table达、示意图和对外Description。
- 不允许把 `CEO / VP / Lead` directly写成调度主键、schema enum 或permission对象 id。

### 2.3 OAPEFLIR vs扩展对象 canonical 写法

以下对象在 contract / schema / API / event 中应uses canonical 工程命名：

- `observe_hub`
- `assess_hub`
- `plan_hub`
- `feedback_hub`
- `learn_hub`
- `improve_hub`
- `release_hub`
- `knowledge_plane`
- `memory_plane`
- `plugin_spi_registry`
- `domain_registry`

### 2.2 命名格式

- role / agent id: `snake_case`
- event type: `<domain>.<action>`
- DB table: plural `snake_case`
- config key: namespaced stable key
- env var: `UPPER_SNAKE_CASE`
- stage id: `snake_case`
- memory layer: `L1` ~ `L6`
- typed ref: `PascalCaseRef`

## 3. `ActorModel`

统一审计主体至少includes：

- `user`
- `agent`
- `system`
- `scheduler`
- `webhook`
- `admin`

## 4. `ChannelCapabilityMatrix`

渠道能力最少抽象：

- `text`
- `button`
- `attachment`
- `stream`
- `notification`
- `command_input`

## 5. `RuntimeEnvironmentCapabilityProfile`

运lines环境能力最少抽象：

- `local`
- `docker`
- `remote_worker`
- `serverless`
- `enterprise_sandbox`

## 6. `ResourceLease`

未来统一资源抽象的方向至少includes：

- token budget
- file lock
- worker slot
- network slot
- sandbox instance
- provider quota

## 7. 收口Conclusion

命名边界收紧后，产品叙事和工程实现就不会互相绑架；而 actor、channel、environment、resource 这几组抽象，is后续扩展性真正的共用基础。
