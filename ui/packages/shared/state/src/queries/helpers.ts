import type { QueryFunction, QueryKey } from "@tanstack/react-query";

export function createReadonlyQuery<TQueryKey extends QueryKey, TResult>(
  queryKey: TQueryKey,
  queryFn: QueryFunction<TResult, TQueryKey>,
) {
  return {
    queryKey,
    queryFn,
  };
}
