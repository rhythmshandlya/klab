import { z } from "zod";

const MAX_FILES = 50;
const MAX_FILE_BYTES = 200_000;
const MAX_PLAYGROUND_BYTES = 750_000;

const filesSchema = z
  .record(z.string().trim().min(1).max(260), z.string().max(MAX_FILE_BYTES))
  .superRefine((files, context) => {
    const entries = Object.entries(files);
    if (entries.length > MAX_FILES) {
      context.addIssue({
        code: "custom",
        message: `A playground may contain at most ${MAX_FILES} files.`,
      });
    }
    const totalBytes = entries.reduce(
      (total, [path, contents]) => total + path.length + contents.length,
      0,
    );
    if (totalBytes > MAX_PLAYGROUND_BYTES) {
      context.addIssue({ code: "custom", message: "Playground files are too large." });
    }
  });

export const savedPlaygroundSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(100),
    templateId: z.string().trim().min(1).max(120),
    files: filesSchema,
    description: z.string().max(500).default(""),
    starred: z.boolean().default(false),
    visibility: z.enum(["private", "link"]).default("private"),
    activeFilePath: z.string().max(260).default(""),
    createdAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    updatedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    lastOpenedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .transform((playground) => ({
    ...playground,
    lastOpenedAt: playground.lastOpenedAt ?? playground.updatedAt,
  }));

export type SavedPlayground = z.infer<typeof savedPlaygroundSchema>;

const playgroundDraftSchema = z.object({
  clientId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(100),
  templateId: z.string().trim().min(1).max(120),
  files: filesSchema,
  description: z.string().max(500).default(""),
  starred: z.boolean().default(false),
  visibility: z.enum(["private", "link"]).default("private"),
  activeFilePath: z.string().max(260).default(""),
  createdAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  updatedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  lastOpenedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});

export type PlaygroundDraft = z.infer<typeof playgroundDraftSchema>;

const updatePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    files: filesSchema.optional(),
    description: z.string().max(500).optional(),
    starred: z.boolean().optional(),
    visibility: z.enum(["private", "link"]).optional(),
    activeFilePath: z.string().max(260).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "At least one playground field must be updated.",
  });

export type PlaygroundPatch = z.infer<typeof updatePatchSchema>;

export const playgroundMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("merge"),
    playgrounds: z.array(savedPlaygroundSchema).max(100),
  }),
  z.object({ action: z.literal("create"), playground: playgroundDraftSchema }),
  z.object({ action: z.literal("update"), id: z.uuid(), patch: updatePatchSchema }),
  z.object({ action: z.literal("open"), id: z.uuid() }),
  z.object({
    action: z.literal("duplicate"),
    id: z.uuid(),
    clientId: z.string().trim().min(1).max(128),
  }),
  z.object({ action: z.literal("delete"), id: z.uuid() }),
]);

export type PlaygroundMutation = z.infer<typeof playgroundMutationSchema>;

const playgroundsResponseSchema = z.object({
  playgrounds: z.array(savedPlaygroundSchema).optional(),
  playground: savedPlaygroundSchema.optional(),
  deletedId: z.string().optional(),
  claimedIds: z.record(z.string(), z.string()).optional(),
});

export function parsePlaygroundsResponse(value: unknown) {
  return playgroundsResponseSchema.parse(value);
}

// Compatibility aliases for the previous Labs naming and stored browser records.
export const savedLabSchema = savedPlaygroundSchema;
export type SavedLab = SavedPlayground;
export type LabDraft = PlaygroundDraft;
