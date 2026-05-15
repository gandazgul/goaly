---
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Implement automatic advancement of goal instances so that when a day passes without the user interacting with a pending instance, the system schedules the next instance. Two triggers: (1) When the user marks an instance complete/skipped via the UI, immediately schedule the next instance in the update API. (2) A daily background cron task (once/day at ~midnight UTC) that queries all users for pending instances whose start_time has elapsed and schedules replacements via the existing scheduler. This ensures goals keep advancing even if the user never opens the app."
affectedPaths:
  - "src/lib/advance.js"
  - "src/server/advance.js"
  - "src/pages/api/instances/update.js"
  - "Containerfile"
  - "src/lib/scheduler.js"
  - "src/lib/advance.test.js"
createdAt: "2026-05-14T16:34:37.813Z"
updatedAt: "2026-05-14T16:34:37.813Z"
status: "completed"
origin: "internal"
---

# Advance Goal Instances

- **classification**: FEATURE
- **complexity**: MEDIUM
- **summary**: Implement automatic advancement of goal instances so that when a
  day passes without the user interacting with a pending instance, the system
  schedules the next instance. Two triggers: (1) When the user marks an instance
  complete via the UI, immediately schedule the next instance. (2) A daily
  background cron task (once/day at ~midnight UTC) that queries all goals for
  pending instances whose start_time has elapsed and schedules replacements via
  the existing scheduler. Wake up only once per day — Goaly's scheduling
  granularity is per-day time blocks, and productivity habits don't need
  sub-daily urgency.
- **affectedPaths**: ["src/lib/advance.js", "src/server/advance.js",
  "src/pages/api/instances/update.js", "src/lib/scheduler.js",
  "src/db/migrations/003_advance_tracking.sql", "Containerfile",
  "src/lib/advance.test.js"]
- **createdAt**: 2026-05-14T15:00:00Z
- **status**: draft

## Background

Goaly currently schedules goals for the next 7 days. When a user marks an
instance as completed, the instance stays in that state and no new instance is
created. If the user never opens the app, past-due instances accumulate with no
automatic advancement. The system needs to proactively schedule the next
instance whenever the current one passes without interaction.

### Why daily is sufficient

- Goaly's scheduling granularity is per-day time blocks
  (morning/afternoon/evening/night)
- Productivity habits (reading, exercise, meditation) operate on a daily cadence
- Once-daily advancement catches all overdue instances without wasting Google
  Calendar API calls
- The UI-triggered advancement handles the immediate case when the user is
  active

## Design

### Data flow

```
User marks instance → POST /api/instances/update
                         ├── Mark instance as 'completed'
                         └── Call scheduleGoal() for the same goal

Daily cron (~midnight UTC)
                         ├── Query all goals with pending instances past start_time
                         ├── Mark them as 'missed'
                         └── Call scheduleGoal() for each affected goal
```

### Key decisions

1. **Instance states for advancement**: Only instances with `status = 'pending'`
   and `start_time < now` are advanced.
2. **Marking as 'missed'**: Past-due pending instances are marked `'missed'`
   (not `'deleted'`) to preserve the audit trail. The scheduler will be updated
   to exclude `'missed'` instances from its count.
3. **Scheduler replacement**: After marking instances as `'missed'`,
   `scheduleGoal()` sees the goal has fewer active instances than
   `times_per_week` and schedules new ones.
4. **Wakeup frequency**: Once per day at midnight UTC. This is sufficient
   because the granularity is per-day, and the UI trigger handles immediate
   advancement.
5. **Transaction safety**: Marking as missed and scheduling new instances use
   separate DB operations. The scheduler's existing logic prevents duplicates.

## Implementation Steps

### 1. Create `src/lib/advance.js` — Core advancement logic

New file. Exports a single async function `advanceGoalInstances(db)`.

**Behavior:**

```
export async function advanceGoalInstances(db) {
  // 1. Find all pending instances where start_time < now (UTC)
  // SELECT gi.*, g.id as goal_id, g.user_id, g.times_per_week, ...
  // FROM goal_instances gi
  // JOIN goals g ON gi.goal_id = g.id
  // WHERE gi.status = 'pending' AND gi.start_time < :now

  // 2. Group by goal_id
  // 3. For each goal:
  //    a. Mark all past-due pending instances as 'missed'
  //       UPDATE goal_instances SET status = 'missed' WHERE id IN (...)
  //    b. Fetch user + goal details
  //    c. Call scheduleGoal(user, goal) — the scheduler will create
  //       new instances if the active count < times_per_week

  return { advanced: number_of_goals_advanced }
}
```

**Query details:**

- `start_time` is stored as UTC ISO string, so direct comparison works
- Use `dayjs.utc().toISOString()` for the cutoff time
- Group results by `goal_id` to batch mark-missed per goal
- For each goal, fetch `users.*` and `goals.*` for `scheduleGoal()`

### 2. Create `src/server/advance.js` — Daily cron runner

New file. Runs `advanceGoalInstances()` once per day at midnight UTC.

**Implementation approach:**

Use a file-based lock (`/tmp/goaly-advance.lock`) to prevent overlapping runs.
Calculate the next midnight UTC and use `setInterval` with a 24-hour interval.

```
import { advanceGoalInstances } from "../lib/advance.js";
import * as fs from "node:fs";

const LOCK_FILE = "/tmp/goaly-advance.lock";

function hasLock() { return fs.existsSync(LOCK_FILE); }
function acquireLock() { fs.writeFileSync(LOCK_FILE, String(Date.now())); }
function releaseLock() { try { fs.unlinkSync(LOCK_FILE); } catch {} }

async function runAdvance() {
  if (hasLock()) return; // Another instance is running
  try {
    acquireLock();
    console.log(`[${new Date().toISOString()}] Running goal instance advancement...`);
    const result = await advanceGoalInstances(globalThis.db);
    console.log(`[${new Date().toISOString()}] Advanced ${result.advanced} goals.`);
  } catch (error) {
    console.error("Advance failed:", error);
  } finally {
    releaseLock();
  }
}

// Calculate next midnight UTC
function nextMidnight() {
  const now = dayjs.utc();
  const next = now.add(1, "day").startOf("day"); // midnight UTC tomorrow
  return next.diff(now, "millisecond");
}

runAdvance(); // Run on startup (covers edge case if process restarted after midnight)
setInterval(runAdvance, nextMidnight() + 24 * 60 * 60 * 1000);
```

**Startup behavior**: Run immediately on startup (covers the case where the
process restarts after midnight but before the scheduled time).

### 3. Update `src/lib/scheduler.js` — Exclude 'missed' instances

**Change 1**: In the SQL query for `competingInstances`, add exclusion of
`'missed'` status:

```sql
-- Before:
WHERE g.user_id = ? AND gi.start_time >= ? AND gi.start_time <= ? AND gi.status != 'deleted'

-- After:
WHERE g.user_id = ? AND gi.start_time >= ? AND gi.start_time <= ? AND gi.status NOT IN ('deleted', 'missed')
```

This ensures that when `scheduleGoal()` counts existing instances, it excludes
instances marked as `'missed'` by the advance function. A goal with 4 instances
where 1 is `'missed'` will show 3 active instances, triggering the scheduler to
create 1 new instance.

**No other changes needed** — the scheduler already handles the case where a
goal has fewer than `times_per_week` instances.

### 4. Update `src/pages/api/instances/update.js` — Schedule next on completion

When the user marks an instance as `'completed'`, immediately schedule the next
instance for that goal.

**Changes to the POST handler:**

1. Update the instance query to also fetch `goal_id`:
   ```sql
   SELECT gi.id, gi.calendar_event_id, gi.status, gi.goal_id
   ```

2. After the existing status update logic (marking instance as
   completed/skipped + updating calendar), add:

```js
// After marking instance as completed/skipped...
const goal = db.prepare(`
  SELECT g.*, u.*
  FROM goals g
  JOIN users u ON g.user_id = u.id
  WHERE g.id = ?
`).get(instance.goal_id);

if (goal) {
  try {
    await scheduleGoal(user, goal);
  } catch (err) {
    console.error("Failed to schedule next instance:", err);
    // Don't fail the update — the daily cron will catch up
  }
}
```

**Note**: Trigger on both `'completed'` and `'skipped'` statuses. These indicate
the user has actively interacted with the instance and wants to move forward.
`'missed'` status is typically set by the daily cron, not the UI.

### 5. Create `src/db/migrations/003_advance_tracking.sql` — Migration

Add a `last_advance_at` column to track when the last advancement ran (optional
but useful for debugging):

```sql
ALTER TABLE goals ADD COLUMN last_advance_at DATETIME;
```

This column is updated by the advance function when it processes a goal. It's
optional for core functionality but useful for monitoring/debugging.

### 6. Update `Containerfile` — Run advance cron alongside server

**Changes to the final stage:**

Replace the single CMD with a shell script that:

1. Starts the advance cron in the background
2. Starts the Astro server
3. Waits for both processes

```dockerfile
# Add before CMD:
RUN echo '#!/bin/sh\nexec /bin/deno run -A /app/server/advance.js & /bin/deno run -A /app/server/entry.mjs' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
```

The advance process runs in the background (`&`) and the main server is the
foreground process. The shell's `exec` replaces the shell process with the last
command (server), so SIGTERM reaches the server. The background advance process
will keep running.

**Alternative**: Use `nohup` for the background process:

```dockerfile
CMD ["/bin/sh", "-c", "nohup /bin/deno run -A /app/server/advance.js > /app/logs/advance.log 2>&1 & /bin/deno run -A /app/server/entry.mjs"]
```

### 7. Create `src/lib/advance.test.js` — Unit tests

New test file following the existing pattern in `scheduler.test.js`.

**Test 1**:
`advanceGoalInstances - marks past-due instances as missed and schedules new ones`

- Create a user, a goal (3x/week), and 2 past-due pending instances
- Mock the Google Calendar API
- Call `advanceGoalInstances(db)`
- Assert: the 2 instances are now `'missed'`
- Assert: 1 new instance was created (3 - 2 = 1 needed to reach times_per_week)

**Test 2**: `advanceGoalInstances - skips future pending instances`

- Create a user, a goal (3x/week), and 1 past-due instance + 1 future instance
- Call `advanceGoalInstances(db)`
- Assert: only the past-due instance is marked `'missed'`
- Assert: the future instance remains `'pending'`

**Test 3**: `advanceGoalInstances - handles goals with no pending instances`

- Create a user, a goal (3x/week), and no pending instances
- Call `advanceGoalInstances(db)`
- Assert: nothing changes, no errors

**Test 4**: `advanceGoalInstances - multiple goals for same user`

- Create a user, 2 goals, each with past-due instances
- Call `advanceGoalInstances(db)`
- Assert: both goals have their overdue instances marked as `'missed'`
- Assert: new instances are scheduled for both goals

## Migration Plan

| Step | File                                         | Description                           |
| ---- | -------------------------------------------- | ------------------------------------- |
| 1    | `src/db/migrations/003_advance_tracking.sql` | Add `last_advance_at` to goals table  |
| 2    | `src/lib/advance.js`                         | New file — core advancement logic     |
| 3    | `src/server/advance.js`                      | New file — daily cron runner          |
| 4    | `src/lib/scheduler.js`                       | Exclude 'missed' instances from count |
| 5    | `src/pages/api/instances/update.js`          | Schedule next instance on completion  |
| 6    | `src/lib/advance.test.js`                    | New file — unit tests                 |
| 7    | `Containerfile`                              | Run advance cron alongside server     |

## Edge Cases & Considerations

1. **Multiple past-due instances for same goal**: All are marked as `'missed'`
   at once, then `scheduleGoal()` is called once. The scheduler sees the gap and
   creates replacements up to `times_per_week`.

2. **Scheduler runs while advancement runs**: The file-based lock prevents
   overlapping advance runs. The server can still run normally; only the cron is
   locked.

3. **Google Calendar API rate limits**: If a user has many goals with many
   overdue instances, there could be many API calls. This is unlikely in
   practice (small user base), but could be addressed later with batching.

4. **Timezone handling**: `start_time` is stored as UTC ISO. The comparison
   `start_time < now` uses UTC, which is consistent. The scheduler's lookahead
   also uses the user's timezone for slot picking.

5. **Instance that was already scheduled for next week**: If the scheduler
   already created instances for the next 7 days and the user marks the current
   one complete, `scheduleGoal()` will see the goal has `times_per_week`
   instances and do nothing. This is correct behavior — the next scheduled
   instance will be used when it arrives.

6. **User never opens the app**: The daily cron will advance instances. When the
   user finally opens the app, they'll see the new scheduled instances.
