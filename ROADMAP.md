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
- **Goal Tracking & Progress Analytics:**
  - Ability to mark a scheduled goal instance as "Done", "Skipped", or "Missed"
    directly from the Goaly dashboard.
  - Weekly progress and lifetime statistics tracking.
  - Visual progress bars and streak indicators on Goal Cards.
  - Google Calendar Sync: Automatically updates Google Calendar event titles
    with completion statuses (✅ or ❌).
- **Phase 2: User Customization & Time Blocks**
  - [x] **Customizable Time Blocks:** Update the Settings/Profile page so users
        can define exactly what hours "Morning", "Afternoon", "Evening", and
        "Night" mean to them (currently hardcoded).
  - [x] **Timezone Handling:** Ensure time blocks correctly respect the user's
        local timezone settings when querying Google Calendar.
- **Phase 3: PWA & Mobile Experience**
  - [x] **Responsive Design:** Audit and improve the UI to ensure it is fully
        responsive and looks great on mobile phones, tablets, and desktops.
  - [x] **PWA Service Worker:** Implement a service worker to cache core assets
        and provide a reliable offline fallback screen.
  - [x] **Installability:** Add PWA configuration to prompt Android and iOS
        users to "Add to Home Screen" for a full-screen, native-like experience.

---

## 🚀 Upcoming Phases

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
