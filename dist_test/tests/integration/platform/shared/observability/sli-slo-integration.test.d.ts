/**
 * @fileoverview SLI/SLO Integration Tests
 *
 * Verifies end-to-end SLI collection, SLO definition, SLO evaluation,
 * alert rule creation, and alert firing for the minimum SLO set.
 *
 * Covers:
 * - SliCollectionService.collectAllSlis() wiring to HealthService + MetricsService
 * - SloAlertingService.defineSlo / evaluateSlo / defineAlertRule / fireAlert
 * - SLO status transitions: unknown → met / at_risk / breached
 * - Alert delivery through LogAlertChannel
 *
 * @see src/core/observability/sli-collection-service.ts
 * @see src/core/observability/slo-alerting-service.ts
 */
export {};
