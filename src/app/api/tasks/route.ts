import { NextResponse } from "next/server";
import { listTasks, moveTask } from "@/lib/db";
import { MoveTaskSchema } from "@/lib/schemas";

export async function GET() {
  try {
    return NextResponse.json({ tasks: listTasks() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load tasks.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = MoveTaskSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" ");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    return NextResponse.json({ tasks: moveTask(parsed.data.id, parsed.data.column) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not move task.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
