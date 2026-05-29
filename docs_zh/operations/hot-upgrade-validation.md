# 热升级验证

## 目标

- 证明 rolling upgrade 过程中不会丢请求、不会留下 orphan task，也不会出现 split-brain 协调。

## 步骤

1. 用 `bash deploy/scripts/deploy.sh <env> <tag> rolling` 部署基线版本。
2. 对 `/healthz`、`/v1/tasks` 和 websocket 订阅持续施加稳定合成流量。
3. 执行新镜像 tag 的 rolling upgrade。
4. 运行 `bash deploy/scripts/verify-hot-upgrade.sh <base-url>` 做升级后验证。
5. 对比升级前后的 P99 latency、错误数、active lease owner 和 websocket reconnect 量。
6. 把输出证据写入 release bundle。

## 通过标准

- rollout 窗口内 `healthz` 零失败。
- P99 latency 不超过基线的 2 倍。
- 不存在 orphan task 或重复 lease holder。
- websocket client 无需人工介入即可自动重连。
