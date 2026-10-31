import { NextResponse } from "next/server";
import { advanceAppDate, getAppDate } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ appDate: getAppDate() });
}

export async function POST() {
  try {
    return NextResponse.json({ appDate: advanceAppDate(7) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not advance the app date.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
