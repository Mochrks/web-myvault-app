import { describe, expect, it } from "vitest";
import {
  detectFileKind,
  extractExtension,
  getShikiLanguage,
  isSafeRasterImage,
  isTextReadableFile,
  isUnsafeActiveContent,
} from "@/lib/utils/file-types";

describe("file-types utilities", () => {
  it("extracts extensions cleanly", () => {
    expect(extractExtension("index.tsx")).toBe("tsx");
    expect(extractExtension("README.MD")).toBe("md");
    expect(extractExtension("Dockerfile")).toBe("dockerfile");
  });

  it("classifies file kinds and Shiki languages", () => {
    expect(detectFileKind("app.ts", "text/plain")).toBe("code");
    expect(detectFileKind("notes.md", "text/markdown")).toBe("note");
    expect(detectFileKind("report.pdf", "application/pdf")).toBe("pdf");
    expect(detectFileKind("photo.png", "image/png")).toBe("image");
    expect(detectFileKind("data.csv", "text/csv")).toBe("spreadsheet");
    expect(getShikiLanguage("server.ts")).toBe("typescript");
    expect(getShikiLanguage("query.sql")).toBe("sql");
  });

  it("identifies text-readable, safe raster images, and unsafe active content", () => {
    expect(isTextReadableFile("code", "ts")).toBe(true);
    expect(isTextReadableFile("spreadsheet", "csv")).toBe(true);
    expect(isTextReadableFile("pdf", "pdf")).toBe(false);

    expect(isSafeRasterImage("png")).toBe(true);
    expect(isSafeRasterImage("svg")).toBe(false);

    expect(isUnsafeActiveContent("html", "text/html")).toBe(true);
    expect(isUnsafeActiveContent("svg", "image/svg+xml")).toBe(true);
    expect(isUnsafeActiveContent("md", "text/markdown")).toBe(false);
  });
});
