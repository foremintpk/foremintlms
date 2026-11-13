/**
 * Grant the administrator role to an account (first-time setup).
 *
 *   npm run admin:bootstrap -- --email you@example.com [--name "Your Name"]
 *
 * - Existing account: adds the admin role.
 * - No account yet: creates a confirmed account and prints a one-time
 *   password-setup link (valid for a short time) to this terminal only.
 *
 * Uses SUPABASE_SECRET_KEY from .env.local. The admin must then set up an
 * authenticator app at /mfa on first sign-in (MFA is required for admins).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim() ?? "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Usage: npm run admin:bootstrap -- --email you@example.com [--name "Your Name"]');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: existing, error: lookupError } = await supabase
    .from("profile_private")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) throw lookupError;

  let userId = existing?.user_id as string | undefined;

  if (!userId) {
    const tempPassword = crypto.randomUUID() + crypto.randomUUID();
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error || !created.user) throw error ?? new Error("Could not create user");
    userId = created.user.id;
    console.log(`Created account for ${email}.`);

    const { data: link, error: linkError } = await supabase.auth.admin.generateLink({ type: "recovery", email });
    if (linkError) throw linkError;
    const tokenHash = link.properties?.hashed_token;
    console.log("\nSet a password with this one-time link (do not share it):");
    console.log(`${appUrl}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/reset-password\n`);
  }

  const { error: roleError } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (roleError) throw roleError;

  await supabase.from("audit_logs").insert({
    actor_id: null,
    actor_role: "system",
    action: "admin.bootstrap",
    entity_type: "user",
    entity_id: userId,
    summary: `Administrator role granted to ${email} from the command line`,
  });

  console.log(`✔ ${email} is now an administrator. Sign in, then enrol an authenticator app at ${appUrl}/mfa.`);
}

main().catch((err) => {
  console.error("Failed:", err?.message ?? err);
  process.exit(1);
});
