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
      endHour: 24,
    },
  };

  const block = userSettings[time_preference] || userSettings.afternoon;
  const emoji = getEmojiForIcon(icon);

  // Lookahead: Next 7 days
  const now = dayjs().tz(userTimezone);
  const timeMin = now;
  const timeMax = now.add(7, "day");

  // 1. Fetch busy blocks from Google Calendar
  const busyEvents = await fetchCalendarEvents(
    user,
    timeMin.toDate(),
    timeMax.toDate(),
  );

  const busyEventIds = new Set(
    busyEvents.map((/** @type {import('./calendar.js').CalendarEvent} */ e) =>
      e.id
    ),
  );

  // 2. Fetch existing instances for ALL goals for this user in the next 7 days
  const allExistingInstances = db.prepare(`
    SELECT gi.id, gi.start_time, gi.calendar_event_id, g.time_preference, g.duration_minutes, g.id as goal_id
    FROM goal_instances gi
    JOIN goals g ON gi.goal_id = g.id
    WHERE g.user_id = ? AND gi.start_time >= ? AND gi.start_time <= ? AND gi.status != 'deleted'
  `).all(user.id, timeMin.utc().toISOString(), timeMax.utc().toISOString());

  // Filter out instances deleted from Google Calendar and keep those competing for the same time block
  const competingInstances = [];
  for (const inst of allExistingInstances) {
    if (inst.calendar_event_id && !busyEventIds.has(inst.calendar_event_id)) {
      // It was deleted from Google Calendar, so mark it deleted in DB
      db.prepare("UPDATE goal_instances SET status = 'deleted' WHERE id = ?")
        .run(inst.id);
      console.log(
        `Marked instance ${inst.id} of goal ID ${inst.goal_id} as deleted because it's no longer in Google Calendar.`,
      );
    } else {
      if (inst.time_preference === time_preference) {
        competingInstances.push(inst);
      }
    }
  }

  // Check how many instances of THIS goal are already scheduled
  const thisGoalInstances = competingInstances.filter((inst) =>
    inst.goal_id === goalId
  );
  if (thisGoalInstances.length >= times_per_week) {
    console.log(
      `Goal ${goal.name} already has ${thisGoalInstances.length}/${times_per_week} instances scheduled in the next 7 days.`,
    );
    return;
  }

  const neededInstances = times_per_week - thisGoalInstances.length;

  // Track the crowdedness (total duration) per day string
  /** @type {Record<string, number>} */
  const crowdedness = {};
  for (const inst of competingInstances) {
    const dayStr = dayjs(inst.start_time).tz(userTimezone).format("YYYY-MM-DD");
    crowdedness[dayStr] = (crowdedness[dayStr] || 0) + inst.duration_minutes;
  }

  // Also track how many instances of THIS goal are on each day
  /** @type {Record<string, number>} */
  const instancesOfThisGoalPerDay = {};
  for (const inst of thisGoalInstances) {
    const dayStr = dayjs(inst.start_time).tz(userTimezone).format("YYYY-MM-DD");
    instancesOfThisGoalPerDay[dayStr] =
      (instancesOfThisGoalPerDay[dayStr] || 0) + 1;
  }

  // Generate candidate days
  /** @type {Array<{date: any, dateString: string, blockStart: any, blockEnd: any, crowdedness: number}>} */
  const candidateDays = [];
  for (let i = 0; i < 7; i++) {
    const currentDay = now.add(i, "day");
    const currentDayString = currentDay.format("YYYY-MM-DD");

    // Determine the boundaries for this day's time block in user's timezone
    const blockStart = currentDay.hour(block.startHour).minute(0).second(0)
      .millisecond(0);
    let blockEnd = currentDay.hour(block.endHour).minute(0).second(0)
      .millisecond(0);

    // If the block crosses midnight
    if (block.endHour <= block.startHour) {
      blockEnd = blockEnd.add(1, "day");
    }

    // Skip if the block is already entirely in the past
    if (blockEnd.valueOf() <= now.valueOf()) {
      continue;
    }

    candidateDays.push({
      date: currentDay,
      dateString: currentDayString,
      blockStart,
      blockEnd,
      crowdedness: crowdedness[currentDayString] || 0,
    });
  }

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

  // Helper to find a free slot on a given candidate day
  const findSlotOnDay = (
    /** @type {typeof candidateDays[0]} */ dayCandidate,
  ) => {
    let cursor = Math.max(dayCandidate.blockStart.valueOf(), now.valueOf());

    while (cursor + durationMs <= dayCandidate.blockEnd.valueOf()) {
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
        return { start: cursor, end: candidateEnd };
      }

      // Move cursor forward by 15 mins
      cursor += 15 * 60 * 1000;
    }
    return null;
  };

  // PASS 1: Even Spread (Max 1 instance of THIS goal per day)
  // Sort candidate days by crowdedness ASC
  candidateDays.sort((a, b) => a.crowdedness - b.crowdedness);

  for (const day of candidateDays) {
    if (scheduledSlots.length >= neededInstances) break;

    const alreadyCount = (instancesOfThisGoalPerDay[day.dateString] || 0) +
      scheduledSlots.filter((s) =>
        dayjs(s.start).tz(userTimezone).format("YYYY-MM-DD") === day.dateString
      ).length;

    if (alreadyCount > 0) continue;

    const slot = findSlotOnDay(day);
    if (slot) {
      scheduledSlots.push(slot);
      day.crowdedness += duration_minutes;
    }
  }

  // PASS 2: Soft Fallback (Allow multiple instances per day if still needed)
  if (scheduledSlots.length < neededInstances) {
    let madeProgress = true;
    while (scheduledSlots.length < neededInstances && madeProgress) {
      madeProgress = false;
      // Re-sort candidate days by updated crowdedness ASC
      candidateDays.sort((a, b) => a.crowdedness - b.crowdedness);

      for (const day of candidateDays) {
        if (scheduledSlots.length >= neededInstances) break;

        const slot = findSlotOnDay(day);
        if (slot) {
          scheduledSlots.push(slot);
          day.crowdedness += duration_minutes;
          madeProgress = true;
          break; // Break out of the for loop to re-sort based on new crowdedness
        }
      }
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
