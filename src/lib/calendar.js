import { getValidAccessToken } from "./google.js";

export async function fetchCalendarEvents(user, timeMin, timeMax) {
  const token = await getValidAccessToken(user);

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true", // Expand recurring events
    orderBy: "startTime",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  const data = await response.json();
  if (data.error) {
    throw new Error(`Google Calendar API Error: ${data.error.message}`);
  }

  // Filter to just the relevant bits: start and end times
  return (data.items || []).map((event) => ({
    id: event.id,
    summary: event.summary,
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
  })).filter((e) => e.start && e.end);
}

export async function createCalendarEvent(user, eventDetails) {
  const token = await getValidAccessToken(user);

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventDetails),
    },
  );

  const data = await response.json();
  if (data.error) {
    throw new Error(`Google Calendar API Error: ${data.error.message}`);
  }

  return data;
}

export async function deleteCalendarEvent(user, eventId) {
  const token = await getValidAccessToken(user);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  // 404 Not Found or 410 Gone means it's already deleted, which is fine
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      `Google Calendar API Error: ${
        data.error?.message || response.statusText
      }`,
    );
  }

  return true;
}
