import { strict as assert } from "node:assert";
import { db } from "../db/index.js";
import { scheduleGoal } from "./scheduler.js";
import dayjs from "./dateUtils.js";

Deno.test("scheduleGoal - 3-hour night block does not over-schedule", async () => {
  // Ensure we are working with a clean state for this test user
  const mockEmail = "test_scheduler@example.com";
  db.prepare("DELETE FROM users WHERE email = ?").run(mockEmail);

  db.prepare(`
    INSERT INTO users (email, google_id, access_token, refresh_token, timezone, night_start) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    mockEmail,
    "test_google_id",
    "token",
    "refresh",
    "America/New_York",
    21,
  );

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(mockEmail);

  // Insert a goal: 4 times a week, 2 hours (120 min), night preference
  db.prepare(`
    INSERT INTO goals (user_id, name, times_per_week, duration_minutes, time_preference)
    VALUES (?, ?, ?, ?, ?)
  `).run(user.id, "Night Time Gaming", 4, 120, "night");

  const goal = db.prepare("SELECT * FROM goals WHERE user_id = ? AND name = ?")
    .get(user.id, "Night Time Gaming");

  const originalFetch = globalThis.fetch;
  // @ts-ignore: mock fetch for tests
  globalThis.fetch = (url, options) => {
    const urlStr = String(url);
    const method = options?.method || "GET";
    if (urlStr.includes("token")) {
      return Promise.resolve(
        /** @type {any} */ ({
          ok: true,
          json: () => Promise.resolve({ access_token: "mock_token" }),
        }),
      );
    }
    if (urlStr.includes("calendar/v3/calendars")) {
      if (method === "POST") {
        return Promise.resolve(
          /** @type {any} */ ({
            ok: true,
            json: () => Promise.resolve({ id: `mock_event_${Date.now()}` }),
          }),
        );
      }
      return Promise.resolve(
        /** @type {any} */ ({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        }),
      );
    }
    // Fallback
    return Promise.resolve(
      /** @type {any} */ ({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
  };

  try {
    // Call scheduleGoal to schedule the goal
    await scheduleGoal(user, goal);
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Fetch the created instances
  const instances = db.prepare(
    "SELECT * FROM goal_instances WHERE goal_id = ? ORDER BY start_time",
  ).all(goal.id);

  // Assertions
  assert.equal(
    instances.length,
    4,
    "Should have scheduled exactly 4 instances",
  );

  const scheduledDates = new Set();

  for (const instance of instances) {
    const startLocal = dayjs(instance.start_time).tz(user.timezone);
    const endLocal = dayjs(instance.end_time).tz(user.timezone);

    // Check duration
    const diffMin = endLocal.diff(startLocal, "minute");
    assert.equal(diffMin, 120, "Scheduled block should be exactly 120 minutes");

    // Check timezone conversion and night boundaries
    // The night block is 21:00 to 24:00 (midnight).
    const startHour = startLocal.hour();
    assert.equal(
      startHour >= 21 || startHour === 0,
      true,
      "Should start at or after 9 PM",
    );

    // Store the date string to ensure they are on different days
    const dateStr = startLocal.format("YYYY-MM-DD");
    scheduledDates.add(dateStr);
  }

  // Because the block is 3 hours (9 PM - 12 AM) and the goal is 2 hours,
  // we can only fit ONE goal per night. So we expect 4 distinct days.
  assert.equal(
    scheduledDates.size,
    4,
    "Each instance should be scheduled on a different day",
  );
});

Deno.test("Timezone string conversions", () => {
  const d = dayjs("2023-10-04T12:00:00Z").tz("America/New_York");

  // Test night block 24 hr limit
  const endOfDay = d.hour(24).minute(0).second(0).millisecond(0);
  assert.equal(
    endOfDay.format("YYYY-MM-DDTHH:mm:ssZ"),
    "2023-10-05T00:00:00-04:00",
  );
});
