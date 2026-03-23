import { db } from "../../../db/index.js";
import { getUserFromRequest } from "../../../lib/auth.js";
import { updateCalendarEventTitle } from "../../../lib/calendar.js";

/**
 * @param {object} context
 * @param {Request} context.request
 */
export async function POST({ request }) {
  const user = getUserFromRequest(request);

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    const data = await request.json();
    const { instance_id, status } = data;

    if (!instance_id || !status) {
      return new Response(
        JSON.stringify({ error: "Missing instance_id or status" }),
        { status: 400 },
      );
    }

    if (!["completed", "skipped", "missed"].includes(status)) {
      return new Response(JSON.stringify({ error: "Invalid status" }), {
        status: 400,
      });
    }

    // Verify ownership and get calendar_event_id
    const instance = db.prepare(`
      SELECT gi.id, gi.calendar_event_id, gi.status
      FROM goal_instances gi
      JOIN goals g ON gi.goal_id = g.id
      WHERE gi.id = ? AND g.user_id = ?
    `).get(instance_id, user.id);

    if (!instance) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
      });
    }

    // Update status in DB
    db.prepare("UPDATE goal_instances SET status = ? WHERE id = ?").run(
      status,
      instance_id,
    );

    // Update Google Calendar event
    if (instance.calendar_event_id) {
      try {
        await updateCalendarEventTitle(
          user,
          instance.calendar_event_id,
          status,
        );
      } catch (error) {
        console.error("Failed to update calendar event title:", error);
        // Continue anyway so the local state update is not lost
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Error updating instance:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}
