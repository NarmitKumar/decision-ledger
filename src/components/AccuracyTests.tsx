"use client";

import { useState } from "react";
import { ACCURACY_CASES, type AccuracyCase } from "@/lib/fixtures";
import type { ExtractResult } from "@/lib/schemas";

type CaseState = {
  loading: boolean;
  error: string | null;
  result: ExtractResult | null;
};

const empty: CaseState = { loading: false, error: null, result: null };

export function AccuracyTests() {
  const [states, setStates] = useState<Record<string, CaseState>>({});
  const [runningAll, setRunningAll] = useState(false);

  function patch(id: string, next: Partial<CaseState>) {
    setStates((prev) => ({ ...prev, [id]: { ...(prev[id] ?? empty), ...next } }));
  }

  async function runCase(testCase: AccuracyCase) {
    patch(testCase.id, { loading: true, error: null, result: null });
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: testCase.title,
          meetingDate: testCase.meetingDate,
          transcript: testCase.transcript,
        }),
      });
      const data = (await response.json()) as ExtractResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      patch(testCase.id, { loading: false, result: data });
    } catch (error) {
      patch(testCase.id, {
        loading: false,
        error: error instanceof Error ? error.message : "Request failed",
      });
    }
  }

  async function runAll() {
    setRunningAll(true);
    for (const testCase of ACCURACY_CASES) {
      await runCase(testCase);
    }
    setRunningAll(false);
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={runAll}
        disabled={runningAll}
        className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {runningAll ? "Running all five…" : "Run all five"}
      </button>

      {ACCURACY_CASES.map((testCase) => {
        const state = states[testCase.id] ?? empty;
        return (
          <article
            key={testCase.id}
            className="rounded-2xl border border-stone-200 bg-[var(--card)] p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{testCase.name}</h2>
                <p className="text-sm text-stone-500">
                  {testCase.title} · {testCase.meetingDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => runCase(testCase)}
                disabled={state.loading || runningAll}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
              >
                {state.loading ? "Extracting…" : "Run this one"}
              </button>
            </div>

            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-xs text-stone-700">
              {testCase.transcript}
            </pre>

            <ul className="mt-4 space-y-1 text-sm">
              {testCase.checks.map((check) => {
                const passed = state.result ? check.pass(state.result) : null;
                return (
                  <li key={check.id} className="flex gap-2">
                    <span className="w-16 shrink-0 font-medium">
                      {passed === null ? "—" : passed ? "PASS" : "FAIL"}
                    </span>
                    <span className={passed === false ? "text-red-800" : "text-stone-700"}>
                      {check.label}
                    </span>
                  </li>
                );
              })}
            </ul>

            {state.error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {state.error}
              </p>
            ) : null}

            {state.result ? (
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <h3 className="font-medium text-stone-500">Decisions</h3>
                  <ul className="mt-1 space-y-1">
                    {state.result.decisions.length === 0 ? <li>None</li> : null}
                    {state.result.decisions.map((d, i) => (
                      <li key={i}>{d.text}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-stone-500">Action items</h3>
                  <ul className="mt-1 space-y-1">
                    {state.result.action_items.length === 0 ? <li>None</li> : null}
                    {state.result.action_items.map((a, i) => (
                      <li key={i}>
                        {a.description} ({a.owner ?? "no owner"}, {a.deadline ?? "no deadline"})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
