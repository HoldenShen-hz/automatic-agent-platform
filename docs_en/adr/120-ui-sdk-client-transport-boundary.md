# ADR-120 UI vs SDK Client Transport Boundary

- Status：Accepted
- Decision日期：2026-05-25

## Background

UI 客户端vs SDK 客户端都访问同一平台 API，但它们服务的运lines环境不同：

- UI 运lines在浏览器，需要handle离线、令牌刷新、WebSocket 交互体验。
- SDK 运lines在自动化/服务端环境，更强调确定性request、显式握手、SSE 流式订阅。

这些差异已via在实现中存在，但之前没有权威Description，导致若干 review 把它们误判成“inconsistent缺陷”。

## Decision

### 1. 离线writes

- 离线写队列is UI-only 能力。
- SDK 不承担浏览器离线重放职责；networkfaileddefaults to显式返回错误。
- UI 离线队列中的 `ui-operator` onlytable示本地操作代理，不等同于服务端 principal。

### 2. 版本协商

- UI via `Accept-Version` 头table达前端可accepts的 API 版本集合。
- SDK via `/handshake` vs `X-Platform-Version` / `X-SDK-Version` / `X-Contract-Version` 做显式版本协商。
- 两者可以并存，不要求逐request头完全一致。

### 3. authentication刷新vs拦截器

- UI 允许uses interceptor 链完成 token 注入、401 刷新vs重试。
- SDK 把重试逻辑内聚在 request path，而不is暴露浏览器态的 token-refresh interceptor 模式。
- 这两条路径共享authentication契约，但不共享实现形态。

### 4. 实时订阅vs降级

- UI 的 primary realtime transport is WebSocket。
- SDK 的 primary streaming transport is SSE。
- UI 中 `sse-fallback` 当前onlytable示降级Status，不代table自动建立真实 SSE 通道。

### 5. 韧性策略

- UI transport 可以uses本地 circuit breaker，以保护交互体验并快速 fail-fast。
- SDK transport defaults touses有限重试vs退避，不内置 UI 风格 breaker。
- WebSocket reconnect vs SSE reconnect 可以拥有不同 backoff/jitter/max-attempt 策略。

## 结果

- UI vs SDK 的 client transport 差异被视为 intentional boundary，而不is必须完全同构。
- 后续若要共享实现，应以共享 contract/telemetry 为前提，而不is强lines合并 transport 机制。
