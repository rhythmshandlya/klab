import { z } from "zod";

const MAX_FILES = 50;
const MAX_FILE_BYTES = 200_000;
const MAX_LAB_BYTES = 750_000;

const filesSchema = z
  .record(z.string().trim().min(1).max(260), z.string().max(MAX_FILE_BYTES))
  .superRefine((files, context) => {
    const entries = Object.entries(files);
    if (entries.length > MAX_FILES) {
      context.addIssue({
        code: "custom",
        message: `A lab may contain at most ${MAX_FILES} files.`,
      });
    }
    const totalBytes = entries.reduce(
      (total, [path, contents]) => total + path.length + contents.length,
      0,
    );
    if (totalBytes > MAX_LAB_BYTES) {
      context.addIssue({ code: "custom", message: "Lab files are too large." });
    }
  });

export const savedLabSchema = z.object({
  id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(100),
  templateId: z.string().trim().min(1).max(120),
  files: filesSchema,
  createdAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  updatedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});

export type SavedLab = z.infer<typeof savedLabSchema>;

const labDraftSchema = savedLabSchema.omit({ id: true }).extend({
  clientId: z.string().trim().min(1).max(128),
});

export type LabDraft = z.infer<typeof labDraftSchema>;

const updatePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    files: filesSchema.optional(),
  })
  .refine((patch) => patch.name !== undefined || patch.files !== undefined, {
    message: "At least one lab field must be updated.",
  });

export const labMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("merge"), labs: z.array(savedLabSchema).max(100) }),
  z.object({ action: z.literal("create"), lab: labDraftSchema }),
  z.object({
    action: z.literal("update"),
    id: z.uuid(),
    patch: updatePatchSchema,
  }),
  z.object({ action: z.literal("delete"), id: z.uuid() }),
]);

export type LabMutation = z.infer<typeof labMutationSchema>;

const labsResponseSchema = z.object({
  labs: z.array(savedLabSchema),
  mutationId: z.string().optional(),
});

export function parseLabsResponse(value: unknown): { labs: SavedLab[]; mutationId?: string } {
  return labsResponseSchema.parse(value);
}
