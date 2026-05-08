import type { QueryFunction, QueryKey } from "@tanstack/react-query";
import type { CursorPage, PaginationParams } from "@aa/shared-api-client";

export function createReadonlyQuery<TQueryKey extends QueryKey, TResult>(
  queryKey: TQueryKey,
  queryFn: QueryFunction<TResult, TQueryKey>,
) {
  return {
    queryKey,
    queryFn,
  };
}

export function createCursorInfiniteQuery<TItem>(
  queryKey: QueryKey,
  queryFn: (pagination?: PaginationParams) => Promise<CursorPage<TItem>>,
  pagination?: Omit<PaginationParams, "cursor">,
) {
  const scopedQueryKey = [...queryKey, { pageSize: pagination?.pageSize ?? null, sort: pagination?.sort ?? null, filter: pagination?.filter ?? null }] as const;

  return {
    queryKey: scopedQueryKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) => queryFn({
      ...pagination,
      ...(pageParam == null ? {} : { cursor: pageParam }),
    }),
    getNextPageParam: (lastPage: CursorPage<TItem>) => lastPage.nextCursor ?? undefined,
  };
}

export function flattenCursorPages<TItem>(pages: readonly CursorPage<TItem>[] | undefined): readonly TItem[] {
  if (pages == null) {
    return [];
  }
  return pages.flatMap((page) => page.items);
}
