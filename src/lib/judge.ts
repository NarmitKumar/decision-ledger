import Anthropic from "@anthropic-ai/sdk";
import type { ActiveDecision } from "./types";
import {
  formatZodError,
  getAnthropicClient,
  getModel,
  LlmError,
  toolInputFromMessage,
} from "./llm";
import {
  JudgeResultSchema,
  type ConflictView,
  type Decision,
  type Judgement,
} from "./schemas";

const TOOL_NAME = "save_judgements";

const judgeTool: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "Record whether each new decision conflicts with an earlier active decision.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      judgements: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            new_decision_index: {
              type: "integer",
              description: "Index of the new decision in the provided list (0-based).",
            },
            verdict: { type: "string", enum: ["consistent", "conflict"] },
            conflict_type: {
              type: ["string", "null"],
              enum: ["reversal", "deadline", "budget", "owner", "other", null],
            },
            old_decision_id: {
              type: ["integer", "null"],
              description: "id of the conflicting past decision, or null if consistent.",
            },
            explanation: {
              type: ["string", "null"],
              description:
                "One sentence citing the earlier meeting by title and date, or null if consistent.",
            },
          },
          required: [
            "new_decision_index",
            "verdict",
            "conflict_type",
            "old_decision_id",
            "explanation",
          ],
        },
      },
    },
    required: ["judgements"],
  },
};

const SYSTEM = `You are a careful judge of meeting decisions.

Compare each NEW decision against ACTIVE past decisions.

A conflict means the new decision cannot both be true with an older one: reversal of a prior call, a different deadline, a different budget, or a different owner for the same work. Similar topics that can coexist are consistent.

Rules:
- Return one judgement per new decision.
- If consistent: conflict_type, old_decision_id, and explanation must be null.
- If conflict: set type (reversal | deadline | budget | owner | other), the id of the single most relevant old decision, and a one-sentence explanation that cites that earlier meeting by title and date.
- Never invent an old decision id. Only use ids from the past-decision list.
- Do not mark something a conflict just because the topic is related.`;

async function callModel(
  client: Anthropic,
  past: ActiveDecision[],
  next: Decision[],
  retryHint?: string,
): Promise<unknown> {
  const payload = {
    past_decisions: past.map((d) => ({
      id: d.id,
      meeting_title: d.meeting_title,
      meeting_date: d.meeting_date,
      text: d.text,
    })),
    new_decisions: next.map((d, index) => ({
      index,
      text: d.text,
      topic: d.topic,
    })),
  };

  const message = await client.messages.create({
    model: getModel(),
    max_tokens: 4096,
    system: SYSTEM,
    tools: [judgeTool],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `${JSON.stringify(payload, null, 2)}${retryHint ? `\n\nCorrection required:\n${retryHint}` : ""}`,
      },
    ],
  });

  return toolInputFromMessage(message, "conflict judgement");
}

function completenessError(
  judgements: Judgement[],
  past: ActiveDecision[],
  next: Decision[],
): string | null {
  const seen = new Set(judgements.map((j) => j.new_decision_index));
  for (let i = 0; i < next.length; i += 1) {
    if (!seen.has(i)) return `Missing judgement for new_decision_index ${i}.`;
  }
  const pastIds = new Set(past.map((d) => d.id));
  for (const judgement of judgements) {
    if (judgement.old_decision_id != null && !pastIds.has(judgement.old_decision_id)) {
      return `old_decision_id ${judgement.old_decision_id} is not in the past-decision list.`;
    }
  }
  return null;
}

export async function judgeDecisions(
  past: ActiveDecision[],
  next: Decision[],
): Promise<Judgement[]> {
  if (next.length === 0) return [];
  if (past.length === 0) {
    return next.map((_, index) => ({
      new_decision_index: index,
      verdict: "consistent" as const,
      conflict_type: null,
      old_decision_id: null,
      explanation: null,
    }));
  }

  const client = getAnthropicClient();
  const first = await callModel(client, past, next);
  const firstParsed = JudgeResultSchema.safeParse(first);
  const firstIssue = firstParsed.success
    ? completenessError(firstParsed.data.judgements, past, next)
    : formatZodError(firstParsed.error);
  if (firstParsed.success && !firstIssue) {
    return firstParsed.data.judgements;
  }

  const hint = `Your previous tool input failed: ${firstIssue}. Return one judgement per new decision. Use only past decision ids from the list.`;
  const second = await callModel(client, past, next, hint);
  const secondParsed = JudgeResultSchema.safeParse(second);
  const secondIssue = secondParsed.success
    ? completenessError(secondParsed.data.judgements, past, next)
    : formatZodError(secondParsed.error);
  if (secondParsed.success && !secondIssue) {
    return secondParsed.data.judgements;
  }

  throw new LlmError(`The model returned invalid conflict JSON after a retry. ${secondIssue}`, {
    first: firstParsed.success ? firstIssue : firstParsed.error.flatten(),
    second: secondParsed.success ? secondIssue : secondParsed.error.flatten(),
  });
}

export function judgementsToConflicts(
  next: Decision[],
  past: ActiveDecision[],
  judgements: Judgement[],
): ConflictView[] {
  const pastById = new Map(past.map((d) => [d.id, d]));
  const conflicts: ConflictView[] = [];

  for (const judgement of judgements) {
    if (judgement.verdict !== "conflict" || judgement.old_decision_id == null) continue;
    const old = pastById.get(judgement.old_decision_id);
    const current = next[judgement.new_decision_index];
    if (!old || !current || !judgement.conflict_type || !judgement.explanation) {
      throw new LlmError(
        "A conflict judgement pointed at an unknown decision id or missing fields. Nothing was saved.",
        judgement,
      );
    }
    conflicts.push({
      new_decision_index: judgement.new_decision_index,
      new_text: current.text,
      old_decision_id: old.id,
      old_text: old.text,
      old_meeting_title: old.meeting_title,
      old_meeting_date: old.meeting_date,
      type: judgement.conflict_type,
      explanation: judgement.explanation,
    });
  }

  return conflicts;
}
