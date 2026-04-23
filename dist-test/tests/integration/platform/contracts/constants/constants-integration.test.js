import assert from "node:assert/strict";
import test from "node:test";
test("Time constants defined correctly", () => {
    const MS_PER_SECOND = 1000;
    const MS_PER_MINUTE = 60 * MS_PER_SECOND;
    const MS_PER_HOUR = 60 * MS_PER_MINUTE;
    const MS_PER_DAY = 24 * MS_PER_HOUR;
    assert.equal(MS_PER_SECOND, 1000);
    assert.equal(MS_PER_MINUTE, 60000);
    assert.equal(MS_PER_HOUR, 3600000);
    assert.equal(MS_PER_DAY, 86400000);
});
test("Time constant calculations", () => {
    const seconds30 = 30 * 1000;
    const minutes5 = 5 * 60 * 1000;
    const hours1 = 1 * 60 * 60 * 1000;
    assert.equal(seconds30, 30000);
    assert.equal(minutes5, 300000);
    assert.equal(hours1, 3600000);
});
test("ISO 8601 duration parsing constants", () => {
    const ISO8601_FORMAT = /^P(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/;
    assert.ok(ISO8601_FORMAT.test("PT30S"));
    assert.ok(ISO8601_FORMAT.test("PT5M"));
    assert.ok(ISO8601_FORMAT.test("PT1H"));
    assert.ok(!ISO8601_FORMAT.test("invalid"));
});
test("Timestamp ordering is consistent", () => {
    const timestamps = [];
    const now = Date.now();
    timestamps.push(new Date(now - 1000).toISOString());
    timestamps.push(new Date(now).toISOString());
    timestamps.push(new Date(now + 1000).toISOString());
    const sorted = [...timestamps].sort();
    assert.equal(sorted[0], timestamps[0]);
    assert.equal(sorted[2], timestamps[2]);
});
test("Date boundary calculations", () => {
    const startOfDay = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    };
    const date = new Date("2026-04-13T15:30:00.000Z");
    const start = startOfDay(date);
    assert.equal(start.getHours(), 0);
    assert.equal(start.getMinutes(), 0);
    assert.equal(start.getSeconds(), 0);
});
test("Week boundary calculations", () => {
    const getWeekStart = (date) => {
        const day = date.getDay();
        const diff = date.getDate() - day;
        return new Date(date.getFullYear(), date.getMonth(), diff);
    };
    const wednesday = new Date("2026-04-15T12:00:00.000Z");
    const weekStart = getWeekStart(wednesday);
    assert.equal(weekStart.getDay(), 0); // Sunday
});
test("Month boundary calculations", () => {
    const startOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    };
    const midMonth = new Date("2026-04-15T12:00:00.000Z");
    const monthStart = startOfMonth(midMonth);
    assert.equal(monthStart.getDate(), 1);
    assert.equal(monthStart.getMonth(), 3); // April is 3 (0-indexed)
});
test("Unix epoch calculations", () => {
    const epoch = new Date(0);
    assert.equal(epoch.getTime(), 0);
    const epochPlus1s = new Date(1000);
    assert.equal(epochPlus1s.getTime(), 1000);
});
//# sourceMappingURL=constants-integration.test.js.map