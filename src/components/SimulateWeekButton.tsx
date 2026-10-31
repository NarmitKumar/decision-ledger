"use client";

import { useState } from "react";

export function SimulateWeekButton({ appDate, onDate }: { appDate: string; onDate: (next: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/clock", { method: "POST" });
      const data = (await response.json()) as { appDate?: string; error?: string };
      if (!response.ok || !data.appDate) throw new Error(data.error || "Could not advance the date.");
      onDate(data.appDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not advance the date.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-stone-600">App date: {appDate}</p>
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {loading ? "Advancing…" : "Simulate next week"}
      </button>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
