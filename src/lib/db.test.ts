import { afterEach, describe, expect, it, vi } from "vitest";
import { db, sql } from "@/lib/db";

describe("lazy database setup", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("does not require DATABASE_URL when route modules import the database", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(db).toBeDefined();
    expect(sql).toBeDefined();
  });

  it("reports missing DATABASE_URL when a database operation is attempted", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(() => db.select()).toThrowError("DATABASE_URL is required");
    expect(() => sql.end()).toThrowError("DATABASE_URL is required");
  });
});
