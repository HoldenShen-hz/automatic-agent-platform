/**
 * E2E Scheduled Workflow Suspension Tests
 *
 * End-to-end tests covering long-running workflow suspension and resumption:
 * - Workflow can be suspended for various wait kinds (timer, human_input, etc.)
 * - Suspended workflows can be resumed when conditions are met
 * - Expired suspensions trigger appropriate timeout policies
 * - Resume windows are calculated correctly
 */
export {};
