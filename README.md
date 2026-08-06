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

**Feels like a feed, not a dashboard.** A composer bar at the top of the feed, a pseudonym and avatar
on every story ("Blunt Associate #7825" — deterministic from the post's hash, never the same as an
identity, never reversible), comments under a story, follow a company for a "new since you followed"
badge, and a share button. "Same here" stays the one reaction — see below for why that was a
deliberate choice, not an oversight.

---

## Where the important decisions live

| Concern | File | Why it is there |
|---|---|---|
| What counts as a reason | `src/lib/taxonomy.ts` | Free-text rants are cathartic and worthless as data. The taxonomy is what makes this sellable. Codes are append-only — renaming one shifts every historical aggregate. |
| What gets published | `src/lib/moderation.ts` | Runs before anything is written. Blocks named individuals and contact details; flags allegations for human review. |
| Every SQL query | `src/lib/db.ts` | All of it, in one file, so the eventual Postgres migration touches one file instead of hunting queries across the codebase. |
| Pricing and entitlements | `src/lib/billing.ts` | Plans, Stripe wiring, HMAC-signed access cookies. |
| Moderator access | `src/lib/admin-token.ts` | Token and session crypto, free of Next imports so it is unit-testable. Fails closed. |
| Pseudonyms | `src/lib/identity.ts` | Deterministic label from a hash, never the hash itself. Two different posters can land on the same pseudonym — a "unique-looking" anonymous handle would quietly become a fingerprint. |
| Following | `src/lib/follows.ts` | An unsigned opaque cookie, not requesterHash()'s anti-spoofing machinery — following has no scarce resource to protect, so it doesn't need it. |

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

### Why there is one reaction, not five

Comments, follows, shares and pseudonyms make this feel like a feed on purpose. "Same here" staying
the *only* reaction is the one place that stops short of copying LinkedIn: a proliferation of
reaction types is exactly the vanity-metrics pattern this site exists to be the opposite of. One
strong, meaningful signal — a corroborating account, not an emoji — is worth more than five weak
ones, and it is also the number the Exit Index is allowed to trust.

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

### The moderation queue

Screening decides what gets *written*; a person decides what stays. `/admin` is where flagged
stories get resolved, and without it the `review` status is a black hole — stories go in and nothing
comes out.

Two things land in the queue: stories screening held (an allegation of unlawful conduct, which is
sometimes exactly what happened and never something to publish on autopilot), and published stories
readers have reported. Three *distinct* reporters auto-hide a story pending review — distinct,
because otherwise one determined person can bury any story they dislike, and there is a test
asserting they cannot.

A moderator sees the full story, the screening findings, and every report with its detail, then
publishes or removes. **Removals require a written reason**, and every decision is appended to
`moderation_log` with the status transition — an unauditable moderation system is
indistinguishable from censorship, and the log is what you show when someone asks why their story
went. Approving also clears the reports, or the story returns to the queue forever.

Comments held by screening get the same treatment in a second section of `/admin`, decisions logged
to `comment_moderation_log` — one queue per content type, same review discipline for both.

Access is a single shared token in `LINKEDOUT_ADMIN_TOKEN`, compared in constant time, exchanged for
an HMAC-signed 12-hour cookie. **Leave it unset and `/admin` 404s** — an admin surface with no
password because someone forgot an env var is how moderation tools end up publicly writable. Right
for one or two moderators; at five you want per-moderator accounts so the log records *who* decided.
Rotating `LINKEDOUT_SALT` signs everyone out, which is the fast revoke.

**Still missing before this goes live for real:** a published takedown contact and a lawyer's read of
the guidelines in your jurisdiction. Comments go through the same `screenShort()` screening as
stories — a flagged comment is held (`status='review'`) and never shown by `getComments()` — and now
has the same resolution path stories do: `/admin` lists held comments alongside held stories, with
publish/remove actions written to `comment_moderation_log`.

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
npm test             # unit tests — screening, after-hours, Exit Index, moderation queue, admin auth, social
npm run e2e          # browser test of the full post flow (needs a server running)
npm run typecheck    # tsc --noEmit
npm run lint
```

79 tests over the things that must not silently break: what screening blocks and what it merely
flags; whether a 6:47pm invite counts as after-hours (18:47 — an hour boundary of 19:00 would miss
exactly the case the feature exists for); that the Exit Index withholds a score below three stories
and never punishes a company for volume alone; that one person reporting six times hides nothing
while three people reporting once each does; that a forged, expired, or salt-rotated moderator
cookie is refused; that a short comment passes screening while a named individual in it still
doesn't; and that `newStoriesSinceFollow()` only counts what actually happened after the follow.

## Configuration

Copy `.env.example` to `.env.local`. Two settings matter in production:

- `LINKEDOUT_SALT` — the salt for every anonymous hash and the HMAC key for entitlement and
  moderator cookies. Set it to something long and random. `.env.example` ships this blank, not
  prefilled — a placeholder value in a public example file is a value an attacker already has, and
  the app refuses to start in production (`src/instrumentation.ts`) without a real one configured.
- `LINKEDOUT_ADMIN_TOKEN` — enables `/admin`. Unset means no admin surface exists.

Never set `LINKEDOUT_DEMO_UNLOCK` on a deployment that charges people.

## Note on the seed data

The eight companies in `scripts/seed.mts` are invented, and the stories are written rather than
collected. Seeding a site like this with real employer names would publish fabricated allegations
against real businesses — precisely what the moderation rules exist to prevent.
