import { db } from "../../../db/index.js";
import { getUserFromRequest } from "../../../lib/auth.js";

/** @type {import('astro').APIRoute} */
export const POST = async ({ request }) => {
  const user = getUserFromRequest(request);

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const data = await request.json();
    const newTimezone = data.timezone;

    if (!newTimezone) {
      return new Response(JSON.stringify({ error: "Timezone required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (user.timezone !== newTimezone) {
      db.prepare(`
        UPDATE users 
        SET timezone = ?
        WHERE id = ?
      `).run(newTimezone, user.id);
    }

    return new Response(
      JSON.stringify({ success: true, timezone: newTimezone }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Failed to update timezone:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
