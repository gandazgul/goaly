import { db } from '../../../db/index.js';

/** @type {import('astro').APIRoute} */
export const GET = async ({ request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('No code provided', { status: 400 });
  }

  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const PUBLIC_URL = Deno.env.get('PUBLIC_URL') || 'http://localhost:8000';
  const REDIRECT_URI = `${PUBLIC_URL}/api/auth/callback`;

  try {
    // 1. Exchange the authorization code for an access token (and refresh token)
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('OAuth token error:', tokenData);
      return new Response(`Token error: ${tokenData.error_description}`, { status: 400 });
    }

    const { access_token, refresh_token } = tokenData;

    // 2. Fetch the user's profile information using the access token
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (userData.error) {
      console.error('User info error:', userData);
      return new Response(`User info error: ${userData.error.message}`, { status: 400 });
    }

    const { id: google_id, email, name, picture } = userData;

    // 3. Upsert the user into our SQLite database
    const existingUser = db.prepare('SELECT id, refresh_token FROM users WHERE google_id = ?').get(google_id);

    // If the user already exists, we might not get a new refresh_token back on subsequent logins
    // (unless we passed prompt=consent). So we only update it if we receive a new one.
    const finalRefreshToken = refresh_token || (existingUser ? existingUser.refresh_token : null);

    if (existingUser) {
      db.prepare(`
        UPDATE users 
        SET email = ?, access_token = ?, refresh_token = ? 
        WHERE google_id = ?
      `).run(email, access_token, finalRefreshToken, google_id);
    } else {
      db.prepare(`
        INSERT INTO users (email, google_id, access_token, refresh_token) 
        VALUES (?, ?, ?, ?)
      `).run(email, google_id, access_token, finalRefreshToken);
    }

    // 4. Securely set a session cookie holding the user's Google ID so we know they are logged in
    const headers = new Headers();
    headers.append(
      'Set-Cookie',
      `session_id=${google_id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}` // 30 Days
    );
    headers.append('Location', '/');

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (error) {
    console.error('Callback handler error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};