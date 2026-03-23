import { createCalendarEvent, fetchCalendarEvents } from "./calendar.js";
import { db } from "../db/index.js";
import dayjs from "./dateUtils.js";

/**
 * @typedef {Object} Goal
 * @property {number} id
 * @property {string} name
 * @property {number} times_per_week
 * @property {number} duration_minutes
 * @property {"morning"|"afternoon"|"evening"|"night"} time_preference
 * @property {string} color
 * @property {string} icon
 */

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} email
 * @property {string} refresh_token
 * @property {string} timezone
 * @property {number} morning_start
 * @property {number} afternoon_start
 * @property {number} evening_start
 * @property {number} night_start
 */

/**
 * @typedef {Object} GoalInstance
 * @property {string} start_time
 */

/**
 * @typedef {Object} TimeRange
 * @property {number} start
 * @property {number} end
 */

/**
 * Maps the chosen UnoCSS icon to an emoji for the Google Calendar event title
 *
 * @param {string} iconClass - The UnoCSS icon class name (e.g., 'i-ph-star-fill').
 * @returns {string} The corresponding emoji character.
 */
function getEmojiForIcon(iconClass) {
  /** @type {Record<string, string>} */
  const map = {
    "i-ph-star-fill": "⭐",
    "i-ph-book-fill": "📚",
    "i-ph-barbell-fill": "🏋️",
    "i-ph-sneaker-fill": "👟",
    "i-ph-heart-fill": "❤️",
    "i-ph-code-fill": "💻",
    "i-ph-palette-fill": "🎨",
    "i-ph-music-notes-fill": "🎵",
    "i-ph-money-fill": "💰",
    "i-ph-leaf-fill": "🌿",
    "i-ph-graduation-cap-fill": "🎓",
    "i-ph-game-controller-fill": "🎮",
  };
  return map[iconClass] || "🎯";
}

/**
 * Finds free slots and schedules a goal for a given user.
 * For MVP, we look up to 7 days in the future to fulfill the required "times_per_week".
 *
 * @param {User} user - DB User
 * @param {Goal} goal - DB Goal
 * @returns {Promise<void>}
 */
export async function scheduleGoal(user, goal) {
  const {
    id: goalId,
    times_per_week,
    duration_minutes,
    time_preference,
    color,
    icon,
  } = goal;

  const userTimezone = user.timezone || "UTC";

  const userSettings = {
    morning: {
      startHour: user.morning_start ?? 6,
      endHour: user.afternoon_start ?? 12,
    },
    afternoon: {
      startHour: user.afternoon_start ?? 12,
      endHour: user.evening_start ?? 17,
    },
    evening: {
      startHour: user.evening_start ?? 17,
      endHour: user.night_start ?? 21,
    },
    night: {
      startHour: user.night_start ?? 21,
      endHour: user.morning_start ?? 6,
    },
  };

  const block = userSettings[time_preference] || userSettings.afternoon;
  const emoji = getEmojiForIcon(icon);

  // Lookahead: Next 7 days
  const now = dayjs().tz(userTimezone);
  const timeMin = now;
  const timeMax = now.add(7, "day");

  // 1. Fetch existing instances for this goal in the next 7 days to avoid over-scheduling
  const existingInstances = db.prepare(`
    SELECT start_time FROM goal_instances 
    WHERE goal_id = ? AND start_time >= ? AND start_time <= ? AND status != 'deleted'
  `).all(goalId, timeMin.utc().toISOString(), timeMax.utc().toISOString());

  if (existingInstances.length >= times_per_week) {
    console.log(
      `Goal ${goal.name} already has ${existingInstances.length}/${times_per_week} instances scheduled in the next 7 days.`,
    );
    return;
  }

  // Get a list of day strings (e.g. "2023-10-04") where this goal is already scheduled
  // so we don't schedule multiple instances of the same goal on the same day.
  const daysWithInstances = new Set(
    existingInstances.map((/** @type {GoalInstance} */ inst) => {
      return dayjs(inst.start_time).tz(userTimezone).format("YYYY-MM-DD");
    }),
  );

  const neededInstances = goal.times_per_week - existingInstances.length;

  // 2. Fetch busy blocks from Google Calendar
  const busyEvents = await fetchCalendarEvents(
    user,
    timeMin.toDate(),
    timeMax.toDate(),
  );
  const busyRanges = busyEvents.map((
    /** @type {import('./calendar.js').CalendarEvent} */ e,
  ) => ({
    start: new Date(e.start).getTime(),
    end: new Date(e.end).getTime(),
  })).sort((/** @type {TimeRange} */ a, /** @type {TimeRange} */ b) =>
    a.start - b.start
  );

  const durationMs = goal.duration_minutes * 60 * 1000;
  /** @type {Array<{start: number, end: number}>} */
  const scheduledSlots = [];

  // Iterate over the next 7 days to find free slots
  for (let i = 0; i < 7; i++) {
    if (scheduledSlots.length >= neededInstances) break;

    const currentDay = now.add(i, "day");
    const currentDayString = currentDay.format("YYYY-MM-DD");

    // Check if this goal is already scheduled today
    if (daysWithInstances.has(currentDayString)) {
      continue;
    }

    // Determine the boundaries for this day's time block in user's timezone
    const blockStart = currentDay.hour(block.startHour).minute(0).second(0)
      .millisecond(0);
    let blockEnd = currentDay.hour(block.endHour).minute(0).second(0)
      .millisecond(0);

    // If the end hour is mathematically less than or equal to start hour,
    // it implies the block crosses midnight (e.g. Night: 21 to 6).
    // In this case, blockEnd is on the next day.
    if (block.endHour <= block.startHour) {
      blockEnd = blockEnd.add(1, "day");
    }

    // Skip if the block is already entirely in the past
    if (blockEnd.valueOf() <= now.valueOf()) {
      continue;
    }

    // Adjust start time if today and the block has already started
    let cursor = Math.max(blockStart.valueOf(), now.valueOf());

    // We step through the block in 15-minute increments
    while (cursor + durationMs <= blockEnd.valueOf()) {
      const candidateEnd = cursor + durationMs;

      // Check for overlap with any busy event
      const overlap = busyRanges.some((/** @type {TimeRange} */ busy) => {
        return cursor < busy.end && candidateEnd > busy.start;
      });

      // Also check against already scheduled slots from this function run
      const selfOverlap = scheduledSlots.some((slot) => {
        return cursor < slot.end && candidateEnd > slot.start;
      });

      if (!overlap && !selfOverlap) {
        // We found a slot!
        scheduledSlots.push({
          start: cursor,
          end: candidateEnd,
        });
        break; // Max 1 per day for a specific goal
      }

      // Move cursor forward by 15 mins
      cursor += 15 * 60 * 1000;
    }
  }

  console.log(`Found ${scheduledSlots.length} slots for goal ${goal.name}`);

  // 3. Actually create the Google Calendar Events and DB instances
  for (const slot of scheduledSlots) {
    const startIso = dayjs(slot.start).tz(userTimezone).format();
    const endIso = dayjs(slot.end).tz(userTimezone).format();

    const eventDetails = {
      summary: `${emoji} ${goal.name}`,
      description: `Scheduled by Goaly.\\nDuration: ${duration_minutes} min`,
      start: { dateTime: startIso, timeZone: userTimezone },
      end: { dateTime: endIso, timeZone: userTimezone },
      colorId: color || "9", // Default to Blueberry/Purple
    };

    try {
      const gcalEvent = await createCalendarEvent(user, eventDetails);

      // Save to database, enforcing UTC for start_time and end_time
      const utcStart = dayjs(slot.start).utc().toISOString();
      const utcEnd = dayjs(slot.end).utc().toISOString();

      db.prepare(`
        INSERT INTO goal_instances (goal_id, calendar_event_id, start_time, end_time, status)
        VALUES (?, ?, ?, ?, 'pending')
      `).run(
        goalId,
        gcalEvent.id,
        utcStart,
        utcEnd,
      );
      console.log(
        `Scheduled instance for ${goal.name} at ${
          dayjs(slot.start).tz(userTimezone).format()
        }`,
      );
    } catch (err) {
      console.error(`Failed to create calendar event for slot: ${err}`);
    }
  }
}
