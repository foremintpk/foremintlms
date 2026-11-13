import { describe, expect, it } from "vitest";
import { parseYouTubeId, youTubeThumbnail } from "@/lib/services/video/youtube-id";
import {
  bunnyEmbedToken,
  bunnyEmbedUrl,
  bunnyTusSignature,
  mapBunnyStatus,
  verifyBunnyWebhookSignature,
} from "@/lib/services/video/bunny-sign";

describe("parseYouTubeId", () => {
  it.each([
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("extracts the ID from %s", (input, expected) => {
    expect(parseYouTubeId(input)).toBe(expected);
  });

  it.each([
    "",
    "not a url",
    "https://vimeo.com/123456",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/channel/UC123",
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "dQw4w9WgXc", // 10 chars
  ])("rejects %s", (input) => {
    expect(parseYouTubeId(input)).toBeNull();
  });

  it("builds a thumbnail URL on i.ytimg.com", () => {
    expect(youTubeThumbnail("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});

describe("Bunny Stream signing", () => {
  it("signs TUS uploads as SHA256(library_id + api_key + expiration + video_id)", () => {
    expect(bunnyTusSignature("12345", "apikey-abc", 1767225600, "0b6c1a2e-0000-4000-8000-000000000001")).toBe(
      "fc39fdf4d2c1b8366b09874f5e815e6140ef30a0fc3e865e917c8cc402bad400",
    );
  });

  it("signs embeds as SHA256(token_key + video_id + expires)", () => {
    expect(bunnyEmbedToken("token-key-xyz", "eb1c4f77-0cda-46be-b47d-1118ad7c2ffe", 1456761770)).toBe(
      "f7b7c99393bcbe4ebac403df5680a4c981d2386a38501325bb0929141cd71fc7",
    );
  });

  it("builds a token-authenticated embed URL with expiry and start time", () => {
    const url = new URL(
      bunnyEmbedUrl({ libraryId: "759", videoId: "eb1c4f77-0cda-46be-b47d-1118ad7c2ffe", tokenKey: "token-key-xyz", expiresAt: 1456761770, startSeconds: 95.7 }),
    );
    expect(url.origin + url.pathname).toBe("https://player.mediadelivery.net/embed/759/eb1c4f77-0cda-46be-b47d-1118ad7c2ffe");
    expect(url.searchParams.get("token")).toBe("f7b7c99393bcbe4ebac403df5680a4c981d2386a38501325bb0929141cd71fc7");
    expect(url.searchParams.get("expires")).toBe("1456761770");
    expect(url.searchParams.get("t")).toBe("95");
  });

  it("omits the token when token authentication is not configured", () => {
    const url = new URL(bunnyEmbedUrl({ libraryId: "759", videoId: "abc" }));
    expect(url.searchParams.has("token")).toBe(false);
    expect(url.searchParams.has("t")).toBe(false);
  });

  it("verifies webhook HMAC signatures and rejects tampering", () => {
    const body = '{"VideoLibraryId":133,"VideoGuid":"abc","Status":3}';
    const sig = "96a0530cb84a9d963c38991ee190a1bafb4c398e1e48c489b98f35ec0cc46e89";
    expect(verifyBunnyWebhookSignature(body, sig, "readonly-key")).toBe(true);
    expect(verifyBunnyWebhookSignature(body, sig.toUpperCase(), "readonly-key")).toBe(true);
    expect(verifyBunnyWebhookSignature(body.replace("3}", "4}"), sig, "readonly-key")).toBe(false);
    expect(verifyBunnyWebhookSignature(body, sig, "other-key")).toBe(false);
    expect(verifyBunnyWebhookSignature(body, null, "readonly-key")).toBe(false);
    expect(verifyBunnyWebhookSignature(body, "not-hex", "readonly-key")).toBe(false);
  });

  it("maps Bunny video status codes", () => {
    expect(mapBunnyStatus(0)).toBe("waiting");
    expect([1, 2, 3, 7, 8].map(mapBunnyStatus)).toEqual(Array(5).fill("processing"));
    expect(mapBunnyStatus(4)).toBe("ready");
    expect(mapBunnyStatus(5)).toBe("errored");
    expect(mapBunnyStatus(6)).toBe("errored");
  });
});
