import "dotenv/config";
import { runner } from "node-pg-migrate";

const direction = process.argv[2];
if (direction !== "up" && direction !== "down") {
  throw new Error("Pass either 'up' or 'down' to the migration runner");
}

if (!process.env.DB_URL) {
  throw new Error("DB_URL is required to run auth migrations");
}

await runner({
  databaseUrl: process.env.DB_URL,
  dir: "migrations",
  direction,
  migrationsTable: "pgmigrations",
});
