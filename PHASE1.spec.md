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
