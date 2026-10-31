import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/db";

export async function POST() {
  try {
    return NextResponse.json({ ok: true, ...seedDemoData() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load demo data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
