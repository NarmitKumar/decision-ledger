import { Board } from "@/components/Board";
import { Nav } from "@/components/Nav";

export default function BoardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Nav />
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Kanban board</h1>
        <p className="mt-2 text-stone-600">
          Tasks appear here only after you click Approve and post on the extract page.
        </p>
      </header>
      <Board />
    </main>
  );
}
