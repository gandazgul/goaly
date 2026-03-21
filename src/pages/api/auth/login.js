import { db } from "../../../db/index.js";

/** @type {import('astro').APIRoute} */
export const GET = ({ redirect }) => {
  const MOCK_AUTH = Deno.env.get("MOCK_AUTH") === "true";

  if (MOCK_AUTH) {
    const mockGoogleId = "mock-google-id-123";
    const mockEmail = "mockuser@example.com";
    
    // Upsert mock user
    const existingUser = db.prepare("SELECT id FROM users WHERE google_id = ?").get(mockGoogleId);
    if (!existingUser) {
      db.prepare(`
        INSERT INTO users (email, google_id, access_token, refresh_token) 
        VALUES (?, ?, ?, ?)
      `).run(mockEmail, mockGoogleId, "mock-access-token", "mock-refresh-token");
    }

    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      `session_id=${mockGoogleId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
        60 * 60 * 24 * 30
      }`,
    );
    headers.append("Location", "/");

    return new Response(null, {
      status: 302,
      headers,
    });
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const PUBLIC_URL = Deno.env.get("PUBLIC_URL") || "http://localhost:8000";
  const REDIRECT_URI = `${PUBLIC_URL}/api/auth/callback`;

  // Required scopes for Calendar access
  const scope = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/calendar.events",
  ].join(" ");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  // This is CRITICAL for background jobs. It forces Google to return a refresh_token
  url.searchParams.set("access_type", "offline");
  // Forces the consent prompt to appear every time so we ALWAYS get a refresh_token back (useful in dev)
  url.searchParams.set("prompt", "consent");

  return redirect(url.toString(), 302);
};
