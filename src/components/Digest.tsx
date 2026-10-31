"use client";

import { useEffect, useState } from "react";
import { SimulateWeekButton } from "@/components/SimulateWeekButton";
import type { ActiveDecision, Task } from "@/lib/types";

type DigestPayload = {
  appDate?: string;
  people?: string[];
  person?: string;
  openTasks?: Task[];
  dueThisWeek?: Task[];
  decisions?: ActiveDecision[];
  error?: string;
};

export function Digest() {
  const [people, setPeople] = useState<string[]>([]);
  const [person, setPerson] = useState("");
  const [appDate, setAppDate] = useState("");
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [dueThisWeek, setDueThisWeek] = useState<Task[]>([]);
  const [decisions, setDecisions] = useState<ActiveDecision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(nextPerson: string) {
    const query = nextPerson ? `?person=${encodeURIComponent(nextPerson)}` : "";
    const response = await fetch(`/api/digest${query}`);
    const data = (await response.json()) as DigestPayload;
    if (!response.ok) throw new Error(data.error || "Could not load digest.");
    setPeople(data.people ?? []);
    setAppDate(data.appDate ?? "");
    setOpenTasks(data.openTasks ?? []);
    setDueThisWeek(data.dueThisWeek ?? []);
    setDecisions(data.decisions ?? []);
    if (!nextPerson && (data.people?.length ?? 0) > 0) {
      setPerson(data.people![0]);
      await load(data.people![0]);
    }
  }

  useEffect(() => {
    load(person)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load digest."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSelect(next: string) {
    setPerson(next);
    setError(null);
    try {
      await load(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load digest.");
    }
  }

  if (loading) return <p className="text-sm text-stone-500">Loading digest…</p>;

  return (
    <div className="space-y-6">
      <SimulateWeekButton
        appDate={appDate}
        onDate={() => {
          load(person).catch((err: unknown) =>
            setError(err instanceof Error ? err.message : "Could not load digest."),
          );
        }}
      />
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}
      {people.length === 0 ? (
        <p className="text-sm text-stone-500">No people yet. Load demo data and post a meeting first.</p>
      ) : (
        <label className="block text-sm">
          <span className="font-medium">Person</span>
          <select
            value={person}
            onChange={(event) => onSelect(event.target.value)}
            className="mt-1 rounded-lg border border-stone-300 bg-white px-3 py-2"
          >
            {people.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}

      {person ? (
        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl border border-stone-200 bg-[var(--card)] p-4 shadow-sm">
            <h2 className="font-semibold">Open tasks</h2>
            <List items={openTasks.map((task) => task.description)} empty="None." />
          </section>
          <section className="rounded-2xl border border-stone-200 bg-[var(--card)] p-4 shadow-sm">
            <h2 className="font-semibold">Due this week</h2>
            <List
              items={dueThisWeek.map((task) => `${task.description} (${task.deadline})`)}
              empty="Nothing due this week."
            />
          </section>
          <section className="rounded-2xl border border-stone-200 bg-[var(--card)] p-4 shadow-sm">
            <h2 className="font-semibold">Decisions that mention them</h2>
            <List items={decisions.map((decision) => decision.text)} empty="No matching decisions." />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="mt-2 text-sm text-stone-500">{empty}</p>;
  return (
    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
