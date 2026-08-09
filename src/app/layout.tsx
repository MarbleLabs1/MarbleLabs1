import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LinkedOut — the real reasons people quit",
    template: "%s · LinkedOut",
  },
  description:
    "Anonymous exit stories from employees who left. Structured, aggregated, and searchable by company — so you know what you are walking into before you sign.",
  openGraph: {
    title: "LinkedOut",
    description: "The real reasons people quit. Anonymous, structured, searchable.",
    type: "website",
  },
};

const NAV = [
  { href: "/", label: "Feed" },
  { href: "/companies", label: "Exit Index" },
  { href: "/insights", label: "Insights" },
  { href: "/pricing", label: "Pricing" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-ink/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="flex items-baseline gap-1.5 font-mono text-lg font-bold tracking-tight">
              <span>Linked</span>
              <span className="bg-acid px-1 text-ink">Out</span>
            </Link>
            {/*
              min-w-0 lets this shrink inside the flex row instead of forcing the header
              wider than the viewport; overflow-x-auto keeps every link reachable by
              scrolling instead of hiding Exit Index and Insights below sm with no other
              way to reach them (the footer does not link either one).
            */}
            <nav
              aria-label="Primary"
              className="flex min-w-0 gap-5 overflow-x-auto whitespace-nowrap text-sm text-muted"
            >
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="transition-colors hover:text-paper">
                  {n.label}
                </Link>
              ))}
            </nav>
            <Link
              href="/submit"
              className="ml-auto rounded-md bg-acid px-3.5 py-2 text-sm font-semibold text-ink transition-opacity hover:opacity-85"
            >
              Tell your story
            </Link>
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

        <footer className="relative z-10 border-t border-line px-4 py-8 text-sm text-muted">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl">
              Stories are personal accounts, posted anonymously and moderated. They are opinion, not
              findings of fact. Companies can{" "}
              <Link href="/right-of-reply" className="text-paper underline decoration-line hover:decoration-acid">
                respond on the record
              </Link>
              .
            </p>
            <nav className="flex gap-4">
              <Link href="/guidelines" className="hover:text-paper">
                Guidelines
              </Link>
              <Link href="/right-of-reply" className="hover:text-paper">
                Right of reply
              </Link>
              <Link href="/pricing" className="hover:text-paper">
                Pricing
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
