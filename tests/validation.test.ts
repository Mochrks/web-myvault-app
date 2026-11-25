import { describe, expect, it } from "vitest";
import {
  createFolderSchema,
  createNoteSchema,
  validateSafeEntryName,
  vaultMetadataIndexSchema,
} from "@/lib/validation/vault";

describe("entry name validation", () => {
  it("accepts clean folder and file names", () => {
    expect(validateSafeEntryName("  Architecture Notes.md  ")).toEqual({
      valid: true,
      name: "Architecture Notes.md",
    });
  });

  it("blocks empty, traversal, and forbidden characters", () => {
    expect(validateSafeEntryName("   ").valid).toBe(false);
    expect(validateSafeEntryName("..").valid).toBe(false);
    expect(validateSafeEntryName("../secret").valid).toBe(false);
    expect(validateSafeEntryName("foo/bar").valid).toBe(false);
    expect(validateSafeEntryName("foo\\bar").valid).toBe(false);
    expect(validateSafeEntryName("bad:name").valid).toBe(false);
    expect(validateSafeEntryName("a".repeat(181)).valid).toBe(false);
  });
});

describe("zod vault schemas", () => {
  it("validates folder and note creation payloads", () => {
    expect(
      createFolderSchema.safeParse({ name: "Projects", parentId: null }).success
    ).toBe(true);

    expect(
      createNoteSchema.safeParse({
        name: "readme.md",
        folderId: null,
        content: "# Hello",
      }).success
    ).toBe(true);
  });

  it("validates vault metadata index structure", () => {
    const now = new Date().toISOString();
    const parsed = vaultMetadataIndexSchema.safeParse({
      schemaVersion: 1,
      revision: 0,
      updatedAt: now,
      folders: [],
      files: [],
    });
    expect(parsed.success).toBe(true);
  });
});
