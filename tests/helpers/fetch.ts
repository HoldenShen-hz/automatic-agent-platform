export function createJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export function createJsonFetch(
  body: unknown,
  init: ResponseInit = {},
): typeof fetch {
  return async (_input: string | URL | Request, _requestInit?: RequestInit) => createJsonResponse(body, init);
}
