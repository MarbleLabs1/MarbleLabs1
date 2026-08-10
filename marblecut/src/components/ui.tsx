'use client';

import type { ReactNode } from 'react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  size = 'md',
  disabled,
  title,
  type = 'button',
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'subtle' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const variants = {
    primary: 'bg-accent text-white hover:bg-accent-soft shadow-lg shadow-accent/20',
    ghost: 'bg-ink-800 text-ink-100 hover:bg-ink-700 border border-ink-700',
    subtle: 'bg-transparent text-ink-300 hover:text-ink-100 hover:bg-ink-800',
    danger: 'bg-transparent text-bad hover:bg-bad/10 border border-bad/30',
  };
  const sizes = {
    sm: 'h-8 px-2.5 text-xs gap-1.5 rounded-lg',
    md: 'h-9 px-3.5 text-sm gap-2 rounded-xl',
    lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center font-medium transition-colors select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft',
        'disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  title,
  active,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft',
        'disabled:opacity-35 disabled:pointer-events-none',
        active
          ? 'border-accent/60 bg-accent/15 text-accent-soft'
          : 'border-ink-700 bg-ink-800 text-ink-300 hover:text-ink-100 hover:bg-ink-700',
      )}
    >
      {children}
    </button>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-800 bg-ink-900/70">
      <header className="flex items-center justify-between gap-2 border-b border-ink-800 px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-400">{title}</h3>
        {action}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  onReset?: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink-300">{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[11px] tabular-nums text-ink-400">
            {format ? format(value) : value.toFixed(2)}
          </span>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-[10px] uppercase tracking-wide text-ink-500 transition-colors hover:text-accent-soft"
            >
              zerar
            </button>
          )}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div>
      {label && <span className="mb-1.5 block text-xs font-medium text-ink-300">{label}</span>}
      <div role="group" aria-label={label} className="flex gap-1 rounded-xl bg-ink-850 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-soft',
              value === option.value
                ? 'bg-accent text-white shadow-sm'
                : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-300">{label}</span>
      <span className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-850 px-2.5 focus-within:border-accent/60">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          className="h-9 w-full bg-transparent font-mono text-sm tabular-nums text-ink-100 outline-none"
        />
        {suffix && <span className="shrink-0 text-[11px] text-ink-500">{suffix}</span>}
      </span>
    </label>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-ink-300">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-8 w-14 rounded-lg"
      />
    </label>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.08em] text-ink-500">{label}</div>
      <div className="truncate font-mono text-xs tabular-nums text-ink-200">{value}</div>
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-ink-500">{children}</p>;
}
