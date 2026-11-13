import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** Integration tests need a real Supabase project; they are skipped (and say so) otherwise. */
export const hasSupabase = Boolean(SUPABASE_URL && PUBLISHABLE_KEY && SECRET_KEY);
export const skipReason = "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY in .env.test.local to run integration tests.";

export function service(): SupabaseClient {
  return createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anon(): SupabaseClient {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

const run = Date.now().toString(36);
const password = `It!${run}-${Math.random().toString(36).slice(2, 10)}`;
const created: string[] = [];

export async function makeUser(label: string, roles: ("teacher" | "admin")[] = []) {
  const admin = service();
  const email = `it+${label}-${run}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `IT ${label}` } });
  if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);
  created.push(data.user.id);
  for (const role of roles) await admin.from("user_roles").insert({ user_id: data.user.id, role });
  if (roles.includes("teacher")) {
    await admin.from("teacher_profiles").insert({ user_id: data.user.id, slug: `it-${label}-${run}`, public_name: `IT ${label}`, status: "approved" });
  }
  const client = anon();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signIn(${label}): ${signIn.error.message}`);
  return { id: data.user.id, email, client };
}

export async function cleanupUsers() {
  const admin = service();
  for (const id of created.splice(0)) await admin.auth.admin.deleteUser(id);
}

export const runId = run;
