## Phase 5: Deno Crons & Gotify Reminders - ⏳ PENDING

- [x] Add UI for users to input their Gotify server URL and App Token into their profile.
- [ ] Implement a `Deno.cron` job to frequently check for upcoming `goal_instances` and fire webhooks to the user's Gotify server.
- [ ] Implement a nightly `Deno.cron` to check for missed goals (events that passed without being marked "done") and trigger the Scheduling Engine to find a new slot later in the week.