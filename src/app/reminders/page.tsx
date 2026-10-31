import { Nav } from "@/components/Nav";
import { Reminders } from "@/components/Reminders";

export default function RemindersPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Nav />
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Reminders</h1>
        <p className="mt-2 text-stone-600">Open tasks due within 48 hours, or already overdue.</p>
      </header>
      <Reminders />
    </main>
  );
}
