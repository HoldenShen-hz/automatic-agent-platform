# Engineering Change Rollback

- 适用范围：`shell.apply_patch`、`github.create_pr_draft`、`github.force_merge`、`test-runner.run_targeted_tests`
- 前置要求：保留 patch diff、targeted test report、相关 prepared-action receipt。
- 回滚动作：撤回 PR / 反向 patch / 恢复受影响文件 / 重新执行最小验证集。
- 责任人：engineering-platform-owner
