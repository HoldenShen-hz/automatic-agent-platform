# Engineering Change Rollback

- Scope: `shell.apply_patch`, `github.create_pr_draft`, `github.force_merge`, `test-runner.run_targeted_tests`
- Preconditions: retain the patch diff, targeted test report, and the related prepared-action receipt.
- Rollback actions: withdraw the PR, apply the reverse patch, restore affected files, and rerun the minimal validation set.
- Owner: `engineering-platform-owner`
