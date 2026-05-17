# Release Checklist

> This checklist must be completed and signed off before any production deployment.
> Copy the completed checklist into the release evidence bundle.

---

## Pre-Release

### Code Quality

- [ ] All P0/P1 tasks from the current sprint are completed and merged to the release branch
- [ ] `npm run build` completes without errors
- [ ] `npm run typecheck` reports zero errors
- [ ] `npm run lint` reports zero errors (or all violations are acknowledged and documented)
- [ ] No `FIXME`, `HACK`, or `TODO` comments introduced in the changed code
- [ ] No hardcoded secrets, credentials, or test keys in committed code
- [ ] New environment variables are documented in `.env.example`

### Testing

- [ ] `npm run test:unit` passes (all unit tests green)
- [ ] `npm run test:integration` passes (all integration tests green)
- [ ] `npm run test:golden` passes (all golden path tests green)
- [ ] Code coverage meets thresholds: lines >= 75%, branches >= 70%
- [ ] New code paths have corresponding unit tests

### Security

- [ ] `npm audit --level high` reports zero vulnerabilities (or all are acknowledged with CVEs documented)
- [ ] All API secret comparisons use `timingSafeEqual`
- [ ] All POST routes have Zod schema validation
- [ ] HTTP body size limits are enforced
- [ ] Webhook signature verification is in place
- [ ] SSRF guard is active for all outbound URLs
- [ ] JWT validation includes algorithm whitelist and max-age check

### Database Migrations

- [ ] New migrations are registered in `sqlite-migration-plan.ts`
- [ ] Migration checksum validation is enabled
- [ ] All migrations tested on a fresh database bootstrap
- [ ] Downgrade path is documented for each migration
- [ ] No destructive schema changes without a compatible migration strategy

### Observability

- [ ] Structured logger is producing JSONL output
- [ ] `traceId` / `taskId` / `sessionId` context propagation is verified
- [ ] `/healthz` endpoint returns DB and provider status
- [ ] Health check includes dependency liveness for storage, event bus, and providers

### Configuration

- [ ] All `process.env` accesses route through config loaders (no direct env reads in core)
- [ ] New config keys are documented in `config/` or `.env.example`
- [ ] Feature flags / kill switches are identified and documented

---

## Release

### Versioning

- [ ] Version bumped according to Semantic Versioning (patch / minor / major)
- [ ] `CHANGELOG.md` updated with all changes since last release
- [ ] Git tag created: `v{major}.{minor}.{patch}` (e.g., `v0.2.0`)
- [ ] Tag is signed (`git tag -s`) or annotated (`git tag -a`)

### Build Artifact

- [ ] `npm run build` produces clean `dist/` (no `tests/` directory included)
- [ ] Docker image builds successfully
- [ ] Docker image passes `docker healthcheck`
- [ ] Docker uses tini as PID 1
- [ ] Build artifact is pushed to the container registry

### Deployment

- [ ] Deployment tested on staging environment
- [ ] Staging health check responds 200 after deployment
- [ ] Database migration runs successfully on staging
- [ ] Smoke test passes on staging (`npm run doctor`)
- [ ] Canary deployment configured (if applicable)
- [ ] Rollback plan documented and tested

---

## Post-Release

### Monitoring

- [ ] Error rate stable for 1 hour after deployment
- [ ] P50/P95/P99 latency not degraded vs. previous release
- [ ] Provider uptime monitored (Anthropic, OpenAI, MiniMax)
- [ ] Session creation rate within normal bounds
- [ ] Approval queue depth within normal bounds

### Rollback Readiness

- [ ] Previous Docker image tag is preserved and redeployable
- [ ] Database migration is backward-compatible (previous version can read new schema)
- [ ] Rollback can be executed via `npm run rollback:stable` or documented manual steps
- [ ] Rollback has been rehearsed in staging within the last 30 days

### Documentation

- [ ] `CHANGELOG.md` reflects all changes in this release
- [ ] API changes are documented (new endpoints, deprecated routes)
- [ ] New environment variables are added to `.env.example`
- [ ] Runbook updated for any new operational procedures

### Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| Security Review | | | |
| QA | | | |
| DevOps / Platform | | | |

---

## Emergency Rollback Procedure

If a release causes a production incident:

1. **Immediate**: Run `npm run rollback:stable` or redeploy previous Docker image tag
2. **Notify**: Page on-call engineer and open incident ticket
3. **Assess**: Determine root cause within 30 minutes
4. **Communicate**: Update status page within 15 minutes of incident declaration
5. **Review**: Conduct blameless postmortem within 48 hours

### Rollback Command Reference

```bash
# Quick rollback via Docker
docker pull ${REGISTRY}:${PREVIOUS_TAG}
docker stop ${CONTAINER_NAME}
docker rm ${CONTAINER_NAME}
docker run -d --name ${CONTAINER_NAME} ${REGISTRY}:${PREVIOUS_TAG}

# Verify rollback
npm run doctor
curl -s https://${PROD_HOST}/healthz | jq .
```