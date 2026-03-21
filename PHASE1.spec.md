# Phase 1: Goal Tracking & Progress Analytics Specification

## Overview

Shift Goaly from just scheduling goals to actively tracking their completion.
This phase introduces the ability to mark scheduled goal instances as "Done",
"Skipped", or "Missed", displaying weekly progress, lifetime statistics, and
streaks directly on the dashboard.

## 1. Database & Data Fetching Updates

- **Schema:** No schema changes needed. Rely entirely on the existing `goals`
  and `goal_instances` tables.
- **Dashboard Query (`src/pages/index.astro`):** Update the main data fetch. For
  each goal, calculate and attach:
  - **Next Instance:** Find the earliest `goal_instances` record with
    `status = 'pending'` and `start_time > NOW()`.
  - **Weekly Progress:** Count instances where `status = 'completed'` in the
    current calendar week.
  - **Lifetime Completions:** Count all instances where `status = 'completed'`.
  - **Weekly Streak:** A JS utility function that analyzes the past few weeks of
    history to calculate how many consecutive weeks the `times_per_week` target
    was met.

## 2. Layout & UI Adjustments (`src/pages/index.astro`)

- **The Modal:**
  - Add an "Add Goal" button to the header actions.
  - Wrap `<GoalForm />` in a native HTML `<dialog id="goal-modal">` element for
    accessibility and backdrop.
  - Add Vanilla JS to handle opening/closing the modal.
- **Layout:**
  - Change the grid layout so the Active Goals list takes up the full width of
    the container, providing ample horizontal space for progress bars and
    analytics.

## 3. Strict Accordion Goal Cards (`src/components/GoalCard.astro`)

- **Structure:** Wrap the card in a native HTML
  `<details name="goal-accordion">` element to create a strict accordion
  (opening one closes others automatically).
- **Collapsed State (The `<summary>`):**
  - Shows the goal name, icon, duration, and frequency.
  - Displays the 🔥 Streak badge (if streak > 0) for quick visibility.
- **Expanded State:**
  - **Next Up:** Displays the parsed date/time of the next instance.
  - **Action Buttons:** Large, clear buttons for **[Done]** (✅), **[Skipped]**
    (⏭️), and **[Missed]** (❌) related to the next pending instance.
  - **Weekly Progress:** A visual, color-coded horizontal progress bar filling
    up based on the weekly target (e.g., "2 / 3 completed this week").
  - **Footer:** Subtle text showing Lifetime completions.

## 4. API & Google Calendar Integration

- **New API Route (`src/pages/api/instances/update.js`):**
  - Receives `instance_id` and the new `status` ('completed', 'skipped',
    'missed').
  - Updates the `status` in the `goal_instances` table.
- **Google Calendar Update (`src/lib/calendar.js`):**
  - Create a new `updateCalendarEventTitle` function.
  - When an instance is marked "Done", make a `PATCH` request to the Google
    Calendar API to prepend a `✅` to the event's `summary` (e.g.,
    `✅ ⭐ Read Book`).
  - When an instance is marked "Skipped" or "Missed", prepend an `❌`.

---

## Detailed Task Breakdown

The following tasks represent a logical execution order to implement the Phase 1 specification. Tasks are grouped by technical domain.

### Group 1: Data Foundation & Logic
Establish the core data pipeline and utility functions required to calculate progress.

#### Task 1.1: Implement Data Fetching Updates (`src/pages/index.astro`)
- **Description:** Update the dashboard's data fetch block to retrieve the next instance, weekly progress, and lifetime completions from the database.
- **Subtasks:**
  - Write a SQL query to find the earliest pending `goal_instances` record (`status = 'pending'` and `start_time > NOW()`).
  - Write a SQL query to count completed instances in the current calendar week.
  - Write a SQL query to count total lifetime completed instances.
  - Map this new data onto the `goals` objects returned to the UI.
- **Acceptance Criteria:** `index.astro` successfully retrieves the required data points for each goal without errors, exposing them for frontend use.
- **Dependencies:** None.
- **Outcome:** Provides the fundamental data necessary for the UI to display upcoming actions and long-term progress, aligning with the goal of active tracking.

#### Task 1.2: Develop Weekly Streak Utility Function
- **Description:** Create a JavaScript utility to calculate the number of consecutive weeks the user met their `times_per_week` target.
- **Subtasks:**
  - Create a new utility file (e.g., `src/utils/streakCalc.js`).
  - Fetch historical `goal_instances` and group them by calendar week.
  - Compare weekly completed instance counts against the `times_per_week` target.
  - Calculate the current streak by counting backwards from the current week.
- **Acceptance Criteria:** The function returns an accurate integer representing the streak given a set of historical instances and a frequency target. Edge cases (e.g., new goals, skipped weeks) are handled properly.
- **Dependencies:** Task 1.1 (partially, for data shape).
- **Outcome:** Provides a gamification layer through streak tracking, encouraging user consistency and habit formation.

### Group 2: API & Integrations
Enable state mutations and keep the external Google Calendar perfectly synchronized with the app.

#### Task 2.1: Create Status Update API Route (`src/pages/api/instances/update.js`)
- **Description:** Implement an API endpoint to update the status of a specific goal instance in the database.
- **Subtasks:**
  - Create the `update.js` route file.
  - Parse the POST request body for `instance_id` and the new `status`.
  - Validate the inputs (ensure status is 'completed', 'skipped', or 'missed').
  - Execute the SQL update query on the `goal_instances` table.
- **Acceptance Criteria:** Sending a valid POST request successfully updates the database and returns a `200 OK` response; invalid requests return appropriate HTTP error codes.
- **Dependencies:** None.
- **Outcome:** Enables the application to mutate instance states, allowing the transition from a static, read-only schedule to an interactive tracker.

#### Task 2.2: Implement Google Calendar Sync Integration (`src/lib/calendar.js`)
- **Description:** Synchronize instance status changes back to the user's Google Calendar event.
- **Subtasks:**
  - Implement an `updateCalendarEventTitle` function.
  - Authenticate and construct a `PATCH` request to the Google Calendar API.
  - Add logic to prepend `✅` for 'Done' and `❌` for 'Skipped' or 'Missed' statuses to the event summary.
  - Call this function successfully from within the update API route (Task 2.1).
- **Acceptance Criteria:** Marking an instance as done/missed/skipped in Goaly visually updates the connected Google Calendar event title immediately.
- **Dependencies:** Task 2.1.
- **Outcome:** Ensures the user's calendar reflects their real-world progress, keeping Goaly and Google Calendar in perfect sync and reinforcing the tracking habit in tools the user already uses.

### Group 3: UI / UX Adjustments
Deliver the user-facing changes to surface the new capabilities and statistics.

#### Task 3.1: Global Layout and Modal Adjustments (`src/pages/index.astro`)
- **Description:** Refactor the dashboard layout to utilize full-width goal cards and implement a native dialog modal for goal creation.
- **Subtasks:**
  - Update grid CSS classes so active goals span the full width of their container.
  - Wrap the existing `<GoalForm />` component in a native `<dialog id="goal-modal">`.
  - Add an "Add Goal" header button and vanilla JS to control the modal's open/close state.
- **Acceptance Criteria:** The layout uses full width for goals. Clicking "Add Goal" opens a styled native modal containing the form. Clicking outside the modal or hitting the `Escape` key closes it.
- **Dependencies:** None.
- **Outcome:** Improves spatial utilization on the dashboard to fit new analytics panels while modernizing the "Add Goal" interaction for better web accessibility.

#### Task 3.2: Implement Strict Accordion Goal Cards (`src/components/GoalCard.astro`)
- **Description:** Redesign the goal card component to use an accordion pattern, hiding detailed controls and progress data until expanded.
- **Subtasks:**
  - Refactor the card to use a native HTML `<details name="goal-accordion">` and `<summary>`.
  - Build the collapsed state UI: name, icon, duration, frequency, and streak badge.
  - Build the expanded state UI: next instance date/time, action buttons, progress bar, and lifetime stats.
  - Implement dynamic UI rendering using the data fetched in Tasks 1.1 & 1.2.
- **Acceptance Criteria:** Cards function as an exclusive accordion (opening one closes the others). Both collapsed and expanded states match design specifications and accurately reflect the goal's real database data.
- **Dependencies:** Task 1.1, Task 1.2, Task 3.1.
- **Outcome:** Delivers a clean, uncluttered dashboard interface that progressively reveals complex tracking controls only when the user intends to interact with a specific goal.

#### Task 3.3: Wire Up Action Buttons to API
- **Description:** Connect the visual "Done", "Skipped", and "Missed" buttons in the expanded Goal Card to the update API.
- **Subtasks:**
  - Add vanilla JS event listeners to the action buttons in the expanded card state.
  - Implement a `fetch` POST call to `/api/instances/update.js` upon clicking an action.
  - Implement optimistic UI updates (or trigger a page reload/data refetch) to reflect the new state instantly on the dashboard.
- **Acceptance Criteria:** Clicking an action button successfully triggers the API, updates the database (and Calendar), and reflects the new state on the dashboard visually.
- **Dependencies:** Task 2.1, Task 2.2, Task 3.2.
- **Outcome:** Completes the user journey, providing the user with an actionable interface to log their progress and instantly see their tracking stats update in real-time.