import { advanceGoalInstances } from "../lib/advance.js";
import dayjs from "../lib/dateUtils.js";

const DAY_MS = 24 * 60 * 60 * 1000;

async function runAdvance() {
  const start = Date.now();
  console.log(
    `[${new Date().toISOString()}] Running goal instance advancement...`,
  );
  try {
    const result = await advanceGoalInstances();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[${
        new Date().toISOString()
      }] Advanced ${result.advanced} goals, missed ${result.missed} instances (${elapsed}s)`,
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Advance failed:`, error);
  }
}

function msUntilNextMidnight() {
  const now = dayjs.utc();
  const next = now.add(1, "day").startOf("day");
  return next.diff(now, "millisecond");
}

let started = false;

/**
 * Start the daily advancement cron. Runs once on startup, then at the next
 * midnight UTC, then every 24 hours after that.
 *
 * Safe to call multiple times — the cron will only be installed once.
 */
export function startAdvanceCron() {
  if (started) return;
  started = true;

  // Run immediately on startup so a container restarted past midnight
  // still catches up the same day.
  runAdvance();

  // Align the first scheduled run to the next midnight UTC, then repeat
  // every 24h. setInterval alone would drift by up to a full day
  // depending on startup time.
  setTimeout(() => {
    runAdvance();
    setInterval(runAdvance, DAY_MS);
  }, msUntilNextMidnight());
}
