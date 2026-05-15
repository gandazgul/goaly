import { strict as assert } from "node:assert";
import process from "node:process";

// Safety guard: advanceGoalInstances() scans every user, marks their
// pending instances as 'missed', and calls scheduleGoal against the real
// Google Calendar API. Running these tests against any on-disk DB would
// corrupt real data, so we hard-require an in-memory DB. The `test` / `ci`
// tasks in deno.json set DB_PATH=:memory: — running `deno test` directly
// without that env var (or with a file path) is refused.
if (process.env.DB_PATH !== ":memory:") {
  throw new Error(
    "advance.test.js requires DB_PATH=:memory: to avoid corrupting a real DB. " +
      "Use `deno task test` or export DB_PATH=:memory: yourself.",
  );
}

const { db } = await import("../db/index.js");
const { advanceGoalInstances } = await import("./advance.js");
const dayjs = (await import("./dateUtils.js")).default;

// Stand-in for scheduleGoal so tests don't hit the real Google Calendar API
// with fake refresh tokens. The unit under test here is the
// mark-missed-and-tick-tracking logic, not the scheduler itself.
const noopScheduler = async () => {};

/**
 * @typedef {Object} TestUser
 * @property {number} id
 * @property {string} email
 * @property {string} google_id
 */

/**
 * @typedef {Object} TestInstance
 * @property {number} id
 * @property {number} goal_id
 * @property {string} start_time
 * @property {string} end_time
 * @property {string} status
 */

/**
 * @typedef {Object} TestGoal
 * @property {number} id
 * @property {number} user_id
 * @property {string} name
 * @property {number} times_per_week
 * @property {string} time_preference
 */

/**
 * Clean up all goals and instances for the given user email.
 * @param {string} email
 */
function cleanupUser(email) {
  const userId = db.prepare("SELECT id FROM users WHERE email = ?").get(email)
    ?.id;
  if (userId) {
    db.prepare(
      "DELETE FROM goal_instances WHERE goal_id IN (SELECT id FROM goals WHERE user_id = ?)",
    ).run(userId);
    db.prepare("DELETE FROM goals WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE email = ?").run(email);
  }
}

/**
 * Helper to set up a mock user with a unique email.
 * @returns {{ user: TestUser, mockEmail: string }}
 */
function setupUser() {
  const mockEmail = `test_advance_${Date.now()}_${
    Math.random().toString(36).slice(2)
  }@example.com`;
  const mockGoogleId = `test_advance_${Date.now()}_${
    Math.random().toString(36).slice(2)
  }`;

  cleanupUser(mockEmail);

  db.prepare(`
    INSERT INTO users (email, google_id, access_token, refresh_token, timezone, afternoon_start)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    mockEmail,
    mockGoogleId,
    "token",
    "refresh",
    "America/New_York",
    12,
  );

  const user = /** @type {TestUser} */ (db.prepare(
    "SELECT id, email, google_id FROM users WHERE email = ?",
  ).get(mockEmail));
  return { user, mockEmail };
}

/**
 * Create a goal for a user.
 * @param {TestUser} user
 * @param {string} name
 * @param {number} timesPerWeek
 * @param {string} [timePreference]
 * @returns {TestGoal}
 */
function createGoal(user, name, timesPerWeek, timePreference) {
  const info = db.prepare(`
    INSERT INTO goals (user_id, name, times_per_week, duration_minutes, time_preference)
    VALUES (?, ?, ?, 30, ?)
  `).run(user.id, name, timesPerWeek, timePreference || "afternoon");
  return /** @type {TestGoal} */ (db.prepare("SELECT * FROM goals WHERE id = ?")
    .get(info.lastInsertRowid));
}

/**
 * Create a goal instance.
 * @param {TestGoal} goal
 * @param {string} startIso
 * @param {string} endIso
 * @param {string} [status]
 */
function createInstance(goal, startIso, endIso, status) {
  db.prepare(`
    INSERT INTO goal_instances (goal_id, start_time, end_time, status)
    VALUES (?, ?, ?, ?)
  `).run(goal.id, startIso, endIso, status || "pending");
}

Deno.test("advanceGoalInstances - marks past-due instances as missed", async () => {
  const { user } = setupUser();
  const goal = createGoal(user, "Reading Time", 3, "afternoon");

  // Create 2 past-due pending instances
  const pastTime = dayjs.utc().subtract(1, "day").toISOString();
  const pastEndTime = dayjs.utc().subtract(1, "day").add(30, "minute")
    .toISOString();
  createInstance(goal, pastTime, pastEndTime);
  createInstance(goal, pastTime, pastEndTime);

  let instances = db.prepare("SELECT * FROM goal_instances WHERE goal_id = ?")
    .all(goal.id);
  assert.equal(
    instances.length,
    2,
    "Should have 2 pending instances before advancement",
  );

  const result = await advanceGoalInstances(noopScheduler);

  instances = db.prepare("SELECT * FROM goal_instances WHERE goal_id = ?").all(
    goal.id,
  );
  const missed = instances.filter((/** @type {TestInstance} */ i) =>
    i.status === "missed"
  );
  assert.equal(
    missed.length,
    2,
    "Both past-due instances should be marked as missed",
  );
  assert.equal(result.missed, 2, "Should report 2 missed instances");
});

Deno.test("advanceGoalInstances - skips future pending instances", async () => {
  const { user } = setupUser();
  const goal = createGoal(user, "Future Goal", 3, "afternoon");

  const pastTime = dayjs.utc().subtract(1, "day").toISOString();
  const pastEndTime = dayjs.utc().subtract(1, "day").add(30, "minute")
    .toISOString();
  createInstance(goal, pastTime, pastEndTime);

  const futureTime = dayjs.utc().add(1, "day").toISOString();
  const futureEndTime = dayjs.utc().add(1, "day").add(30, "minute")
    .toISOString();
  createInstance(goal, futureTime, futureEndTime);

  const result = await advanceGoalInstances(noopScheduler);

  const instances = db.prepare("SELECT * FROM goal_instances WHERE goal_id = ?")
    .all(goal.id);
  const pastInstance = instances.find((/** @type {TestInstance} */ i) =>
    i.start_time === pastTime
  );
  const futureInstance = instances.find((/** @type {TestInstance} */ i) =>
    i.start_time === futureTime
  );

  assert.equal(
    pastInstance.status,
    "missed",
    "Past-due instance should be marked as missed",
  );
  assert.equal(
    futureInstance.status,
    "pending",
    "Future instance should remain pending",
  );
  assert.equal(result.missed, 1, "Should report 1 missed instance");
});

Deno.test("advanceGoalInstances - handles goals with no pending instances", async () => {
  const { user } = setupUser();
  createGoal(user, "No Pending Goal", 3, "afternoon");

  const result = await advanceGoalInstances(noopScheduler);
  assert.equal(result.advanced, 0, "Should not have advanced any goals");
  assert.equal(result.missed, 0, "Should not have missed any instances");
});

Deno.test("advanceGoalInstances - marks all past-due instances as missed", async () => {
  const { user } = setupUser();
  const goal = createGoal(user, "Many Past Goal", 5, "afternoon");

  const pastTime = dayjs.utc().subtract(2, "day").toISOString();
  const pastEndTime = dayjs.utc().subtract(2, "day").add(30, "minute")
    .toISOString();
  for (let i = 0; i < 4; i++) {
    createInstance(goal, pastTime, pastEndTime);
  }

  const result = await advanceGoalInstances(noopScheduler);

  const instances = db.prepare("SELECT * FROM goal_instances WHERE goal_id = ?")
    .all(goal.id);
  const missedCount =
    instances.filter((/** @type {TestInstance} */ i) => i.status === "missed")
      .length;
  assert.equal(missedCount, 4, "All 4 past-due instances should be missed");
  assert.equal(result.missed, 4, "Should report 4 missed instances");
});

Deno.test("advanceGoalInstances - multiple goals for same user", async () => {
  const { user } = setupUser();
  const goal1 = createGoal(user, "Goal 1", 2, "morning");
  const goal2 = createGoal(user, "Goal 2", 2, "afternoon");

  const pastTime = dayjs.utc().subtract(1, "day").toISOString();
  const pastEndTime = dayjs.utc().subtract(1, "day").add(30, "minute")
    .toISOString();
  createInstance(goal1, pastTime, pastEndTime);
  createInstance(goal2, pastTime, pastEndTime);

  const result = await advanceGoalInstances(noopScheduler);

  const instances1 = db.prepare(
    "SELECT * FROM goal_instances WHERE goal_id = ?",
  ).all(goal1.id);
  const instances2 = db.prepare(
    "SELECT * FROM goal_instances WHERE goal_id = ?",
  ).all(goal2.id);

  assert.ok(
    instances1.some((/** @type {TestInstance} */ i) => i.status === "missed"),
    "Goal 1 should have a missed instance",
  );
  assert.ok(
    instances2.some((/** @type {TestInstance} */ i) => i.status === "missed"),
    "Goal 2 should have a missed instance",
  );
  assert.equal(result.missed, 2, "Should report 2 missed instances");
});

Deno.test("advanceGoalInstances - does not mark non-pending instances as missed", async () => {
  const { user } = setupUser();
  const goal = createGoal(user, "Non-Pending Goal", 3, "afternoon");

  const pastTime = dayjs.utc().subtract(1, "day").toISOString();
  const pastEndTime = dayjs.utc().subtract(1, "day").add(30, "minute")
    .toISOString();

  createInstance(goal, pastTime, pastEndTime, "pending");
  createInstance(goal, pastTime, pastEndTime, "completed");
  createInstance(goal, pastTime, pastEndTime, "skipped");

  await advanceGoalInstances(noopScheduler);

  const instances = db.prepare("SELECT * FROM goal_instances WHERE goal_id = ?")
    .all(goal.id);
  const statuses = instances.map((/** @type {TestInstance} */ i) => i.status);

  assert.ok(statuses.includes("missed"), "Should have one missed instance");
  assert.ok(
    statuses.includes("completed"),
    "Completed instance should remain completed",
  );
  assert.ok(
    statuses.includes("skipped"),
    "Skipped instance should remain skipped",
  );
});

Deno.test("advanceGoalInstances - updates last_advance_at tracking column", async () => {
  const { user } = setupUser();
  const goal = createGoal(user, "Tracking Goal", 3, "afternoon");

  const pastTime = dayjs.utc().subtract(1, "day").toISOString();
  const pastEndTime = dayjs.utc().subtract(1, "day").add(30, "minute")
    .toISOString();
  createInstance(goal, pastTime, pastEndTime);

  await advanceGoalInstances(noopScheduler);

  const updatedGoal = db.prepare(
    "SELECT last_advance_at FROM goals WHERE id = ?",
  ).get(goal.id);
  assert.ok(updatedGoal.last_advance_at, "last_advance_at should be set");
  // Verify it's a valid ISO timestamp
  assert.ok(
    dayjs(updatedGoal.last_advance_at).isValid(),
    "last_advance_at should be a valid timestamp",
  );
});
