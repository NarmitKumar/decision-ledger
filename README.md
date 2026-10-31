# Decision Ledger

Turn meeting transcripts into tracked work. Claude extracts decisions and action items, compares them to earlier meetings, and you approve before anything is posted.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`
3. `npm run dev`
4. Open http://localhost:3000

SQLite is created at `data/ledger.db`. No other database is required.

## Demo

1. Click **Load demo data**. This stores Meeting 1 (launch Dec 1, 2 lakh budget) and Meeting 2 (Priya owns pricing) and prefills a conflicting follow-up transcript.
2. Click **Extract and check conflicts**. Review old vs new decisions, edit if needed, reject anything you do not want.
3. Click **Approve and post**. Only then are decisions saved, conflicting older decisions superseded, and action items added to the board.
4. Open **Board** to move cards. Open **Reminders** and **Weekly digest**, then click **Simulate next week** to move the app date forward by 7 days.

## Architecture

- `src/app/api/extract` — Claude extraction + conflict judge
- `src/app/api/memory` — explicit approve/post into SQLite
- `src/lib/extract.ts` / `src/lib/judge.ts` — prompts, Zod validation, one retry
- `src/lib/db.ts` — meetings, decisions, action items, conflicts, tasks, app date
- Pages: Extract, Board, Reminders, Digest

Nothing is auto-approved. Missing owners and deadlines stay empty. Invalid model JSON is shown as an error.
