# Red Team Security Tests

This directory contains penetration testing and red-team style security tests
that verify the system's resilience against adversarial inputs and attacks.

## Related Tests

The actual red-team tests are located in the parent `tests/integration/security/` directory:

- `command-injection-advanced.test.ts` - Command injection attempts
- `path-traversal-advanced.test.ts` - Path traversal attacks
- `ssrf-prevention.test.ts` - Server-Side Request Forgery prevention
- `data-leakage-prevention.test.ts` - Data exfiltration prevention

## Running Red Team Tests

```bash
# Run all security tests including red team tests
node --test tests/integration/security/*.test.js

# Run specific red team test
node --test tests/integration/security/command-injection-advanced.test.js

# Run with security audit logging
AA_SECURITY_AUDIT=1 node --test tests/integration/security/command-injection-advanced.test.js
```

## Design Principles

1. **Assume adversarial input** - Tests verify that malicious inputs are rejected
2. **Defense in depth** - Multiple layers must fail before data can leak
3. **Fail securely** - When in doubt, deny access rather than allowing it
