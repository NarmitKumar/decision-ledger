import { NextResponse } from "next/server";
import { getAppDate, listDigest, listPeople } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const person = new URL(request.url).searchParams.get("person")?.trim() ?? "";
    if (!person) {
      return NextResponse.json({
        appDate: getAppDate(),
        people: listPeople(),
        person: "",
        openTasks: [],
        dueThisWeek: [],
        decisions: [],
      });
    }
    return NextResponse.json(listDigest(person));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load digest.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
