import Anthropic from "@anthropic-ai/sdk";
import {
  formatZodError,
  getAnthropicClient,
  getModel,
  LlmError,
  toolInputFromMessage,
} from "./llm";
import { ExtractResultSchema, type ExtractRequest, type ExtractResult } from "./schemas";

export { LlmError as ExtractError };

const TOOL_NAME = "save_extraction";

const extractionTool: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Save decisions and action items extracted from a meeting transcript. Use null when owner or deadline is not clearly stated.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      decisions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string", description: "The decision in one sentence." },
            topic: { type: "string", description: "Short topic label, e.g. launch date." },
            source_line: {
              type: "string",
              description: "Exact transcript line this came from, copied verbatim.",
            },
          },
          required: ["text", "topic", "source_line"],
        },
      },
      action_items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            description: { type: "string" },
            owner: {
              type: ["string", "null"],
              description: "Person named as owner, or null if none is clear.",
            },
            deadline: {
              type: ["string", "null"],
              description: "ISO date YYYY-MM-DD resolved from the meeting date, or null.",
            },
            source_line: {
              type: "string",
              description: "Exact transcript line this came from, copied verbatim.",
            },
          },
          required: ["description", "owner", "deadline", "source_line"],
        },
      },
    },
    required: ["decisions", "action_items"],
  },
};

function systemPrompt(meetingDate: string) {
  return `You extract decisions and action items from meeting transcripts for Decision Ledger.

Meeting date: ${meetingDate}

Rules:
1. Resolve relative dates ("by Friday", "next week", "end of the month") against the meeting date. Deadlines must be ISO dates (YYYY-MM-DD).
2. Handle self-corrections ("Priya, no wait, Arjun") by using the final version only.
3. Ignore filler words, small talk, and digressions.
4. If there is no clear owner or deadline, return null. Never invent a person or a date.
5. Every decision and action item must include source_line: the exact transcript line it came from, copied verbatim.

Do not fabricate quotes. If nothing was decided or assigned, return empty arrays.`;
}

async function callModel(
  client: Anthropic,
  request: ExtractRequest,
  retryHint?: string,
): Promise<unknown> {
  const userText = [
    `Meeting title: ${request.title}`,
    `Meeting date: ${request.meetingDate}`,
    "",
    "Transcript:",
    request.transcript,
    retryHint ? `\n\nCorrection required:\n${retryHint}` : "",
  ].join("\n");

  const message = await client.messages.create({
    model: getModel(),
    max_tokens: 4096,
    system: systemPrompt(request.meetingDate),
    tools: [extractionTool],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: userText }],
  });

  return toolInputFromMessage(message, "extraction");
}

export async function extractMeeting(request: ExtractRequest): Promise<ExtractResult> {
  const client = getAnthropicClient();

  const first = await callModel(client, request);
  const firstParsed = ExtractResultSchema.safeParse(first);
  if (firstParsed.success) {
    return firstParsed.data;
  }

  const hint = `Your previous tool input failed validation: ${formatZodError(firstParsed.error)}. Call ${TOOL_NAME} again with valid fields. Use null for missing owner or deadline. source_line must be an exact transcript line. deadline must be YYYY-MM-DD or null.`;

  const second = await callModel(client, request, hint);
  const secondParsed = ExtractResultSchema.safeParse(second);
  if (secondParsed.success) {
    return secondParsed.data;
  }

  throw new LlmError(
    `The model returned invalid extraction JSON after a retry. ${formatZodError(secondParsed.error)}`,
    { first: firstParsed.error.flatten(), second: secondParsed.error.flatten() },
  );
}
