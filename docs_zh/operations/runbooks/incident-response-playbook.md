# 事件响应 Playbook

## 严重度目标

| Severity | Acknowledge | Mitigate | RCA |
| --- | --- | --- | --- |
| `P1` | 15 min | 1 hour | 24 hours |
| `P2` | 1 hour | 4 hours | 48 hours |

Prometheus/Alertmanager 映射：

- `severity=page` 或跨区域/核心写路径故障 -> `P1`
- `severity=critical` -> 默认按 `P1` 处理；若影响扩展到多区域、核心写路径或租户级大面积不可用，则提升为 `P0` 战情模式
- `severity=warning` -> 默认按 `P2` 处理

## 响应流程

1. **确认** 告警真实性并宣布 incident severity
2. **指定** incident commander 和 communications owner
3. **稳定** 平台：暂停 rollout、缩小 blast radius、恢复核心可用性
4. **保留** 证据，再执行破坏性恢复动作
5. **发布** 对内/对外更新，直到 mitigation 完成
6. **记录** 根因、促成因素和明确 follow-up action

## 升级矩阵

| From Severity | Trigger | To |
| --- | --- | --- |
| P2 | No progress in 30 min | P1 |
| P1 | Multi-region impact or >1hr no mitigation | War room + engineering lead |

## 通知模板

```
INCIDENT UPDATE [HH:MM UTC]
Severity: <P1/P2>
Status: Investigating/Stabilizing/Resolved
Impact: <affected services, user count if known>
Current Actions: <what team is doing now>
Next Update: <HH:MM+30m or sooner if material change>
```

## 事后复盘模板

```markdown
## Incident: <title> (<date>)

### Summary
<one paragraph description>

### Timeline
- HH:MM - Event
- HH:MM - Action taken
- HH:MM - Resolved

### Root Cause
<technical root cause>

### Contributing Factors
1. <factor 1>
2. <factor 2>

### Action Items
| Action | Owner | Due |
| --- | --- | --- |
| <action> | <owner> | <date> |
```

## 常用命令

```bash
# 检查系统健康
curl -f http://127.0.0.1:8010/healthz

# 查看近期错误
grep -r "ERROR" logs/ | tail -100

# 查看 Pod 状态
kubectl get pods -n automatic-agent

# 检查数据库连通性
sqlite3 "${AA_DB_PATH:-data/sqlite/automatic-agent.db}" "SELECT COUNT(*) FROM sqlite_master"

# 查看审计轨迹
cat logs/audit.json | jq '. | select(.level=="error")'
```

## Grafana Dashboard

- Platform overview: `https://grafana.internal/d/platform-overview`
- Execution metrics: `https://grafana.internal/d/execution-metrics`
- Agent health: `https://grafana.internal/d/agent-health`
