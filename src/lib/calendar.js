import { getValidAccessToken } from "./google.js";

/**
 * @typedef {import('./scheduler.js').User} User
 */

/**
 * @typedef {Object} CalendarEvent
 * @property {string} id
 * @property {string} summary
 * @property {string} start
 * @property {string} end
 */

/**
 * @typedef {Object} GoogleCalendarEvent
 * @property {string} id
 * @property {string} summary
 * @property {{dateTime?: string, date?: string}} start
 * @property {{dateTime?: string, date?: string}} end
 */

/**
 * @typedef {Object} NewCalendarEvent
 * @property {string} summary
 * @property {string} description
 * @property {{dateTime: string, timeZone: string}} start
 * @property {{dateTime: string, timeZone: string}} end
 * @property {string} colorId
 */

/**
 * @param {User} user
 * @param {Date} timeMin
 * @param {Date} timeMax
 * @returns {Promise<CalendarEvent[]>}
 */
export async function fetchCalendarEvents(user, timeMin, timeMax) {
  const MOCK_AUTH = Deno.env.get("MOCK_AUTH") === "true";
  if (MOCK_AUTH) {
    return [];
  }

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
  return (data.items || []).map((/** @type {GoogleCalendarEvent} */ event) => ({
    id: event.id,
    summary: event.summary,
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
  })).filter((/** @type {CalendarEvent} */ e) => e.start && e.end);
}

/**
 * @param {User} user
 * @param {NewCalendarEvent} eventDetails
 * @returns {Promise<GoogleCalendarEvent>}
 */
export async function createCalendarEvent(user, eventDetails) {
  const MOCK_AUTH = Deno.env.get("MOCK_AUTH") === "true";
  if (MOCK_AUTH) {
    return { id: "mock_event_" + Date.now(), ...eventDetails };
  }

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

/**
 * @param {User} user
 * @param {string} eventId
 * @returns {Promise<boolean>}
 */
export async function deleteCalendarEvent(user, eventId) {
  const MOCK_AUTH = Deno.env.get("MOCK_AUTH") === "true";
  if (MOCK_AUTH) {
    return true;
  }

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

/**
 * @param {User} user
 * @param {string} eventId
 * @param {string} status - 'completed', 'skipped', or 'missed'
 * @returns {Promise<boolean>}
 */
export async function updateCalendarEventTitle(user, eventId, status) {
  const MOCK_AUTH = Deno.env.get("MOCK_AUTH") === "true";
  if (MOCK_AUTH) {
    return true;
  }

  const token = await getValidAccessToken(user);

  // 1. Fetch current event to get summary
  const getResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!getResponse.ok) {
    // If not found, skip safely
    if (getResponse.status === 404 || getResponse.status === 410) return false;
    throw new Error(`Google Calendar API Error: failed to fetch event`);
  }

  const event = await getResponse.json();
  let summary = event.summary || "";

  // 2. Remove existing status prefix if any
  summary = summary.replace(/^✅\s*/, "").replace(/^❌\s*/, "");

  // 3. Add new status prefix
  if (status === "completed") {
    summary = `✅ ${summary}`;
  } else if (status === "skipped" || status === "missed") {
    summary = `❌ ${summary}`;
  }

  // 4. PATCH the event
  const patchResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ summary }),
    },
  );

  if (!patchResponse.ok) {
    throw new Error(
      `Google Calendar API Error: failed to update event summary`,
    );
  }

  return true;
}
