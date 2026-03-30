/* eslint-disable @typescript-eslint/no-require-imports */
import * as schema from "../../drizzle/schema";

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

if (TURSO_URL && TURSO_TOKEN) {
  // Production: Turso (libsql)
  const { drizzle } = require("drizzle-orm/libsql");
  const { createClient } = require("@libsql/client");
  const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  db = drizzle(client, { schema });
} else {
  // Local development: better-sqlite3
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const Database = require("better-sqlite3");
  const path = require("path");
  const fs = require("fs");
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, "lux-quotes.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
}

export { db, schema };
