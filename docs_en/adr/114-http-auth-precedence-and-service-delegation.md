# ADR-114 HTTP Auth Precedence And Service Delegation

- Status: Accepted

## Background

HTTP entry may simultaneously carry user authentication header and service authentication header; previously there was lack of priority and audit attribution description.

## Decision

- External HTTP API defaults to user authentication chain as primary.
- Service-to-service authentication is handled via internal service auth channel, not mixed with ordinary user headers.
- If user and service authentication information both appear in the same request, default to reject or go through explicit proxy/delegation process; do not make implicit priority guesses.
- When service executes on behalf of user, must simultaneously retain:
  - Original user principal
  - Delegating service principal
  - Audit attribution chain

## Results

- Eliminates ambiguity about "which of the dual authentication headers in the same request takes effect".
- If on-behalf-of mode is added later, it must be expanded in the same ADR family.

## Related Implementation

- `src/platform/five-plane-interface/api/http-api-server.ts`
- `src/platform/five-plane-interface/api/service-auth.ts`