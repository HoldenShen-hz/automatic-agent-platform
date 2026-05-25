# ADR-122 Domain Evidence 与 Session Replay Boundary

- 状态：Accepted
- 决策日期：2026-05-25

## 背景

领域注册、知识命名空间、checkpoint envelope、session JSONL replay 都已经存在，但它们的 authority boundary 之前没有明确写清，导致 review 把不同层面的证据职责混为一体。

## 决策

### 1. Session replay 的职责

- `SessionDualStorageService` 的权威职责是保存会话时间线与交互事件。
- Session replay 不是 domain lifecycle 审计总线，也不是知识命名空间策略引擎。
- domain lifecycle 事件的权威来源仍是 domain registry 发布的结构化事件。

### 2. Checkpoint 的领域归属

- Checkpoint envelope 可以携带 `domainId` / `namespaceId`，用于 retention、routing、governance 归属。
- 但 checkpoint payload 的 schema authority 仍然由 payload schema / envelope schema contract 决定。
- domain meta model 不负责替代 payload schema version 校验。

### 3. 知识命名空间与 session 的关系

- domain registry 负责声明某个 domain 允许的 knowledge namespace。
- session replay 默认不对历史消息重新执行 namespace policy 判定。
- 如需做 domain-aware replay/inspection，应通过上层 inspect/governance 视图组合 session timeline 与 domain registry / checkpoint metadata，而不是把所有 domain 事件塞进 session JSONL。

## 结果

- session chronology、domain lifecycle、checkpoint schema、knowledge namespace 各自保留单一 authority。
- 后续若增加跨层 inspect 视图，应走组合式查询，而不是让单一存储承担所有治理职责。
