"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActionItem, ConflictView, Decision, ProcessResult } from "@/lib/schemas";

type Props = {
  result: ProcessResult;
  transcript: string;
  title: string;
  meetingDate: string;
  saving: boolean;
  onApprove: (payload: {
    decisions: Decision[];
    action_items: ActionItem[];
    conflicts: ConflictView[];
  }) => void;
};

export function ReviewPanel({ result, transcript, title, meetingDate, saving, onApprove }: Props) {
  const [decisions, setDecisions] = useState(result.decisions);
  const [actions, setActions] = useState(result.action_items);
  const [keepDecision, setKeepDecision] = useState(result.decisions.map(() => true));
  const [keepAction, setKeepAction] = useState(result.action_items.map(() => true));
  const [highlight, setHighlight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDecisions(result.decisions);
    setActions(result.action_items);
    setKeepDecision(result.decisions.map(() => true));
    setKeepAction(result.action_items.map(() => true));
    setHighlight(null);
    setError(null);
  }, [result]);

  const lines = useMemo(
    () => transcript.split(/\r?\n/).filter((line) => line.length > 0),
    [transcript],
  );

  function selectSource(line: string) {
    setHighlight(line);
  }

  function submit() {
    const approvedDecisions = decisions.filter((_, index) => keepDecision[index]);
    const approvedActions = actions
      .filter((_, index) => keepAction[index])
      .map((item) => ({
        ...item,
        owner: item.owner?.trim() ? item.owner.trim() : null,
        deadline: item.deadline?.trim() ? item.deadline.trim() : null,
      }));

    if (approvedDecisions.length === 0 && approvedActions.length === 0) {
      setError("Approve at least one decision or action item, or reject all and extract again.");
      return;
    }

    const indexMap = new Map<number, number>();
    decisions.forEach((_, oldIndex) => {
      if (!keepDecision[oldIndex]) return;
      indexMap.set(oldIndex, indexMap.size);
    });

    const conflicts = result.conflicts.flatMap((conflict) => {
      const nextIndex = indexMap.get(conflict.new_decision_index);
      if (nextIndex == null) return [];
      const next = approvedDecisions[nextIndex];
      return [
        {
          ...conflict,
          new_decision_index: nextIndex,
          new_text: next?.text ?? conflict.new_text,
        },
      ];
    });

    setError(null);
    onApprove({ decisions: approvedDecisions, action_items: approvedActions, conflicts });
  }

  return (
    <section className="space-y-6 rounded-2xl border border-stone-200 bg-[var(--card)] p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Review {title}</h2>
        <p className="mt-1 text-sm text-stone-600">
          Edit, approve, or reject each item. Nothing is saved until you click Approve and post.
        </p>
      </div>

      {result.conflicts.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-red-800">
            Conflicts ({result.conflicts.length})
          </h3>
          {result.conflicts.map((conflict) => {
            const source = decisions[conflict.new_decision_index]?.source_line;
            return (
              <button
                type="button"
                key={`${conflict.new_decision_index}-${conflict.old_decision_id}`}
                onClick={() => source && selectSource(source)}
                className="block w-full rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm"
              >
                <p className="font-medium capitalize text-red-900">{conflict.type} conflict</p>
                <p className="mt-1 text-red-900">{conflict.explanation}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded bg-white p-2">
                    <p className="text-xs text-stone-500">
                      Earlier · {conflict.old_meeting_title} · {conflict.old_meeting_date}
                    </p>
                    <p className="mt-1">{conflict.old_text}</p>
                  </div>
                  <div className="rounded bg-white p-2">
                    <p className="text-xs text-stone-500">This meeting · {meetingDate}</p>
                    <p className="mt-1">{conflict.new_text}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-stone-500">
          {result.past_decision_count === 0
            ? "No past decisions in memory yet, so nothing to conflict with."
            : "No conflicts with active decisions."}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Transcript</h3>
          <ul className="mt-2 max-h-[28rem] space-y-1 overflow-auto rounded-lg border border-stone-200 bg-stone-50 p-2 text-sm">
            {lines.map((line, index) => {
              const active = highlight === line;
              return (
                <li
                  key={`${index}-${line}`}
                  className={`rounded px-2 py-1 ${active ? "bg-amber-200" : ""}`}
                >
                  {line}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Decisions</h3>
            {decisions.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">No decisions found.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {decisions.map((decision, index) => (
                  <li key={`d-${index}`}>
                    <button
                      type="button"
                      onClick={() => selectSource(decision.source_line)}
                      className={`w-full rounded-lg border p-3 text-left ${
                        keepDecision[index] ? "border-stone-200 bg-white" : "border-stone-200 bg-stone-100 opacity-60"
                      }`}
                    >
                      <label className="block text-sm" onClick={(event) => event.stopPropagation()}>
                        <span className="text-xs text-stone-500">Text</span>
                        <textarea
                          value={decision.text}
                          onChange={(event) => {
                            const next = [...decisions];
                            next[index] = { ...decision, text: event.target.value };
                            setDecisions(next);
                          }}
                          rows={2}
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1"
                        />
                      </label>
                      <p className="mt-2 text-xs text-stone-500">Source: {decision.source_line}</p>
                      <div className="mt-2 flex gap-2" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() =>
                            setKeepDecision((prev) => prev.map((value, i) => (i === index ? true : value)))
                          }
                          className={`rounded px-2 py-1 text-xs ${keepDecision[index] ? "bg-emerald-700 text-white" : "border"}`}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setKeepDecision((prev) => prev.map((value, i) => (i === index ? false : value)))
                          }
                          className={`rounded px-2 py-1 text-xs ${!keepDecision[index] ? "bg-red-800 text-white" : "border"}`}
                        >
                          Reject
                        </button>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Action items</h3>
            {actions.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">No action items found.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {actions.map((item, index) => (
                  <li key={`a-${index}`}>
                    <button
                      type="button"
                      onClick={() => selectSource(item.source_line)}
                      className={`w-full rounded-lg border p-3 text-left ${
                        keepAction[index] ? "border-stone-200 bg-white" : "border-stone-200 bg-stone-100 opacity-60"
                      }`}
                    >
                      <div className="grid gap-2" onClick={(event) => event.stopPropagation()}>
                        <label className="block text-sm">
                          <span className="text-xs text-stone-500">Description</span>
                          <textarea
                            value={item.description}
                            onChange={(event) => {
                              const next = [...actions];
                              next[index] = { ...item, description: event.target.value };
                              setActions(next);
                            }}
                            rows={2}
                            className="mt-1 w-full rounded border border-stone-300 px-2 py-1"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-sm">
                            <span className="text-xs text-stone-500">Owner</span>
                            <input
                              value={item.owner ?? ""}
                              onChange={(event) => {
                                const next = [...actions];
                                next[index] = { ...item, owner: event.target.value || null };
                                setActions(next);
                              }}
                              placeholder="leave blank if unknown"
                              className="mt-1 w-full rounded border border-stone-300 px-2 py-1"
                            />
                          </label>
                          <label className="block text-sm">
                            <span className="text-xs text-stone-500">Deadline</span>
                            <input
                              type="date"
                              value={item.deadline ?? ""}
                              onChange={(event) => {
                                const next = [...actions];
                                next[index] = { ...item, deadline: event.target.value || null };
                                setActions(next);
                              }}
                              className="mt-1 w-full rounded border border-stone-300 px-2 py-1"
                            />
                          </label>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-stone-500">Source: {item.source_line}</p>
                      <div className="mt-2 flex gap-2" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() =>
                            setKeepAction((prev) => prev.map((value, i) => (i === index ? true : value)))
                          }
                          className={`rounded px-2 py-1 text-xs ${keepAction[index] ? "bg-emerald-700 text-white" : "border"}`}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setKeepAction((prev) => prev.map((value, i) => (i === index ? false : value)))
                          }
                          className={`rounded px-2 py-1 text-xs ${!keepAction[index] ? "bg-red-800 text-white" : "border"}`}
                        >
                          Reject
                        </button>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Posting…" : "Approve and post"}
      </button>
    </section>
  );
}
