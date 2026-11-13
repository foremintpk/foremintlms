import { NextResponse } from "next/server";
import { z } from "zod";
import { assertUser } from "@/lib/auth/guards";
import { apiError, noStore } from "@/lib/api";
import { canDownloadMedia, signedDownloadUrl } from "@/lib/services/storage";

/**
 * Authorised file access: checks permission for this exact user, then
 * redirects to a signed URL that expires in a few minutes.
 * `?download=1` forces a download instead of inline viewing.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/files/[id]">) {
  try {
    const user = await assertUser();
    const { id } = await ctx.params;
    const fileId = z.uuid().parse(id);
    if (!(await canDownloadMedia(user, fileId))) {
      return NextResponse.json({ error: "You don't have access to this file." }, { status: 403, headers: noStore });
    }
    const download = new URL(req.url).searchParams.get("download") === "1";
    const url = await signedDownloadUrl(fileId, { download, expiresIn: download ? 120 : 1800 });
    if (!url) return NextResponse.json({ error: "File not found." }, { status: 404, headers: noStore });
    return NextResponse.redirect(url, { status: 302, headers: noStore });
  } catch (err) {
    return apiError(err);
  }
}
