import { describe, expect, it } from "vitest";
import { isAllowedEmbedUrl, normalizeEmbedUrl } from "@/lib/services/courses/embeds";
import { blockDataSchemas, defaultBlockData, isBlockComplete, BLOCK_TYPES } from "@/lib/validation/course-blocks";

describe("normalizeEmbedUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0"],
    ["https://vimeo.com/76979871", "vimeo", "https://player.vimeo.com/video/76979871"],
    ["https://vimeo.com/76979871/abc123def", "vimeo", "https://player.vimeo.com/video/76979871?h=abc123def"],
    ["https://player.vimeo.com/video/76979871?h=abc", "vimeo", "https://player.vimeo.com/video/76979871?h=abc"],
    ["https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184", "loom", "https://www.loom.com/embed/0281766fa2d04bb788eaf19e65135184"],
    ["https://docs.google.com/document/d/1AbC_dEf-123/edit?usp=sharing", "google_docs", "https://docs.google.com/document/d/1AbC_dEf-123/preview"],
    [
      "https://docs.google.com/presentation/d/1AbC/edit#slide=id.p",
      "google_slides",
      "https://docs.google.com/presentation/d/1AbC/embed?start=false&loop=false",
    ],
    ["https://docs.google.com/spreadsheets/d/1AbC/edit", "google_sheets", "https://docs.google.com/spreadsheets/d/1AbC/preview"],
    ["https://docs.google.com/forms/d/e/1FAIpQL/viewform", "google_forms", "https://docs.google.com/forms/d/e/1FAIpQL/viewform?embedded=true"],
    ["https://drive.google.com/file/d/1AbC/view?usp=sharing", "google_drive", "https://drive.google.com/file/d/1AbC/preview"],
    ["https://codepen.io/someone/pen/abcXYZ", "codepen", "https://codepen.io/someone/embed/abcXYZ?default-tab=result"],
    ["https://miro.com/app/board/uXjVO1abc=/", "miro", "https://miro.com/app/live-embed/uXjVO1abc=/"],
  ])("converts %s", (input, provider, embedUrl) => {
    expect(normalizeEmbedUrl(input)).toEqual({ provider, embedUrl });
  });

  it("builds a Figma embed URL that wraps the original link", () => {
    const result = normalizeEmbedUrl("https://www.figma.com/design/AbCdEf123/My-file?node-id=1-2");
    expect(result?.provider).toBe("figma");
    expect(result?.embedUrl.startsWith("https://www.figma.com/embed?embed_host=foremint&url=")).toBe(true);
  });

  it.each([
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ", // not https
    "https://evil.example.com/embed",
    "javascript:alert(1)",
    "https://docs.google.com/document/u/0/",
    "https://vimeo.com/channels/staffpicks",
    "https://www.figma.com/community/file/123",
    "not a url",
  ])("rejects %s", (input) => {
    expect(normalizeEmbedUrl(input)).toBeNull();
  });

  it("only allows embed hosts we generate", () => {
    expect(isAllowedEmbedUrl("https://player.vimeo.com/video/1")).toBe(true);
    expect(isAllowedEmbedUrl("https://vimeo.com/1")).toBe(false);
    expect(isAllowedEmbedUrl("http://player.vimeo.com/video/1")).toBe(false);
  });
});

describe("content block schemas", () => {
  it("provides a schema and label for every block type", () => {
    for (const type of BLOCK_TYPES) expect(blockDataSchemas[type]).toBeDefined();
  });

  it("stores the normalised embed URL and rejects unsupported sites", () => {
    const ok = blockDataSchemas.embed.safeParse({ url: "https://youtu.be/dQw4w9WgXcQ", aspect: "16:9" });
    expect(ok.success && ok.data.embed_url).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(blockDataSchemas.embed.safeParse({ url: "https://example.com" }).success).toBe(false);
  });

  it("requires https for link blocks", () => {
    expect(blockDataSchemas.link.safeParse({ url: "http://example.com", label: "x" }).success).toBe(false);
    expect(blockDataSchemas.link.safeParse({ url: "https://example.com", label: "Example" }).success).toBe(true);
  });

  it("requires a recording choice that matches the source", () => {
    expect(blockDataSchemas.recording.safeParse({ source: "meeting_recording" }).success).toBe(false);
    expect(
      blockDataSchemas.recording.safeParse({ source: "video_asset", video_asset_id: "6b0d9f6e-9a3c-4f3d-9a51-6a9f8e3f2c11" }).success,
    ).toBe(true);
  });

  it("caps playlists at 50 videos", () => {
    const ids = Array.from({ length: 51 }, (_, i) => `6b0d9f6e-9a3c-4f3d-9a51-${String(i).padStart(12, "0")}`);
    expect(blockDataSchemas.video_playlist.safeParse({ video_asset_ids: ids }).success).toBe(false);
  });

  it("reports completeness per block type", () => {
    const base = { video_asset_id: null, media_file_id: null, quiz_id: null, assignment_id: null, live_session_id: null };
    expect(isBlockComplete({ ...base, block_type: "video", data: {} })).toBe(false);
    expect(isBlockComplete({ ...base, block_type: "video", data: {}, video_asset_id: "x" })).toBe(true);
    expect(isBlockComplete({ ...base, block_type: "rich_text", data: { html: "<p> </p>" } })).toBe(false);
    expect(isBlockComplete({ ...base, block_type: "rich_text", data: { html: "<p>Hello</p>" } })).toBe(true);
    expect(isBlockComplete({ ...base, block_type: "pdf", data: defaultBlockData("pdf") })).toBe(false);
    expect(isBlockComplete({ ...base, block_type: "resource_collection", data: {} })).toBe(true);
  });
});
