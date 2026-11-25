// Test helpers: builds a fresh database from the stub + every migration, then
// offers helpers that act as a specific Supabase user (RLS-enforced) or as service_role.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DATABASE_URL = process.env.DATABASE_URL || "";

export async function buildDatabase() {
  const admin = new pg.Client({ connectionString: DATABASE_URL });
  await admin.connect();
  await admin.query("drop schema if exists public cascade; drop schema if exists auth cascade; drop schema if exists storage cascade; create schema public;");
  await admin.query("drop publication if exists supabase_realtime");
  const files = [join(root, "supabase/tests/00_supabase_stub.sql"),
    ...readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort().map((f) => join(root, "supabase/migrations", f))];
  for (const file of files) {
    try { await admin.query(readFileSync(file, "utf8")); }
    catch (e) { throw new Error(`Migration failed: ${file}: ${e.message}`); }
  }
  await admin.end();
}

export async function connect() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

let counter = 0;
// Creates an auth user (which fires the profile trigger) and optionally verifies/admins them using the superuser connection.
export async function createUser(db, { name = "Student", college = "Test College", verified = false, admin = false, email } = {}) {
  counter += 1;
  const mail = email || `user${counter}_${Date.now()}@example.edu`;
  const { rows } = await db.query(
    "insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id",
    [mail, JSON.stringify({ full_name: name, college_name: college, department: "CS", course: "BTech", graduation_year: 2027 })]);
  const id = rows[0].id;
  if (verified) await db.query("update public.profiles set is_verified = true where id = $1", [id]);
  if (admin) await db.query("update public.profiles set role = 'admin', is_verified = true where id = $1", [id]);
  return id;
}

// Runs fn inside a transaction as the given user (role authenticated, RLS enforced) and always rolls back
// unless commit is true. Returns the function result.
export async function asUser(db, userId, fn, { commit = false } = {}) {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)", [userId]);
    const result = await fn(db);
    await db.query(commit ? "commit" : "rollback");
    return result;
  } catch (e) { await db.query("rollback"); throw e; }
}
export async function asAnon(db, fn) {
  await db.query("begin");
  try { await db.query("set local role anon"); const r = await fn(db); await db.query("rollback"); return r; }
  catch (e) { await db.query("rollback"); throw e; }
}
// Expect a statement to fail (permission denied / RLS violation / raise). Uses a savepoint so the txn survives.
export async function fails(db, sql, params = []) {
  await db.query("savepoint s");
  try { await db.query(sql, params); await db.query("release savepoint s"); return null; }
  catch (e) { await db.query("rollback to savepoint s"); return e.message; }
}
