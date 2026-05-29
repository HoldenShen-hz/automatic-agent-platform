# API 版本策略

本文档defines API 文档和实现的版本口径，避免 `docs_zh` API 文档vs实际路由长期漂移。

## 版本层级

- 路由前缀：稳定公共 API 保留 `/api/v1` 路径。
- OpenAPI：以 `openapi.json` 为机器可读事实来源。
- 文档：`docs_zh/reference/` record人工Description和迁移注意事项。
- request协商：UI transport via `Accept-Version` 发送可accepts版本集合。
- response回显：服务端via `x-api-version` 暴露本iterations选中的版本。

## 变更规则

- 兼容变更可以保留当前主版本，例如新增optional字段或新增端点。
- 破坏性变更必须新增主版本或提供迁移兼容层。
- 删除字段、改变错误码、改变authentication语义和改变分页defaults to值都视为破坏性变更。

## 发布要求

- API 变更必须同时更新 OpenAPI/golden 证据或明确Description不Impact公共契约。
- SDK 变更必须Description服务端路由、错误class别和authenticationlines为isnosynchronous变化。
- 需要区分两class client 协商模型：
  - UI shared api-client：每iterationsrequest发送 `Accept-Version`
  - SDK client：发送 `X-Platform-Version` / `X-SDK-Version` / `X-Contract-Version`，并在初始化阶段执lines握手
- 两class模型的边界以 `docs_zh/adr/120-ui-sdk-client-transport-boundary.md` 为准，不能在文档里混写成同一条协议。
- 文档更新必须contains版本、生效time和兼容性Description。

## 验证

- 点名运lines相关 OpenAPI golden 测试。
- 对 SDK/API 路由变更运lines最小定向测试。
- 不usesfull测试结果替代 API 契约证据。
