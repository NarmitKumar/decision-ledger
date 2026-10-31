import { NextResponse } from "next/server";
import { clearMemory, listMemorySummary, saveApprovedMeeting } from "@/lib/db";
import { ApproveRequestSchema } from "@/lib/schemas";

export async function GET() {
  return NextResponse.json(listMemorySummary());
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = ApproveRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" ");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (parsed.data.decisions.length === 0 && parsed.data.action_items.length === 0) {
    return NextResponse.json(
      { error: "Approve at least one decision or action item before posting." },
      { status: 400 },
    );
  }

  const saved = saveApprovedMeeting({
    title: parsed.data.title,
    meetingDate: parsed.data.meetingDate,
    transcript: parsed.data.transcript,
    decisions: parsed.data.decisions,
    actionItems: parsed.data.action_items,
    conflicts: parsed.data.conflicts.map((c) => ({
      newDecisionIndex: c.new_decision_index,
      oldDecisionId: c.old_decision_id,
      type: c.type,
      explanation: c.explanation,
    })),
  });

  return NextResponse.json({
    ok: true,
    meetingId: saved.meetingId,
    memory: listMemorySummary(),
  });
}

export async function DELETE() {
  clearMemory();
  return NextResponse.json({ ok: true, memory: listMemorySummary() });
}
