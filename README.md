# Goaly

The missing piece of your Google Calendar. 

Goaly automatically finds free time in your existing Google Calendar and natively schedules recurring goals (like reading, working out, or meditating) based on your personal time preferences, duration, and frequency.

## Features

- **Smart Google Calendar Integration:** Automatically fetches your busy events and schedules your goals into empty gaps.
- **Time Preferences:** Set your preferred time of day (Morning, Afternoon, Evening, Night) for each individual goal.
- **Customizable:** Choose from a wide variety of UnoCSS icons and native Google Calendar colors for each goal.
- **Privacy-First & Self-Hosted:** Powered by Deno, Astro, and SQLite. Your refresh tokens and data never leave your server.

## Getting Started

### Prerequisites

- [Deno](https://deno.land/) installed
- A Google Cloud Project with the **Google Calendar API** enabled
- An OAuth 2.0 Client ID and Secret (Web Application type, redirect URI: `http://localhost:8080/api/auth/callback`)

### Setup & Run

1. Clone the repository to your local machine.
2. Copy the environment template and fill in your Google credentials:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and fill in the details:
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   PUBLIC_URL=http://localhost:8080
   ```
4. Build the Astro project:
   ```bash
   deno install --allow-scripts
   deno task build
   ```
5. Start the Deno server:
   ```bash
   deno run -A dist/server/entry.mjs
   ```
6. Open `http://localhost:8080` in your browser.

## Next Steps & Future Features

- **Notifications:** Integration with self-hosted push notification services like [Gotify](https://gotify.net/).
- **Progress Tracking:** Visualizations to track your goal completion rates and streaks.
- **Rescheduling:** Automatically find new slots for missed or skipped goals.
- **Customizable Time Blocks:** Allow users to define their own hours for Morning, Afternoon, Evening, and Night.

## Tech Stack

- **Frontend:** Astro (SSR), UnoCSS
- **Backend:** Deno custom server
- **Database:** SQLite (`node:sqlite`)
- **Authentication:** Google OAuth 2.0 (Offline token access)

## Acknowledgements

Built with the help of [OpenCode](https://opencode.ai/) using Gemini.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.