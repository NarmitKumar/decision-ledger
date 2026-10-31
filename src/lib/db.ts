import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import {
  DEMO_CONFLICT_DATE,
  DEMO_CONFLICT_TITLE,
  DEMO_CONFLICT_TRANSCRIPT,
  DEMO_MEETING_1,
  DEMO_MEETING_2,
} from "./fixtures";
import type { ActiveDecision, ReminderTask, Task, TaskColumn } from "./types";

export type { ActiveDecision } from "./types";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  raw_transcript TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id),
  text TEXT NOT NULL,
  topic TEXT NOT NULL,
  source_line TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'superseded'))
);

CREATE TABLE IF NOT EXISTS action_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id),
  description TEXT NOT NULL,
  owner TEXT,
  deadline TEXT,
  source_line TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'approved', 'posted', 'done'))
);

CREATE TABLE IF NOT EXISTS conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  new_decision_id INTEGER NOT NULL REFERENCES decisions(id),
  old_decision_id INTEGER NOT NULL REFERENCES decisions(id),
  type TEXT NOT NULL CHECK (type IN ('reversal', 'deadline', 'budget', 'owner', 'other')),
  explanation TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_item_id INTEGER REFERENCES action_items(id),
  description TEXT NOT NULL,
  owner TEXT,
  deadline TEXT,
  column TEXT NOT NULL CHECK (column IN ('todo', 'in_progress', 'done'))
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

let db: Database.Database | null = null;

export function getDb() {
  if (db) return db;
  const dir = (process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data"));
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "ledger.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export function listActiveDecisions(): ActiveDecision[] {
  return getDb()
    .prepare(
      `SELECT d.id, m.title AS meeting_title, m.date AS meeting_date, d.text, d.topic
       FROM decisions d
       JOIN meetings m ON m.id = d.meeting_id
       WHERE d.status = 'active'
       ORDER BY m.date ASC, d.id ASC`,
    )
    .all() as ActiveDecision[];
}

export function listMemorySummary() {
  const database = getDb();
  const meetings = database.prepare(`SELECT COUNT(*) AS n FROM meetings`).get() as { n: number };
  const active = database
    .prepare(`SELECT COUNT(*) AS n FROM decisions WHERE status = 'active'`)
    .get() as { n: number };
  const superseded = database
    .prepare(`SELECT COUNT(*) AS n FROM decisions WHERE status = 'superseded'`)
    .get() as { n: number };
  return {
    meetings: meetings.n,
    activeDecisions: active.n,
    supersededDecisions: superseded.n,
    decisions: listActiveDecisions(),
  };
}

export type NewConflict = {
  newDecisionIndex: number;
  oldDecisionId: number;
  type: "reversal" | "deadline" | "budget" | "owner" | "other";
  explanation: string;
};

export function saveApprovedMeeting(input: {
  title: string;
  meetingDate: string;
  transcript: string;
  decisions: { text: string; topic: string; source_line: string }[];
  actionItems: {
    description: string;
    owner: string | null;
    deadline: string | null;
    source_line: string;
  }[];
  conflicts: NewConflict[];
}) {
  const database = getDb();
  const tx = database.transaction(() => {
    const meeting = database
      .prepare(`INSERT INTO meetings (title, date, raw_transcript) VALUES (?, ?, ?)`)
      .run(input.title, input.meetingDate, input.transcript);
    const meetingId = Number(meeting.lastInsertRowid);

    const insertDecision = database.prepare(
      `INSERT INTO decisions (meeting_id, text, topic, source_line, status)
       VALUES (?, ?, ?, ?, 'active')`,
    );
    const newIds: number[] = [];
    for (const decision of input.decisions) {
      const row = insertDecision.run(
        meetingId,
        decision.text,
        decision.topic,
        decision.source_line,
      );
      newIds.push(Number(row.lastInsertRowid));
    }

    const insertAction = database.prepare(
      `INSERT INTO action_items (meeting_id, description, owner, deadline, source_line, status)
       VALUES (?, ?, ?, ?, ?, 'posted')`,
    );
    const insertTask = database.prepare(
      `INSERT INTO tasks (action_item_id, description, owner, deadline, column)
       VALUES (?, ?, ?, ?, 'todo')`,
    );
    for (const item of input.actionItems) {
      const row = insertAction.run(
        meetingId,
        item.description,
        item.owner,
        item.deadline,
        item.source_line,
      );
      insertTask.run(Number(row.lastInsertRowid), item.description, item.owner, item.deadline);
    }

    const insertConflict = database.prepare(
      `INSERT INTO conflicts (new_decision_id, old_decision_id, type, explanation)
       VALUES (?, ?, ?, ?)`,
    );
    const supersede = database.prepare(`UPDATE decisions SET status = 'superseded' WHERE id = ?`);

    for (const conflict of input.conflicts) {
      const newId = newIds[conflict.newDecisionIndex];
      if (newId == null) continue;
      insertConflict.run(newId, conflict.oldDecisionId, conflict.type, conflict.explanation);
      supersede.run(conflict.oldDecisionId);
    }

    return { meetingId, decisionIds: newIds };
  });

  return tx();
}

export function clearMemory() {
  const database = getDb();
  database.exec(`
    DELETE FROM tasks;
    DELETE FROM conflicts;
    DELETE FROM action_items;
    DELETE FROM decisions;
    DELETE FROM meetings;
  `);
}

function padDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return padDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function todayIso() {
  const now = new Date();
  return padDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function getAppDate() {
  const row = getDb().prepare(`SELECT value FROM app_meta WHERE key = 'app_date'`).get() as
    | { value: string }
    | undefined;
  if (row?.value) return row.value;
  const value = todayIso();
  getDb().prepare(`INSERT INTO app_meta (key, value) VALUES ('app_date', ?)`).run(value);
  return value;
}

export function advanceAppDate(days = 7) {
  const next = addDays(getAppDate(), days);
  getDb()
    .prepare(
      `INSERT INTO app_meta (key, value) VALUES ('app_date', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(next);
  return next;
}

export function listTasks(): Task[] {
  return getDb()
    .prepare(
      `SELECT id, action_item_id, description, owner, deadline, column
       FROM tasks
       ORDER BY id ASC`,
    )
    .all() as Task[];
}

export function moveTask(id: number, column: TaskColumn) {
  const database = getDb();
  const task = database.prepare(`SELECT action_item_id FROM tasks WHERE id = ?`).get(id) as
    | { action_item_id: number | null }
    | undefined;
  if (!task) throw new Error(`Task ${id} was not found.`);
  database.prepare(`UPDATE tasks SET column = ? WHERE id = ?`).run(column, id);
  if (task.action_item_id) {
    database
      .prepare(`UPDATE action_items SET status = ? WHERE id = ?`)
      .run(column === "done" ? "done" : "posted", task.action_item_id);
  }
  return listTasks();
}

export function listReminders(): { appDate: string; items: ReminderTask[] } {
  const appDate = getAppDate();
  const until = addDays(appDate, 2);
  const items = listTasks()
    .filter((task) => task.column !== "done" && task.deadline && task.deadline <= until)
    .map((task) => ({
      ...task,
      overdue: Boolean(task.deadline && task.deadline < appDate),
    }));
  return { appDate, items };
}

const NAME_STOP = new Set([
  "product",
  "launch",
  "total",
  "budget",
  "capped",
  "lakh",
  "december",
  "november",
  "the",
  "and",
  "page",
  "pricing",
  "owns",
  "dec",
  "nov",
  "meeting",
  "let",
]);

export function listPeople() {
  const names = new Set<string>();
  for (const task of listTasks()) {
    if (task.owner) names.add(task.owner);
  }
  for (const decision of listActiveDecisions()) {
    for (const match of decision.text.match(/\b[A-Z][a-z]{2,}\b/g) ?? []) {
      if (!NAME_STOP.has(match.toLowerCase())) names.add(match);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function listDigest(person: string) {
  const appDate = getAppDate();
  const weekEnd = addDays(appDate, 6);
  const openTasks = listTasks().filter(
    (task) => task.column !== "done" && (task.owner ?? "").toLowerCase() === person.toLowerCase(),
  );
  const dueThisWeek = openTasks.filter(
    (task) => task.deadline && task.deadline >= appDate && task.deadline <= weekEnd,
  );
  const decisions = listActiveDecisions().filter((decision) =>
    decision.text.toLowerCase().includes(person.toLowerCase()),
  );
  return { appDate, person, people: listPeople(), openTasks, dueThisWeek, decisions };
}

export function seedDemoData() {
  clearMemory();
  saveApprovedMeeting({
    title: DEMO_MEETING_1.title,
    meetingDate: DEMO_MEETING_1.date,
    transcript: DEMO_MEETING_1.transcript,
    decisions: DEMO_MEETING_1.decisions,
    actionItems: [],
    conflicts: [],
  });
  saveApprovedMeeting({
    title: DEMO_MEETING_2.title,
    meetingDate: DEMO_MEETING_2.date,
    transcript: DEMO_MEETING_2.transcript,
    decisions: DEMO_MEETING_2.decisions,
    actionItems: [],
    conflicts: [],
  });
  return {
    memory: listMemorySummary(),
    title: DEMO_CONFLICT_TITLE,
    meetingDate: DEMO_CONFLICT_DATE,
    transcript: DEMO_CONFLICT_TRANSCRIPT,
  };
}
