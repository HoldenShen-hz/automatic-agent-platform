# ADR-116 Interface Rate Limit Key Design

- 状态：Accepted

## 背景
不同入口曾使用不同 rate-limit key，导致运营侧无法预测限流是否共享桶。

## 决策
- rate-limit key 设计必须明确维度：
  - entryPoint
  - tenantId（如可得）
  - clientIp 或 service identity
  - endpoint / route id
- 不同入口是否共享桶必须显式定义，不能依靠实现偶然一致。
- 任何 fallback key 都必须文档化，避免“一个入口按 IP，另一个入口按 inject 前缀”的隐式差异。

## 结果
- 限流策略成为显式运维接口，而不是实现细节。

## 相关实现
- `src/platform/five-plane-interface/api/http-api-server.ts`
- `src/platform/five-plane-interface/api/http-server/*`
