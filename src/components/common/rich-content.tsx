import { sanitizeRichText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

/** Server component: renders stored rich text after sanitising it again. */
export function RichContent({ html, className }: { html: string | null | undefined; className?: string }) {
  const safe = sanitizeRichText(html);
  if (!safe) return null;
  return <div className={cn("prose-foremint", className)} dangerouslySetInnerHTML={{ __html: safe }} />;
}
