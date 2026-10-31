"use client";

import { useEffect, useState } from "react";
import type { Task, TaskColumn } from "@/lib/types";

const COLUMNS: { id: TaskColumn; title: string }[] = [
  { id: "todo", title: "To do" },
  { id: "in_progress", title: "In progress" },
  { id: "done", title: "Done" },
];

export function Board() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/tasks");
    const data = (await response.json()) as { tasks?: Task[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Could not load tasks.");
    setTasks(data.tasks ?? []);
  }

  useEffect(() => {
    refresh()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load tasks."))
      .finally(() => setLoading(false));
  }, []);

  async function move(id: number, column: TaskColumn) {
    setError(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, column }),
      });
      const data = (await response.json()) as { tasks?: Task[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not move task.");
      setTasks(data.tasks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move task.");
    }
  }

  if (loading) return <p className="text-sm text-stone-500">Loading board…</p>;

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((column) => (
          <section key={column.id} className="rounded-2xl border border-stone-200 bg-[var(--card)] p-4 shadow-sm">
            <h2 className="font-semibold">{column.title}</h2>
            <ul className="mt-3 space-y-3">
              {tasks
                .filter((task) => task.column === column.id)
                .map((task) => (
                  <li key={task.id} className="rounded-lg border border-stone-200 p-3 text-sm">
                    <p className="font-medium">{task.description}</p>
                    <p className="mt-1 text-stone-500">
                      {task.owner ?? "no owner"} · {task.deadline ?? "no deadline"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {COLUMNS.filter((item) => item.id !== column.id).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => move(task.id, item.id)}
                          className="rounded border border-stone-300 px-2 py-1 text-xs"
                        >
                          Move to {item.title}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
            </ul>
            {tasks.filter((task) => task.column === column.id).length === 0 ? (
              <p className="mt-3 text-sm text-stone-500">No cards.</p>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
