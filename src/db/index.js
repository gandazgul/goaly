import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";

// Hide from esbuild using new Function
const importDynamic = new Function("modulePath", "return import(modulePath)");
const { DatabaseSync } = await importDynamic("node:sqlite");

const dbPath = process.env.DB_PATH || "goaly.db";
export const db = new DatabaseSync(dbPath);

// Initialize migrations table
db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Run migrations
const migrationsDir = path.join(process.cwd(), "src", "db", "migrations");
if (fs.existsSync(migrationsDir)) {
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"))
    .sort();

  const getAppliedMigrations = db.prepare(`SELECT name FROM migrations`);
  const appliedMigrations = getAppliedMigrations.all().map((
    /** @type {any} */ m,
  ) => m.name);

  for (const file of files) {
    if (!appliedMigrations.includes(file)) {
      console.log(`Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

      try {
        db.exec("BEGIN TRANSACTION;");
        db.exec(sql);
        const insertMigration = db.prepare(
          `INSERT INTO migrations (name) VALUES (?)`,
        );
        insertMigration.run(file);
        db.exec("COMMIT;");
        console.log(`Migration ${file} applied successfully.`);
      } catch (error) {
        db.exec("ROLLBACK;");
        console.error(`Error applying migration ${file}:`, error);
        throw error;
      }
    }
  }
}
