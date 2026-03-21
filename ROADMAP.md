# Goaly Roadmap

This document outlines the planned features and technical milestones for Goaly.

## ✅ Completed Milestones

- **Core Infrastructure:** Astro (SSR), Deno server, and SQLite (`node:sqlite`)
  integration.
- **Authentication:** Google OAuth 2.0 with offline token access (refresh
  tokens).
- **Goal Management:** Users can create goals with specific duration, frequency,
  colors, and icons.
- **Scheduling Engine (MVP):** Automatically finds free gaps in the user's
  Google Calendar and schedules goal instances into those gaps.
- **Branding:** Goaly logo, manifest, and basic PWA assets configured.
- **Profile UI:** Users can input their Gotify server URL and App Token for
  future notifications.

---

## 🚀 Upcoming Phases

### Phase 1: Goal Tracking & Progress Analytics

_Shift from just scheduling goals to actively tracking their completion._

- [ ] Add the ability to mark a scheduled goal instance as "Done", "Skipped", or
      "Missed" directly from the Goaly dashboard.
- [ ] Display weekly progress (e.g., "3 of 5 workouts completed this week").
- [ ] Display lifetime statistics (e.g., "Total reading sessions completed:
      42").
- [ ] Add simple visual progress bars or streak indicators to the Goal Cards.

More details on [PHASE1.spec.md](./PHASE1.spec.md).

### Phase 2: User Customization & Time Blocks

_Give users more control over when their goals happen._

- [ ] **Customizable Time Blocks:** Update the Settings/Profile page so users
      can define exactly what hours "Morning", "Afternoon", "Evening", and
      "Night" mean to them (currently hardcoded).
- [ ] **Timezone Handling:** Ensure time blocks correctly respect the user's
      local timezone settings when querying Google Calendar.

More details on [PHASE2.spec.md](./PHASE2.spec.md).

### Phase 3: PWA & Mobile Experience

_Make Goaly feel like a native app on any device._

- [ ] **Responsive Design:** Audit and improve the UI to ensure it is fully
      responsive and looks great on mobile phones, tablets, and desktops.
- [ ] **PWA Service Worker:** Implement a service worker to cache core assets
      and provide a reliable offline fallback screen.
- [ ] **Installability:** Add PWA configuration to prompt Android and iOS users
      to "Add to Home Screen" for a full-screen, native-like experience.

### Phase 4: Notifications & Automated Rescheduling

_Proactive features using Deno Crons (carried over from initial implementation
plan)._

- [ ] **Gotify Reminders:** Implement a `Deno.cron` job to frequently check for
      upcoming `goal_instances` and fire webhooks to the user's connected Gotify
      server to remind them.
- [ ] **Smart Rescheduling:** Implement a nightly `Deno.cron` to check for
      missed goals (events that passed without being marked "done"). Trigger the
      Scheduling Engine to automatically find a new slot for them later in the
      week.
