# Grafana Dashboard Baseline

- Supported Grafana baseline: `10.4.x`
- Dashboard schema version: `39`
- Provisioning mode is GitOps-owned: `allowUiUpdates: false`
- Dashboard `uid` is intentionally omitted so each environment can assign its own stable UID at import/provision time.
- Datasource binding uses the provisioned template input `${datasource}` instead of a hard-coded datasource UID.

Operator notes:

- Keep `deploy/grafana/dashboards/automatic-agent.json` and this compatibility note in sync when bumping `schemaVersion`.
- If you need a fleet-wide fixed UID, inject it at provisioning time rather than committing one shared UID into the repository baseline.
