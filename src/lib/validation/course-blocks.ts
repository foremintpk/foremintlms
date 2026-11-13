import { z } from "zod";
import { normalizeEmbedUrl } from "@/lib/services/courses/embeds";

/**
 * Lesson content-block contract.
 *
 * `lesson_content_blocks.data` holds type-specific settings validated by the
 * schemas below. Foreign keys live in dedicated columns:
 *   video            → video_asset_id
 *   pdf/document/presentation/spreadsheet/image/file → media_file_id
 *   quiz             → quiz_id
 *   assignment       → assignment_id
 *   live_session     → live_session_id
 * The learner player reads blocks through these shapes; keep them stable and
 * additive.
 */

export const BLOCK_TYPES = [
  "video",
  "video_playlist",
  "embed",
  "rich_text",
  "pdf",
  "document",
  "presentation",
  "spreadsheet",
  "image",
  "file",
  "link",
  "quiz",
  "assignment",
  "live_session",
  "recording",
  "resource_collection",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/** Block types backed by a file in the course-content bucket. */
export const FILE_BLOCK_TYPES = ["pdf", "document", "presentation", "spreadsheet", "image", "file"] as const;
export type FileBlockType = (typeof FILE_BLOCK_TYPES)[number];

/** Extensions accepted per file block type (the storage settings still apply). */
export const FILE_BLOCK_EXTENSIONS: Record<FileBlockType, string[]> = {
  pdf: ["pdf"],
  document: ["doc", "docx", "txt"],
  presentation: ["ppt", "pptx"],
  spreadsheet: ["xls", "xlsx", "csv"],
  image: ["png", "jpg", "jpeg", "webp", "gif"],
  file: ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt", "zip", "png", "jpg", "jpeg", "webp", "mp3"],
};

export function isFileBlockType(type: string): type is FileBlockType {
  return (FILE_BLOCK_TYPES as readonly string[]).includes(type);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const blockDataSchemas = {
  video: z.object({ caption: optionalText(500) }),
  video_playlist: z.object({
    video_asset_ids: z.array(z.uuid()).max(50).default([]),
    caption: optionalText(500),
  }),
  embed: z
    .object({
      url: z.string().trim().min(1, "Paste the link to embed").max(1000),
      aspect: z.enum(["16:9", "4:3", "1:1", "9:16"]).default("16:9"),
      caption: optionalText(500),
    })
    .transform((v, ctx) => {
      const normalized = normalizeEmbedUrl(v.url);
      if (!normalized) {
        ctx.addIssue({ code: "custom", path: ["url"], message: "This site can't be embedded. Use YouTube, Vimeo, Loom, Google Docs/Slides/Sheets, Figma, CodePen or Miro." });
        return z.NEVER;
      }
      return { ...v, embed_url: normalized.embedUrl, provider: normalized.provider };
    }),
  rich_text: z.object({ html: z.string().max(200_000).default("") }),
  pdf: z.object({ description: optionalText(1000), allow_download: z.boolean().default(true) }),
  document: z.object({ description: optionalText(1000), allow_download: z.boolean().default(true) }),
  presentation: z.object({ description: optionalText(1000), allow_download: z.boolean().default(true) }),
  spreadsheet: z.object({ description: optionalText(1000), allow_download: z.boolean().default(true) }),
  image: z.object({ alt: optionalText(300), caption: optionalText(500), allow_download: z.boolean().default(false) }),
  file: z.object({ description: optionalText(1000), allow_download: z.boolean().default(true) }),
  link: z.object({
    url: z
      .string()
      .trim()
      .url("Enter a full link starting with https://")
      .refine((u) => /^https:\/\//i.test(u), "Links must use https://"),
    label: z.string().trim().min(1, "Add link text").max(160),
    description: optionalText(500),
  }),
  quiz: z.object({ intro: optionalText(500) }),
  assignment: z.object({ intro: optionalText(500) }),
  live_session: z.object({ intro: optionalText(500) }),
  recording: z
    .object({
      source: z.enum(["meeting_recording", "video_asset"]),
      meeting_recording_id: z.uuid().optional(),
      video_asset_id: z.uuid().optional(),
      caption: optionalText(500),
    })
    .refine((v) => (v.source === "meeting_recording" ? Boolean(v.meeting_recording_id) : Boolean(v.video_asset_id)), {
      message: "Choose a recording",
      path: ["source"],
    }),
  resource_collection: z.object({ heading: optionalText(160), description: optionalText(1000) }),
} satisfies Record<BlockType, z.ZodType>;

export type BlockData<T extends BlockType> = z.output<(typeof blockDataSchemas)[T]>;

/** Embed blocks store the normalised embed URL alongside what the author pasted. */
export type EmbedBlockData = BlockData<"embed">;

export const BLOCK_LABELS: Record<BlockType, string> = {
  video: "Video",
  video_playlist: "Video playlist",
  embed: "Embedded content",
  rich_text: "Text",
  pdf: "PDF document",
  document: "Word document",
  presentation: "Presentation",
  spreadsheet: "Spreadsheet",
  image: "Image",
  file: "Downloadable file",
  link: "External link",
  quiz: "Quiz",
  assignment: "Assignment",
  live_session: "Live session",
  recording: "Workshop recording",
  resource_collection: "Resources",
};

export const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  video: "Upload to Mux or Bunny, or use an unlisted YouTube video",
  video_playlist: "Several videos played in order",
  embed: "YouTube, Vimeo, Loom, Google Docs, Figma and more",
  rich_text: "Formatted text, headings, lists and images",
  pdf: "Viewable and downloadable PDF",
  document: "Word or text document",
  presentation: "PowerPoint slides",
  spreadsheet: "Excel or CSV file",
  image: "A picture or diagram",
  file: "Any approved file, such as a ZIP of templates",
  link: "A link to another website",
  quiz: "A graded quiz from this course",
  assignment: "A practical task students submit",
  live_session: "An upcoming class on Zoom or Google Meet",
  recording: "A recording from a past workshop",
  resource_collection: "A list of files and links for this lesson",
};

/** Default data for a newly added block (must satisfy the schema where possible). */
export function defaultBlockData(type: BlockType): Record<string, unknown> {
  switch (type) {
    case "video_playlist":
      return { video_asset_ids: [] };
    case "embed":
      return { url: "", aspect: "16:9" };
    case "rich_text":
      return { html: "" };
    case "pdf":
    case "document":
    case "presentation":
    case "spreadsheet":
    case "file":
      return { allow_download: true };
    case "image":
      return { allow_download: false };
    case "link":
      return { url: "", label: "" };
    case "recording":
      return { source: "meeting_recording" };
    default:
      return {};
  }
}

/** Whether a saved block has everything it needs to show to students. */
export function isBlockComplete(block: {
  block_type: BlockType;
  data: Record<string, unknown>;
  video_asset_id: string | null;
  media_file_id: string | null;
  quiz_id: string | null;
  assignment_id: string | null;
  live_session_id: string | null;
}): boolean {
  switch (block.block_type) {
    case "video":
      return Boolean(block.video_asset_id);
    case "video_playlist":
      return Array.isArray(block.data.video_asset_ids) && (block.data.video_asset_ids as unknown[]).length > 0;
    case "embed":
      return typeof block.data.embed_url === "string" && block.data.embed_url.length > 0;
    case "rich_text":
      return typeof block.data.html === "string" && block.data.html.replace(/<[^>]*>/g, "").trim().length > 0;
    case "link":
      return typeof block.data.url === "string" && block.data.url.length > 0;
    case "quiz":
      return Boolean(block.quiz_id);
    case "assignment":
      return Boolean(block.assignment_id);
    case "live_session":
      return Boolean(block.live_session_id);
    case "recording":
      return Boolean(block.data.meeting_recording_id || block.data.video_asset_id);
    case "resource_collection":
      return true;
    default:
      return Boolean(block.media_file_id);
  }
}
