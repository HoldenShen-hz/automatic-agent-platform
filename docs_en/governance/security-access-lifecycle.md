# security入职vs离职流程

本文档defines人员、服务账号和自动化凭据的访问生命cycle，覆盖入职authorization、permission变更、离职回收和审计留痕。

## 入职

- 由直属负责人提交访问申请，Description角色、业务范围、所需环境和有效期。
- 生产permissiondefaults to拒绝，必须Description操作场景并绑定审批人。
- 初始permission按最小permission授予，优先uses组和角色，不directly给个人绑定长期特权。
- 所有 secret via批准的 secret manager 或部署环境注入，禁止writes `.env`、脚本参数、日志和 fixture。

## permission变更

- permission升级必须record原因、期限和回滚计划。
- 临时permission到期自动回收；no法自动回收时必须建立日历提醒和审计record。
- 跨团队访问需要资源 owner 和security owner 双重确认。

## 离职和转岗

- 离职当天撤销 SSO、VPN、code仓库、CI/CD、云账号、data库和 observability 后台访问。
- 轮换个人曾接触的共享 token、机器人 token 和长期 API key。
- 检查最近 30 天审计日志，确认no异常export、permission提升或failed登录爆发。

## 证据

- 访问申请单。
- 审批record。
- permission变更 diff。
- secret 轮换record。
- 离职回收清单。
