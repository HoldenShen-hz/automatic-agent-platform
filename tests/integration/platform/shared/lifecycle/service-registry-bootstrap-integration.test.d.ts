/**
 * Integration Test: Service Registry Bootstrap
 *
 * Verifies:
 * - Bootstrap registration of core platform services
 * - ServiceRegistry wiring with network-egress-audit, network-egress-policy,
 *   output-continuation, delegation-audit, and delegation-governance
 * - Dependency resolution between bootstrapped services
 * - Lazy initialization and teardown of bootstrap services
 */
import "../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js";
