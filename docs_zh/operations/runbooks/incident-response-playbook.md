# Incident Response Playbook

## Severity Targets

- `P1`: acknowledge within 15 minutes, mitigate within 1 hour, RCA within 24 hours
- `P2`: acknowledge within 1 hour, mitigate within 4 hours, RCA within 48 hours

## Response Flow

1. Confirm alert fidelity and declare incident severity.
2. Appoint an incident commander and a communications owner.
3. Stabilize the platform first: pause rollouts, reduce blast radius, and restore core availability.
4. Preserve evidence before destructive recovery actions.
5. Publish customer/internal updates on a fixed cadence until mitigation completes.
6. After recovery, document root cause, contributing factors, and concrete follow-up actions.
