type D1Result = { success: boolean; meta?: unknown };
type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<D1Result>;
};
type D1Database = {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1Result[]>;
  exec(sql: string): Promise<unknown>;
};

type BackupEnv = { BACKUP_DB: D1Database; BACKUP_SYNC_SECRET: string };
type Snapshot = { version: number; generatedAt: string; tables: Record<string, unknown[]> };

async function ensureSchema(database: D1Database) {
  await database.batch([
    database.prepare("CREATE TABLE IF NOT EXISTS backup_records (generation TEXT NOT NULL, table_name TEXT NOT NULL, record_key TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (generation, table_name, record_key))"),
    database.prepare("CREATE TABLE IF NOT EXISTS backup_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    database.prepare("CREATE INDEX IF NOT EXISTS backup_records_generation_idx ON backup_records(generation)"),
  ]);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function recordKey(record: unknown, index: number) {
  if (record && typeof record === "object") {
    const value = (record as Record<string, unknown>).id ?? (record as Record<string, unknown>).storageKey;
    if (value !== undefined && value !== null) return String(value);
  }
  return String(index);
}

async function receive(request: Request, env: BackupEnv) {
  if (!env.BACKUP_SYNC_SECRET || request.headers.get("authorization") !== `Bearer ${env.BACKUP_SYNC_SECRET}`) {
    return json({ message: "Unauthorized" }, 401);
  }
  const snapshot = await request.json<Snapshot>();
  if (snapshot?.version !== 1 || !snapshot.tables || !snapshot.generatedAt) return json({ message: "Invalid snapshot" }, 400);

  await ensureSchema(env.BACKUP_DB);
  const generation = crypto.randomUUID();
  let count = 0;
  for (const [tableName, records] of Object.entries(snapshot.tables)) {
    if (!Array.isArray(records)) return json({ message: `Invalid table: ${tableName}` }, 400);
    for (let offset = 0; offset < records.length; offset += 50) {
      const statements = records.slice(offset, offset + 50).map((record, index) =>
        env.BACKUP_DB.prepare(
          "INSERT INTO backup_records (generation, table_name, record_key, payload) VALUES (?, ?, ?, ?)"
        ).bind(generation, tableName, recordKey(record, offset + index), JSON.stringify(record))
      );
      if (statements.length) await env.BACKUP_DB.batch(statements);
      count += statements.length;
    }
  }

  await env.BACKUP_DB.batch([
    env.BACKUP_DB.prepare("INSERT OR REPLACE INTO backup_meta (key, value) VALUES ('active_generation', ?)").bind(generation),
    env.BACKUP_DB.prepare("INSERT OR REPLACE INTO backup_meta (key, value) VALUES ('generated_at', ?)").bind(snapshot.generatedAt),
    env.BACKUP_DB.prepare("INSERT OR REPLACE INTO backup_meta (key, value) VALUES ('record_count', ?)").bind(String(count)),
  ]);
  await env.BACKUP_DB.prepare("DELETE FROM backup_records WHERE generation <> ?").bind(generation).run();
  return json({ success: true, generatedAt: snapshot.generatedAt, recordCount: count });
}

export default {
  async fetch(request: Request, env: BackupEnv) {
    const url = new URL(request.url);
    if (url.pathname === "/api/sync" && request.method === "POST") return receive(request, env);
    if (url.pathname === "/api/health") {
      await ensureSchema(env.BACKUP_DB);
      return json({ ready: true, role: "read-only-backup" });
    }
    return json({ message: "Violation penalty backup receiver", role: "read-only" });
  },
};
