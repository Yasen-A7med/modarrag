import { describe, expect, it } from "vitest";
import {
  formatFileSizeAr,
  isSupportedLectureVideoMime,
  resolveExternalVideoEmbed,
  sanitizeStorageFileExtension,
} from "@/lib/lecture-media";

describe("lecture-media security and URL helpers", () => {
  it("converts YouTube watch, short, and share URLs into privacy-enhanced embeds", () => {
    expect(resolveExternalVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      kind: "iframe",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    });

    expect(resolveExternalVideoEmbed("https://youtu.be/dQw4w9WgXcQ?si=abc")).toEqual({
      kind: "iframe",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    });

    expect(resolveExternalVideoEmbed("https://youtube.com/shorts/abc123_XYZ")).toEqual({
      kind: "iframe",
      src: "https://www.youtube-nocookie.com/embed/abc123_XYZ?rel=0",
    });
  });

  it("converts Vimeo and Google Drive share links cleanly", () => {
    expect(resolveExternalVideoEmbed("https://vimeo.com/76979871")).toEqual({
      kind: "iframe",
      src: "https://player.vimeo.com/video/76979871",
    });

    expect(
      resolveExternalVideoEmbed("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQr/view?usp=sharing")
    ).toEqual({
      kind: "iframe",
      src: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQr/preview",
    });
  });

  it("rejects non-HTTPS, javascript, and arbitrary external links", () => {
    expect(resolveExternalVideoEmbed("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(resolveExternalVideoEmbed("javascript:alert(1)")).toBeNull();
    expect(resolveExternalVideoEmbed("https://evil.example.com/phish")).toBeNull();
  });

  it("validates supported MIME types and sanitizes extensions", () => {
    expect(isSupportedLectureVideoMime("video/mp4")).toBe(true);
    expect(isSupportedLectureVideoMime("video/webm")).toBe(true);
    expect(isSupportedLectureVideoMime("application/x-msdownload")).toBe(false);

    expect(sanitizeStorageFileExtension("المحاضرة 1.webm", "video/webm")).toBe("webm");
    expect(sanitizeStorageFileExtension("../../evil.exe", "video/mp4")).toBe("mp4");
  });

  it("formats Arabic file sizes cleanly", () => {
    expect(formatFileSizeAr(512 * 1024)).toContain("ك.ب");
    expect(formatFileSizeAr(12 * 1024 * 1024)).toContain("م.ب");
  });
});
