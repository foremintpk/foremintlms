import fs from "node:fs";
import { adminClient, E2E_STATE_FILE, type E2EState } from "./fixtures";

/** Removes everything global-setup created. */
export default async function globalTeardown() {
  if (!fs.existsSync(E2E_STATE_FILE)) return;
  const state = JSON.parse(fs.readFileSync(E2E_STATE_FILE, "utf8")) as E2EState;
  const admin = adminClient();

  const { data: courses } = await admin.from("courses").select("id").like("slug", "e2e-%");
  const courseIds = (courses ?? []).map((c) => c.id);
  if (courseIds.length) await admin.from("courses").delete().in("id", courseIds);
  await admin.from("course_categories").delete().eq("id", state.categoryId);

  for (const user of [state.admin, state.teacher, state.otherTeacher, state.student]) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) console.warn(`teardown: could not delete ${user.email}: ${error.message}`);
  }
  fs.rmSync(E2E_STATE_FILE, { force: true });
}
