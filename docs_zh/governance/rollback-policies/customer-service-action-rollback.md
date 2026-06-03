# Customer Service Action Rollback

- 适用范围：`refund.*`、`ticket.*`、`order.read_order`
- 前置要求：保留 policy lookup receipt、entitlement evidence、operator approval trace。
- 回滚动作：撤销草稿、撤回分派、提交补偿说明、必要时升级人工复核。
- 责任人：enterprise-ops-owner
