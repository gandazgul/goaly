import { db } from '../../db/index.js';
import { getUserFromRequest } from '../../lib/auth.js';

/** @type {import('astro').APIRoute} */
export const POST = async ({ request, redirect }) => {
  const user = getUserFromRequest(request);

  if (!user || !user.refresh_token) {
    return new Response('Unauthorized or missing refresh token. Please re-authenticate.', { status: 401 });
  }

  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

  try {
    // 1. Get a fresh access token using the stored refresh_token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: user.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Refresh token error:', tokenData);
      return new Response(`Failed to refresh token: ${tokenData.error_description}`, { status: 400 });
    }

    const { access_token } = tokenData;

    // 2. Use the fresh access token to create a "Hello World" event on their primary calendar
    const event = {
      summary: 'Goal Digger: Hello World! 🚀',
      description: 'If you see this, the Astro + SQLite + Google Calendar integration is working perfectly!',
      start: {
        dateTime: new Date(Date.now() + 1000 * 60 * 15).toISOString(), // 15 mins from now
        timeZone: 'UTC', // You can refine this later
      },
      end: {
        dateTime: new Date(Date.now() + 1000 * 60 * 45).toISOString(), // 45 mins from now
        timeZone: 'UTC',
      },
      colorId: '2', // Green
    };

    const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    const calendarData = await calendarResponse.json();

    if (calendarData.error) {
      console.error('Calendar error:', calendarData);
      return new Response(`Failed to create calendar event: ${calendarData.error.message}`, { status: 400 });
    }

    console.log('Successfully created test event:', calendarData.htmlLink);

    // Update their access token in the DB just to keep it fresh
    db.prepare('UPDATE users SET access_token = ? WHERE google_id = ?').run(access_token, user.google_id);

    // Redirect back home with a success message in the URL
    return redirect('/?success=EventCreated');
  } catch (error) {
    console.error('Failed to create test event:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};