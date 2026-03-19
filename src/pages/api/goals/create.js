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
    const formData = await request.formData();
    const name = formData.get("name")?.toString() || "";
    const timesPerWeek = parseInt(
      formData.get("times_per_week")?.toString() || "1",
      10,
    );
    const durationMinutes = parseInt(
      formData.get("duration_minutes")?.toString() || "30",
      10,
    );
    const timePreferenceStr = formData.get("time_preference")?.toString() ||
      "afternoon";
    /** @type {"morning"|"afternoon"|"evening"|"night"} */
    const timePreference =
      ["morning", "afternoon", "evening", "night"].includes(timePreferenceStr)
        ? /** @type {any} */ (timePreferenceStr)
        : "afternoon";
    const color = formData.get("color")?.toString() || "9";
    const icon = formData.get("icon")?.toString() || "i-ph-star-fill";

    if (!name || !timesPerWeek || !durationMinutes || !timePreference) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Insert the new goal into the DB
    const info = db.prepare(`
      INSERT INTO goals (user_id, name, times_per_week, duration_minutes, time_preference, color, icon)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      name,
      timesPerWeek,
      durationMinutes,
      timePreference,
      color,
      icon,
    );

    // Run scheduling engine
    const newGoal = {
      id: info.lastInsertRowid,
      times_per_week: timesPerWeek,
      duration_minutes: durationMinutes,
      time_preference: timePreference,
      color,
      icon,
      name,
    };

    // We can await this so the user doesn't redirect until their calendar is populated
    await scheduleGoal(user, newGoal);

    // Redirect back to dashboard
    return redirect("/?success=GoalCreated");
  } catch (error) {
    console.error("Failed to create goal:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
