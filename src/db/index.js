// Hide from esbuild using new Function
const importDynamic = new Function('modulePath', 'return import(modulePath)');
const { DatabaseSync } = await importDynamic('node:sqlite');

export const db = new DatabaseSync('goaly.db');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    google_id TEXT UNIQUE NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    gotify_url TEXT,
    gotify_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    times_per_week INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    time_preference TEXT NOT NULL,
    color TEXT DEFAULT '9',
    icon TEXT DEFAULT 'i-ph-star-fill',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS goal_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL,
    calendar_event_id TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, completed, missed, skipped
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
  );
`);