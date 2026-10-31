import { NextResponse } from "next/server";
import { listActiveDecisions } from "@/lib/db";
import { extractMeeting } from "@/lib/extract";
import { judgementsToConflicts, judgeDecisions } from "@/lib/judge";
import { LlmError } from "@/lib/llm";
import { ExtractRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" ");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const extracted = await extractMeeting(parsed.data);
    const past = listActiveDecisions();
    const judgements = await judgeDecisions(past, extracted.decisions);
    const conflicts = judgementsToConflicts(extracted.decisions, past, judgements);

    return NextResponse.json({
      ...extracted,
      judgements,
      conflicts,
      past_decision_count: past.length,
    });
  } catch (error) {
    if (error instanceof LlmError) {
      return NextResponse.json(
        { error: error.message, details: error.details ?? null },
        { status: 502 },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown extraction error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
