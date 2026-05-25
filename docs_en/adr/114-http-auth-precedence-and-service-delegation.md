# ADR-114 HTTP Auth Precedence And Service Delegation

## Status
Accepted

## Decision
- External HTTP defaults to user auth.
- Internal service auth uses a dedicated service channel.
- Mixed user/service auth on one request must be rejected or handled by an explicit delegation flow.

