import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = postgres(url, { max: 1, prepare: false });
const migrationDirectory = join(process.cwd(), "drizzle");

try {
  await sql.begin(async (tx) => {
    await tx`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    const migrations = (await readdir(migrationDirectory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
    for (const name of migrations) {
      const [alreadyApplied] = await tx`SELECT name FROM schema_migrations WHERE name = ${name}`;
      if (alreadyApplied) continue;
      const contents = await readFile(join(migrationDirectory, name), "utf8");
      for (const statement of contents.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await tx.unsafe(statement);
      await tx`INSERT INTO schema_migrations (name) VALUES (${name})`;
      console.log(`Applied ${name}`);
    }
  });
  console.log("Database migrations are up to date.");
} finally { await sql.end(); }
