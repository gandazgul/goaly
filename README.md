# Goaly

The missing piece of your Google Calendar.

Goaly automatically finds free time in your existing Google Calendar and
natively schedules recurring goals (like reading, working out, or meditating)
based on your personal time preferences, duration, and frequency.

## Features

- **Smart Google Calendar Integration:** Automatically fetches your busy events
  and schedules your goals into empty gaps.
- **Time Preferences:** Set your preferred time of day (Morning, Afternoon,
  Evening, Night) for each individual goal.
- **Customizable:** Choose from a wide variety of UnoCSS icons and native Google
  Calendar colors for each goal.
- **Privacy-First & Self-Hosted:** Powered by Deno, Astro, and SQLite. Your
  refresh tokens and data never leave your server.

## Getting Started

### Prerequisites

- [Deno](https://deno.land/) installed (used for both server and package
  management)
- A Google Cloud Project with the **Google Calendar API** enabled
- An OAuth 2.0 Client ID and Secret (Web Application type, redirect URI:
  `http://localhost:8080/api/auth/callback`)

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

### Building and Running the Container

1. Build the container using the provided `Containerfile`:
   ```bash
   docker build -t goaly -f Containerfile .
   # or
   podman build -t goaly -f Containerfile .
   ```

2. Run the container, providing the required environment variables:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth 2.0 Client ID.
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth 2.0 Client Secret.
   - `PUBLIC_URL`: The public URL where your instance is accessible (e.g.,
     `http://localhost:8080`).
   - `DB_PATH`: The path to the SQLite database file inside the container. It
     defaults to `goaly.db` in the current working directory, but should be set
     to a path inside a mounted volume for persistence (e.g., `/data/goaly.db`).

   Example `docker run` command:
   ```bash
   docker run -d \
     -p 8080:8080 \
     -e GOOGLE_CLIENT_ID=your_client_id_here \
     -e GOOGLE_CLIENT_SECRET=your_client_secret_here \
     -e PUBLIC_URL=http://localhost:8080 \
     -e DB_PATH=/data/goaly.db \
     -v $(pwd)/data:/data \
     --name goaly \
     goaly
   ```

## Development

This project uses Deno for package management and tooling. After making any code
changes, always run the following commands to format your code, catch linting
errors, and verify the build:

```bash
deno fmt
deno lint
deno task build
```

## Roadmap & Upcoming Features

Goaly is actively being developed. Here is a look at what's coming next:

### User Customization & Time Blocks

- **Customizable Time Blocks:** Update the Settings/Profile page so users can
  define exactly what hours "Morning", "Afternoon", "Evening", and "Night" mean
  to them.
- **Timezone Handling:** Ensure time blocks correctly respect the user's local
  timezone settings when querying Google Calendar.

### Future

- **PWA & Mobile Experience:** Responsive design, offline fallback, and "Add to
  Home Screen" support.
- **Notifications & Automated Rescheduling:** Push notifications via Gotify and
  smart rescheduling for missed goals.

For more details on upcoming features and technical specifications, check out
our [ROADMAP.md](ROADMAP.md).

## Tech Stack

- **Frontend:** Astro (SSR), UnoCSS
- **Backend:** Deno custom server
- **Database:** SQLite (`node:sqlite`)
- **Authentication:** Google OAuth 2.0 (Offline token access)

### Design

- Primary color: #005F6A
- Accent: #FFBF00
- Background: #FFFFFF
- Main text: #1f2937
- Muted text: #6b7280

## Acknowledgements

Built with the help of [OpenCode](https://opencode.ai/) using Gemini.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.
