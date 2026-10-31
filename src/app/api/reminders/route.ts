import { NextResponse } from "next/server";
import { listReminders } from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json(listReminders());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load reminders.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
