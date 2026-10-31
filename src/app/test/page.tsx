import { AccuracyTests } from "@/components/AccuracyTests";
import { Nav } from "@/components/Nav";

export default function TestPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Nav />
      <header className="mb-8">
        <p className="text-sm font-medium tracking-wide text-blue-700">Stage 1 · Accuracy</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Five test transcripts</h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          Each case hits the live extract API. Checks are simple and readable so you can see what
          passed without opening JSON. This uses your Anthropic key.
        </p>
      </header>
      <AccuracyTests />
    </main>
  );
}
