# API Client 使用说明

本仓 UI 的 API SDK 位于 `ui/packages/shared/api-client`，公共入口是
`@aa/shared-api-client`。

## 公共能力

- `RESTClient`: 统一 REST 请求、拦截器、幂等重试和错误包装。
- `WSClient`: 统一浏览器 WebSocket、SharedWorker WebSocket 和内存 fallback。
- `WSEventRouter`: 按频道路由事件，并为高优先级事件触发 UI 刷新。
- `interceptors`: 负责认证头、trace/correlation、错误归一化。

## 约束

- Feature 层只能依赖 API client 的公共导出，不直接访问 Layer A/B 内部端点。
- Planned 后端能力必须经 typed mock 和 feature gate 暴露，不在 UI 中伪装成生产可用。
- SharedWorker 客户端在 `disconnect()` 时必须移除 message listener、清空 replay buffer 并关闭 port。

## 版本协商

- UI API client 的真实 HTTP transport 会在请求头里发送 `Accept-Version`。
- 服务端协商结果通过 `x-api-version` 返回。
- Node/CLI SDK 不默认复用 UI 的逐请求协商模型，而是走握手 + `X-Platform-Version` / `X-SDK-Version` / `X-Contract-Version` 头。
- 这两个表面故意不同，详细边界见 `docs_zh/adr/120-ui-sdk-client-transport-boundary.md`。
