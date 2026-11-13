/**
 * Shared parsing for server-side list pages (search, filters, sort, paging)
 * driven by URL search params, so lists are shareable and work without JS.
 */
export interface ListParams {
  page: number;
  pageSize: number;
  q: string;
  sort: string | null;
  dir: "asc" | "desc";
  filters: Record<string, string>;
  from: number;
  to: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseListParams(
  raw: RawParams,
  opts: { pageSize?: number; sortable?: string[]; defaultSort?: string; defaultDir?: "asc" | "desc"; filterKeys?: string[] } = {},
): ListParams {
  const pageSize = Math.min(Math.max(Number(first(raw.size)) || opts.pageSize || 20, 5), 100);
  const page = Math.max(Number(first(raw.page)) || 1, 1);
  const q = (first(raw.q) ?? "").trim().slice(0, 120);
  const sortRaw = first(raw.sort);
  const sort = sortRaw && opts.sortable?.includes(sortRaw) ? sortRaw : (opts.defaultSort ?? null);
  const dirRaw = first(raw.dir);
  const dir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : (opts.defaultDir ?? "desc");
  const filters: Record<string, string> = {};
  for (const key of opts.filterKeys ?? []) {
    const v = first(raw[key]);
    if (v && v !== "all") filters[key] = v.slice(0, 80);
  }
  const from = (page - 1) * pageSize;
  return { page, pageSize, q, sort, dir, filters, from, to: from + pageSize - 1 };
}

/** Escape user input for use inside a PostgREST `ilike` / `or` filter. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_,()]/g, (m) => `\\${m}`);
}

export function buildQueryString(base: RawParams, overrides: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    const val = first(v);
    if (val !== undefined && val !== "") params.set(k, val);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null || v === undefined || v === "") params.delete(k);
    else params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
