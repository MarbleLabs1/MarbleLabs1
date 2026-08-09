"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { REASONS, ROLE_FAMILIES, SENIORITIES, SIZE_BUCKETS } from "@/lib/taxonomy";
import type { Finding } from "@/lib/moderation";
import { looksAfterHours } from "@/lib/receipts";
import { ReceiptComposer, type DraftReceipt } from "./ReceiptComposer";

const MAX_REASONS = 6;

const SEVERITY_LABELS: Record<number, string> = {
  1: "Fine, just moved on",
  2: "Frustrating",
  3: "Genuinely bad",
  4: "Harmful",
  5: "It damaged me",
};

const fieldClass =
  "w-full rounded-md border border-line bg-ink-2 px-3 py-2 text-[15px] text-paper placeholder:text-muted/70 focus:border-acid focus:outline-none";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-xs">{label}</span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

export function SubmitForm() {
  const router = useRouter();

  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [sizeBucket, setSizeBucket] = useState<string>("");
  const [roleFamily, setRoleFamily] = useState<string>(ROLE_FAMILIES[0]);
  const [seniority, setSeniority] = useState<string>(SENIORITIES[2]);
  const [tenureMonths, setTenureMonths] = useState("18");
  const [region, setRegion] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [severity, setSeverity] = useState(3);
  const [warnFriend, setWarnFriend] = useState(false);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [attest, setAttest] = useState(false);
  const [receipts, setReceipts] = useState<DraftReceipt[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof REASONS>();
    for (const r of REASONS) {
      map.set(r.group, [...(map.get(r.group) ?? []), r]);
    }
    return [...map.entries()];
  }, []);

  function toggleReason(code: string) {
    setReasons((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length >= MAX_REASONS
          ? prev
          : [...prev, code],
    );
  }

  const bodyLength = body.trim().length;
  const canSubmit =
    company.trim().length >= 2 &&
    headline.trim().length >= 8 &&
    bodyLength >= 120 &&
    reasons.length > 0 &&
    attest &&
    !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFindings([]);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company,
          industry: industry || undefined,
          sizeBucket: sizeBucket || undefined,
          headline,
          body,
          roleFamily,
          seniority,
          tenureMonths: Number(tenureMonths),
          reasons,
          severity,
          warnFriend,
          region: region || undefined,
          // The real `attest` state, not a literal — canSubmit already gates on it, but
          // asserting attestation the poster never gave would defeat the point of asking.
          attest,
          receipts: receipts
            .filter((r) => r.content.trim().length > 1)
            .map((r) => ({
              kind: r.kind,
              senderRole: r.senderRole,
              sentAtLabel: r.sentAtLabel || undefined,
              subject: r.subject || undefined,
              content: r.content.trim(),
              afterHours: r.afterHours ?? looksAfterHours(r.sentAtLabel),
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setFindings(data.findings ?? []);
        if (data.fields?.length) {
          setFindings(
            data.fields.map((f: { path: string; message: string }) => ({
              action: "block" as const,
              code: f.path,
              message: `${f.path}: ${f.message}`,
            })),
          );
        }
        return;
      }
      router.push(`/stories/${data.id}?new=1`);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-6">
      <fieldset className="card flex flex-col gap-5 p-5">
        <legend className="label-xs px-1">The job you left</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Company" hint="The employer, not a person.">
            <input
              className={fieldClass}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Logistics Ltd"
              required
              maxLength={120}
            />
          </Field>
          <Field label="Industry" hint="Optional — powers benchmarking.">
            <input
              className={fieldClass}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Logistics"
              maxLength={60}
            />
          </Field>
          <Field label="Headcount">
            <select className={fieldClass} value={sizeBucket} onChange={(e) => setSizeBucket(e.target.value)}>
              <option value="">Prefer not to say</option>
              {SIZE_BUCKETS.map((s) => (
                <option key={s} value={s}>
                  {s} people
                </option>
              ))}
            </select>
          </Field>
          <Field label="Region" hint="Optional. Country or region, never a city if that would out you.">
            <input
              className={fieldClass}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="UK"
              maxLength={60}
            />
          </Field>
          <Field label="Department">
            <select className={fieldClass} value={roleFamily} onChange={(e) => setRoleFamily(e.target.value)}>
              {ROLE_FAMILIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Level">
            <select className={fieldClass} value={seniority} onChange={(e) => setSeniority(e.target.value)}>
              {SENIORITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={`How long you stayed — ${tenureMonths} months`}>
          <input
            type="range"
            min={0}
            max={120}
            step={1}
            value={tenureMonths}
            onChange={(e) => setTenureMonths(e.target.value)}
            className="w-full accent-acid"
          />
        </Field>
      </fieldset>

      <fieldset className="card flex flex-col gap-4 p-5">
        <legend className="label-xs px-1">Why you left</legend>
        <p className="text-xs text-muted">
          Pick up to {MAX_REASONS}. This is the part that turns your story into data other people can
          act on. {reasons.length}/{MAX_REASONS} selected.
        </p>
        {grouped.map(([group, items]) => (
          <div key={group}>
            <p className="label-xs mb-2">{group}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((r) => {
                const on = reasons.includes(r.code);
                return (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => toggleReason(r.code)}
                    aria-pressed={on}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                      on ? "border-acid bg-acid/10" : "border-line hover:border-muted"
                    }`}
                  >
                    <span className="block text-sm font-medium">{r.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{r.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="card flex flex-col gap-5 p-5">
        <legend className="label-xs px-1">How bad was it</legend>
        <Field label={`Severity — ${severity}: ${SEVERITY_LABELS[severity]}`}>
          <input
            type="range"
            min={1}
            max={5}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            className="w-full accent-acid"
          />
        </Field>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={warnFriend}
            onChange={(e) => setWarnFriend(e.target.checked)}
            className="mt-0.5 size-4 accent-acid"
          />
          <span className="text-sm">
            I would actively warn a friend against taking a job here.
            <span className="mt-0.5 block text-xs text-muted">
              The single strongest signal on the site.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="card flex flex-col gap-5 p-5">
        <legend className="label-xs px-1">The story</legend>
        <Field label="One-line summary">
          <input
            className={fieldClass}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Promoted on paper, given no authority, blamed for the outcome"
            maxLength={120}
            required
          />
        </Field>
        <Field label="What happened" hint="Specific incidents. Roles, not names.">
          <textarea
            className={`${fieldClass} min-h-56 resize-y leading-relaxed`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="I was hired to lead a team of four. Two weeks in, the team was reassigned and I was told to 'stay flexible'…"
            maxLength={6000}
            required
          />
        </Field>
        <p className={`font-mono text-xs ${bodyLength < 120 ? "text-ember" : "text-muted"}`}>
          {bodyLength} / 6000 {bodyLength < 120 && `— ${120 - bodyLength} more characters needed`}
        </p>
      </fieldset>

      <ReceiptComposer receipts={receipts} onChange={setReceipts} />

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={attest}
          onChange={(e) => setAttest(e.target.checked)}
          className="mt-0.5 size-4 accent-acid"
          required
        />
        <span>
          This is my own experience, described honestly, and it is my opinion of it. I have not named
          any individual, and I understand it will be published anonymously and permanently.
        </span>
      </label>

      {error && (
        <div className="card border-alarm/50 p-4">
          <p className="font-semibold text-alarm">{error}</p>
          {findings.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {findings.map((f, i) => (
                <li key={i}>
                  <span className="font-mono text-[11px] uppercase text-muted">{f.action}</span>{" "}
                  {f.message}
                  {f.excerpt && (
                    <span className="mt-1 block font-mono text-xs text-muted">“{f.excerpt}”</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-acid px-5 py-2.5 font-semibold text-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:opacity-85"
        >
          {busy ? "Screening…" : "Publish anonymously"}
        </button>
        <span className="text-xs text-muted">
          Screened for names and contact details before it goes live.
        </span>
      </div>
    </form>
  );
}
