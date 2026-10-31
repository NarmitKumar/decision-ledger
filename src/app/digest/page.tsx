import { Digest } from "@/components/Digest";
import { Nav } from "@/components/Nav";

export default function DigestPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Nav />
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Weekly digest</h1>
        <p className="mt-2 text-stone-600">Open work, due dates this week, and decisions that mention a person.</p>
      </header>
      <Digest />
    </main>
  );
}
