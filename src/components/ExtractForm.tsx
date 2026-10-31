"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ReviewPanel } from "@/components/ReviewPanel";
import { DEMO_CONFLICT_DATE, DEMO_CONFLICT_TITLE, DEMO_CONFLICT_TRANSCRIPT } from "@/lib/fixtures";
import type { ActionItem, ConflictView, Decision, ProcessResult } from "@/lib/schemas";
import type { MemorySummary } from "@/lib/types";

const SAMPLE_TRANSCRIPT = `Priya: Let's lock the launch for December 1.
Arjun: Agreed. Budget stays at 2 lakh, no extras.
Priya: I'll own the pricing page... wait, no, Arjun should take the pricing page.
Arjun: Fine, I'll take pricing. Can we get copy by Friday?
Priya: Yes, send copy by Friday.
Sam: Anyway I was watching that cricket match last night, crazy finish.
Priya: Focus. We also need legal to review the terms, but nobody is assigned yet.`;

const CONFLICT_SAMPLE = DEMO_CONFLICT_TRANSCRIPT;

type SpeechCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getSpeechRecognition(): SpeechCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function ExtractForm() {
  const [title, setTitle] = useState("Weekly product sync");
  const [meetingDate, setMeetingDate] = useState(todayIso);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [memory, setMemory] = useState<MemorySummary | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const baseTranscriptRef = useRef("");

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && meetingDate.length === 10 && transcript.trim().length >= 10;
  }, [title, meetingDate, transcript]);

  async function refreshMemory() {
    const response = await fetch("/api/memory");
    const data = (await response.json()) as MemorySummary & { error?: string };
    if (!response.ok) throw new Error(data.error || "Could not load memory.");
    setMemory(data);
  }

  useEffect(() => {
    refreshMemory().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load memory.");
    });
  }, []);

  function startMic() {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError(
        "This browser has no speech recognition. Use Chrome, or dictate/paste into the transcript box.",
      );
      return;
    }

    setError(null);
    baseTranscriptRef.current = transcript.trim();
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.onresult = (event) => {
      const spoken = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      const prefix = baseTranscriptRef.current;
      setTranscript(prefix ? `${prefix}\n${spoken}` : spoken);
    };
    recognition.onerror = (event) => {
      setListening(false);
      setError(`Microphone error: ${event.error}`);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopMic() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    stopMic();
    setLoading(true);
    setError(null);
    setNotice(null);
    setResult(null);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, meetingDate, transcript }),
      });
      const data = (await response.json()) as ProcessResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || `Extraction failed (${response.status}).`);
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveToMemory(payload: {
    decisions: Decision[];
    action_items: ActionItem[];
    conflicts: ConflictView[];
  }) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          meetingDate,
          transcript,
          decisions: payload.decisions,
          action_items: payload.action_items,
          conflicts: payload.conflicts,
        }),
      });
      const data = (await response.json()) as { error?: string; memory?: MemorySummary };
      if (!response.ok) {
        throw new Error(data.error || "Save failed.");
      }
      if (data.memory) setMemory(data.memory);
      setNotice(
        payload.conflicts.length > 0
          ? "Posted. Approved decisions are active, conflicting older ones are superseded, and approved action items are on the board."
          : "Posted. Approved decisions are in memory and approved action items are on the Kanban board.",
      );
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function loadDemo() {
    setError(null);
    setNotice(null);
    setResult(null);
    try {
      const response = await fetch("/api/demo", { method: "POST" });
      const data = (await response.json()) as MemorySummary & {
        error?: string;
        memory?: MemorySummary;
        title?: string;
        meetingDate?: string;
        transcript?: string;
      };
      if (!response.ok) throw new Error(data.error || "Could not load demo data.");
      setMemory(data.memory ?? data);
      setTitle(data.title ?? DEMO_CONFLICT_TITLE);
      setMeetingDate(data.meetingDate ?? DEMO_CONFLICT_DATE);
      setTranscript(data.transcript ?? DEMO_CONFLICT_TRANSCRIPT);
      setNotice("Demo meetings loaded. Extract this follow-up transcript to see conflicts, then Approve and post.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load demo data.");
    }
  }

  async function onClearMemory() {
    if (!window.confirm("Clear all saved meetings and decisions from this app's SQLite file?")) {
      return;
    }
    const response = await fetch("/api/memory", { method: "DELETE" });
    const data = (await response.json()) as MemorySummary & { memory?: MemorySummary; error?: string };
    if (!response.ok) {
      setError(data.error || "Could not clear memory.");
      return;
    }
    setMemory(data.memory ?? data);
    setNotice("Memory cleared.");
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-stone-200 bg-[var(--card)] p-5 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Meeting title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Meeting date</span>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                required
              />
            </label>
          </div>

          <label className="mt-4 block text-sm">
            <span className="font-medium">Transcript</span>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={16}
              placeholder={"Priya: Let's lock launch for December 1.\nArjun: Agreed. Budget stays at 2 lakh."}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 leading-6"
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Extracting…" : "Extract and check conflicts"}
            </button>
            <button
              type="button"
              onClick={listening ? stopMic : startMic}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium"
            >
              {listening ? "Stop microphone" : "Use microphone"}
            </button>
            <button
              type="button"
              onClick={() => setTranscript(SAMPLE_TRANSCRIPT)}
              className="text-sm text-stone-600 underline"
            >
              Sample meeting 1
            </button>
            <button
              type="button"
              onClick={() => {
                setTitle(DEMO_CONFLICT_TITLE);
                setMeetingDate(DEMO_CONFLICT_DATE);
                setTranscript(CONFLICT_SAMPLE);
              }}
              className="text-sm text-stone-600 underline"
            >
              Sample meeting 2 (conflicts)
            </button>
            <button type="button" onClick={loadDemo} className="text-sm text-stone-600 underline">
              Load demo data
            </button>
          </div>
          {listening ? (
            <p className="mt-3 text-sm text-blue-700">Listening… spoken text is added to the transcript.</p>
          ) : null}
        </form>

        <section className="rounded-2xl border border-stone-200 bg-[var(--card)] p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Status</h2>
          {loading ? (
            <p className="mt-6 text-sm text-stone-500">
              Calling Claude, validating JSON, then judging against active decisions…
            </p>
          ) : null}
          {error ? (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              {notice}
            </div>
          ) : null}
          {!loading && !error && !notice && !result ? (
            <p className="mt-6 text-sm text-stone-500">Extract a transcript to open the review panel.</p>
          ) : null}
        </section>
      </div>

      {result ? (
        <ReviewPanel
          result={result}
          transcript={transcript}
          title={title}
          meetingDate={meetingDate}
          saving={saving}
          onApprove={saveToMemory}
        />
      ) : null}

      <section className="rounded-2xl border border-stone-200 bg-[var(--card)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Active memory</h2>
            <p className="text-sm text-stone-600">
              {memory
                ? `${memory.meetings} meetings · ${memory.activeDecisions} active · ${memory.supersededDecisions} superseded`
                : "Loading…"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClearMemory}
            className="text-sm text-stone-600 underline"
          >
            Clear memory
          </button>
        </div>
        {memory?.decisions.length ? (
          <ul className="mt-4 space-y-2 text-sm">
            {memory.decisions.map((d) => (
              <li key={d.id} className="rounded-lg border border-stone-200 p-3">
                <p className="font-medium">{d.text}</p>
                <p className="mt-1 text-stone-500">
                  #{d.id} · {d.meeting_title} · {d.meeting_date} · {d.topic}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-stone-500">No active decisions stored yet.</p>
        )}
      </section>
    </div>
  );
}

