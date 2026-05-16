import type { DelegationEventRepository, DelegationRepository } from "../../five-plane-state-evidence/truth/sqlite/repositories/delegation-repository.js";
import { DelegationManagerService } from "./delegation-manager.service.js";
import type { DelegationManagerOptions } from "./delegation-manager-support.js";

export function createDelegationManager(
  options?: DelegationManagerOptions,
  delegationRepository?: DelegationRepository,
  eventRepository?: DelegationEventRepository,
): DelegationManagerService {
  return new DelegationManagerService(options, delegationRepository, eventRepository);
}
