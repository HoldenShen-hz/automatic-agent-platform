# ADR-120 UI 与 SDK Client Transport Boundary

- 状态：Accepted
- 决策日期：2026-05-25

## 背景

UI 客户端与 SDK 客户端都访问同一平台 API，但它们服务的运行环境不同：

- UI 运行在浏览器，需要处理离线、令牌刷新、WebSocket 交互体验。
- SDK 运行在自动化/服务端环境，更强调确定性请求、显式握手、SSE 流式订阅。

这些差异已经在实现中存在，但之前没有权威说明，导致若干 review 把它们误判成“不一致缺陷”。

## 决策

### 1. 离线写入

- 离线写队列是 UI-only 能力。
- SDK 不承担浏览器离线重放职责；网络失败默认显式返回错误。
- UI 离线队列中的 `ui-operator` 仅表示本地操作代理，不等同于服务端 principal。

### 2. 版本协商

- UI 通过 `Accept-Version` 头表达前端可接受的 API 版本集合。
- SDK 通过 `/handshake` 与 `X-Platform-Version` / `X-SDK-Version` / `X-Contract-Version` 做显式版本协商。
- 两者可以并存，不要求逐请求头完全一致。

### 3. 认证刷新与拦截器

- UI 允许使用 interceptor 链完成 token 注入、401 刷新与重试。
- SDK 把重试逻辑内聚在 request path，而不是暴露浏览器态的 token-refresh interceptor 模式。
- 这两条路径共享认证契约，但不共享实现形态。

### 4. 实时订阅与降级

- UI 的 primary realtime transport 是 WebSocket。
- SDK 的 primary streaming transport 是 SSE。
- UI 中 `sse-fallback` 当前仅表示降级状态，不代表自动建立真实 SSE 通道。

### 5. 韧性策略

- UI transport 可以使用本地 circuit breaker，以保护交互体验并快速 fail-fast。
- SDK transport 默认使用有限重试与退避，不内置 UI 风格 breaker。
- WebSocket reconnect 与 SSE reconnect 可以拥有不同 backoff/jitter/max-attempt 策略。

## 结果

- UI 与 SDK 的 client transport 差异被视为 intentional boundary，而不是必须完全同构。
- 后续若要共享实现，应以共享 contract/telemetry 为前提，而不是强行合并 transport 机制。
