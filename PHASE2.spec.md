# Phase 2: User Customization & Time Blocks

This document details the implementation plan for giving users control over
their time blocks and ensuring robust timezone handling across the application.

## 1. Dependencies

- **Day.js:** Add `dayjs` using Deno's native package management
  (`deno add npm:dayjs`).
- **Plugins:** We will heavily utilize the `utc` and `timezone` plugins provided
  by `dayjs` to handle complex timezone math and Daylight Saving Time (DST)
  boundaries accurately.

## 2. Database Migrations (Custom Runner)

To support adding new columns safely in a production environment, we will
implement a lightweight, custom migration runner using the existing
`node:sqlite` connection. We will avoid heavy ORMs like Knex.js to keep the
project simple.

- **Migration Architecture:**
  - Create a `migrations` table:
    `(id INTEGER PRIMARY KEY, name TEXT UNIQUE, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)`.
  - Create a `src/db/migrations/` directory to store `.sql` files.
  - Update `src/db/index.js` to read this directory on startup, check the
    `migrations` table, and execute any unapplied `.sql` scripts inside a
    transaction.
- **Initial Migrations:**
  - `001_initial.sql`: The current schema (`users`, `goals`, `goal_instances`).
  - `002_user_time_prefs.sql`: The new columns for this phase.

## 3. Database Schema Updates

The `002_user_time_prefs.sql` migration will add the following to the `users`
table:

- `timezone` (TEXT, default 'UTC')
- `morning_start` (INTEGER, default 6)
- `afternoon_start` (INTEGER, default 12)
- `evening_start` (INTEGER, default 17)
- `night_start` (INTEGER, default 21)

_Note: All date/time values stored in the database (e.g., `start_time`,
`end_time` in `goal_instances`) MUST be explicitly stored as UTC ISO strings._

## 4. Settings UI & API

- **UI (`src/pages/profile.astro`):**
  - **Timezone Selector:** A dropdown populated dynamically via
    `Intl.supportedValuesOf('timeZone')`. It should default to the user's saved
    timezone or auto-detect their local timezone if none is saved.
  - **Continuous Time Blocks:** A section allowing users to define the start
    hour (0-23) for Morning, Afternoon, Evening, and Night. The UI should
    clearly indicate that a block continues until the start of the next one.
- **API (`src/pages/api/settings/update.js`):**
  - Update the `POST` handler to parse the new fields from `formData` and update
    the `users` table.

## 5. Timezone-Aware Scheduling (`src/lib/scheduler.js`)

- **Dynamic Time Blocks:** Replace the hardcoded `TIME_BLOCKS` constant. The
  scheduling logic must read the user's custom start times from their database
  record.
- **Accurate Boundaries:** Use
  `dayjs(currentDay).tz(user.timezone).hour(startHour).minute(0)` to calculate
  the exact unix timestamp for the start and end of every block on any given
  day. This ensures overlap checks with `busyRanges` are accurate, even across
  DST changes.
- **Google Calendar Payload:** When creating an event via the API, provide the
  exact start/end datetimes and include `timeZone: user.timezone` so the event
  anchors correctly in the user's calendar.
- **UTC Database Storage:** Before inserting into `goal_instances`, use
  `dayjs().utc().toISOString()` to ensure the database always holds UTC values.
