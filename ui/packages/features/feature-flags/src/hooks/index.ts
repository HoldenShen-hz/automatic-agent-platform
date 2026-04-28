import { useQuery } from "@tanstack/react-query";
import type { FeatureFlagDTO } from "@aa/shared-types";
import { fetchFeatureFlags } from "@aa/shared-api-client";

export function useFeatureFlagsVm() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => fetchFeatureFlags({} as never) as Promise<readonly FeatureFlagDTO[]>,
  });
}