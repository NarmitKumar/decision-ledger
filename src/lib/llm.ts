import type Anthropic from "@anthropic-ai/sdk";

export class LlmError extends Error {
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "LlmError";
    this.details = details;
  }
}

type Block = { type: string; text?: string; id?: string; name?: string; input?: unknown };
type ShimMessage = { content: Block[]; stop_reason: string | null };

export function getModel() {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) =>
        b && typeof b === "object" && "text" in b ? String((b as { text: unknown }).text) : "",
      )
      .join("\n");
  }
  return "";
}

function stripSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(stripSchema);
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
      if (k === "$schema") continue;
      out[k] = stripSchema(v);
    }
    return out;
  }
  return schema;
}

// Same name as before so the rest of the app doesn't change, but it now calls Gemini.
export function getAnthropicClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new LlmError("GEMINI_API_KEY is not set. Add it to a .env file.");
  }

  return {
    messages: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async create(params: any): Promise<ShimMessage> {
        const model = getModel();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tools: any[] = params.tools ?? [];

        const body: Record<string, unknown> = {
          contents: (params.messages ?? []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (m: any) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: textOf(m.content) }],
            }),
          ),
          generationConfig: {
            temperature: 0,
            maxOutputTokens: Math.max(params.max_tokens ?? 0, 8192),
          },
        };

        if (params.system) {
          body.systemInstruction = { parts: [{ text: textOf(params.system) }] };
        }

        if (tools.length > 0) {
          body.tools = [
            {
              functionDeclarations: tools.map((t) => ({
                name: t.name,
                description: t.description ?? "",
                parametersJsonSchema: stripSchema(t.input_schema),
              })),
            },
          ];
          body.toolConfig = {
            functionCallingConfig: {
              mode: "ANY",
              allowedFunctionNames: tools.map((t) => t.name),
            },
          };
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        let res: Response | undefined;
        for (let attempt = 0; attempt < 2; attempt++) {
          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify(body),
          });
          if (res.status !== 429 && res.status !== 503) break;
          await new Promise((r) => setTimeout(r, 1500));
        }

        if (!res || !res.ok) {
          const detail = res ? await res.text() : "no response";
          throw new LlmError(`Gemini error ${res?.status ?? ""}: ${detail.slice(0, 500)}`);
        }

        const data = await res.json();
        const candidate = data?.candidates?.[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts: any[] = candidate?.content?.parts ?? [];
        const content: Block[] = [];

        for (const part of parts) {
          if (part.functionCall) {
            content.push({
              type: "tool_use",
              id: "toolu_gemini",
              name: part.functionCall.name,
              input: part.functionCall.args ?? {},
            });
          } else if (typeof part.text === "string") {
            content.push({ type: "text", text: part.text });
          }
        }

        return { content, stop_reason: candidate?.finishReason ?? null };
      },
    },
  };
}

export function toolInputFromMessage(
  message: { content: { type: string; input?: unknown }[]; stop_reason?: string | null },
  label: string,
): unknown {
  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse) {
    throw new LlmError(
      `The model did not return structured JSON for ${label}. Try again, or check the API key and model name.`,
      { stop_reason: message.stop_reason, content_types: message.content.map((b) => b.type) },
    );
  }
  return toolUse.input;
}

export function formatZodError(error: {
  issues: { path: PropertyKey[]; message: string }[];
}) {
  return error.issues
    .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}