import { db } from "../../../db";
import { getUserFromRequest } from "../../../lib/auth.js";

/** @type {import('astro').APIRoute} */
export const POST = async ({ request, redirect }) => {
  const user = getUserFromRequest(request);

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const formData = await request.formData();
    const gotifyUrl = formData.get("gotify_url")?.toString() || null;
    const gotifyToken = formData.get("gotify_token")?.toString() || null;
    const timezone = formData.get("timezone")?.toString() || "UTC";
    const morningStart = parseInt(
      formData.get("morning_start")?.toString() || "6",
      10,
    );
    const afternoonStart = parseInt(
      formData.get("afternoon_start")?.toString() || "12",
      10,
    );
    const eveningStart = parseInt(
      formData.get("evening_start")?.toString() || "17",
      10,
    );
    const nightStart = parseInt(
      formData.get("night_start")?.toString() || "21",
      10,
    );

    const isValidHour = (/** @type {number} */ h) =>
      h >= 0 && h <= 23 && !isNaN(h);
    if (
      !isValidHour(morningStart) || !isValidHour(afternoonStart) ||
      !isValidHour(eveningStart) || !isValidHour(nightStart)
    ) {
      return new Response("Invalid time block start hour", { status: 400 });
    }

    db.prepare(`
      UPDATE users 
      SET 
        gotify_url = ?, 
        gotify_token = ?,
        timezone = ?,
        morning_start = ?,
        afternoon_start = ?,
        evening_start = ?,
        night_start = ?
      WHERE id = ?
    `).run(
      gotifyUrl,
      gotifyToken,
      timezone,
      morningStart,
      afternoonStart,
      eveningStart,
      nightStart,
      user.id,
    );

    return redirect("/profile?success=SettingsSaved");
  } catch (error) {
    console.error("Failed to update settings:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
