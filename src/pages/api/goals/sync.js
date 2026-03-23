import { db } from "../../../db/index.js";
import { getUserFromRequest } from "../../../lib/auth.js";
import { scheduleGoal } from "../../../lib/scheduler.js";
import { deleteCalendarEvent } from "../../../lib/calendar.js";

/** @type {import('astro').APIRoute} */
export const POST = async ({ request, redirect }) => {
  const user = getUserFromRequest(request);

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const nowISO = new Date().toISOString();

    // 1. Destructive Re-sync: Delete all future pending instances for this user
    const futureInstances = db.prepare(`
      SELECT gi.id, gi.calendar_event_id 
      FROM goal_instances gi
      JOIN goals g ON gi.goal_id = g.id
      WHERE g.user_id = ? AND gi.status = 'pending' AND gi.start_time >= ? AND gi.calendar_event_id IS NOT NULL
    `).all(user.id, nowISO);

    for (const instance of futureInstances) {
      try {
        await deleteCalendarEvent(user, instance.calendar_event_id);
      } catch (err) {
        console.error(
          `Failed to delete calendar event ${instance.calendar_event_id}:`,
          err,
        );
      }
    }

    // Delete these instances from the DB
    if (futureInstances.length > 0) {
      const deleteStmt = db.prepare("DELETE FROM goal_instances WHERE id = ?");
      db.exec("BEGIN TRANSACTION;");
      try {
        for (const instance of futureInstances) {
          deleteStmt.run(instance.id);
        }
        db.exec("COMMIT;");
      } catch (err) {
        db.exec("ROLLBACK;");
        throw err;
      }
    }

    // 2. Re-schedule phase: Fetch goals ordered by duration (shortest first)
    const goals = db.prepare(
      "SELECT * FROM goals WHERE user_id = ? ORDER BY duration_minutes",
    ).all(
      user.id,
    );

    // Sync all goals sequentially
    for (const goal of goals) {
      await scheduleGoal(user, goal);
    }

    return redirect("/?success=GoalsSynced");
  } catch (error) {
    console.error("Failed to sync goals:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
