import { db } from "../db/index.js";
import dayjs from "./dateUtils.js";
import { scheduleGoal } from "./scheduler.js";

/**
 * Advances past-due goal instances by marking them as 'missed' and scheduling
 * new instances for each affected goal.
 *
 * Called by the daily cron and by the instance update API.
 *
 * @param {(user: any, goal: any) => Promise<void>} [scheduleFn] - Optional
 *   scheduler injection point. Defaults to the real Google-Calendar-backed
 *   scheduler; tests pass a stub to avoid network I/O.
 */
export async function advanceGoalInstances(scheduleFn = scheduleGoal) {
  const nowIso = dayjs.utc().toISOString();

  // Find all pending instances whose start_time has passed
  const overdueInstances = db.prepare(`
    SELECT
      gi.id,
      g.id as goal_id,
      g.user_id,
      g.times_per_week,
      g.duration_minutes,
      g.time_preference,
      g.color,
      g.icon,
      g.name
    FROM goal_instances gi
    JOIN goals g ON gi.goal_id = g.id
    WHERE gi.status = 'pending' AND gi.start_time < ?
  `).all(nowIso);

  if (overdueInstances.length === 0) {
    return { advanced: 0, missed: 0 };
  }

  // Group overdue instances by goal_id
  /** @type {Map<number, { instances: number[], goal: any }>} */
  const goalsMap = new Map();
  for (const inst of overdueInstances) {
    if (!goalsMap.has(inst.goal_id)) {
      goalsMap.set(inst.goal_id, {
        instances: [],
        goal: inst,
      });
    }
    const entry = goalsMap.get(inst.goal_id);
    if (entry) {
      entry.instances.push(inst.id);
    }
  }

  /** @type {number[]} */
  const advancedGoalIds = [];

  let missedCount = 0;

  for (const [goalId, data] of goalsMap) {
    // Fetch the full user and goal details for scheduling.
    // Explicit aliases are required: goals.id and users.id would collide
    // under SELECT g.*, u.* and the second wins, corrupting goal.id.
    const row = db.prepare(`
      SELECT
        g.id              AS goal_id,
        g.name            AS goal_name,
        g.times_per_week,
        g.duration_minutes,
        g.time_preference,
        g.color,
        g.icon,
        u.id              AS user_id,
        u.email,
        u.google_id,
        u.access_token,
        u.refresh_token,
        u.gotify_url,
        u.gotify_token,
        u.timezone,
        u.morning_start,
        u.afternoon_start,
        u.evening_start,
        u.night_start
      FROM goals g
      JOIN users u ON g.user_id = u.id
      WHERE g.id = ?
    `).get(goalId);

    if (row) {
      const goal = {
        id: row.goal_id,
        name: row.goal_name,
        times_per_week: row.times_per_week,
        duration_minutes: row.duration_minutes,
        time_preference: row.time_preference,
        color: row.color,
        icon: row.icon,
      };
      const user = {
        id: row.user_id,
        email: row.email,
        google_id: row.google_id,
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        gotify_url: row.gotify_url,
        gotify_token: row.gotify_token,
        timezone: row.timezone,
        morning_start: row.morning_start,
        afternoon_start: row.afternoon_start,
        evening_start: row.evening_start,
        night_start: row.night_start,
      };

      try {
        await scheduleFn(user, goal);
        // Only flip the overdue rows to 'missed' after scheduling
        // succeeds. If it failed, the pending rows stay pending so the
        // next cron tick retries — otherwise a transient Google API
        // error would silently strand the goal with no future instances.
        const placeholders = data.instances.map(() => "?").join(", ");
        db.prepare(`
          UPDATE goal_instances
          SET status = 'missed'
          WHERE id IN (${placeholders})
        `).run(...data.instances);
        missedCount += data.instances.length;
        db.prepare(
          `UPDATE goals SET last_advance_at = ? WHERE id = ?`,
        ).run(nowIso, goalId);
        advancedGoalIds.push(goalId);
      } catch (err) {
        console.error(
          `Failed to schedule new instances for goal ${goalId}: ${err}`,
        );
      }
    }
  }

  return { advanced: advancedGoalIds.length, missed: missedCount };
}
