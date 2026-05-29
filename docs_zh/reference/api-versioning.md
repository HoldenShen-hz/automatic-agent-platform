# API 版本策略

本文档定义 API 文档和实现的版本口径，避免 `docs_zh` API 文档与实际路由长期漂移。

## 版本层级

- 路由前缀：稳定公共 API 保留 `/api/v1` 路径。
- OpenAPI：以 `openapi.json` 为机器可读事实来源。
- 文档：`docs_zh/reference/` 记录人工说明和迁移注意事项。
- 请求协商：UI transport 通过 `Accept-Version` 发送可接受版本集合。
- 响应回显：服务端通过 `x-api-version` 暴露本次选中的版本。

## 变更规则

- 兼容变更可以保留当前主版本，例如新增可选字段或新增端点。
- 破坏性变更必须新增主版本或提供迁移兼容层。
- 删除字段、改变错误码、改变认证语义和改变分页默认值都视为破坏性变更。

## 发布要求

- API 变更必须同时更新 OpenAPI/golden 证据或明确说明不影响公共契约。
- SDK 变更必须说明服务端路由、错误类别和认证行为是否同步变化。
- 需要区分两类 client 协商模型：
  - UI shared api-client：每次请求发送 `Accept-Version`
  - SDK client：发送 `X-Platform-Version` / `X-SDK-Version` / `X-Contract-Version`，并在初始化阶段执行握手
- 两类模型的边界以 `docs_zh/adr/120-ui-sdk-client-transport-boundary.md` 为准，不能在文档里混写成同一条协议。
- 文档更新必须包含版本、生效时间和兼容性说明。

## 验证

- 点名运行相关 OpenAPI golden 测试。
- 对 SDK/API 路由变更运行最小定向测试。
- 不使用全量测试结果替代 API 契约证据。
