# ADR-114 HTTP Auth Precedence And Service Delegation

## Status
Accepted

## Background
HTTP entry may simultaneously carry user authentication header and service authentication header, previously lacked priority and audit attribution explanation.

## Decision
- External HTTP API defaults to user authentication chain as primary.
- Service-to-service authentication handles through internal service auth channel, not mixed with ordinary user header.
- If user and service authentication information simultaneously appear in the same request, default to reject or go through explicit proxy/delegation process,不做隐式优先级猜测.
- When service represents user execution, must simultaneously retain:
  - Original user principal
  - Delegated service principal
  - Audit attribution chain

## Result
- Eliminate ambiguity of "which of the dual auth headers in the same request takes effect".
- If on-behalf-of mode is added later, must be extended in the same ADR family.

## Related Implementation
- `src/platform/five-plane-interface/api/http-api-server.ts`
- `src/platform/five-plane-interface/api/service-auth.ts`

