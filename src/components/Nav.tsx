import Link from "next/link";

const LINKS = [
  { href: "/", label: "Extract" },
  { href: "/board", label: "Board" },
  { href: "/reminders", label: "Reminders" },
  { href: "/digest", label: "Weekly digest" },
  { href: "/test", label: "Accuracy tests" },
];

export function Nav() {
  return (
    <nav className="mb-8 flex flex-wrap items-center gap-4 text-sm">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="font-medium text-blue-700 hover:underline">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
