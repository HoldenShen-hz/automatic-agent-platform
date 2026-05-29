# 数据库问题 Runbook

## 症状

- `/healthz` 报告数据库不可写
- migration 或 startup check 失败
- queue dispatch 因 storage error 卡住

## 诊断

1. 先确认当前 storage backend 是 SQLite 还是 PostgreSQL。
2. 对 PostgreSQL，检查连通性、凭证和 `schema_migrations` 是否最新。
3. 对 SQLite，检查 `AA_DB_PATH`、文件属主、磁盘空间、WAL 模式和锁竞争。
4. 在任何 schema 变更前先回看最近的 deployment 或 migration 活动。

SQLite 路径说明：

- local/dev 常见路径是 `./data/sqlite/automatic-agent-demo.db` 或 `./data/sqlite/automatic-agent-dev.db`
- container/Helm 默认通常是 `data/sqlite/automatic-agent.db`
- 不要假设只有一个硬编码路径，应以实际 `AA_DB_PATH` 为准

## 处置

1. 先恢复基础连通性，再重试 migration 或写流量。
2. 对 SQLite 锁竞争，先降低并发写，再在确认锁持有者后决定是否重启。
3. 对 PostgreSQL schema drift，走批准过的 migration 路径并校验 `schema_migrations`。
4. 若短时间内无法恢复写入，就切到 read-only 或暂停非关键流量。

## 验证

1. 反复执行 health check，直到数据库可写状态稳定转绿。
2. 确认积压工作开始排空，日志里不再出现新的 storage error。
3. 在 incident record 中记录根因、具体 SQL/migration 版本和恢复时长。
