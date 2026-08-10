'use client';

import { AlertTriangle, Check, X } from 'lucide-react';
import type { ComplianceReport, CheckStatus } from '@/lib/compliance';
import { cx } from './ui';

const ICONS: Record<CheckStatus, typeof Check> = {
  pass: Check,
  warn: AlertTriangle,
  fail: X,
};

const TONES: Record<CheckStatus, string> = {
  pass: 'text-ok',
  warn: 'text-warn',
  fail: 'text-bad',
};

const BADGES: Record<CheckStatus, string> = {
  pass: 'border-ok/30 bg-ok/10 text-ok',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  fail: 'border-bad/30 bg-bad/10 text-bad',
};

export function ComplianceCard({
  report,
  title,
  subtitle,
  compact,
}: {
  report: ComplianceReport;
  title: string;
  subtitle?: string;
  compact?: boolean;
}) {
  const overall: CheckStatus = !report.ok ? 'fail' : report.hasWarnings ? 'warn' : 'pass';
  const failures = report.checks.filter((c) => c.status === 'fail');
  const summary = !report.ok
    ? `${failures.length} ${failures.length === 1 ? 'requisito não atendido' : 'requisitos não atendidos'}`
    : report.hasWarnings
      ? 'Deve passar (valores estimados)'
      : 'Atende a todos os requisitos';

  return (
    <div
      className={cx(
        'rounded-2xl border bg-ink-900/70',
        overall === 'pass' ? 'border-ok/25' : overall === 'warn' ? 'border-warn/25' : 'border-bad/30',
      )}
    >
      <header className="border-b border-ink-800 px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
          <h3 className="text-sm font-semibold text-ink-100">{title}</h3>
          <span
            className={cx(
              'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
              BADGES[overall],
            )}
          >
            {summary}
          </span>
        </div>
        {subtitle && <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{subtitle}</p>}
      </header>

      <ul className="divide-y divide-ink-800/70">
        {report.checks.map((check) => {
          const Icon = ICONS[check.status];
          return (
            <li key={check.id} className="flex items-start gap-3 px-4 py-2.5">
              <span
                className={cx(
                  'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                  check.status === 'pass'
                    ? 'border-ok/40 bg-ok/10'
                    : check.status === 'warn'
                      ? 'border-warn/40 bg-warn/10'
                      : 'border-bad/40 bg-bad/10',
                )}
              >
                <Icon size={12} className={TONES[check.status]} strokeWidth={3} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-ink-200">{check.label}</span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-400">
                    {check.detail}
                  </span>
                </div>
                {check.status === 'fail' && !compact && (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-bad/85">{check.requirement}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
