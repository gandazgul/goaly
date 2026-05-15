import { advanceGoalInstances } from "../lib/advance.js";
import dayjs from "../lib/dateUtils.js";
import * as fs from "node:fs";
import process from "node:process";

const LOCK_FILE = "/tmp/goaly-advance.lock";

/**
 * Check if we hold the lock (lock file exists and is recent enough).
 */
function hasValidLock() {
  if (!fs.existsSync(LOCK_FILE)) return false;
  try {
    const content = fs.readFileSync(LOCK_FILE, "utf-8");
    const timestamp = parseInt(content, 10);
    // Lock is valid for 25 hours (generous buffer)
    return Date.now() - timestamp < 25 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Acquire the lock by writing our PID and timestamp.
 */
function acquireLock() {
  fs.writeFileSync(LOCK_FILE, `${Date.now()}-${process.pid}`);
}

/**
 * Release the lock by removing the lock file.
 */
function releaseLock() {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    // Lock file may not exist if process was interrupted
  }
}

/**
 * Run the advancement logic with file-based locking.
 */
async function runAdvance() {
  if (hasValidLock()) {
    console.log(
      `[${new Date().toISOString()}] Advance already running, skipping.`,
    );
    return;
  }

  acquireLock();
  try {
    const start = Date.now();
    console.log(
      `[${new Date().toISOString()}] Running goal instance advancement...`,
    );
    const result = await advanceGoalInstances();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[${
        new Date().toISOString()
      }] Advanced ${result.advanced} goals, missed ${result.missed} instances (${elapsed}s)`,
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Advance failed:`, error);
  } finally {
    releaseLock();
  }
}

// Calculate milliseconds until next midnight UTC
function msUntilNextMidnight() {
  const now = dayjs.utc();
  const next = now.add(1, "day").startOf("day"); // midnight UTC tomorrow
  return next.diff(now, "millisecond");
}

// Run immediately on startup (handles the case where the container was
// restarted after the daily schedule would have fired)
runAdvance();

// Schedule the next run at the next midnight UTC, then repeat every 24 hours
const intervalMs = msUntilNextMidnight() + 24 * 60 * 60 * 1000;
setInterval(runAdvance, intervalMs);
