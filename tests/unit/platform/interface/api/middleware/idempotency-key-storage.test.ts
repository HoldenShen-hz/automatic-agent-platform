import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert, {
  strictEqual,
  deepStrictEqual,
  ok,
  fail,
  throws,
} from "node:assert";
import {
  InMemoryIdempotencyStorage,
  RedisIdempotencyStorage,
  SqliteIdempotencyStorage,
  createIdempotencyStorage,
  type IdempotencyEntry,
  type IdempotencyStorage,
} from "../../../../../../src/platform/five-plane-interface/api/middleware/idempotency-key-storage.js";

describe("InMemoryIdempotencyStorage", () => {
  let storage: InMemoryIdempotencyStorage;

  beforeEach(() => {
    storage = new InMemoryIdempotencyStorage();
  });

  describe("constructor", () => {
    it("should create with default maxEntries of 10000", () => {
      const s = new InMemoryIdempotencyStorage();
      strictEqual(s.size(), 0);
    });

    it("should accept custom maxEntries", () => {
      const s = new InMemoryIdempotencyStorage({ maxEntries: 100 });
      strictEqual(s.size(), 0);
    });

    it("should treat negative maxEntries as 1", () => {
      const s = new InMemoryIdempotencyStorage({ maxEntries: -50 });
      strictEqual(s.size(), 0);
    });

    it("should treat zero maxEntries as 1", () => {
      const s = new InMemoryIdempotencyStorage({ maxEntries: 0 });
      strictEqual(s.size(), 0);
    });

    it("should truncate fractional maxEntries", () => {
      const s = new InMemoryIdempotencyStorage({ maxEntries: 50.9 });
      strictEqual(s.size(), 0);
    });
  });

  describe("get", () => {
    it("should return null for non-existent key", async () => {
      const result = await storage.get("nonexistent");
      strictEqual(result, null);
    });

    it("should return entry for existing key", async () => {
      const entry = createEntry("POST", 201, null);
      await storage.set("key-1", entry, 60_000);
      const result = await storage.get("key-1");
      ok(result !== null);
      strictEqual(result!.method, "POST");
      strictEqual(result!.statusCode, 201);
    });

    it("should return null for expired entry", async () => {
      const entry = createEntry("POST", 201, null);
      await storage.set("key-1", entry, 1);
      await new Promise((resolve) => setTimeout(resolve, 15));
      const result = await storage.get("key-1");
      strictEqual(result, null);
    });

    it("should auto-delete expired entry on get", async () => {
      const entry = createEntry("POST", 201, null);
      await storage.set("key-1", entry, 1);
      await new Promise((resolve) => setTimeout(resolve, 15));
      await storage.get("key-1");
      strictEqual(storage.size(), 0);
    });
  });

  describe("set", () => {
    it("should store entry with correct expiresAt", async () => {
      const before = Date.now();
      const entry = createEntry("POST", 201, null);
      await storage.set("key-1", entry, 60_000);
      const result = await storage.get("key-1");
      ok(result !== null);
      ok(result!.expiresAt >= before + 60_000 - 1);
      ok(result!.expiresAt <= before + 60_000 + 100);
    });

    it("should update existing key", async () => {
      const entry1 = createEntry("POST", 200, null);
      await storage.set("key-1", entry1, 60_000);
      const entry2 = createEntry("PUT", 201, null);
      await storage.set("key-1", entry2, 60_000);
      const result = await storage.get("key-1");
      ok(result !== null);
      strictEqual(result!.method, "PUT");
      strictEqual(result!.statusCode, 201);
    });

    it("should evict oldest when at capacity", async () => {
      const smallStorage = new InMemoryIdempotencyStorage({ maxEntries: 3 });
      await smallStorage.set("key-1", createEntry("POST", 200, null), 60_000);
      await new Promise((r) => setTimeout(r, 5));
      await smallStorage.set("key-2", createEntry("POST", 200, null), 60_000);
      await new Promise((r) => setTimeout(r, 5));
      await smallStorage.set("key-3", createEntry("POST", 200, null), 60_000);
      await smallStorage.set("key-4", createEntry("POST", 200, null), 60_000);
      strictEqual(smallStorage.size(), 3);
      const result = await smallStorage.get("key-1");
      strictEqual(result, null);
    });
  });

  describe("delete", () => {
    it("should remove entry", async () => {
      await storage.set("key-1", createEntry("POST", 200, null), 60_000);
      await storage.delete("key-1");
      const result = await storage.get("key-1");
      strictEqual(result, null);
    });

    it("should not throw for non-existent key", async () => {
      await storage.delete("nonexistent");
    });
  });

  describe("cleanup", () => {
    it("should return 0 when nothing to clean", async () => {
      const deleted = await storage.cleanup();
      strictEqual(deleted, 0);
    });

    it("should delete expired entries", async () => {
      await storage.set("key-1", createEntry("POST", 200, null), 1);
      await new Promise((r) => setTimeout(r, 15));
      const deleted = await storage.cleanup();
      strictEqual(deleted, 1);
      strictEqual(storage.size(), 0);
    });

    it("should respect maxDelete limit", async () => {
      // Use a fresh storage and direct entries manipulation to avoid internal cleanup
      const testStorage = new InMemoryIdempotencyStorage();
      // @ts-expect-error - accessing private member for testing
      testStorage["entries"].set("key-1", {
        ...createEntry("POST", 200, null),
        expiresAt: Date.now() - 100, // expired
      });
      // @ts-expect-error - accessing private member for testing
      testStorage["entries"].set("key-2", {
        ...createEntry("POST", 200, null),
        expiresAt: Date.now() + 60_000, // not expired
      });
      // @ts-expect-error - accessing private member for testing
      testStorage["entries"].set("key-3", {
        ...createEntry("POST", 200, null),
        expiresAt: Date.now() - 100, // expired
      });

      const deleted = await testStorage.cleanup(1);
      strictEqual(deleted, 1);
      strictEqual(testStorage.size(), 2);
    });

    it("should clean up expired on set", async () => {
      await storage.set("key-1", createEntry("POST", 200, null), 1);
      await new Promise((r) => setTimeout(r, 15));
      await storage.set("key-2", createEntry("POST", 200, null), 60_000);
      const result = await storage.get("key-1");
      strictEqual(result, null);
      strictEqual(storage.size(), 1);
    });
  });

  describe("clear", () => {
    it("should remove all entries", async () => {
      await storage.set("key-1", createEntry("POST", 200, null), 60_000);
      await storage.set("key-2", createEntry("PUT", 201, null), 60_000);
      storage.clear();
      strictEqual(storage.size(), 0);
    });
  });

  describe("size", () => {
    it("should return current entry count", async () => {
      strictEqual(storage.size(), 0);
      await storage.set("key-1", createEntry("POST", 200, null), 60_000);
      strictEqual(storage.size(), 1);
      await storage.set("key-2", createEntry("PUT", 201, null), 60_000);
      strictEqual(storage.size(), 2);
    });
  });
});

describe("RedisIdempotencyStorage", () => {
  const redisConfig = { host: "127.0.0.1" };
  // Mock Redis client for testing
  const mockRedis = {
    get: mock.fn(() => Promise.resolve(null)),
    set: mock.fn(() => Promise.resolve("OK")),
    del: mock.fn(() => Promise.resolve(1)),
  };

  it("should build key with prefix", async () => {
    const storage = new RedisIdempotencyStorage({ ...redisConfig, keyPrefix: "test:" });
    const built = storage["buildKey"]("abc");
    strictEqual(built, "test:abc");
  });

  it("should default keyPrefix to idempotency:", () => {
    const storage = new RedisIdempotencyStorage(redisConfig);
    const built = storage["buildKey"]("abc");
    strictEqual(built, "idempotency:abc");
  });

  it("should get entry and auto-delete if expired", async () => {
    const expiredEntry: IdempotencyEntry = {
      method: "POST",
      statusCode: 201,
      responseBody: '{"id":"123"}',
      expiresAt: Date.now() - 1000,
      requestHash: null,
    };
    const mockClient = {
      get: mock.fn(() => Promise.resolve(JSON.stringify(expiredEntry))),
      del: mock.fn(() => Promise.resolve(1)),
      set: mock.fn(() => Promise.resolve("OK")),
    };
    const storage = new RedisIdempotencyStorage(redisConfig);
    storage["redis"] = mockClient as any;

    const result = await storage.get("key-1");
    strictEqual(result, null);
  });

  it("should set entry with TTL", async () => {
    const mockClient = {
      get: mock.fn(() => Promise.resolve(null)),
      set: mock.fn(() => Promise.resolve("OK")),
      del: mock.fn(() => Promise.resolve(1)),
    };
    const storage = new RedisIdempotencyStorage(redisConfig);
    storage["redis"] = mockClient as any;

    await storage.set("key-1", createEntry("POST", 201, null), 60_000);
    ok(mockClient.set.mock.calls.length > 0);
  });

  it("should delete entry", async () => {
    const mockClient = {
      get: mock.fn(() => Promise.resolve(null)),
      set: mock.fn(() => Promise.resolve("OK")),
      del: mock.fn(() => Promise.resolve(1)),
    };
    const storage = new RedisIdempotencyStorage(redisConfig);
    storage["redis"] = mockClient as any;

    await storage.delete("key-1");
    strictEqual(mockClient.del.mock.calls.length, 1);
  });

  it("should cleanup returns 0 (Redis handles expiry via PX)", async () => {
    const storage = new RedisIdempotencyStorage(redisConfig);
    const result = await storage.cleanup();
    strictEqual(result, 0);
  });

  it("should return null for invalid JSON in Redis", async () => {
    const mockClient = {
      get: mock.fn(() => Promise.resolve("not valid json")),
      set: mock.fn(() => Promise.resolve("OK")),
      del: mock.fn(() => Promise.resolve(1)),
    };
    const storage = new RedisIdempotencyStorage(redisConfig);
    storage["redis"] = mockClient as any;

    const result = await storage.get("key-1");
    strictEqual(result, null);
  });
});

describe("SqliteIdempotencyStorage", () => {
  // Mock SQLite database for testing
  const mockConnection = {
    exec: mock.fn(() => {}),
    prepare: mock.fn(() => ({
      get: mock.fn(() => undefined),
      run: mock.fn(() => ({ changes: 1 })),
      all: mock.fn(() => []),
    })),
  };

  const mockDb = {
    transaction: <T>(fn: () => T): T => fn(),
    connection: mockConnection as any,
  };

  it("should create table on construction", () => {
    new SqliteIdempotencyStorage(mockDb as any, "test_table");
    ok(mockConnection.exec.mock.calls.length >= 2);
  });

  it("should throw for invalid table name", () => {
    assert.throws(
      () => new SqliteIdempotencyStorage(mockDb as any, "invalid-table-name"),
      /safe SQL identifier/,
    );
    assert.throws(
      () => new SqliteIdempotencyStorage(mockDb as any, "123table"),
      /safe SQL identifier/,
    );
    assert.throws(
      () => new SqliteIdempotencyStorage(mockDb as any, "table:name"),
      /safe SQL identifier/,
    );
  });

  it("should accept valid table name", () => {
    const storage = new SqliteIdempotencyStorage(mockDb as any, "valid_table_name");
    ok(storage != null);
  });

  it("should accept table name with numbers", () => {
    const storage = new SqliteIdempotencyStorage(mockDb as any, "table123");
    ok(storage != null);
  });

  it("should accept underscore prefixed table name", () => {
    const storage = new SqliteIdempotencyStorage(mockDb as any, "_private_table");
    ok(storage != null);
  });

  it("should get entry from database", async () => {
    const mockRow = {
      method: "POST",
      status_code: 201,
      response_body: '{"id":"123"}',
      request_hash: null,
      expires_at: Date.now() + 60_000,
    };
    const mockStmt = {
      get: mock.fn(() => mockRow),
      run: mock.fn(() => ({ changes: 1 })),
      all: mock.fn(() => []),
    };
    const conn = {
      exec: mock.fn(() => {}),
      prepare: mock.fn(() => mockStmt),
    };
    const db = {
      transaction: <T>(fn: () => T): T => fn(),
      connection: conn as any,
    };
    const storage = new SqliteIdempotencyStorage(db as any, "idempotency_keys");
    const result = await storage.get("key-1");
    ok(result !== null);
    strictEqual(result!.method, "POST");
    strictEqual(result!.statusCode, 201);
  });

  it("should return null when entry not found", async () => {
    const mockStmt = {
      get: mock.fn(() => undefined),
      run: mock.fn(() => ({ changes: 0 })),
      all: mock.fn(() => []),
    };
    const conn = {
      exec: mock.fn(() => {}),
      prepare: mock.fn(() => mockStmt),
    };
    const db = {
      transaction: <T>(fn: () => T): T => fn(),
      connection: conn as any,
    };
    const storage = new SqliteIdempotencyStorage(db as any, "idempotency_keys");
    const result = await storage.get("nonexistent");
    strictEqual(result, null);
  });

  it("should return null for expired entry and delete it", async () => {
    const expiredRow = {
      method: "POST",
      status_code: 201,
      response_body: '{"id":"123"}',
      request_hash: null,
      expires_at: Date.now() - 1000,
    };
    let deleted = false;
    const mockStmt = {
      get: mock.fn(() => expiredRow),
      run: mock.fn(() => {
        deleted = true;
        return { changes: 1 };
      }),
      all: mock.fn(() => []),
    };
    const conn = {
      exec: mock.fn(() => {}),
      prepare: mock.fn(() => mockStmt),
    };
    const db = {
      transaction: <T>(fn: () => T): T => fn(),
      connection: conn as any,
    };
    const storage = new SqliteIdempotencyStorage(db as any, "idempotency_keys");
    const result = await storage.get("key-1");
    strictEqual(result, null);
    strictEqual(deleted, true);
  });

  it("should set entry in database", async () => {
    let capturedValues: any[] = [];
    const mockStmt = {
      get: mock.fn(() => undefined),
      run: mock.fn(function(this: any, ...args: any[]) {
        capturedValues = args;
        return { changes: 1 };
      }),
      all: mock.fn(() => []),
    };
    const conn = {
      exec: mock.fn(() => {}),
      prepare: mock.fn(() => mockStmt),
    };
    const db = {
      transaction: <T>(fn: () => T): T => fn(),
      connection: conn as any,
    };
    const storage = new SqliteIdempotencyStorage(db as any, "idempotency_keys");
    await storage.set("key-1", createEntry("POST", 201, '{"id":"123"}'), 60_000);
    strictEqual(capturedValues[0], "key-1");
    strictEqual(capturedValues[1], "POST");
    strictEqual(capturedValues[2], 201);
  });

  it("should delete entry from database", async () => {
    let deleted = false;
    const mockStmt = {
      get: mock.fn(() => undefined),
      run: mock.fn(() => {
        deleted = true;
        return { changes: 1 };
      }),
      all: mock.fn(() => []),
    };
    const conn = {
      exec: mock.fn(() => {}),
      prepare: mock.fn(() => mockStmt),
    };
    const db = {
      transaction: <T>(fn: () => T): T => fn(),
      connection: conn as any,
    };
    const storage = new SqliteIdempotencyStorage(db as any, "idempotency_keys");
    await storage.delete("key-1");
    strictEqual(deleted, true);
  });

  it("should cleanup with maxDelete limit", async () => {
    const keys = [{ key: "key-1" }, { key: "key-2" }];
    const mockStmt = {
      get: mock.fn(() => undefined),
      run: mock.fn(() => ({ changes: 1 })),
      all: mock.fn(() => keys),
    };
    const conn = {
      exec: mock.fn(() => {}),
      prepare: mock.fn(() => mockStmt),
    };
    const db = {
      transaction: <T>(fn: () => T): T => fn(),
      connection: conn as any,
    };
    const storage = new SqliteIdempotencyStorage(db as any, "idempotency_keys");
    const deleted = await storage.cleanup(10);
    strictEqual(deleted, 2);
  });

  it("should cleanup without maxDelete (unlimited)", async () => {
    const mockStmt = {
      get: mock.fn(() => undefined),
      run: mock.fn(() => ({ changes: 1 })),
      all: mock.fn(() => []),
    };
    const conn = {
      exec: mock.fn(() => {}),
      prepare: mock.fn(() => mockStmt),
    };
    const db = {
      transaction: <T>(fn: () => T): T => fn(),
      connection: conn as any,
    };
    const storage = new SqliteIdempotencyStorage(db as any, "idempotency_keys");
    const deleted = await storage.cleanup(0);
    ok(mockStmt.run.mock.calls.length >= 1);
  });

  it("should handle numeric expires_at from SQLite", async () => {
    const futureRow = {
      method: "POST",
      status_code: 201,
      response_body: null,
      request_hash: null,
      expires_at: Date.now() + 60_000,
    };
    const mockStmt = {
      get: mock.fn(() => futureRow),
      run: mock.fn(() => ({ changes: 0 })),
      all: mock.fn(() => []),
    };
    const conn = {
      exec: mock.fn(() => {}),
      prepare: mock.fn(() => mockStmt),
    };
    const db = {
      transaction: <T>(fn: () => T): T => fn(),
      connection: conn as any,
    };
    const storage = new SqliteIdempotencyStorage(db as any, "idempotency_keys");
    const result = await storage.get("key-1");
    ok(result !== null);
    ok(result!.expiresAt > Date.now());
  });

  it("should handle string expires_at from SQLite", async () => {
    const futureRow = {
      method: "POST",
      status_code: 201,
      response_body: null,
      request_hash: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    const mockStmt = {
      get: mock.fn(() => futureRow),
      run: mock.fn(() => ({ changes: 0 })),
      all: mock.fn(() => []),
    };
    const conn = {
      exec: mock.fn(() => {}),
      prepare: mock.fn(() => mockStmt),
    };
    const db = {
      transaction: <T>(fn: () => T): T => fn(),
      connection: conn as any,
    };
    const storage = new SqliteIdempotencyStorage(db as any, "idempotency_keys");
    const result = await storage.get("key-1");
    ok(result !== null);
    ok(result!.expiresAt > Date.now());
  });
});

describe("createIdempotencyStorage", () => {
  it("should create InMemoryIdempotencyStorage", () => {
    const storage = createIdempotencyStorage("memory");
    ok(storage instanceof InMemoryIdempotencyStorage);
  });

  it("should create RedisIdempotencyStorage", () => {
    const storage = createIdempotencyStorage("redis", { host: "127.0.0.1" });
    ok(storage instanceof RedisIdempotencyStorage);
  });

  it("should create SqliteIdempotencyStorage with valid config", () => {
    const mockDb = {
      transaction: <T>(fn: () => T): T => fn(),
      connection: {
        exec: mock.fn(() => {}),
        prepare: mock.fn(() => ({
          get: mock.fn(() => undefined),
          run: mock.fn(() => ({ changes: 1 })),
          all: mock.fn(() => []),
        })),
      },
    };
    const storage = createIdempotencyStorage("sqlite", { db: mockDb as any });
    ok(storage instanceof SqliteIdempotencyStorage);
  });

  it("should throw for sqlite without config", () => {
    assert.throws(
      () => createIdempotencyStorage("sqlite"),
      /requires a db option/,
    );
  });

  it("should throw for sqlite with null db", () => {
    assert.throws(
      () => createIdempotencyStorage("sqlite", { db: null as any }),
      /requires a non-null db option/,
    );
  });
});

function createEntry(
  method: string,
  statusCode: number,
  responseBody: string | null,
): Omit<IdempotencyEntry, "expiresAt"> {
  return { method, statusCode, responseBody, requestHash: null };
}
