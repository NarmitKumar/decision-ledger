"use client";

import { useEffect, useState } from "react";
import { SimulateWeekButton } from "@/components/SimulateWeekButton";
import type { ReminderTask } from "@/lib/types";

export function Reminders() {
  const [appDate, setAppDate] = useState("");
  const [items, setItems] = useState<ReminderTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/reminders");
    const data = (await response.json()) as { appDate?: string; items?: ReminderTask[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Could not load reminders.");
    setAppDate(data.appDate ?? "");
    setItems(data.items ?? []);
  }

  useEffect(() => {
    refresh()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load reminders."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-stone-500">Loading reminders…</p>;

  return (
    <div className="space-y-4">
      <SimulateWeekButton
        appDate={appDate}
        onDate={() => {
          refresh().catch((err: unknown) =>
            setError(err instanceof Error ? err.message : "Could not load reminders."),
          );
        }}
      />
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}
      {items.length === 0 ? (
        <p className="text-sm text-stone-500">Nothing due within 48 hours.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-stone-200 bg-[var(--card)] p-4 shadow-sm">
              <p className="font-medium">{item.description}</p>
              <p className="mt-1 text-sm text-stone-600">
                {item.owner ?? "no owner"} · due {item.deadline} · {item.overdue ? "overdue" : "due soon"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
