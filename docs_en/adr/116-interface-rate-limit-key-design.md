# ADR-116 Interface Rate Limit Key Design

- Status: Accepted

## Background

Different entry points used different rate-limit keys, causing operations side to be unable to predict whether rate limiting shares buckets.

## Decision

- Rate-limit key design must specify dimensions:
  - entryPoint
  - tenantId (if available)
  - clientIp or service identity
  - endpoint / route id
- Whether different entry points share buckets must be explicitly defined; cannot rely on implementation accidentally being consistent.
- Any fallback key must be documented to avoid "one entry point uses IP, another entry point uses inject prefix" implicit differences.

## Results

- Rate limiting strategy becomes an explicit operations interface, not implementation details.

## Related Implementation

- `src/platform/five-plane-interface/api/http-api-server.ts`
- `src/platform/five-plane-interface/api/http-server/*`