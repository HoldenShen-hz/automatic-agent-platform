/** HTTP status code for gateway timeout. */
export const HTTP_STATUS_GATEWAY_TIMEOUT = 504;

/** WebSocket close code for a missing authentication token. */
export const WEBSOCKET_CLOSE_CODE_MISSING_TOKEN = 4_001;

/** WebSocket close code for an invalid authentication token. */
export const WEBSOCKET_CLOSE_CODE_INVALID_TOKEN = 4_003;

/** WebSocket close code when the server is above its connection budget. */
export const WEBSOCKET_CLOSE_CODE_CONNECTION_LIMIT = 1_013;

/** WebSocket close code for idle or heartbeat timeout enforcement. */
export const WEBSOCKET_CLOSE_CODE_CONNECTION_TIMEOUT = 4_000;

/** WebSocket close code for planned server shutdown. */
export const WEBSOCKET_CLOSE_CODE_SERVER_SHUTDOWN = 1_001;
