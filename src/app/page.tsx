import { ExtractForm } from "@/components/ExtractForm";
import { Nav } from "@/components/Nav";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Nav />
      <header className="mb-8">
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Decision Ledger</h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          Extract a meeting, review conflicts, then Approve and post. Nothing is saved as approved
          or moved to the board until that click.
        </p>
      </header>
      <ExtractForm />
    </main>
  );
}
