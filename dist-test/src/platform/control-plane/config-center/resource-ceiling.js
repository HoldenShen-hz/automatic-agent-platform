/**
 * @fileoverview Resource Ceiling Guard interface.
 *
 * Defines the contract for resource ceiling guards that evaluate execution
 * resource usage against configured limits. This interface allows the tools
 * layer to depend on an abstraction rather than the concrete runtime implementation.
 */
import { ExecutionResourceCeilingGuard } from "../../execution/dispatcher/execution-resource-ceiling-guard.js";
export function createDefaultResourceCeilingGuard() {
    return new ExecutionResourceCeilingGuard();
}
//# sourceMappingURL=resource-ceiling.js.map