# Goaly — Context Overview

Goaly is a productivity SaaS that automatically finds free time in a user's
Google Calendar and schedules recurring goals (reading, workouts, meditation,
etc.) into those gaps. It is built on Deno with Astro SSR, uses SQLite for
persistence, and authenticates via Google OAuth 2.0 with offline refresh tokens.
The app is designed to be privacy-first: goal data lives in the user's Google
Calendar, and the server only stores minimal account metadata.

## Language & Domain Terminology

The project is written in JavaScript (Deno-flavored), using Astro for
server-side rendering, UnoCSS for styling, and dayjs for date/time math. Key
domain terms:

### Key Concepts

| Term                   | Definition                                                                                               | Aliases to avoid        |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Goal**               | A recurring activity the user wants to schedule (e.g., "Read 30 min, 3x/week"). Stored in `goals` table. | "Task", "Habit"         |
| **Goal Instance**      | A single scheduled occurrence of a goal, stored in `goal_instances` with a UTC start/end and status.     | "Event", "Session"      |
| **Scheduler Engine**   | The core algorithm (`src/lib/scheduler.js`) that finds free calendar gaps and creates goal instances.    | "Planner", "Allocator"  |
| **Time Block**         | A user-defined period of the day (Morning/Afternoon/Evening/Night) with configurable start hours.        | "Time slot", "Window"   |
| **Crowdedness**        | The total scheduled duration on a given day, used by the scheduler to spread goals evenly.               | "Load", "Density"       |
| **Session Cookie**     | An HttpOnly cookie (`session_id`) storing the user's Google ID for authentication.                       | "Auth token", "JWT"     |
| **Gotify**             | An optional push notification server; users can configure URL + App Token in settings.                   | "Notifications", "Push" |
| **Sync (Re-schedule)** | An operation that deletes all pending future instances and re-runs the scheduler for all goals.          | "Refresh", "Resync"     |
| **Streak**             | The number of consecutive weeks where a user completed their goal the required number of times.          | "Run", "Chain"          |

## Key Files

| Path                                        | Purpose                                                   |
| ------------------------------------------- | --------------------------------------------------------- |
| `src/db/index.js`                           | Database initialization, migration runner                 |
| `src/db/migrations/001_initial.sql`         | Baseline schema: users, goals, goal_instances             |
| `src/db/migrations/002_user_time_prefs.sql` | Adds timezone + time block columns to users               |
| `src/lib/auth.js`                           | Session cookie auth, `getUserFromRequest()` helper        |
| `src/lib/google.js`                         | OAuth token refresh via Google's token endpoint           |
| `src/lib/calendar.js`                       | Google Calendar API: fetch, create, delete, update events |
| `src/lib/scheduler.js`                      | Core scheduling engine (two-pass gap-finding algorithm)   |
| `src/lib/dateUtils.js`                      | dayjs wrapper with UTC + timezone plugins configured      |
| `src/utils/streakCalc.js`                   | Weekly streak calculation and weekly progress helpers     |
| `src/pages/index.astro`                     | Dashboard: lists goals, modal for new goal, sync button   |
| `src/pages/profile.astro`                   | Settings page: timezone, time blocks, Gotify config       |
| `src/pages/api/auth/login.js`               | Google OAuth flow initiation                              |
| `src/pages/api/auth/callback.js`            | OAuth callback: exchanges code, upserts user in DB        |
| `src/pages/api/auth/logout.js`              | Clears session cookie, redirects to home                  |
| `src/pages/api/goals/create.js`             | Creates a goal + triggers scheduler                       |
| `src/pages/api/goals/delete.js`             | Deletes a goal, its instances, and calendar events        |
| `src/pages/api/goals/sync.js`               | Full re-sync: deletes pending instances, re-schedules     |
| `src/pages/api/settings/update.js`          | Updates timezone, time blocks, Gotify settings            |
| `src/pages/api/settings/timezone.js`        | API-only timezone update (JSON response)                  |
| `src/pages/api/instances/update.js`         | Marks a goal instance as completed/skipped/missed         |
| `src/components/GoalForm.astro`             | New goal modal with icon, color, duration, frequency      |
| `src/components/GoalCard.astro`             | Goal display card with progress bar, streak, actions      |
| `src/components/Toast.astro`                | Toast notification component (custom element)             |
| `src/layouts/Layout.astro`                  | Root HTML layout, footer, service worker registration     |
| `astro.config.js`                           | Astro config: Deno adapter, UnoCSS, server port 8080      |
| `deno.json`                                 | Dependencies, tasks (dev/build/test/lint), fmt config     |
| `uno.config.js`                             | UnoCSS config: presets, icon collection, safelist         |
| `Containerfile`                             | Multi-stage Dockerfile (builder → distroless runtime)     |
| `playwright/app.spec.js`                    | E2E tests: login, CRUD goals, settings, sync, logout      |
| `src/lib/scheduler.test.js`                 | Unit tests for the scheduling engine                      |

## Patterns & Conventions

### Routing & API Design

- API routes live under `src/pages/api/` and use Astro's `APIRoute` type.
- Each route exports `GET` and/or `POST` functions that return `Response`
  objects.
- Mutations redirect with query params for feedback: `?success=GoalCreated`,
  `?success=GoalsSynced`, `?success=GoalDeleted`, `?success=SettingsSaved`.
- Read-only API endpoints (e.g., `settings/timezone`) return JSON.

### Authentication

- Google OAuth 2.0 with `access_type=offline` to obtain refresh tokens.
- Session stored in an **HttpOnly, SameSite=Lax** cookie (`session_id` = user's
  Google ID).
- `getUserFromRequest()` in `src/lib/auth.js` parses the cookie and looks up the
  user in SQLite.
- `MOCK_AUTH=true` env var bypasses Google auth for dev/testing, inserting a
  mock user.

### Database Access

- Raw SQL via `node:sqlite` (Deno built-in). No ORM.
- Single shared connection created at `src/db/index.js` startup.
- All queries use `db.prepare(sql).run(params)` (write) or `.get(params)` /
  `.all(params)` (read).
- Migrations run automatically on startup in transactions with rollback on
  failure.
- **Critical rule:** All datetime values stored in `goal_instances` (start_time,
  end_time) MUST be UTC ISO strings.

### Date/Time Handling

- `dayjs` with `utc` and `timezone` plugins (configured in
  `src/lib/dateUtils.js`).
- User's timezone and time block preferences (morning_start, afternoon_start,
  evening_start, night_start) stored in the `users` table.
- Scheduler converts user-local block times to UTC for DB storage; converts back
  to user timezone for Google Calendar event creation.

### Scheduling Algorithm

- Two-pass approach in `src/lib/scheduler.js`:
  1. **Pass 1 (Even Spread):** Sorts candidate days by crowdedness (ascending),
     places at most one instance per day.
  2. **Pass 2 (Soft Fallback):** If more instances are needed, allows multiple
     per day, re-sorting by crowdedness after each placement.
- Checks for overlap against both busy Google Calendar events and
  already-scheduled instances from the same run.
- 15-minute slot granularity when scanning for free time.

### Styling

- UnoCSS with `preset-uno`, `preset-icons` (Phosphor icon set via
  `@iconify-json/ph`), and `preset-web-fonts` (Google Fonts: Inter).
- Arbitrary CSS values (colors, backgrounds) are safelisted in `uno.config.js`.
- Tailwind-compatible utility classes used throughout components.
- Primary color: `#005F6A`, Accent: `#FFBF00`.

### Testing

- **Unit tests:** Deno native test runner (`deno test -A`), located alongside
  source (e.g., `scheduler.test.js`).
- **E2E tests:** Playwright (`playwright/app.spec.js`), assumes `MOCK_AUTH=true`
  on the server.
- CI runs: `deno lint && deno fmt --check && deno check && deno test -A`.

### Build & Deployment

- Build: `deno run -A --env npm:astro build` → output in `dist/`.
- Production server: `deno -WREN dist/server/entry.mjs`.
- Docker: Multi-stage Containerfile (Debian builder → distroless runtime). Mount
  DB volume for persistence.
- Key env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_URL`,
  `DB_PATH` (optional, defaults to `goaly.db`), `MOCK_AUTH`.

### Error Handling

- API routes use try/catch, log errors with `console.error`, and return
  appropriate HTTP status codes (401, 400, 404, 500).
- Calendar API errors throw with descriptive messages including the Google API
  error text.
- Failed calendar event deletions are logged but do not block DB cleanup.

### PWA

- Service worker (`public/sw.js`) registered in Layout.astro for offline
  support.
- Web manifest (`public/site.webmanifest`) for installability.
- Apple-touch icons and meta tags configured for iOS.
