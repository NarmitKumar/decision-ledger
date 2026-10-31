import type { ExtractResult } from "./schemas";

export const DEMO_MEETING_1 = {
  title: "Meeting 1",
  date: "2026-10-01",
  transcript: `Priya: Product launch on Dec 1.
Arjun: Total budget capped at 2 lakh.`,
  decisions: [
    {
      text: "Product launch on Dec 1",
      topic: "launch",
      source_line: "Priya: Product launch on Dec 1.",
    },
    {
      text: "Total budget capped at 2 lakh",
      topic: "budget",
      source_line: "Arjun: Total budget capped at 2 lakh.",
    },
  ],
};

export const DEMO_MEETING_2 = {
  title: "Meeting 2",
  date: "2026-10-08",
  transcript: `Priya: Priya owns the pricing page.`,
  decisions: [
    {
      text: "Priya owns the pricing page",
      topic: "owner",
      source_line: "Priya: Priya owns the pricing page.",
    },
  ],
};

export const DEMO_CONFLICT_TITLE = "Follow-up sync";
export const DEMO_CONFLICT_DATE = "2026-10-20";
export const DEMO_CONFLICT_TRANSCRIPT =
  "Priya: Let's move launch to Nov 15, hire two contractors, and Arjun takes the pricing page.";


export type AccuracyCheck = {
  id: string;
  label: string;
  pass: (result: ExtractResult) => boolean;
};

export type AccuracyCase = {
  id: string;
  name: string;
  title: string;
  meetingDate: string;
  transcript: string;
  checks: AccuracyCheck[];
};

function joined(result: ExtractResult) {
  const decisionText = result.decisions.map((d) => d.text).join(" ").toLowerCase();
  const actionText = result.action_items.map((a) => a.description).join(" ").toLowerCase();
  const owners = result.action_items.map((a) => (a.owner ?? "").toLowerCase());
  const sources = [
    ...result.decisions.map((d) => d.source_line),
    ...result.action_items.map((a) => a.source_line),
  ].join("\n");
  return { decisionText, actionText, owners, sources };
}

/** Wednesday 28 Oct 2026 → "Friday" should resolve to 2026-10-30. */
export const ACCURACY_CASES: AccuracyCase[] = [
  {
    id: "clean",
    name: "1. Clean transcript",
    title: "Launch kickoff",
    meetingDate: "2026-10-28",
    transcript: `Priya: We will launch the pricing page on December 1.
Arjun: I'll send the first draft by November 5.
Priya: Agreed. Priya owns the launch checklist.`,
    checks: [
      {
        id: "has-launch-decision",
        label: "Includes a launch / December 1 decision",
        pass: (r) => joined(r).decisionText.includes("december") || joined(r).decisionText.includes("launch"),
      },
      {
        id: "arjun-deadline",
        label: "Arjun's draft deadline is 2026-11-05, not invented",
        pass: (r) =>
          r.action_items.some(
            (a) => (a.owner ?? "").toLowerCase() === "arjun" && a.deadline === "2026-11-05",
          ),
      },
    ],
  },
  {
    id: "self-correction",
    name: "2. Self-correction",
    title: "Owner correction",
    meetingDate: "2026-10-28",
    transcript: `Priya: I'll own the pricing page... wait, no, Arjun should take the pricing page.
Arjun: Okay, I'll take pricing.
Sam: Cool.`,
    checks: [
      {
        id: "final-owner-arjun",
        label: "Final owner is Arjun, not Priya",
        pass: (r) => {
          const pricing = r.action_items.filter((a) =>
            `${a.description} ${a.source_line}`.toLowerCase().includes("pricing"),
          );
          const decisions = r.decisions.filter((d) => d.text.toLowerCase().includes("pricing"));
          const owners = [
            ...pricing.map((a) => (a.owner ?? "").toLowerCase()),
            ...decisions.map((d) => d.text.toLowerCase()),
          ].join(" ");
          return owners.includes("arjun") && !pricing.some((a) => (a.owner ?? "").toLowerCase() === "priya");
        },
      },
    ],
  },
  {
    id: "filler",
    name: "3. Filler and digression",
    title: "Noisy standup",
    meetingDate: "2026-10-28",
    transcript: `Sam: Anyway I was watching that cricket match last night, crazy finish.
Priya: Focus. Legal still needs to review the terms.
Arjun: Yeah the biryani at lunch was great.
Priya: We decided the budget stays at 2 lakh.`,
    checks: [
      {
        id: "ignore-cricket",
        label: "Does not treat cricket or biryani as work",
        pass: (r) => {
          const blob = `${joined(r).decisionText} ${joined(r).actionText}`.toLowerCase();
          return !blob.includes("cricket") && !blob.includes("biryani");
        },
      },
      {
        id: "keeps-budget",
        label: "Keeps the 2 lakh budget decision",
        pass: (r) => joined(r).decisionText.includes("2 lakh") || joined(r).decisionText.includes("lakh"),
      },
    ],
  },
  {
    id: "relative-dates",
    name: "4. Relative dates",
    title: "Deadline sync",
    meetingDate: "2026-10-28",
    transcript: `Priya: Please send the copy by Friday.
Arjun: I'll review it next week.
Priya: That's the plan.`,
    checks: [
      {
        id: "friday-iso",
        label: '"by Friday" becomes 2026-10-30 (meeting is Wed 28 Oct)',
        pass: (r) => r.action_items.some((a) => a.deadline === "2026-10-30"),
      },
      {
        id: "next-week-not-invented-past",
        label: '"next week" is after the meeting date, not a made-up past date',
        pass: (r) =>
          r.action_items.some((a) => {
            if (!a.deadline) return false;
            const desc = a.description.toLowerCase();
            const isReview = desc.includes("review") || (a.owner ?? "").toLowerCase() === "arjun";
            return isReview && a.deadline >= "2026-11-02" && a.deadline <= "2026-11-08";
          }),
      },
    ],
  },
  {
    id: "nulls",
    name: "5. Missing owner and deadline",
    title: "Unassigned follow-up",
    meetingDate: "2026-10-28",
    transcript: `Priya: Someone should update the FAQ. Not sure who.
Arjun: And we should look at analytics at some point.
Priya: No date for that. Let's not assign it yet.`,
    checks: [
      {
        id: "null-owner",
        label: "FAQ / analytics items have owner null (not invented)",
        pass: (r) =>
          r.action_items.length > 0 &&
          r.action_items.every((a) => a.owner === null) &&
          r.action_items.some((a) => a.deadline === null),
      },
      {
        id: "no-fake-friday",
        label: "Does not invent a deadline such as Friday",
        pass: (r) => r.action_items.every((a) => a.deadline === null),
      },
    ],
  },
];
