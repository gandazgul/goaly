# Phase 2: User Customization & Time Blocks

**Overview:** This document details the implementation plan for giving users
control over their time blocks and ensuring robust timezone handling across the
application.

## Task 1: Setup Dependencies for Date/Time Management

**Description:** Introduce `dayjs` and necessary plugins to handle complex
timezone math and Daylight Saving Time (DST) boundaries accurately. **Outcome:**
The project will have a robust, standardized library for handling dates and
times, preventing timezone-related bugs and simplifying date manipulation.
**Dependencies:** None. **Estimated Timeline:** 0.5 days.

- [ ] **Step 1.1: Install dayjs**
  - Subtask: Run `deno add npm:dayjs` to use Deno's native package management.
- [ ] **Step 1.2: Configure Plugins**
  - Subtask: Import and extend `dayjs` with `utc` and `timezone` plugins in a
    centralized utility file (e.g., `src/lib/dateUtils.js`) or where needed.

**Acceptance Criteria:**

- `dayjs` is present in `deno.json`.
- `dayjs` can be successfully imported and used with `utc` and `timezone`
  plugins active within the application.

## Task 2: Implement Database Migration Runner

**Description:** Create a lightweight, custom migration runner using the
existing `node:sqlite` connection to support adding new columns safely in a
production environment without heavy ORMs like Knex.js. **Outcome:** The
application will be able to safely, automatically, and predictably update its
database schema across deployments while keeping the tech stack simple.
**Dependencies:** None. **Estimated Timeline:** 1 day.

- [ ] **Step 2.1: Define Migration Architecture**
  - Subtask: Update `src/db/index.js` to create a `migrations` table if it
    doesn't exist:
    `(id INTEGER PRIMARY KEY, name TEXT UNIQUE, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)`.
  - Subtask: Create a `src/db/migrations/` directory to store `.sql` files.
- [ ] **Step 2.2: Implement Migration Logic**
  - Subtask: Update `src/db/index.js` to read the `src/db/migrations/` directory
    on startup.
  - Subtask: Check the `migrations` table for applied scripts.
  - Subtask: Execute unapplied `.sql` scripts sequentially inside a database
    transaction.
- [ ] **Step 2.3: Create Initial Migrations**
  - Subtask: Create `001_initial.sql` representing the current baseline schema
    (`users`, `goals`, `goal_instances`).

**Acceptance Criteria:**

- The application automatically runs unapplied migrations from
  `src/db/migrations/` on startup.
- Migrations are tracked in the `migrations` table.
- Failing migrations rollback completely (transactional execution).
- `001_initial.sql` successfully establishes the baseline schema if run on a
  fresh database.

## Task 3: Apply User Time Preferences Schema Update

**Description:** Add new columns to the `users` table to store timezone and
custom time block start times. **Outcome:** The database will be capable of
storing individualized user preferences for when their morning, afternoon,
evening, and night begin, along with their local timezone. **Dependencies:**
Task 2 (Migration Runner). **Estimated Timeline:** 0.5 days.

- [ ] **Step 3.1: Create Migration Script**
  - Subtask: Create `002_user_time_prefs.sql` in the migrations directory.
  - Subtask: Add `timezone` (TEXT, default 'UTC') to `users`.
  - Subtask: Add `morning_start` (INTEGER, default 6) to `users`.
  - Subtask: Add `afternoon_start` (INTEGER, default 12) to `users`.
  - Subtask: Add `evening_start` (INTEGER, default 17) to `users`.
  - Subtask: Add `night_start` (INTEGER, default 21) to `users`.
- [ ] **Step 3.2: Enforce UTC Rule Documentation**
  - Subtask: Document in code comments that all date/time values (e.g.,
    `start_time`, `end_time` in `goal_instances`) MUST be explicitly stored as
    UTC ISO strings.

**Acceptance Criteria:**

- `002_user_time_prefs.sql` runs successfully on startup.
- The `users` table contains the 5 new columns with correct default values.

## Task 4: Develop Settings UI & API

**Description:** Build the user interface and backend endpoint for users to view
and update their timezone and time block preferences. **Outcome:** Users will
have a seamless way to customize their scheduling experience, directly impacting
how the system finds time for their goals to fit their unique daily routine.
**Dependencies:** Task 3 (Schema Update). **Estimated Timeline:** 1.5 days.

- [ ] **Step 4.1: Build UI Components (`src/pages/profile.astro`)**
  - Subtask: Implement a Timezone Selector dropdown populated dynamically via
    `Intl.supportedValuesOf('timeZone')`.
  - Subtask: Default the dropdown to the user's saved timezone, or auto-detect
    via JS (`Intl.DateTimeFormat().resolvedOptions().timeZone`) if none is
    saved.
  - Subtask: Implement a "Continuous Time Blocks" section allowing users to
    define the start hour (0-23) for Morning, Afternoon, Evening, and Night.
  - Subtask: Add UI text/visuals clearly indicating that a block continues until
    the start of the next one.
- [ ] **Step 4.2: Implement API Endpoint (`src/pages/api/settings/update.js`)**
  - Subtask: Update the `POST` handler to parse `timezone`, `morning_start`,
    `afternoon_start`, `evening_start`, and `night_start` from `formData`.
  - Subtask: Validate inputs (e.g., ensure hours are valid integers between 0
    and 23).
  - Subtask: Update the corresponding user record in the `users` table.

**Acceptance Criteria:**

- Users can view and change their timezone and time block settings on their
  profile page.
- The UI accurately reflects the data stored in the database.
- The API endpoint successfully validates and persists the new settings to the
  database.

## Task 5: Implement Timezone-Aware Scheduling

**Description:** Refactor the core scheduling logic (`src/lib/scheduler.js`) to
use the new user preferences and `dayjs` for accurate, timezone-aware datetime
calculations. **Outcome:** The system will accurately schedule goal instances
within the user's personalized time blocks, respecting their local timezone and
Daylight Saving Time rules, and correctly syncing with Google Calendar.
**Dependencies:** Task 1 (Dependencies), Task 4 (Settings UI & API). **Estimated
Timeline:** 2 days.

- [ ] **Step 5.1: Integrate User Preferences**
  - Subtask: Replace the hardcoded `TIME_BLOCKS` constant in the scheduling
    logic.
  - Subtask: Read the user's custom start times from their database record
    before running the scheduling algorithm.
- [ ] **Step 5.2: Calculate Accurate Boundaries**
  - Subtask: Use `dayjs(currentDay).tz(user.timezone).hour(startHour).minute(0)`
    to calculate the exact unix timestamp for the start and end of every block
    on any given day.
  - Subtask: Ensure overlap checks with `busyRanges` use these accurate,
    timezone-aware timestamps, handling DST correctly.
- [ ] **Step 5.3: Update Google Calendar Payload**
  - Subtask: When creating an event via the API, provide the exact start/end
    datetimes and include `timeZone: user.timezone` so the event anchors
    correctly in the user's calendar.
- [ ] **Step 5.4: Enforce UTC Database Storage**
  - Subtask: Before inserting into `goal_instances`, use
    `dayjs().utc().toISOString()` to ensure the database always holds UTC
    values, regardless of the user's timezone.

**Acceptance Criteria:**

- The scheduler generates goal instances that strictly fall within the user's
  defined custom time blocks.
- Time calculations (start/end boundaries) are perfectly accurate even on days
  when DST begins or ends.
- Google Calendar events are created in the correct user timezone.
- All scheduled dates are stored in the database in UTC format.
