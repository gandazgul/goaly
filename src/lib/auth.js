import { db } from "../db/index.js";

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} email
 * @property {string} google_id
 * @property {string} refresh_token
 * @property {string} gotify_url
 * @property {string} gotify_token
 */

/**
 * Helper to get the currently logged-in user from the Request's cookies
 * @param {Request} request
 * @returns {User | null}
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
  const user = db.prepare("SELECT * FROM users WHERE google_id = ?").get(
    sessionId,
  );
  return /** @type {User | null} */ (user);
}
