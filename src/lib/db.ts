import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/schema";

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const client = globalForDb.sql ?? postgres(connectionString, { max: 10, prepare: false });
  if (process.env.NODE_ENV !== "production") globalForDb.sql = client;
  return client;
}

function createDatabase() {
  return drizzle(getSql(), { schema });
}

type Database = ReturnType<typeof createDatabase>;
let database: Database | undefined;

function getDatabase() {
  return database ??= createDatabase();
}

// Route modules are imported during `next build`; defer DATABASE_URL validation
// until a handler actually performs a query at runtime.
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = getDatabase();
    const value = Reflect.get(instance, property, instance) as unknown;
    return typeof value === "function" ? value.bind(instance) : value;
  }
});

export const sql = new Proxy({} as ReturnType<typeof postgres>, {
  get(_target, property) {
    const client = getSql();
    const value = Reflect.get(client, property, client) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  }
});
