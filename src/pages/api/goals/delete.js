import { db } from "../../../db/index.js";
import { getUserFromRequest } from "../../../lib/auth.js";
import { deleteCalendarEvent } from "../../../lib/calendar.js";

/** @type {import('astro').APIRoute} */
export const POST = async ({ request, redirect }) => {
  const user = getUserFromRequest(request);

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const formData = await request.formData();
    const goalId = formData.get("goal_id");

    if (!goalId) {
      return new Response("Missing goal ID", { status: 400 });
    }

    // Verify the goal exists and belongs to the user
    const goal = db.prepare("SELECT id FROM goals WHERE id = ? AND user_id = ?")
      .get(goalId, user.id);
    if (!goal) {
      return new Response("Goal not found or unauthorized", { status: 404 });
    }

    // Fetch all related Google Calendar events for this goal
    const instances = db.prepare(
      "SELECT calendar_event_id FROM goal_instances WHERE goal_id = ? AND calendar_event_id IS NOT NULL",
    ).all(goalId);

    // Delete each event from Google Calendar
    for (const instance of instances) {
      try {
        await deleteCalendarEvent(user, instance.calendar_event_id);
      } catch (err) {
        console.error(
          `Failed to delete calendar event ${instance.calendar_event_id}:`,
          err,
        );
        // We continue deleting the rest even if one fails
      }
    }

    // Delete the goal_instances from our DB
    db.prepare("DELETE FROM goal_instances WHERE goal_id = ?").run(goalId);

    // Delete the goal itself
    db.prepare("DELETE FROM goals WHERE id = ?").run(goalId);

    // Redirect back to dashboard
    return redirect("/?success=GoalDeleted");
  } catch (error) {
    console.error("Failed to delete goal:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
