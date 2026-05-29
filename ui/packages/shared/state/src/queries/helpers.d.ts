import type { QueryFunction, QueryKey } from "@tanstack/react-query";
export declare function createReadonlyQuery<TQueryKey extends QueryKey, TResult>(queryKey: TQueryKey, queryFn: QueryFunction<TResult, TQueryKey>): {
    queryKey: TQueryKey;
    queryFn: QueryFunction<TResult, TQueryKey>;
};
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
export declare function createCursorInfiniteQuery<TItem>(queryKey: QueryKey, queryFn: (pagination: CursorPageParam | null) => Promise<CursorPage<TItem>>, options?: CursorQueryOptions): {
    queryKey: unknown[];
    initialPageParam: null;
    queryFn: ({ pageParam }: {
        pageParam: string | null;
    }) => Promise<CursorPage<TItem>>;
    getNextPageParam: (page: CursorPage<TItem>) => string | null;
};
export declare function flattenCursorPages<TItem>(pages: readonly CursorPage<TItem>[]): readonly TItem[];
