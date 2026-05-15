import { db } from "../db/index.js";
import dayjs from "./dateUtils.js";
import { scheduleGoal } from "./scheduler.js";

/**
 * Advances past-due goal instances by marking them as 'missed' and scheduling
 * new instances for each affected goal.
 *
 * Called by the daily cron and by the instance update API.
 */
export async function advanceGoalInstances() {
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

  for (const [goalId, data] of goalsMap) {
    // Mark all overdue pending instances as 'missed'
    const placeholders = data.instances.map(() => "?").join(", ");
    db.prepare(`
      UPDATE goal_instances
      SET status = 'missed'
      WHERE id IN (${placeholders})
    `).run(...data.instances);

    // Update last_advance_at tracking column right after marking as missed
    db.prepare(`
      UPDATE goals SET last_advance_at = ? WHERE id = ?
    `).run(nowIso, goalId);

    // Fetch the full user and goal details for scheduling
    const goalRow = db.prepare(`
      SELECT g.*, u.*
      FROM goals g
      JOIN users u ON g.user_id = u.id
      WHERE g.id = ?
    `).get(goalId);

    if (goalRow) {
      const goal = {
        id: goalRow.id,
        name: goalRow.name,
        times_per_week: goalRow.times_per_week,
        duration_minutes: goalRow.duration_minutes,
        time_preference: goalRow.time_preference,
        color: goalRow.color,
        icon: goalRow.icon,
      };
      const user = {
        id: goalRow.user_id,
        email: goalRow.email,
        google_id: goalRow.google_id,
        access_token: goalRow.access_token,
        refresh_token: goalRow.refresh_token,
        gotify_url: goalRow.gotify_url,
        gotify_token: goalRow.gotify_token,
        timezone: goalRow.timezone,
        morning_start: goalRow.morning_start,
        afternoon_start: goalRow.afternoon_start,
        evening_start: goalRow.evening_start,
        night_start: goalRow.night_start,
      };

      try {
        await scheduleGoal(user, goal);
        advancedGoalIds.push(goalId);
      } catch (err) {
        console.error(
          `Failed to schedule new instances for goal ${goalId}: ${err}`,
        );
      }
    }
  }

  return { advanced: advancedGoalIds.length, missed: overdueInstances.length };
}
