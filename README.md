# LinkedOut

**LinkedIn gives you the polished announcement about being grateful for the journey. This gives you the group chat.**

Anonymous, structured exit stories — the real reasons people quit — with receipts. Every story is
tagged with reasons, tenure, role and severity, so a few hundred separate resignations become
something a candidate can actually search before they sign an offer.

```bash
npm install
npm run seed        # 32 example stories with 25 receipts across 8 invented companies
npm run dev         # http://localhost:3000
```

> **Note on this repo:** `marblelabs1/marblelabs1` is a GitHub profile repository, so the README on
> the default branch renders as your profile page. The original profile README is preserved here as
> [`PROFILE.md`](./PROFILE.md) — swap the two files back, or move this app into a subdirectory,
> before merging anything to `main`.

---

## What it does

**The feed** — anonymous exit stories, filterable by reason and department, sortable by newest, most
corroborated, or most severe. No account needed to read or to post.

**Receipts** — the part that makes it different from a review site. The 6:47pm "quick call?" invite.
The "per my last email". The all-hands slide about family. Rendered back as the artefact it was: a
chat bubble, an email header, a calendar card. Receipts sent outside working hours are detected and
badged, because that pattern turns out to repeat everywhere.

**"Same here"** — one echo per story per person, enforced server-side. The single most valuable
signal on the site: it turns one person's account into a corroborated pattern.

**Exit Index** — a 0–100 score per company. 55% weighted reason mix, 25% reported severity, 20%
would-warn-a-friend rate. Companies with fewer than three stories are shown but never scored.

**Exodus detection** — three or more exits from the same department inside nine months. The pattern
no single story can show, and the one an employer cannot explain away as a personality clash.

**Company reports** — exits broken out by department, level and tenure, plus trend over time.

---

## Where the important decisions live

| Concern | File | Why it is there |
|---|---|---|
| What counts as a reason | `src/lib/taxonomy.ts` | Free-text rants are cathartic and worthless as data. The taxonomy is what makes this sellable. Codes are append-only — renaming one shifts every historical aggregate. |
| What gets published | `src/lib/moderation.ts` | Runs before anything is written. Blocks named individuals and contact details; flags allegations for human review. |
| Every SQL query | `src/lib/db.ts` | All of it, in one file, so the eventual Postgres migration is a one-file job. |
| Pricing and entitlements | `src/lib/billing.ts` | Plans, Stripe wiring, HMAC-signed access cookies. |

---

## Making money

Three revenue lines, in the order they are worth building.

**1. Candidate — £9/mo.** Someone with an offer letter open in another tab, deciding tonight. The
highest-intent moment that exists in this market. Gets full company reports, the role-level
breakdown, trend over time, follow-a-company alerts, and interview questions generated from that
company's actual exit reasons.

**2. Employer — £399/mo.** HR and leadership who want to know what their own leavers say and how it
compares to their industry. Priced like a research subscription because the alternative is a
consultancy at twenty times the cost. Sold as benchmarking and early warning — never as reputation
management.

**3. Licensing.** Aggregate, de-identified trend data to journalists, researchers and
workforce-analytics vendors. Near-zero marginal cost, but it only exists once lines 1–2 have produced
enough volume for the aggregates to mean anything.

### The stories are free, permanently

Not generosity. A paywall on the stories stops people posting them, and the stories are the entire
asset. What costs money is the analysis layer on top.

### What is not for sale, at any price

Removing a story for being unflattering. Changing an Exit Index score. Ranking above another
company. Any information about who posted something.

The moment a score can be bought, candidates stop trusting the index — and an index candidates do
not trust is worth nothing to employers either. Keeping it unbuyable *is* the business model, not a
constraint on it. `/pricing` and `/right-of-reply` say so on the record, publicly, which is also the
cheapest marketing available.

### Turning on payments

Set `STRIPE_CANDIDATE_LINK` and `STRIPE_EMPLOYER_LINK` to Stripe Payment Links and checkout works
with no server-side Stripe code. Until then `/api/checkout` records a hashed email as a waitlist
entry and says plainly that billing is not live — an email you can convert later beats a broken card
form. Entitlements ride in an HMAC-signed cookie, so nobody grants themselves the paid tier by
editing devtools.

---

## The part that stops this becoming a lawsuit

A site where people describe their worst jobs is one careless post away from doxxing a stranger and
one careless post away from a letter. Four decisions do most of the work:

**Criticism attaches to companies, never to named individuals.** `moderation.ts` blocks posts where
a role word is followed by a capitalised name — "my manager Dave", "our CEO Karen Smith" — and tells
the author how to rewrite it. A company is a public actor that can respond publicly; a named middle
manager is a private person with no comparable way to answer back.

**Receipts are transcribed, never screenshotted.** A product decision, not a missing feature. A
screenshot of a work chat carries the sender's real name, their photo, unrelated colleagues in the
thread, and usually the poster's own display name in the corner — none of which can be redacted
reliably at volume. Typed receipts are searchable, quotable, and cannot out anyone.

**No score below three stories.** One furious post is not evidence, and publishing a company-level
number off one post is how you get sued. `exitIndex()` returns `null` below the threshold, and there
is a test asserting it.

**Removal is free and needs no lawyer.** Anything naming an individual, anything with contact
details, anything that could identify the poster, anything demonstrably fabricated — reported by
anyone, no account, no subscription. Three independent reports hide a story pending review.

Posters are never asked for an email and their IP is never stored, only a salted hash of it. We
cannot tell a company who posted something because we do not know.

**Still missing before this goes live for real:** a human moderation queue with an admin UI (flagged
stories currently sit in `status='review'` with no way to action them from the app), a published
takedown contact, and a lawyer's read of the guidelines in your jurisdiction.

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · SQLite via `better-sqlite3` · Zod.

SQLite is the right call while the product is finding out whether anyone wants it: one file, no
service to run. You outgrow it at roughly two points — multiple app instances, or deploying anywhere
with an ephemeral filesystem (Vercel, Lambda). At that point it is Postgres, and every query is in
`src/lib/db.ts` so it stays a one-file change.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run seed         # add example data
npm run seed:reset   # wipe, then add example data
npm test             # unit tests — moderation, after-hours detection, Exit Index
npm run e2e          # browser test of the full post flow (needs a server running)
npm run typecheck    # tsc --noEmit
npm run lint
```

`npm test` covers the three things that must not silently break: what moderation blocks, whether a
6:47pm invite counts as after-hours (18:47 — an hour boundary of 19:00 would miss exactly the case
the feature exists for), and that the Exit Index withholds a score below three stories and never
punishes a company for volume alone.

## Configuration

Copy `.env.example` to `.env.local`. The setting that matters in production is `LINKEDOUT_SALT` — it
is the salt for every anonymous hash and the HMAC key for entitlement cookies. Never set
`LINKEDOUT_DEMO_UNLOCK` on a deployment that charges people.

## Note on the seed data

The eight companies in `scripts/seed.mts` are invented, and the stories are written rather than
collected. Seeding a site like this with real employer names would publish fabricated allegations
against real businesses — precisely what the moderation rules exist to prevent.
