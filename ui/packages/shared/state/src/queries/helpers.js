export function createReadonlyQuery(queryKey, queryFn) {
    return {
        queryKey,
        queryFn,
    };
}
export function createCursorInfiniteQuery(queryKey, queryFn, options = {}) {
    const normalizedOptions = {
        ...(options.pageSize == null ? {} : { pageSize: options.pageSize }),
        ...(options.sort == null ? {} : { sort: options.sort }),
        filter: options.filter ?? null,
    };
    return {
        queryKey: [...queryKey, normalizedOptions],
        initialPageParam: null,
        queryFn: ({ pageParam }) => queryFn({
            cursor: pageParam,
            ...(normalizedOptions.pageSize == null ? {} : { pageSize: normalizedOptions.pageSize }),
            ...(normalizedOptions.sort == null ? {} : { sort: normalizedOptions.sort }),
            filter: normalizedOptions.filter,
        }),
        getNextPageParam: (page) => page.nextCursor,
    };
}
export function flattenCursorPages(pages) {
    return pages.flatMap((page) => page.items);
}
