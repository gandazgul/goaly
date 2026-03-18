import { db } from "../db/index.js";

/**
 * Gets a valid Google access token for the user, refreshing it if necessary.
 * @param {Object} user The user object from the DB
 * @returns {Promise<string>} The valid access token
 */
export async function getValidAccessToken(user) {
  if (!user || !user.refresh_token) {
    throw new Error("User has no refresh token");
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: user.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Refresh token error:", tokenData);
      throw new Error(
        `Failed to refresh token: ${tokenData.error_description}`,
      );
    }

    const { access_token } = tokenData;

    // Save the new access_token to the DB
    db.prepare("UPDATE users SET access_token = ? WHERE id = ?").run(
      access_token,
      user.id,
    );

    return access_token;
  } catch (error) {
    console.error("Failed to get valid access token:", error);
    throw error;
  }
}
