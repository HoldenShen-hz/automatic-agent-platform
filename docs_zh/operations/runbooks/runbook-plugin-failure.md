# Plugin 故障 Runbook

## 症状

- plugin runtime error、timeout 或 crash loop
- sandbox denial 或协议失败重复出现
- 某个 domain workflow 失败，但系统其它部分仍健康

## 诊断

1. 确认受影响的 plugin ID、SPI 类型和 runtime isolation mode。
2. 判断该 plugin 是 built-in domain plugin 还是 external package。
3. 对 built-in plugin，先对照当前 canonical ID：
   - `plugin.operations.retriever`
   - `plugin.operations.presenter`
   - `plugin.gamedev.retriever`
   - `plugin.gamedev.engine_adapter`
   - `plugin.livestream.retriever`
   - `plugin.livestream.obs_adapter`
4. 查看 plugin runtime host 日志，确认是 timeout、protocol 还是 sandbox error。
5. 确认 plugin 当前运行在 `forked_process`、`sandboxed_process` 还是 `containerized_process`。
6. 检查近期 plugin manifest、sandbox policy 或凭证变更。

## 处置

1. 先停用或隔离故障 plugin binding，阻止影响继续扩散。
2. 如果问题与隔离级别有关，回退到更安全的 runtime profile，而不是直接放宽权限。
3. 如果是坏版本发布，恢复到前一个 plugin 版本并重新做 health check。
4. 如果 plugin 依赖外部凭证或 API，先修复或轮转它们，再恢复流量。

## 验证

1. 确认 plugin health check 恢复，且不再出现新的 runtime crash。
2. 对受影响 workflow 路径补一个有边界的 smoke test。
3. 记录根因属于代码、配置、凭证还是 sandbox。
4. 如果故障 plugin 是 built-in，使用 `tests/unit/plugins/builtin-plugin-registry-full.test.ts` 校验 manifest metadata。
