import type { VerticalDomainId } from "./domain-baseline-catalog.js";
import { getVerticalDomainBaseline } from "./domain-baseline-catalog.js";

export interface DomainModulePreset<TTaskType extends string> {
  readonly domainId: VerticalDomainId;
  readonly displayName: string;
  readonly defaultWorkflowIds: readonly string[];
  readonly defaultToolBundleIds: readonly string[];
  readonly requiredCapabilities: readonly TTaskType[];
  readonly reviewRequiredTaskTypes: readonly TTaskType[];
}

export function createDomainModulePreset<TTaskType extends string>(
  domainId: VerticalDomainId,
  taskTypes: readonly TTaskType[],
  reviewRequiredTaskTypes: readonly TTaskType[],
): DomainModulePreset<TTaskType> {
  const baseline = getVerticalDomainBaseline(domainId);
  return {
    domainId,
    displayName: baseline.displayName,
    defaultWorkflowIds: baseline.definition.workflows.map((workflow) => workflow.workflowId),
    defaultToolBundleIds: baseline.definition.toolBundles.map((bundle) => bundle.bundleId),
    requiredCapabilities: [...taskTypes],
    reviewRequiredTaskTypes: [...reviewRequiredTaskTypes],
  };
}

export function requiresPresetReview<TTaskType extends string>(
  preset: DomainModulePreset<TTaskType>,
  taskType: TTaskType,
): boolean {
  return preset.reviewRequiredTaskTypes.includes(taskType);
}
