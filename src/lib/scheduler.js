import { createCalendarEvent, fetchCalendarEvents } from "./calendar.js";
import { db } from "../db/index.js";

// Default user settings (will later come from User profile)
const TIME_BLOCKS = {
  morning: { startHour: 6, endHour: 12 },
  afternoon: { startHour: 12, endHour: 17 },
  evening: { startHour: 17, endHour: 21 },
  night: { startHour: 21, endHour: 24 },
};

/**
 * Maps the chosen UnoCSS icon to an emoji for the Google Calendar event title
 */
function getEmojiForIcon(iconClass) {
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
 * @param {Object} user DB User
 * @param {Object} goal DB Goal
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
  const block = TIME_BLOCKS[time_preference] || TIME_BLOCKS.afternoon;
  const emoji = getEmojiForIcon(icon);

  const now = new Date();

  // Lookahead: Next 7 days
  const timeMin = new Date(now);
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + 7);

  // 1. Fetch busy blocks from Google Calendar
  const busyEvents = await fetchCalendarEvents(user, timeMin, timeMax);
  const busyRanges = busyEvents.map((e) => ({
    start: new Date(e.start).getTime(),
    end: new Date(e.end).getTime(),
  })).sort((a, b) => a.start - b.start);

  const durationMs = duration_minutes * 60 * 1000;
  const scheduledSlots = [];

  // Iterate over the next 7 days to find free slots
  for (let i = 0; i < 7; i++) {
    if (scheduledSlots.length >= times_per_week) break;

    const currentDay = new Date(now);
    currentDay.setDate(now.getDate() + i);

    // Determine the boundaries for this day's time block
    const blockStart = new Date(currentDay);
    blockStart.setHours(block.startHour, 0, 0, 0);

    const blockEnd = new Date(currentDay);
    if (block.endHour === 24) {
      blockEnd.setHours(23, 59, 59, 999);
    } else {
      blockEnd.setHours(block.endHour, 0, 0, 0);
    }

    // Skip if the block is already in the past
    if (blockEnd.getTime() <= Date.now()) {
      continue;
    }

    // Adjust start time if today and the block has already started
    let cursor = Math.max(blockStart.getTime(), Date.now());
    // We step through the block in 15-minute increments
    while (cursor + durationMs <= blockEnd.getTime()) {
      const candidateEnd = cursor + durationMs;

      // Check for overlap with any busy event
      const overlap = busyRanges.some((busy) => {
        // overlap condition: candidate starts before busy ends AND candidate ends after busy starts
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

  // 2. Actually create the Google Calendar Events and DB instances
  for (const slot of scheduledSlots) {
    const eventDetails = {
      summary: `${emoji} ${goal.name}`,
      description: `Scheduled by Goaly.\nDuration: ${duration_minutes} min`,
      start: { dateTime: new Date(slot.start).toISOString(), timeZone: "UTC" },
      end: { dateTime: new Date(slot.end).toISOString(), timeZone: "UTC" },
      colorId: color || "9", // Default to Blueberry/Purple
    };

    try {
      const gcalEvent = await createCalendarEvent(user, eventDetails);

      // Save to database
      db.prepare(`
        INSERT INTO goal_instances (goal_id, calendar_event_id, start_time, end_time, status)
        VALUES (?, ?, ?, ?, 'pending')
      `).run(
        goalId,
        gcalEvent.id,
        new Date(slot.start).toISOString(),
        new Date(slot.end).toISOString(),
      );
      console.log(
        `Scheduled instance for ${goal.name} at ${
          new Date(slot.start).toLocaleString()
        }`,
      );
    } catch (err) {
      console.error(`Failed to create calendar event for slot: ${err}`);
    }
  }
}
