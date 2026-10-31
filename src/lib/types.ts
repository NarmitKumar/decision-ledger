export type ActiveDecision = {
  id: number;
  meeting_title: string;
  meeting_date: string;
  text: string;
  topic: string;
};

export type MemorySummary = {
  meetings: number;
  activeDecisions: number;
  supersededDecisions: number;
  decisions: ActiveDecision[];
};

export type TaskColumn = "todo" | "in_progress" | "done";

export type Task = {
  id: number;
  action_item_id: number | null;
  description: string;
  owner: string | null;
  deadline: string | null;
  column: TaskColumn;
};

export type ReminderTask = Task & {
  overdue: boolean;
};
