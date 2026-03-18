import { db } from "../../../db/index.js";
import { getUserFromRequest } from "../../../lib/auth.js";
import { scheduleGoal } from "../../../lib/scheduler.js";

/** @type {import('astro').APIRoute} */
export const POST = async ({ request, redirect }) => {
  const user = getUserFromRequest(request);

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Get all active goals for the user
    const goals = db.prepare("SELECT * FROM goals WHERE user_id = ?").all(
      user.id,
    );

    // Sync all goals sequentially
    // (Could be parallel, but sequentially avoids overlapping them over each other if calendar events aren't immediately reflected)
    // Actually, `scheduleGoal` checks Google Calendar per goal. To be completely safe against self-overlap among multiple goals,
    // we should really run them sequentially so Google Calendar registers the first goal's events before checking for the second.
    // However, `scheduleGoal` pushes to the DB but Google Cal fetch might have a slight delay.
    // It's mostly fine for now.

    for (const goal of goals) {
      await scheduleGoal(user, goal);
    }

    return redirect("/?success=GoalsSynced");
  } catch (error) {
    console.error("Failed to sync goals:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
