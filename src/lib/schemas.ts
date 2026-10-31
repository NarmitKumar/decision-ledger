import { z } from "zod";

/** Empty strings from the model become null. Never invent a value. */
const optionalName = z
  .string()
  .nullish()
  .transform((value) => (value && value.trim() ? value : null));

const isoDate = z
  .string()
  .nullish()
  .transform((value) => (value && value.trim() ? value : null))
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "deadline must be YYYY-MM-DD",
  });

export const DecisionSchema = z.object({
  text: z.string().min(1),
  topic: z.string().min(1),
  source_line: z.string().min(1),
});

export const ActionItemSchema = z.object({
  description: z.string().min(1),
  owner: optionalName,
  deadline: isoDate,
  source_line: z.string().min(1),
});

export const ExtractResultSchema = z.object({
  decisions: z.array(DecisionSchema),
  action_items: z.array(ActionItemSchema),
});

export const ExtractRequestSchema = z.object({
  title: z.string().trim().min(1, "Meeting title is required"),
  meetingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Meeting date must be YYYY-MM-DD"),
  transcript: z.string().trim().min(10, "Transcript is too short"),
});

export const ConflictTypeSchema = z.enum(["reversal", "deadline", "budget", "owner", "other"]);

export const JudgementSchema = z
  .object({
    new_decision_index: z.number().int().nonnegative(),
    verdict: z.enum(["consistent", "conflict"]),
    conflict_type: ConflictTypeSchema.nullable(),
    old_decision_id: z.number().int().positive().nullable(),
    explanation: z.string().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.verdict === "conflict") {
      if (!value.conflict_type) {
        ctx.addIssue({ code: "custom", message: "conflict_type is required for a conflict", path: ["conflict_type"] });
      }
      if (value.old_decision_id == null) {
        ctx.addIssue({
          code: "custom",
          message: "old_decision_id is required for a conflict",
          path: ["old_decision_id"],
        });
      }
      if (!value.explanation) {
        ctx.addIssue({ code: "custom", message: "explanation is required for a conflict", path: ["explanation"] });
      }
    }
  });

export const JudgeResultSchema = z.object({
  judgements: z.array(JudgementSchema),
});

export const ConflictViewSchema = z.object({
  new_decision_index: z.number().int().nonnegative(),
  new_text: z.string(),
  old_decision_id: z.number().int().positive(),
  old_text: z.string(),
  old_meeting_title: z.string(),
  old_meeting_date: z.string(),
  type: ConflictTypeSchema,
  explanation: z.string(),
});

export const ApproveRequestSchema = ExtractRequestSchema.extend({
  decisions: z.array(DecisionSchema),
  action_items: z.array(ActionItemSchema),
  conflicts: z.array(ConflictViewSchema),
});

export type Decision = z.infer<typeof DecisionSchema>;
export type ActionItem = z.infer<typeof ActionItemSchema>;
export type ExtractResult = z.infer<typeof ExtractResultSchema>;
export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;
export type Judgement = z.infer<typeof JudgementSchema>;
export type ConflictView = z.infer<typeof ConflictViewSchema>;
export const TaskColumnSchema = z.enum(["todo", "in_progress", "done"]);

export const MoveTaskSchema = z.object({
  id: z.number().int().positive(),
  column: TaskColumnSchema,
});

export type ApproveRequest = z.infer<typeof ApproveRequestSchema>;
export type MoveTaskRequest = z.infer<typeof MoveTaskSchema>;

export type ProcessResult = ExtractResult & {
  judgements: Judgement[];
  conflicts: ConflictView[];
  past_decision_count: number;
};
