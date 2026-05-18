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

export interface CursorPage<TItem> {
  readonly items: readonly TItem[];
  readonly nextCursor: string | null;
  readonly prevCursor: string | null;
}

export interface CursorPageParam {
  readonly cursor: string | null;
  readonly pageSize?: number;
  readonly sort?: string;
  readonly filter?: string | null;
}

export interface CursorQueryOptions {
  readonly pageSize?: number;
  readonly sort?: string;
  readonly filter?: string | null;
}

export function createCursorInfiniteQuery<TItem>(
  queryKey: QueryKey,
  queryFn: (pagination: CursorPageParam | null) => Promise<CursorPage<TItem>>,
  options: CursorQueryOptions = {},
) {
  const normalizedOptions = {
    pageSize: options.pageSize,
    sort: options.sort,
    filter: options.filter ?? null,
  };
  return {
    queryKey: [...queryKey, normalizedOptions],
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) => queryFn({
      cursor: pageParam,
      pageSize: normalizedOptions.pageSize,
      sort: normalizedOptions.sort,
      filter: normalizedOptions.filter,
    }),
    getNextPageParam: (page: CursorPage<TItem>) => page.nextCursor,
  };
}

export function flattenCursorPages<TItem>(pages: readonly CursorPage<TItem>[]): readonly TItem[] {
  return pages.flatMap((page) => page.items);
}
