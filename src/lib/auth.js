import { db } from "../db/index.js";

/**
 * Helper to get the currently logged-in user from the Request's cookies
 * @param {Request} request
 */
export function getUserFromRequest(request) {
  const cookieString = request.headers.get("Cookie");
  if (!cookieString) return null;

  const cookies = Object.fromEntries(
    cookieString.split("; ").map((c) => c.split("=")),
  );
  const sessionId = cookies.session_id;

  if (!sessionId) return null;

  // Find the user by their Google ID (which we're using as a simple session key for now)
  return db.prepare("SELECT * FROM users WHERE google_id = ?").get(
      sessionId,
  );
}
