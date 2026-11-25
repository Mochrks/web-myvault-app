import { z } from "zod";

const INVALID_NAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/;

/**
 * Validates single folder/file entry names and blocks path traversal or OS-unsafe characters.
 */
export function validateSafeEntryName(raw: string): { valid: true; name: string } | { valid: false; message: string } {
  const name = raw.trim();
  if (!name) {
    return { valid: false, message: "Name cannot be empty." };
  }
  if (name.length > 180) {
    return { valid: false, message: "Name must be 180 characters or fewer." };
  }
  if (name === "." || name === ".." || name.includes("..")) {
    return { valid: false, message: "Name cannot contain path traversal segments." };
  }
  if (INVALID_NAME_CHARS.test(name)) {
    return {
      valid: false,
      message: "Name contains forbidden characters (/ \\ : * ? \" < > |).",
    };
  }
  return { valid: true, name };
}

export const safeEntryNameSchema = z
  .string()
  .transform((val) => val.trim())
  .superRefine((val, ctx) => {
    const check = validateSafeEntryName(val);
    if (!check.valid) {
      ctx.addIssue({
        code: "custom",
        message: check.message,
      });
    }
  });

export const loginSchema = z.object({
  password: z.string().min(1, "Password is required.").max(512, "Password is too long."),
});

export const createFolderSchema = z.object({
  name: safeEntryNameSchema,
  parentId: z.string().uuid().nullable().default(null),
});

export const renameFolderSchema = z.object({
  name: safeEntryNameSchema,
});

export const copyFolderSchema = z.object({
  targetParentId: z.string().uuid().nullable().default(null),
  newName: safeEntryNameSchema.optional(),
});

export const createNoteSchema = z.object({
  name: safeEntryNameSchema,
  folderId: z.string().uuid().nullable().default(null),
  content: z.string().max(5 * 1024 * 1024, "Note content exceeds 5 MB limit.").default(""),
});

export const registerUploadedFileSchema = z.object({
  name: safeEntryNameSchema,
  folderId: z.string().uuid().nullable().default(null),
  objectKey: z
    .string()
    .regex(
      /^myvault\/objects\/\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "Invalid object key format."
    ),
  mimeType: z.string().max(200).optional(),
});

export const updateFileSchema = z
  .object({
    name: safeEntryNameSchema.optional(),
    content: z.string().max(5 * 1024 * 1024, "Note content exceeds 5 MB limit.").optional(),
  })
  .refine((v) => v.name !== undefined || v.content !== undefined, {
    message: "At least one field (name or content) must be provided.",
  });

export const copyFileSchema = z.object({
  targetFolderId: z.string().uuid().nullable().default(null),
  newName: safeEntryNameSchema.optional(),
});

export const prepareUploadSchema = z.object({
  name: safeEntryNameSchema,
  folderId: z.string().uuid().nullable().default(null),
  size: z.number().int().nonnegative(),
  mimeType: z.string().max(200).optional(),
});

export const vaultFolderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  parentId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const vaultFileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  folderId: z.string().uuid().nullable(),
  objectKey: z.string().min(1),
  mimeType: z.string().min(1),
  extension: z.string(),
  size: z.number().int().nonnegative(),
  kind: z.enum([
    "code",
    "note",
    "text",
    "image",
    "spreadsheet",
    "document",
    "pdf",
    "archive",
    "other",
  ]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const vaultMetadataIndexSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
  folders: z.array(vaultFolderSchema),
  files: z.array(vaultFileSchema),
});
