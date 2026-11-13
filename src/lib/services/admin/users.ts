import "server-only";
import { adminRpc } from "./rpc";

export interface UserSearchRow {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  status: string;
  roles: string[];
  created_at: string;
  last_sign_in_at: string | null;
  deletion_requested_at: string | null;
  enrollments_count: number;
}

export async function searchUsers(params: {
  role?: "admin" | "teacher" | "student" | null;
  q?: string;
  status?: string | null;
  sort?: "created_desc" | "created_asc" | "name_asc" | "last_sign_in_desc";
  limit?: number;
  offset?: number;
}): Promise<{ rows: UserSearchRow[]; total: number }> {
  const data = await adminRpc<(UserSearchRow & { total_count: number | string; enrollments_count: number | string })[] | null>("admin_search_users", {
    p_role: params.role ?? null,
    p_query: params.q || null,
    p_status: params.status ?? null,
    p_sort: params.sort ?? "created_desc",
    p_limit: params.limit ?? 20,
    p_offset: params.offset ?? 0,
  });
  const raw = data ?? [];
  const rows: UserSearchRow[] = raw.map((r) => ({ ...r, enrollments_count: Number(r.enrollments_count) }));
  const total = raw.length ? Number(raw[0].total_count) : 0;
  return { rows, total };
}
