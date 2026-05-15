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
  - Responsive layout with mobile-first padding, full-width action buttons on
    small screens, and 44px touch targets across forms and goal cards.
  - Service worker (`public/sw.js`) with network-first HTML fetch, cache
    versioning, and a branded `offline.html` fallback.
  - Installable PWA: web manifest with maskable icons, standalone display, and
    iOS-specific meta tags for home-screen installs.
- **Smart Rescheduling:** Daily midnight-aligned cron (`src/server/advance.js`)
  scans for past-due pending `goal_instances`, marks them `missed`, and invokes
  the Scheduling Engine to refill the affected goal with new slots later in the
  week. Marking only flips to `missed` after a successful schedule so transient
  Google Calendar errors retry on the next tick.

---

## 🚀 Upcoming Phases

### Phase 4: Notifications

- [ ] **Gotify Reminders:** Implement a `Deno.cron` job to frequently check for
      upcoming `goal_instances` and fire webhooks to the user's connected Gotify
      server to remind them.
